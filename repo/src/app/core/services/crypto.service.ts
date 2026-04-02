import { Injectable } from '@angular/core';

// =====================================================
// CryptoService — AES-GCM + PBKDF2
// All crypto runs entirely in the browser via Web Crypto API.
// The derived key is NEVER persisted — only re-derived on each use.
// =====================================================

export interface EncryptedPayload {
  ciphertext: string;   // base64
  iv: string;           // base64 (12 bytes)
  salt: string;         // base64 (16 bytes) — used for key derivation
}

@Injectable({ providedIn: 'root' })
export class CryptoService {

  private readonly PBKDF2_ITERATIONS = 100_000;
  private readonly SALT_BYTES = 16;
  private readonly IV_BYTES = 12;

  // --------------------------------------------------
  // Key Derivation — PBKDF2 SHA-256
  // --------------------------------------------------

  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  // --------------------------------------------------
  // Salt / IV Generation
  // --------------------------------------------------

  generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.SALT_BYTES));
  }

  generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.IV_BYTES));
  }

  // --------------------------------------------------
  // Encrypt — AES-GCM 256-bit
  // Returns a self-contained payload with ciphertext, iv, salt (all base64).
  // --------------------------------------------------

  async encrypt(plaintext: string, password: string): Promise<EncryptedPayload> {
    const salt = this.generateSalt();
    const iv   = this.generateIV();
    const key  = await this.deriveKey(password, salt);

    const enc = new TextEncoder();
    const ciphertextBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext),
    );

    return {
      ciphertext: this.bufferToBase64(ciphertextBuf),
      iv:         this.bufferToBase64(iv),
      salt:       this.bufferToBase64(salt),
    };
  }

  // --------------------------------------------------
  // Decrypt — AES-GCM
  // Throws DOMException if password is wrong or data is tampered.
  // --------------------------------------------------

  async decrypt(payload: EncryptedPayload, password: string): Promise<string> {
    const salt       = this.base64ToBuffer(payload.salt);
    const iv         = this.base64ToBuffer(payload.iv);
    const ciphertext = this.base64ToBuffer(payload.ciphertext);

    const key = await this.deriveKey(password, new Uint8Array(salt));

    const plaintextBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      ciphertext,
    );

    const dec = new TextDecoder();
    return dec.decode(plaintextBuf);
  }

  // --------------------------------------------------
  // encryptRaw / decryptRaw — for encrypting a string
  // with a pre-derived CryptoKey (no password re-derivation)
  // --------------------------------------------------

  async encryptRaw(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
    const iv  = this.generateIV();
    const enc = new TextEncoder();
    const ciphertextBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext),
    );
    return {
      ciphertext: this.bufferToBase64(ciphertextBuf),
      iv:         this.bufferToBase64(iv),
    };
  }

  async decryptRaw(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
    const ivBuf  = this.base64ToBuffer(iv);
    const ctBuf  = this.base64ToBuffer(ciphertext);
    const ptBuf  = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuf) },
      key,
      ctBuf,
    );
    return new TextDecoder().decode(ptBuf);
  }

  // --------------------------------------------------
  // Password Validation
  // Used on session re-auth: tries to decrypt the stored test cipher.
  // Throws if password is wrong.
  // --------------------------------------------------

  async validatePassword(password: string, testPayload: EncryptedPayload): Promise<boolean> {
    try {
      const result = await this.decrypt(testPayload, password);
      return result === 'harborpoint-validation-token';
    } catch {
      return false;
    }
  }

  // --------------------------------------------------
  // First-Setup: create the validation token payload
  // --------------------------------------------------

  async createValidationToken(password: string): Promise<EncryptedPayload> {
    return this.encrypt('harborpoint-validation-token', password);
  }

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Compute SHA-256 hash of a file (for document.fileHash before encryption)
  async hashFile(data: ArrayBuffer): Promise<string> {
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return this.bufferToBase64(hashBuf);
  }
}
