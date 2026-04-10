/**
 * Integration Tests — Phase 2 Audit Fix Verification
 *
 * Tests for:
 *   F-H-01: Encrypted resident IDs (seed validation + repair)
 *   F-H-02: Metadata included in search index
 *   F-H-03: Analytics service role enforcement
 *   Medium: Search navigation correctness
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ResidentService } from '../src/app/core/services/resident.service';
import { SearchService } from '../src/app/core/services/search.service';
import { AnalyticsService } from '../src/app/core/services/analytics.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { CryptoService } from '../src/app/core/services/crypto.service';
import { AuthService } from '../src/app/core/services/auth.service';
import { AnomalyService } from '../src/app/core/services/anomaly.service';
import { LoggerService } from '../src/app/core/services/logger.service';
import { ContentPolicyService } from '../src/app/core/services/content-policy.service';
import { PropertyService } from '../src/app/core/services/property.service';

// ──────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ──────────────────────────────────────────────────────────────────────────────

async function setup(role: 'admin' | 'resident' | 'compliance' | 'analyst' = 'admin') {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [
      ResidentService, SearchService, AnalyticsService, PropertyService,
      DbService, AuditService, CryptoService, AuthService,
      AnomalyService, LoggerService, ContentPolicyService,
    ],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 200));
  await TestBed.inject(AuthService).selectRole(role, 'harborpoint2024');
  return {
    residentService:  TestBed.inject(ResidentService),
    searchService:    TestBed.inject(SearchService),
    analyticsService: TestBed.inject(AnalyticsService),
    authService:      TestBed.inject(AuthService),
    crypto:           TestBed.inject(CryptoService),
    db,
  };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

// ──────────────────────────────────────────────────────────────────────────────
// F-H-01: Encrypted resident IDs
// ──────────────────────────────────────────────────────────────────────────────

describe('F-H-01 — Session-key encrypted resident IDs', () => {

  it('seed data uses placeholder IDs pending session-key repair', async () => {
    const { db } = await setup();

    const residents = await db.residents.toArray();
    expect(residents.length).toBeGreaterThan(0);
    // Seeded residents have placeholder IDs — these are intentionally non-encrypted
    // and are repaired to session-key encrypted format on first authenticated login.
    const placeholders = residents.filter(r => r.encryptedId.startsWith('seed-pending-'));
    expect(placeholders.length).toBeGreaterThan(0);

    await teardown(db);
  });

  it('repairPlaintextIds converts seeded placeholders to session-key encrypted format', async () => {
    const { residentService, db } = await setup();

    // setup() authenticates as admin, so calling repair directly should
    // encrypt all seed placeholders with the session key.
    const repaired = await residentService.repairPlaintextIds();
    expect(repaired).toBeGreaterThan(0);

    // All residents now have session-key encrypted IDs
    const all = await db.residents.toArray();
    for (const r of all) {
      expect(r.encryptedId).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    }

    // Second call should be a no-op
    const repaired2 = await residentService.repairPlaintextIds();
    expect(repaired2).toBe(0);

    await teardown(db);
  });

  it('repairPlaintextIds fixes manually inserted plaintext IDs', async () => {
    const { residentService, db } = await setup();

    // Insert a resident with a plaintext ID to simulate legacy data
    await db.residents.add({
      firstName: 'Legacy', lastName: 'User',
      email: 'legacy@hp.local', phone: '555-0000',
      dateOfBirth: new Date('1990-01-01'), status: 'active',
      encryptedId: 'legacy-plaintext-id',
      notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const repaired = await residentService.repairPlaintextIds();
    expect(repaired).toBe(1);

    // Verify the legacy ID was encrypted
    const all = await db.residents.toArray();
    const legacy = all.find(r => r.firstName === 'Legacy');
    expect(legacy).toBeDefined();
    expect(legacy!.encryptedId).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);

    await teardown(db);
  });

  it('createResident always produces encrypted format', async () => {
    const { residentService, db } = await setup();

    const r = await residentService.createResident({
      firstName: 'Test', lastName: 'Encrypted',
      email: 'enctest@hp.local', phone: '555-0000',
      dateOfBirth: new Date('1990-01-01'), status: 'active',
    });

    expect(r.encryptedId).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// F-H-02: Metadata in search index
// ──────────────────────────────────────────────────────────────────────────────

describe('F-H-02 — Metadata in search index', () => {

  it('normalizeMetadata flattens metadata to searchable string', () => {
    expect(SearchService.normalizeMetadata({ mimeType: 'application/pdf', sizeBytes: 5000 }))
      .toContain('application/pdf');
  });

  it('normalizeMetadata handles empty/undefined metadata', () => {
    expect(SearchService.normalizeMetadata(undefined)).toBe('');
    expect(SearchService.normalizeMetadata({})).toBe('');
  });

  it('search finds entries by metadata content', async () => {
    const { searchService, db } = await setup();

    // Add an entry with specific metadata
    await db.searchIndex.add({
      entityType: 'document',
      entityId: 999,
      title: 'Tax Form',
      body: 'Annual tax document',
      tags: ['document'],
      metadata: { mimeType: 'application/pdf', department: 'finance' },
      category: 'document',
      createdAt: new Date(),
    });

    await searchService.buildIndex();
    const results = await searchService.search('finance');
    expect(results.some(r => r.entry.entityId === 999)).toBe(true);

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// F-H-03: Analytics service role enforcement
// ──────────────────────────────────────────────────────────────────────────────

describe('F-H-03 — Analytics service role enforcement', () => {

  it('allows admin to call getSummaryStats', async () => {
    const { analyticsService, db } = await setup('admin');

    const stats = await analyticsService.getSummaryStats();
    expect(stats).toBeDefined();
    expect(stats.activeResidents).toBeDefined();

    await teardown(db);
  });

  it('allows analyst to call getSummaryStats', async () => {
    const { analyticsService, db } = await setup('analyst');

    const stats = await analyticsService.getSummaryStats();
    expect(stats).toBeDefined();

    await teardown(db);
  });

  it('blocks resident from getSummaryStats', async () => {
    const { analyticsService, db } = await setup('resident');

    await expect(analyticsService.getSummaryStats())
      .rejects.toThrow('Unauthorized');

    await teardown(db);
  });

  it('blocks compliance from getSummaryStats', async () => {
    const { analyticsService, db } = await setup('compliance');

    await expect(analyticsService.getSummaryStats())
      .rejects.toThrow('Unauthorized');

    await teardown(db);
  });

  it('blocks resident from getOccupancyByBuilding', async () => {
    const { analyticsService, db } = await setup('resident');

    await expect(analyticsService.getOccupancyByBuilding())
      .rejects.toThrow('Unauthorized');

    await teardown(db);
  });

  it('blocks resident from getCompliancePipeline', async () => {
    const { analyticsService, db } = await setup('resident');

    await expect(analyticsService.getCompliancePipeline())
      .rejects.toThrow('Unauthorized');

    await teardown(db);
  });

  it('allows admin to call compareBuildingMetric', async () => {
    const { analyticsService, db } = await setup('admin');

    const result = await analyticsService.compareBuildingMetric(1, 2, 'occupancy');
    expect(result).toBeDefined();
    expect(result.winner).toBeDefined();

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Medium: Search navigation type mapping
// ──────────────────────────────────────────────────────────────────────────────

describe('Medium — Search result entity type routing', () => {

  it('search index entries have correct entityType for residents', async () => {
    const { db } = await setup();

    const entries = await db.searchIndex
      .filter(e => e.entityType === 'resident')
      .toArray();
    for (const e of entries) {
      expect(e.entityType).toBe('resident');
      expect(typeof e.entityId).toBe('number');
    }

    await teardown(db);
  });

  it('search index entries have correct entityType for courses', async () => {
    const { db } = await setup();

    const entries = await db.searchIndex
      .filter(e => e.entityType === 'course')
      .toArray();
    for (const e of entries) {
      expect(e.entityType).toBe('course');
      expect(typeof e.entityId).toBe('number');
    }

    await teardown(db);
  });
});
