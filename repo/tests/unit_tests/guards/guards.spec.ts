import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ResidentGuard } from '@core/guards/resident.guard';
import { ComplianceGuard } from '@core/guards/compliance.guard';
import { AnalystGuard } from '@core/guards/analyst.guard';
import {
  AllRolesGuard,
  AdminOrComplianceGuard,
  AdminOrResidentGuard,
  AdminOrAnalystGuard,
  multiRoleGuardFactory,
} from '@core/guards/multi-role.guard';
import { AuthService } from '@core/services/auth.service';

function makeAuth(hasRole: boolean, hasAnyRole?: boolean) {
  return {
    hasRole: jest.fn().mockReturnValue(hasRole),
    hasAnyRole: jest.fn().mockReturnValue(hasAnyRole ?? hasRole),
  };
}

function makeRouter() {
  return { navigate: jest.fn() };
}

describe('multiRoleGuardFactory', () => {
  it('creates a guard that allows specified roles', () => {
    const GuardClass = multiRoleGuardFactory(['admin', 'analyst']);
    const router = makeRouter();
    TestBed.configureTestingModule({
      providers: [
        GuardClass,
        { provide: AuthService, useValue: makeAuth(true, true) },
        { provide: Router, useValue: router },
      ],
    });
    expect(TestBed.inject(GuardClass).canActivate()).toBe(true);
  });

  it('creates a guard that blocks unauthorized roles', () => {
    const GuardClass = multiRoleGuardFactory(['admin', 'analyst']);
    const router = makeRouter();
    TestBed.configureTestingModule({
      providers: [
        GuardClass,
        { provide: AuthService, useValue: makeAuth(false, false) },
        { provide: Router, useValue: router },
      ],
    });
    expect(TestBed.inject(GuardClass).canActivate()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});

describe('ResidentGuard', () => {
  it('allows resident', () => {
    TestBed.configureTestingModule({
      providers: [
        ResidentGuard,
        { provide: AuthService, useValue: makeAuth(true) },
        { provide: Router, useValue: makeRouter() },
      ],
    });
    expect(TestBed.inject(ResidentGuard).canActivate()).toBe(true);
  });

  it('blocks non-resident and navigates to /unauthorized', () => {
    const router = makeRouter();
    TestBed.configureTestingModule({
      providers: [
        ResidentGuard,
        { provide: AuthService, useValue: makeAuth(false) },
        { provide: Router, useValue: router },
      ],
    });
    expect(TestBed.inject(ResidentGuard).canActivate()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});

describe('ComplianceGuard', () => {
  it('allows compliance role', () => {
    TestBed.configureTestingModule({
      providers: [
        ComplianceGuard,
        { provide: AuthService, useValue: makeAuth(true) },
        { provide: Router, useValue: makeRouter() },
      ],
    });
    expect(TestBed.inject(ComplianceGuard).canActivate()).toBe(true);
  });

  it('blocks and redirects when not compliance', () => {
    const router = makeRouter();
    TestBed.configureTestingModule({
      providers: [
        ComplianceGuard,
        { provide: AuthService, useValue: makeAuth(false) },
        { provide: Router, useValue: router },
      ],
    });
    expect(TestBed.inject(ComplianceGuard).canActivate()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});

describe('AnalystGuard', () => {
  it('allows analyst role', () => {
    TestBed.configureTestingModule({
      providers: [
        AnalystGuard,
        { provide: AuthService, useValue: makeAuth(true) },
        { provide: Router, useValue: makeRouter() },
      ],
    });
    expect(TestBed.inject(AnalystGuard).canActivate()).toBe(true);
  });

  it('blocks and redirects when not analyst', () => {
    const router = makeRouter();
    TestBed.configureTestingModule({
      providers: [
        AnalystGuard,
        { provide: AuthService, useValue: makeAuth(false) },
        { provide: Router, useValue: router },
      ],
    });
    expect(TestBed.inject(AnalystGuard).canActivate()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});

describe('AllRolesGuard', () => {
  it('allows any authenticated user', () => {
    TestBed.configureTestingModule({
      providers: [
        AllRolesGuard,
        { provide: AuthService, useValue: makeAuth(true, true) },
        { provide: Router, useValue: makeRouter() },
      ],
    });
    expect(TestBed.inject(AllRolesGuard).canActivate()).toBe(true);
  });

  it('redirects to /login when unauthenticated', () => {
    const router = makeRouter();
    TestBed.configureTestingModule({
      providers: [
        AllRolesGuard,
        { provide: AuthService, useValue: makeAuth(false, false) },
        { provide: Router, useValue: router },
      ],
    });
    expect(TestBed.inject(AllRolesGuard).canActivate()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});

describe('AdminOrComplianceGuard', () => {
  it('allows admin or compliance', () => {
    TestBed.configureTestingModule({
      providers: [
        AdminOrComplianceGuard,
        { provide: AuthService, useValue: makeAuth(true, true) },
        { provide: Router, useValue: makeRouter() },
      ],
    });
    expect(TestBed.inject(AdminOrComplianceGuard).canActivate()).toBe(true);
  });

  it('blocks others', () => {
    const router = makeRouter();
    TestBed.configureTestingModule({
      providers: [
        AdminOrComplianceGuard,
        { provide: AuthService, useValue: makeAuth(false, false) },
        { provide: Router, useValue: router },
      ],
    });
    expect(TestBed.inject(AdminOrComplianceGuard).canActivate()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});

describe('AdminOrResidentGuard', () => {
  it('allows admin or resident', () => {
    TestBed.configureTestingModule({
      providers: [
        AdminOrResidentGuard,
        { provide: AuthService, useValue: makeAuth(true, true) },
        { provide: Router, useValue: makeRouter() },
      ],
    });
    expect(TestBed.inject(AdminOrResidentGuard).canActivate()).toBe(true);
  });

  it('blocks and redirects others', () => {
    const router = makeRouter();
    TestBed.configureTestingModule({
      providers: [
        AdminOrResidentGuard,
        { provide: AuthService, useValue: makeAuth(false, false) },
        { provide: Router, useValue: router },
      ],
    });
    expect(TestBed.inject(AdminOrResidentGuard).canActivate()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});

describe('AdminOrAnalystGuard', () => {
  it('allows admin or analyst', () => {
    TestBed.configureTestingModule({
      providers: [
        AdminOrAnalystGuard,
        { provide: AuthService, useValue: makeAuth(true, true) },
        { provide: Router, useValue: makeRouter() },
      ],
    });
    expect(TestBed.inject(AdminOrAnalystGuard).canActivate()).toBe(true);
  });

  it('blocks and redirects others', () => {
    const router = makeRouter();
    TestBed.configureTestingModule({
      providers: [
        AdminOrAnalystGuard,
        { provide: AuthService, useValue: makeAuth(false, false) },
        { provide: Router, useValue: router },
      ],
    });
    expect(TestBed.inject(AdminOrAnalystGuard).canActivate()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});
