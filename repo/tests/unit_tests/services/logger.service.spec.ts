import { TestBed } from '@angular/core/testing';
import { LoggerService } from '../../../src/app/core/services/logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoggerService);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('error() calls console.error', () => {
    service.error('TestCtx', 'Something broke', new Error('boom'));
    expect(console.error).toHaveBeenCalled();
  });

  it('error() with string error', () => {
    service.error('TestCtx', 'msg', 'string error');
    expect(console.error).toHaveBeenCalled();
  });

  it('error() with no error argument', () => {
    service.error('TestCtx', 'msg');
    expect(console.error).toHaveBeenCalled();
  });

  it('warn() calls console.warn', () => {
    service.warn('TestCtx', 'heads up');
    expect(console.warn).toHaveBeenCalled();
  });
});
