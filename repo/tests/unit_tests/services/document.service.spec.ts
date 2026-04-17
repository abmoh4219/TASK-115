/**
 * Unit Tests — DocumentService
 *
 * Tests: uploadDocument (validation), grantConsent, revokeConsent,
 * getConsentStatus, reviewDocument (approve/reject).
 *
 * Uses fake-indexeddb + Web Crypto (available in jsdom via @peculiar/webcrypto shim).
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';

import { DocumentService } from '../../../src/app/core/services/document.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { ResidentService } from '../../../src/app/core/services/resident.service';
import { PropertyService } from '../../../src/app/core/services/property.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';
import { SearchService } from '../../../src/app/core/services/search.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';
import { ContentPolicyService } from '../../../src/app/core/services/content-policy.service';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function setup() {
  TestBed.configureTestingModule({
    providers: [
      DocumentService, DbService, AuditService, CryptoService,
      ResidentService, PropertyService, AuthService, LoggerService,
      SearchService, AnomalyService, ContentPolicyService,
    ],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return {
    service:  TestBed.inject(DocumentService),
    resident: TestBed.inject(ResidentService),
    db,
  };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes).fill(0x41); // 'A' bytes
  return new File([content], name, { type });
}

async function seedResident(db: DbService): Promise<number> {
  return db.residents.add({
    firstName:    'Doc',
    lastName:     'Tester',
    email:        'doc@hp.local',
    phone:        '555-0200',
    dateOfBirth:  new Date('1990-03-01'),
    status:       'active',
    encryptedId:  'fake.id',
    notes:        [],
    consentGiven: false,
    createdAt:    new Date(),
    updatedAt:    new Date(),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// uploadDocument — validation
// ──────────────────────────────────────────────────────────────────────────────

describe('DocumentService — uploadDocument validation', () => {

  it('throws INVALID_FILE_TYPE for unsupported mime types', async () => {
    const { service, db } = await setup();
    const residentId = await seedResident(db);
    const consentId = await service.grantConsent(residentId);
    const file = makeFile('doc.txt', 'text/plain');

    await expect(
      service.uploadDocument(residentId, file, consentId),
    ).rejects.toThrow('INVALID_FILE_TYPE');

    await teardown(db);
  });

  it('throws FILE_TOO_LARGE when file exceeds 10 MB', async () => {
    const { service, db } = await setup();
    const residentId = await seedResident(db);
    const consentId = await service.grantConsent(residentId);
    const file = makeFile('big.pdf', 'application/pdf', service.MAX_FILE_SIZE_BYTES + 1);

    await expect(
      service.uploadDocument(residentId, file, consentId),
    ).rejects.toThrow('FILE_TOO_LARGE');

    await teardown(db);
  });

  it('throws MAX_FILES_REACHED when resident already has 5 documents', async () => {
    const { service, db } = await setup();
    const residentId = await seedResident(db);
    const consentId = await service.grantConsent(residentId);

    // Seed 5 docs directly
    for (let i = 0; i < service.MAX_FILES_PER_RESIDENT; i++) {
      await db.documents.add({
        residentId,
        fileName:        `file${i}.pdf`,
        mimeType:        'application/pdf',
        sizeBytes:       512,
        fileHash:        'hash.iv',
        fileData:        'data.iv',
        status:          'pending_review',
        consentRecordId: consentId,
        hidden:          false,
        createdAt:       new Date(),
      });
    }

    const file = makeFile('extra.pdf', 'application/pdf');
    await expect(
      service.uploadDocument(residentId, file, consentId),
    ).rejects.toThrow('MAX_FILES_REACHED');

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// grantConsent / revokeConsent / getConsentStatus
// ──────────────────────────────────────────────────────────────────────────────

describe('DocumentService — consent operations', () => {

  it('grantConsent writes a consent record and sets resident.consentGiven=true', async () => {
    const { service, db } = await setup();
    const residentId = await seedResident(db);

    const consentId = await service.grantConsent(residentId);

    expect(consentId).toBeGreaterThan(0);

    const record = await db.consentRecords.get(consentId);
    expect(record).toBeDefined();
    expect(record!.action).toBe('granted');
    expect(record!.residentId).toBe(residentId);
    expect(record!.policyVersion).toBe(service.POLICY_VERSION);

    const resident = await db.residents.get(residentId);
    expect(resident!.consentGiven).toBe(true);

    await teardown(db);
  });

  it('revokeConsent hides existing docs and sets resident.consentGiven=false', async () => {
    const { service, db } = await setup();
    const residentId = await seedResident(db);

    await service.grantConsent(residentId);

    const docId = await db.documents.add({
      residentId,
      fileName:        'test.pdf',
      mimeType:        'application/pdf',
      sizeBytes:       512,
      fileHash:        'hash.iv',
      fileData:        'data.iv',
      status:          'pending_review',
      consentRecordId: 1,
      hidden:          false,
      createdAt:       new Date(),
    });

    await service.revokeConsent(residentId);

    const doc = await db.documents.get(docId);
    expect(doc!.hidden).toBe(true);

    const resident = await db.residents.get(residentId);
    expect(resident!.consentGiven).toBe(false);

    await teardown(db);
  });

  it('getConsentStatus reflects the latest consent action', async () => {
    const { service, db } = await setup();
    const residentId = await seedResident(db);

    // No records yet
    const initial = await service.getConsentStatus(residentId);
    expect(initial.granted).toBe(false);
    expect(initial.record).toBeUndefined();

    await service.grantConsent(residentId);
    const granted = await service.getConsentStatus(residentId);
    expect(granted.granted).toBe(true);

    await service.revokeConsent(residentId);
    const revoked = await service.getConsentStatus(residentId);
    expect(revoked.granted).toBe(false);

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// reviewDocument — approve / reject
// ──────────────────────────────────────────────────────────────────────────────

describe('DocumentService — reviewDocument', () => {

  it('approves a document and updates status', async () => {
    const { service, db } = await setup();
    const residentId = await seedResident(db);
    const auth = TestBed.inject(AuthService);

    const file = makeFile('lease.pdf', 'application/pdf');
    const consentId = await service.grantConsent(residentId);

    const uploaded = await service.uploadDocument(residentId, file, consentId);

    /* Switch to compliance role for review */
    await auth.selectRole('compliance', 'harborpoint2024');
    const reviewed = await service.reviewDocument(uploaded.id!, 'approved', '');

    expect(reviewed.status).toBe('approved');
    expect(reviewed.reviewedBy).toBe(3); // compliance user ID from AuthService.USER_ID_MAP
    expect(reviewed.reviewedAt).toBeInstanceOf(Date);

    await teardown(db);
  });

  it('rejects a document and stores review notes', async () => {
    const { service, db } = await setup();
    const residentId = await seedResident(db);
    const auth = TestBed.inject(AuthService);

    const file = makeFile('id.jpg', 'image/jpeg');
    const consentId = await service.grantConsent(residentId);

    const uploaded = await service.uploadDocument(residentId, file, consentId);

    /* Switch to compliance role for review */
    await auth.selectRole('compliance', 'harborpoint2024');
    const reviewed = await service.reviewDocument(
      uploaded.id!, 'rejected', 'Document is unreadable.',
    );

    expect(reviewed.status).toBe('rejected');
    expect(reviewed.reviewNotes).toBe('Document is unreadable.');

    await teardown(db);
  });
});
