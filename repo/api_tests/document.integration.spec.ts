/**
 * Document Integration Tests
 * Tests: upload → review → consent revoke flow, file limits
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DocumentService } from '../src/app/core/services/document.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { CryptoService } from '../src/app/core/services/crypto.service';

// Helpers
function makeFile(name: string, sizeBytes: number, type = 'application/pdf'): File {
  const data = new Uint8Array(sizeBytes);
  return new File([data], name, { type });
}

async function seedConsentedResident(db: DbService): Promise<number> {
  const id = await db.residents.add({
    firstName: 'Test', lastName: 'User',
    email: 'doc@test.local', phone: '555-9999',
    dateOfBirth: new Date('1990-01-01'),
    status: 'active',
    encryptedId: 'enc-test',
    notes: [], consentGiven: true,
    consentTimestamp: new Date(),
    createdAt: new Date(), updatedAt: new Date(),
  });
  await db.consentRecords.add({
    residentId: id, action: 'granted',
    timestamp: new Date(), policyVersion: '1.0',
  });
  return id;
}

describe('Document Integration — upload flow', () => {
  let service: DocumentService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [DocumentService, DbService, AuditService, CryptoService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(DocumentService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('uploads a PDF for a consented resident', async () => {
    const residentId = await seedConsentedResident(db);
    const file = makeFile('id.pdf', 1024);
    const result = await service.upload({ residentId, file, actorId: residentId, actorRole: 'resident', password: 'testpass' });
    expect(result.success).toBe(true);
    expect(result.document?.status).toBe('pending_review');
  });

  it('rejects upload when no consent given', async () => {
    const residentId = await db.residents.add({
      firstName: 'No', lastName: 'Consent',
      email: 'nc@test.local', phone: '555-0000',
      dateOfBirth: new Date('1990-01-01'), status: 'active',
      encryptedId: 'enc', notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const file = makeFile('id.pdf', 1024);
    const result = await service.upload({ residentId, file, actorId: residentId, actorRole: 'resident', password: 'testpass' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('CONSENT_REQUIRED');
  });

  it('rejects files over 10 MB', async () => {
    const residentId = await seedConsentedResident(db);
    const bigFile = makeFile('huge.pdf', 11 * 1024 * 1024);
    const result = await service.upload({ residentId, file: bigFile, actorId: residentId, actorRole: 'resident', password: 'pass' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('FILE_TOO_LARGE');
  });

  it('rejects unsupported file types', async () => {
    const residentId = await seedConsentedResident(db);
    const exeFile = makeFile('virus.exe', 1024, 'application/octet-stream');
    const result = await service.upload({ residentId, file: exeFile, actorId: residentId, actorRole: 'resident', password: 'pass' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('INVALID_FILE_TYPE');
  });

  it('rejects more than 5 files per resident', async () => {
    const residentId = await seedConsentedResident(db);
    for (let i = 0; i < 5; i++) {
      const f = makeFile(`doc${i}.pdf`, 512);
      await service.upload({ residentId, file: f, actorId: residentId, actorRole: 'resident', password: 'pass' });
    }
    const sixth = makeFile('doc6.pdf', 512);
    const result = await service.upload({ residentId, file: sixth, actorId: residentId, actorRole: 'resident', password: 'pass' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('MAX_FILES_EXCEEDED');
  });
});

describe('Document Integration — review flow', () => {
  let service: DocumentService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [DocumentService, DbService, AuditService, CryptoService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(DocumentService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('approves a document', async () => {
    const residentId = await seedConsentedResident(db);
    const file = makeFile('lease.pdf', 2048);
    const uploadResult = await service.upload({ residentId, file, actorId: residentId, actorRole: 'resident', password: 'pass' });
    expect(uploadResult.success).toBe(true);

    const docId = uploadResult.document!.id!;
    await service.approve(docId, 'Looks good', 2, 'compliance');

    const updated = await db.documents.get(docId);
    expect(updated?.status).toBe('approved');
    expect(updated?.reviewNotes).toBe('Looks good');
  });

  it('rejects a document', async () => {
    const residentId = await seedConsentedResident(db);
    const file = makeFile('id.jpg', 2048, 'image/jpeg');
    const uploadResult = await service.upload({ residentId, file, actorId: residentId, actorRole: 'resident', password: 'pass' });

    const docId = uploadResult.document!.id!;
    await service.reject(docId, 'Blurry image', 2, 'compliance');

    const updated = await db.documents.get(docId);
    expect(updated?.status).toBe('rejected');
  });
});

describe('Document Integration — consent revoke', () => {
  let service: DocumentService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [DocumentService, DbService, AuditService, CryptoService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(DocumentService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('hides documents when consent is revoked (but does not delete)', async () => {
    const residentId = await seedConsentedResident(db);
    const file = makeFile('lease.pdf', 512);
    const uploadResult = await service.upload({ residentId, file, actorId: residentId, actorRole: 'resident', password: 'pass' });
    const docId = uploadResult.document!.id!;

    await service.revokeConsent(residentId, residentId, 'resident');

    // Document still exists in DB
    const doc = await db.documents.get(docId);
    expect(doc).toBeDefined();
    expect(doc?.hidden).toBe(true);

    // But getDocumentsForResident hides it by default
    const visible = await service.getDocumentsForResident(residentId);
    expect(visible.length).toBe(0);

    // Admin can still see with includeHidden=true
    const all = await service.getDocumentsForResident(residentId, true);
    expect(all.length).toBe(1);
  });
});
