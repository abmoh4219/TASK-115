/**
 * Unit Tests — SearchService
 *
 * Tests: search returns results, zero-results log, synonym expansion,
 * dictionary management (add/update/get).
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SearchService } from '../../src/app/core/services/search.service';
import { DbService } from '../../src/app/core/services/db.service';
import { AnomalyService } from '../../src/app/core/services/anomaly.service';
import { AuditService } from '../../src/app/core/services/audit.service';
import { AuthService } from '../../src/app/core/services/auth.service';
import { CryptoService } from '../../src/app/core/services/crypto.service';

async function setup() {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [SearchService, DbService, AnomalyService, AuditService, AuthService, CryptoService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  return {
    service: TestBed.inject(SearchService),
    db,
  };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

async function seedIndex(db: DbService): Promise<void> {
  const now = new Date();
  await db.searchIndex.bulkAdd([
    {
      entityType: 'resident', entityId: 1,
      title: 'Alice Johnson', body: 'Active resident in Harbor Tower',
      tags: ['resident', 'active'], metadata: {}, building: 'Harbor Tower',
      category: 'resident', createdAt: now,
    },
    {
      entityType: 'course', entityId: 2,
      title: 'Community Orientation', body: 'Welcome session for new members',
      tags: ['orientation'], metadata: {}, building: 'Harbor Tower',
      category: 'course', createdAt: now,
    },
  ]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Basic search
// ──────────────────────────────────────────────────────────────────────────────

describe('SearchService — basic search', () => {

  it('returns matching results for a known keyword', async () => {
    const { service, db } = await setup();
    await seedIndex(db);

    const results = await service.search('Alice');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.entityType).toBe('resident');

    await teardown(db);
  });

  it('logs zero-results query to the DB', async () => {
    const { service, db } = await setup();
    await seedIndex(db);

    await service.search('xyzquerywithnomatch999');

    const log = await service.getZeroResultsReport();
    expect(log.some(l => l.query === 'xyzquerywithnomatch999')).toBe(true);

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Synonym expansion
// ──────────────────────────────────────────────────────────────────────────────

describe('SearchService — synonym expansion', () => {

  it('finds results using a synonym term', async () => {
    const { service, db } = await setup();
    await seedIndex(db);

    // Seed dictionary: "resident" has synonym "tenant"
    await db.searchDictionary.add({ term: 'resident', synonyms: ['tenant'], corrections: [] });

    // Searching "tenant" should expand to include "resident" and find Alice
    const results = await service.search('tenant');
    expect(results.length).toBeGreaterThan(0);

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Dictionary management
// ──────────────────────────────────────────────────────────────────────────────

describe('SearchService — dictionary management', () => {

  it('addDictionaryEntry stores and getDictionary retrieves it', async () => {
    const { service, db } = await setup();

    const entry = await service.addDictionaryEntry({
      term: 'occupant', synonyms: ['resident', 'tenant'], corrections: ['ocupant'],
    });

    expect(entry.id).toBeDefined();
    expect(entry.term).toBe('occupant');
    expect(entry.synonyms).toContain('resident');

    const dict = await service.getDictionary();
    expect(dict.some(d => d.term === 'occupant')).toBe(true);

    await teardown(db);
  });

  it('updateDictionaryEntry modifies synonyms', async () => {
    const { service, db } = await setup();

    const entry = await service.addDictionaryEntry({
      term: 'unit', synonyms: ['room'], corrections: [],
    });

    await service.updateDictionaryEntry(entry.id!, { synonyms: ['room', 'apartment', 'suite'] });

    const updated = await db.searchDictionary.get(entry.id!);
    expect(updated!.synonyms).toContain('apartment');
    expect(updated!.synonyms).toContain('suite');

    await teardown(db);
  });
});
