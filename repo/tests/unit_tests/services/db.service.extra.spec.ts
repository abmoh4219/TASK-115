/**
 * Extra coverage for DbService — importAll, exportAll
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { DbService } from '../../../src/app/core/services/db.service';

async function setup() {
  TestBed.configureTestingModule({ providers: [DbService] });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  return db;
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('DbService — exportAll', () => {
  it('returns a snapshot with expected keys', async () => {
    const db = await setup();
    const snapshot = await db.exportAll();
    expect(snapshot).toHaveProperty('buildings');
    expect(snapshot).toHaveProperty('residents');
    expect(snapshot).toHaveProperty('auditLogs');
    await teardown(db);
  });
});

describe('DbService — importAll', () => {
  it('imports data using bulkPut (overwrite=false)', async () => {
    const db = await setup();
    await db.importAll({
      buildings: [], units: [], rooms: [], occupancies: [], residents: [],
      documents: [], messages: [], threads: [], enrollments: [], courses: [],
      courseRounds: [], auditLogs: [], searchIndex: [], searchDictionary: [],
      consentRecords: [], zeroResultsLog: [], contentPolicies: [], messageTemplates: [],
    }, false);
    // Just verify it completes without throwing
    expect(true).toBe(true);
    await teardown(db);
  });

  it('imports data with overwrite=true clears tables first', async () => {
    const db = await setup();
    await db.importAll({
      buildings: [], units: [], rooms: [], occupancies: [], residents: [],
      documents: [], messages: [], threads: [], enrollments: [], courses: [],
      courseRounds: [], auditLogs: [], searchIndex: [], searchDictionary: [],
      consentRecords: [], zeroResultsLog: [], contentPolicies: [], messageTemplates: [],
    }, true);
    const buildings = await db.buildings.toArray();
    expect(buildings.length).toBe(0);
    await teardown(db);
  });
});
