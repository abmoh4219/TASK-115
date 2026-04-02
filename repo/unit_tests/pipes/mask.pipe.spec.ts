/**
 * MaskPipe Unit Tests
 * Covers all edge cases for phone/email redaction.
 */

import { MaskPipe, maskContent } from '../../src/app/shared/pipes/mask.pipe';

describe('MaskPipe', () => {
  let pipe: MaskPipe;

  beforeEach(() => {
    pipe = new MaskPipe();
  });

  // --------------------------------------------------
  // Instance
  // --------------------------------------------------

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  // --------------------------------------------------
  // Null / undefined / empty
  // --------------------------------------------------

  it('returns empty string for null', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(pipe.transform('')).toBe('');
  });

  // --------------------------------------------------
  // Phone redaction
  // --------------------------------------------------

  it('redacts US phone with dashes (555-867-5309)', () => {
    const result = pipe.transform('Call 555-867-5309 for info');
    expect(result).not.toContain('555-867-5309');
    expect(result).toContain('[PHONE REDACTED]');
    expect(result).toContain('Call');
    expect(result).toContain('for info');
  });

  it('redacts US phone with dots (555.123.4567)', () => {
    const result = pipe.transform('Number: 555.123.4567');
    expect(result).toContain('[PHONE REDACTED]');
    expect(result).not.toContain('555.123.4567');
  });

  it('redacts US phone with parentheses ((555) 123-4567)', () => {
    const result = pipe.transform('Phone: (555) 123-4567');
    expect(result).toContain('[PHONE REDACTED]');
  });

  it('redacts international phone (+1 555 867 5309)', () => {
    const result = pipe.transform('International: +1 555 867 5309');
    expect(result).toContain('[PHONE REDACTED]');
  });

  it('does not redact short number strings (e.g. unit 101)', () => {
    // "101" is too short to match — 8+ digits required
    const result = pipe.transform('Unit 101');
    expect(result).toBe('Unit 101');
  });

  // --------------------------------------------------
  // Email redaction
  // --------------------------------------------------

  it('redacts standard email address', () => {
    const result = pipe.transform('Email: john.doe@example.com');
    expect(result).not.toContain('john.doe@example.com');
    expect(result).toContain('[EMAIL REDACTED]');
  });

  it('redacts email with subdomains', () => {
    const result = pipe.transform('Contact admin@mail.harborpoint.local');
    expect(result).toContain('[EMAIL REDACTED]');
    expect(result).not.toContain('admin@mail.harborpoint.local');
  });

  it('redacts email with plus addressing (user+tag@example.com)', () => {
    const result = pipe.transform('Send to user+tag@example.com');
    expect(result).toContain('[EMAIL REDACTED]');
  });

  // --------------------------------------------------
  // Combined
  // --------------------------------------------------

  it('redacts both phone and email in same message', () => {
    const msg = 'Phone: +1 (555) 123-4567, email: test@example.com. See you soon.';
    const result = pipe.transform(msg);
    expect(result).toContain('[PHONE REDACTED]');
    expect(result).toContain('[EMAIL REDACTED]');
    expect(result).toContain('See you soon.');
    expect(result).not.toContain('555');
    expect(result).not.toContain('test@example.com');
  });

  // --------------------------------------------------
  // Clean text
  // --------------------------------------------------

  it('leaves clean text unchanged', () => {
    const clean = 'Welcome to HarborPoint! Please check in at the front desk.';
    expect(pipe.transform(clean)).toBe(clean);
  });

  it('preserves surrounding context text', () => {
    const result = pipe.transform('Hi, my number is 555-999-8888 — please call soon.');
    expect(result).toContain('Hi, my number is');
    expect(result).toContain('[PHONE REDACTED]');
    expect(result).toContain('please call soon.');
  });

  // --------------------------------------------------
  // maskContent function (standalone export)
  // --------------------------------------------------

  it('maskContent function redacts phone', () => {
    expect(maskContent('555-867-5309')).toContain('[PHONE REDACTED]');
  });

  it('maskContent function redacts email', () => {
    expect(maskContent('a@b.com')).toContain('[EMAIL REDACTED]');
  });

  it('maskContent function returns clean text unchanged', () => {
    expect(maskContent('Hello world')).toBe('Hello world');
  });
});
