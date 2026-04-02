import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { AuditAction, AuditService } from './audit.service';
import { AuthService } from './auth.service';

export interface AnomalyEvent {
  type: 'search_rate' | 'registration_repeat';
  actorId: number;
  detail: string;
}

// =====================================================
// AnomalyService — sliding-window rate detection
//
// Rules (per CLAUDE.md):
//   - >30 searches in 60 s  → ANOMALY_FLAGGED audit + emit anomalyDetected$
//   - >3 registration attempts for same course in 10 s → emit anomalyDetected$
//   - reset() called on session lock
// =====================================================

@Injectable({ providedIn: 'root' })
export class AnomalyService {

  private searchTimestamps: number[] = [];
  private registrationAttempts = new Map<string, number[]>();

  private readonly SEARCH_LIMIT      = 30;
  private readonly SEARCH_WINDOW_MS  = 60_000;
  private readonly REG_WINDOW_MS     = 10_000;
  private readonly REG_LIMIT         = 3;   // flag when > 3 attempts in window

  readonly anomalyDetected$ = new Subject<AnomalyEvent>();

  constructor(
    private audit: AuditService,
    private auth:  AuthService,
  ) {}

  // --------------------------------------------------
  // Search rate detection
  // Call on every search event.
  // Returns true if anomaly was flagged (caller shows re-auth modal).
  // --------------------------------------------------

  recordSearch(): boolean {
    const now = Date.now();
    this.searchTimestamps = this.searchTimestamps.filter(
      t => now - t < this.SEARCH_WINDOW_MS,
    );
    this.searchTimestamps.push(now);

    if (this.searchTimestamps.length > this.SEARCH_LIMIT) {
      const actorId   = this.getActorId();
      const actorRole = this.auth.getCurrentRole() ?? 'unknown';

      this.audit.log(
        AuditAction.ANOMALY_FLAGGED,
        actorId,
        actorRole,
        'search',
        'session',
        undefined,
        { count: this.searchTimestamps.length, windowMs: this.SEARCH_WINDOW_MS },
        true,
      );

      this.anomalyDetected$.next({
        type:    'search_rate',
        actorId,
        detail:  `${this.searchTimestamps.length} searches in 60 seconds`,
      });

      return true;
    }
    return false;
  }

  // --------------------------------------------------
  // Repeated registration detection
  // Call with a unique key (e.g. `${residentId}-${roundId}`).
  // Returns true if anomaly flagged.
  // --------------------------------------------------

  recordRegistrationAttempt(key: string): boolean {
    const now = Date.now();
    const attempts = (this.registrationAttempts.get(key) ?? [])
      .filter(t => now - t < this.REG_WINDOW_MS);
    attempts.push(now);
    this.registrationAttempts.set(key, attempts);

    if (attempts.length > this.REG_LIMIT) {
      const actorId   = this.getActorId();
      const actorRole = this.auth.getCurrentRole() ?? 'unknown';

      this.audit.log(
        AuditAction.ANOMALY_FLAGGED,
        actorId,
        actorRole,
        'enrollment',
        key,
        undefined,
        { attempts: attempts.length, windowMs: this.REG_WINDOW_MS },
        true,
      );

      this.anomalyDetected$.next({
        type:    'registration_repeat',
        actorId,
        detail:  `${attempts.length} registration attempts in 10 seconds for key ${key}`,
      });

      return true;
    }
    return false;
  }

  // --------------------------------------------------
  // Reset all tracking — called on session lock
  // --------------------------------------------------

  reset(): void {
    this.searchTimestamps = [];
    this.registrationAttempts.clear();
  }

  // Legacy aliases (keep callers from older phases working)
  trackSearch(): boolean { return this.recordSearch(); }
  trackRegistrationAttempt(key: string): boolean { return this.recordRegistrationAttempt(key); }
  resetSearchTracking(): void { this.reset(); }

  private getActorId(): number {
    return 0; // session-level sentinel; real ID resolved at call-sites in auth-aware contexts
  }
}
