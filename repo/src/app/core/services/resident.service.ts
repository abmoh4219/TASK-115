import { Injectable } from '@angular/core';
import { DbService, Resident, AuditLog } from './db.service';
import { AuditAction, AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import DOMPurify from 'dompurify';

// =====================================================
// Public Types
// =====================================================

export interface ResidentFilters {
  status?:     ('active' | 'inactive' | 'pending')[];
  buildingId?: number;
  search?:     string;
}

export type CreateResidentData = Omit<
  Resident,
  'id' | 'encryptedId' | 'notes' | 'consentGiven' | 'consentTimestamp' | 'createdAt' | 'updatedAt'
>;

export type UpdateResidentData = Partial<
  Omit<Resident, 'id' | 'encryptedId' | 'createdAt'>
>;

// =====================================================
// ResidentService
// =====================================================

@Injectable({ providedIn: 'root' })
export class ResidentService {

  constructor(
    private db:          DbService,
    private audit:       AuditService,
    private authService: AuthService,
    private crypto:      CryptoService,
  ) {}

  private requireRole(...allowedRoles: string[]): void {
    const current = this.authService.getCurrentRole();
    if (!current || !allowedRoles.includes(current)) {
      throw new Error(`Unauthorized: requires role ${allowedRoles.join(' or ')}`);
    }
  }

  private requireSelfOrRole(resourceOwnerId: number, ...allowedRoles: string[]): void {
    const current = this.authService.getCurrentRole();
    const currentUserId = this.authService.getCurrentUserId();
    if (!current) throw new Error('Unauthorized: not authenticated');
    if (allowedRoles.includes(current)) return;
    if (current === 'resident' && currentUserId === resourceOwnerId) return;
    throw new Error('Unauthorized: insufficient permissions');
  }

  // --------------------------------------------------
  // Session key (derived from user password on login)
  // --------------------------------------------------

  private getSessionKey(): CryptoKey {
    const key = this.crypto.getSessionKey();
    if (!key) throw new Error('No active session key — please log in');
    return key;
  }

  // --------------------------------------------------
  // getResidents — with optional filters
  // --------------------------------------------------

  async getResidents(filters?: ResidentFilters): Promise<Resident[]> {
    this.requireRole('admin', 'compliance');
    let residents = await this.db.residents.toArray();

    if (!filters) return residents;

    // Status filter
    if (filters.status && filters.status.length > 0) {
      residents = residents.filter(r => filters.status!.includes(r.status));
    }

    // Full-text search (name / email)
    if (filters.search?.trim()) {
      const q = filters.search.toLowerCase().trim();
      residents = residents.filter(r =>
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q)  ||
        r.email.toLowerCase().includes(q),
      );
    }

    // Building filter — join through occupancy → room → unit → building
    if (filters.buildingId !== undefined) {
      const units   = await this.db.units.where('buildingId').equals(filters.buildingId).toArray();
      const unitIds = units.map(u => u.id!);
      const rooms   = await this.db.rooms.filter(r => unitIds.includes(r.unitId)).toArray();
      const roomIds = new Set(rooms.map(r => r.id!));
      const occs    = await this.db.occupancies
        .filter(o => o.status === 'active' && roomIds.has(o.roomId))
        .toArray();
      const inBuilding = new Set(occs.map(o => o.residentId));
      residents = residents.filter(r => inBuilding.has(r.id!));
    }

    return residents;
  }

  // --------------------------------------------------
  // getResident
  // --------------------------------------------------

  async getResident(id: number, callerRole?: string): Promise<Resident | undefined> {
    this.requireSelfOrRole(id, 'admin', 'compliance');
    const role = callerRole ?? this.authService.getCurrentRole() ?? undefined;
    const resident = await this.db.residents.get(id);
    if (resident) await this.decryptConfidentialNotes(resident, role);
    return resident;
  }

  private async decryptConfidentialNotes(resident: Resident, callerRole?: string): Promise<void> {
    const canRead = callerRole === 'admin' || callerRole === 'compliance';
    const key = this.crypto.getSessionKey();
    for (const note of resident.notes) {
      if (note.confidential && note.encryptedText && canRead && key) {
        try {
          const dotIdx = note.encryptedText.indexOf('.');
          if (dotIdx > 0) {
            note.text = await this.crypto.decryptRaw(
              note.encryptedText.slice(0, dotIdx),
              note.encryptedText.slice(dotIdx + 1),
              key,
            );
          }
        } catch {
          // Decryption failed — keep redacted placeholder
        }
      }
    }
  }

  // --------------------------------------------------
  // createResident — encrypts identifier, writes audit
  // --------------------------------------------------

  async createResident(
    data:      CreateResidentData,
    actorId:   number,
    actorRole: string,
  ): Promise<Resident> {
    this.requireRole('admin');
    const now = new Date();

    // Generate a unique opaque identifier then encrypt with AES-GCM
    const rawId = `res-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const key   = this.getSessionKey();
    const { ciphertext, iv } = await this.crypto.encryptRaw(rawId, key);
    const encryptedId = `${ciphertext}.${iv}`;

    const id = await this.db.residents.add({
      firstName:    DOMPurify.sanitize(data.firstName.trim()),
      lastName:     DOMPurify.sanitize(data.lastName.trim()),
      email:        DOMPurify.sanitize(data.email.trim().toLowerCase()),
      phone:        DOMPurify.sanitize((data.phone ?? '').trim()),
      dateOfBirth:  data.dateOfBirth,
      status:       data.status,
      encryptedId,
      notes:        [],
      consentGiven: false,
      createdAt:    now,
      updatedAt:    now,
    });

    const resident = await this.db.residents.get(id);
    // Never log the encrypted ID in audit snapshots
    this.audit.log(
      AuditAction.RESIDENT_CREATED,
      actorId, actorRole,
      'resident', id,
      undefined,
      { ...resident, encryptedId: '[ENCRYPTED]' },
    );

    return resident!;
  }

  // --------------------------------------------------
  // updateResident — snapshots before/after, warns on
  // inactive status when active occupancy exists
  // --------------------------------------------------

  async updateResident(
    id:        number,
    data:      UpdateResidentData,
    actorId:   number,
    actorRole: string,
  ): Promise<{ resident: Resident; warnings: string[] }> {
    this.requireRole('admin', 'resident', 'compliance');
    const before = await this.db.residents.get(id);
    if (!before) throw new Error('RESIDENT_NOT_FOUND');

    const warnings: string[] = [];

    // Warn: marking inactive while still assigned to a room
    if (data.status === 'inactive' && before.status !== 'inactive') {
      const activeOcc = await this.db.occupancies
        .filter(o => o.residentId === id && o.status === 'active')
        .first();
      if (activeOcc) {
        const room = await this.db.rooms.get(activeOcc.roomId);
        warnings.push(
          `Resident has an active room assignment (Room ${room?.roomNumber ?? activeOcc.roomId}). ` +
          `Consider moving them out before deactivating.`,
        );
      }
    }

    // Sanitize mutable text fields
    const sanitized: UpdateResidentData = { ...data };
    if (data.firstName) sanitized.firstName = DOMPurify.sanitize(data.firstName.trim());
    if (data.lastName)  sanitized.lastName  = DOMPurify.sanitize(data.lastName.trim());
    if (data.email)     sanitized.email     = DOMPurify.sanitize(data.email.trim().toLowerCase());
    if (data.phone)     sanitized.phone     = DOMPurify.sanitize((data.phone ?? '').trim());

    // Encrypt confidential notes at rest
    if (sanitized.notes) {
      const key = this.crypto.getSessionKey();
      for (const note of sanitized.notes) {
        if (note.confidential && note.text && note.text !== '[CONFIDENTIAL]') {
          if (key) {
            const { ciphertext, iv } = await this.crypto.encryptRaw(note.text, key);
            note.encryptedText = `${ciphertext}.${iv}`;
            note.text = '[CONFIDENTIAL]';
          }
        }
      }
    }

    await this.db.residents.update(id, { ...sanitized, updatedAt: new Date() });
    const after = await this.db.residents.get(id);

    this.audit.log(
      AuditAction.RESIDENT_UPDATED,
      actorId, actorRole,
      'resident', id,
      { ...before, encryptedId: '[ENCRYPTED]' },
      { ...after,  encryptedId: '[ENCRYPTED]' },
    );

    return { resident: after!, warnings };
  }

  // --------------------------------------------------
  // getChangeLog — audit entries for a specific resident
  // --------------------------------------------------

  async getChangeLog(residentId: number): Promise<AuditLog[]> {
    this.requireRole('admin', 'compliance');
    const logs = await this.db.auditLogs
      .filter(l => l.targetType === 'resident' && Number(l.targetId) === residentId)
      .toArray();
    return logs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  // --------------------------------------------------
  // searchResidents — simple in-memory text search
  // (Phase 7 will wire this into the full search index)
  // --------------------------------------------------

  async searchResidents(query: string): Promise<Resident[]> {
    this.requireRole('admin', 'compliance');
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const all = await this.db.residents.toArray();
    return all.filter(r =>
      r.firstName.toLowerCase().includes(q) ||
      r.lastName.toLowerCase().includes(q)  ||
      r.email.toLowerCase().includes(q)     ||
      r.phone.includes(q),
    );
  }
}
