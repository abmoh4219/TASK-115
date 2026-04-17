/**
 * Unit Tests — AnomalyService
 *
 * Tests: recordSearch rate limit (>30/min), recordRegistrationAttempt (>3/10s),
 * anomalyDetected$ emission, reset() clears state.
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AnomalyService, AnomalyEvent } from '../../../src/app/core/services/anomaly.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { DbService } from '../../../src/app/core/services/db.service';

function setup() {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [AnomalyService, AuditService, AuthService, CryptoService, DbService],
  });
  return {
    service: TestBed.inject(AnomalyService),
  };
}

function teardown() {
  TestBed.resetTestingModule();
}

// ──────────────────────────────────────────────────────────────────────────────
// recordSearch — rate limit
// ──────────────────────────────────────────────────────────────────────────────

describe('AnomalyService — recordSearch rate detection', () => {

  it('returns false for searches under the 30/min limit', () => {
    const { service } = setup();
    let flagged = false;
    for (let i = 0; i < 30; i++) {
      if (service.recordSearch()) flagged = true;
    }
    expect(flagged).toBe(false);
    teardown();
  });

  it('returns true and emits anomalyDetected$ when >30 searches in 60s', () => {
    const { service } = setup();
    const events: AnomalyEvent[] = [];
    service.anomalyDetected$.subscribe(e => events.push(e));

    let flagged = false;
    for (let i = 0; i < 32; i++) {
      if (service.recordSearch()) flagged = true;
    }

    expect(flagged).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('search_rate');
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// recordRegistrationAttempt
// ──────────────────────────────────────────────────────────────────────────────

describe('AnomalyService — recordRegistrationAttempt', () => {

  it('returns false for ≤3 attempts on same key within window', () => {
    const { service } = setup();
    const key = 'resident-1-round-42';
    let flagged = false;
    for (let i = 0; i < 3; i++) {
      if (service.recordRegistrationAttempt(key)) flagged = true;
    }
    expect(flagged).toBe(false);
    teardown();
  });

  it('returns true and emits anomalyDetected$ when >3 attempts in 10s for same key', () => {
    const { service } = setup();
    const key = 'resident-2-round-7';
    const events: AnomalyEvent[] = [];
    service.anomalyDetected$.subscribe(e => events.push(e));

    let flagged = false;
    for (let i = 0; i < 5; i++) {
      if (service.recordRegistrationAttempt(key)) flagged = true;
    }

    expect(flagged).toBe(true);
    expect(events.some(e => e.type === 'registration_repeat')).toBe(true);
    teardown();
  });

  it('does NOT flag attempts on different keys independently', () => {
    const { service } = setup();
    let flagged = false;
    // 3 attempts on each of 3 different keys — none should flag
    ['key-A', 'key-B', 'key-C'].forEach(key => {
      for (let i = 0; i < 3; i++) {
        if (service.recordRegistrationAttempt(key)) flagged = true;
      }
    });
    expect(flagged).toBe(false);
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// reset()
// ──────────────────────────────────────────────────────────────────────────────

describe('AnomalyService — reset()', () => {

  it('clears search timestamps so subsequent searches do not flag', () => {
    const { service } = setup();
    // Fill up the window
    for (let i = 0; i < 31; i++) service.recordSearch();
    // reset
    service.reset();
    // After reset, 5 searches should not trigger anomaly
    let flagged = false;
    for (let i = 0; i < 5; i++) {
      if (service.recordSearch()) flagged = true;
    }
    expect(flagged).toBe(false);
    teardown();
  });
});
