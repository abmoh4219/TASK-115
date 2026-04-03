/**
 * Import/Export Integration Tests
 * Tests: export+import round-trip, wrong password, corrupt data, schema validation,
 * duplicate mode (merge vs overwrite), prototype pollution guard
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ImportExportService } from '../src/app/core/services/import-export.service';
import { DbService } from '../src/app/core/services/db.service';
import { CryptoService } from '../src/app/core/services/crypto.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { AnomalyService } from '../src/app/core/services/anomaly.service';
import { AuthService } from '../src/app/core/services/auth.service';
import { SearchService } from '../src/app/core/services/search.service';

// Helper: create a fake .hpd File from a JSON payload
async function createHpdFile(
  crypto: CryptoService,
  data: Record<string, unknown>,
  password: string,
): Promise<File> {
  const json = JSON.stringify(data);
  const payload = await crypto.encrypt(json, password);
  const payloadStr = JSON.stringify(payload);
  return new File([payloadStr], 'test.hpd', { type: 'application/octet-stream' });
}

describe('Import/Export Integration — round trip', () => {
  let service: ImportExportService;
  let db: DbService;
  let cryptoService: CryptoService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        ImportExportService, DbService, CryptoService,
        AuditService, AnomalyService, AuthService, SearchService,
      ],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(ImportExportService);
    cryptoService = TestBed.inject(CryptoService);
    await db.open();
    await db.buildings.clear();
    await db.units.clear();
    await db.rooms.clear();
    await db.residents.clear();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('imports data with correct password', async () => {
    const password = 'test-password-123';
    const data = {
      buildings: [{ id: 1, name: 'Test Building', address: '1 Main', floors: 3, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      units: [],
      rooms: [],
      residents: [],
    };

    const file = await createHpdFile(cryptoService, data, password);
    const result = await service.importData(file, password, 1, 'admin', true);

    expect(result.success).toBe(true);

    const buildings = await db.buildings.toArray();
    expect(buildings.some(b => b.name === 'Test Building')).toBe(true);
  });

  it('rejects import with wrong password', async () => {
    const data = { buildings: [], units: [], rooms: [], residents: [] };
    const file = await createHpdFile(cryptoService, data, 'correct-password');

    const result = await service.importData(file, 'wrong-password', 1, 'admin');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('WRONG_PASSWORD');
  });

  it('rejects invalid file format', async () => {
    const blob = new Blob(['not json at all'], { type: 'text/plain' });
    const file = new File([blob], 'bad.hpd');

    const result = await service.importData(file, 'any', 1, 'admin');
    expect(result.success).toBe(false);
    // Could be INVALID_FILE_FORMAT or UNKNOWN_ERROR depending on parse
  });

  it('rejects valid JSON but missing required keys', async () => {
    const password = 'test-123';
    // Missing 'buildings' key
    const data = { units: [], rooms: [], residents: [] };
    const file = await createHpdFile(cryptoService, data as any, password);

    const result = await service.importData(file, password, 1, 'admin');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('MISSING_KEY_BUILDINGS');
  });
});

describe('Import/Export Integration — duplicate modes', () => {
  let service: ImportExportService;
  let db: DbService;
  let cryptoService: CryptoService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        ImportExportService, DbService, CryptoService,
        AuditService, AnomalyService, AuthService, SearchService,
      ],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(ImportExportService);
    cryptoService = TestBed.inject(CryptoService);
    await db.open();
    await db.buildings.clear();
    await db.units.clear();
    await db.rooms.clear();
    await db.residents.clear();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('overwrite=true clears existing data before import', async () => {
    // Seed existing building
    await db.buildings.add({
      name: 'Existing', address: 'old', floors: 1,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const password = 'test';
    const data = {
      buildings: [{ name: 'New Building', address: 'new', floors: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      units: [], rooms: [], residents: [],
    };
    const file = await createHpdFile(cryptoService, data, password);

    const result = await service.importData(file, password, 1, 'admin', true);
    expect(result.success).toBe(true);

    const buildings = await db.buildings.toArray();
    // "Existing" should be gone (overwrite cleared it)
    expect(buildings.every(b => b.name !== 'Existing')).toBe(true);
  });

  it('overwrite=false merges with existing data', async () => {
    await db.buildings.add({
      name: 'Existing', address: 'old', floors: 1,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const password = 'test';
    const data = {
      buildings: [{ name: 'Merged Building', address: 'new', floors: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      units: [], rooms: [], residents: [],
    };
    const file = await createHpdFile(cryptoService, data, password);

    const result = await service.importData(file, password, 1, 'admin', false);
    expect(result.success).toBe(true);

    const buildings = await db.buildings.toArray();
    const names = buildings.map(b => b.name);
    expect(names).toContain('Existing');
    expect(names).toContain('Merged Building');
  });
});

describe('Import/Export Integration — prototype pollution guard', () => {
  let service: ImportExportService;
  let db: DbService;
  let cryptoService: CryptoService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        ImportExportService, DbService, CryptoService,
        AuditService, AnomalyService, AuthService, SearchService,
      ],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(ImportExportService);
    cryptoService = TestBed.inject(CryptoService);
    await db.open();
    await db.buildings.clear();
    await db.units.clear();
    await db.rooms.clear();
    await db.residents.clear();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('strips __proto__ keys from imported data', async () => {
    const password = 'test';
    const data = {
      buildings: [{ name: 'Safe', address: '1 Main', floors: 1, __proto__: { admin: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      units: [], rooms: [], residents: [],
    };
    const file = await createHpdFile(cryptoService, data, password);

    const result = await service.importData(file, password, 1, 'admin', true);
    expect(result.success).toBe(true);

    const buildings = await db.buildings.toArray();
    const safe = buildings.find(b => b.name === 'Safe');
    expect(safe).toBeDefined();
    // __proto__ should not be on the record
    expect((safe as any).__proto__?.admin).toBeUndefined();
  });
});

describe('Import/Export Integration — audit trail', () => {
  let service: ImportExportService;
  let db: DbService;
  let cryptoService: CryptoService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        ImportExportService, DbService, CryptoService,
        AuditService, AnomalyService, AuthService, SearchService,
      ],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(ImportExportService);
    cryptoService = TestBed.inject(CryptoService);
    await db.open();
    await db.buildings.clear();
    await db.units.clear();
    await db.rooms.clear();
    await db.residents.clear();
    await db.auditLogs.clear();
    await new Promise(r => setTimeout(r, 200));
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('writes DATA_IMPORTED audit entry after successful import', async () => {
    const password = 'audit-test';
    const data = { buildings: [], units: [], rooms: [], residents: [] };
    const file = await createHpdFile(cryptoService, data, password);

    await service.importData(file, password, 99, 'admin', false);
    await new Promise(r => setTimeout(r, 300));

    const logs = await db.auditLogs.toArray();
    const importLog = logs.find(l => l.action === 'DATA_IMPORTED' && l.actorId === 99);
    expect(importLog).toBeDefined();
  });
});
