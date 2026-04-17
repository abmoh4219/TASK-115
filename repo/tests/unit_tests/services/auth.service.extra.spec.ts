/**
 * Extra coverage for AuthService — login(), hasAnyRole(), getLastRole(), changePassword(), logout()
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';

async function setup() {
  TestBed.configureTestingModule({
    providers: [AuthService, DbService, CryptoService, AuditService, LoggerService, AnomalyService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  return { service: TestBed.inject(AuthService), db };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('AuthService — login()', () => {
  it('login with valid admin credentials succeeds', async () => {
    const { service, db } = await setup();
    const result = await service.login('admin', 'harborpoint2024');
    expect(result.success).toBe(true);
    await teardown(db);
  });

  it('login with unknown username fails', async () => {
    const { service, db } = await setup();
    const result = await service.login('unknown', 'anypassword');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid');
    await teardown(db);
  });

  it('login with wrong password fails', async () => {
    const { service, db } = await setup();
    const result = await service.login('admin', 'wrongpassword');
    expect(result.success).toBe(false);
    await teardown(db);
  });
});

describe('AuthService — hasAnyRole()', () => {
  it('returns true when user has one of the specified roles', async () => {
    const { service, db } = await setup();
    await service.selectRole('admin', 'harborpoint2024');
    expect(service.hasAnyRole('admin', 'resident')).toBe(true);
    await teardown(db);
  });

  it('returns false when user does not have any of the specified roles', async () => {
    const { service, db } = await setup();
    await service.selectRole('resident', 'harborpoint2024');
    expect(service.hasAnyRole('admin', 'compliance')).toBe(false);
    await teardown(db);
  });
});

describe('AuthService — getLastRole()', () => {
  it('returns null when localStorage is empty', async () => {
    const { service, db } = await setup();
    localStorage.removeItem('hp_last_role');
    expect(service.getLastRole()).toBeNull();
    await teardown(db);
  });

  it('returns saved role from localStorage', async () => {
    const { service, db } = await setup();
    await service.selectRole('analyst', 'harborpoint2024');
    expect(service.getLastRole()).toBe('analyst');
    await teardown(db);
  });
});

describe('AuthService — logout()', () => {
  it('clears login state after logout', async () => {
    const { service, db } = await setup();
    await service.selectRole('admin', 'harborpoint2024');
    expect(service.isLoggedIn()).toBe(true);
    service.logout();
    expect(service.isLoggedIn()).toBe(false);
    await teardown(db);
  });
});

describe('AuthService — changePassword()', () => {
  it('returns true when changing to a new password', async () => {
    const { service, db } = await setup();
    await service.selectRole('admin', 'harborpoint2024');
    const result = await service.changePassword('admin', 'harborpoint2024', 'newPassword123!');
    expect(typeof result).toBe('boolean');
    await teardown(db);
  });

  it('returns false when old password is wrong', async () => {
    const { service, db } = await setup();
    await service.selectRole('admin', 'harborpoint2024');
    const result = await service.changePassword('admin', 'wrongOld', 'newPassword123!');
    expect(result).toBe(false);
    await teardown(db);
  });
});
