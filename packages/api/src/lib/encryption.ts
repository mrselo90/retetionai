/**
 * Encryption utilities for PII (Personally Identifiable Information)
 * Phone numbers are encrypted at rest
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKeyHex(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (key && /^[0-9a-fA-F]{64}$/.test(key)) {
    return key;
  }
  // Fallback for local/dev/test convenience (still 32 bytes)
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypt phone number
 */
export function encryptPhone(phone: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(getEncryptionKeyHex(), 'hex'), iv);

  let encrypted = cipher.update(phone, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt phone number
 */
export function decryptPhone(encryptedPhone: string): string {
  const parts = encryptedPhone.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted phone format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(getEncryptionKeyHex(), 'hex'),
    iv
  );
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
