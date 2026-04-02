import { Injectable } from '@angular/core';
import { DbService, Resident, AuditLog } from './db.service';
import { AuditAction, AuditService } from './audit.service';
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

  /** Cached internal encryption key — derived once per service lifecycle. */
  private internalKey: CryptoKey | null = null;
  private readonly INTERNAL_KEY_PASS = 'hp-resident-id-key-v1';
  private readonly INTERNAL_KEY_SALT = 'hp-resident-id-salt-v1';

  constructor(
    private db:     DbService,
    private audit:  AuditService,
    private crypto: CryptoService,
  ) {}

  // --------------------------------------------------
  // Internal key (derived once, then cached)
  // --------------------------------------------------

  private async getInternalKey(): Promise<CryptoKey> {
    if (!this.internalKey) {
      const salt = new TextEncoder().encode(this.INTERNAL_KEY_SALT);
      this.internalKey = await this.crypto.deriveKey(this.INTERNAL_KEY_PASS, salt);
    }
    return this.internalKey;
  }

  // --------------------------------------------------
  // getResidents — with optional filters
  // --------------------------------------------------

  async getResidents(filters?: ResidentFilters): Promise<Resident[]> {
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

  async getResident(id: number): Promise<Resident | undefined> {
    return this.db.residents.get(id);
  }

  // --------------------------------------------------
  // createResident — encrypts identifier, writes audit
  // --------------------------------------------------

  async createResident(
    data:      CreateResidentData,
    actorId:   number,
    actorRole: string,
  ): Promise<Resident> {
    const now = new Date();

    // Generate a unique opaque identifier then encrypt with AES-GCM
    const rawId = `res-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const key   = await this.getInternalKey();
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
