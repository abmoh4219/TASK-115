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
// AnomalyService
// Detects:
//   - >30 searches per minute per session → flag + require re-auth
//   - Repeated registration attempts within 10s for same course → flag
// =====================================================

@Injectable({ providedIn: 'root' })
export class AnomalyService {

  private searchTimestamps: number[] = [];
  private registrationAttempts = new Map<string, number[]>();

  private readonly SEARCH_LIMIT      = 30;
  private readonly SEARCH_WINDOW_MS  = 60_000;
  private readonly REG_WINDOW_MS     = 10_000;
  private readonly REG_REPEAT_LIMIT  = 2;

  readonly anomalyDetected$ = new Subject<AnomalyEvent>();

  constructor(
    private audit: AuditService,
    private auth: AuthService,
  ) {}

  // --------------------------------------------------
  // Search Rate Detection
  // Call on every search event.
  // Returns true if anomaly was flagged (caller must show re-auth modal).
  // --------------------------------------------------

  trackSearch(): boolean {
    const now = Date.now();
    this.searchTimestamps = this.searchTimestamps.filter(
      t => now - t < this.SEARCH_WINDOW_MS,
    );
    this.searchTimestamps.push(now);

    if (this.searchTimestamps.length > this.SEARCH_LIMIT) {
      const actorId = this.getActorId();
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
        type: 'search_rate',
        actorId,
        detail: `${this.searchTimestamps.length} searches in 60 seconds`,
      });

      return true;
    }
    return false;
  }

  // --------------------------------------------------
  // Repeated Registration Detection
  // Call with a unique key (e.g. `${residentId}-${roundId}`).
  // Returns true if anomaly flagged.
  // --------------------------------------------------

  trackRegistrationAttempt(key: string): boolean {
    const now = Date.now();
    const attempts = (this.registrationAttempts.get(key) ?? [])
      .filter(t => now - t < this.REG_WINDOW_MS);
    attempts.push(now);
    this.registrationAttempts.set(key, attempts);

    if (attempts.length >= this.REG_REPEAT_LIMIT) {
      const actorId = this.getActorId();
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
        type: 'registration_repeat',
        actorId,
        detail: `${attempts.length} registration attempts in 10 seconds for key ${key}`,
      });

      return true;
    }
    return false;
  }

  resetSearchTracking(): void {
    this.searchTimestamps = [];
  }

  private getActorId(): number {
    // Actor IDs are resolved by the caller in full implementations.
    // Using 0 as sentinel for session-level anomalies.
    return 0;
  }
}
