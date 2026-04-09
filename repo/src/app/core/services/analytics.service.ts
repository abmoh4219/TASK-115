import { Injectable } from '@angular/core';
import { DbService, Building, Occupancy, Enrollment, Message, AuditLog } from './db.service';
import { AuthService } from './auth.service';

// =====================================================
// Types
// =====================================================

export interface SummaryStats {
  activeResidents:      number;
  activeResidentsDelta: number;
  enrollmentsThisMonth: number;
  enrollmentsDelta:     number;
  pendingReviews:       number;
  pendingReviewsDelta:  number;
  messagesThisWeek:     number;
  messagesDelta:        number;
}

export interface BuildingOccupancy {
  buildingId:   number;
  buildingName: string;
  totalRooms:   number;
  occupied:     number;
  rate:         number;
}

export interface WeeklyEnrollment {
  weekLabel: string;
  enrolled:  number;
  waitlisted: number;
  dropped:   number;
}

export interface CourseEnrollmentStat {
  courseId:       number;
  title:         string;
  enrolled:      number;
  waitlisted:    number;
  dropped:       number;
  completionPct: number;
}

export interface TopSearchTerm {
  term:  string;
  count: number;
}

export interface CompliancePipeline {
  pending:           number;
  approved:          number;
  rejected:          number;
  avgReviewHours:    number;
  oldestPendingDays: number;
  approvalRate:      number;
}

export interface DailyMessaging {
  dateLabel:      string;
  direct:         number;
  announcements:  number;
}

export interface CompareResult {
  labelA:  string;
  labelB:  string;
  metricA: number;
  metricB: number;
  winner:  'a' | 'b' | 'tie';
  metric:  string;
}

// =====================================================
// AnalyticsService
// =====================================================

@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  constructor(
    private db: DbService,
    private authService: AuthService,
  ) {}

  private requireRole(...allowedRoles: string[]): void {
    const current = this.authService.getCurrentRole();
    if (!current || !allowedRoles.includes(current)) {
      throw new Error(`Unauthorized: requires role ${allowedRoles.join(' or ')}`);
    }
  }

  // --------------------------------------------------
  // Summary Stats
  // --------------------------------------------------

  async getSummaryStats(): Promise<SummaryStats> {
    this.requireRole('admin', 'analyst');
    const now = new Date();

    // Active residents — current vs last month
    const residents = await this.db.residents.toArray();
    const activeResidents = residents.filter(r => r.status === 'active').length;

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const resCreatedLastMonth = residents.filter(r =>
      r.status === 'active' && r.createdAt >= lastMonth && r.createdAt < thisMonth
    ).length;
    const resCreatedThisMonth = residents.filter(r =>
      r.status === 'active' && r.createdAt >= thisMonth
    ).length;
    const activeResidentsDelta = resCreatedLastMonth > 0
      ? Math.round(((resCreatedThisMonth - resCreatedLastMonth) / resCreatedLastMonth) * 100)
      : (resCreatedThisMonth > 0 ? 100 : 0);

    // Enrollments this month vs last month
    const enrollments = await this.db.enrollments.toArray();
    const enrollThisMonth = enrollments.filter(e => e.enrolledAt >= thisMonth).length;
    const enrollLastMonth = enrollments.filter(e =>
      e.enrolledAt >= lastMonth && e.enrolledAt < thisMonth
    ).length;
    const enrollmentsDelta = enrollLastMonth > 0
      ? Math.round(((enrollThisMonth - enrollLastMonth) / enrollLastMonth) * 100)
      : (enrollThisMonth > 0 ? 100 : 0);

    // Pending reviews
    const docs = await this.db.documents.toArray();
    const pendingReviews = docs.filter(d => d.status === 'pending_review' && !d.hidden).length;
    const lastWeekStart = new Date(now.getTime() - 14 * 86_400_000);
    const thisWeekStart = new Date(now.getTime() - 7 * 86_400_000);
    const pendingLastWeek = docs.filter(d =>
      d.status === 'pending_review' && d.createdAt >= lastWeekStart && d.createdAt < thisWeekStart
    ).length;
    const pendingThisWeek = docs.filter(d =>
      d.status === 'pending_review' && d.createdAt >= thisWeekStart
    ).length;
    const pendingReviewsDelta = pendingLastWeek > 0
      ? Math.round(((pendingThisWeek - pendingLastWeek) / pendingLastWeek) * 100)
      : (pendingThisWeek > 0 ? 100 : 0);

    // Messages this week vs last week
    const messages = await this.db.messages.toArray();
    const msgsThisWeek = messages.filter(m => m.createdAt >= thisWeekStart).length;
    const msgsLastWeek = messages.filter(m =>
      m.createdAt >= lastWeekStart && m.createdAt < thisWeekStart
    ).length;
    const messagesDelta = msgsLastWeek > 0
      ? Math.round(((msgsThisWeek - msgsLastWeek) / msgsLastWeek) * 100)
      : (msgsThisWeek > 0 ? 100 : 0);

    return {
      activeResidents,      activeResidentsDelta,
      enrollmentsThisMonth: enrollThisMonth, enrollmentsDelta: enrollmentsDelta,
      pendingReviews,       pendingReviewsDelta,
      messagesThisWeek: msgsThisWeek, messagesDelta: messagesDelta,
    };
  }

  // --------------------------------------------------
  // Occupancy by Building
  // --------------------------------------------------

  async getOccupancyByBuilding(): Promise<BuildingOccupancy[]> {
    this.requireRole('admin', 'analyst');
    const buildings  = await this.db.buildings.toArray();
    const units      = await this.db.units.toArray();
    const rooms      = await this.db.rooms.toArray();
    const occupancies = await this.db.occupancies
      .filter(o => o.status === 'active')
      .toArray();

    const occupiedRoomIds = new Set(occupancies.map(o => o.roomId));

    return buildings.map(b => {
      const bUnits  = units.filter(u => u.buildingId === b.id);
      const bUnitIds = new Set(bUnits.map(u => u.id));
      const bRooms  = rooms.filter(r => bUnitIds.has(r.unitId));
      const total   = bRooms.length;
      const occ     = bRooms.filter(r => occupiedRoomIds.has(r.id!)).length;
      return {
        buildingId:   b.id!,
        buildingName: b.name,
        totalRooms:   total,
        occupied:     occ,
        rate:         total > 0 ? Math.round((occ / total) * 100) : 0,
      };
    });
  }

  // --------------------------------------------------
  // Enrollment Trends (last N weeks)
  // --------------------------------------------------

  async getEnrollmentTrends(weeks = 8): Promise<WeeklyEnrollment[]> {
    this.requireRole('admin', 'analyst');
    const now = new Date();
    const enrollments = await this.db.enrollments.toArray();
    const result: WeeklyEnrollment[] = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const weekEnd   = new Date(now.getTime() - i * 7 * 86_400_000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 86_400_000);
      const label     = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const enrolled  = enrollments.filter(e =>
        e.enrolledAt >= weekStart && e.enrolledAt < weekEnd && e.status === 'enrolled'
      ).length;
      const waitlisted = enrollments.filter(e =>
        e.enrolledAt >= weekStart && e.enrolledAt < weekEnd && e.status === 'waitlisted'
      ).length;
      const dropped = enrollments.filter(e =>
        e.droppedAt && e.droppedAt >= weekStart && e.droppedAt < weekEnd
      ).length;

      result.push({ weekLabel: label, enrolled, waitlisted, dropped });
    }

    return result;
  }

  // --------------------------------------------------
  // Course Enrollment Stats (for table below line chart)
  // --------------------------------------------------

  async getCourseEnrollmentStats(): Promise<CourseEnrollmentStat[]> {
    this.requireRole('admin', 'analyst');
    const courses     = await this.db.courses.toArray();
    const enrollments = await this.db.enrollments.toArray();

    return courses.map(c => {
      const ce = enrollments.filter(e => e.courseId === c.id);
      const enrolled   = ce.filter(e => e.status === 'enrolled').length;
      const waitlisted = ce.filter(e => e.status === 'waitlisted').length;
      const dropped    = ce.filter(e => e.status === 'dropped').length;
      const completed  = ce.filter(e => e.status === 'completed').length;
      const total      = ce.length;
      return {
        courseId:       c.id!,
        title:         c.title,
        enrolled,
        waitlisted,
        dropped,
        completionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }

  // --------------------------------------------------
  // Compliance Pipeline
  // --------------------------------------------------

  async getCompliancePipeline(): Promise<CompliancePipeline> {
    this.requireRole('admin', 'analyst');
    const docs = await this.db.documents.toArray();
    const visible = docs.filter(d => !d.hidden);

    const pending   = visible.filter(d => d.status === 'pending_review').length;
    const approved  = visible.filter(d => d.status === 'approved').length;
    const rejected  = visible.filter(d => d.status === 'rejected').length;
    const total     = approved + rejected;

    // Average review time in hours (for reviewed docs)
    const reviewed = visible.filter(d => d.reviewedAt);
    let avgReviewHours = 0;
    if (reviewed.length > 0) {
      const totalHours = reviewed.reduce((sum, d) => {
        const diff = (d.reviewedAt!.getTime() - d.createdAt.getTime()) / 3_600_000;
        return sum + diff;
      }, 0);
      avgReviewHours = Math.round((totalHours / reviewed.length) * 10) / 10;
    }

    // Oldest pending
    const now = new Date();
    const pendingDocs = visible.filter(d => d.status === 'pending_review');
    let oldestPendingDays = 0;
    if (pendingDocs.length > 0) {
      const oldest = pendingDocs.reduce((a, b) =>
        a.createdAt < b.createdAt ? a : b
      );
      oldestPendingDays = Math.round((now.getTime() - oldest.createdAt.getTime()) / 86_400_000);
    }

    return {
      pending, approved, rejected,
      avgReviewHours,
      oldestPendingDays,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  }

  // --------------------------------------------------
  // Messaging Activity (last N days)
  // --------------------------------------------------

  async getMessagingActivity(days = 14): Promise<DailyMessaging[]> {
    this.requireRole('admin', 'analyst');
    const now = new Date();
    const messages = await this.db.messages.toArray();
    const result: DailyMessaging[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd   = new Date(dayStart.getTime() + 86_400_000);
      const label    = dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const direct = messages.filter(m =>
        m.type === 'direct' && m.createdAt >= dayStart && m.createdAt < dayEnd
      ).length;
      const announcements = messages.filter(m =>
        m.type === 'announcement' && m.createdAt >= dayStart && m.createdAt < dayEnd
      ).length;

      result.push({ dateLabel: label, direct, announcements });
    }

    return result;
  }

  // --------------------------------------------------
  // A/B Compare
  // --------------------------------------------------

  async compareBuildingMetric(
    buildingIdA: number,
    buildingIdB: number,
    metric: string,
  ): Promise<CompareResult> {
    this.requireRole('admin', 'analyst');
    const buildings = await this.db.buildings.toArray();
    const nameA = buildings.find(b => b.id === buildingIdA)?.name ?? `Building ${buildingIdA}`;
    const nameB = buildings.find(b => b.id === buildingIdB)?.name ?? `Building ${buildingIdB}`;

    let metricA = 0;
    let metricB = 0;

    if (metric === 'occupancy') {
      const occ = await this.getOccupancyByBuilding();
      metricA = occ.find(o => o.buildingId === buildingIdA)?.rate ?? 0;
      metricB = occ.find(o => o.buildingId === buildingIdB)?.rate ?? 0;
    } else if (metric === 'residents') {
      const occupancies = await this.db.occupancies.filter(o => o.status === 'active').toArray();
      const rooms = await this.db.rooms.toArray();
      const units = await this.db.units.toArray();
      const unitIdsA = new Set(units.filter(u => u.buildingId === buildingIdA).map(u => u.id));
      const unitIdsB = new Set(units.filter(u => u.buildingId === buildingIdB).map(u => u.id));
      const roomsA = new Set(rooms.filter(r => unitIdsA.has(r.unitId)).map(r => r.id));
      const roomsB = new Set(rooms.filter(r => unitIdsB.has(r.unitId)).map(r => r.id));
      metricA = occupancies.filter(o => roomsA.has(o.roomId)).length;
      metricB = occupancies.filter(o => roomsB.has(o.roomId)).length;
    } else if (metric === 'messages') {
      // count messages per building via resident→occupancy→room→unit→building
      const occupancies = await this.db.occupancies.filter(o => o.status === 'active').toArray();
      const rooms = await this.db.rooms.toArray();
      const units = await this.db.units.toArray();
      const unitIdsA = new Set(units.filter(u => u.buildingId === buildingIdA).map(u => u.id));
      const unitIdsB = new Set(units.filter(u => u.buildingId === buildingIdB).map(u => u.id));
      const roomsA = new Set(rooms.filter(r => unitIdsA.has(r.unitId)).map(r => r.id));
      const roomsB = new Set(rooms.filter(r => unitIdsB.has(r.unitId)).map(r => r.id));
      const resA = new Set(occupancies.filter(o => roomsA.has(o.roomId)).map(o => o.residentId));
      const resB = new Set(occupancies.filter(o => roomsB.has(o.roomId)).map(o => o.residentId));
      const msgs = await this.db.messages.toArray();
      metricA = msgs.filter(m => resA.has(m.senderId)).length;
      metricB = msgs.filter(m => resB.has(m.senderId)).length;
    }

    const winner = metricA > metricB ? 'a' : metricA < metricB ? 'b' : 'tie';
    return { labelA: nameA, labelB: nameB, metricA, metricB, winner, metric };
  }

  async compareDateRangeMetric(
    fromA: Date, toA: Date,
    fromB: Date, toB: Date,
    metric: string,
  ): Promise<CompareResult> {
    this.requireRole('admin', 'analyst');
    const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const labelA = `${fmtDate(fromA)} – ${fmtDate(toA)}`;
    const labelB = `${fmtDate(fromB)} – ${fmtDate(toB)}`;

    let metricA = 0;
    let metricB = 0;

    if (metric === 'enrollments') {
      const enrollments = await this.db.enrollments.toArray();
      metricA = enrollments.filter(e => e.enrolledAt >= fromA && e.enrolledAt <= toA).length;
      metricB = enrollments.filter(e => e.enrolledAt >= fromB && e.enrolledAt <= toB).length;
    } else if (metric === 'messages') {
      const msgs = await this.db.messages.toArray();
      metricA = msgs.filter(m => m.createdAt >= fromA && m.createdAt <= toA).length;
      metricB = msgs.filter(m => m.createdAt >= fromB && m.createdAt <= toB).length;
    } else if (metric === 'reviews') {
      const docs = await this.db.documents.toArray();
      metricA = docs.filter(d => d.reviewedAt && d.reviewedAt >= fromA && d.reviewedAt <= toA).length;
      metricB = docs.filter(d => d.reviewedAt && d.reviewedAt >= fromB && d.reviewedAt <= toB).length;
    }

    const winner = metricA > metricB ? 'a' : metricA < metricB ? 'b' : 'tie';
    return { labelA, labelB, metricA, metricB, winner, metric };
  }
}
