import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  generateKey,
  hashKey,
  wrapKey,
  unwrapKey,
  getMasterKey,
} from '../../utils/crypto';

const TEST_KEY = 'a'.repeat(64); // 32 bytes hex

describe('encrypt / decrypt', () => {
  it('roundtrip returns original plaintext', () => {
    const plaintext = 'super secret value';
    const payload = encrypt(plaintext, TEST_KEY);
    expect(decrypt(payload, TEST_KEY)).toBe(plaintext);
  });

  it('encrypts empty string', () => {
    const payload = encrypt('', TEST_KEY);
    expect(decrypt(payload, TEST_KEY)).toBe('');
  });

  it('different keys produce different ciphertext', () => {
    const key2 = 'b'.repeat(64);
    const p1 = encrypt('value', TEST_KEY);
    const p2 = encrypt('value', key2);
    expect(p1.encryptedData).not.toBe(p2.encryptedData);
  });

  it('two encryptions of same plaintext produce different IVs', () => {
    const p1 = encrypt('value', TEST_KEY);
    const p2 = encrypt('value', TEST_KEY);
    expect(p1.iv).not.toBe(p2.iv);
  });

  it('tampered ciphertext throws on decrypt', () => {
    const payload = encrypt('value', TEST_KEY);
    const tampered = { ...payload, encryptedData: 'deadbeef' + payload.encryptedData.slice(8) };
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  it('tampered auth tag throws on decrypt', () => {
    const payload = encrypt('value', TEST_KEY);
    const tampered = { ...payload, tag: payload.tag.split('').reverse().join('') };
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  it('wrong key throws on decrypt', () => {
    const payload = encrypt('value', TEST_KEY);
    expect(() => decrypt(payload, 'c'.repeat(64))).toThrow();
  });

  it('encrypt throws on wrong key length', () => {
    expect(() => encrypt('value', 'tooshort')).toThrow(/Encryption key must be/);
  });
});

describe('generateKey', () => {
  it('returns 64-character hex string', () => {
    const key = generateKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns different values each time', () => {
    expect(generateKey()).not.toBe(generateKey());
  });
});

describe('hashKey', () => {
  it('is deterministic for same inputs', () => {
    expect(hashKey('MY_KEY', TEST_KEY)).toBe(hashKey('MY_KEY', TEST_KEY));
  });

  it('different key names produce different hashes', () => {
    expect(hashKey('KEY_A', TEST_KEY)).not.toBe(hashKey('KEY_B', TEST_KEY));
  });

  it('different project keys produce different hashes for same name', () => {
    expect(hashKey('MY_KEY', TEST_KEY)).not.toBe(hashKey('MY_KEY', 'b'.repeat(64)));
  });
});

describe('wrapKey / unwrapKey', () => {
  it('roundtrip returns original project key', () => {
    const projectKey = generateKey();
    const masterKey = TEST_KEY;
    const wrapped = wrapKey(projectKey, masterKey);
    expect(unwrapKey(wrapped, masterKey)).toBe(projectKey);
  });

  it('wrong master key throws on unwrap', () => {
    const projectKey = generateKey();
    const wrapped = wrapKey(projectKey, TEST_KEY);
    expect(() => unwrapKey(wrapped, 'b'.repeat(64))).toThrow();
  });
});

describe('getMasterKey', () => {
  it('returns key from env var', () => {
    process.env.MASTER_ENCRYPTION_KEY = TEST_KEY;
    expect(getMasterKey()).toBe(TEST_KEY);
  });

  it('throws when env var is missing', () => {
    const original = process.env.MASTER_ENCRYPTION_KEY;
    delete process.env.MASTER_ENCRYPTION_KEY;
    expect(() => getMasterKey()).toThrow('MASTER_ENCRYPTION_KEY');
    process.env.MASTER_ENCRYPTION_KEY = original;
  });

  it('throws when env var has wrong length', () => {
    const original = process.env.MASTER_ENCRYPTION_KEY;
    process.env.MASTER_ENCRYPTION_KEY = 'tooshort';
    expect(() => getMasterKey()).toThrow('64 hex characters');
    process.env.MASTER_ENCRYPTION_KEY = original;
  });
});
