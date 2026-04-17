import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RolePickerComponent } from '@features/login/role-picker.component';
import { AuthService } from '@core/services/auth.service';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('RolePickerComponent', () => {
  let fixture: ComponentFixture<RolePickerComponent>;
  let component: RolePickerComponent;
  let authSpy: jest.Mocked<Pick<AuthService, 'login' | 'isLoggedIn' | 'getCurrentRole'>>;
  let routerSpy: jest.Mocked<Pick<Router, 'navigate'>>;

  beforeEach(async () => {
    authSpy = {
      login: jest.fn().mockResolvedValue({ success: false, error: 'Invalid credentials' }),
      isLoggedIn: jest.fn().mockReturnValue(false),
      getCurrentRole: jest.fn().mockReturnValue(null),
    };
    routerSpy = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [RolePickerComponent, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RolePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('redirects to dashboard on init when already logged in as admin', () => {
    (authSpy.isLoggedIn as jest.Mock).mockReturnValue(true);
    (authSpy.getCurrentRole as jest.Mock).mockReturnValue('admin');
    component.ngOnInit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('redirects to my-profile on init when already logged in as resident', () => {
    (authSpy.isLoggedIn as jest.Mock).mockReturnValue(true);
    (authSpy.getCurrentRole as jest.Mock).mockReturnValue('resident');
    component.ngOnInit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/my-profile']);
  });

  it('redirects to documents on init when already logged in as compliance', () => {
    (authSpy.isLoggedIn as jest.Mock).mockReturnValue(true);
    (authSpy.getCurrentRole as jest.Mock).mockReturnValue('compliance');
    component.ngOnInit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/documents']);
  });

  it('redirects to analytics on init when already logged in as analyst', () => {
    (authSpy.isLoggedIn as jest.Mock).mockReturnValue(true);
    (authSpy.getCurrentRole as jest.Mock).mockReturnValue('analyst');
    component.ngOnInit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/analytics']);
  });

  it('does not redirect when not logged in', () => {
    (authSpy.isLoggedIn as jest.Mock).mockReturnValue(false);
    component.ngOnInit();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('clearError clears the error message', () => {
    component.errorMessage = 'Some error';
    component.clearError();
    expect(component.errorMessage).toBe('');
  });

  it('sets errorMessage on failed login', async () => {
    (authSpy.login as jest.Mock).mockResolvedValue({ success: false, error: 'Bad creds' });
    component.username = 'admin';
    component.password = 'wrong';
    await component.onSubmit();
    expect(component.errorMessage).toBe('Bad creds');
  });

  it('uses fallback error message when error is undefined', async () => {
    (authSpy.login as jest.Mock).mockResolvedValue({ success: false });
    component.username = 'admin';
    component.password = 'wrong';
    await component.onSubmit();
    expect(component.errorMessage).toBe('Invalid username or password');
  });

  it('navigates to /dashboard on successful admin login', async () => {
    (authSpy.login as jest.Mock).mockResolvedValue({ success: true });
    (authSpy.getCurrentRole as jest.Mock).mockReturnValue('admin');
    await component.onSubmit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('navigates to /login when role is unknown after success', async () => {
    (authSpy.login as jest.Mock).mockResolvedValue({ success: true });
    (authSpy.getCurrentRole as jest.Mock).mockReturnValue(null);
    await component.onSubmit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('loading is false after submission completes', async () => {
    (authSpy.login as jest.Mock).mockResolvedValue({ success: false, error: 'err' });
    await component.onSubmit();
    expect(component.loading).toBe(false);
  });

  it('toggles showPassword', () => {
    expect(component.showPassword).toBe(false);
    component.showPassword = true;
    expect(component.showPassword).toBe(true);
  });
});
