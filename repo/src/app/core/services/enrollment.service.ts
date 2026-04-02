import { Injectable } from '@angular/core';
import { DbService, CourseRound, Enrollment, EnrollmentHistory, Course, CoursePrerequisite } from './db.service';
import { AuditAction, AuditService } from './audit.service';
import { AnomalyService } from './anomaly.service';
import DOMPurify from 'dompurify';

export type EnrollmentResult =
  | { success: true; status: 'enrolled' | 'waitlisted'; enrollment: Enrollment }
  | { success: false; reason: string };

export interface CreateCourseParams {
  title:         string;
  description:   string;
  category:      string;
  prerequisites: CoursePrerequisite[];
}

export interface CreateRoundParams {
  courseId:         number;
  startAt:          Date;
  endAt:            Date;
  capacity:         number;
  waitlistCapacity: number;
  addCutoffAt:      Date;
  dropCutoffAt:     Date;
}

@Injectable({ providedIn: 'root' })
export class EnrollmentService {

  constructor(
    private db:      DbService,
    private audit:   AuditService,
    private anomaly: AnomalyService,
  ) {}

  // --------------------------------------------------
  // Course Management
  // --------------------------------------------------

  async getCourses(): Promise<Course[]> {
    return this.db.courses.toArray();
  }

  async getCourse(id: number): Promise<Course | undefined> {
    return this.db.courses.get(id);
  }

  async createCourse(params: CreateCourseParams): Promise<Course> {
    const now = new Date();
    const id  = await this.db.courses.add({
      title:         DOMPurify.sanitize(params.title),
      description:   DOMPurify.sanitize(params.description),
      category:      DOMPurify.sanitize(params.category),
      prerequisites: params.prerequisites,
      createdAt:     now,
      updatedAt:     now,
    });
    return (await this.db.courses.get(id))!;
  }

  // --------------------------------------------------
  // Round Management
  // --------------------------------------------------

  async getCourseRounds(courseId: number): Promise<CourseRound[]> {
    return this.db.courseRounds.where('courseId').equals(courseId).toArray();
  }

  async createRound(params: CreateRoundParams): Promise<CourseRound> {
    const id = await this.db.courseRounds.add({
      courseId:         params.courseId,
      startAt:          params.startAt,
      endAt:            params.endAt,
      capacity:         params.capacity,
      waitlistCapacity: params.waitlistCapacity,
      addCutoffAt:      params.addCutoffAt,
      dropCutoffAt:     params.dropCutoffAt,
      enrolled:         [],
      waitlisted:       [],
      status:           'open',
    });
    return (await this.db.courseRounds.get(id))!;
  }

  // --------------------------------------------------
  // Enroll or Waitlist
  // --------------------------------------------------

  async enroll(residentId: number, roundId: number, actorRole: string): Promise<EnrollmentResult> {
    const round = await this.db.courseRounds.get(roundId);
    if (!round) return { success: false, reason: 'ROUND_NOT_FOUND' };
    if (round.status !== 'open') return { success: false, reason: 'ROUND_NOT_OPEN' };

    const now = new Date();
    if (now > round.addCutoffAt) return { success: false, reason: 'ADD_CUTOFF_PASSED' };

    // Check duplicate enrollment before anomaly tracking — a re-submission by an
    // already-enrolled resident is not a security anomaly, just a duplicate request.
    const existing = await this.db.enrollments
      .filter(e => e.residentId === residentId && e.roundId === roundId && e.status !== 'dropped')
      .first();
    if (existing) return { success: false, reason: 'ALREADY_ENROLLED' };

    const anomalyKey = `${residentId}-${roundId}`;
    const isAnomaly  = this.anomaly.trackRegistrationAttempt(anomalyKey);
    if (isAnomaly) {
      return { success: false, reason: 'ANOMALY_DETECTED' };
    }

    // Check prerequisites
    const prereqResult = await this.checkPrerequisites(residentId, round.courseId);
    if (!prereqResult.ok) return { success: false, reason: prereqResult.reason! };

    const historyEntry: EnrollmentHistory = {
      status:    'enrolled',
      changedAt: now,
      changedBy: residentId,
    };

    if (round.enrolled.length < round.capacity) {
      // Enroll directly
      await this.db.courseRounds.update(roundId, {
        enrolled: [...round.enrolled, residentId],
      });

      const id = await this.db.enrollments.add({
        residentId,
        courseId:        round.courseId,
        roundId,
        status:          'enrolled',
        enrolledAt:      now,
        historySnapshot: [historyEntry],
      });

      const enrollment = await this.db.enrollments.get(id);

      this.audit.log(AuditAction.ENROLLMENT_CREATED, residentId, actorRole, 'enrollment', id);

      return { success: true, status: 'enrolled', enrollment: enrollment! };
    }

    if (round.waitlisted.length < round.waitlistCapacity) {
      // Add to waitlist
      const wlEntry: EnrollmentHistory = { ...historyEntry, status: 'waitlisted' };
      await this.db.courseRounds.update(roundId, {
        waitlisted: [...round.waitlisted, residentId],
      });

      const id = await this.db.enrollments.add({
        residentId,
        courseId:        round.courseId,
        roundId,
        status:          'waitlisted',
        enrolledAt:      now,
        historySnapshot: [wlEntry],
      });

      const enrollment = await this.db.enrollments.get(id);

      this.audit.log(AuditAction.WAITLIST_ADDED, residentId, actorRole, 'enrollment', id);

      return { success: true, status: 'waitlisted', enrollment: enrollment! };
    }

    return { success: false, reason: 'CAPACITY_EXCEEDED' };
  }

  // --------------------------------------------------
  // Drop Enrollment
  // --------------------------------------------------

  async drop(enrollmentId: number, actorId: number, actorRole: string, reasonCode: string): Promise<{ success: boolean; reason?: string }> {
    const enrollment = await this.db.enrollments.get(enrollmentId);
    if (!enrollment) return { success: false, reason: 'NOT_FOUND' };
    if (enrollment.status === 'dropped') return { success: false, reason: 'ALREADY_DROPPED' };

    const round = await this.db.courseRounds.get(enrollment.roundId);
    if (!round) return { success: false, reason: 'ROUND_NOT_FOUND' };

    const now = new Date();
    if (now > round.dropCutoffAt) return { success: false, reason: 'DROP_CUTOFF_PASSED' };

    const historyEntry: EnrollmentHistory = {
      status:    'dropped',
      changedAt: now,
      changedBy: actorId,
      reason:    reasonCode,
    };

    await this.db.enrollments.update(enrollmentId, {
      status:          'dropped',
      droppedAt:       now,
      dropReasonCode:  reasonCode,
      historySnapshot: [...enrollment.historySnapshot, historyEntry],
    });

    // Remove from enrolled / waitlisted list
    if (enrollment.status === 'enrolled') {
      await this.db.courseRounds.update(enrollment.roundId, {
        enrolled: round.enrolled.filter(id => id !== enrollment.residentId),
      });
      await this.backfillFromWaitlist(enrollment.roundId, actorRole);
    } else {
      await this.db.courseRounds.update(enrollment.roundId, {
        waitlisted: round.waitlisted.filter(id => id !== enrollment.residentId),
      });
    }

    this.audit.log(AuditAction.ENROLLMENT_DROPPED, actorId, actorRole, 'enrollment', enrollmentId);

    return { success: true };
  }

  // --------------------------------------------------
  // Waitlist Backfill — FIFO / deterministic
  // --------------------------------------------------

  private async backfillFromWaitlist(roundId: number, actorRole: string): Promise<void> {
    const round = await this.db.courseRounds.get(roundId);
    if (!round || round.waitlisted.length === 0) return;
    if (round.enrolled.length >= round.capacity) return;

    const nextResidentId = round.waitlisted[0];

    // Promote from waitlist
    await this.db.courseRounds.update(roundId, {
      enrolled:   [...round.enrolled, nextResidentId],
      waitlisted: round.waitlisted.slice(1),
    });

    // Update enrollment record
    const enrollment = await this.db.enrollments
      .filter(e => e.residentId === nextResidentId && e.roundId === roundId && e.status === 'waitlisted')
      .first();

    if (enrollment?.id) {
      const historyEntry: EnrollmentHistory = {
        status:    'enrolled',
        changedAt: new Date(),
        changedBy: 0, // system-triggered
        reason:    'WAITLIST_PROMOTION',
      };
      await this.db.enrollments.update(enrollment.id, {
        status:          'enrolled',
        historySnapshot: [...enrollment.historySnapshot, historyEntry],
      });
      this.audit.log(AuditAction.WAITLIST_PROMOTED, nextResidentId, actorRole, 'enrollment', enrollment.id);
    }
  }

  // --------------------------------------------------
  // Prerequisites Check (public for UI eligibility display)
  // --------------------------------------------------

  async checkPrerequisites(residentId: number, courseId: number): Promise<{ ok: boolean; reason?: string; details?: { prereq: CoursePrerequisite; met: boolean; reason?: string }[] }> {
    const course = await this.db.courses.get(courseId);
    if (!course) return { ok: false, reason: 'COURSE_NOT_FOUND' };

    const resident = await this.db.residents.get(residentId);
    if (!resident) return { ok: false, reason: 'RESIDENT_NOT_FOUND' };

    const details: { prereq: CoursePrerequisite; met: boolean; reason?: string }[] = [];

    for (const prereq of course.prerequisites) {
      if (prereq.type === 'active_resident') {
        const met = resident.status === 'active';
        details.push({ prereq, met, reason: met ? undefined : 'PREREQ_NOT_ACTIVE_RESIDENT' });
        if (!met) return { ok: false, reason: 'PREREQ_NOT_ACTIVE_RESIDENT', details };
      }
      if (prereq.type === 'age') {
        const age = this.calculateAge(resident.dateOfBirth);
        const met = age >= (prereq.value as number);
        details.push({ prereq, met, reason: met ? undefined : `PREREQ_AGE_${prereq.value}` });
        if (!met) return { ok: false, reason: `PREREQ_AGE_${prereq.value}`, details };
      }
      if (prereq.type === 'prior_completion') {
        const completed = await this.db.enrollments
          .filter(e => e.residentId === residentId && e.courseId === (prereq.value as number) && e.status === 'completed')
          .count();
        const met = completed > 0;
        details.push({ prereq, met, reason: met ? undefined : 'PREREQ_PRIOR_COMPLETION' });
        if (!met) return { ok: false, reason: 'PREREQ_PRIOR_COMPLETION', details };
      }
    }

    return { ok: true, details };
  }

  private calculateAge(dob: Date): number {
    const now = new Date();
    let age   = now.getFullYear() - dob.getFullYear();
    const m   = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  }

  // --------------------------------------------------
  // Query helpers
  // --------------------------------------------------

  async getEnrollmentsForResident(residentId: number): Promise<Enrollment[]> {
    return this.db.enrollments.where('residentId').equals(residentId).toArray();
  }

  async getRoundEnrollments(roundId: number): Promise<Enrollment[]> {
    return this.db.enrollments.where('roundId').equals(roundId).toArray();
  }

  /**
   * Returns the historySnapshot for a given enrollment in chronological order.
   */
  async getEnrollmentHistory(enrollmentId: number): Promise<EnrollmentHistory[]> {
    const enrollment = await this.db.enrollments.get(enrollmentId);
    return enrollment?.historySnapshot ?? [];
  }
}
