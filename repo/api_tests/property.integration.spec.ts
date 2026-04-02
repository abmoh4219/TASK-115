/**
 * Property Integration Tests
 * Tests: CRUD + occupancy rules (one active occupancy per resident)
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { PropertyService } from '../src/app/core/services/property.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';

describe('Property Integration — CRUD', () => {
  let propertyService: PropertyService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [PropertyService, DbService, AuditService],
    });
    db = TestBed.inject(DbService);
    propertyService = TestBed.inject(PropertyService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('creates a building and retrieves it', async () => {
    const building = await propertyService.createBuilding(
      { name: 'Test Tower', address: '123 Test St', floors: 5 },
      1, 'admin',
    );
    expect(building.id).toBeDefined();
    expect(building.name).toBe('Test Tower');
  });

  it('retrieves all buildings', async () => {
    const buildings = await propertyService.getBuildings();
    expect(buildings.length).toBeGreaterThanOrEqual(1); // seed data
  });

  it('creates a unit in a building', async () => {
    const buildings = await propertyService.getBuildings();
    const buildingId = buildings[0].id!;
    const unit = await propertyService.createUnit(
      { buildingId, unitNumber: 'T01', floor: 1, type: '1BR' },
      1, 'admin',
    );
    expect(unit.buildingId).toBe(buildingId);
  });

  it('creates a room in a unit', async () => {
    const units = await propertyService.getUnits();
    const unitId = units[0].id!;
    const room = await propertyService.createRoom(
      { unitId, roomNumber: 'T01A', capacity: 2 },
      1, 'admin',
    );
    expect(room.unitId).toBe(unitId);
  });
});

describe('Property Integration — Occupancy rules', () => {
  let propertyService: PropertyService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [PropertyService, DbService, AuditService],
    });
    db = TestBed.inject(DbService);
    propertyService = TestBed.inject(PropertyService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  const RESIDENT_ID = 999;
  const ROOM_ID = 1;

  it('allows move-in for resident with no active occupancy', async () => {
    const occupancy = await propertyService.moveIn({
      residentId: RESIDENT_ID,
      roomId: ROOM_ID,
      effectiveFrom: new Date(),
      reasonCode: 'NEW_RESIDENT',
      actorId: 1,
      actorRole: 'admin',
    });
    expect(occupancy.status).toBe('active');
  });

  it('throws when moving in a resident who already has active occupancy', async () => {
    await propertyService.moveIn({
      residentId: RESIDENT_ID + 1,
      roomId: ROOM_ID,
      effectiveFrom: new Date(),
      reasonCode: 'NEW_RESIDENT',
      actorId: 1,
      actorRole: 'admin',
    });

    await expect(propertyService.moveIn({
      residentId: RESIDENT_ID + 1,
      roomId: ROOM_ID,
      effectiveFrom: new Date(),
      reasonCode: 'TRANSFER',
      actorId: 1,
      actorRole: 'admin',
    })).rejects.toThrow('RESIDENT_ALREADY_HAS_ACTIVE_OCCUPANCY');
  });

  it('allows move-out after move-in', async () => {
    const RID = RESIDENT_ID + 2;
    await propertyService.moveIn({
      residentId: RID,
      roomId: ROOM_ID,
      effectiveFrom: new Date(),
      reasonCode: 'NEW_RESIDENT',
      actorId: 1,
      actorRole: 'admin',
    });

    await expect(propertyService.moveOut({
      residentId: RID,
      effectiveTo: new Date(),
      reasonCode: 'VOLUNTARY_DEPARTURE',
      actorId: 1,
      actorRole: 'admin',
    })).resolves.not.toThrow();
  });

  it('throws move-out when no active occupancy', async () => {
    await expect(propertyService.moveOut({
      residentId: 888888,
      effectiveTo: new Date(),
      reasonCode: 'LEASE_EXPIRY',
      actorId: 1,
      actorRole: 'admin',
    })).rejects.toThrow('NO_ACTIVE_OCCUPANCY');
  });

  it('getActiveOccupancy returns null after move-out', async () => {
    const RID = RESIDENT_ID + 3;
    await propertyService.moveIn({
      residentId: RID,
      roomId: ROOM_ID,
      effectiveFrom: new Date(),
      reasonCode: 'NEW_RESIDENT',
      actorId: 1,
      actorRole: 'admin',
    });
    await propertyService.moveOut({
      residentId: RID,
      effectiveTo: new Date(),
      reasonCode: 'LEASE_EXPIRY',
      actorId: 1,
      actorRole: 'admin',
    });
    const active = await propertyService.getActiveOccupancy(RID);
    expect(active).toBeUndefined();
  });
});
