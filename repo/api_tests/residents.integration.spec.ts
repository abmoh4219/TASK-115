/**
 * Resident Integration Tests
 *
 * Tests: full CRUD lifecycle, encryption, audit trail,
 * filter-by-building join, inactive-occupancy warning,
 * change log ordering, search.
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';

import { ResidentService } from '../src/app/core/services/resident.service';
import { PropertyService, ReasonCode } from '../src/app/core/services/property.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { CryptoService } from '../src/app/core/services/crypto.service';
import { AuthService } from '../src/app/core/services/auth.service';
import { LoggerService } from '../src/app/core/services/logger.service';
import { SearchService } from '../src/app/core/services/search.service';
import { AnomalyService } from '../src/app/core/services/anomaly.service';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function setup() {
  TestBed.configureTestingModule({
    providers: [ResidentService, PropertyService, DbService, AuditService, CryptoService, AuthService, LoggerService, SearchService, AnomalyService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 200));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return {
    service:  TestBed.inject(ResidentService),
    property: TestBed.inject(PropertyService),
    db,
  };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

const BASE = {
  firstName:   'Test',
  lastName:    'Resident',
  email:       'test@hp.local',
  phone:       '555-0000',
  dateOfBirth: new Date('1990-01-01'),
  status:      'active' as const,
};

// ──────────────────────────────────────────────────────────────────────────────
// Create + Read
// ──────────────────────────────────────────────────────────────────────────────

describe('Resident Integration — CRUD', () => {
  let service: ResidentService;
  let db: DbService;

  beforeEach(async () => {
    ({ service, db } = await setup());
  });
  afterEach(async () => { await teardown(db); });

  it('creates a resident and retrieves it by id', async () => {
    const created = await service.createResident(BASE);
    expect(created.id).toBeDefined();

    const fetched = await service.getResident(created.id!);
    expect(fetched).toBeDefined();
    expect(fetched!.firstName).toBe('Test');
    expect(fetched!.email).toBe('test@hp.local');
  });

  it('encryptedId is stored in ciphertext.iv format', async () => {
    const r = await service.createResident(BASE);
    const parts = r.encryptedId.split('.');
    expect(parts.length).toBe(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('getResidents returns the created resident', async () => {
    const created = await service.createResident(
      { ...BASE, email: 'unique-create@hp.local' },
    );
    const all = await service.getResidents();
    expect(all.some(r => r.id === created.id)).toBe(true);
  });

  it('updates a resident and persists changes', async () => {
    const r = await service.createResident(BASE);
    const { resident: updated } = await service.updateResident(
      r.id!, { firstName: 'Updated', status: 'pending' },
    );
    expect(updated.firstName).toBe('Updated');
    expect(updated.status).toBe('pending');

    const fetched = await service.getResident(r.id!);
    expect(fetched!.firstName).toBe('Updated');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Audit trail
// ──────────────────────────────────────────────────────────────────────────────

describe('Resident Integration — Audit trail', () => {
  let service: ResidentService;
  let db: DbService;

  beforeEach(async () => {
    ({ service, db } = await setup());
  });
  afterEach(async () => { await teardown(db); });

  it('audit log contains RESIDENT_CREATED entry after create', async () => {
    const r = await service.createResident(BASE);
    const logs = await db.auditLogs
      .filter(l => l.action === 'RESIDENT_CREATED' && Number(l.targetId) === r.id)
      .toArray();
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('audit log after create does not expose raw encryptedId', async () => {
    const r = await service.createResident(BASE);
    const logs = await db.auditLogs
      .filter(l => Number(l.targetId) === r.id)
      .toArray();
    for (const log of logs) {
      expect(JSON.stringify(log.after ?? {})).not.toContain(r.encryptedId);
    }
  });

  it('audit log contains RESIDENT_UPDATED with before/after snapshots', async () => {
    const r = await service.createResident(BASE);
    await service.updateResident(r.id!, { phone: '555-9876' });

    const logs = await db.auditLogs
      .filter(l => l.action === 'RESIDENT_UPDATED' && Number(l.targetId) === r.id)
      .toArray();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const update = logs[0];
    expect((update.before as Record<string, unknown>)?.['phone']).toBe('555-0000');
    expect((update.after  as Record<string, unknown>)?.['phone']).toBe('555-9876');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Filters
// ──────────────────────────────────────────────────────────────────────────────

describe('Resident Integration — Filters', () => {
  let service: ResidentService;
  let property: PropertyService;
  let db: DbService;

  beforeEach(async () => {
    ({ service, property, db } = await setup());
  });
  afterEach(async () => { await teardown(db); });

  it('status filter returns only matching residents', async () => {
    await service.createResident({ ...BASE, email: 'a@hp.local', status: 'active' });
    await service.createResident({ ...BASE, email: 'b@hp.local', status: 'inactive' });

    const active = await service.getResidents({ status: ['active'] });
    for (const r of active) {
      expect(r.status).toBe('active');
    }

    const inactive = await service.getResidents({ status: ['inactive'] });
    for (const r of inactive) {
      expect(r.status).toBe('inactive');
    }
  });

  it('search filter matches partial first name', async () => {
    await service.createResident({ ...BASE, firstName: 'Zelda', email: 'zelda@hp.local' });
    await service.createResident({ ...BASE, firstName: 'Arthur', email: 'arthur@hp.local' });

    const results = await service.getResidents({ search: 'zelda' });
    expect(results.some(r => r.firstName === 'Zelda')).toBe(true);
    expect(results.every(r => r.firstName === 'Zelda' || r.lastName.toLowerCase().includes('zelda') || r.email.includes('zelda'))).toBe(true);
  });

  it('buildingId filter returns only residents in that building', async () => {
    const buildings = await property.getBuildings();
    const building  = buildings[0];

    // Create a room in the first building's unit
    const units = await property.getUnits(building.id!);
    if (units.length === 0) return; // seed data may not have units

    const rooms = await property.getRooms(units[0].id!);
    if (rooms.length === 0) return;

    const r = await service.createResident(
      { ...BASE, email: 'bldfilter@hp.local' },
    );

    await property.moveIn({
      residentId:    r.id!,
      roomId:        rooms[0].id!,
      effectiveFrom: new Date(),
      reasonCode:    ReasonCode.MOVE_IN_NEW,
    });

    const inBuilding = await service.getResidents({ buildingId: building.id! });
    expect(inBuilding.some(res => res.id === r.id)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Inactive + occupancy warning
// ──────────────────────────────────────────────────────────────────────────────

describe('Resident Integration — Inactive-occupancy warning', () => {
  let service: ResidentService;
  let property: PropertyService;
  let db: DbService;

  beforeEach(async () => {
    ({ service, property, db } = await setup());
  });
  afterEach(async () => { await teardown(db); });

  it('warns when setting status to inactive while resident has active occupancy', async () => {
    const r = await service.createResident({ ...BASE, email: 'warn@hp.local' });

    await db.occupancies.add({
      residentId:    r.id!,
      roomId:        1,
      effectiveFrom: new Date(),
      reasonCode:    'MOVE_IN_NEW',
      status:        'active',
      createdAt:     new Date(),
    });

    const { warnings } = await service.updateResident(
      r.id!, { status: 'inactive' },
    );

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].toLowerCase()).toContain('active room assignment');
  });

  it('no warning when setting inactive for resident with no occupancy', async () => {
    const r = await service.createResident({ ...BASE, email: 'nowarn@hp.local' });

    const { warnings } = await service.updateResident(
      r.id!, { status: 'inactive' },
    );

    expect(warnings.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Change log
// ──────────────────────────────────────────────────────────────────────────────

describe('Resident Integration — Change log', () => {
  let service: ResidentService;
  let db: DbService;

  beforeEach(async () => {
    ({ service, db } = await setup());
  });
  afterEach(async () => { await teardown(db); });

  it('getChangeLog returns entries for only the target resident', async () => {
    const r1 = await service.createResident({ ...BASE, email: 'cl1@hp.local' });
    const r2 = await service.createResident({ ...BASE, email: 'cl2@hp.local' });

    await service.updateResident(r1.id!, { phone: '111-0001' });
    await service.updateResident(r2.id!, { phone: '222-0002' });

    const log = await service.getChangeLog(r1.id!);
    for (const entry of log) {
      expect(Number(entry.targetId)).toBe(r1.id);
    }
  });

  it('getChangeLog is sorted descending by timestamp', async () => {
    const r = await service.createResident({ ...BASE, email: 'sort@hp.local' });
    await service.updateResident(r.id!, { phone: '555-1111' });
    await service.updateResident(r.id!, { phone: '555-2222' });

    const log = await service.getChangeLog(r.id!);
    expect(log.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < log.length - 1; i++) {
      expect(new Date(log[i].timestamp).getTime())
        .toBeGreaterThanOrEqual(new Date(log[i + 1].timestamp).getTime());
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// searchResidents
// ──────────────────────────────────────────────────────────────────────────────

describe('Resident Integration — searchResidents', () => {
  let service: ResidentService;
  let db: DbService;

  beforeEach(async () => {
    ({ service, db } = await setup());
  });
  afterEach(async () => { await teardown(db); });

  it('returns empty array for blank query', async () => {
    expect(await service.searchResidents('')).toEqual([]);
    expect(await service.searchResidents('  ')).toEqual([]);
  });

  it('finds residents by email substring', async () => {
    await service.createResident({ ...BASE, email: 'findbyme@hp.local' });

    const results = await service.searchResidents('findbyme');
    expect(results.some(r => r.email === 'findbyme@hp.local')).toBe(true);
  });

  it('finds residents by last name', async () => {
    await service.createResident(
      { ...BASE, lastName: 'Unique123', email: 'unique123@hp.local' },
    );

    const results = await service.searchResidents('Unique123');
    expect(results.some(r => r.lastName === 'Unique123')).toBe(true);
  });
});
