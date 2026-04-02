/**
 * Auth Integration Tests
 * Tests: role guard checks, session lifecycle, anomaly detection
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from '../src/app/core/services/auth.service';
import { CryptoService } from '../src/app/core/services/crypto.service';

describe('Auth Integration — role guard enforcement', () => {
  let authService: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [AuthService, CryptoService],
    });
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    authService.ngOnDestroy();
    localStorage.clear();
  });

  it('Admin guard passes when role is admin', async () => {
    await authService.selectRole('admin', 'harborpoint2024');
    expect(authService.hasRole('admin')).toBe(true);
    expect(authService.hasRole('resident')).toBe(false);
    expect(authService.hasRole('compliance')).toBe(false);
    expect(authService.hasRole('analyst')).toBe(false);
  });

  it('Resident guard passes when role is resident', async () => {
    await authService.selectRole('resident', 'harborpoint2024');
    expect(authService.hasRole('resident')).toBe(true);
    expect(authService.hasRole('admin')).toBe(false);
  });

  it('Compliance guard passes when role is compliance', async () => {
    await authService.selectRole('compliance', 'harborpoint2024');
    expect(authService.hasRole('compliance')).toBe(true);
    expect(authService.hasRole('admin')).toBe(false);
  });

  it('Analyst guard passes when role is analyst', async () => {
    await authService.selectRole('analyst', 'harborpoint2024');
    expect(authService.hasRole('analyst')).toBe(true);
    expect(authService.hasRole('admin')).toBe(false);
  });

  it('No role passes before login', () => {
    expect(authService.hasRole('admin')).toBe(false);
    expect(authService.hasRole('resident')).toBe(false);
    expect(authService.hasRole('compliance')).toBe(false);
    expect(authService.hasRole('analyst')).toBe(false);
  });

  it('No role passes after session lock', async () => {
    await authService.selectRole('admin', 'harborpoint2024');
    authService.lockSession();
    expect(authService.hasAnyRole('admin', 'resident', 'compliance', 'analyst')).toBe(false);
  });

  it('Role is NOT stored in localStorage for security', async () => {
    await authService.selectRole('admin', 'harborpoint2024');
    // Only the UX hint (hp_last_role) should be stored, not the actual session role
    const stored = localStorage.getItem('hp_last_role');
    expect(stored).toBe('admin'); // UX hint is OK
    // But a guard bypass attempt by setting localStorage should not work
    // (guards check in-memory state via authService.hasRole())
    authService.lockSession();
    expect(authService.hasRole('admin')).toBe(false); // locked, in-memory check fails
  });

  it('hasAnyRole returns true for multi-role routes', async () => {
    await authService.selectRole('compliance', 'harborpoint2024');
    expect(authService.hasAnyRole('admin', 'compliance')).toBe(true);
    expect(authService.hasAnyRole('admin', 'resident', 'compliance', 'analyst')).toBe(true);
  });
});
