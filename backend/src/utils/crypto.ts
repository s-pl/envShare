/**
 * Cryptographic utilities for envShare
 * All secrets are encrypted using AES-256-GCM with per-secret IVs.
 *
 * Architecture:
 *   Master Key (env var, never stored) → encrypts Project Keys
 *   Project Key (stored encrypted) → encrypts individual Secrets
 */
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits

export interface EncryptedPayload {
  encryptedData: string; // hex
  iv: string;            // hex
  tag: string;           // hex
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns { encryptedData, iv, tag } — all hex-encoded.
 */
export function encrypt(plaintext: string, keyHex: string): EncryptedPayload {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (got ${key.length})`);
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypts AES-256-GCM payload.
 * Throws if authentication tag verification fails (tampered data).
 */
export function decrypt(payload: EncryptedPayload, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const encryptedData = Buffer.from(payload.encryptedData, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generates a cryptographically secure random key (256-bit, hex-encoded).
 */
export function generateKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Derives a deterministic key from a master key + salt using HMAC-SHA256.
 * Used to derive per-project keys from the master key without storing derivation params.
 */
export function deriveKey(masterKeyHex: string, salt: string): string {
  return createHmac('sha256', Buffer.from(masterKeyHex, 'hex'))
    .update(salt)
    .digest('hex');
}

/**
 * Wraps (encrypts) a project key with the master key.
 * The project key is a random 256-bit key stored encrypted in the DB.
 */
export function wrapKey(projectKey: string, masterKey: string): EncryptedPayload {
  return encrypt(projectKey, masterKey);
}

/**
 * Unwraps (decrypts) a project key using the master key.
 */
export function unwrapKey(wrapped: EncryptedPayload, masterKey: string): string {
  return decrypt(wrapped, masterKey);
}

/**
 * Computes a deterministic HMAC-SHA256 of a key name using the project key.
 * Used as a stable identifier for deduplication — doesn't reveal the key name.
 */
export function hashKey(keyName: string, projectKeyHex: string): string {
  return createHmac('sha256', Buffer.from(projectKeyHex, 'hex'))
    .update(keyName)
    .digest('hex');
}

/**
 * Retrieves the master encryption key from environment.
 * Key must be exactly 32 bytes (64 hex chars).
 */
export function getMasterKey(): string {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key) throw new Error('MASTER_ENCRYPTION_KEY environment variable is not set');
  if (key.length !== 64) throw new Error('MASTER_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  return key;
}
