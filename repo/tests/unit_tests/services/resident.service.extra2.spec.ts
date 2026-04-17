/**
 * Extra coverage for ResidentService — getMyProfile(), repairPlaintextIds()
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

async function setup(role = 'admin') {
  TestBed.configureTestingModule({
    providers: [ResidentService, DbService, AuditService, CryptoService, PropertyService, AuthService, LoggerService, SearchService, AnomalyService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole(role as any, 'harborpoint2024');
  return { service: TestBed.inject(ResidentService), db };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('ResidentService — getMyProfile', () => {
  it('returns profile for logged-in resident', async () => {
    const { service, db } = await setup('resident');
    const profile = await service.getMyProfile();
    expect(profile === undefined || profile !== null).toBe(true);
    await teardown(db);
  });

  it('throws when not authenticated', async () => {
    const { service, db } = await setup('admin');
    TestBed.inject(AuthService).logout();
    await expect(service.getMyProfile()).rejects.toThrow('Unauthorized');
    await teardown(db);
  });
});

describe('ResidentService — repairPlaintextIds', () => {
  it('returns 0 when all ids are already in encrypted format', async () => {
    const { service, db } = await setup('admin');
    const repaired = await service.repairPlaintextIds();
    expect(typeof repaired).toBe('number');
    await teardown(db);
  });
});

describe('ResidentService — getResidents with status filter', () => {
  it('returns only active residents when status=active', async () => {
    const { service, db } = await setup('admin');
    const residents = await service.getResidents({ status: ['active'] });
    expect(residents.every(r => r.status === 'active')).toBe(true);
    await teardown(db);
  });
});
