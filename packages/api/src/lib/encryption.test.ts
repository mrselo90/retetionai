/**
 * Encryption Module Tests
 * Tests for phone number encryption/decryption
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { encryptPhone, decryptPhone } from './encryption';

describe('encryptPhone', () => {
  beforeEach(() => {
    // Ensure encryption key is set
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!!';
    }
  });

  it('should encrypt phone number', () => {
    const phone = '+905551112233';
    const encrypted = encryptPhone(phone);
    
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(phone);
    expect(encrypted).toContain(':');
  });

  it('should produce different ciphertext for same plaintext (IV randomness)', () => {
    const phone = '+905551112233';
    const encrypted1 = encryptPhone(phone);
    const encrypted2 = encryptPhone(phone);
    
    // Should be different due to random IV
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should handle different phone formats', () => {
    const phones = [
      '+905551112233',
      '905551112233',
      '+1-555-123-4567',
      '555-123-4567',
    ];

    phones.forEach((phone) => {
      const encrypted = encryptPhone(phone);
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(':');
    });
  });
});

describe('decryptPhone', () => {
  beforeEach(() => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!!';
    }
  });

  it('should decrypt to original phone number', () => {
    const phone = '+905551112233';
    const encrypted = encryptPhone(phone);
    const decrypted = decryptPhone(encrypted);
    
    expect(decrypted).toBe(phone);
  });

  it('should decrypt different encrypted versions of same phone', () => {
    const phone = '+905551112233';
    const encrypted1 = encryptPhone(phone);
    const encrypted2 = encryptPhone(phone);
    
    const decrypted1 = decryptPhone(encrypted1);
    const decrypted2 = decryptPhone(encrypted2);
    
    expect(decrypted1).toBe(phone);
    expect(decrypted2).toBe(phone);
  });

  it('should throw error for invalid encrypted data', () => {
    const invalidEncrypted = 'invalid:data';
    
    expect(() => {
      decryptPhone(invalidEncrypted);
    }).toThrow();
  });

  it('should throw error for corrupted data', () => {
    const corrupted = 'corrupted:data:here';
    
    expect(() => {
      decryptPhone(corrupted);
    }).toThrow();
  });

  it('should handle empty string', () => {
    expect(() => {
      decryptPhone('');
    }).toThrow();
  });
});

describe('encryptPhone and decryptPhone integration', () => {
  beforeEach(() => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!!';
    }
  });

  it('should round-trip encrypt and decrypt correctly', () => {
    const phones = [
      '+905551112233',
      '+905551112234',
      '+1-555-123-4567',
      '905551112233',
    ];

    phones.forEach((phone) => {
      const encrypted = encryptPhone(phone);
      const decrypted = decryptPhone(encrypted);
      expect(decrypted).toBe(phone);
    });
  });

  it('should fail decryption with wrong key', () => {
    const phone = '+905551112233';
    const encrypted = encryptPhone(phone);
    
    // Change encryption key
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'wrong-encryption-key-32-chars-long!!';
    
    expect(() => {
      decryptPhone(encrypted);
    }).toThrow();
    
    // Restore original key
    process.env.ENCRYPTION_KEY = originalKey;
  });
});
