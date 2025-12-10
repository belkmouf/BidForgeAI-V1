import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  validatePassword,
  validateEmail,
  hashRefreshToken,
  verifyRefreshTokenHash,
  TokenPayload,
} from '../auth.js';
import jwt from 'jsonwebtoken';

describe('auth utilities', () => {
  const mockPayload: TokenPayload = {
    userId: 1,
    email: 'test@example.com',
    role: 'user',
    companyId: 1,
  };

  describe('password hashing and verification', () => {
    const testPassword = 'TestPassword123!';

    test('should hash a password successfully', async () => {
      const hash = await hashPassword(testPassword);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(testPassword);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    test('should verify correct password', async () => {
      const hash = await hashPassword(testPassword);
      const isValid = await verifyPassword(testPassword, hash);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const hash = await hashPassword(testPassword);
      const isValid = await verifyPassword('WrongPassword', hash);
      
      expect(isValid).toBe(false);
    });

    test('should create different hashes for same password', async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('JWT token operations', () => {
    test('should generate valid access token', () => {
      const token = generateAccessToken(mockPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should generate valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    test('should verify valid token and return payload', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(mockPayload.userId);
      expect(decoded?.email).toBe(mockPayload.email);
      expect(decoded?.role).toBe(mockPayload.role);
      expect(decoded?.companyId).toBe(mockPayload.companyId);
    });

    test('should return null for invalid token', () => {
      const decoded = verifyToken('invalid.token.here');
      
      expect(decoded).toBeNull();
    });

    test('should return null for expired token', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        mockPayload,
        process.env.SESSION_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );
      
      const decoded = verifyToken(expiredToken);
      
      expect(decoded).toBeNull();
    });

    test('should handle malformed tokens gracefully', () => {
      const testCases = [
        '',
        'not.a.token',
        'eyJhbGciOiJIUzI1NiJ9.invalid.signature',
        null as any,
        undefined as any,
      ];

      testCases.forEach((testCase) => {
        expect(verifyToken(testCase)).toBeNull();
      });
    });
  });

  describe('password validation', () => {
    test('should validate strong passwords', () => {
      const strongPasswords = [
        'MyStrongPass123!',
        'Aa1bcdefgh',
        'ComplexP@ssw0rd',
      ];

      strongPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('should reject passwords that are too short', () => {
      const result = validatePassword('Aa1!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('should reject passwords without uppercase letters', () => {
      const result = validatePassword('lowercase123!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    test('should reject passwords without lowercase letters', () => {
      const result = validatePassword('UPPERCASE123!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    test('should reject passwords without numbers', () => {
      const result = validatePassword('NoNumbersHere!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    test('should accumulate multiple validation errors', () => {
      const result = validatePassword('weak');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('email validation', () => {
    test('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name+tag@domain.co.uk',
        'simple@test.org',
        'test123@domain123.com',
      ];

      validEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    test('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain',
        '',
        'user name@domain.com',
      ];

      invalidEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('refresh token hashing', () => {
    const testToken = 'test-refresh-token-12345';

    test('should hash refresh token consistently', async () => {
      const hash1 = await hashRefreshToken(testToken);
      const hash2 = await hashRefreshToken(testToken);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex string length
    });

    test('should verify correct token hash', async () => {
      const hash = await hashRefreshToken(testToken);
      const isValid = verifyRefreshTokenHash(testToken, hash);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect token hash', async () => {
      const hash = await hashRefreshToken(testToken);
      const isValid = verifyRefreshTokenHash('wrong-token', hash);
      
      expect(isValid).toBe(false);
    });

    test('should produce different hashes for different tokens', async () => {
      const hash1 = await hashRefreshToken(testToken);
      const hash2 = await hashRefreshToken('different-token');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('token expiration behavior', () => {
    test('should generate tokens with different expiration times', () => {
      const accessToken = generateAccessToken(mockPayload);
      const refreshToken = generateRefreshToken(mockPayload);
      
      const accessDecoded = jwt.decode(accessToken) as any;
      const refreshDecoded = jwt.decode(refreshToken) as any;
      
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });
  });
});