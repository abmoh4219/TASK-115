import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AdminGuard } from '@core/guards/admin.guard';
import { AuthService } from '@core/services/auth.service';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let authSpy: jest.Mocked<Pick<AuthService, 'hasRole'>>;
  let routerSpy: jest.Mocked<Pick<Router, 'navigate'>>;

  beforeEach(() => {
    authSpy = { hasRole: jest.fn() };
    routerSpy = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        AdminGuard,
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
    guard = TestBed.inject(AdminGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('returns true when user is admin', () => {
    (authSpy.hasRole as jest.Mock).mockReturnValue(true);
    expect(guard.canActivate()).toBe(true);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('returns false and redirects to /unauthorized when not admin', () => {
    (authSpy.hasRole as jest.Mock).mockReturnValue(false);
    expect(guard.canActivate()).toBe(false);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});
