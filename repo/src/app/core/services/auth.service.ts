import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { CryptoService, EncryptedPayload } from './crypto.service';

// =====================================================
// Auth Types
// =====================================================

export type UserRole = 'admin' | 'resident' | 'compliance' | 'analyst';

export interface RoleCredentials {
  admin:      string;
  resident:   string;
  compliance: string;
  analyst:    string;
}

export interface AuthState {
  role:        UserRole | null;
  isLocked:    boolean;
  isLoggedIn:  boolean;
}

// =====================================================
// AuthService
// In-memory session only — role NEVER written to LocalStorage
// for security enforcement. Only hp_last_role (UX hint) stored.
// =====================================================

const DEFAULT_PASSWORDS: RoleCredentials = {
  admin:      'harborpoint2024',
  resident:   'harborpoint2024',
  compliance: 'harborpoint2024',
  analyst:    'harborpoint2024',
};

const LS_LAST_ROLE = 'hp_last_role';
const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

// Validation token storage key (stores encrypted test payload)
const LS_VALIDATION_PREFIX = 'hp_vt_';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {

  private _state$ = new BehaviorSubject<AuthState>({
    role: null,
    isLocked: false,
    isLoggedIn: false,
  });

  readonly state$: Observable<AuthState> = this._state$.asObservable();

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private activityListeners: (() => void)[] = [];

  constructor(
    private crypto: CryptoService,
    private router: Router,
    private ngZone: NgZone,
  ) {
    this.setupActivityTracking();
  }

  // --------------------------------------------------
  // Role Selection & Login
  // --------------------------------------------------

  async selectRole(role: UserRole, password: string): Promise<boolean> {
    const validationKey = LS_VALIDATION_PREFIX + role;
    const stored = localStorage.getItem(validationKey);

    let passwordOk = false;

    if (stored) {
      // Validate against existing encrypted token
      try {
        const payload: EncryptedPayload = JSON.parse(stored);
        passwordOk = await this.crypto.validatePassword(password, payload);
      } catch {
        passwordOk = false;
      }
    } else {
      // First run: check against default password, then store validation token
      passwordOk = password === DEFAULT_PASSWORDS[role];
      if (passwordOk) {
        const token = await this.crypto.createValidationToken(password);
        localStorage.setItem(validationKey, JSON.stringify(token));
      }
    }

    if (!passwordOk) return false;

    // Persist UX hint only (not used for guard checks)
    localStorage.setItem(LS_LAST_ROLE, role);

    this._state$.next({
      role,
      isLocked: false,
      isLoggedIn: true,
    });

    this.resetInactivityTimer();
    return true;
  }

  // --------------------------------------------------
  // Session Lock
  // --------------------------------------------------

  lockSession(): void {
    this._state$.next({
      role: this._state$.value.role,
      isLocked: true,
      isLoggedIn: false,
    });
    this.clearInactivityTimer();
    this.router.navigate(['/login']);
  }

  // --------------------------------------------------
  // Re-authentication (for anomaly re-auth modal)
  // --------------------------------------------------

  async reAuthenticate(password: string): Promise<boolean> {
    const role = this._state$.value.role;
    if (!role) return false;
    return this.selectRole(role, password);
  }

  // --------------------------------------------------
  // Role Checks — used in guards and service methods
  // --------------------------------------------------

  hasRole(role: UserRole): boolean {
    const state = this._state$.value;
    return state.isLoggedIn && !state.isLocked && state.role === role;
  }

  hasAnyRole(...roles: UserRole[]): boolean {
    const state = this._state$.value;
    return state.isLoggedIn && !state.isLocked && state.role !== null && roles.includes(state.role);
  }

  getCurrentRole(): UserRole | null {
    return this._state$.value.role;
  }

  isLoggedIn(): boolean {
    return this._state$.value.isLoggedIn && !this._state$.value.isLocked;
  }

  // --------------------------------------------------
  // UX Helpers
  // --------------------------------------------------

  getLastRole(): UserRole | null {
    const stored = localStorage.getItem(LS_LAST_ROLE);
    if (stored && ['admin', 'resident', 'compliance', 'analyst'].includes(stored)) {
      return stored as UserRole;
    }
    return null;
  }

  logout(): void {
    this._state$.next({ role: null, isLocked: false, isLoggedIn: false });
    this.clearInactivityTimer();
    this.router.navigate(['/login']);
  }

  // --------------------------------------------------
  // Inactivity Timer
  // --------------------------------------------------

  private setupActivityTracking(): void {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => this.ngZone.run(() => this.resetInactivityTimer());

    this.ngZone.runOutsideAngular(() => {
      for (const event of events) {
        document.addEventListener(event, handler, { passive: true });
        this.activityListeners.push(() =>
          document.removeEventListener(event, handler),
        );
      }
    });
  }

  resetInactivityTimer(): void {
    this.clearInactivityTimer();
    if (!this._state$.value.isLoggedIn) return;

    this.inactivityTimer = setTimeout(() => {
      this.ngZone.run(() => this.lockSession());
    }, INACTIVITY_MS);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  getInactivityTimer(): ReturnType<typeof setTimeout> | null {
    return this.inactivityTimer;
  }

  // --------------------------------------------------
  // Password Change
  // --------------------------------------------------

  async changePassword(role: UserRole, currentPassword: string, newPassword: string): Promise<boolean> {
    const validationKey = LS_VALIDATION_PREFIX + role;
    const stored = localStorage.getItem(validationKey);

    let currentOk = false;
    if (stored) {
      const payload: EncryptedPayload = JSON.parse(stored);
      currentOk = await this.crypto.validatePassword(currentPassword, payload);
    } else {
      currentOk = currentPassword === DEFAULT_PASSWORDS[role];
    }

    if (!currentOk) return false;

    const newToken = await this.crypto.createValidationToken(newPassword);
    localStorage.setItem(validationKey, JSON.stringify(newToken));
    return true;
  }

  ngOnDestroy(): void {
    this.clearInactivityTimer();
    this.activityListeners.forEach(fn => fn());
  }
}
