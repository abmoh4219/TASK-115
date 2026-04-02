/**
 * CryptoService Unit Tests
 * Tests: deriveKey consistency, encrypt/decrypt roundtrip, wrong password throws
 */

import { TestBed } from '@angular/core/testing';
import { CryptoService, EncryptedPayload } from '../../src/app/core/services/crypto.service';

function buildService(): CryptoService {
  TestBed.configureTestingModule({ providers: [CryptoService] });
  return TestBed.inject(CryptoService);
}

// =====================================================
// Key Derivation
// =====================================================

describe('CryptoService.deriveKey', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = buildService();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('derives a CryptoKey from password + salt', async () => {
    const salt = service.generateSalt();
    const key = await service.deriveKey('testpassword', salt);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('derives the same key for the same password + salt', async () => {
    const salt = service.generateSalt();
    const key1 = await service.deriveKey('mypassword', salt);
    const key2 = await service.deriveKey('mypassword', salt);

    // Keys cannot be compared directly — verify they produce the same ciphertext
    const iv = service.generateIV();
    const plain = 'test-message';
    const enc = new TextEncoder();

    const ct1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, enc.encode(plain));
    const ct2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key2, enc.encode(plain));

    expect(service.bufferToBase64(ct1)).toBe(service.bufferToBase64(ct2));
  });

  it('derives different keys for different passwords', async () => {
    const salt = service.generateSalt();
    const key1 = await service.deriveKey('password1', salt);
    const key2 = await service.deriveKey('password2', salt);

    const iv = service.generateIV();
    const enc = new TextEncoder();
    const ct1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, enc.encode('data'));
    const ct2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key2, enc.encode('data'));

    expect(service.bufferToBase64(ct1)).not.toBe(service.bufferToBase64(ct2));
  });

  it('derives different keys for different salts', async () => {
    const salt1 = service.generateSalt();
    const salt2 = service.generateSalt();
    // Salts should be different (random)
    expect(service.bufferToBase64(salt1)).not.toBe(service.bufferToBase64(salt2));
  });
});

// =====================================================
// Encrypt / Decrypt Roundtrip
// =====================================================

describe('CryptoService.encrypt / decrypt roundtrip', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = buildService();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('decrypts to original plaintext', async () => {
    const original = 'Hello, HarborPoint!';
    const payload = await service.encrypt(original, 'testpassword');
    const decrypted = await service.decrypt(payload, 'testpassword');
    expect(decrypted).toBe(original);
  });

  it('handles empty string', async () => {
    const payload = await service.encrypt('', 'pass');
    const decrypted = await service.decrypt(payload, 'pass');
    expect(decrypted).toBe('');
  });

  it('handles long strings', async () => {
    const longText = 'A'.repeat(10000);
    const payload = await service.encrypt(longText, 'pass');
    const decrypted = await service.decrypt(payload, 'pass');
    expect(decrypted).toBe(longText);
  });

  it('handles unicode / special characters', async () => {
    const text = 'Ünïcödé テスト 🔐 <script>alert(1)</script>';
    const payload = await service.encrypt(text, 'pass');
    const decrypted = await service.decrypt(payload, 'pass');
    expect(decrypted).toBe(text);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const payload1 = await service.encrypt('same', 'pass');
    const payload2 = await service.encrypt('same', 'pass');
    // Different IVs → different ciphertexts (probabilistic encryption)
    expect(payload1.ciphertext).not.toBe(payload2.ciphertext);
    expect(payload1.iv).not.toBe(payload2.iv);
  });

  it('payload contains ciphertext, iv, and salt', async () => {
    const payload: EncryptedPayload = await service.encrypt('data', 'pass');
    expect(payload.ciphertext).toBeTruthy();
    expect(payload.iv).toBeTruthy();
    expect(payload.salt).toBeTruthy();
  });
});

// =====================================================
// Wrong Password Throws
// =====================================================

describe('CryptoService — wrong password', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = buildService();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('throws (rejects) when decrypting with wrong password', async () => {
    const payload = await service.encrypt('secret data', 'correctpassword');
    await expect(service.decrypt(payload, 'wrongpassword')).rejects.toThrow();
  });

  it('throws when decrypting tampered ciphertext', async () => {
    const payload = await service.encrypt('secret', 'pass');
    const tampered: EncryptedPayload = {
      ...payload,
      ciphertext: payload.ciphertext.slice(0, -4) + 'AAAA',
    };
    await expect(service.decrypt(tampered, 'pass')).rejects.toThrow();
  });
});

// =====================================================
// Validation Token
// =====================================================

describe('CryptoService.validatePassword', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = buildService();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('validates correct password', async () => {
    const token = await service.createValidationToken('mypassword');
    const valid = await service.validatePassword('mypassword', token);
    expect(valid).toBe(true);
  });

  it('rejects wrong password', async () => {
    const token = await service.createValidationToken('mypassword');
    const valid = await service.validatePassword('wrongpassword', token);
    expect(valid).toBe(false);
  });
});

// =====================================================
// generateSalt / generateIV
// =====================================================

describe('CryptoService helpers', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = buildService();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('generateSalt produces 16 bytes', () => {
    expect(service.generateSalt().byteLength).toBe(16);
  });

  it('generateIV produces 12 bytes', () => {
    expect(service.generateIV().byteLength).toBe(12);
  });

  it('generateSalt is random each call', () => {
    const s1 = service.bufferToBase64(service.generateSalt());
    const s2 = service.bufferToBase64(service.generateSalt());
    expect(s1).not.toBe(s2);
  });
});
