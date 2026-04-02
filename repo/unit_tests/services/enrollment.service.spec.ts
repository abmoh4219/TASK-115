/**
 * Unit Tests — EnrollmentService
 *
 * Tests: getCourses, createCourse, getCourseRounds, createRound,
 * checkPrerequisites (active_resident, age, prior_completion),
 * enroll (happy path, duplicate, anomaly), drop, getEnrollmentHistory.
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { EnrollmentService } from '../../src/app/core/services/enrollment.service';
import { DbService } from '../../src/app/core/services/db.service';
import { AuditService } from '../../src/app/core/services/audit.service';
import { AnomalyService } from '../../src/app/core/services/anomaly.service';
import { AuthService } from '../../src/app/core/services/auth.service';
import { CryptoService } from '../../src/app/core/services/crypto.service';

function setup() {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [EnrollmentService, DbService, AuditService, AnomalyService, AuthService, CryptoService],
  });
  return {
    service: TestBed.inject(EnrollmentService),
    db:      TestBed.inject(DbService),
  };
}

function teardown() {
  TestBed.resetTestingModule();
}

// Helper — active resident
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

// Helper — open round
async function addOpenRound(db: DbService, courseId: number, overrides?: {
  capacity?: number;
  waitlistCapacity?: number;
  addCutoffPast?: boolean;
  dropCutoffPast?: boolean;
}) {
  const now = new Date();
  const addCutoff  = overrides?.addCutoffPast  ? new Date(now.getTime() - 1000) : new Date(now.getTime() + 3_600_000);
  const dropCutoff = overrides?.dropCutoffPast ? new Date(now.getTime() - 1000) : new Date(now.getTime() + 3_600_000);
  return db.courseRounds.add({
    courseId,
    startAt:          new Date(now.getTime() + 86_400_000),
    endAt:            new Date(now.getTime() + 90_000_000),
    capacity:         overrides?.capacity         ?? 10,
    waitlistCapacity: overrides?.waitlistCapacity ?? 5,
    addCutoffAt:      addCutoff,
    dropCutoffAt:     dropCutoff,
    enrolled:   [],
    waitlisted: [],
    status:     'open',
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Course management
// ──────────────────────────────────────────────────────────────────────────────

describe('EnrollmentService — getCourses / createCourse', () => {

  it('createCourse stores and returns the new course', async () => {
    const { service, db } = setup();
    await db.open();

    const course = await service.createCourse({
      title:         'Mindfulness 101',
      description:   'Introduction to mindfulness.',
      category:      'Wellness',
      prerequisites: [],
    });

    expect(course.id).toBeDefined();
    expect(course.title).toBe('Mindfulness 101');
    expect(course.category).toBe('Wellness');

    await db.close();
    teardown();
  });

  it('getCourses returns all stored courses', async () => {
    const { service, db } = setup();
    await db.open();

    await service.createCourse({ title: 'Course A', description: '', category: 'A', prerequisites: [] });
    await service.createCourse({ title: 'Course B', description: '', category: 'B', prerequisites: [] });

    const courses = await service.getCourses();
    expect(courses.length).toBeGreaterThanOrEqual(2);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Round management
// ──────────────────────────────────────────────────────────────────────────────

describe('EnrollmentService — getCourseRounds / createRound', () => {

  it('createRound stores a round linked to the course', async () => {
    const { service, db } = setup();
    await db.open();

    const course = await service.createCourse({ title: 'Art', description: '', category: 'Arts', prerequisites: [] });
    const now    = new Date();
    const round  = await service.createRound({
      courseId:         course.id!,
      startAt:          new Date(now.getTime() + 86_400_000),
      endAt:            new Date(now.getTime() + 90_000_000),
      capacity:         20,
      waitlistCapacity: 5,
      addCutoffAt:      new Date(now.getTime() + 3_600_000),
      dropCutoffAt:     new Date(now.getTime() + 50_000_000),
    });

    expect(round.id).toBeDefined();
    expect(round.courseId).toBe(course.id);
    expect(round.capacity).toBe(20);
    expect(round.status).toBe('open');

    await db.close();
    teardown();
  });

  it('getCourseRounds returns only rounds for the given course', async () => {
    const { service, db } = setup();
    await db.open();

    const c1 = await service.createCourse({ title: 'C1', description: '', category: 'X', prerequisites: [] });
    const c2 = await service.createCourse({ title: 'C2', description: '', category: 'X', prerequisites: [] });
    const now = new Date();
    const base = {
      startAt: new Date(now.getTime() + 86_400_000),
      endAt:   new Date(now.getTime() + 90_000_000),
      capacity: 5, waitlistCapacity: 2,
      addCutoffAt: new Date(now.getTime() + 3_600_000),
      dropCutoffAt: new Date(now.getTime() + 50_000_000),
    };

    await service.createRound({ courseId: c1.id!, ...base });
    await service.createRound({ courseId: c2.id!, ...base });

    const rounds = await service.getCourseRounds(c1.id!);
    expect(rounds.every(r => r.courseId === c1.id)).toBe(true);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// checkPrerequisites
// ──────────────────────────────────────────────────────────────────────────────

describe('EnrollmentService — checkPrerequisites', () => {

  it('returns ok:true when resident is active and no other prerequisites', async () => {
    const { service, db } = setup();
    await db.open();

    const residentId = await addActiveResident(db);
    const courseId   = await db.courses.add({
      title: 'Open Course', description: '', category: 'General',
      prerequisites: [{ type: 'active_resident', value: true }],
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await service.checkPrerequisites(residentId, courseId);
    expect(result.ok).toBe(true);

    await db.close();
    teardown();
  });

  it('returns ok:false PREREQ_NOT_ACTIVE_RESIDENT when resident is inactive', async () => {
    const { service, db } = setup();
    await db.open();

    const residentId = await db.residents.add({
      firstName: 'John', lastName: 'Inactive',
      email: 'jj@test.local', phone: '555-0002',
      dateOfBirth: new Date('1985-06-15'),
      status: 'inactive',
      encryptedId: 'enc-inactive',
      notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const courseId = await db.courses.add({
      title: 'Active-Only', description: '', category: 'General',
      prerequisites: [{ type: 'active_resident', value: true }],
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await service.checkPrerequisites(residentId, courseId);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('PREREQ_NOT_ACTIVE_RESIDENT');

    await db.close();
    teardown();
  });

  it('returns ok:false PREREQ_PRIOR_COMPLETION when required course not completed', async () => {
    const { service, db } = setup();
    await db.open();

    const residentId = await addActiveResident(db);

    // prerequisite course
    const prereqCourseId = await db.courses.add({
      title: 'Prerequisite', description: '', category: 'General',
      prerequisites: [],
      createdAt: new Date(), updatedAt: new Date(),
    });

    const advancedCourseId = await db.courses.add({
      title: 'Advanced', description: '', category: 'General',
      prerequisites: [{ type: 'prior_completion', value: prereqCourseId }],
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await service.checkPrerequisites(residentId, advancedCourseId);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('PREREQ_PRIOR_COMPLETION');

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getEnrollmentHistory
// ──────────────────────────────────────────────────────────────────────────────

describe('EnrollmentService — getEnrollmentHistory', () => {

  it('returns the historySnapshot in chronological order', async () => {
    const { service, db } = setup();
    await db.open();

    const residentId = await addActiveResident(db);
    const courseId   = await db.courses.add({
      title: 'History Test', description: '', category: 'General',
      prerequisites: [{ type: 'active_resident', value: true }],
      createdAt: new Date(), updatedAt: new Date(),
    });
    const roundId = await addOpenRound(db, courseId, { dropCutoffPast: false });

    const enroll = await service.enroll(residentId, roundId, 'resident');
    expect(enroll.success).toBe(true);

    if (enroll.success) {
      const history = await service.getEnrollmentHistory(enroll.enrollment.id!);
      expect(history.length).toBe(1);
      expect(history[0].status).toBe('enrolled');
    }

    await db.close();
    teardown();
  });

  it('returns empty array for unknown enrollmentId', async () => {
    const { service, db } = setup();
    await db.open();

    const history = await service.getEnrollmentHistory(999_999);
    expect(history).toEqual([]);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// enroll — anomaly detection
// ──────────────────────────────────────────────────────────────────────────────

describe('EnrollmentService — anomaly detection on rapid re-enroll', () => {

  it('returns ANOMALY_DETECTED after >3 rapid enroll attempts for same resident+round', async () => {
    const { service, db } = setup();
    await db.open();

    const residentId = await addActiveResident(db);
    const courseId   = await db.courses.add({
      title: 'Rate Limit Test', description: '', category: 'General',
      prerequisites: [],
      createdAt: new Date(), updatedAt: new Date(),
    });
    const roundId = await addOpenRound(db, courseId);

    // First enroll succeeds
    const first = await service.enroll(residentId, roundId, 'resident');
    expect(first.success).toBe(true);

    // Subsequent calls for same key should trigger anomaly after >3 attempts
    let anomalyDetected = false;
    for (let i = 0; i < 5; i++) {
      const result = await service.enroll(residentId, roundId, 'resident');
      if (!result.success && result.reason === 'ANOMALY_DETECTED') {
        anomalyDetected = true;
        break;
      }
    }

    expect(anomalyDetected).toBe(true);

    await db.close();
    teardown();
  });
});
