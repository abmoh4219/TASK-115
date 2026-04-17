import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { ImportExportService } from '../../../src/app/core/services/import-export.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { SearchService } from '../../../src/app/core/services/search.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';

function makeServices(roleOverride = 'admin') {
  const dbSpy = {
    exportAll: jest.fn().mockResolvedValue({ residents: [], buildings: [] }),
    importAll: jest.fn().mockResolvedValue(undefined),
    searchIndex: { toArray: jest.fn().mockResolvedValue([]) },
  } as any;

  const cryptoSpy = {
    encrypt: jest.fn().mockResolvedValue({ ciphertext: 'ct', iv: 'iv', salt: 'salt' }),
    decrypt: jest.fn().mockResolvedValue('{"residents":[],"buildings":[]}'),
  } as any;

  const auditSpy = { log: jest.fn() } as any;

  const authSpy = {
    getCurrentRole: jest.fn().mockReturnValue(roleOverride),
    getCurrentUserId: jest.fn().mockReturnValue(1),
    isLoggedIn: jest.fn().mockReturnValue(true),
  } as any;

  const searchSpy = { rebuildIndex: jest.fn().mockResolvedValue(undefined) } as any;
  const loggerSpy = { error: jest.fn(), warn: jest.fn() } as any;

  return { dbSpy, cryptoSpy, auditSpy, authSpy, searchSpy, loggerSpy };
}

describe('ImportExportService', () => {
  let service: ImportExportService;

  beforeEach(() => {
    const { dbSpy, cryptoSpy, auditSpy, authSpy, searchSpy, loggerSpy } = makeServices();

    TestBed.configureTestingModule({
      providers: [
        ImportExportService,
        { provide: DbService,      useValue: dbSpy },
        { provide: CryptoService,  useValue: cryptoSpy },
        { provide: AuditService,   useValue: auditSpy },
        { provide: AuthService,    useValue: authSpy },
        { provide: SearchService,  useValue: searchSpy },
        { provide: LoggerService,  useValue: loggerSpy },
      ],
    });
    service = TestBed.inject(ImportExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('exportData calls encrypt and audit log', async () => {
    const crypto = TestBed.inject(CryptoService) as any;
    const audit  = TestBed.inject(AuditService) as any;
    // Mock URL.createObjectURL (used by file-saver) for jsdom
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = jest.fn().mockReturnValue('blob:mock');
    URL.revokeObjectURL = jest.fn();
    try {
      await service.exportData('mypassword');
    } catch { /* saveAs DOM interaction may still fail - that's OK */ }
    expect(crypto.encrypt).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalled();
    URL.createObjectURL = origCreate;
  });

  it('exportData throws when not admin', async () => {
    const { dbSpy, cryptoSpy, auditSpy, authSpy, searchSpy, loggerSpy } = makeServices('resident');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ImportExportService,
        { provide: DbService,      useValue: dbSpy },
        { provide: CryptoService,  useValue: cryptoSpy },
        { provide: AuditService,   useValue: auditSpy },
        { provide: AuthService,    useValue: authSpy },
        { provide: SearchService,  useValue: searchSpy },
        { provide: LoggerService,  useValue: loggerSpy },
      ],
    });
    const svc = TestBed.inject(ImportExportService);
    await expect(svc.exportData('pass')).rejects.toThrow('Unauthorized');
  });

  it('importData returns INVALID_FILE_FORMAT for missing fields', async () => {
    const file = new File(['{"no":"fields"}'], 'test.hpd');
    const result = await service.importData(file, 'pass');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('INVALID_FILE_FORMAT');
  });

  it('importData returns WRONG_PASSWORD when decrypt fails', async () => {
    const crypto = TestBed.inject(CryptoService) as any;
    (crypto.decrypt as jest.Mock).mockRejectedValueOnce(new Error('bad key'));
    const payload = JSON.stringify({ ciphertext: 'c', iv: 'i', salt: 's' });
    const file = new File([payload], 'test.hpd');
    const result = await service.importData(file, 'wrongpass');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('WRONG_PASSWORD');
  });

  it('importData returns CORRUPT_DATA when decrypted JSON is invalid', async () => {
    const crypto = TestBed.inject(CryptoService) as any;
    (crypto.decrypt as jest.Mock).mockResolvedValueOnce('not valid json {{{');
    const payload = JSON.stringify({ ciphertext: 'c', iv: 'i', salt: 's' });
    const file = new File([payload], 'test.hpd');
    const result = await service.importData(file, 'pass');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('CORRUPT_DATA');
  });

  it('importData succeeds with valid full snapshot', async () => {
    const crypto = TestBed.inject(CryptoService) as any;
    const db     = TestBed.inject(DbService) as any;

    const validSnapshot = JSON.stringify({
      buildings: [], units: [], rooms: [], occupancies: [], residents: [],
      documents: [], messages: [], threads: [], enrollments: [], courses: [],
      courseRounds: [], auditLogs: [], searchIndex: [], searchDictionary: [],
      consentRecords: [], zeroResultsLog: [], contentPolicies: [], messageTemplates: [],
    });
    (crypto.decrypt as jest.Mock).mockResolvedValueOnce(validSnapshot);
    db.importAll = jest.fn().mockResolvedValue(undefined);

    const payload = JSON.stringify({ ciphertext: 'c', iv: 'i', salt: 's' });
    const file = new File([payload], 'test.hpd');
    const result = await service.importData(file, 'pass', true);
    expect(result.success).toBe(true);
  });

  it('importData returns INVALID_SHAPE error for bad residents', async () => {
    const crypto = TestBed.inject(CryptoService) as any;

    const badSnapshot = JSON.stringify({
      buildings: [], units: [], rooms: [], occupancies: [],
      residents: [{ invalid: true }], // missing required fields
      documents: [], messages: [], threads: [], enrollments: [], courses: [],
      courseRounds: [], auditLogs: [], searchIndex: [], searchDictionary: [],
      consentRecords: [], zeroResultsLog: [], contentPolicies: [], messageTemplates: [],
    });
    (crypto.decrypt as jest.Mock).mockResolvedValueOnce(badSnapshot);
    const payload = JSON.stringify({ ciphertext: 'c', iv: 'i', salt: 's' });
    const file = new File([payload], 'test.hpd');
    const result = await service.importData(file, 'pass');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('INVALID_SHAPE_RESIDENTS');
  });

  it('importData throws when not admin', async () => {
    const { dbSpy, cryptoSpy, auditSpy, authSpy, searchSpy, loggerSpy } = makeServices('compliance');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ImportExportService,
        { provide: DbService,      useValue: dbSpy },
        { provide: CryptoService,  useValue: cryptoSpy },
        { provide: AuditService,   useValue: auditSpy },
        { provide: AuthService,    useValue: authSpy },
        { provide: SearchService,  useValue: searchSpy },
        { provide: LoggerService,  useValue: loggerSpy },
      ],
    });
    const svc = TestBed.inject(ImportExportService);
    const file = new File(['{}'], 'test.hpd');
    await expect(svc.importData(file, 'pass')).rejects.toThrow('Unauthorized');
  });
});
