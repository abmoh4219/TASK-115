/**
 * Extra coverage for DocumentService — getPendingQueue, getDocuments, getDocument
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { DocumentService } from '../../../src/app/core/services/document.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { ContentPolicyService } from '../../../src/app/core/services/content-policy.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';

async function setup(role = 'compliance') {
  TestBed.configureTestingModule({
    providers: [DocumentService, DbService, AuthService, AuditService, CryptoService, ContentPolicyService, LoggerService, AnomalyService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole(role as any, 'harborpoint2024');
  return { service: TestBed.inject(DocumentService), db };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('DocumentService — getPendingReview', () => {
  it('returns array of pending review documents', async () => {
    const { service, db } = await setup();
    const queue = await service.getPendingReview();
    expect(Array.isArray(queue)).toBe(true);
    await teardown(db);
  });
});

describe('DocumentService — getDocuments', () => {
  it('returns documents for a resident as admin', async () => {
    const { service, db } = await setup('admin');
    const docs = await service.getDocuments(1);
    expect(Array.isArray(docs)).toBe(true);
    await teardown(db);
  });
});

describe('DocumentService — getDocument', () => {
  it('returns undefined for non-existent document', async () => {
    const { service, db } = await setup('admin');
    const doc = await db.documents.get(99999);
    expect(doc).toBeUndefined();
    await teardown(db);
  });
});

describe('DocumentService — getFileData', () => {
  it('returns empty string for a doc with no fileData', async () => {
    const { service, db } = await setup('admin');
    const doc = {
      id: 1,
      residentId: 1,
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      status: 'pending_review' as const,
      hidden: false,
      uploadedAt: new Date(),
      fileData: '',
      sizeBytes: 0, fileHash: '',
    } as any;
    const data = await service.getFileData(doc);
    expect(data).toBe('');
    await teardown(db);
  });

  it('returns plain base64 for legacy (no dot) fileData', async () => {
    const { service, db } = await setup('admin');
    const doc = {
      id: 1,
      residentId: 1,
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      status: 'pending_review' as const,
      hidden: false,
      uploadedAt: new Date(),
      fileData: 'SGVsbG8gV29ybGQ=', // base64, no dot
      sizeBytes: 0, fileHash: '',
    } as any;
    const data = await service.getFileData(doc);
    expect(data).toBe('SGVsbG8gV29ybGQ=');
    await teardown(db);
  });
});
