/**
 * Extra coverage for AnalyticsService — enrollment trends, course stats, compliance pipeline,
 * compareDateRangeMetric
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from '../../../src/app/core/services/analytics.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';

async function setup() {
  TestBed.configureTestingModule({
    providers: [AnalyticsService, DbService, AuthService, LoggerService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return { service: TestBed.inject(AnalyticsService), db };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('AnalyticsService — getEnrollmentTrends', () => {
  it('returns an array of weekly enrollment data', async () => {
    const { service, db } = await setup();
    const trends = await service.getEnrollmentTrends();
    expect(Array.isArray(trends)).toBe(true);
    if (trends.length > 0) {
      expect(trends[0]).toHaveProperty('weekLabel');
      expect(trends[0]).toHaveProperty('enrolled');
    }
    await teardown(db);
  });

  it('accepts a custom weeks parameter', async () => {
    const { service, db } = await setup();
    const trends = await service.getEnrollmentTrends(4);
    expect(Array.isArray(trends)).toBe(true);
    await teardown(db);
  });
});

describe('AnalyticsService — getCourseEnrollmentStats', () => {
  it('returns an array of course enrollment stats', async () => {
    const { service, db } = await setup();
    const stats = await service.getCourseEnrollmentStats();
    expect(Array.isArray(stats)).toBe(true);
    await teardown(db);
  });
});

describe('AnalyticsService — getCompliancePipeline', () => {
  it('returns compliance pipeline with required fields', async () => {
    const { service, db } = await setup();
    const pipeline = await service.getCompliancePipeline();
    expect(pipeline).toHaveProperty('pending');
    expect(pipeline).toHaveProperty('approved');
    expect(pipeline).toHaveProperty('rejected');
    await teardown(db);
  });
});

describe('AnalyticsService — compareDateRangeMetric', () => {
  it('returns comparison for enrollments metric', async () => {
    const { service, db } = await setup();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
    const result = await service.compareDateRangeMetric(twoWeeksAgo, weekAgo, weekAgo, now, 'enrollments');
    expect(typeof result.metricA).toBe('number');
    await teardown(db);
  });

  it('returns comparison for messages metric', async () => {
    const { service, db } = await setup();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
    const result = await service.compareDateRangeMetric(twoWeeksAgo, weekAgo, weekAgo, now, 'messages');
    expect(typeof result.metricA).toBe('number');
    await teardown(db);
  });

  it('returns comparison for reviews metric', async () => {
    const { service, db } = await setup();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
    const result = await service.compareDateRangeMetric(twoWeeksAgo, weekAgo, weekAgo, now, 'reviews');
    expect(typeof result.metricA).toBe('number');
    await teardown(db);
  });
});

describe('AnalyticsService — getSummaryStats', () => {
  it('returns summary stats with numeric values', async () => {
    const { service, db } = await setup();
    const stats = await service.getSummaryStats();
    expect(typeof stats.activeResidents).toBe('number');
    expect(typeof stats.pendingReviews).toBe('number');
    await teardown(db);
  });
});

describe('AnalyticsService — getOccupancyByBuilding', () => {
  it('returns array of building occupancy data', async () => {
    const { service, db } = await setup();
    const data = await service.getOccupancyByBuilding();
    expect(Array.isArray(data)).toBe(true);
    await teardown(db);
  });
});

describe('AnalyticsService — compareBuildingMetric', () => {
  it('returns comparison for occupancy metric', async () => {
    const { service, db } = await setup();
    const buildings = await db.buildings.toArray();
    const idA = buildings[0]?.id ?? 1;
    const idB = buildings[1]?.id ?? idA;
    const result = await service.compareBuildingMetric(idA, idB, 'occupancy');
    expect(result).toBeDefined();
    await teardown(db);
  });

  it('returns comparison for residents metric', async () => {
    const { service, db } = await setup();
    const buildings = await db.buildings.toArray();
    const idA = buildings[0]?.id ?? 1;
    const result = await service.compareBuildingMetric(idA, idA, 'residents');
    expect(typeof result.metricA).toBe('number');
    await teardown(db);
  });

  it('returns comparison for messages metric', async () => {
    const { service, db } = await setup();
    const buildings = await db.buildings.toArray();
    const idA = buildings[0]?.id ?? 1;
    const result = await service.compareBuildingMetric(idA, idA, 'messages');
    expect(typeof result.metricA).toBe('number');
    await teardown(db);
  });
});
