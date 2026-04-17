/**
 * Service-Layer Authorization Tests
 * Verifies that unauthorized roles are rejected at the service layer.
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { PropertyService } from '../../../src/app/core/services/property.service';
import { DocumentService } from '../../../src/app/core/services/document.service';
import { EnrollmentService } from '../../../src/app/core/services/enrollment.service';
import { MessagingService } from '../../../src/app/core/services/messaging.service';
import { ResidentService } from '../../../src/app/core/services/resident.service';
import { ImportExportService } from '../../../src/app/core/services/import-export.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';
import { SearchService } from '../../../src/app/core/services/search.service';

function setupAll() {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [
      AuthService, CryptoService, DbService, AuditService, AnomalyService,
      PropertyService, DocumentService, EnrollmentService, MessagingService,
      ImportExportService, SearchService, ResidentService,
    ],
  });
  return {
    auth:       TestBed.inject(AuthService),
    property:   TestBed.inject(PropertyService),
    document:   TestBed.inject(DocumentService),
    enrollment: TestBed.inject(EnrollmentService),
    messaging:  TestBed.inject(MessagingService),
    importExport: TestBed.inject(ImportExportService),
    db:         TestBed.inject(DbService),
  };
}

function teardown() {
  TestBed.resetTestingModule();
  localStorage.clear();
}

// ──────────────────────────────────────────────────────────────────────────────
// Unauthorized role rejections
// ──────────────────────────────────────────────────────────────────────────────

describe('Service-layer authorization — unauthorized rejections', () => {

  it('property.createBuilding() as resident → throws Unauthorized', async () => {
    const { auth, property } = setupAll();
    await auth.selectRole('resident', 'harborpoint2024');

    await expect(
      property.createBuilding({ name: 'X', address: 'x', floors: 1 }),
    ).rejects.toThrow('Unauthorized');

    teardown();
  });

  it('property.moveIn() as analyst → throws Unauthorized', async () => {
    const { auth, property } = setupAll();
    await auth.selectRole('analyst', 'harborpoint2024');

    await expect(
      property.moveIn({ residentId: 1, roomId: 1, effectiveFrom: new Date(), reasonCode: 'MOVE_IN_NEW' }),
    ).rejects.toThrow('Unauthorized');

    teardown();
  });

  it('document.reviewDocument() as resident → throws Unauthorized', async () => {
    const { auth, document: docSvc } = setupAll();
    await auth.selectRole('resident', 'harborpoint2024');

    await expect(
      docSvc.reviewDocument(1, 'approved', 'ok'),
    ).rejects.toThrow('Unauthorized');

    teardown();
  });

  it('document.uploadDocument() as analyst → throws Unauthorized', async () => {
    const { auth, document: docSvc } = setupAll();
    await auth.selectRole('analyst', 'harborpoint2024');

    const fakeFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    await expect(
      docSvc.uploadDocument(1, fakeFile, 1),
    ).rejects.toThrow('Unauthorized');

    teardown();
  });

  it('enrollment.createCourse() as resident → throws Unauthorized', async () => {
    const { auth, enrollment } = setupAll();
    await auth.selectRole('resident', 'harborpoint2024');

    await expect(
      enrollment.createCourse({ title: 'X', description: 'x', category: 'X', prerequisites: [] }),
    ).rejects.toThrow('Unauthorized');

    teardown();
  });

  it('enrollment.enroll() as analyst → throws Unauthorized', async () => {
    const { auth, enrollment } = setupAll();
    await auth.selectRole('analyst', 'harborpoint2024');

    await expect(
      enrollment.enroll(1, 1),
    ).rejects.toThrow('Unauthorized');

    teardown();
  });

  it('messaging.createAnnouncement() as resident → throws Unauthorized', async () => {
    const { auth, messaging } = setupAll();
    await auth.selectRole('resident', 'harborpoint2024');

    await expect(
      messaging.createAnnouncement({ subject: 'X', rawBody: 'x' }),
    ).rejects.toThrow('Unauthorized');

    teardown();
  });

  it('importExport.exportData() as resident → throws Unauthorized', async () => {
    const { auth, importExport } = setupAll();
    await auth.selectRole('resident', 'harborpoint2024');

    await expect(
      importExport.exportData('pass'),
    ).rejects.toThrow('Unauthorized');

    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Authorized role happy paths
// ──────────────────────────────────────────────────────────────────────────────

describe('Service-layer authorization — authorized happy paths', () => {

  it('property.createBuilding() as admin → does NOT throw', async () => {
    const { auth, property, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const building = await property.createBuilding(
      { name: 'Auth Test', address: '1 Main', floors: 2 },
    );
    expect(building.name).toBe('Auth Test');

    await db.close();
    teardown();
  });

  it('document.reviewDocument() as compliance → does NOT throw (DOCUMENT_NOT_FOUND is OK)', async () => {
    const { auth, document: docSvc, db } = setupAll();
    await db.open();
    await auth.selectRole('compliance', 'harborpoint2024');

    // Method should pass auth check and fail on business logic (not found)
    await expect(
      docSvc.reviewDocument(99999, 'approved', 'looks good'),
    ).rejects.toThrow('DOCUMENT_NOT_FOUND');

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Messaging identity enforcement (Fix 2)
// ──────────────────────────────────────────────────────────────────────────────

describe('Service-layer authorization — messaging identity', () => {

  it('sendMessage uses session identity, not caller-provided ID', async () => {
    const { auth, messaging, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const thread = await messaging.createThread([1, 2], 'Identity test');
    const msg = await messaging.sendMessage({
      threadId: thread.id!, rawBody: 'hello', type: 'direct',
    });

    expect(msg.senderId).toBe(1); // admin userId from session
    expect(msg.senderRole).toBe('admin');

    await db.close();
    teardown();
  });

  it('getThreads as resident only returns own threads', async () => {
    const { auth, messaging, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    await messaging.createThread([2, 3], 'For resident');
    await messaging.createThread([5, 6], 'Not for resident');

    await auth.selectRole('resident', 'harborpoint2024');
    const threads = await messaging.getThreads();
    expect(threads.every(t => t.participantIds.includes(2))).toBe(true);

    await db.close();
    teardown();
  });

  it('getMessages throws for non-participant non-admin', async () => {
    const { auth, messaging, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const thread = await messaging.createThread([5, 6], 'Private');

    await auth.selectRole('resident', 'harborpoint2024');
    await expect(messaging.getMessages(thread.id!)).rejects.toThrow('Unauthorized');

    await db.close();
    teardown();
  });

  it('getMessages allows admin to access any thread', async () => {
    const { auth, messaging, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const thread = await messaging.createThread([5, 6], 'Other thread');
    const msgs = await messaging.getMessages(thread.id!);
    expect(msgs).toBeDefined();

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Consent enforcement (Fix 3)
// ──────────────────────────────────────────────────────────────────────────────

describe('Service-layer authorization — consent enforcement', () => {

  it('uploadDocument throws when no consent granted', async () => {
    const { auth, document: docSvc, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const residentId = await db.residents.add({
      firstName: 'No', lastName: 'Consent', email: 'nc@t.l', phone: '',
      dateOfBirth: new Date(), status: 'active', encryptedId: 'e',
      notes: [], consentGiven: false, createdAt: new Date(), updatedAt: new Date(),
    });

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    await expect(
      docSvc.uploadDocument(residentId, file, 999),
    ).rejects.toThrow(/consent/i);

    await db.close();
    teardown();
  });

  it('uploadDocument throws when consentRecordId belongs to different resident', async () => {
    const { auth, document: docSvc, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const r1 = await db.residents.add({
      firstName: 'R1', lastName: 'Test', email: 'r1@t.l', phone: '',
      dateOfBirth: new Date(), status: 'active', encryptedId: 'e1',
      notes: [], consentGiven: true, createdAt: new Date(), updatedAt: new Date(),
    });
    const r2 = await db.residents.add({
      firstName: 'R2', lastName: 'Test', email: 'r2@t.l', phone: '',
      dateOfBirth: new Date(), status: 'active', encryptedId: 'e2',
      notes: [], consentGiven: true, createdAt: new Date(), updatedAt: new Date(),
    });

    // Grant consent for r1 only
    const consentId = await docSvc.grantConsent(r1);
    // Also grant for r2 so the consent status check passes
    await docSvc.grantConsent(r2);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    // Use r1's consentId but upload for r2 — should fail
    await expect(
      docSvc.uploadDocument(r2, file, consentId),
    ).rejects.toThrow(/consent record/i);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Read path authorization (Fix 1)
// ──────────────────────────────────────────────────────────────────────────────

describe('Service-layer authorization — read path enforcement', () => {

  it('getResidents throws for resident role', async () => {
    const { auth, db } = setupAll();
    await db.open();
    await auth.selectRole('resident', 'harborpoint2024');

    const residentService = TestBed.inject(ResidentService);
    await expect(residentService.getResidents()).rejects.toThrow('Unauthorized');

    await db.close();
    teardown();
  });

  it('getResidents succeeds for admin role', async () => {
    const { auth, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const residentService = TestBed.inject(ResidentService);
    const result = await residentService.getResidents();
    expect(result).toBeDefined();

    await db.close();
    teardown();
  });

  it('getPendingReview throws for resident role', async () => {
    const { auth, document: docSvc, db } = setupAll();
    await db.open();
    await auth.selectRole('resident', 'harborpoint2024');

    await expect(docSvc.getPendingReview()).rejects.toThrow('Unauthorized');

    await db.close();
    teardown();
  });

  it('getDocuments for resident rejects access to other resident data', async () => {
    const { auth, document: docSvc, db } = setupAll();
    await db.open();
    await auth.selectRole('resident', 'harborpoint2024');

    // Resident userId=2 tries to access residentId=5 docs
    await expect(docSvc.getDocuments(5)).rejects.toThrow('Unauthorized');

    await db.close();
    teardown();
  });

  it('getDocuments for resident allows own data access', async () => {
    const { auth, document: docSvc, db } = setupAll();
    await db.open();
    await auth.selectRole('resident', 'harborpoint2024');

    // Resident userId=2, accessing residentId=2 docs
    const docs = await docSvc.getDocuments(2);
    expect(docs).toBeDefined();

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Thread and message participant enforcement (Fix 1)
// ──────────────────────────────────────────────────────────────────────────────

describe('Service-layer authorization — thread participant enforcement', () => {

  it('createThread throws when caller is not in participantIds and not admin', async () => {
    const { auth, messaging, db } = setupAll();
    await db.open();
    await auth.selectRole('resident', 'harborpoint2024');

    await expect(
      messaging.createThread([1, 3], 'private chat'),
    ).rejects.toThrow('Unauthorized: sender must be a participant');

    await db.close();
    teardown();
  });

  it('createThread succeeds when caller is in participantIds', async () => {
    const { auth, messaging, db } = setupAll();
    await db.open();
    await auth.selectRole('resident', 'harborpoint2024');

    const thread = await messaging.createThread([2, 1], 'valid chat');
    expect(thread.id).toBeDefined();
    expect(thread.participantIds).toContain(2);

    await db.close();
    teardown();
  });

  it('sendMessage throws when sender is not thread participant', async () => {
    const { auth, messaging, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const thread = await messaging.createThread([1, 3], 'admin thread');

    await auth.selectRole('resident', 'harborpoint2024');
    await expect(
      messaging.sendMessage({ threadId: thread.id!, rawBody: 'hello', type: 'direct' }),
    ).rejects.toThrow('Unauthorized: sender is not a participant');

    await db.close();
    teardown();
  });

  it('sendMessage succeeds when sender is thread participant', async () => {
    const { auth, messaging, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const thread = await messaging.createThread([1, 2], 'shared thread');

    await auth.selectRole('resident', 'harborpoint2024');
    const msg = await messaging.sendMessage({ threadId: thread.id!, rawBody: 'hello from resident', type: 'direct' });
    expect(msg.senderId).toBe(2);

    await db.close();
    teardown();
  });
});
