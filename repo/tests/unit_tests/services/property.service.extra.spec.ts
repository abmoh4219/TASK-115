/**
 * Additional coverage for PropertyService — unit/room CRUD
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { PropertyService } from '../../../src/app/core/services/property.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';

async function setup() {
  TestBed.configureTestingModule({
    providers: [PropertyService, DbService, AuditService, AuthService, LoggerService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return { service: TestBed.inject(PropertyService), db };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('PropertyService — getBuilding', () => {
  it('returns the seeded building by id', async () => {
    const { service, db } = await setup();
    const buildings = await service.getBuildings();
    const building = await service.getBuilding(buildings[0].id!);
    expect(building).toBeDefined();
    expect(building!.name).toBe('Harbor Tower');
    await teardown(db);
  });
});

describe('PropertyService — updateBuilding', () => {
  it('updates a building field', async () => {
    const { service, db } = await setup();
    const buildings = await service.getBuildings();
    const id = buildings[0].id!;
    await service.updateBuilding(id, { name: 'Updated Tower' });
    const updated = await service.getBuilding(id);
    expect(updated!.name).toBe('Updated Tower');
    await teardown(db);
  });
});

describe('PropertyService — createUnit', () => {
  it('creates a unit in a building and returns it', async () => {
    const { service, db } = await setup();
    const buildings = await service.getBuildings();
    const unit = await service.createUnit({
      buildingId: buildings[0].id!,
      unitNumber: '999',
      floor: 9,
      type: 'standard',
    });
    expect(unit).toBeDefined();
    expect(unit.unitNumber).toBe('999');
    await teardown(db);
  });
});

describe('PropertyService — getUnits', () => {
  it('returns units for a building', async () => {
    const { service, db } = await setup();
    const buildings = await service.getBuildings();
    const units = await service.getUnits(buildings[0].id!);
    expect(Array.isArray(units)).toBe(true);
    await teardown(db);
  });

  it('returns all units when no buildingId given', async () => {
    const { service, db } = await setup();
    const units = await service.getUnits();
    expect(Array.isArray(units)).toBe(true);
    await teardown(db);
  });
});

describe('PropertyService — updateUnit', () => {
  it('updates a unit field', async () => {
    const { service, db } = await setup();
    const buildings = await service.getBuildings();
    const units = await service.getUnits(buildings[0].id!);
    await service.updateUnit(units[0].id!, { unitNumber: 'UPDATED' });
    const updated = (await service.getUnits(buildings[0].id!)).find(u => u.id === units[0].id!);
    expect(updated!.unitNumber).toBe('UPDATED');
    await teardown(db);
  });
});

describe('PropertyService — createRoom', () => {
  it('creates a room in a unit and returns it', async () => {
    const { service, db } = await setup();
    const buildings = await service.getBuildings();
    const units = await service.getUnits(buildings[0].id!);
    const room = await service.createRoom({
      unitId: units[0].id!,
      roomNumber: 'Z99',
      capacity: 1,
    });
    expect(room).toBeDefined();
    expect(room.roomNumber).toBe('Z99');
    await teardown(db);
  });
});

describe('PropertyService — getRooms', () => {
  it('returns rooms for a unit', async () => {
    const { service, db } = await setup();
    const buildings = await service.getBuildings();
    const units = await service.getUnits(buildings[0].id!);
    const rooms = await service.getRooms(units[0].id!);
    expect(Array.isArray(rooms)).toBe(true);
    await teardown(db);
  });

  it('returns all rooms when no unitId given', async () => {
    const { service, db } = await setup();
    const rooms = await service.getRooms();
    expect(Array.isArray(rooms)).toBe(true);
    await teardown(db);
  });
});

describe('PropertyService — updateRoom', () => {
  it('updates a room field', async () => {
    const { service, db } = await setup();
    const buildings = await service.getBuildings();
    const units = await service.getUnits(buildings[0].id!);
    const rooms = await service.getRooms(units[0].id!);
    await service.updateRoom(rooms[0].id!, { roomNumber: 'UPD' });
    const updated = (await service.getRooms(units[0].id!)).find(r => r.id === rooms[0].id!);
    expect(updated!.roomNumber).toBe('UPD');
    await teardown(db);
  });
});
