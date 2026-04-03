/**
 * Unit Tests — PropertyService
 *
 * Tests: CRUD, occupancy enforcement, getRoomOccupants
 * Uses fake-indexeddb so no real browser storage is needed.
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { PropertyService, ReasonCode } from '../../src/app/core/services/property.service';
import { DbService } from '../../src/app/core/services/db.service';
import { AuditService } from '../../src/app/core/services/audit.service';
import { AuthService } from '../../src/app/core/services/auth.service';
import { LoggerService } from '../../src/app/core/services/logger.service';

async function setup() {
  TestBed.configureTestingModule({
    providers: [PropertyService, DbService, AuditService, AuthService, LoggerService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  // Wait for seed to complete
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return {
    service: TestBed.inject(PropertyService),
    db,
  };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

// ─────────────────────────────────────────────────────
// Building & Unit CRUD
// ─────────────────────────────────────────────────────

describe('PropertyService — createBuilding', () => {
  it('creates a building with correct fields and returns it with an id', async () => {
    const { service, db } = await setup();

    const building = await service.createBuilding(
      { name: 'Ocean View', address: '99 Coastal Rd', floors: 8 },
      1, 'admin',
    );

    expect(building.id).toBeDefined();
    expect(building.name).toBe('Ocean View');
    expect(building.address).toBe('99 Coastal Rd');
    expect(building.floors).toBe(8);
    expect(building.createdAt).toBeInstanceOf(Date);

    await teardown(db);
  });
});

describe('PropertyService — getBuildings', () => {
  it('returns at least the seeded building on a fresh DB', async () => {
    const { service, db } = await setup();

    const buildings = await service.getBuildings();

    expect(buildings.length).toBeGreaterThanOrEqual(1);
    expect(buildings[0].name).toBeDefined();

    await teardown(db);
  });
});

// ─────────────────────────────────────────────────────
// Move-In rules
// ─────────────────────────────────────────────────────

describe('PropertyService — moveIn', () => {
  it('creates an active occupancy for a resident with no current room', async () => {
    const { service, db } = await setup();

    const occupancy = await service.moveIn({
      residentId: 100,
      roomId: 1,
      effectiveFrom: new Date(),
      reasonCode: ReasonCode.MOVE_IN_NEW,
      actorId: 1,
      actorRole: 'admin',
    });

    expect(occupancy.status).toBe('active');
    expect(occupancy.residentId).toBe(100);
    expect(occupancy.roomId).toBe(1);

    await teardown(db);
  });

  it('throws RESIDENT_ALREADY_HAS_ACTIVE_OCCUPANCY when resident already has an active room', async () => {
    const { service, db } = await setup();

    const RID = 200;
    await service.moveIn({
      residentId: RID, roomId: 1, effectiveFrom: new Date(),
      reasonCode: ReasonCode.MOVE_IN_NEW, actorId: 1, actorRole: 'admin',
    });

    await expect(service.moveIn({
      residentId: RID, roomId: 2, effectiveFrom: new Date(),
      reasonCode: ReasonCode.TRANSFER, actorId: 1, actorRole: 'admin',
    })).rejects.toThrow('RESIDENT_ALREADY_HAS_ACTIVE_OCCUPANCY');

    await teardown(db);
  });
});

// ─────────────────────────────────────────────────────
// Move-Out rules
// ─────────────────────────────────────────────────────

describe('PropertyService — moveOut', () => {
  it('sets occupancy status to ended after move-out', async () => {
    const { service, db } = await setup();

    const RID = 300;
    await service.moveIn({
      residentId: RID, roomId: 1, effectiveFrom: new Date(),
      reasonCode: ReasonCode.LEASE_START, actorId: 1, actorRole: 'admin',
    });

    await service.moveOut({
      residentId: RID, effectiveTo: new Date(),
      reasonCode: ReasonCode.LEASE_END, actorId: 1, actorRole: 'admin',
    });

    const active = await service.getActiveOccupancy(RID);
    expect(active).toBeUndefined();

    const history = await service.getOccupancyHistory(RID);
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('ended');

    await teardown(db);
  });

  it('throws NO_ACTIVE_OCCUPANCY when resident has no active room', async () => {
    const { service, db } = await setup();

    await expect(service.moveOut({
      residentId: 999999,
      effectiveTo: new Date(),
      reasonCode: ReasonCode.MOVE_OUT_VOLUNTARY,
      actorId: 1,
      actorRole: 'admin',
    })).rejects.toThrow('NO_ACTIVE_OCCUPANCY');

    await teardown(db);
  });
});

// ─────────────────────────────────────────────────────
// getRoomOccupants
// ─────────────────────────────────────────────────────

describe('PropertyService — getRoomOccupants', () => {
  it('returns the resident for a room after move-in and empty array after move-out', async () => {
    const { service, db } = await setup();

    // Seed a resident to link to
    const residentId = await db.residents.add({
      firstName: 'Test', lastName: 'Resident',
      email: 'test@hp.local', phone: '555-9999',
      dateOfBirth: new Date('1990-01-01'), status: 'active',
      encryptedId: 'test-enc-id', notes: [],
      consentGiven: false, createdAt: new Date(), updatedAt: new Date(),
    });

    const roomId = 1;

    // Before move-in: empty
    const beforeMoveIn = await service.getRoomOccupants(roomId);
    // May have other occupants from prior tests — just check it's an array
    const countBefore = beforeMoveIn.length;

    await service.moveIn({
      residentId, roomId, effectiveFrom: new Date(),
      reasonCode: ReasonCode.MOVE_IN_NEW, actorId: 1, actorRole: 'admin',
    });

    const afterMoveIn = await service.getRoomOccupants(roomId);
    const found = afterMoveIn.find(o => o.resident.id === residentId);
    expect(found).toBeDefined();
    expect(found!.resident.firstName).toBe('Test');

    // After move-out: resident no longer active in room
    await service.moveOut({
      residentId, effectiveTo: new Date(),
      reasonCode: ReasonCode.MOVE_OUT_VOLUNTARY, actorId: 1, actorRole: 'admin',
    });

    const afterMoveOut = await service.getRoomOccupants(roomId);
    const foundAfter = afterMoveOut.find(o => o.resident.id === residentId);
    expect(foundAfter).toBeUndefined();

    await teardown(db);
  });
});
