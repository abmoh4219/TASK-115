import { Injectable } from '@angular/core';
import { DbService, Document as HpDocument, ConsentRecord } from './db.service';
import { AuditAction, AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { ContentPolicyService } from './content-policy.service';
import { SearchService } from './search.service';
import DOMPurify from 'dompurify';

// =====================================================
// Public Types
// =====================================================

export type DocumentStatus = 'pending_review' | 'approved' | 'rejected';

export interface ConsentStatus {
  granted: boolean;
  record:  ConsentRecord | undefined;
}

// =====================================================
// DocumentService
// =====================================================

@Injectable({ providedIn: 'root' })
export class DocumentService {

  // --------------------------------------------------
  // Constants — exposed for tests
  // --------------------------------------------------

  readonly MAX_FILE_SIZE_BYTES      = 10 * 1024 * 1024; // 10 MB
  readonly MAX_FILES_PER_RESIDENT   = 5;
  readonly ALLOWED_MIME_TYPES       = ['application/pdf', 'image/jpeg', 'image/png'] as const;
  readonly POLICY_VERSION           = '1.0';

  constructor(
    private db:            DbService,
    private audit:         AuditService,
    private authService:   AuthService,
    private crypto:        CryptoService,
    private contentPolicy: ContentPolicyService,
    private searchService: SearchService,
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

  private getKey(): CryptoKey {
    const key = this.crypto.getSessionKey();
    if (!key) throw new Error('No active session key — please log in');
    return key;
  }

  // --------------------------------------------------
  // getDocuments
  // --------------------------------------------------

  async getDocuments(residentId: number): Promise<HpDocument[]> {
    this.requireSelfOrRole(residentId, 'admin', 'compliance');
    const docs = await this.db.documents
      .where('residentId').equals(residentId)
      .toArray();
    return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --------------------------------------------------
  // getPendingReview — all pending docs (compliance queue)
  // --------------------------------------------------

  async getPendingReview(): Promise<HpDocument[]> {
    this.requireRole('compliance', 'admin');
    return this.db.documents
      .filter(d => d.status === 'pending_review' && !d.hidden)
      .toArray();
  }

  // --------------------------------------------------
  // uploadDocument
  // Validates type / size / per-resident count, then
  // SHA-256 hashes the file (encrypted at rest),
  // encrypts file data, stores with pending_review.
  // --------------------------------------------------

  async uploadDocument(
    residentId:      number,
    file:            File,
    consentRecordId: number,
  ): Promise<HpDocument> {

    this.requireSelfOrRole(residentId, 'admin');
    const actorId   = this.authService.getCurrentUserId() ?? 0;
    const actorRole = this.authService.getCurrentRole() ?? 'unknown';

    // ── Consent validation ─────────────────────────
    const consentStatus = await this.getConsentStatus(residentId);
    if (!consentStatus.granted) {
      throw new Error('Upload rejected: resident has not granted document consent');
    }
    const consentRecord = await this.db.consentRecords.get(consentRecordId);
    if (!consentRecord || consentRecord.residentId !== residentId || consentRecord.action !== 'granted') {
      throw new Error('Upload rejected: invalid or mismatched consent record');
    }

    // ── Content policy check on file name ────────────
    const policyResult = await this.contentPolicy.evaluate(file.name);
    if (policyResult.action === 'block') {
      throw new Error('Document upload blocked by content safety policy');
    }

    // ── Validation ──────────────────────────────────
    if (!this.ALLOWED_MIME_TYPES.includes(file.type as never)) {
      throw new Error('INVALID_FILE_TYPE');
    }
    if (file.size > this.MAX_FILE_SIZE_BYTES) {
      throw new Error('FILE_TOO_LARGE');
    }
    const existingCount = await this.db.documents
      .where('residentId').equals(residentId)
      .count();
    if (existingCount >= this.MAX_FILES_PER_RESIDENT) {
      throw new Error('MAX_FILES_REACHED');
    }

    const buffer = await file.arrayBuffer();
    const key    = this.getKey();

    // ── SHA-256 hash — encrypted at rest ────────────
    const rawHash = await this.crypto.hashFile(buffer);
    const { ciphertext: hc, iv: hiv } = await this.crypto.encryptRaw(rawHash, key);
    const fileHash = `${hc}.${hiv}`;

    // ── File content — base64, encrypted at rest ────
    const rawBase64 = this.crypto.bufferToBase64(buffer);
    const { ciphertext: dc, iv: div } = await this.crypto.encryptRaw(rawBase64, key);
    const fileData = `${dc}.${div}`;

    const now = new Date();
    const id  = await this.db.documents.add({
      residentId,
      fileName:        DOMPurify.sanitize(file.name.trim()),
      mimeType:        file.type,
      sizeBytes:       file.size,
      fileHash,
      fileData,
      status:          'pending_review',
      consentRecordId,
      hidden:          false,
      createdAt:       now,
    });

    const doc = await this.db.documents.get(id);
    this.audit.log(
      AuditAction.DOCUMENT_UPLOADED,
      actorId, actorRole,
      'document', id,
      undefined,
      {
        id, residentId,
        fileName: doc!.fileName,
        mimeType: doc!.mimeType,
        sizeBytes: doc!.sizeBytes,
        status: 'pending_review',
        fileHash: '[ENCRYPTED]',
      },
    );

    // Index for full-text search
    this.searchService.reindexEntity({
      entityType: 'document',
      entityId: id,
      title: doc!.fileName,
      body: `pending_review`,
      tags: ['document', 'pending_review'],
      metadata: { mimeType: doc!.mimeType, sizeBytes: doc!.sizeBytes },
      category: 'document',
      createdAt: now,
    }).catch(() => {/* best-effort */});

    return doc!;
  }

  // --------------------------------------------------
  // reviewDocument — approve or reject with notes
  // --------------------------------------------------

  async reviewDocument(
    id:          number,
    decision:    'approved' | 'rejected',
    reviewNotes: string,
  ): Promise<HpDocument> {
    this.requireRole('compliance', 'admin');
    const actorId   = this.authService.getCurrentUserId() ?? 0;
    const actorRole = this.authService.getCurrentRole() ?? 'unknown';
    const before = await this.db.documents.get(id);
    if (!before) throw new Error('DOCUMENT_NOT_FOUND');

    const sanitizedNotes = DOMPurify.sanitize(reviewNotes.trim());
    await this.db.documents.update(id, {
      status:      decision,
      reviewNotes: sanitizedNotes,
      reviewedBy:  actorId,
      reviewedAt:  new Date(),
    });

    const after  = await this.db.documents.get(id);
    const action = decision === 'approved'
      ? AuditAction.DOCUMENT_APPROVED
      : AuditAction.DOCUMENT_REJECTED;

    this.audit.log(action, actorId, actorRole, 'document', id,
      { ...before, fileHash: '[ENCRYPTED]', fileData: '[ENCRYPTED]' },
      { ...after,  fileHash: '[ENCRYPTED]', fileData: '[ENCRYPTED]' },
    );

    return after!;
  }

  // --------------------------------------------------
  // grantConsent — writes consent record, sets resident
  // --------------------------------------------------

  async grantConsent(
    residentId: number,
  ): Promise<number> {
    this.requireSelfOrRole(residentId, 'admin');
    const actorId   = this.authService.getCurrentUserId() ?? 0;
    const actorRole = this.authService.getCurrentRole() ?? 'unknown';
    const consentId = await this.db.consentRecords.add({
      residentId,
      action:        'granted',
      timestamp:     new Date(),
      policyVersion: this.POLICY_VERSION,
    });
    await this.db.residents.update(residentId, {
      consentGiven:     true,
      consentTimestamp: new Date(),
    });
    this.audit.log(AuditAction.CONSENT_GRANTED, actorId, actorRole, 'resident', residentId);
    return consentId;
  }

  // --------------------------------------------------
  // revokeConsent — hides docs, writes consent record
  // --------------------------------------------------

  async revokeConsent(
    residentId: number,
  ): Promise<void> {
    this.requireSelfOrRole(residentId, 'admin');
    const actorId   = this.authService.getCurrentUserId() ?? 0;
    const actorRole = this.authService.getCurrentRole() ?? 'unknown';
    const docs = await this.db.documents
      .where('residentId').equals(residentId)
      .toArray();

    for (const doc of docs) {
      if (!doc.hidden) {
        await this.db.documents.update(doc.id!, { hidden: true });
        this.audit.log(
          AuditAction.DOCUMENT_HIDDEN,
          actorId, actorRole,
          'document', doc.id!,
          { ...doc, fileHash: '[ENCRYPTED]', fileData: '[ENCRYPTED]' },
          { ...doc, hidden: true, fileHash: '[ENCRYPTED]', fileData: '[ENCRYPTED]' },
        );
      }
    }

    await this.db.consentRecords.add({
      residentId,
      action:        'revoked',
      timestamp:     new Date(),
      policyVersion: this.POLICY_VERSION,
    });
    await this.db.residents.update(residentId, {
      consentGiven: false,
      consentTimestamp: undefined,
    });
    this.audit.log(AuditAction.CONSENT_REVOKED, actorId, actorRole, 'resident', residentId);
  }

  // --------------------------------------------------
  // getConsentStatus — returns latest consent record
  // --------------------------------------------------

  async getConsentStatus(residentId: number): Promise<ConsentStatus> {
    const records = await this.db.consentRecords
      .where('residentId').equals(residentId)
      .sortBy('timestamp');

    if (records.length === 0) return { granted: false, record: undefined };
    const latest = records[records.length - 1];
    return { granted: latest.action === 'granted', record: latest };
  }

  // --------------------------------------------------
  // getFileData — decrypt stored fileData for preview
  // Returns the raw base64 string of the original file.
  // --------------------------------------------------

  async getFileData(doc: HpDocument): Promise<string> {
    if (!doc.fileData) return '';
    const dotIdx = doc.fileData.indexOf('.');
    if (dotIdx < 0) {
      // Legacy: plain base64 (older records before encryption)
      return doc.fileData;
    }
    const ciphertext = doc.fileData.slice(0, dotIdx);
    const iv         = doc.fileData.slice(dotIdx + 1);
    const key = this.getKey();
    return this.crypto.decryptRaw(ciphertext, iv, key);
  }

  // --------------------------------------------------
  // createPreviewUrl — decrypts and creates a Blob URL
  // Caller must revoke with URL.revokeObjectURL() when done.
  // --------------------------------------------------

  async createPreviewUrl(doc: HpDocument): Promise<string> {
    const base64 = await this.getFileData(doc);
    if (!base64) return '';

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: doc.mimeType });
    return URL.createObjectURL(blob);
  }

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  formatSize(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
