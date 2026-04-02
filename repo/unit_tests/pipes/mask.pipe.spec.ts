/**
 * MaskPipe Unit Tests
 */

import { MaskPipe } from '../../src/app/shared/pipes/mask.pipe';

describe('MaskPipe', () => {
  let pipe: MaskPipe;

  beforeEach(() => {
    pipe = new MaskPipe();
  });

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('returns empty string for null', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('redacts US phone number (dashes)', () => {
    const result = pipe.transform('Call 555-867-5309 now');
    expect(result).not.toContain('555-867-5309');
    expect(result).toContain('[PHONE REDACTED]');
  });

  it('redacts US phone number (dots)', () => {
    const result = pipe.transform('My number is 555.123.4567');
    expect(result).toContain('[PHONE REDACTED]');
  });

  it('redacts email address', () => {
    const result = pipe.transform('Email: test.user@example.com please');
    expect(result).not.toContain('test.user@example.com');
    expect(result).toContain('[EMAIL REDACTED]');
  });

  it('redacts both phone and email', () => {
    const result = pipe.transform('Phone: 555-100-2000, email: a@b.com');
    expect(result).toContain('[PHONE REDACTED]');
    expect(result).toContain('[EMAIL REDACTED]');
  });

  it('leaves clean text unchanged', () => {
    const clean = 'Hello, welcome to HarborPoint!';
    expect(pipe.transform(clean)).toBe(clean);
  });

  it('preserves surrounding text', () => {
    const result = pipe.transform('Contact us: 555-999-8888 or visit in person');
    expect(result).toContain('Contact us:');
    expect(result).toContain('or visit in person');
  });
});
