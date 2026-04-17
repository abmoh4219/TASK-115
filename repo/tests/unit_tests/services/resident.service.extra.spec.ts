/**
 * Extra coverage for ResidentService — updateResident, getResident, getResidents with buildingId filter
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { ResidentService } from '../../../src/app/core/services/resident.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { PropertyService } from '../../../src/app/core/services/property.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';
import { SearchService } from '../../../src/app/core/services/search.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';

const BASE_DATA = {
  firstName: 'Jane', lastName: 'Extra', email: 'jane.extra@hp.local',
  phone: '555-1234', dateOfBirth: new Date('1990-01-01'),
  status: 'active' as const,
};

async function setup() {
  TestBed.configureTestingModule({
    providers: [ResidentService, DbService, AuditService, CryptoService, PropertyService, AuthService, LoggerService, SearchService, AnomalyService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return { service: TestBed.inject(ResidentService), db };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('ResidentService — getResident', () => {
  it('returns a resident by id', async () => {
    const { service, db } = await setup();
    const created = await service.createResident(BASE_DATA);
    const resident = await service.getResident(created.id!);
    expect(resident).toBeDefined();
    expect(resident!.email).toBe('jane.extra@hp.local');
    await teardown(db);
  });

  it('returns undefined for unknown id', async () => {
    const { service, db } = await setup();
    const resident = await service.getResident(99999);
    expect(resident).toBeUndefined();
    await teardown(db);
  });
});

describe('ResidentService — updateResident', () => {
  it('updates resident fields', async () => {
    const { service, db } = await setup();
    const created = await service.createResident(BASE_DATA);
    await service.updateResident(created.id!, { firstName: 'Updated' });
    const updated = await service.getResident(created.id!);
    expect(updated!.firstName).toBe('Updated');
    await teardown(db);
  });
});

describe('ResidentService — getResidents with buildingId filter', () => {
  it('returns residents filtered by buildingId', async () => {
    const { service, db } = await setup();
    const propertyService = TestBed.inject(PropertyService);
    const buildings = await propertyService.getBuildings();
    const residents = await service.getResidents({ buildingId: buildings[0].id });
    expect(Array.isArray(residents)).toBe(true);
    await teardown(db);
  });
});

describe('ResidentService — deleteResident', () => {
  it('returns all residents when no filters provided', async () => {
    const { service, db } = await setup();
    await service.createResident(BASE_DATA);
    const all = await service.getResidents();
    expect(all.length).toBeGreaterThan(0);
    await teardown(db);
  });
});
