import { Request, Response, NextFunction } from 'express';
import { authenticateToken, optionalAuth, AuthRequest } from '../auth.js';
import { generateAccessToken, TokenPayload } from '../../lib/auth.js';

// Mock the auth lib
jest.mock('../../lib/auth.js', () => ({
  verifyToken: jest.fn(),
  generateAccessToken: jest.requireActual('../../lib/auth.js').generateAccessToken,
}));

import { verifyToken } from '../../lib/auth.js';
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

describe('auth middleware', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonSpy: jest.SpyInstance;
  let statusSpy: jest.SpyInstance;

  const mockPayload: TokenPayload = {
    userId: 1,
    email: 'test@example.com',
    role: 'user',
    companyId: 1,
  };

  beforeEach(() => {
    req = {
      headers: {},
    };
    
    jsonSpy = jest.fn().mockReturnThis();
    statusSpy = jest.fn().mockReturnThis();
    
    res = {
      status: statusSpy,
      json: jsonSpy,
    };
    
    next = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    test('should authenticate valid Bearer token', () => {
      const validToken = 'valid-jwt-token';
      req.headers!['authorization'] = `Bearer ${validToken}`;
      mockVerifyToken.mockReturnValue(mockPayload);

      authenticateToken(req as AuthRequest, res as Response, next);

      expect(mockVerifyToken).toHaveBeenCalledWith(validToken);
      expect(req.user).toBe(mockPayload);
      expect(next).toHaveBeenCalledWith();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    test('should reject request without authorization header', () => {
      authenticateToken(req as AuthRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with malformed authorization header', () => {
      req.headers!['authorization'] = 'InvalidFormat';

      authenticateToken(req as AuthRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with invalid token', () => {
      const invalidToken = 'invalid-jwt-token';
      req.headers!['authorization'] = `Bearer ${invalidToken}`;
      mockVerifyToken.mockReturnValue(null);

      authenticateToken(req as AuthRequest, res as Response, next);

      expect(mockVerifyToken).toHaveBeenCalledWith(invalidToken);
      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle empty Bearer token', () => {
      req.headers!['authorization'] = 'Bearer ';

      authenticateToken(req as AuthRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle authorization header with only Bearer', () => {
      req.headers!['authorization'] = 'Bearer';

      authenticateToken(req as AuthRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should be case sensitive for Bearer token', () => {
      req.headers!['authorization'] = 'bearer valid-token';

      authenticateToken(req as AuthRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    test('should set user when valid token provided', () => {
      const validToken = 'valid-jwt-token';
      req.headers!['authorization'] = `Bearer ${validToken}`;
      mockVerifyToken.mockReturnValue(mockPayload);

      optionalAuth(req as AuthRequest, res as Response, next);

      expect(mockVerifyToken).toHaveBeenCalledWith(validToken);
      expect(req.user).toBe(mockPayload);
      expect(next).toHaveBeenCalledWith();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    test('should continue without user when no token provided', () => {
      optionalAuth(req as AuthRequest, res as Response, next);

      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    test('should continue without user when invalid token provided', () => {
      const invalidToken = 'invalid-jwt-token';
      req.headers!['authorization'] = `Bearer ${invalidToken}`;
      mockVerifyToken.mockReturnValue(null);

      optionalAuth(req as AuthRequest, res as Response, next);

      expect(mockVerifyToken).toHaveBeenCalledWith(invalidToken);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    test('should continue without user when malformed authorization header', () => {
      req.headers!['authorization'] = 'InvalidFormat';

      optionalAuth(req as AuthRequest, res as Response, next);

      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    test('should handle empty authorization header gracefully', () => {
      req.headers!['authorization'] = '';

      optionalAuth(req as AuthRequest, res as Response, next);

      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    test('should handle concurrent authentication attempts', async () => {
      const token1 = generateAccessToken({ ...mockPayload, userId: 1 });
      const token2 = generateAccessToken({ ...mockPayload, userId: 2 });

      // Reset mock to use actual implementation
      mockVerifyToken.mockRestore();
      const actualVerifyToken = jest.requireActual('../../lib/auth.js').verifyToken;

      const req1 = { headers: { authorization: `Bearer ${token1}` } };
      const req2 = { headers: { authorization: `Bearer ${token2}` } };

      authenticateToken(req1 as AuthRequest, res as Response, next);
      authenticateToken(req2 as AuthRequest, res as Response, next);

      expect(req1.user?.userId).toBe(1);
      expect(req2.user?.userId).toBe(2);
      expect(next).toHaveBeenCalledTimes(2);
    });

    test('should not leak token information in error responses', () => {
      const secretToken = 'secret-jwt-token-12345';
      req.headers!['authorization'] = `Bearer ${secretToken}`;
      mockVerifyToken.mockReturnValue(null);

      authenticateToken(req as AuthRequest, res as Response, next);

      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      
      // Ensure token is not included in error message
      const errorMessage = jsonSpy.mock.calls[0][0].error;
      expect(errorMessage).not.toContain(secretToken);
    });

    test('should preserve request object integrity', () => {
      const originalHeaders = { ...req.headers };
      const validToken = 'valid-jwt-token';
      req.headers!['authorization'] = `Bearer ${validToken}`;
      mockVerifyToken.mockReturnValue(mockPayload);

      authenticateToken(req as AuthRequest, res as Response, next);

      // Original headers should be unchanged
      expect(req.headers).toEqual({
        ...originalHeaders,
        authorization: `Bearer ${validToken}`,
      });
      
      // User should be added
      expect(req.user).toBe(mockPayload);
    });
  });
});