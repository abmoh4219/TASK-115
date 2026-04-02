import { Injectable } from '@angular/core';
import { DbService, Document as HpDocument } from './db.service';
import { AuditAction, AuditService } from './audit.service';
import { CryptoService } from './crypto.service';
import DOMPurify from 'dompurify';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_RESIDENT = 5;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const POLICY_VERSION = '1.0';

export interface UploadResult {
  success: boolean;
  document?: HpDocument;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {

  constructor(
    private db: DbService,
    private audit: AuditService,
    private crypto: CryptoService,
  ) {}

  // --------------------------------------------------
  // Upload with Consent Gate
  // --------------------------------------------------

  async upload(params: {
    residentId: number;
    file: File;
    actorId: number;
    actorRole: string;
    password: string;   // used to encrypt fileHash
  }): Promise<UploadResult> {
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(params.file.type)) {
      return { success: false, reason: 'INVALID_FILE_TYPE' };
    }

    // Validate file size
    if (params.file.size > MAX_FILE_SIZE_BYTES) {
      return { success: false, reason: 'FILE_TOO_LARGE' };
    }

    // Check file count
    const existing = await this.db.documents
      .filter(d => d.residentId === params.residentId && !d.hidden)
      .count();
    if (existing >= MAX_FILES_PER_RESIDENT) {
      return { success: false, reason: 'MAX_FILES_EXCEEDED' };
    }

    // Check consent
    const resident = await this.db.residents.get(params.residentId);
    if (!resident?.consentGiven) {
      return { success: false, reason: 'CONSENT_REQUIRED' };
    }

    // Get the latest consent record
    const consentRecord = await this.db.consentRecords
      .filter(c => c.residentId === params.residentId && c.action === 'granted')
      .last();
    if (!consentRecord?.id) {
      return { success: false, reason: 'CONSENT_RECORD_NOT_FOUND' };
    }

    // Read file and compute hash
    const fileBuffer = await params.file.arrayBuffer();
    const rawHash = await this.crypto.hashFile(fileBuffer);

    // Encrypt the hash at rest
    const encryptedHashPayload = await this.crypto.encrypt(rawHash, params.password);
    const encryptedHash = JSON.stringify(encryptedHashPayload);

    // Encode file data as base64 for storage
    const base64Data = this.crypto.bufferToBase64(fileBuffer);

    const docId = await this.db.documents.add({
      residentId:      params.residentId,
      fileName:        DOMPurify.sanitize(params.file.name),
      mimeType:        params.file.type,
      sizeBytes:       params.file.size,
      fileHash:        encryptedHash,
      fileData:        base64Data,
      status:          'pending_review',
      consentRecordId: consentRecord.id,
      hidden:          false,
      createdAt:       new Date(),
    });

    const doc = await this.db.documents.get(docId);

    this.audit.log(
      AuditAction.DOCUMENT_UPLOADED,
      params.actorId,
      params.actorRole,
      'document',
      docId,
    );

    return { success: true, document: doc };
  }

  // --------------------------------------------------
  // Consent Management
  // --------------------------------------------------

  async grantConsent(residentId: number, actorId: number, actorRole: string): Promise<void> {
    await this.db.consentRecords.add({
      residentId,
      action: 'granted',
      timestamp: new Date(),
      policyVersion: POLICY_VERSION,
    });
    await this.db.residents.update(residentId, {
      consentGiven: true,
      consentTimestamp: new Date(),
    });
    this.audit.log(AuditAction.CONSENT_GRANTED, actorId, actorRole, 'resident', residentId);
  }

  async revokeConsent(residentId: number, actorId: number, actorRole: string): Promise<void> {
    await this.db.consentRecords.add({
      residentId,
      action: 'revoked',
      timestamp: new Date(),
      policyVersion: POLICY_VERSION,
    });
    await this.db.residents.update(residentId, { consentGiven: false });

    // Hide all documents — do NOT delete (audit entries kept)
    const docs = await this.db.documents
      .filter(d => d.residentId === residentId && !d.hidden)
      .toArray();
    for (const doc of docs) {
      await this.db.documents.update(doc.id!, { hidden: true });
      this.audit.log(AuditAction.DOCUMENT_HIDDEN, actorId, actorRole, 'document', doc.id!);
    }

    this.audit.log(AuditAction.CONSENT_REVOKED, actorId, actorRole, 'resident', residentId);
  }

  // --------------------------------------------------
  // Compliance Review
  // --------------------------------------------------

  async getPendingReview(): Promise<HpDocument[]> {
    return this.db.documents
      .filter(d => d.status === 'pending_review' && !d.hidden)
      .toArray();
  }

  async approve(docId: number, notes: string, reviewerId: number, actorRole: string): Promise<void> {
    const before = await this.db.documents.get(docId);
    await this.db.documents.update(docId, {
      status:      'approved',
      reviewNotes: DOMPurify.sanitize(notes),
      reviewedBy:  reviewerId,
      reviewedAt:  new Date(),
    });
    const after = await this.db.documents.get(docId);
    this.audit.log(AuditAction.DOCUMENT_APPROVED, reviewerId, actorRole, 'document', docId, before, after);
  }

  async reject(docId: number, notes: string, reviewerId: number, actorRole: string): Promise<void> {
    const before = await this.db.documents.get(docId);
    await this.db.documents.update(docId, {
      status:      'rejected',
      reviewNotes: DOMPurify.sanitize(notes),
      reviewedBy:  reviewerId,
      reviewedAt:  new Date(),
    });
    const after = await this.db.documents.get(docId);
    this.audit.log(AuditAction.DOCUMENT_REJECTED, reviewerId, actorRole, 'document', docId, before, after);
  }

  // --------------------------------------------------
  // Queries
  // --------------------------------------------------

  async getDocumentsForResident(residentId: number, includeHidden = false): Promise<HpDocument[]> {
    return this.db.documents
      .filter(d => d.residentId === residentId && (includeHidden || !d.hidden))
      .toArray();
  }
}
