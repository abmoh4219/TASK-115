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
const LS_CRYPTO_SALT = 'hp_crypto_salt';
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

  private _currentUserId: number | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private activityListeners: (() => void)[] = [];

  private static readonly USER_ID_MAP: Record<string, number> = {
    admin: 1, resident: 2, compliance: 3, analyst: 4,
  };

  constructor(
    private crypto: CryptoService,
    private router: Router,
    private ngZone: NgZone,
  ) {
    this.setupActivityTracking();
  }

  // --------------------------------------------------
  // Username + Password Login
  // --------------------------------------------------

  private static readonly VALID_USERNAMES: Record<string, UserRole> = {
    admin:      'admin',
    resident:   'resident',
    compliance: 'compliance',
    analyst:    'analyst',
  };

  async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    const role = AuthService.VALID_USERNAMES[username.trim().toLowerCase()];
    if (!role) {
      return { success: false, error: 'Invalid username or password' };
    }
    const ok = await this.selectRole(role, password);
    if (!ok) {
      return { success: false, error: 'Invalid username or password' };
    }
    this._currentUserId = AuthService.USER_ID_MAP[role] ?? null;
    return { success: true };
  }

  // --------------------------------------------------
  // Role Selection (internal / re-auth)
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
        try {
          const token = await this.crypto.createValidationToken(password);
          localStorage.setItem(validationKey, JSON.stringify(token));
        } catch {
          // crypto.subtle unavailable (e.g. plain-HTTP test environment) —
          // password was already verified above; skip persisting the token.
        }
      }
    }

    if (!passwordOk) return false;

    // Derive session encryption key from password
    let saltB64 = localStorage.getItem(LS_CRYPTO_SALT);
    let salt: Uint8Array;
    if (saltB64) {
      salt = new Uint8Array(this.crypto.base64ToBuffer(saltB64));
    } else {
      salt = this.crypto.generateSalt();
      saltB64 = this.crypto.bufferToBase64(salt);
      localStorage.setItem(LS_CRYPTO_SALT, saltB64);
    }
    try {
      const sessionKey = await this.crypto.deriveKey(password, salt);
      this.crypto.setSessionKey(sessionKey);
    } catch {
      // crypto.subtle unavailable — session runs without an encryption key.
      this.crypto.setSessionKey(null);
    }

    this._currentUserId = AuthService.USER_ID_MAP[role] ?? null;

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
    this._currentUserId = null;
    this.crypto.setSessionKey(null);
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

  getCurrentUserId(): number | null {
    return this._currentUserId;
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
    this._currentUserId = null;
    this.crypto.setSessionKey(null);
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
