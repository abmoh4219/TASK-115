/**
 * DbService Unit Tests
 * Tests: all stores accessible, seed data present on first run
 *
 * Note: Dexie in jsdom requires a fake IndexedDB implementation.
 * We use 'fake-indexeddb' which is a peer of jest-preset-angular.
 */

// Polyfill fake IndexedDB for Node/jsdom environment
import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';
import { DbService } from '../../src/app/core/services/db.service';

describe('DbService — stores', () => {
  let service: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [DbService] });
    service = TestBed.inject(DbService);
    // Wait for Dexie to be ready and seed to run
    await service.open();
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(async () => {
    await service.close();
    TestBed.resetTestingModule();
  });

  // --------------------------------------------------
  // Store accessibility
  // --------------------------------------------------

  const storeNames = [
    'buildings', 'units', 'rooms', 'occupancies', 'residents',
    'documents', 'messages', 'threads', 'enrollments', 'courses',
    'courseRounds', 'auditLogs', 'searchIndex', 'searchDictionary',
    'consentRecords', 'zeroResultsLog', 'contentPolicies', 'messageTemplates',
  ] as const;

  for (const storeName of storeNames) {
    it(`has accessible store: ${storeName}`, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any)[storeName]).toBeDefined();
    });
  }

  it('all tables support toArray()', async () => {
    for (const storeName of storeNames) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (service as any)[storeName];
      await expect(table.toArray()).resolves.toBeDefined();
    }
  });

  // --------------------------------------------------
  // Seed data
  // --------------------------------------------------

  it('seeds 1 building named "Harbor Tower"', async () => {
    const buildings = await service.buildings.toArray();
    expect(buildings.length).toBe(1);
    expect(buildings[0].name).toBe('Harbor Tower');
  });

  it('seeds 2 units', async () => {
    const units = await service.units.toArray();
    expect(units.length).toBe(2);
  });

  it('seeds 4 rooms', async () => {
    const rooms = await service.rooms.toArray();
    expect(rooms.length).toBe(4);
  });

  it('seeds 4 demo residents', async () => {
    const residents = await service.residents.toArray();
    expect(residents.length).toBe(4);
  });

  it('seeds 1 sample course', async () => {
    const courses = await service.courses.toArray();
    expect(courses.length).toBe(1);
    expect(courses[0].title).toBe('Community Orientation');
  });

  it('seeds 1 course round with future start date', async () => {
    const rounds = await service.courseRounds.toArray();
    expect(rounds.length).toBe(1);
    expect(rounds[0].startAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('seeds 5 search dictionary entries', async () => {
    const dict = await service.searchDictionary.toArray();
    expect(dict.length).toBe(5);
  });

  it('seeds 10 content safety policies', async () => {
    const policies = await service.contentPolicies.toArray();
    expect(policies.length).toBe(10);
  });

  it('does NOT re-seed on subsequent open', async () => {
    // Add a marker, close and reopen — count should remain 1 building
    await service.close();
    const service2 = new DbService();
    await service2.open();
    await new Promise(resolve => setTimeout(resolve, 200));
    const buildings = await service2.buildings.toArray();
    expect(buildings.length).toBe(1); // still 1, not 2
    await service2.close();
  });

  // --------------------------------------------------
  // exportAll
  // --------------------------------------------------

  it('exportAll returns all expected store keys', async () => {
    const snapshot = await service.exportAll();
    const expectedKeys = [
      'buildings', 'units', 'rooms', 'residents',
      'documents', 'messages', 'threads', 'enrollments',
      'courses', 'courseRounds', '_meta',
    ];
    for (const key of expectedKeys) {
      expect(snapshot).toHaveProperty(key);
    }
  });

  it('exportAll includes _meta.version', async () => {
    const snapshot = await service.exportAll();
    expect((snapshot._meta as Record<string, unknown>)['version']).toBe(1);
  });
});
