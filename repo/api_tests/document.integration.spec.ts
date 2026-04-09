/**
 * Document Integration Tests
 *
 * Tests: full upload lifecycle, consent gate, compliance review flow
 * (approve/reject with audit trail), consent revocation hiding docs,
 * file hash encryption verification, formatSize helper.
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';

import { DocumentService } from '../src/app/core/services/document.service';
import { ResidentService } from '../src/app/core/services/resident.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { CryptoService } from '../src/app/core/services/crypto.service';
import { PropertyService } from '../src/app/core/services/property.service';
import { AuthService } from '../src/app/core/services/auth.service';
import { LoggerService } from '../src/app/core/services/logger.service';
import { SearchService } from '../src/app/core/services/search.service';
import { AnomalyService } from '../src/app/core/services/anomaly.service';
import { ContentPolicyService } from '../src/app/core/services/content-policy.service';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function setup() {
  TestBed.configureTestingModule({
    providers: [
      DocumentService, ResidentService, DbService,
      AuditService, CryptoService, PropertyService, AuthService, LoggerService,
      SearchService, AnomalyService, ContentPolicyService,
    ],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 200));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return {
    docService:      TestBed.inject(DocumentService),
    residentService: TestBed.inject(ResidentService),
    db,
  };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

function makeFile(name: string, type: string, sizeBytes = 2048): File {
  const content = new Uint8Array(sizeBytes).fill(0x42);
  return new File([content], name, { type });
}

const BASE_RESIDENT = {
  firstName:   'Integration',
  lastName:    'Tester',
  email:       'int@hp.local',
  phone:       '555-0300',
  dateOfBirth: new Date('1988-04-10'),
  status:      'active' as const,
};

// ──────────────────────────────────────────────────────────────────────────────
// Full Upload Lifecycle
// ──────────────────────────────────────────────────────────────────────────────

describe('Document Integration — upload lifecycle', () => {
  let docService: DocumentService;
  let db: DbService;
  let residentId: number;
  let consentId: number;

  beforeEach(async () => {
    ({ docService, db } = await setup());
    const residentService = TestBed.inject(ResidentService);
    const resident = await residentService.createResident(BASE_RESIDENT, 1, 'admin');
    residentId = resident.id!;
    consentId = await docService.grantConsent(residentId, 2, 'resident');
  });

  afterEach(async () => teardown(db));

  it('uploads a PDF and returns a document with pending_review status', async () => {
    const file = makeFile('lease.pdf', 'application/pdf');
    const doc  = await docService.uploadDocument(residentId, file, consentId, 2, 'resident');

    expect(doc.id).toBeDefined();
    expect(doc.status).toBe('pending_review');
    expect(doc.residentId).toBe(residentId);
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.fileName).toBe('lease.pdf');
    expect(doc.hidden).toBe(false);
    expect(doc.consentRecordId).toBe(consentId);
  });

  it('stores fileHash in encrypted ciphertext.iv format', async () => {
    const file = makeFile('id.jpg', 'image/jpeg');
    const doc  = await docService.uploadDocument(residentId, file, consentId, 2, 'resident');

    // fileHash must be stored encrypted: base64.base64
    expect(doc.fileHash).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
  });

  it('writes a DOCUMENT_UPLOADED audit entry with fileHash masked', async () => {
    const file = makeFile('photo.png', 'image/png');
    const doc  = await docService.uploadDocument(residentId, file, consentId, 2, 'resident');

    const logs = await db.auditLogs
      .filter(l => l.action === 'DOCUMENT_UPLOADED' && Number(l.targetId) === doc.id)
      .toArray();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const entry = logs[0];
    expect(JSON.stringify(entry.after)).toContain('[ENCRYPTED]');
    expect(JSON.stringify(entry.after)).not.toContain(doc.fileHash);
  });

  it('getDocuments returns docs sorted descending by createdAt', async () => {
    await docService.uploadDocument(residentId, makeFile('a.pdf', 'application/pdf'), consentId, 2, 'resident');
    await new Promise(r => setTimeout(r, 5));
    await docService.uploadDocument(residentId, makeFile('b.jpg', 'image/jpeg'), consentId, 2, 'resident');

    const docs = await docService.getDocuments(residentId);
    expect(docs.length).toBeGreaterThanOrEqual(2);
    expect(docs[0].fileName).toBe('b.jpg'); // most recent first
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Consent Gate
// ──────────────────────────────────────────────────────────────────────────────

describe('Document Integration — consent gate', () => {
  let docService: DocumentService;
  let db: DbService;
  let residentId: number;

  beforeEach(async () => {
    ({ docService, db } = await setup());
    const residentService = TestBed.inject(ResidentService);
    const resident = await residentService.createResident(BASE_RESIDENT, 1, 'admin');
    residentId = resident.id!;
  });

  afterEach(async () => teardown(db));

  it('getConsentStatus returns granted=false before any consent action', async () => {
    const status = await docService.getConsentStatus(residentId);
    expect(status.granted).toBe(false);
    expect(status.record).toBeUndefined();
  });

  it('grantConsent and revokeConsent produce correct consent history', async () => {
    await docService.grantConsent(residentId, 2, 'resident');
    await docService.revokeConsent(residentId, 2, 'resident');
    await docService.grantConsent(residentId, 2, 'resident');

    const records = await db.consentRecords
      .where('residentId').equals(residentId)
      .sortBy('timestamp');

    expect(records.length).toBe(3);
    expect(records[0].action).toBe('granted');
    expect(records[1].action).toBe('revoked');
    expect(records[2].action).toBe('granted');

    const status = await docService.getConsentStatus(residentId);
    expect(status.granted).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Compliance Review Flow
// ──────────────────────────────────────────────────────────────────────────────

describe('Document Integration — compliance review', () => {
  let docService: DocumentService;
  let db: DbService;
  let residentId: number;
  let consentId: number;

  beforeEach(async () => {
    ({ docService, db } = await setup());
    const residentService = TestBed.inject(ResidentService);
    const resident = await residentService.createResident(BASE_RESIDENT, 1, 'admin');
    residentId = resident.id!;
    consentId = await docService.grantConsent(residentId, 2, 'resident');
  });

  afterEach(async () => teardown(db));

  it('approve: status → approved, audit action = DOCUMENT_APPROVED', async () => {
    const uploaded = await docService.uploadDocument(
      residentId, makeFile('lease.pdf', 'application/pdf'), consentId, 2, 'resident',
    );
    const reviewed = await docService.reviewDocument(uploaded.id!, 'approved', '', 3, 'compliance');

    expect(reviewed.status).toBe('approved');
    expect(reviewed.reviewedBy).toBe(3);

    const logs = await db.auditLogs
      .filter(l => l.action === 'DOCUMENT_APPROVED' && Number(l.targetId) === uploaded.id)
      .toArray();
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('reject: status → rejected with notes, audit action = DOCUMENT_REJECTED', async () => {
    const uploaded = await docService.uploadDocument(
      residentId, makeFile('id.jpg', 'image/jpeg'), consentId, 2, 'resident',
    );
    const reviewed = await docService.reviewDocument(
      uploaded.id!, 'rejected', 'Image too blurry to verify.', 3, 'compliance',
    );

    expect(reviewed.status).toBe('rejected');
    expect(reviewed.reviewNotes).toBe('Image too blurry to verify.');

    const logs = await db.auditLogs
      .filter(l => l.action === 'DOCUMENT_REJECTED' && Number(l.targetId) === uploaded.id)
      .toArray();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    // audit snapshots must not expose raw fileHash/fileData
    const entry = logs[0];
    expect(JSON.stringify(entry.before)).toContain('[ENCRYPTED]');
    expect(JSON.stringify(entry.after)).toContain('[ENCRYPTED]');
  });

  it('getPendingReview excludes hidden docs and approved/rejected docs', async () => {
    const d1 = await docService.uploadDocument(
      residentId, makeFile('a.pdf', 'application/pdf'), consentId, 2, 'resident',
    );
    const d2 = await docService.uploadDocument(
      residentId, makeFile('b.jpg', 'image/jpeg'), consentId, 2, 'resident',
    );

    await docService.reviewDocument(d1.id!, 'approved', '', 3, 'compliance');
    await db.documents.update(d2.id!, { hidden: true });

    const pending = await docService.getPendingReview();
    const ids = pending.map(d => d.id);
    expect(ids).not.toContain(d1.id); // approved
    expect(ids).not.toContain(d2.id); // hidden
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Consent Revocation — hides all documents
// ──────────────────────────────────────────────────────────────────────────────

describe('Document Integration — consent revocation', () => {
  let docService: DocumentService;
  let db: DbService;
  let residentId: number;
  let consentId: number;

  beforeEach(async () => {
    ({ docService, db } = await setup());
    const residentService = TestBed.inject(ResidentService);
    const resident = await residentService.createResident(BASE_RESIDENT, 1, 'admin');
    residentId = resident.id!;
    consentId = await docService.grantConsent(residentId, 2, 'resident');
  });

  afterEach(async () => teardown(db));

  it('revokeConsent hides all non-hidden documents for the resident', async () => {
    await docService.uploadDocument(
      residentId, makeFile('a.pdf', 'application/pdf'), consentId, 2, 'resident',
    );
    await docService.uploadDocument(
      residentId, makeFile('b.jpg', 'image/jpeg'), consentId, 2, 'resident',
    );

    await docService.revokeConsent(residentId, 2, 'resident');

    const docs = await docService.getDocuments(residentId);
    for (const doc of docs) {
      expect(doc.hidden).toBe(true);
    }
    expect(docs.length).toBeGreaterThanOrEqual(2);
  });

  it('revokeConsent writes CONSENT_REVOKED + DOCUMENT_HIDDEN audit entries', async () => {
    await docService.uploadDocument(
      residentId, makeFile('id.jpg', 'image/jpeg'), consentId, 2, 'resident',
    );

    await docService.revokeConsent(residentId, 2, 'resident');

    const consentLog = await db.auditLogs
      .filter(l => l.action === 'CONSENT_REVOKED' && Number(l.targetId) === residentId)
      .toArray();
    expect(consentLog.length).toBeGreaterThanOrEqual(1);

    const hiddenLog = await db.auditLogs
      .filter(l => l.action === 'DOCUMENT_HIDDEN')
      .toArray();
    expect(hiddenLog.length).toBeGreaterThanOrEqual(1);
  });

  it('already-hidden documents are not double-hidden by revoke', async () => {
    const doc = await docService.uploadDocument(
      residentId, makeFile('c.png', 'image/png'), consentId, 2, 'resident',
    );
    await db.documents.update(doc.id!, { hidden: true });

    const hiddenCountBefore = (await db.auditLogs
      .filter(l => l.action === 'DOCUMENT_HIDDEN')
      .toArray()).length;

    await docService.revokeConsent(residentId, 2, 'resident');

    const hiddenCountAfter = (await db.auditLogs
      .filter(l => l.action === 'DOCUMENT_HIDDEN')
      .toArray()).length;

    // Already-hidden doc should not produce an extra DOCUMENT_HIDDEN entry
    expect(hiddenCountAfter).toBe(hiddenCountBefore);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// formatSize helper
// ──────────────────────────────────────────────────────────────────────────────

describe('Document Integration — formatSize', () => {
  let docService: DocumentService;
  let db: DbService;

  beforeEach(async () => {
    ({ docService, db } = await setup());
  });

  afterEach(async () => teardown(db));

  it('formats bytes, KB, and MB correctly', () => {
    expect(docService.formatSize(512)).toBe('512 B');
    expect(docService.formatSize(1536)).toBe('1.5 KB');
    expect(docService.formatSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
