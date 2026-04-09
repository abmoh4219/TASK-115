/**
 * Integration Tests — Audit Fix Verification
 *
 * Tests for:
 *   F-BLK-01: Resident self-profile (getMyProfile)
 *   F-BLK-02: Search index populated from real CRUD flows
 *   F-HIGH-03: Move-in requires explicit room selection
 *   Medium: Analytics route accessible by admin and analyst
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ResidentService } from '../src/app/core/services/resident.service';
import { SearchService } from '../src/app/core/services/search.service';
import { PropertyService, ReasonCode } from '../src/app/core/services/property.service';
import { EnrollmentService } from '../src/app/core/services/enrollment.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { CryptoService } from '../src/app/core/services/crypto.service';
import { AuthService } from '../src/app/core/services/auth.service';
import { AnomalyService } from '../src/app/core/services/anomaly.service';
import { LoggerService } from '../src/app/core/services/logger.service';
import { ContentPolicyService } from '../src/app/core/services/content-policy.service';
import { AdminOrAnalystGuard } from '../src/app/core/guards/multi-role.guard';

// ──────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ──────────────────────────────────────────────────────────────────────────────

async function setup(role: 'admin' | 'resident' | 'compliance' | 'analyst' = 'admin') {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [
      ResidentService, SearchService, PropertyService, EnrollmentService,
      DbService, AuditService, CryptoService, AuthService,
      AnomalyService, LoggerService, ContentPolicyService,
      AdminOrAnalystGuard,
    ],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 200));
  await TestBed.inject(AuthService).selectRole(role, 'harborpoint2024');
  return {
    residentService: TestBed.inject(ResidentService),
    searchService:   TestBed.inject(SearchService),
    propertyService: TestBed.inject(PropertyService),
    enrollmentService: TestBed.inject(EnrollmentService),
    authService:     TestBed.inject(AuthService),
    db,
  };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

// ──────────────────────────────────────────────────────────────────────────────
// F-BLK-01: Resident self-profile via getMyProfile
// ──────────────────────────────────────────────────────────────────────────────

describe('F-BLK-01 — Resident self-profile (getMyProfile)', () => {

  it('returns the resident matching the session user ID', async () => {
    // Login as resident (userId = 2, matching seed resident ID 2)
    const { residentService, db } = await setup('resident');

    const profile = await residentService.getMyProfile();

    expect(profile).toBeDefined();
    expect(profile!.id).toBe(2); // resident user maps to resident ID 2
    expect(profile!.firstName).toBe('Resident');
    expect(profile!.lastName).toBe('User');

    await teardown(db);
  });

  it('does not require admin or compliance role', async () => {
    const { residentService, db } = await setup('resident');

    // getMyProfile should NOT throw for resident role
    await expect(residentService.getMyProfile()).resolves.toBeDefined();

    await teardown(db);
  });

  it('throws when not authenticated', async () => {
    const { residentService, authService, db } = await setup('resident');
    authService.logout();

    await expect(residentService.getMyProfile())
      .rejects.toThrow('not authenticated');

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// F-BLK-02: Search index populated by real CRUD flows
// ──────────────────────────────────────────────────────────────────────────────

describe('F-BLK-02 — Search index from real CRUD', () => {

  it('seed data populates searchIndex with resident entries', async () => {
    const { db } = await setup('admin');

    const entries = await db.searchIndex
      .filter(e => e.entityType === 'resident')
      .toArray();
    expect(entries.length).toBeGreaterThan(0);

    await teardown(db);
  });

  it('seed data populates searchIndex with course entries', async () => {
    const { db } = await setup('admin');

    const entries = await db.searchIndex
      .filter(e => e.entityType === 'course')
      .toArray();
    expect(entries.length).toBeGreaterThan(0);

    await teardown(db);
  });

  it('createResident adds entry to searchIndex', async () => {
    const { residentService, db } = await setup('admin');

    const r = await residentService.createResident({
      firstName: 'SearchTest',
      lastName: 'User',
      email: 'searchtest@hp.local',
      phone: '555-9999',
      dateOfBirth: new Date('1990-01-01'),
      status: 'active',
    }, 1, 'admin');

    // Wait for async indexing
    await new Promise(resolve => setTimeout(resolve, 100));

    const entries = await db.searchIndex
      .filter(e => e.entityType === 'resident' && e.entityId === r.id!)
      .toArray();
    expect(entries.length).toBe(1);
    expect(entries[0].title).toContain('SearchTest');

    await teardown(db);
  });

  it('search finds CRUD-created residents without manual seeding', async () => {
    const { residentService, searchService, db } = await setup('admin');

    await residentService.createResident({
      firstName: 'Findable',
      lastName: 'Person',
      email: 'findable@hp.local',
      phone: '555-8888',
      dateOfBirth: new Date('1985-03-15'),
      status: 'active',
    }, 1, 'admin');

    // Wait for async indexing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Force rebuild
    await searchService.buildIndex();

    const results = await searchService.search('Findable');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.entityType).toBe('resident');

    await teardown(db);
  });

  it('rebuildAllEntities indexes existing residents', async () => {
    const { searchService, db } = await setup('admin');

    // Clear search index first
    await db.searchIndex.clear();

    await searchService.rebuildAllEntities();

    const entries = await db.searchIndex
      .filter(e => e.entityType === 'resident')
      .toArray();
    expect(entries.length).toBeGreaterThan(0);

    await teardown(db);
  });

  it('createCourse adds entry to searchIndex', async () => {
    const { enrollmentService, db } = await setup('admin');

    const course = await enrollmentService.createCourse({
      title: 'Test Course For Search',
      description: 'A course to verify search indexing',
      category: 'Testing',
      prerequisites: [],
    });

    // Wait for async indexing
    await new Promise(resolve => setTimeout(resolve, 100));

    const entries = await db.searchIndex
      .filter(e => e.entityType === 'course' && e.entityId === course.id!)
      .toArray();
    expect(entries.length).toBe(1);
    expect(entries[0].title).toBe('Test Course For Search');

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// F-HIGH-03: Move-in requires explicit room
// ──────────────────────────────────────────────────────────────────────────────

describe('F-HIGH-03 — Move-in requires explicit room selection', () => {

  it('moveIn succeeds with an explicit room', async () => {
    const { residentService, propertyService, db } = await setup('admin');

    const r = await residentService.createResident({
      firstName: 'MoveIn', lastName: 'Test',
      email: 'movein@hp.local', phone: '555-0000',
      dateOfBirth: new Date('1990-01-01'), status: 'active',
    }, 1, 'admin');

    const rooms = await db.rooms.toArray();
    expect(rooms.length).toBeGreaterThan(0);

    await expect(propertyService.moveIn({
      residentId: r.id!,
      roomId: rooms[0].id!,
      effectiveFrom: new Date(),
      reasonCode: ReasonCode.MOVE_IN_NEW,
      actorId: 1,
      actorRole: 'admin',
    })).resolves.toBeDefined();

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Medium: Analytics route access for admin + analyst
// ──────────────────────────────────────────────────────────────────────────────

describe('Medium — Analytics route guard allows admin and analyst', () => {

  it('AdminOrAnalystGuard allows admin role', async () => {
    const { db } = await setup('admin');
    const guard = TestBed.inject(AdminOrAnalystGuard);

    expect(guard.canActivate()).toBe(true);

    await teardown(db);
  });

  it('AdminOrAnalystGuard allows analyst role', async () => {
    const { db } = await setup('analyst');
    const guard = TestBed.inject(AdminOrAnalystGuard);

    expect(guard.canActivate()).toBe(true);

    await teardown(db);
  });

  it('AdminOrAnalystGuard blocks resident role', async () => {
    const { db } = await setup('resident');
    const guard = TestBed.inject(AdminOrAnalystGuard);

    expect(guard.canActivate()).toBe(false);

    await teardown(db);
  });

  it('AdminOrAnalystGuard blocks compliance role', async () => {
    const { db } = await setup('compliance');
    const guard = TestBed.inject(AdminOrAnalystGuard);

    expect(guard.canActivate()).toBe(false);

    await teardown(db);
  });
});
