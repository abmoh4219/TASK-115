/**
 * AuditService Unit Tests
 * Tests: only INSERT (never UPDATE/DELETE), anomalyFlagged written correctly
 */

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AuditService, AuditAction } from '../../../src/app/core/services/audit.service';
import { DbService } from '../../../src/app/core/services/db.service';

// Mock the DbService to control what happens
class MockAuditTable {
  private records: Array<Record<string, unknown>> = [];
  addCalls = 0;
  updateCalls = 0;
  deleteCalls = 0;

  add(record: Record<string, unknown>): Promise<number> {
    this.addCalls++;
    this.records.push({ ...record, id: this.records.length + 1 });
    return Promise.resolve(this.records.length);
  }

  update(..._args: unknown[]): Promise<unknown> {
    this.updateCalls++;
    return Promise.resolve(null);
  }

  delete(..._args: unknown[]): Promise<void> {
    this.deleteCalls++;
    return Promise.resolve();
  }

  getAll(): Array<Record<string, unknown>> {
    return this.records;
  }

  orderBy(_: string) {
    return {
      reverse: () => ({
        toArray: () => Promise.resolve([...this.records].reverse()),
      }),
    };
  }

  toArray(): Promise<Array<Record<string, unknown>>> {
    return Promise.resolve(this.records);
  }
}

class MockDbService {
  auditLogs = new MockAuditTable();
}

// =====================================================
// APPEND-ONLY enforcement
// =====================================================

describe('AuditService — APPEND-ONLY', () => {
  let service: AuditService;
  let mockDb: MockDbService;

  beforeEach(() => {
    mockDb = new MockDbService();

    TestBed.configureTestingModule({
      providers: [
        AuditService,
        { provide: DbService, useValue: mockDb },
      ],
    });

    service = TestBed.inject(AuditService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('only calls db.auditLogs.add() — never update or delete', fakeAsync(() => {
    service.log(AuditAction.RESIDENT_CREATED, 1, 'admin', 'resident', 42);
    service.log(AuditAction.DOCUMENT_APPROVED, 1, 'compliance', 'document', 10);

    // Let async fire-and-forget settle
    tick(100);

    expect(mockDb.auditLogs.addCalls).toBe(2);
    expect(mockDb.auditLogs.updateCalls).toBe(0);
    expect(mockDb.auditLogs.deleteCalls).toBe(0);
  }));

  it('does not await — returns void synchronously', () => {
    const result = service.log(AuditAction.MESSAGE_SENT, 2, 'resident', 'message', 5);
    expect(result).toBeUndefined();
  });
});

// =====================================================
// anomalyFlagged written correctly
// =====================================================

describe('AuditService — anomalyFlagged field', () => {
  let service: AuditService;
  let mockDb: MockDbService;

  beforeEach(() => {
    mockDb = new MockDbService();

    TestBed.configureTestingModule({
      providers: [
        AuditService,
        { provide: DbService, useValue: mockDb },
      ],
    });

    service = TestBed.inject(AuditService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('writes anomalyFlagged=false by default', fakeAsync(async () => {
    service.log(AuditAction.RESIDENT_CREATED, 1, 'admin', 'resident', 1);
    tick(100);

    const records = mockDb.auditLogs.getAll();
    expect(records[0]['anomalyFlagged']).toBe(false);
  }));

  it('writes anomalyFlagged=true when passed', fakeAsync(() => {
    service.log(
      AuditAction.ANOMALY_FLAGGED,
      1, 'admin', 'session', 'anomaly',
      undefined, undefined, true,
    );
    tick(100);

    const records = mockDb.auditLogs.getAll();
    expect(records[0]['anomalyFlagged']).toBe(true);
  }));

  it('writes correct action string', fakeAsync(() => {
    service.log(AuditAction.MOVE_IN, 3, 'admin', 'occupancy', 7);
    tick(100);

    const records = mockDb.auditLogs.getAll();
    expect(records[0]['action']).toBe('MOVE_IN');
  }));

  it('writes before/after snapshots', fakeAsync(() => {
    const before = { status: 'pending_review' };
    const after  = { status: 'approved' };
    service.log(AuditAction.DOCUMENT_APPROVED, 2, 'compliance', 'document', 99, before, after);
    tick(100);

    const records = mockDb.auditLogs.getAll();
    expect(records[0]['before']).toEqual(before);
    expect(records[0]['after']).toEqual(after);
  }));

  it('writes timestamp close to now', fakeAsync(() => {
    const before = Date.now();
    service.log(AuditAction.SESSION_LOCKED, 1, 'admin', 'session', 0);
    tick(100);

    const records = mockDb.auditLogs.getAll();
    const ts = records[0]['timestamp'] as Date;
    expect(ts.getTime()).toBeGreaterThanOrEqual(before);
    expect(ts.getTime()).toBeLessThanOrEqual(Date.now());
  }));
});

// =====================================================
// getLogs filter
// =====================================================

describe('AuditService — getLogs filter', () => {
  let service: AuditService;
  let mockDb: MockDbService;

  beforeEach(() => {
    mockDb = new MockDbService();

    TestBed.configureTestingModule({
      providers: [
        AuditService,
        { provide: DbService, useValue: mockDb },
      ],
    });

    service = TestBed.inject(AuditService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('filters by actorId', fakeAsync(async () => {
    service.log(AuditAction.MOVE_IN, 10, 'admin', 'occupancy', 1);
    service.log(AuditAction.MOVE_IN, 20, 'admin', 'occupancy', 2);
    tick(100);

    const logs = await service.getLogs({ actorId: 10 });
    expect(logs.length).toBe(1);
    expect(logs[0].actorId).toBe(10);
  }));

  it('filters by action', fakeAsync(async () => {
    service.log(AuditAction.MOVE_IN, 1, 'admin', 'occupancy', 1);
    service.log(AuditAction.DOCUMENT_APPROVED, 1, 'compliance', 'document', 2);
    tick(100);

    const logs = await service.getLogs({ action: AuditAction.DOCUMENT_APPROVED });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('DOCUMENT_APPROVED');
  }));

  it('filters anomaly-only', fakeAsync(async () => {
    service.log(AuditAction.RESIDENT_CREATED, 1, 'admin', 'resident', 1, undefined, undefined, false);
    service.log(AuditAction.ANOMALY_FLAGGED, 1, 'admin', 'session', 'a', undefined, undefined, true);
    tick(100);

    const logs = await service.getLogs({ anomalyOnly: true });
    expect(logs.length).toBe(1);
    expect(logs[0].anomalyFlagged).toBe(true);
  }));

  it('filters by date range', fakeAsync(async () => {
    service.log(AuditAction.MOVE_IN, 1, 'admin', 'occupancy', 1);
    tick(100);

    const future = new Date(Date.now() + 86_400_000);
    const logs = await service.getLogs({ from: future });
    expect(logs.length).toBe(0);
  }));

  it('respects limit', fakeAsync(async () => {
    for (let i = 0; i < 10; i++) {
      service.log(AuditAction.MESSAGE_SENT, i, 'admin', 'message', i);
    }
    tick(100);

    const logs = await service.getLogs({ limit: 3 });
    expect(logs.length).toBe(3);
  }));
});

// =====================================================
// Enum values
// =====================================================

describe('AuditAction enum', () => {
  it('has all required action values', () => {
    const required = [
      'RESIDENT_CREATED', 'RESIDENT_UPDATED',
      'DOCUMENT_UPLOADED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED',
      'CONSENT_GRANTED', 'CONSENT_REVOKED',
      'MESSAGE_SENT', 'MESSAGE_DELETED', 'MESSAGE_ADMIN_ACCESS',
      'ENROLLMENT_CREATED', 'WAITLIST_ADDED', 'ENROLLMENT_DROPPED', 'WAITLIST_PROMOTED',
      'MOVE_IN', 'MOVE_OUT',
      'RULE_CHANGED', 'DATA_EXPORTED', 'DATA_IMPORTED',
      'ANOMALY_FLAGGED', 'SESSION_LOCKED',
    ];
    for (const action of required) {
      // context: AuditAction.${action}
      expect(AuditAction[action as keyof typeof AuditAction]).toBe(action);
    }
  });
});
