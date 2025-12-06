import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });
}

function getEncryptionKeySource(): string {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    console.warn('DEV: ENCRYPTION_KEY not set, using fallback key');
    return process.env.JWT_SECRET || 'development-secret-key-do-not-use-in-production';
  }
  
  if (key.length < 16) {
    throw new Error('ENCRYPTION_KEY must be at least 16 characters');
  }
  
  return key;
}

export function encrypt(plaintext: string): string {
  const keySource = getEncryptionKeySource();
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(keySource, salt);
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const keySource = getEncryptionKeySource();
  const parts = encryptedData.split(':');
  
  let salt: Buffer;
  let iv: Buffer;
  let authTag: Buffer;
  let encrypted: string;
  let key: Buffer;
  
  if (parts.length === 4) {
    const [saltHex, ivHex, authTagHex, enc] = parts;
    salt = Buffer.from(saltHex, 'hex');
    iv = Buffer.from(ivHex, 'hex');
    authTag = Buffer.from(authTagHex, 'hex');
    encrypted = enc;
    key = deriveKey(keySource, salt);
  } else if (parts.length === 3) {
    const [ivHex, authTagHex, enc] = parts;
    iv = Buffer.from(ivHex, 'hex');
    authTag = Buffer.from(authTagHex, 'hex');
    encrypted = enc;
    key = createHash('sha256').update(keySource).digest();
  } else {
    throw new Error('Invalid encrypted data format');
  }
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function hashSensitiveData(data: string): string {
  const salt = process.env.HASH_SALT || 'bidforge-default-salt';
  return createHash('sha256')
    .update(data + salt)
    .digest('hex');
}

export function encryptObject<T extends object>(obj: T): string {
  return encrypt(JSON.stringify(obj));
}

export function decryptObject<T>(encryptedData: string): T {
  const decrypted = decrypt(encryptedData);
  return JSON.parse(decrypted) as T;
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

export function maskSensitiveString(str: string, visibleChars: number = 4): string {
  if (str.length <= visibleChars * 2) {
    return '*'.repeat(str.length);
  }
  
  const start = str.substring(0, visibleChars);
  const end = str.substring(str.length - visibleChars);
  const middle = '*'.repeat(str.length - (visibleChars * 2));
  
  return `${start}${middle}${end}`;
}

export function isEncrypted(data: string): boolean {
  const parts = data.split(':');
  
  if (parts.length === 4) {
    const [saltHex, ivHex, authTagHex] = parts;
    return saltHex.length === SALT_LENGTH * 2 && 
           ivHex.length === IV_LENGTH * 2 && 
           authTagHex.length === AUTH_TAG_LENGTH * 2;
  }
  
  if (parts.length === 3) {
    const [ivHex, authTagHex] = parts;
    return ivHex.length === IV_LENGTH * 2 && authTagHex.length === AUTH_TAG_LENGTH * 2;
  }
  
  return false;
}
