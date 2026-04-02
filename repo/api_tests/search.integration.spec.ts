/**
 * Search Integration Tests
 * Tests: full-text, facets, zero-results log
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { SearchService } from '../src/app/core/services/search.service';
import { DbService } from '../src/app/core/services/db.service';
import { AnomalyService } from '../src/app/core/services/anomaly.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { AuthService } from '../src/app/core/services/auth.service';
import { CryptoService } from '../src/app/core/services/crypto.service';

async function seedIndex(db: DbService): Promise<void> {
  const now = new Date();
  await db.searchIndex.bulkAdd([
    {
      entityType: 'resident', entityId: 1,
      title: 'John Smith', body: 'Active resident in Harbor Tower',
      tags: ['active', 'resident'], metadata: {}, building: 'Harbor Tower',
      category: 'resident', createdAt: now,
    },
    {
      entityType: 'course', entityId: 1,
      title: 'Community Orientation', body: 'Welcome orientation for new residents',
      tags: ['orientation', 'welcome'], metadata: {}, building: 'Harbor Tower',
      category: 'course', createdAt: now,
    },
    {
      entityType: 'document', entityId: 1,
      title: 'Lease Agreement', body: 'Signed lease agreement for unit 101',
      tags: ['lease', 'document'], metadata: { mimeType: 'application/pdf' },
      building: 'Harbor Tower', category: 'document', createdAt: now,
    },
  ]);
}

describe('Search Integration — full-text', () => {
  let service: SearchService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [SearchService, DbService, AnomalyService, AuditService, AuthService, CryptoService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(SearchService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
    await seedIndex(db);
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('finds a resident by name', async () => {
    const results = await service.search('John Smith');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.entityType).toBe('resident');
  });

  it('finds a course by keyword', async () => {
    const results = await service.search('orientation');
    expect(results.some(r => r.entry.entityType === 'course')).toBe(true);
  });

  it('returns empty array for no matches', async () => {
    const results = await service.search('xyznonexistent123');
    expect(results.length).toBe(0);
  });

  it('logs zero-results query', async () => {
    await service.search('zzznomatch999');
    const log = await service.getZeroResultsReport();
    expect(log.some(l => l.query === 'zzznomatch999')).toBe(true);
  });
});

describe('Search Integration — facets', () => {
  let service: SearchService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [SearchService, DbService, AnomalyService, AuditService, AuthService, CryptoService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(SearchService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
    await seedIndex(db);
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('filters by category', async () => {
    const results = await service.search('resident', { category: 'resident' });
    expect(results.every(r => r.entry.category === 'resident')).toBe(true);
  });

  it('filters by building', async () => {
    const results = await service.search('community', { building: 'Harbor Tower' });
    expect(results.every(r => r.entry.building === 'Harbor Tower')).toBe(true);
  });

  it('filters by date range excludes entries outside range', async () => {
    const pastFrom = new Date(Date.now() + 999999 * 1000); // far in future
    const results = await service.search('resident', { from: pastFrom });
    expect(results.length).toBe(0);
  });
});

describe('Search Integration — synonym expansion', () => {
  let service: SearchService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [SearchService, DbService, AnomalyService, AuditService, AuthService, CryptoService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(SearchService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
    await seedIndex(db);
    // Seed data includes 'resident' → synonyms: ['tenant', 'occupant', 'renter']
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('finds results using synonym (tenant → resident)', async () => {
    // The word 'tenant' is a synonym for 'resident' in the search dictionary
    const results = await service.search('tenant');
    // Should find entries containing 'resident' via synonym expansion
    expect(results.length).toBeGreaterThan(0);
  });
});
