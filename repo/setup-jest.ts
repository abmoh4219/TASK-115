import 'jest-preset-angular/setup-jest';

// ── Cross-realm ArrayBuffer fix ──────────────────────────────────────────────
// jsdom runs inside a Node.js vm context.  ALL test code — including the app
// source — executes in that vm context, so `new Uint8Array(...)` creates a
// vm-realm Uint8Array whose `.buffer` is a vm-realm ArrayBuffer.  Node.js
// native WebCrypto (module-realm) rejects vm-realm ArrayBuffers in its
// instanceof checks.
//
// Fix: patch %TypedArray%.prototype.buffer in the vm context so that it
// returns a native Node.js Buffer-backed ArrayBuffer that WebCrypto accepts.
// We get a *module-realm* ArrayBuffer via the Node.js `buffer` module, which
// is always loaded from the true module realm regardless of where require()
// is called from.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _NodeBuffer = (require('node:buffer') as { Buffer: typeof Buffer }).Buffer;
// A Buffer is always a native Uint8Array subclass; its backing store is a
// module-realm ArrayBuffer.  Capture that constructor as the "native" one.
const _NativeArrayBuffer = _NodeBuffer.alloc(1).buffer.constructor as typeof ArrayBuffer;

// 'buffer' is defined on %TypedArray%.prototype (the hidden parent of all typed arrays).
const _typedArrayProto = Object.getPrototypeOf(Uint8Array.prototype) as object;
const _origBufferDesc = Object.getOwnPropertyDescriptor(_typedArrayProto, 'buffer')!;
if (_origBufferDesc) {
  Object.defineProperty(_typedArrayProto, 'buffer', {
    get(this: Uint8Array) {
      const orig: ArrayBuffer = _origBufferDesc.get!.call(this);
      if (orig instanceof _NativeArrayBuffer) return orig; // already module-realm, fast path
      // vm-realm ArrayBuffer: copy bytes into a module-realm ArrayBuffer via Buffer
      const buf = _NodeBuffer.from(this);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
    set: _origBufferDesc.set,
    configurable: true,
    enumerable: _origBufferDesc.enumerable ?? false,
  });
}

// ── Use Node.js native WebCrypto ─────────────────────────────────────────────
// jsdom provides only crypto.getRandomValues; crypto.subtle is absent.
// Assign Node.js 18+ native webcrypto so all SubtleCrypto operations work.
if (typeof globalThis.crypto?.subtle === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { webcrypto } = require('node:crypto') as { webcrypto: Crypto };
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: false,
    configurable: true,
  });
}

// ── Blob/File.arrayBuffer polyfill ───────────────────────────────────────────
// jsdom v20 does not implement Blob.prototype.arrayBuffer.  Polyfill via
// FileReader.  Return a Buffer (native Uint8Array subclass) so that both
// Node.js webcrypto and @peculiar/webcrypto accept it as a TypedArray.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const raw = reader.result as ArrayBuffer;
        resolve(Buffer.from(new Uint8Array(raw)) as unknown as ArrayBuffer);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// ── Blob/File.text polyfill ──────────────────────────────────────────────
// jsdom may not implement Blob.prototype.text; polyfill from arrayBuffer.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// ── structuredClone polyfill ─────────────────────────────────────────────────
// jsdom does not forward the Node.js 17+ structuredClone global.
// Use a pure-JS recursive deep-clone so objects are created in the CURRENT
// realm (avoiding Date/ArrayBuffer cross-realm instanceof failures).
if (typeof globalThis.structuredClone !== 'function') {
  function _deepClone(val: unknown, seen = new Map<unknown, unknown>()): unknown {
    if (val === null || (typeof val !== 'object' && typeof val !== 'function')) return val;
    if (seen.has(val)) return seen.get(val);
    if (val instanceof Date) return new Date((val as Date).getTime());
    if (val instanceof Uint8Array) return new Uint8Array(val as Uint8Array);
    if (val instanceof ArrayBuffer) return (val as ArrayBuffer).slice(0);
    if (Array.isArray(val)) {
      const arr: unknown[] = [];
      seen.set(val, arr);
      for (const item of val as unknown[]) arr.push(_deepClone(item, seen));
      return arr;
    }
    const obj: Record<string, unknown> = {};
    seen.set(val, obj);
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      obj[k] = _deepClone(v, seen);
    }
    return obj;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).structuredClone = <T>(val: T): T => _deepClone(val) as T;
}
