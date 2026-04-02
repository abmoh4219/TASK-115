import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import { DbService } from './db.service';
import { CryptoService } from './crypto.service';
import { AuditAction, AuditService } from './audit.service';
import { SearchService } from './search.service';

@Injectable({ providedIn: 'root' })
export class ImportExportService {

  constructor(
    private db: DbService,
    private crypto: CryptoService,
    private audit: AuditService,
    private search: SearchService,
  ) {}

  // --------------------------------------------------
  // Export — encrypt full dataset as .hpd file
  // --------------------------------------------------

  async exportData(password: string, actorId: number, actorRole: string): Promise<void> {
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
    actorId: number,
    actorRole: string,
    overwrite = false,
  ): Promise<{ success: boolean; reason?: string }> {
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

      // Schema validation: ensure expected keys exist
      const requiredKeys = ['buildings', 'units', 'rooms', 'residents'];
      for (const key of requiredKeys) {
        if (!Array.isArray(data[key])) {
          return { success: false, reason: `MISSING_KEY_${key.toUpperCase()}` };
        }
      }

      // Prototype pollution guard
      const sanitized = this.sanitizeImport(data);

      await this.db.importAll(sanitized, overwrite);

      // Rebuild search index after import
      try { await this.search.buildIndex(); } catch { /* non-critical */ }

      this.audit.log(AuditAction.DATA_IMPORTED, actorId, actorRole, 'database', 'all');

      return { success: true };
    } catch (err) {
      console.error('[ImportExportService] Import failed:', err);
      return { success: false, reason: 'UNKNOWN_ERROR' };
    }
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
