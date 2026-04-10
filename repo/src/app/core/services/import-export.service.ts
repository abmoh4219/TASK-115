import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import { DbService } from './db.service';
import { CryptoService } from './crypto.service';
import { AuditAction, AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { SearchService } from './search.service';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class ImportExportService {

  constructor(
    private db: DbService,
    private crypto: CryptoService,
    private audit: AuditService,
    private authService: AuthService,
    private search: SearchService,
    private logger: LoggerService,
  ) {}

  private requireRole(...allowedRoles: string[]): void {
    const current = this.authService.getCurrentRole();
    if (!current || !allowedRoles.includes(current)) {
      throw new Error(`Unauthorized: requires role ${allowedRoles.join(' or ')}`);
    }
  }

  // --------------------------------------------------
  // Export — encrypt full dataset as .hpd file
  // --------------------------------------------------

  private getActor(): { actorId: number; actorRole: string } {
    return {
      actorId:   this.authService.getCurrentUserId() ?? 0,
      actorRole: this.authService.getCurrentRole() ?? 'unknown',
    };
  }

  async exportData(password: string): Promise<void> {
    this.requireRole('admin');
    const { actorId, actorRole } = this.getActor();
    const snapshot = await this.db.exportAll();
    const json = JSON.stringify(snapshot);

    const payload = await this.crypto.encrypt(json, password);
    const payloadJson = JSON.stringify(payload);

    const blob = new Blob([payloadJson], { type: 'application/octet-stream' });
    const filename = `harborpoint-export-${Date.now()}.hpd`;
    saveAs(blob, filename);

    this.audit.log(AuditAction.DATA_EXPORTED, actorId, actorRole, 'database', 'all');
  }

  // --------------------------------------------------
  // Import — decrypt and validate .hpd file
  // --------------------------------------------------

  async importData(
    file: File,
    password: string,
    overwrite = false,
  ): Promise<{ success: boolean; reason?: string }> {
    this.requireRole('admin');
    const { actorId, actorRole } = this.getActor();
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      // Validate payload shape
      if (!payload.ciphertext || !payload.iv || !payload.salt) {
        return { success: false, reason: 'INVALID_FILE_FORMAT' };
      }

      let json: string;
      try {
        json = await this.crypto.decrypt(payload, password);
      } catch {
        return { success: false, reason: 'WRONG_PASSWORD' };
      }

      let data: Record<string, unknown[]>;
      try {
        data = JSON.parse(json);
      } catch {
        return { success: false, reason: 'CORRUPT_DATA' };
      }

      // ── Schema validation ─────────────────────────
      // All exported top-level collections must exist as arrays.
      const requiredCollections = [
        'buildings', 'units', 'rooms', 'occupancies', 'residents',
        'documents', 'messages', 'threads', 'enrollments', 'courses',
        'courseRounds', 'auditLogs', 'searchIndex', 'searchDictionary',
        'consentRecords', 'zeroResultsLog', 'contentPolicies', 'messageTemplates',
      ];
      for (const key of requiredCollections) {
        if (!Array.isArray(data[key])) {
          return { success: false, reason: `MISSING_KEY_${key.toUpperCase()}` };
        }
      }

      // Lightweight shape validation for critical entities
      const shapeError = this.validateShapes(data);
      if (shapeError) return { success: false, reason: shapeError };

      // Prototype pollution guard
      const sanitized = this.sanitizeImport(data);

      await this.db.importAll(sanitized, overwrite);

      // Rebuild search index after import
      try { await this.search.buildIndex(); } catch { /* non-critical */ }

      this.audit.log(AuditAction.DATA_IMPORTED, actorId, actorRole, 'database', 'all');

      return { success: true };
    } catch (err) {
      this.logger.error('ImportExportService', 'Import failed', err);
      return { success: false, reason: 'UNKNOWN_ERROR' };
    }
  }

  // --------------------------------------------------
  // Shape Validation — critical entity fields
  // Returns a reason-code string on failure, null on success.
  // --------------------------------------------------

  private validateShapes(data: Record<string, unknown[]>): string | null {
    const has = (obj: unknown, keys: string[]): boolean => {
      if (typeof obj !== 'object' || obj === null) return false;
      const o = obj as Record<string, unknown>;
      return keys.every(k => k in o);
    };
    const allObjects = (arr: unknown[]): boolean =>
      arr.every(x => typeof x === 'object' && x !== null);

    // residents
    if (!allObjects(data['residents'])) return 'INVALID_SHAPE_RESIDENTS';
    for (const r of data['residents'] as Record<string, unknown>[]) {
      if (!has(r, ['firstName', 'lastName', 'status'])) {
        return 'INVALID_SHAPE_RESIDENTS';
      }
      if (typeof r['firstName'] !== 'string' || typeof r['lastName'] !== 'string') {
        return 'INVALID_SHAPE_RESIDENTS';
      }
    }

    // documents
    if (!allObjects(data['documents'])) return 'INVALID_SHAPE_DOCUMENTS';
    for (const d of data['documents'] as Record<string, unknown>[]) {
      if (!has(d, ['residentId', 'status', 'mimeType', 'sizeBytes'])) {
        return 'INVALID_SHAPE_DOCUMENTS';
      }
      if (typeof d['residentId'] !== 'number' || typeof d['sizeBytes'] !== 'number') {
        return 'INVALID_SHAPE_DOCUMENTS';
      }
    }

    // enrollments
    if (!allObjects(data['enrollments'])) return 'INVALID_SHAPE_ENROLLMENTS';
    for (const e of data['enrollments'] as Record<string, unknown>[]) {
      if (!has(e, ['residentId', 'courseId', 'roundId', 'status', 'historySnapshot'])) {
        return 'INVALID_SHAPE_ENROLLMENTS';
      }
      if (!Array.isArray(e['historySnapshot'])) {
        return 'INVALID_SHAPE_ENROLLMENTS';
      }
    }

    // auditLogs
    if (!allObjects(data['auditLogs'])) return 'INVALID_SHAPE_AUDIT_LOGS';
    for (const a of data['auditLogs'] as Record<string, unknown>[]) {
      if (!has(a, ['timestamp', 'actorId', 'action', 'targetType', 'targetId'])) {
        return 'INVALID_SHAPE_AUDIT_LOGS';
      }
      if (typeof a['action'] !== 'string' || typeof a['targetType'] !== 'string') {
        return 'INVALID_SHAPE_AUDIT_LOGS';
      }
    }

    return null;
  }

  // --------------------------------------------------
  // Prototype Pollution Guard
  // --------------------------------------------------

  private sanitizeImport(data: Record<string, unknown>): Record<string, unknown[]> {
    const result: Record<string, unknown[]> = {};
    for (const [key, value] of Object.entries(data)) {
      // Reject dangerous keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (!Array.isArray(value)) continue;

      result[key] = value.map(item => {
        if (typeof item !== 'object' || item === null) return item;
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
          clean[k] = v;
        }
        return clean;
      });
    }
    return result;
  }
}
