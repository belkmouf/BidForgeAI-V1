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

    const { email, password, name, companyName } = validationResult.data;

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
    const [newCompany] = await db
      .insert(companies)
      .values({
        name: companyFullName,
        slug: uniqueSlug,
      })
      .returning();

    // Create user as company_admin of the new company
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: 'company_admin', // First user is always company admin of their company
        companyId: newCompany.id,
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

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        companyId: newUser.companyId,
        companyName: newCompany.name,
        onboardingStatus: newUser.onboardingStatus,
      },
      accessToken,
      refreshToken,
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
      },
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const payload = verifyToken(refreshToken);

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

    res.json({ accessToken, refreshToken: newRefreshToken });
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
  res.json({ message: 'Logged out successfully' });
});

export default router;
