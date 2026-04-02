/**
 * Unit Tests — ResidentService
 *
 * Tests: createResident (encrypt ID, audit), getResidents (filters),
 * getResident, updateResident (warns on inactive + active occupancy),
 * getChangeLog, searchResidents.
 *
 * Uses fake-indexeddb + Web Crypto (available in jsdom via @peculiar/webcrypto shim).
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';

import { ResidentService } from '../../src/app/core/services/resident.service';
import { DbService } from '../../src/app/core/services/db.service';
import { AuditService } from '../../src/app/core/services/audit.service';
import { CryptoService } from '../../src/app/core/services/crypto.service';
import { PropertyService } from '../../src/app/core/services/property.service';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function setup() {
  TestBed.configureTestingModule({
    providers: [ResidentService, DbService, AuditService, CryptoService, PropertyService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  return {
    service:  TestBed.inject(ResidentService),
    property: TestBed.inject(PropertyService),
    db,
  };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

const BASE_DATA = {
  firstName:   'Jane',
  lastName:    'Doe',
  email:       'jane@hp.local',
  phone:       '555-0100',
  dateOfBirth: new Date('1985-06-15'),
  status:      'active' as const,
};

// ──────────────────────────────────────────────────────────────────────────────
// createResident
// ──────────────────────────────────────────────────────────────────────────────

describe('ResidentService — createResident', () => {

  it('stores resident with correct fields and returns an id', async () => {
    const { service, db } = await setup();

    const r = await service.createResident(BASE_DATA, 1, 'admin');

    expect(r.id).toBeDefined();
    expect(r.firstName).toBe('Jane');
    expect(r.lastName).toBe('Doe');
    expect(r.email).toBe('jane@hp.local');
    expect(r.status).toBe('active');
    expect(r.notes).toEqual([]);
    expect(r.consentGiven).toBe(false);
    expect(r.createdAt).toBeInstanceOf(Date);

    await teardown(db);
  });

  it('stores encryptedId in ciphertext.iv format', async () => {
    const { service, db } = await setup();

    const r = await service.createResident(BASE_DATA, 1, 'admin');

    // Format: base64chars.base64chars
    expect(r.encryptedId).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);

    await teardown(db);
  });

  it('writes an audit log entry with encryptedId masked', async () => {
    const { service, db } = await setup();

    const r = await service.createResident(BASE_DATA, 1, 'admin');

    const logs = await db.auditLogs
      .filter(l => l.targetType === 'resident' && Number(l.targetId) === r.id)
      .toArray();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const log = logs[0];
    expect(log.action).toBe('RESIDENT_CREATED');
    // encryptedId must not appear in the after snapshot
    expect(JSON.stringify(log.after)).not.toContain(r.encryptedId);
    expect(JSON.stringify(log.after)).toContain('[ENCRYPTED]');

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getResidents — filters
// ──────────────────────────────────────────────────────────────────────────────

describe('ResidentService — getResidents filters', () => {

  it('returns all residents when no filters provided', async () => {
    const { service, db } = await setup();

    await service.createResident(BASE_DATA, 1, 'admin');
    await service.createResident({ ...BASE_DATA, firstName: 'Bob', email: 'bob@hp.local', status: 'inactive' }, 1, 'admin');

    const all = await service.getResidents();
    expect(all.length).toBeGreaterThanOrEqual(2);

    await teardown(db);
  });

  it('filters by status', async () => {
    const { service, db } = await setup();

    await service.createResident({ ...BASE_DATA, email: 'r1@hp.local', status: 'active' }, 1, 'admin');
    await service.createResident({ ...BASE_DATA, email: 'r2@hp.local', status: 'inactive' }, 1, 'admin');

    const active = await service.getResidents({ status: ['active'] });
    for (const r of active) {
      expect(r.status).toBe('active');
    }

    await teardown(db);
  });

  it('filters by search query (name and email)', async () => {
    const { service, db } = await setup();

    await service.createResident({ ...BASE_DATA, firstName: 'Alice', email: 'alice@hp.local' }, 1, 'admin');
    await service.createResident({ ...BASE_DATA, firstName: 'Charlie', email: 'charlie@hp.local' }, 1, 'admin');

    const results = await service.getResidents({ search: 'alice' });
    expect(results.some(r => r.firstName === 'Alice')).toBe(true);
    expect(results.every(r => r.email.includes('alice') || r.firstName.toLowerCase().includes('alice') || r.lastName.toLowerCase().includes('alice'))).toBe(true);

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// updateResident — warn on inactive + active occupancy
// ──────────────────────────────────────────────────────────────────────────────

describe('ResidentService — updateResident', () => {

  it('updates fields and returns the updated resident', async () => {
    const { service, db } = await setup();

    const r = await service.createResident(BASE_DATA, 1, 'admin');
    const { resident: updated } = await service.updateResident(
      r.id!, { firstName: 'Janet' }, 1, 'admin',
    );

    expect(updated.firstName).toBe('Janet');
    expect(updated.id).toBe(r.id);

    await teardown(db);
  });

  it('returns a warning when setting inactive with active occupancy', async () => {
    const { service, property, db } = await setup();

    const r = await service.createResident(BASE_DATA, 1, 'admin');

    // Create an active occupancy for this resident
    await db.occupancies.add({
      residentId:    r.id!,
      roomId:        1,
      effectiveFrom: new Date(),
      reasonCode:    'MOVE_IN_NEW',
      status:        'active',
      createdAt:     new Date(),
    });

    const { warnings } = await service.updateResident(
      r.id!, { status: 'inactive' }, 1, 'admin',
    );

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('active room assignment');

    await teardown(db);
  });

  it('writes an audit log with before/after snapshots', async () => {
    const { service, db } = await setup();

    const r = await service.createResident(BASE_DATA, 1, 'admin');
    await service.updateResident(r.id!, { lastName: 'Smith' }, 1, 'admin');

    const logs = await db.auditLogs
      .filter(l => l.action === 'RESIDENT_UPDATED' && Number(l.targetId) === r.id)
      .toArray();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const log = logs[0];
    expect((log.before as Record<string, unknown>)?.['lastName']).toBe('Doe');
    expect((log.after  as Record<string, unknown>)?.['lastName']).toBe('Smith');

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getChangeLog
// ──────────────────────────────────────────────────────────────────────────────

describe('ResidentService — getChangeLog', () => {

  it('returns audit entries for the resident sorted descending', async () => {
    const { service, db } = await setup();

    const r = await service.createResident(BASE_DATA, 1, 'admin');
    await service.updateResident(r.id!, { phone: '555-9999' }, 1, 'admin');

    const log = await service.getChangeLog(r.id!);

    expect(log.length).toBeGreaterThanOrEqual(2);
    // Sorted descending: most recent first
    for (let i = 0; i < log.length - 1; i++) {
      expect(new Date(log[i].timestamp).getTime())
        .toBeGreaterThanOrEqual(new Date(log[i + 1].timestamp).getTime());
    }

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// searchResidents
// ──────────────────────────────────────────────────────────────────────────────

describe('ResidentService — searchResidents', () => {

  it('returns empty array for blank query', async () => {
    const { service, db } = await setup();

    const results = await service.searchResidents('   ');
    expect(results).toEqual([]);

    await teardown(db);
  });

  it('finds by partial phone number', async () => {
    const { service, db } = await setup();

    await service.createResident({ ...BASE_DATA, phone: '555-1234', email: 'ph@hp.local' }, 1, 'admin');

    const results = await service.searchResidents('1234');
    expect(results.some(r => r.phone.includes('1234'))).toBe(true);

    await teardown(db);
  });
});
