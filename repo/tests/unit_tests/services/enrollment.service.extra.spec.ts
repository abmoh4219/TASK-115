/**
 * Extra coverage for EnrollmentService — waitlist enrollment, drop, getEnrollments
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { EnrollmentService } from '../../../src/app/core/services/enrollment.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';
import { SearchService } from '../../../src/app/core/services/search.service';

async function setup() {
  TestBed.configureTestingModule({
    providers: [EnrollmentService, DbService, AuditService, AnomalyService, AuthService, CryptoService, LoggerService, SearchService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return { service: TestBed.inject(EnrollmentService), db };
}

function teardown() {
  TestBed.resetTestingModule();
}

async function addActiveResident(db: DbService) {
  return db.residents.add({
    firstName: 'Jane', lastName: 'Doe',
    email: 'jane@test.local', phone: '555-0001',
    dateOfBirth: new Date('1990-01-01'),
    status: 'active',
    encryptedId: 'enc-unit',
    notes: [], consentGiven: false,
    createdAt: new Date(), updatedAt: new Date(),
  });
}

async function addCourse(db: DbService) {
  return db.courses.add({
    title: 'Extra Course', description: '', category: 'General',
    prerequisites: [],
    createdAt: new Date(), updatedAt: new Date(),
  });
}

async function addOpenRound(db: DbService, courseId: number, capacity = 10, waitlistCapacity = 5) {
  const now = new Date();
  return db.courseRounds.add({
    courseId,
    startAt:          new Date(now.getTime() + 86_400_000),
    endAt:            new Date(now.getTime() + 90_000_000),
    capacity,
    waitlistCapacity,
    addCutoffAt:      new Date(now.getTime() + 3_600_000),
    dropCutoffAt:     new Date(now.getTime() + 3_600_000),
    enrolled:   [],
    waitlisted: [],
    status:     'open',
  });
}

describe('EnrollmentService — enroll (waitlist path)', () => {
  it('puts resident on waitlist when capacity is full', async () => {
    const { service, db } = await setup();
    const residentId = await addActiveResident(db);
    const courseId   = await addCourse(db);
    // Full capacity (capacity=0), waitlist available
    const roundId    = await addOpenRound(db, courseId, 0, 5);

    const result = await service.enroll(residentId, roundId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.enrollment!.status).toBe('waitlisted');
    }

    await db.close();
    teardown();
  });

  it('fails when both capacity and waitlist are full', async () => {
    const { service, db } = await setup();
    const residentId = await addActiveResident(db);
    const courseId   = await addCourse(db);
    // Full capacity AND full waitlist
    const roundId    = await addOpenRound(db, courseId, 0, 0);

    const result = await service.enroll(residentId, roundId);
    expect(result.success).toBe(false);

    await db.close();
    teardown();
  });
});

describe('EnrollmentService — drop', () => {
  it('drops an enrolled resident', async () => {
    const { service, db } = await setup();
    const residentId = await addActiveResident(db);
    const courseId   = await addCourse(db);
    const roundId    = await addOpenRound(db, courseId);

    const enrolled = await service.enroll(residentId, roundId);
    expect(enrolled.success).toBe(true);
    if (!enrolled.success) return;

    const result = await service.drop(enrolled.enrollment!.id!, 'personal');
    expect(result.success).toBe(true);

    const updated = await db.enrollments.get(enrolled.enrollment!.id!);
    expect(updated!.status).toBe('dropped');

    await db.close();
    teardown();
  });
});

describe('EnrollmentService — drop promotes from waitlist', () => {
  it('promotes waitlisted resident when enrolled drops', async () => {
    const { service, db } = await setup();
    const residentA = await addActiveResident(db);
    const residentB = await addActiveResident(db);
    const courseId  = await addCourse(db);
    // capacity=1 so second resident goes to waitlist
    const roundId   = await addOpenRound(db, courseId, 1, 5);

    const enrollA = await service.enroll(residentA, roundId);
    expect(enrollA.success).toBe(true);

    const enrollB = await service.enroll(residentB, roundId);
    expect(enrollB.success).toBe(true);
    if (enrollB.success) {
      expect(enrollB.enrollment!.status).toBe('waitlisted');
    }

    // Drop A, B should be promoted
    if (enrollA.success) {
      const drop = await service.drop(enrollA.enrollment!.id!, 'personal');
      expect(drop.success).toBe(true);

      // Check B was promoted
      if (enrollB.success) {
        const updatedB = await db.enrollments.get(enrollB.enrollment!.id!);
        expect(updatedB?.status).toBe('enrolled');
      }
    }

    await db.close();
    teardown();
  });
});

describe('EnrollmentService — getEnrollments', () => {
  it('returns enrollments for a resident', async () => {
    const { service, db } = await setup();
    const residentId = await addActiveResident(db);
    const courseId   = await addCourse(db);
    const roundId    = await addOpenRound(db, courseId);
    await service.enroll(residentId, roundId);

    const enrollments = await service.getEnrollmentsForResident(residentId);
    expect(enrollments.length).toBeGreaterThan(0);

    await db.close();
    teardown();
  });

  it('returns enrollment history', async () => {
    const { service, db } = await setup();
    const residentId = await addActiveResident(db);
    const courseId   = await addCourse(db);
    const roundId    = await addOpenRound(db, courseId);
    const enrolled   = await service.enroll(residentId, roundId);
    if (enrolled.success) {
      const history = await service.getEnrollmentHistory(enrolled.enrollment!.id!);
      expect(Array.isArray(history)).toBe(true);
    }

    await db.close();
    teardown();
  });
});
