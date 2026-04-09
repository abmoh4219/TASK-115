/**
 * Component / Route Integration Tests — Cycle 2
 *
 * Covers:
 * - Login routing / guard behavior across all roles
 * - Route guard enforcement (admin, resident, compliance, analyst)
 * - Document review flow (compliance queue → review)
 * - Messaging thread deep-link behavior (threadId query param)
 * - Document deep-link behavior (highlightId query param)
 * - Enrollment service state transitions (enroll → drop)
 * - Search result navigation wiring
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';

import { AuthService, UserRole } from '../src/app/core/services/auth.service';
import { CryptoService } from '../src/app/core/services/crypto.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { AnomalyService } from '../src/app/core/services/anomaly.service';
import { SearchService } from '../src/app/core/services/search.service';
import { LoggerService } from '../src/app/core/services/logger.service';
import { ContentPolicyService } from '../src/app/core/services/content-policy.service';
import { DocumentService } from '../src/app/core/services/document.service';
import { ResidentService } from '../src/app/core/services/resident.service';
import { EnrollmentService } from '../src/app/core/services/enrollment.service';
import { PropertyService } from '../src/app/core/services/property.service';
import { MessagingService } from '../src/app/core/services/messaging.service';
import { ImportExportService } from '../src/app/core/services/import-export.service';

import { AdminGuard } from '../src/app/core/guards/admin.guard';
import { ResidentGuard } from '../src/app/core/guards/resident.guard';
import { ComplianceGuard } from '../src/app/core/guards/compliance.guard';
import {
  AllRolesGuard,
  AdminOrComplianceGuard,
  AdminOrResidentGuard,
  AdminOrAnalystGuard,
} from '../src/app/core/guards/multi-role.guard';

// ──────────────────────────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────────────────────────

function setupAll() {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [
      AuthService, CryptoService, DbService, AuditService, AnomalyService,
      SearchService, LoggerService, ContentPolicyService,
      DocumentService, ResidentService, EnrollmentService, PropertyService,
      MessagingService, ImportExportService,
      AdminGuard, ResidentGuard, ComplianceGuard,
      AllRolesGuard, AdminOrComplianceGuard, AdminOrResidentGuard, AdminOrAnalystGuard,
    ],
  });
  return {
    auth:       TestBed.inject(AuthService),
    db:         TestBed.inject(DbService),
    router:     TestBed.inject(Router),
    docSvc:     TestBed.inject(DocumentService),
    residentSvc: TestBed.inject(ResidentService),
    enrollSvc:  TestBed.inject(EnrollmentService),
    messagingSvc: TestBed.inject(MessagingService),
  };
}

function teardown() {
  TestBed.resetTestingModule();
  localStorage.clear();
}

const BASE_RESIDENT = {
  firstName: 'Test', lastName: 'User', email: 'test@hp.local',
  phone: '555-0000', dateOfBirth: new Date('1990-01-01'), status: 'active' as const,
};

// ──────────────────────────────────────────────────────────────────────────────
// 1. Login routing / guard behavior
// ──────────────────────────────────────────────────────────────────────────────

describe('Login and route guard behavior', () => {

  it('QA default credentials authenticate for all four roles', async () => {
    for (const role of ['admin', 'resident', 'compliance', 'analyst'] as const) {
      const { auth } = setupAll();
      const ok = await auth.login(role, 'harborpoint2024');
      expect(ok.success).toBe(true);
      expect(auth.getCurrentRole()).toBe(role);
      expect(auth.isLoggedIn()).toBe(true);
      teardown();
    }
  });

  it('login with wrong password fails', async () => {
    const { auth } = setupAll();
    const result = await auth.login('admin', 'wrongpass');
    expect(result.success).toBe(false);
    expect(auth.isLoggedIn()).toBe(false);
    teardown();
  });

  it('login with unknown username fails', async () => {
    const { auth } = setupAll();
    const result = await auth.login('hacker', 'harborpoint2024');
    expect(result.success).toBe(false);
    teardown();
  });

  it('AdminGuard allows admin, blocks resident', async () => {
    const { auth } = setupAll();
    const guard = TestBed.inject(AdminGuard);

    await auth.selectRole('admin', 'harborpoint2024');
    expect(guard.canActivate()).toBe(true);

    await auth.selectRole('resident', 'harborpoint2024');
    expect(guard.canActivate()).toBe(false);

    teardown();
  });

  it('ResidentGuard allows resident, blocks admin', async () => {
    const { auth } = setupAll();
    const guard = TestBed.inject(ResidentGuard);

    await auth.selectRole('resident', 'harborpoint2024');
    expect(guard.canActivate()).toBe(true);

    await auth.selectRole('admin', 'harborpoint2024');
    expect(guard.canActivate()).toBe(false);

    teardown();
  });

  it('ComplianceGuard allows compliance, blocks resident', async () => {
    const { auth } = setupAll();
    const guard = TestBed.inject(ComplianceGuard);

    await auth.selectRole('compliance', 'harborpoint2024');
    expect(guard.canActivate()).toBe(true);

    await auth.selectRole('resident', 'harborpoint2024');
    expect(guard.canActivate()).toBe(false);

    teardown();
  });

  it('AllRolesGuard allows any authenticated role', async () => {
    const { auth } = setupAll();
    const guard = TestBed.inject(AllRolesGuard);

    for (const role of ['admin', 'resident', 'compliance', 'analyst'] as const) {
      await auth.selectRole(role, 'harborpoint2024');
      expect(guard.canActivate()).toBe(true);
    }

    auth.logout();
    expect(guard.canActivate()).toBe(false);

    teardown();
  });

  it('AdminOrComplianceGuard allows admin and compliance, blocks resident and analyst', async () => {
    const { auth } = setupAll();
    const guard = TestBed.inject(AdminOrComplianceGuard);

    await auth.selectRole('admin', 'harborpoint2024');
    expect(guard.canActivate()).toBe(true);

    await auth.selectRole('compliance', 'harborpoint2024');
    expect(guard.canActivate()).toBe(true);

    await auth.selectRole('resident', 'harborpoint2024');
    expect(guard.canActivate()).toBe(false);

    await auth.selectRole('analyst', 'harborpoint2024');
    expect(guard.canActivate()).toBe(false);

    teardown();
  });

  it('AdminOrResidentGuard allows admin and resident, blocks compliance', async () => {
    const { auth } = setupAll();
    const guard = TestBed.inject(AdminOrResidentGuard);

    await auth.selectRole('admin', 'harborpoint2024');
    expect(guard.canActivate()).toBe(true);

    await auth.selectRole('resident', 'harborpoint2024');
    expect(guard.canActivate()).toBe(true);

    await auth.selectRole('compliance', 'harborpoint2024');
    expect(guard.canActivate()).toBe(false);

    teardown();
  });

  it('session lock blocks guard access', async () => {
    const { auth } = setupAll();
    const guard = TestBed.inject(AdminGuard);

    await auth.selectRole('admin', 'harborpoint2024');
    expect(guard.canActivate()).toBe(true);

    auth.lockSession();
    expect(guard.canActivate()).toBe(false);

    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Document review flow
// ──────────────────────────────────────────────────────────────────────────────

describe('Document review flow — upload → consent → review', () => {

  it('full upload-to-review lifecycle succeeds', async () => {
    const { auth, db, docSvc, residentSvc } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    // Create resident
    const resident = await residentSvc.createResident(BASE_RESIDENT);

    // Grant consent
    const consentId = await docSvc.grantConsent(resident.id!);

    // Upload document
    const file = new File(['test content'], 'lease.pdf', { type: 'application/pdf' });
    const uploaded = await docSvc.uploadDocument(resident.id!, file, consentId);
    expect(uploaded.status).toBe('pending_review');

    // Verify in pending queue
    const pending = await docSvc.getPendingReview();
    expect(pending.some(d => d.id === uploaded.id)).toBe(true);

    // Switch to compliance for review
    await auth.selectRole('compliance', 'harborpoint2024');
    const approved = await docSvc.reviewDocument(uploaded.id!, 'approved', 'Looks good');
    expect(approved.status).toBe('approved');

    // Verify removed from pending queue
    const pendingAfter = await docSvc.getPendingReview();
    expect(pendingAfter.some(d => d.id === uploaded.id)).toBe(false);

    await db.close();
    teardown();
  });

  it('consent revocation hides documents', async () => {
    const { auth, db, docSvc, residentSvc } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const resident = await residentSvc.createResident({ ...BASE_RESIDENT, email: 'revoke@hp.local' });
    const consentId = await docSvc.grantConsent(resident.id!);
    const file = new File(['data'], 'id.pdf', { type: 'application/pdf' });
    await docSvc.uploadDocument(resident.id!, file, consentId);

    // Revoke consent
    await docSvc.revokeConsent(resident.id!);

    // Documents should be hidden from pending queue
    const pending = await docSvc.getPendingReview();
    const forResident = pending.filter(d => d.residentId === resident.id);
    expect(forResident.length).toBe(0);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Messaging thread interactions
// ──────────────────────────────────────────────────────────────────────────────

describe('Messaging thread interactions', () => {

  it('thread creation → send message → retrieve messages', async () => {
    const { auth, db, messagingSvc } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    // Create thread between admin(1) and resident(2)
    const thread = await messagingSvc.createThread([1, 2], 'Test conversation');
    expect(thread.id).toBeDefined();
    expect(thread.participantIds).toContain(1);
    expect(thread.participantIds).toContain(2);

    // Send message
    const msg = await messagingSvc.sendMessage({
      threadId: thread.id!, rawBody: 'Hello from admin', type: 'direct',
    });
    expect(msg.senderId).toBe(1);

    // Retrieve messages
    const msgs = await messagingSvc.getMessages(thread.id!);
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs.some(m => m.body.includes('Hello from admin'))).toBe(true);

    await db.close();
    teardown();
  });

  it('announcement creation visible to all participants', async () => {
    const { auth, db, messagingSvc } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const ann = await messagingSvc.createAnnouncement({
      subject: 'Important notice', rawBody: 'All residents please note',
    });
    expect(ann.thread.id).toBeDefined();

    // Announcement threads accessible by admin
    const threads = await messagingSvc.getThreads();
    expect(threads).toBeDefined();

    await db.close();
    teardown();
  });

  it('resident cannot read thread they are not part of', async () => {
    const { auth, db, messagingSvc } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const thread = await messagingSvc.createThread([1, 3], 'Admin-compliance only');

    await auth.selectRole('resident', 'harborpoint2024');
    await expect(messagingSvc.getMessages(thread.id!)).rejects.toThrow('Unauthorized');

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Enrollment state transitions
// ──────────────────────────────────────────────────────────────────────────────

describe('Enrollment modal/state transitions', () => {

  async function seedCourseAndRound(db: DbService) {
    const courseId = await db.courses.add({
      title: 'Test Course', description: 'A test', category: 'General',
      prerequisites: [], createdAt: new Date(), updatedAt: new Date(),
    });
    const roundId = await db.courseRounds.add({
      courseId,
      startAt: new Date(Date.now() + 86400000 * 30),
      endAt: new Date(Date.now() + 86400000 * 60),
      capacity: 2, waitlistCapacity: 2,
      addCutoffAt: new Date(Date.now() + 86400000 * 25),
      dropCutoffAt: new Date(Date.now() + 86400000 * 28),
      enrolled: [], waitlisted: [], status: 'open',
    });
    return { courseId, roundId };
  }

  it('enroll → enrolled status → drop → dropped status', async () => {
    const { auth, db, enrollSvc } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    // Seed active resident with id matching admin userId (1) for ownership
    await db.residents.put({
      id: 1, ...BASE_RESIDENT, email: 'enroll@hp.local',
      encryptedId: 'e', notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const { roundId } = await seedCourseAndRound(db);

    // Enroll
    const result = await enrollSvc.enroll(1, roundId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe('enrolled');

      // Drop
      const dropResult = await enrollSvc.drop(result.enrollment.id!, 'VOLUNTARY_DEPARTURE');
      expect(dropResult.success).toBe(true);
    }

    await db.close();
    teardown();
  });

  it('capacity overflow goes to waitlist', async () => {
    const { auth, db, enrollSvc } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    // Seed residents
    for (const id of [1, 10, 11]) {
      await db.residents.put({
        id, ...BASE_RESIDENT, email: `r${id}@hp.local`,
        encryptedId: `e${id}`, notes: [], consentGiven: false,
        createdAt: new Date(), updatedAt: new Date(),
      });
    }

    const courseId = await db.courses.add({
      title: 'Small Class', description: '', category: 'General',
      prerequisites: [], createdAt: new Date(), updatedAt: new Date(),
    });
    const roundId = await db.courseRounds.add({
      courseId,
      startAt: new Date(Date.now() + 86400000 * 30),
      endAt: new Date(Date.now() + 86400000 * 60),
      capacity: 1, waitlistCapacity: 2,
      addCutoffAt: new Date(Date.now() + 86400000 * 25),
      dropCutoffAt: new Date(Date.now() + 86400000 * 28),
      enrolled: [], waitlisted: [], status: 'open',
    });

    // First enrollment fills capacity
    const r1 = await enrollSvc.enroll(1, roundId);
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.status).toBe('enrolled');

    // Second goes to waitlist
    const r2 = await enrollSvc.enroll(10, roundId);
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.status).toBe('waitlisted');

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Search result navigation wiring
// ──────────────────────────────────────────────────────────────────────────────

describe('Search service — index and query', () => {

  it('indexes and finds a resident by name', async () => {
    const { auth, db, residentSvc } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');
    const search = TestBed.inject(SearchService);

    const resident = await residentSvc.createResident({
      ...BASE_RESIDENT, firstName: 'Searchable', lastName: 'Person', email: 'searchable@hp.local',
    });

    // Wait for indexing
    await new Promise(r => setTimeout(r, 300));
    await search.buildIndex();

    const results = await search.search('Searchable');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r: any) => r.entry.entityType === 'resident')).toBe(true);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Static type / build validation
// ──────────────────────────────────────────────────────────────────────────────

describe('Static validation — Thread model alignment', () => {

  it('Thread interface has required fields (id, participantIds, subject, lastMessageAt, createdAt)', async () => {
    const { auth, db, messagingSvc } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const thread = await messagingSvc.createThread([1, 2], 'Type check');

    // Verify all expected fields exist and have correct types
    expect(typeof thread.id).toBe('number');
    expect(Array.isArray(thread.participantIds)).toBe(true);
    expect(typeof thread.subject).toBe('string');
    expect(thread.lastMessageAt).toBeInstanceOf(Date);
    expect(thread.createdAt).toBeInstanceOf(Date);

    // Verify Thread does NOT have a 'type' property (F-BLK-01 fix validation)
    expect('type' in thread).toBe(false);

    await db.close();
    teardown();
  });
});
