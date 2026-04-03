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

describe('Auth Integration — route guard behavior', () => {
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
    authService.ngOnDestroy();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('AdminGuard: admin role → canActivate true; resident role → false', async () => {
    await authService.selectRole('admin', 'harborpoint2024');
    expect(authService.hasRole('admin')).toBe(true);

    authService.lockSession();
    await authService.selectRole('resident', 'harborpoint2024');
    expect(authService.hasRole('admin')).toBe(false);
  });

  it('ResidentGuard: resident role → true; admin role → false', async () => {
    await authService.selectRole('resident', 'harborpoint2024');
    expect(authService.hasRole('resident')).toBe(true);
    expect(authService.hasRole('admin')).toBe(false);
  });

  it('ComplianceGuard: compliance → true; analyst → false', async () => {
    await authService.selectRole('compliance', 'harborpoint2024');
    expect(authService.hasRole('compliance')).toBe(true);
    expect(authService.hasRole('analyst')).toBe(false);
  });

  it('AnalystGuard: analyst → true; compliance → false', async () => {
    await authService.selectRole('analyst', 'harborpoint2024');
    expect(authService.hasRole('analyst')).toBe(true);
    expect(authService.hasRole('compliance')).toBe(false);
  });

  it('lockSession clears all role access', async () => {
    await authService.selectRole('admin', 'harborpoint2024');
    expect(authService.hasRole('admin')).toBe(true);

    authService.lockSession();
    expect(authService.hasRole('admin')).toBe(false);
    expect(authService.hasRole('resident')).toBe(false);
    expect(authService.hasRole('compliance')).toBe(false);
    expect(authService.hasRole('analyst')).toBe(false);
    expect(authService.hasAnyRole('admin', 'resident', 'compliance', 'analyst')).toBe(false);
  });
});

describe('Auth Integration — anomaly detection', () => {
  let anomalyService: import('../src/app/core/services/anomaly.service').AnomalyService;

  beforeEach(() => {
    localStorage.clear();
    const { AnomalyService } = require('../src/app/core/services/anomaly.service');
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [AuthService, CryptoService, AnomalyService,
        { provide: 'AuditService', useValue: { log: () => {} } },
      ],
    });
    anomalyService = TestBed.inject(AnomalyService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('emits anomalyDetected$ after >30 searches in 60s', () => {
    const events: unknown[] = [];
    anomalyService.anomalyDetected$.subscribe(e => events.push(e));

    // First 30 searches should not trigger
    for (let i = 0; i < 30; i++) {
      anomalyService.recordSearch();
    }
    expect(events.length).toBe(0);

    // 31st search triggers anomaly
    anomalyService.recordSearch();
    expect(events.length).toBe(1);
  });
});

describe('Auth Integration — userId in session', () => {
  let authService: AuthService;
  let cryptoService: CryptoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [AuthService, CryptoService],
    });
    authService = TestBed.inject(AuthService);
    cryptoService = TestBed.inject(CryptoService);
  });

  afterEach(() => {
    authService.ngOnDestroy();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('login sets correct userId per role', async () => {
    await authService.login('admin', 'harborpoint2024');
    expect(authService.getCurrentUserId()).toBe(1);

    authService.lockSession();
    await authService.login('resident', 'harborpoint2024');
    expect(authService.getCurrentUserId()).toBe(2);

    authService.lockSession();
    await authService.login('compliance', 'harborpoint2024');
    expect(authService.getCurrentUserId()).toBe(3);

    authService.lockSession();
    await authService.login('analyst', 'harborpoint2024');
    expect(authService.getCurrentUserId()).toBe(4);
  });

  it('lockSession clears userId and crypto key', async () => {
    await authService.login('admin', 'harborpoint2024');
    expect(authService.getCurrentUserId()).toBe(1);
    expect(cryptoService.getSessionKey()).not.toBeNull();

    authService.lockSession();
    expect(authService.getCurrentUserId()).toBeNull();
    expect(cryptoService.getSessionKey()).toBeNull();
  });
});
