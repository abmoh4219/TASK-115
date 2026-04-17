/**
 * AuthService Unit Tests
 * Tests: role selection, hasRole, lockSession, inactivity timer
 */

import { TestBed, fakeAsync, tick, flushMicrotasks } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService, UserRole } from '../../../src/app/core/services/auth.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';

// =====================================================
// Helpers
// =====================================================

function buildAuthService(): AuthService {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule.withRoutes([{ path: '**', redirectTo: '' }])],
    providers: [AuthService, CryptoService],
  });
  return TestBed.inject(AuthService);
}

// =====================================================
// selectRole
// =====================================================

describe('AuthService.selectRole', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    service = buildAuthService();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    service.ngOnDestroy();
    localStorage.clear();
  });

  it('returns true for correct default password', async () => {
    const result = await service.selectRole('admin', 'harborpoint2024');
    expect(result).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const result = await service.selectRole('admin', 'wrongpassword');
    expect(result).toBe(false);
  });

  it('sets isLoggedIn to true after successful login', async () => {
    await service.selectRole('admin', 'harborpoint2024');
    expect(service.isLoggedIn()).toBe(true);
  });

  it('does not set isLoggedIn on failed login', async () => {
    await service.selectRole('admin', 'wrongpassword');
    expect(service.isLoggedIn()).toBe(false);
  });

  it('stores last role in localStorage after login (UX only)', async () => {
    await service.selectRole('resident', 'harborpoint2024');
    expect(localStorage.getItem('hp_last_role')).toBe('resident');
  });

  it('works for all 4 roles with default password', async () => {
    const roles: UserRole[] = ['admin', 'resident', 'compliance', 'analyst'];
    for (const role of roles) {
      localStorage.clear();
      TestBed.resetTestingModule();
      service = buildAuthService();
      const ok = await service.selectRole(role, 'harborpoint2024');
      expect(ok).toBe(true); // role: `${role}`
      service.ngOnDestroy();
    }
  });
});

// =====================================================
// hasRole
// =====================================================

describe('AuthService.hasRole', () => {
  let service: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    service = buildAuthService();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    service.ngOnDestroy();
    localStorage.clear();
  });

  it('returns true for current role', async () => {
    await service.selectRole('admin', 'harborpoint2024');
    expect(service.hasRole('admin')).toBe(true);
  });

  it('returns false for a different role', async () => {
    await service.selectRole('admin', 'harborpoint2024');
    expect(service.hasRole('resident')).toBe(false);
  });

  it('returns false when not logged in', () => {
    expect(service.hasRole('admin')).toBe(false);
  });

  it('returns false after lockSession', async () => {
    await service.selectRole('admin', 'harborpoint2024');
    service.lockSession();
    expect(service.hasRole('admin')).toBe(false);
  });
});

// =====================================================
// lockSession
// =====================================================

describe('AuthService.lockSession', () => {
  let service: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    service = buildAuthService();
    await service.selectRole('admin', 'harborpoint2024');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    service.ngOnDestroy();
    localStorage.clear();
  });

  it('sets isLoggedIn to false', () => {
    service.lockSession();
    expect(service.isLoggedIn()).toBe(false);
  });

  it('preserves current role (for re-auth UI)', () => {
    service.lockSession();
    expect(service.getCurrentRole()).toBe('admin');
  });

  it('stops accepting hasRole checks after lock', () => {
    service.lockSession();
    expect(service.hasRole('admin')).toBe(false);
  });
});

// =====================================================
// getInactivityTimer
// =====================================================

describe('AuthService inactivity timer', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    service = buildAuthService();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    service.ngOnDestroy();
    localStorage.clear();
  });

  it('timer is null before login', () => {
    expect(service.getInactivityTimer()).toBeNull();
  });

  it('timer is set after login', async () => {
    await service.selectRole('admin', 'harborpoint2024');
    expect(service.getInactivityTimer()).not.toBeNull();
  });

  it('timer is cleared after lockSession', async () => {
    await service.selectRole('admin', 'harborpoint2024');
    service.lockSession();
    expect(service.getInactivityTimer()).toBeNull();
  });

  it('locks session after 30 minutes of inactivity', fakeAsync(() => {
    // Set logged-in state and start the inactivity timer WITHIN the fakeAsync
    // zone so that the setTimeout is intercepted and controllable via tick().
    // (Using await/selectRole here would escape the zone via native WebCrypto promises.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)._state$.next({ role: 'admin', isLocked: false, isLoggedIn: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).resetInactivityTimer();

    expect(service.isLoggedIn()).toBe(true);

    // Advance time by 30 minutes
    tick(30 * 60 * 1000 + 100);

    expect(service.isLoggedIn()).toBe(false);
  }));
});

// =====================================================
// Re-authentication
// =====================================================

describe('AuthService.reAuthenticate', () => {
  let service: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    service = buildAuthService();
    await service.selectRole('compliance', 'harborpoint2024');
    service.lockSession();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    service.ngOnDestroy();
    localStorage.clear();
  });

  it('unlocks with correct password', async () => {
    const ok = await service.reAuthenticate('harborpoint2024');
    expect(ok).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
  });

  it('rejects wrong password', async () => {
    const ok = await service.reAuthenticate('wrong');
    expect(ok).toBe(false);
    expect(service.isLoggedIn()).toBe(false);
  });
});
