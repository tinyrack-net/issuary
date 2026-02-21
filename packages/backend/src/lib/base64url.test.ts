import { describe, expect, test } from 'vitest';
import {
  bytesToHex,
  bytesToString,
  concatBytes,
  fromBase64Url,
  getRandomBytes,
  hexToBytes,
  stringToBytes,
  toArrayBuffer,
  toBase64Url,
} from './base64url.js';

describe('toBase64Url / fromBase64Url', () => {
  test('should encode empty array', () => {
    expect(toBase64Url(new Uint8Array([]))).toBe('');
  });

  test('should decode empty string', () => {
    expect(fromBase64Url('')).toEqual(new Uint8Array([]));
  });

  test('should encode known ASCII bytes', () => {
    // "Hello" = [72, 101, 108, 108, 111]
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    expect(toBase64Url(bytes)).toBe('SGVsbG8');
  });

  test('should roundtrip arbitrary bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const encoded = toBase64Url(original);
    const decoded = fromBase64Url(encoded);
    expect(decoded).toEqual(original);
  });

  test('should produce URL-safe characters only', () => {
    // bytes that produce +, /, and = in standard base64
    const bytes = new Uint8Array([251, 255, 254, 253]);
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  test('should decode base64url with - and _ characters', () => {
    // "Hello" in base64url is "SGVsbG8"
    // Manually craft a value that uses - and _
    const bytes = new Uint8Array([251, 239]);
    const encoded = toBase64Url(bytes);
    const decoded = fromBase64Url(encoded);
    expect(decoded).toEqual(bytes);
  });

  test('should roundtrip large random data', () => {
    const original = getRandomBytes(256);
    const encoded = toBase64Url(original);
    const decoded = fromBase64Url(encoded);
    expect(decoded).toEqual(original);
  });
});

describe('stringToBytes / bytesToString', () => {
  test('should encode empty string', () => {
    expect(stringToBytes('')).toEqual(new Uint8Array([]));
  });

  test('should decode empty bytes', () => {
    expect(bytesToString(new Uint8Array([]))).toBe('');
  });

  test('should roundtrip ASCII string', () => {
    const original = 'Hello, World!';
    const bytes = stringToBytes(original);
    expect(bytesToString(bytes)).toBe(original);
  });

  test('should handle multibyte UTF-8 characters', () => {
    const original = '한글テスト🎉';
    const bytes = stringToBytes(original);
    expect(bytesToString(bytes)).toBe(original);
  });
});

describe('hexToBytes / bytesToHex', () => {
  test('should convert known hex to bytes', () => {
    // "Hello" = 48656c6c6f
    expect(hexToBytes('48656c6c6f')).toEqual(
      new Uint8Array([72, 101, 108, 108, 111]),
    );
  });

  test('should convert bytes to hex with zero padding', () => {
    // 0x0a should be "0a" not "a"
    expect(bytesToHex(new Uint8Array([10]))).toBe('0a');
  });

  test('should handle empty input', () => {
    expect(hexToBytes('')).toEqual(new Uint8Array([]));
    expect(bytesToHex(new Uint8Array([]))).toBe('');
  });

  test('should roundtrip random bytes', () => {
    const original = getRandomBytes(32);
    const hex = bytesToHex(original);
    expect(hexToBytes(hex)).toEqual(original);
  });

  test('should produce lowercase hex', () => {
    const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
    expect(bytesToHex(bytes)).toBe('abcdef');
  });
});

describe('concatBytes', () => {
  test('should concatenate two arrays', () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4]);
    expect(concatBytes(a, b)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  test('should handle empty arrays', () => {
    const a = new Uint8Array([1, 2]);
    const empty = new Uint8Array([]);
    expect(concatBytes(a, empty)).toEqual(a);
    expect(concatBytes(empty, a)).toEqual(a);
  });

  test('should concatenate three or more arrays', () => {
    const a = new Uint8Array([1]);
    const b = new Uint8Array([2]);
    const c = new Uint8Array([3]);
    expect(concatBytes(a, b, c)).toEqual(new Uint8Array([1, 2, 3]));
  });

  test('should handle single array', () => {
    const a = new Uint8Array([1, 2, 3]);
    expect(concatBytes(a)).toEqual(a);
  });

  test('should handle no arguments', () => {
    expect(concatBytes()).toEqual(new Uint8Array([]));
  });
});

describe('getRandomBytes', () => {
  test('should return correct length', () => {
    expect(getRandomBytes(16).length).toBe(16);
    expect(getRandomBytes(32).length).toBe(32);
    expect(getRandomBytes(0).length).toBe(0);
  });

  test('should produce different output on each call', () => {
    const a = getRandomBytes(32);
    const b = getRandomBytes(32);
    // Extremely unlikely to be equal for 32 random bytes
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });
});

describe('toArrayBuffer', () => {
  test('should return ArrayBuffer with same content', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const buffer = toArrayBuffer(bytes);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBe(4);
    expect(new Uint8Array(buffer)).toEqual(bytes);
  });

  test('should handle empty input', () => {
    const buffer = toArrayBuffer(new Uint8Array([]));
    expect(buffer.byteLength).toBe(0);
  });

  test('should return a copy, not the same buffer', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const buffer = toArrayBuffer(bytes);
    // Modifying the original should not affect the copy
    bytes[0] = 99;
    expect(new Uint8Array(buffer)[0]).toBe(1);
  });
});
