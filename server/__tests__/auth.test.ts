/// <reference types="jest" />
import request from 'supertest';
import express from 'express';
import { createTestUser, cleanupDatabase, generateRandomEmail } from './utils/test-helpers';
import authRouter from '../routes/auth';
import { db } from '../db';
import { users, sessions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Authentication API', () => {
  beforeEach(async () => {
    try {
      await cleanupDatabase();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  afterAll(async () => {
    try {
      await cleanupDatabase();
    } catch (error) {
      console.error('Final cleanup error:', error);
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const email = generateRandomEmail();
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'SecurePass123!',
          name: 'New User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(email);
      expect(response.body.user.name).toBe('New User');
      expect(response.body.user.role).toBe('user');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject registration with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'SecurePass123!',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: generateRandomEmail(),
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: generateRandomEmail(),
          password: 'weak',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'SecurePass123!',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate email registration', async () => {
      const email = generateRandomEmail();
      
      await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'SecurePass123!',
          name: 'First User',
        });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'AnotherPass123!',
          name: 'Second User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should create a session record on registration', async () => {
      const email = generateRandomEmail();
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'SecurePass123!',
          name: 'Session Test User',
        });

      expect(response.status).toBe(201);
      
      const userId = response.body.user.id;
      const [session] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .limit(1);
      
      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const email = generateRandomEmail();
      const password = 'TestPassword123!';
      
      await createTestUser({ email, password });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(email);
    });

    it('should reject login with wrong password', async () => {
      const email = generateRandomEmail();
      await createTestUser({ email, password: 'CorrectPassword123!' });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should update lastLoginAt on successful login', async () => {
      const email = generateRandomEmail();
      const password = 'TestPassword123!';
      const { user } = await createTestUser({ email, password });

      await request(app)
        .post('/api/auth/login')
        .send({ email, password });

      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      expect(updatedUser.lastLoginAt).toBeDefined();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const { refreshToken } = await createTestUser();

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token-string' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should rotate refresh token on each refresh', async () => {
      const { refreshToken: firstToken } = await createTestUser();

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: firstToken });

      expect(response.status).toBe(200);
      const newToken = response.body.refreshToken;
      expect(newToken).not.toBe(firstToken);

      const reuse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: firstToken });

      expect(reuse.status).toBe(403);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const { accessToken, user } = await createTestUser();

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user.name).toBe(user.name);
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/auth/profile', () => {
    it('should update user name', async () => {
      const { accessToken } = await createTestUser();

      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe('Updated Name');
    });

    it('should reject profile update without authentication', async () => {
      const response = await request(app)
        .patch('/api/auth/profile')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password with correct current password', async () => {
      const password = 'OldPassword123!';
      const { accessToken } = await createTestUser({ password });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: password,
          newPassword: 'NewPassword456!',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('changed');
    });

    it('should reject with wrong current password', async () => {
      const { accessToken } = await createTestUser({ password: 'CorrectPass123!' });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword456!',
        });

      expect(response.status).toBe(401);
    });

    it('should reject weak new password', async () => {
      const password = 'CurrentPass123!';
      const { accessToken } = await createTestUser({ password });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: password,
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
    });
  });
});
