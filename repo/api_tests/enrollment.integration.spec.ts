/**
 * Enrollment Integration Tests
 * Tests: full enrollment flow, waitlist, drop rules (2h cutoff)
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { EnrollmentService } from '../src/app/core/services/enrollment.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { AnomalyService } from '../src/app/core/services/anomaly.service';
import { AuthService } from '../src/app/core/services/auth.service';
import { CryptoService } from '../src/app/core/services/crypto.service';
import { LoggerService } from '../src/app/core/services/logger.service';

async function seedTestCourse(db: DbService, options?: {
  capacity?: number;
  waitlistCapacity?: number;
  addCutoffFuture?: boolean;
  dropCutoffFuture?: boolean;
  startHoursFromNow?: number;
}) {
  const now = new Date();
  const opts = {
    capacity: options?.capacity ?? 2,
    waitlistCapacity: options?.waitlistCapacity ?? 2,
    addCutoffFuture: options?.addCutoffFuture ?? true,
    dropCutoffFuture: options?.dropCutoffFuture ?? true,
    startHoursFromNow: options?.startHoursFromNow ?? 24,
  };

  const courseId = await db.courses.add({
    title: 'Test Course',
    description: 'Test',
    category: 'Test',
    prerequisites: [{ type: 'active_resident', value: true }],
    createdAt: now,
    updatedAt: now,
  });

  const startAt = new Date(now.getTime() + opts.startHoursFromNow * 3600000);
  const endAt   = new Date(startAt.getTime() + 3600000);
  const addCutoffAt = opts.addCutoffFuture
    ? new Date(now.getTime() + 3600000)
    : new Date(now.getTime() - 3600000);
  const dropCutoffAt = opts.dropCutoffFuture
    ? new Date(startAt.getTime() - 3600000) // 1h before start
    : new Date(now.getTime() - 1000);

  const roundId = await db.courseRounds.add({
    courseId,
    startAt, endAt,
    capacity: opts.capacity,
    waitlistCapacity: opts.waitlistCapacity,
    addCutoffAt, dropCutoffAt,
    enrolled: [],
    waitlisted: [],
    status: 'open',
  });

  return { courseId, roundId };
}

async function seedActiveResident(db: DbService, id?: number): Promise<number> {
  return db.residents.add({
    firstName: 'Test', lastName: 'Resident',
    email: 'test@test.local', phone: '555-0000',
    dateOfBirth: new Date('1990-01-01'),
    status: 'active',
    encryptedId: 'enc-test',
    notes: [], consentGiven: false,
    createdAt: new Date(), updatedAt: new Date(),
  });
}

describe('Enrollment Integration — happy path', () => {
  let enrollmentService: EnrollmentService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [EnrollmentService, DbService, AuditService, AnomalyService, AuthService, CryptoService, LoggerService],
    });
    db = TestBed.inject(DbService);
    enrollmentService = TestBed.inject(EnrollmentService);
    await db.open();
    await db.courses.clear();
    await db.courseRounds.clear();
    await db.enrollments.clear();
    await db.residents.clear();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
    await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('enrolls an eligible resident', async () => {
    const residentId = await seedActiveResident(db);
    const { roundId } = await seedTestCourse(db);

    const result = await enrollmentService.enroll(residentId, roundId, 'resident');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.status).toBe('enrolled');
      expect(result.enrollment.residentId).toBe(residentId);
    }
  });

  it('adds to waitlist when capacity is full', async () => {
    const { roundId } = await seedTestCourse(db, { capacity: 1, waitlistCapacity: 5 });

    const r1 = await seedActiveResident(db);
    const r2 = await seedActiveResident(db);

    const e1 = await enrollmentService.enroll(r1, roundId, 'resident');
    expect(e1.success && e1.status).toBe('enrolled');

    const e2 = await enrollmentService.enroll(r2, roundId, 'resident');
    expect(e2.success && e2.status).toBe('waitlisted');
  });

  it('fails CAPACITY_EXCEEDED when both enrollment and waitlist are full', async () => {
    const { roundId } = await seedTestCourse(db, { capacity: 1, waitlistCapacity: 1 });
    const r1 = await seedActiveResident(db);
    const r2 = await seedActiveResident(db);
    const r3 = await seedActiveResident(db);

    await enrollmentService.enroll(r1, roundId, 'resident');
    await enrollmentService.enroll(r2, roundId, 'resident');
    const e3 = await enrollmentService.enroll(r3, roundId, 'resident');

    expect(e3.success).toBe(false);
    if (!e3.success) expect(e3.reason).toBe('CAPACITY_EXCEEDED');
  });

  it('rejects duplicate enrollment', async () => {
    const residentId = await seedActiveResident(db);
    const { roundId } = await seedTestCourse(db);

    await enrollmentService.enroll(residentId, roundId, 'resident');
    const second = await enrollmentService.enroll(residentId, roundId, 'resident');

    expect(second.success).toBe(false);
    if (!second.success) expect(second.reason).toBe('ALREADY_ENROLLED');
  });

  it('rejects inactive resident (prerequisite)', async () => {
    const residentId = await db.residents.add({
      firstName: 'Inactive', lastName: 'Resident',
      email: 'inactive@test.local', phone: '555-0099',
      dateOfBirth: new Date('1990-01-01'),
      status: 'inactive',
      encryptedId: 'enc-inactive',
      notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const { roundId } = await seedTestCourse(db);
    const result = await enrollmentService.enroll(residentId, roundId, 'resident');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe('PREREQ_NOT_ACTIVE_RESIDENT');
  });
});

describe('Enrollment Integration — drop rules', () => {
  let enrollmentService: EnrollmentService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [EnrollmentService, DbService, AuditService, AnomalyService, AuthService, CryptoService, LoggerService],
    });
    db = TestBed.inject(DbService);
    enrollmentService = TestBed.inject(EnrollmentService);
    await db.open();
    await db.courses.clear();
    await db.courseRounds.clear();
    await db.enrollments.clear();
    await db.residents.clear();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
    await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('allows drop before cutoff', async () => {
    const residentId = await seedActiveResident(db);
    const { roundId } = await seedTestCourse(db, { dropCutoffFuture: true });
    const enroll = await enrollmentService.enroll(residentId, roundId, 'resident');
    expect(enroll.success).toBe(true);

    if (enroll.success) {
      const drop = await enrollmentService.drop(enroll.enrollment.id!, residentId, 'resident', 'VOLUNTARY_DEPARTURE');
      expect(drop.success).toBe(true);
    }
  });

  it('rejects drop after cutoff (within 2h of start)', async () => {
    const residentId = await seedActiveResident(db);
    // Start in 1 hour → drop cutoff is 1h before start = now → already past
    const { roundId } = await seedTestCourse(db, {
      startHoursFromNow: 1,
      dropCutoffFuture: false,
    });
    const enroll = await enrollmentService.enroll(residentId, roundId, 'resident');

    if (enroll.success) {
      const drop = await enrollmentService.drop(enroll.enrollment.id!, residentId, 'resident', 'VOLUNTARY');
      expect(drop.success).toBe(false);
      if (!drop.success) expect(drop.reason).toBe('DROP_CUTOFF_PASSED');
    }
  });

  it('promotes from waitlist after drop (FIFO backfill)', async () => {
    const { roundId } = await seedTestCourse(db, { capacity: 1, waitlistCapacity: 5 });
    const r1 = await seedActiveResident(db);
    const r2 = await seedActiveResident(db);

    const e1 = await enrollmentService.enroll(r1, roundId, 'resident');
    const e2 = await enrollmentService.enroll(r2, roundId, 'resident'); // goes to waitlist

    expect(e1.success && e1.status).toBe('enrolled');
    expect(e2.success && e2.status).toBe('waitlisted');

    if (e1.success) {
      await enrollmentService.drop(e1.enrollment.id!, r1, 'resident', 'VOLUNTARY');
    }

    // r2 should now be enrolled
    if (e2.success) {
      const updated = await db.enrollments.get(e2.enrollment.id!);
      expect(updated?.status).toBe('enrolled');
    }
  });

  it('enrollment history is immutable — new entry appended on each state change', async () => {
    const residentId = await seedActiveResident(db);
    const { roundId } = await seedTestCourse(db, { dropCutoffFuture: true });
    const enroll = await enrollmentService.enroll(residentId, roundId, 'resident');
    expect(enroll.success).toBe(true);

    if (enroll.success) {
      expect(enroll.enrollment.historySnapshot.length).toBe(1);

      await enrollmentService.drop(enroll.enrollment.id!, residentId, 'resident', 'VOLUNTARY');
      const updated = await db.enrollments.get(enroll.enrollment.id!);
      expect(updated?.historySnapshot.length).toBe(2);
      expect(updated?.historySnapshot[0].status).toBe('enrolled');
      expect(updated?.historySnapshot[1].status).toBe('dropped');
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Course & Round management
// ──────────────────────────────────────────────────────────────────────────────

describe('Enrollment Integration — course & round management', () => {
  let enrollmentService: EnrollmentService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [EnrollmentService, DbService, AuditService, AnomalyService, AuthService, CryptoService, LoggerService],
    });
    db = TestBed.inject(DbService);
    enrollmentService = TestBed.inject(EnrollmentService);
    await db.open();
    await db.courses.clear();
    await db.courseRounds.clear();
    await db.enrollments.clear();
    await db.residents.clear();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
    await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('createCourse persists title, description, category, and timestamps', async () => {
    const course = await enrollmentService.createCourse({
      title: 'Integration Art', description: 'Art basics', category: 'Arts', prerequisites: [],
    });

    expect(course.id).toBeDefined();
    expect(course.title).toBe('Integration Art');
    expect(course.category).toBe('Arts');
    expect(course.createdAt).toBeInstanceOf(Date);

    const fetched = await enrollmentService.getCourse(course.id!);
    expect(fetched?.title).toBe('Integration Art');
  });

  it('createRound linked to course is returned by getCourseRounds', async () => {
    const course = await enrollmentService.createCourse({
      title: 'Music', description: '', category: 'Arts', prerequisites: [],
    });
    const now = new Date();
    const round = await enrollmentService.createRound({
      courseId:         course.id!,
      startAt:          new Date(now.getTime() + 86_400_000),
      endAt:            new Date(now.getTime() + 90_000_000),
      capacity:         15,
      waitlistCapacity: 3,
      addCutoffAt:      new Date(now.getTime() + 3_600_000),
      dropCutoffAt:     new Date(now.getTime() + 50_000_000),
    });

    expect(round.status).toBe('open');

    const rounds = await enrollmentService.getCourseRounds(course.id!);
    expect(rounds.length).toBe(1);
    expect(rounds[0].capacity).toBe(15);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getEnrollmentHistory
// ──────────────────────────────────────────────────────────────────────────────

describe('Enrollment Integration — getEnrollmentHistory', () => {
  let enrollmentService: EnrollmentService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [EnrollmentService, DbService, AuditService, AnomalyService, AuthService, CryptoService, LoggerService],
    });
    db = TestBed.inject(DbService);
    enrollmentService = TestBed.inject(EnrollmentService);
    await db.open();
    await db.courses.clear();
    await db.courseRounds.clear();
    await db.enrollments.clear();
    await db.residents.clear();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
    await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('returns single enrolled entry after initial enroll', async () => {
    const residentId = await seedActiveResident(db);
    const { roundId } = await seedTestCourse(db);
    const enroll = await enrollmentService.enroll(residentId, roundId, 'resident');
    expect(enroll.success).toBe(true);

    if (enroll.success) {
      const history = await enrollmentService.getEnrollmentHistory(enroll.enrollment.id!);
      expect(history.length).toBe(1);
      expect(history[0].status).toBe('enrolled');
    }
  });

  it('returns two entries after enroll then drop', async () => {
    const residentId = await seedActiveResident(db);
    const { roundId } = await seedTestCourse(db, { dropCutoffFuture: true });
    const enroll = await enrollmentService.enroll(residentId, roundId, 'resident');
    expect(enroll.success).toBe(true);

    if (enroll.success) {
      await enrollmentService.drop(enroll.enrollment.id!, residentId, 'resident', 'VOLUNTARY');
      const history = await enrollmentService.getEnrollmentHistory(enroll.enrollment.id!);
      expect(history.length).toBe(2);
      expect(history[1].status).toBe('dropped');
      expect(history[1].reason).toBe('VOLUNTARY');
    }
  });

  it('returns empty array for non-existent enrollment id', async () => {
    const history = await enrollmentService.getEnrollmentHistory(999_888);
    expect(history).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// checkPrerequisites — detailed eligibility
// ──────────────────────────────────────────────────────────────────────────────

describe('Enrollment Integration — checkPrerequisites', () => {
  let enrollmentService: EnrollmentService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [EnrollmentService, DbService, AuditService, AnomalyService, AuthService, CryptoService, LoggerService],
    });
    db = TestBed.inject(DbService);
    enrollmentService = TestBed.inject(EnrollmentService);
    await db.open();
    await db.courses.clear();
    await db.courseRounds.clear();
    await db.enrollments.clear();
    await db.residents.clear();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
    await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('returns ok:true with details array when all prerequisites are met', async () => {
    const residentId = await seedActiveResident(db);
    const courseId   = await db.courses.add({
      title: 'Prereq Test', description: '', category: 'General',
      prerequisites: [{ type: 'active_resident', value: true }],
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await enrollmentService.checkPrerequisites(residentId, courseId);
    expect(result.ok).toBe(true);
    expect(result.details?.length).toBe(1);
    expect(result.details?.[0].met).toBe(true);
  });

  it('passes age prerequisite when resident is old enough', async () => {
    const residentId = await db.residents.add({
      firstName: 'Senior', lastName: 'Citizen',
      email: 'sr@test.local', phone: '555-0010',
      dateOfBirth: new Date('1950-01-01'),  // well over 18
      status: 'active',
      encryptedId: 'enc-sr',
      notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const courseId = await db.courses.add({
      title: 'Adults Only', description: '', category: 'General',
      prerequisites: [{ type: 'age', value: 18 }],
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await enrollmentService.checkPrerequisites(residentId, courseId);
    expect(result.ok).toBe(true);
  });

  it('fails age prerequisite when resident is too young', async () => {
    const residentId = await db.residents.add({
      firstName: 'Young', lastName: 'Resident',
      email: 'young@test.local', phone: '555-0011',
      dateOfBirth: new Date(new Date().getFullYear() - 10, 6, 1),  // ~10 years old
      status: 'active',
      encryptedId: 'enc-young',
      notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const courseId = await db.courses.add({
      title: 'Adults Only', description: '', category: 'General',
      prerequisites: [{ type: 'age', value: 18 }],
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await enrollmentService.checkPrerequisites(residentId, courseId);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('PREREQ_AGE_18');
  });
});
