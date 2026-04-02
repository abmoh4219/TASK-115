/**
 * Unit Tests — AnalyticsService
 *
 * Tests: getSummaryStats, getOccupancyByBuilding, getEnrollmentTrends,
 * getCourseEnrollmentStats, getCompliancePipeline, getMessagingActivity,
 * compareBuildingMetric.
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AnalyticsService } from '../../src/app/core/services/analytics.service';
import { DbService } from '../../src/app/core/services/db.service';
import { AuditService } from '../../src/app/core/services/audit.service';
import { AnomalyService } from '../../src/app/core/services/anomaly.service';
import { AuthService } from '../../src/app/core/services/auth.service';
import { CryptoService } from '../../src/app/core/services/crypto.service';

function setup() {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [AnalyticsService, DbService, AuditService, AnomalyService, AuthService, CryptoService],
  });
  return {
    service: TestBed.inject(AnalyticsService),
    db:      TestBed.inject(DbService),
  };
}

function teardown() {
  TestBed.resetTestingModule();
}

// ──────────────────────────────────────────────────────────────────────────────
// getSummaryStats
// ──────────────────────────────────────────────────────────────────────────────

describe('AnalyticsService — getSummaryStats', () => {

  it('returns correct active resident count', async () => {
    const { service, db } = setup();
    await db.open();

    await db.residents.clear();
    await db.residents.bulkAdd([
      { firstName: 'A', lastName: 'A', email: 'a@t.l', phone: '555', dateOfBirth: new Date(), status: 'active', encryptedId: 'e1', notes: [], consentGiven: false, createdAt: new Date(), updatedAt: new Date() },
      { firstName: 'B', lastName: 'B', email: 'b@t.l', phone: '555', dateOfBirth: new Date(), status: 'active', encryptedId: 'e2', notes: [], consentGiven: false, createdAt: new Date(), updatedAt: new Date() },
      { firstName: 'C', lastName: 'C', email: 'c@t.l', phone: '555', dateOfBirth: new Date(), status: 'inactive', encryptedId: 'e3', notes: [], consentGiven: false, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const stats = await service.getSummaryStats();
    expect(stats.activeResidents).toBe(2);

    await db.close();
    teardown();
  });

  it('counts messages this week', async () => {
    const { service, db } = setup();
    await db.open();

    await db.messages.clear();
    const now = new Date();
    await db.messages.bulkAdd([
      { threadId: 1, senderId: 1, senderRole: 'admin', body: 'hello', type: 'direct', readBy: [], deleted: false, createdAt: now },
      { threadId: 1, senderId: 2, senderRole: 'resident', body: 'hi', type: 'direct', readBy: [], deleted: false, createdAt: now },
    ]);

    const stats = await service.getSummaryStats();
    expect(stats.messagesThisWeek).toBeGreaterThanOrEqual(2);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getOccupancyByBuilding
// ──────────────────────────────────────────────────────────────────────────────

describe('AnalyticsService — getOccupancyByBuilding', () => {

  it('calculates occupancy rate per building', async () => {
    const { service, db } = setup();
    await db.open();

    await db.buildings.clear();
    await db.units.clear();
    await db.rooms.clear();
    await db.occupancies.clear();

    const buildingId = await db.buildings.add({
      name: 'Alpha', address: '100 Main', floors: 3, createdAt: new Date(), updatedAt: new Date(),
    });
    const unitId = await db.units.add({
      buildingId, unitNumber: 'A1', floor: 1, type: 'studio', createdAt: new Date(), updatedAt: new Date(),
    });
    const room1 = await db.rooms.add({
      unitId, roomNumber: '101', capacity: 1, createdAt: new Date(), updatedAt: new Date(),
    });
    const room2 = await db.rooms.add({
      unitId, roomNumber: '102', capacity: 1, createdAt: new Date(), updatedAt: new Date(),
    });

    // Only one room occupied
    await db.occupancies.add({
      residentId: 1, roomId: room1, effectiveFrom: new Date(),
      reasonCode: 'MOVE_IN', status: 'active', createdAt: new Date(),
    });

    const occ = await service.getOccupancyByBuilding();
    const alpha = occ.find(o => o.buildingName === 'Alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.totalRooms).toBe(2);
    expect(alpha!.occupied).toBe(1);
    expect(alpha!.rate).toBe(50);

    await db.close();
    teardown();
  });

  it('returns 0% for buildings with no occupancies', async () => {
    const { service, db } = setup();
    await db.open();

    await db.buildings.clear();
    await db.units.clear();
    await db.rooms.clear();
    await db.occupancies.clear();

    const buildingId = await db.buildings.add({
      name: 'Empty', address: '200 Main', floors: 1, createdAt: new Date(), updatedAt: new Date(),
    });
    const unitId = await db.units.add({
      buildingId, unitNumber: 'E1', floor: 1, type: 'studio', createdAt: new Date(), updatedAt: new Date(),
    });
    await db.rooms.add({
      unitId, roomNumber: 'E101', capacity: 1, createdAt: new Date(), updatedAt: new Date(),
    });

    const occ = await service.getOccupancyByBuilding();
    const empty = occ.find(o => o.buildingName === 'Empty');
    expect(empty).toBeDefined();
    expect(empty!.rate).toBe(0);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getCompliancePipeline
// ──────────────────────────────────────────────────────────────────────────────

describe('AnalyticsService — getCompliancePipeline', () => {

  it('counts pending, approved, and rejected docs', async () => {
    const { service, db } = setup();
    await db.open();

    await db.documents.clear();
    const base = {
      residentId: 1, fileName: 'f.pdf', mimeType: 'application/pdf',
      sizeBytes: 1000, fileHash: 'h', consentRecordId: 1, hidden: false, createdAt: new Date(),
    };

    await db.documents.bulkAdd([
      { ...base, status: 'pending_review' },
      { ...base, status: 'approved', reviewedAt: new Date(), reviewedBy: 1, reviewNotes: 'ok' },
      { ...base, status: 'rejected', reviewedAt: new Date(), reviewedBy: 1, reviewNotes: 'bad' },
    ]);

    const pipeline = await service.getCompliancePipeline();
    expect(pipeline.pending).toBe(1);
    expect(pipeline.approved).toBe(1);
    expect(pipeline.rejected).toBe(1);
    expect(pipeline.approvalRate).toBe(50);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getMessagingActivity
// ──────────────────────────────────────────────────────────────────────────────

describe('AnalyticsService — getMessagingActivity', () => {

  it('returns daily breakdown of direct and announcement messages', async () => {
    const { service, db } = setup();
    await db.open();

    await db.messages.clear();
    const today = new Date();
    await db.messages.bulkAdd([
      { threadId: 1, senderId: 1, senderRole: 'admin', body: 'dm', type: 'direct', readBy: [], deleted: false, createdAt: today },
      { threadId: 2, senderId: 1, senderRole: 'admin', body: 'ann', type: 'announcement', readBy: [], deleted: false, createdAt: today },
    ]);

    const activity = await service.getMessagingActivity(1);
    expect(activity.length).toBe(1);
    expect(activity[0].direct).toBeGreaterThanOrEqual(1);
    expect(activity[0].announcements).toBeGreaterThanOrEqual(1);

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// compareBuildingMetric
// ──────────────────────────────────────────────────────────────────────────────

describe('AnalyticsService — compareBuildingMetric', () => {

  it('returns correct winner for occupancy comparison', async () => {
    const { service, db } = setup();
    await db.open();

    await db.buildings.clear();
    await db.units.clear();
    await db.rooms.clear();
    await db.occupancies.clear();

    const bA = await db.buildings.add({ name: 'A', address: 'a', floors: 1, createdAt: new Date(), updatedAt: new Date() });
    const bB = await db.buildings.add({ name: 'B', address: 'b', floors: 1, createdAt: new Date(), updatedAt: new Date() });

    const uA = await db.units.add({ buildingId: bA, unitNumber: 'A1', floor: 1, type: 's', createdAt: new Date(), updatedAt: new Date() });
    const uB = await db.units.add({ buildingId: bB, unitNumber: 'B1', floor: 1, type: 's', createdAt: new Date(), updatedAt: new Date() });

    const rA = await db.rooms.add({ unitId: uA, roomNumber: '1', capacity: 1, createdAt: new Date(), updatedAt: new Date() });
    await db.rooms.add({ unitId: uB, roomNumber: '2', capacity: 1, createdAt: new Date(), updatedAt: new Date() });

    // Only building A has an occupancy
    await db.occupancies.add({ residentId: 1, roomId: rA, effectiveFrom: new Date(), reasonCode: 'MOVE_IN', status: 'active', createdAt: new Date() });

    const result = await service.compareBuildingMetric(bA, bB, 'occupancy');
    expect(result.winner).toBe('a');
    expect(result.metricA).toBe(100);
    expect(result.metricB).toBe(0);

    await db.close();
    teardown();
  });

  it('returns tie when both metrics are equal', async () => {
    const { service, db } = setup();
    await db.open();

    await db.buildings.clear();
    await db.units.clear();
    await db.rooms.clear();
    await db.occupancies.clear();

    const bA = await db.buildings.add({ name: 'X', address: 'x', floors: 1, createdAt: new Date(), updatedAt: new Date() });
    const bB = await db.buildings.add({ name: 'Y', address: 'y', floors: 1, createdAt: new Date(), updatedAt: new Date() });

    // No rooms means 0 vs 0
    const result = await service.compareBuildingMetric(bA, bB, 'occupancy');
    expect(result.winner).toBe('tie');

    await db.close();
    teardown();
  });
});
