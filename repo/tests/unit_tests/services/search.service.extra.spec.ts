/**
 * Extra coverage for SearchService — getFacets, getTrendingTerms, getZeroResultsReport,
 * indexEntity, reindexEntity, removeFromIndex, rebuildAllEntities, getSpellSuggestion
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { SearchService } from '../../../src/app/core/services/search.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';

async function setup() {
  TestBed.configureTestingModule({
    providers: [SearchService, DbService, AuthService, AnomalyService, LoggerService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 200));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  const service = TestBed.inject(SearchService);
  await service.buildIndex();
  return { service, db };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('SearchService — getFacets', () => {
  it('returns facet data with entityTypes', async () => {
    const { service, db } = await setup();
    const facets = await service.getFacets();
    expect(facets).toBeDefined();
    expect(facets).toHaveProperty('categories');
    expect(facets).toHaveProperty('buildings');
    await teardown(db);
  });
});

describe('SearchService — getTrendingTerms', () => {
  it('returns array of trending terms', async () => {
    const { service, db } = await setup();
    const terms = await service.getTrendingTerms();
    expect(Array.isArray(terms)).toBe(true);
    await teardown(db);
  });

  it('respects the limit parameter', async () => {
    const { service, db } = await setup();
    const terms = await service.getTrendingTerms(5);
    expect(terms.length).toBeLessThanOrEqual(5);
    await teardown(db);
  });
});

describe('SearchService — getZeroResultsReport', () => {
  it('returns an array of zero-result queries', async () => {
    const { service, db } = await setup();
    const report = await service.getZeroResultsReport();
    expect(Array.isArray(report)).toBe(true);
    await teardown(db);
  });
});

describe('SearchService — indexEntity and removeFromIndex', () => {
  it('adds an entry to the search index', async () => {
    const { service, db } = await setup();
    await service.indexEntity({
      entityType: 'resident',
      entityId: 999,
      title: 'Test resident', body: 'for search', tags: [],
      metadata: {}, createdAt: new Date(),
    });
    const entries = await db.searchIndex.where('entityId').equals(999).toArray();
    expect(entries.length).toBeGreaterThan(0);
    await teardown(db);
  });

  it('removes entries from the search index', async () => {
    const { service, db } = await setup();
    await service.indexEntity({
      entityType: 'resident',
      entityId: 998,
      title: 'Removable', body: 'entry', tags: [],
      metadata: {}, createdAt: new Date(),
    });
    await service.removeFromIndex('resident', 998);
    const entries = await db.searchIndex.where('entityId').equals(998).toArray();
    expect(entries.length).toBe(0);
    await teardown(db);
  });
});

describe('SearchService — reindexEntity', () => {
  it('updates an existing index entry', async () => {
    const { service, db } = await setup();
    await service.indexEntity({
      entityType: 'resident',
      entityId: 997,
      title: 'Original', body: 'text', tags: [],
      metadata: {}, createdAt: new Date(),
    });
    await service.reindexEntity({
      entityType: 'resident',
      entityId: 997,
      title: 'Updated', body: 'text', tags: [],
      metadata: {}, createdAt: new Date(),
    });
    const entries = await db.searchIndex.where('entityId').equals(997).toArray();
    expect(entries[0].title).toContain('Updated');
    await teardown(db);
  });
});

describe('SearchService — getSpellSuggestion', () => {
  it('returns null or string for a query', async () => {
    const { service, db } = await setup();
    const suggestion = await service.getSpellSuggestion('resdient');
    expect(suggestion === null || typeof suggestion === 'string').toBe(true);
    await teardown(db);
  });
});

describe('SearchService — rebuildAllEntities', () => {
  it('completes without throwing', async () => {
    const { service, db } = await setup();
    await expect(service.rebuildAllEntities()).resolves.not.toThrow();
    await teardown(db);
  });
});

describe('SearchService — search', () => {
  it('returns search results array', async () => {
    const { service, db } = await setup();
    const results = await service.search('harbor');
    expect(Array.isArray(results)).toBe(true);
    await teardown(db);
  });

  it('empty query returns empty results', async () => {
    const { service, db } = await setup();
    const results = await service.search('');
    expect(results.length).toBe(0);
    await teardown(db);
  });
});
