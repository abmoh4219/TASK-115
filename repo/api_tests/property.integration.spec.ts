/**
 * Property Integration Tests
 * Tests: CRUD + occupancy rules (one active occupancy per resident) + getRoomOccupants
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { PropertyService, ReasonCode } from '../src/app/core/services/property.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';

describe('Property Integration — CRUD', () => {
  let propertyService: PropertyService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
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

  it('retrieves all buildings including seed data', async () => {
    const buildings = await propertyService.getBuildings();
    expect(buildings.length).toBeGreaterThanOrEqual(1);
  });

  it('creates a unit in a building', async () => {
    const buildings = await propertyService.getBuildings();
    const buildingId = buildings[0].id!;
    const unit = await propertyService.createUnit(
      { buildingId, unitNumber: 'T01', floor: 1, type: '1BR' },
      1, 'admin',
    );
    expect(unit.buildingId).toBe(buildingId);
    expect(unit.unitNumber).toBe('T01');
  });

  it('creates a room in a unit', async () => {
    const units = await propertyService.getUnits();
    const unitId = units[0].id!;
    const room = await propertyService.createRoom(
      { unitId, roomNumber: 'T01A', capacity: 2 },
      1, 'admin',
    );
    expect(room.unitId).toBe(unitId);
    expect(room.roomNumber).toBe('T01A');
    expect(room.capacity).toBe(2);
  });

  it('getUnits filters by buildingId', async () => {
    const buildings = await propertyService.getBuildings();
    const buildingId = buildings[0].id!;
    const units = await propertyService.getUnits(buildingId);
    for (const u of units) {
      expect(u.buildingId).toBe(buildingId);
    }
  });

  it('getRooms filters by unitId', async () => {
    const units = await propertyService.getUnits();
    const unitId = units[0].id!;
    const rooms = await propertyService.getRooms(unitId);
    for (const r of rooms) {
      expect(r.unitId).toBe(unitId);
    }
  });
});

describe('Property Integration — Occupancy rules', () => {
  let propertyService: PropertyService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
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
      reasonCode: ReasonCode.MOVE_IN_NEW,
      actorId: 1,
      actorRole: 'admin',
    });
    expect(occupancy.status).toBe('active');
    expect(occupancy.reasonCode).toBe(ReasonCode.MOVE_IN_NEW);
  });

  it('throws when moving in a resident who already has active occupancy', async () => {
    const RID = RESIDENT_ID + 1;
    await propertyService.moveIn({
      residentId: RID,
      roomId: ROOM_ID,
      effectiveFrom: new Date(),
      reasonCode: ReasonCode.MOVE_IN_NEW,
      actorId: 1,
      actorRole: 'admin',
    });

    await expect(propertyService.moveIn({
      residentId: RID,
      roomId: ROOM_ID,
      effectiveFrom: new Date(),
      reasonCode: ReasonCode.TRANSFER,
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
      reasonCode: ReasonCode.LEASE_START,
      actorId: 1,
      actorRole: 'admin',
    });

    await expect(propertyService.moveOut({
      residentId: RID,
      effectiveTo: new Date(),
      reasonCode: ReasonCode.MOVE_OUT_VOLUNTARY,
      actorId: 1,
      actorRole: 'admin',
    })).resolves.not.toThrow();
  });

  it('throws move-out when no active occupancy exists', async () => {
    await expect(propertyService.moveOut({
      residentId: 888888,
      effectiveTo: new Date(),
      reasonCode: ReasonCode.LEASE_END,
      actorId: 1,
      actorRole: 'admin',
    })).rejects.toThrow('NO_ACTIVE_OCCUPANCY');
  });

  it('getActiveOccupancy returns undefined after move-out', async () => {
    const RID = RESIDENT_ID + 3;
    await propertyService.moveIn({
      residentId: RID,
      roomId: ROOM_ID,
      effectiveFrom: new Date(),
      reasonCode: ReasonCode.MOVE_IN_NEW,
      actorId: 1,
      actorRole: 'admin',
    });
    await propertyService.moveOut({
      residentId: RID,
      effectiveTo: new Date(),
      reasonCode: ReasonCode.LEASE_END,
      actorId: 1,
      actorRole: 'admin',
    });
    const active = await propertyService.getActiveOccupancy(RID);
    expect(active).toBeUndefined();
  });

  it('getOccupancyHistory returns full move-in/out history in order', async () => {
    const RID = RESIDENT_ID + 4;
    const start = new Date('2024-01-01');
    const end   = new Date('2024-06-30');

    await propertyService.moveIn({
      residentId: RID, roomId: ROOM_ID, effectiveFrom: start,
      reasonCode: ReasonCode.LEASE_START, actorId: 1, actorRole: 'admin',
    });
    await propertyService.moveOut({
      residentId: RID, effectiveTo: end,
      reasonCode: ReasonCode.LEASE_END, actorId: 1, actorRole: 'admin',
    });

    const history = await propertyService.getOccupancyHistory(RID);
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('ended');
    expect(history[0].effectiveTo).toEqual(end);
  });
});

describe('Property Integration — getRoomOccupants', () => {
  let propertyService: PropertyService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
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

  it('returns occupants for a room after move-in', async () => {
    const residentId = await db.residents.add({
      firstName: 'Alice', lastName: 'Smith',
      email: 'alice@hp.local', phone: '555-1111',
      dateOfBirth: new Date('1985-05-15'), status: 'active',
      encryptedId: 'alice-enc', notes: [],
      consentGiven: false, createdAt: new Date(), updatedAt: new Date(),
    });

    const rooms = await propertyService.getRooms();
    const roomId = rooms[0].id!;

    await propertyService.moveIn({
      residentId, roomId, effectiveFrom: new Date(),
      reasonCode: ReasonCode.MOVE_IN_NEW, actorId: 1, actorRole: 'admin',
    });

    const occupants = await propertyService.getRoomOccupants(roomId);
    const found = occupants.find(o => o.resident.id === residentId);
    expect(found).toBeDefined();
    expect(found!.resident.firstName).toBe('Alice');
    expect(found!.occupancy.status).toBe('active');
  });

  it('does not return occupant after move-out', async () => {
    const residentId = await db.residents.add({
      firstName: 'Bob', lastName: 'Jones',
      email: 'bob@hp.local', phone: '555-2222',
      dateOfBirth: new Date('1990-08-20'), status: 'active',
      encryptedId: 'bob-enc', notes: [],
      consentGiven: false, createdAt: new Date(), updatedAt: new Date(),
    });

    const rooms = await propertyService.getRooms();
    const roomId = rooms[0].id!;

    await propertyService.moveIn({
      residentId, roomId, effectiveFrom: new Date(),
      reasonCode: ReasonCode.MOVE_IN_NEW, actorId: 1, actorRole: 'admin',
    });
    await propertyService.moveOut({
      residentId, effectiveTo: new Date(),
      reasonCode: ReasonCode.MOVE_OUT_VOLUNTARY, actorId: 1, actorRole: 'admin',
    });

    const occupants = await propertyService.getRoomOccupants(roomId);
    const found = occupants.find(o => o.resident.id === residentId);
    expect(found).toBeUndefined();
  });
});
