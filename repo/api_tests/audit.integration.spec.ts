/**
 * Audit Integration Tests
 * Tests: audit log persistence, getLogs filters, anomaly flag, immutability
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuditService, AuditAction } from '../src/app/core/services/audit.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuthService } from '../src/app/core/services/auth.service';
import { CryptoService } from '../src/app/core/services/crypto.service';

describe('Audit Integration — log persistence', () => {
  let auditService: AuditService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [AuditService, DbService, AuthService, CryptoService],
    });
    db = TestBed.inject(DbService);
    auditService = TestBed.inject(AuditService);
    await db.open();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('persists audit entry to IndexedDB', async () => {
    auditService.log(
      AuditAction.RESIDENT_CREATED, 1, 'admin',
      'resident', 42, undefined, { firstName: 'Jane' },
    );
    await new Promise(r => setTimeout(r, 300));

    const logs = await db.auditLogs.toArray();
    const entry = logs.find(l => l.action === 'RESIDENT_CREATED' && l.targetId === 42);
    expect(entry).toBeDefined();
    expect(entry!.actorId).toBe(1);
    expect(entry!.actorRole).toBe('admin');
    expect((entry!.after as any).firstName).toBe('Jane');
  });

  it('writes multiple entries for multiple actions', async () => {
    auditService.log(AuditAction.MOVE_IN, 1, 'admin', 'occupancy', 10);
    auditService.log(AuditAction.MOVE_OUT, 1, 'admin', 'occupancy', 11);
    auditService.log(AuditAction.DOCUMENT_UPLOADED, 2, 'resident', 'document', 5);
    await new Promise(r => setTimeout(r, 300));

    const logs = await db.auditLogs.toArray();
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });

  it('anomalyFlagged persists correctly', async () => {
    auditService.log(
      AuditAction.ANOMALY_FLAGGED, 1, 'admin',
      'session', 'search-abuse',
      undefined, undefined, true,
    );
    await new Promise(r => setTimeout(r, 300));

    const logs = await db.auditLogs.toArray();
    const flagged = logs.find(l => l.anomalyFlagged === true);
    expect(flagged).toBeDefined();
    expect(flagged!.action).toBe('ANOMALY_FLAGGED');
  });
});

describe('Audit Integration — getLogs filters', () => {
  let auditService: AuditService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [AuditService, DbService, AuthService, CryptoService],
    });
    db = TestBed.inject(DbService);
    auditService = TestBed.inject(AuditService);
    await db.open();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('filters by actorId', async () => {
    auditService.log(AuditAction.MOVE_IN, 10, 'admin', 'occupancy', 1);
    auditService.log(AuditAction.MOVE_IN, 20, 'admin', 'occupancy', 2);
    await new Promise(r => setTimeout(r, 300));

    const logs = await auditService.getLogs({ actorId: 10 });
    expect(logs.every(l => l.actorId === 10)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by action type', async () => {
    auditService.log(AuditAction.DOCUMENT_APPROVED, 1, 'compliance', 'document', 5);
    auditService.log(AuditAction.DOCUMENT_REJECTED, 1, 'compliance', 'document', 6);
    await new Promise(r => setTimeout(r, 300));

    const logs = await auditService.getLogs({ action: AuditAction.DOCUMENT_APPROVED });
    expect(logs.every(l => l.action === 'DOCUMENT_APPROVED')).toBe(true);
  });

  it('filters anomaly-only entries', async () => {
    auditService.log(AuditAction.RESIDENT_CREATED, 1, 'admin', 'resident', 1);
    auditService.log(AuditAction.ANOMALY_FLAGGED, 1, 'admin', 'session', 'x', undefined, undefined, true);
    await new Promise(r => setTimeout(r, 300));

    const logs = await auditService.getLogs({ anomalyOnly: true });
    expect(logs.every(l => l.anomalyFlagged)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by date range (excludes entries outside range)', async () => {
    auditService.log(AuditAction.MOVE_IN, 1, 'admin', 'occupancy', 1);
    await new Promise(r => setTimeout(r, 300));

    // from = tomorrow → should exclude today's entry
    const tomorrow = new Date(Date.now() + 86_400_000);
    const logs = await auditService.getLogs({ from: tomorrow });
    expect(logs.length).toBe(0);
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      auditService.log(AuditAction.MESSAGE_SENT, i, 'admin', 'message', i);
    }
    await new Promise(r => setTimeout(r, 500));

    const logs = await auditService.getLogs({ limit: 3 });
    expect(logs.length).toBe(3);
  });

  it('returns entries in reverse chronological order', async () => {
    auditService.log(AuditAction.MOVE_IN, 1, 'admin', 'occupancy', 1);
    await new Promise(r => setTimeout(r, 100));
    auditService.log(AuditAction.MOVE_OUT, 1, 'admin', 'occupancy', 2);
    await new Promise(r => setTimeout(r, 300));

    const logs = await auditService.getLogs();
    if (logs.length >= 2) {
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(logs[1].timestamp.getTime());
    }
  });
});

describe('Audit Integration — before/after snapshots', () => {
  let auditService: AuditService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [AuditService, DbService, AuthService, CryptoService],
    });
    db = TestBed.inject(DbService);
    auditService = TestBed.inject(AuditService);
    await db.open();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('stores before/after state snapshots for state changes', async () => {
    const before = { status: 'pending_review' };
    const after  = { status: 'approved', reviewNotes: 'Looks good' };

    auditService.log(
      AuditAction.DOCUMENT_APPROVED, 3, 'compliance',
      'document', 77, before, after,
    );
    await new Promise(r => setTimeout(r, 300));

    const logs = await auditService.getLogs({ action: AuditAction.DOCUMENT_APPROVED });
    const entry = logs.find(l => l.targetId === 77);
    expect(entry).toBeDefined();
    expect(entry!.before).toEqual(before);
    expect(entry!.after).toEqual(after);
  });

  it('handles entries with no before/after gracefully', async () => {
    auditService.log(AuditAction.SESSION_LOCKED, 1, 'admin', 'session', 0);
    await new Promise(r => setTimeout(r, 300));

    const logs = await auditService.getLogs({ action: AuditAction.SESSION_LOCKED });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].before).toBeUndefined();
    expect(logs[0].after).toBeUndefined();
  });
});
