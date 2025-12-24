import { Router } from 'express';
import { db } from '../db';
import { users, sessions, companies, insertUserSchema, loginSchema } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  validatePassword,
  validateEmail,
  verifyToken,
  verifyRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
} from '../lib/auth';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logContext } from '../lib/logger.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const validationResult = insertUserSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const { email, password, name, companyName, ragreadyCollectionId } = validationResult.data as any;

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: 'Password requirements not met',
        details: passwordValidation.errors 
      });
    }

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await hashPassword(password);

    // Generate a unique slug from company name
    const companyFullName = companyName || `${name}'s Company`;
    const baseSlug = companyFullName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 90);
    
    // Add a random suffix to ensure uniqueness
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    // Create a new company for the registering user
    const companySettings: Record<string, any> = {};
    if (ragreadyCollectionId && typeof ragreadyCollectionId === 'string' && ragreadyCollectionId.trim()) {
      companySettings.ragreadyCollectionId = ragreadyCollectionId.trim();
    }

    const [newCompany] = await db
      .insert(companies)
      .values({
        name: companyFullName,
        slug: uniqueSlug,
        settings: Object.keys(companySettings).length > 0 ? companySettings : undefined,
      })
      .returning();

    // Create user as company_admin of the new company
    // termsAcceptedAt is set during registration since they agree on signup
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: 'company_admin', // First user is always company admin of their company
        companyId: newCompany.id,
        termsAcceptedAt: new Date(), // User agreed to terms during signup
      })
      .returning();

    const tokenPayload = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      companyId: newUser.companyId,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    const tokenHash = await hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await db.insert(sessions).values({
      userId: newUser.id,
      tokenHash,
      expiresAt,
    });

    // Set refresh token as HttpOnly cookie for security
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh', // Only sent to refresh endpoint
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        companyId: newUser.companyId,
        companyName: newCompany.name,
        onboardingStatus: newUser.onboardingStatus,
        termsAcceptedAt: newUser.termsAcceptedAt?.toISOString() || null,
      },
      accessToken,
      // Note: refreshToken no longer returned in response for security
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const { email, password } = validationResult.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    // SECURITY FIX (CWE-208): Constant-time response to prevent timing attacks
    // Always perform password verification to prevent user enumeration
    // Use a valid pre-computed bcrypt hash when user doesn't exist to ensure constant time
    // This hash is for a random password and exists solely to consume verification time
    const DUMMY_HASH = '$2b$10$K4mZ7VqF5Q8WxN3pR1sY2e9X6zU4tL0jA.K1hC3dF5gH7iJ9kL1mN';
    const hashToVerify = user?.passwordHash || DUMMY_HASH;
    const isValid = await verifyPassword(password, hashToVerify);

    // Check all conditions after password verification to prevent timing leaks
    if (!user || !isValid) {
      logContext.security('Login attempt failed', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        action: 'login',
        result: 'failure',
        reason: 'invalid_credentials'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      logContext.security('Login attempt failed - account deactivated', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        action: 'login',
        result: 'failure',
        reason: 'account_deactivated'
      });
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    const tokenHash = await hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Set refresh token as HttpOnly cookie for security
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh', // Only sent to refresh endpoint
    });

    // Log successful login
    logContext.security('User logged in successfully', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      action: 'login',
      result: 'success'
    });

    logContext.audit('User login', {
      userId: user.id,
      email: user.email,
      action: 'login',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        onboardingStatus: user.onboardingStatus,
        termsAcceptedAt: user.termsAcceptedAt?.toISOString() || null,
      },
      accessToken,
      // Note: refreshToken no longer returned in response for security
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    // Read refresh token from HttpOnly cookie instead of request body
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Use verifyRefreshToken for refresh tokens (separate secret)
    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    const tokenHash = await hashRefreshToken(refreshToken);
    
    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, payload.userId),
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!session) {
      return res.status(403).json({ error: 'Session expired or invalid' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }

    const newTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = generateAccessToken(newTokenPayload);
    const newRefreshToken = generateRefreshToken(newTokenPayload);
    
    const newTokenHash = await hashRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await db
      .update(sessions)
      .set({
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      })
      .where(eq(sessions.id, session.id));

    // Set new refresh token as HttpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh',
    });

    res.json({ accessToken });
  } catch (error: any) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [userResult] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        companyId: users.companyId,
        companyName: companies.name,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .leftJoin(companies, eq(users.companyId, companies.id))
      .where(eq(users.id, req.user.userId))
      .limit(1);

    if (!userResult) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: userResult });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

router.patch('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name } = req.body;

    const [updatedUser] = await db
      .update(users)
      .set({ 
        name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      });

    res.json({ user: updatedUser });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/change-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: 'Password requirements not met',
        details: passwordValidation.errors 
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({ 
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.userId));

    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.post('/logout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Invalidate all sessions for this user from database
    await db
      .delete(sessions)
      .where(eq(sessions.userId, req.user.userId));

    // Clear the refresh token cookie
    res.clearCookie('refreshToken', {
      path: '/api/auth/refresh',
    });

    // Log successful logout
    logContext.security('User logged out successfully', {
      userId: req.user.userId,
      email: req.user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      action: 'logout',
      result: 'success'
    });

    logContext.audit('User logout', {
      userId: req.user.userId,
      email: req.user.email,
      action: 'logout',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Accept Terms of Service
router.post('/accept-terms', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [updatedUser] = await db
      .update(users)
      .set({ 
        termsAcceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    logContext.audit('User accepted terms of service', {
      userId: req.user.userId,
      email: req.user.email,
      action: 'accept_terms',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ 
      success: true,
      termsAcceptedAt: updatedUser.termsAcceptedAt?.toISOString() || null,
    });
  } catch (error: any) {
    console.error('Accept terms error:', error);
    res.status(500).json({ error: 'Failed to accept terms' });
  }
});

export default router;
