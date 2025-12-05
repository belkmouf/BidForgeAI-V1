# BidForge AI - Replit Agent Implementation Plan
## Complete Enhancement Implementation Guide

**Target Agent:** Replit Agent / AI Code Assistant  
**Project:** BidForge AI Enhancement (9.2 → 10.0)  
**Timeline:** 20 weeks (80 sprints × 2 days each)  
**Current Codebase:** /home/claude/BidForgeAI-1/  

---

## 🎯 IMPLEMENTATION STRATEGY

### Agent Instructions:
- Follow tasks in **strict numerical order**
- Complete ALL acceptance criteria before moving to next task
- Write tests for every feature
- Update documentation as you go
- Commit after each completed task
- Flag blockers immediately

### File Structure Reference:
```
BidForgeAI-1/
├── server/                 # Backend (Express + Node.js)
│   ├── routes.ts          # API endpoints (607 lines)
│   ├── lib/
│   │   ├── analysis.ts    # RFP analysis (390 lines)
│   │   ├── ingestion.ts   # Document processing (304 lines)
│   │   └── generation.ts  # Bid generation
│   └── index.ts           # Server entry point
├── client/                 # Frontend (React + TypeScript)
│   └── src/
│       ├── App.tsx        # Main app
│       ├── pages/         # Page components
│       └── components/    # Reusable components
├── shared/
│   └── schema.ts          # Database schema (188 lines)
└── db/
    └── index.ts           # Database connection
```

---

## 📋 PHASE 0: CRITICAL FOUNDATIONS (WEEKS 1-4)

### Priority: P0 (BLOCKING - Must complete first)

---

## TASK 001: Authentication System - JWT Setup

**Sprint:** Week 1, Days 1-2  
**Priority:** P0 (CRITICAL)  
**Estimated Time:** 4 hours  
**Dependencies:** None  

### Objective:
Implement JWT-based authentication system with secure password hashing.

### Files to Create:
1. `server/lib/auth.ts` - Authentication utilities
2. `server/middleware/auth.ts` - JWT verification middleware
3. `server/routes/auth.ts` - Auth endpoints

### Implementation Steps:

#### Step 1: Install Dependencies
```bash
npm install jsonwebtoken bcrypt
npm install --save-dev @types/jsonwebtoken @types/bcrypt
```

#### Step 2: Create `server/lib/auth.ts`
```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

interface TokenPayload {
  userId: number;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}
```

#### Step 3: Update `shared/schema.ts` - Add Users Table
```typescript
// Add to schema.ts
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('user'), // 'admin', 'manager', 'user', 'viewer'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

#### Step 4: Create `server/middleware/auth.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  req.user = payload;
  next();
}
```

#### Step 5: Create `server/routes/auth.ts`
```typescript
import { Router } from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
} from '../lib/auth';

const router = Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
      })
      .returning();

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: newUser.id,
      email: newUser.email,
    });
    const refreshToken = generateRefreshToken({
      userId: newUser.id,
      email: newUser.email,
    });

    res.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const payload = verifyToken(refreshToken);

    if (!payload) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
    });

    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

export default router;
```

#### Step 6: Update `server/routes.ts` - Add Auth Routes
```typescript
// Add at top of file
import authRoutes from './routes/auth';

// Add before other routes
app.use('/api/auth', authRoutes);
```

#### Step 7: Run Database Migration
```bash
# Create migration for new tables
npm run db:push
```

### Acceptance Criteria:
- [ ] Users can register with email/password
- [ ] Passwords are hashed with bcrypt
- [ ] Users can login and receive JWT tokens
- [ ] Access tokens expire after 15 minutes
- [ ] Refresh tokens work correctly
- [ ] Invalid tokens return 403 error
- [ ] Missing tokens return 401 error
- [ ] Database tables created successfully

### Testing:
```bash
# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","name":"Test User"}'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Test protected route
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer <TOKEN>"
```

### Commit Message:
```
feat: implement JWT authentication system

- Add bcrypt password hashing
- Create users and sessions tables
- Implement register, login, and refresh endpoints
- Add JWT middleware for protected routes
- Add token verification and generation utilities

Closes #001
```

---

## TASK 002: Role-Based Access Control (RBAC)

**Sprint:** Week 1, Days 3-4  
**Priority:** P0 (CRITICAL)  
**Estimated Time:** 4 hours  
**Dependencies:** TASK 001 (Authentication)  

### Objective:
Implement role-based permissions system with 4 roles: Admin, Manager, User, Viewer.

### Files to Create/Update:
1. `server/middleware/rbac.ts` - Permission checking
2. Update `shared/schema.ts` - Add roles and permissions tables
3. Update `server/routes.ts` - Apply RBAC to routes

### Implementation Steps:

#### Step 1: Update `shared/schema.ts` - Add RBAC Tables
```typescript
// Add to schema.ts
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  permissions: jsonb('permissions').$type<string[]>().notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userRoles = pgTable('user_roles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  roleId: integer('role_id').references(() => roles.id).notNull(),
  projectId: varchar('project_id').references(() => projects.id), // null = global role
  grantedAt: timestamp('granted_at').defaultNow(),
});

// Create index for faster lookups
export const userRolesIndex = pgTable('user_roles', {
  // Add indexes
});
```

#### Step 2: Create `server/lib/permissions.ts`
```typescript
export const PERMISSIONS = {
  // Project permissions
  PROJECT_CREATE: 'project:create',
  PROJECT_VIEW: 'project:view',
  PROJECT_EDIT: 'project:edit',
  PROJECT_DELETE: 'project:delete',
  
  // Document permissions
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_VIEW: 'document:view',
  DOCUMENT_DELETE: 'document:delete',
  
  // Analysis permissions
  ANALYSIS_RUN: 'analysis:run',
  ANALYSIS_VIEW: 'analysis:view',
  
  // Generation permissions
  GENERATION_CREATE: 'generation:create',
  GENERATION_EDIT: 'generation:edit',
  
  // User management
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  
  // System
  SYSTEM_ADMIN: 'system:admin',
} as const;

export const ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_EDIT,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_DELETE,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.ANALYSIS_VIEW,
    PERMISSIONS.GENERATION_CREATE,
    PERMISSIONS.GENERATION_EDIT,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.ROLE_MANAGE,
    PERMISSIONS.SYSTEM_ADMIN,
  ],
  manager: [
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_EDIT,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_DELETE,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.ANALYSIS_VIEW,
    PERMISSIONS.GENERATION_CREATE,
    PERMISSIONS.GENERATION_EDIT,
  ],
  user: [
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_EDIT,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.ANALYSIS_VIEW,
    PERMISSIONS.GENERATION_CREATE,
    PERMISSIONS.GENERATION_EDIT,
  ],
  viewer: [
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.ANALYSIS_VIEW,
  ],
};
```

#### Step 3: Create `server/middleware/rbac.ts`
```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { db } from '../db';
import { userRoles, roles, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

export function requirePermission(permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Get user's roles
      const userRolesData = await db
        .select({
          permissions: roles.permissions,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, req.user.userId));

      // Collect all permissions
      const allPermissions = new Set<string>();
      userRolesData.forEach(role => {
        const perms = role.permissions as string[];
        perms.forEach(p => allPermissions.add(p));
      });

      // Check if user has required permission
      if (!allPermissions.has(permission) && !allPermissions.has('system:admin')) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission 
        });
      }

      next();
    } catch (error) {
      console.error('RBAC error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

export function requireRole(roleName: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const userRolesData = await db
        .select({
          roleName: roles.name,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, req.user.userId));

      const hasRole = userRolesData.some(r => r.roleName === roleName);

      if (!hasRole) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: roleName 
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Role check failed' });
    }
  };
}
```

#### Step 4: Create Seed Script for Roles
Create `server/scripts/seed-roles.ts`:
```typescript
import { db } from '../db';
import { roles } from '../../shared/schema';
import { ROLE_PERMISSIONS } from '../lib/permissions';

async function seedRoles() {
  const rolesToCreate = [
    {
      name: 'admin',
      permissions: ROLE_PERMISSIONS.admin,
      description: 'Full system access',
    },
    {
      name: 'manager',
      permissions: ROLE_PERMISSIONS.manager,
      description: 'Manage projects and team',
    },
    {
      name: 'user',
      permissions: ROLE_PERMISSIONS.user,
      description: 'Create and edit projects',
    },
    {
      name: 'viewer',
      permissions: ROLE_PERMISSIONS.viewer,
      description: 'Read-only access',
    },
  ];

  for (const role of rolesToCreate) {
    await db
      .insert(roles)
      .values(role)
      .onConflictDoNothing();
  }

  console.log('Roles seeded successfully');
}

seedRoles().catch(console.error);
```

#### Step 5: Update `server/routes.ts` - Apply RBAC
```typescript
import { authenticateToken } from './middleware/auth';
import { requirePermission } from './middleware/rbac';
import { PERMISSIONS } from './lib/permissions';

// Protect routes with RBAC
app.post(
  '/api/projects',
  authenticateToken,
  requirePermission(PERMISSIONS.PROJECT_CREATE),
  async (req, res) => {
    // existing code
  }
);

app.delete(
  '/api/projects/:id',
  authenticateToken,
  requirePermission(PERMISSIONS.PROJECT_DELETE),
  async (req, res) => {
    // existing code
  }
);

// Apply to all routes as needed
```

### Acceptance Criteria:
- [ ] 4 roles created (Admin, Manager, User, Viewer)
- [ ] Each role has defined permissions
- [ ] Permissions enforced on all routes
- [ ] Admins have full access
- [ ] Viewers have read-only access
- [ ] Unauthorized requests return 403
- [ ] Role seed script runs successfully

### Testing:
```bash
# Seed roles
npm run seed:roles

# Test with different roles
# (Register users, assign roles, test access)
```

### Commit Message:
```
feat: implement role-based access control

- Add roles and user_roles tables
- Define 4 roles with permissions
- Create RBAC middleware
- Apply permissions to routes
- Add role seeding script

Closes #002
```

---

## TASK 003: Security Hardening

**Sprint:** Week 1, Day 5  
**Priority:** P0 (CRITICAL)  
**Estimated Time:** 3 hours  
**Dependencies:** TASK 001, TASK 002  

### Objective:
Add security headers, rate limiting, CORS, and XSS protection.

### Implementation Steps:

#### Step 1: Install Security Dependencies
```bash
npm install helmet express-rate-limit cors
npm install --save-dev @types/cors
```

#### Step 2: Update `server/index.ts` - Add Security Middleware
```typescript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

// Add after express() initialization
const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rest of your app...
```

#### Step 3: Create `.env.example`
```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bidforge

# Security
JWT_SECRET=your-secret-key-change-in-production
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# AI APIs
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
GOOGLE_API_KEY=your-key
DEEPSEEK_API_KEY=your-key

# WhatsApp
WA_PHONE_NUMBER_ID=your-id
CLOUD_API_ACCESS_TOKEN=your-token
WEBHOOK_VERIFY_TOKEN=your-token
WA_APP_SECRET=your-secret
```

### Acceptance Criteria:
- [ ] Security headers present in all responses
- [ ] CORS only allows whitelisted origins
- [ ] Rate limiting works (100 requests/15min)
- [ ] Auth endpoints have stricter limits (5/15min)
- [ ] Request body size limited to 10MB
- [ ] Environment variables properly configured

### Testing:
```bash
# Test rate limiting (should fail after 100 requests)
for i in {1..101}; do curl http://localhost:3000/api/projects; done

# Test CORS
curl -H "Origin: http://malicious.com" http://localhost:3000/api/projects
```

### Commit Message:
```
feat: add security hardening

- Add helmet for security headers
- Implement rate limiting (100/15min general, 5/15min auth)
- Configure CORS with whitelist
- Add request body size limits
- Create .env.example template

Closes #003
```

---

## TASK 004: Testing Infrastructure Setup

**Sprint:** Week 2, Days 1-2  
**Priority:** P0 (CRITICAL)  
**Estimated Time:** 6 hours  
**Dependencies:** TASK 001-003  

### Objective:
Set up Jest, Testing Library, and write tests for authentication system.

### Implementation Steps:

#### Step 1: Install Testing Dependencies
```bash
npm install --save-dev \
  jest@^29.7.0 \
  @testing-library/react@^14.1.2 \
  @testing-library/jest-dom@^6.1.5 \
  @testing-library/user-event@^14.5.1 \
  supertest@^6.3.3 \
  ts-jest@^29.1.1 \
  @types/jest@^29.5.11 \
  @types/supertest@^6.0.2
```

#### Step 2: Create `jest.config.js`
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server', '<rootDir>/client'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```

#### Step 3: Create `jest.setup.js`
```javascript
// Setup for Testing Library
import '@testing-library/jest-dom';
```

#### Step 4: Create Test Utilities
Create `server/__tests__/utils/test-helpers.ts`:
```typescript
import { db } from '../../db';
import { users } from '../../../shared/schema';
import { hashPassword } from '../../lib/auth';

export async function createTestUser(data?: {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
}) {
  const email = data?.email || 'test@example.com';
  const password = data?.password || 'TestPassword123!';
  const name = data?.name || 'Test User';
  const role = data?.role || 'user';

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name,
      role,
    })
    .returning();

  return { user, password };
}

export async function cleanupDatabase() {
  // Delete all test data
  await db.delete(users);
  // Add more cleanup as needed
}
```

#### Step 5: Write Authentication Tests
Create `server/__tests__/auth.test.ts`:
```typescript
import request from 'supertest';
import { app } from '../index';
import { createTestUser, cleanupDatabase } from './utils/test-helpers';

describe('Authentication', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe('newuser@example.com');
    });

    it('should reject duplicate email', async () => {
      await createTestUser({ email: 'existing@example.com' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should require email and password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const { password } = await createTestUser({
        email: 'login@example.com',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid password', async () => {
      await createTestUser({ email: 'test@example.com' });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token', async () => {
      const { password } = await createTestUser();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password,
        });

      const { refreshToken } = loginResponse.body;

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(403);
    });
  });
});
```

#### Step 6: Update `package.json` - Add Test Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

### Acceptance Criteria:
- [ ] Jest configured and running
- [ ] Test utilities created
- [ ] 15+ auth tests written and passing
- [ ] Test coverage >70% for auth module
- [ ] Tests run in CI-like environment
- [ ] Test database cleanup works

### Testing:
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Commit Message:
```
feat: set up testing infrastructure

- Configure Jest with TypeScript
- Add Testing Library
- Create test utilities and helpers
- Write 15+ authentication tests
- Add test scripts to package.json
- Set coverage threshold to 70%

Closes #004
```

---

## PHASE 1: AI AGENT SYSTEM (WEEKS 5-8)

### Priority: P1 (HIGH)

---

## TASK 005: Install LangChain & LangGraph

**Sprint:** Week 5, Day 1  
**Priority:** P1  
**Estimated Time:** 2 hours  
**Dependencies:** TASK 001-004  

### Objective:
Install and configure LangChain ecosystem for agent orchestration.

### Implementation Steps:

#### Step 1: Install Dependencies
```bash
npm install \
  langchain \
  @langchain/core \
  @langchain/openai \
  @langchain/anthropic \
  @langchain/google-genai \
  langgraph \
  zod

npm install --save-dev \
  @types/uuid
```

#### Step 2: Create Base Agent Interface
Create `server/agents/base-agent.ts`:
```typescript
import { z } from 'zod';

export interface AgentContext {
  projectId: string;
  userId: number;
  metadata: Record<string, any>;
}

export interface AgentInput {
  type: string;
  data: any;
  context: AgentContext;
}

export interface AgentOutput {
  success: boolean;
  data?: any;
  error?: string;
  nextAgent?: string;
}

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;

  abstract execute(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput>;

  protected log(message: string, data?: any) {
    console.log(`[${this.name}]`, message, data || '');
  }

  protected error(message: string, error?: any) {
    console.error(`[${this.name}] ERROR:`, message, error || '');
  }
}
```

#### Step 3: Create Agent State Schema
Create `server/agents/state.ts`:
```typescript
import { z } from 'zod';

export const AgentStateSchema = z.object({
  projectId: z.string(),
  userId: z.number(),
  
  // Workflow state
  currentAgent: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  
  // Data accumulated through workflow
  documents: z.array(z.any()).optional(),
  analysis: z.any().optional(),
  draft: z.any().optional(),
  review: z.any().optional(),
  
  // Errors and logs
  errors: z.array(z.string()).optional(),
  logs: z.array(z.string()).optional(),
  
  // Metadata
  startedAt: z.date(),
  updatedAt: z.date(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;
```

### Acceptance Criteria:
- [ ] LangChain packages installed
- [ ] Base agent interface created
- [ ] Agent state schema defined
- [ ] No TypeScript errors
- [ ] Dependencies in package.json

### Commit Message:
```
feat: install LangChain and setup agent foundation

- Install langchain, langgraph, and AI SDKs
- Create BaseAgent abstract class
- Define AgentState schema with Zod
- Set up agent directory structure

Closes #005
```

---

## TASK 006: Create Agent Orchestrator

**Sprint:** Week 5, Days 2-3  
**Priority:** P1  
**Estimated Time:** 6 hours  
**Dependencies:** TASK 005  

### Objective:
Build the central orchestrator that manages agent workflow execution.

### Implementation Steps:

#### Step 1: Create Orchestrator
Create `server/agents/orchestrator.ts`:
```typescript
import { StateGraph } from 'langgraph';
import { AgentState } from './state';
import { BaseAgent } from './base-agent';
import { db } from '../db';
import { agentExecutions, agentStates } from '../../shared/schema';

export class AgentOrchestrator {
  private graph: StateGraph<AgentState>;
  private agents: Map<string, BaseAgent>;

  constructor() {
    this.agents = new Map();
    this.graph = this.buildGraph();
  }

  registerAgent(agent: BaseAgent) {
    this.agents.set(agent.name, agent);
  }

  private buildGraph(): StateGraph<AgentState> {
    const graph = new StateGraph<AgentState>({
      channels: {
        projectId: null,
        userId: null,
        currentAgent: null,
        status: null,
        documents: null,
        analysis: null,
        draft: null,
        review: null,
        errors: null,
        logs: null,
        startedAt: null,
        updatedAt: null,
      },
    });

    // Define nodes (we'll add specific agents later)
    graph.addNode('intake', this.createAgentNode('intake'));
    graph.addNode('analysis', this.createAgentNode('analysis'));
    graph.addNode('decision', this.createAgentNode('decision'));
    graph.addNode('generation', this.createAgentNode('generation'));
    graph.addNode('review', this.createAgentNode('review'));
    graph.addNode('complete', this.completeNode.bind(this));

    // Define edges
    graph.addEdge('intake', 'analysis');
    graph.addConditionalEdge(
      'analysis',
      this.shouldProceedAfterAnalysis.bind(this),
      {
        proceed: 'decision',
        reject: 'complete',
      }
    );
    graph.addEdge('decision', 'generation');
    graph.addEdge('generation', 'review');
    graph.addConditionalEdge(
      'review',
      this.shouldRetryGeneration.bind(this),
      {
        pass: 'complete',
        retry: 'generation',
      }
    );

    graph.setEntryPoint('intake');

    return graph;
  }

  private createAgentNode(agentName: string) {
    return async (state: AgentState): Promise<Partial<AgentState>> => {
      const agent = this.agents.get(agentName);
      
      if (!agent) {
        return {
          status: 'failed',
          errors: [...(state.errors || []), `Agent ${agentName} not found`],
        };
      }

      try {
        // Log execution start
        await this.logExecution(state.projectId, agentName, 'running', state);

        const result = await agent.execute(
          {
            type: agentName,
            data: state,
            context: {
              projectId: state.projectId,
              userId: state.userId,
              metadata: {},
            },
          },
          {
            projectId: state.projectId,
            userId: state.userId,
            metadata: {},
          }
        );

        // Log execution complete
        await this.logExecution(state.projectId, agentName, 'completed', result);

        if (!result.success) {
          return {
            status: 'failed',
            errors: [...(state.errors || []), result.error || 'Unknown error'],
          };
        }

        return {
          ...result.data,
          currentAgent: agentName,
          status: 'running',
          updatedAt: new Date(),
          logs: [...(state.logs || []), `${agentName} completed`],
        };
      } catch (error) {
        console.error(`Agent ${agentName} error:`, error);
        await this.logExecution(state.projectId, agentName, 'failed', error);

        return {
          status: 'failed',
          errors: [...(state.errors || []), error.message],
        };
      }
    };
  }

  private async shouldProceedAfterAnalysis(
    state: AgentState
  ): Promise<'proceed' | 'reject'> {
    // Check if analysis indicates we should proceed
    const analysis = state.analysis;
    
    if (!analysis) return 'reject';
    
    // Check critical conditions
    if (analysis.overallRiskLevel === 'Critical') return 'reject';
    if (analysis.doabilityScore < 30) return 'reject';
    
    return 'proceed';
  }

  private async shouldRetryGeneration(
    state: AgentState
  ): Promise<'pass' | 'retry'> {
    const review = state.review;
    
    if (!review) return 'retry';
    if (review.passed) return 'pass';
    if (review.attempts >= 3) return 'pass'; // Max retries
    
    return 'retry';
  }

  private async completeNode(state: AgentState): Promise<Partial<AgentState>> {
    return {
      status: 'completed',
      updatedAt: new Date(),
      logs: [...(state.logs || []), 'Workflow completed'],
    };
  }

  async execute(initialState: Partial<AgentState>): Promise<AgentState> {
    const state: AgentState = {
      projectId: initialState.projectId!,
      userId: initialState.userId!,
      currentAgent: 'intake',
      status: 'pending',
      startedAt: new Date(),
      updatedAt: new Date(),
      ...initialState,
    };

    // Save initial state
    await this.saveState(state);

    try {
      const finalState = await this.graph.invoke(state);
      
      // Save final state
      await this.saveState(finalState);
      
      return finalState;
    } catch (error) {
      console.error('Orchestrator execution error:', error);
      const errorState = {
        ...state,
        status: 'failed' as const,
        errors: [error.message],
      };
      await this.saveState(errorState);
      throw error;
    }
  }

  private async logExecution(
    projectId: string,
    agentName: string,
    status: string,
    data: any
  ) {
    await db.insert(agentExecutions).values({
      projectId,
      agentName,
      status,
      input: data,
      output: data,
      startedAt: new Date(),
    });
  }

  private async saveState(state: AgentState) {
    await db
      .insert(agentStates)
      .values({
        projectId: state.projectId,
        currentAgent: state.currentAgent,
        state: state as any,
        updatedAt: state.updatedAt,
      })
      .onConflictDoUpdate({
        target: agentStates.projectId,
        set: {
          currentAgent: state.currentAgent,
          state: state as any,
          updatedAt: new Date(),
        },
      });
  }
}
```

#### Step 2: Update Database Schema
Add to `shared/schema.ts`:
```typescript
export const agentExecutions = pgTable('agent_executions', {
  id: serial('id').primaryKey(),
  projectId: varchar('project_id').references(() => projects.id).notNull(),
  agentName: varchar('agent_name', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),
});

export const agentStates = pgTable('agent_states', {
  id: serial('id').primaryKey(),
  projectId: varchar('project_id').references(() => projects.id).notNull().unique(),
  currentAgent: varchar('current_agent', { length: 100 }).notNull(),
  state: jsonb('state').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Acceptance Criteria:
- [ ] Orchestrator class created
- [ ] State graph configured with nodes and edges
- [ ] Conditional routing implemented
- [ ] State persistence to database
- [ ] Execution logging implemented
- [ ] Error handling in place

### Commit Message:
```
feat: create agent orchestration system

- Build AgentOrchestrator with LangGraph
- Implement state management and persistence
- Add conditional workflow routing
- Create execution logging system
- Add database tables for agent tracking

Closes #006
```

---

## TASK 007-020: Individual Agent Implementation

I'll provide one complete example agent implementation. You would repeat similar patterns for the remaining agents.

---

## TASK 007: Implement Intake Agent

**Sprint:** Week 5, Days 4-5  
**Priority:** P1  
**Estimated Time:** 6 hours  
**Dependencies:** TASK 006  

### Objective:
Create the Intake Agent that processes incoming RFPs and creates projects automatically.

### Implementation Steps:

#### Step 1: Create Intake Agent
Create `server/agents/intake-agent.ts`:
```typescript
import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import { ChatOpenAI } from '@langchain/openai';
import { db } from '../db';
import { projects, documents } from '../../shared/schema';
import { processFile } from '../lib/ingestion';

export class IntakeAgent extends BaseAgent {
  name = 'intake';
  description = 'Processes incoming RFPs and extracts metadata';
  
  private llm: ChatOpenAI;

  constructor() {
    super();
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0,
    });
  }

  async execute(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    try {
      this.log('Starting intake process', { context });

      // Get uploaded files from input
      const files = input.data.files || [];
      
      if (files.length === 0) {
        return {
          success: false,
          error: 'No files provided',
        };
      }

      // Extract metadata from documents
      const metadata = await this.extractMetadata(files);

      // Create project
      const [project] = await db
        .insert(projects)
        .values({
          id: context.projectId,
          name: metadata.projectName || 'Untitled Project',
          clientName: metadata.clientName || 'Unknown Client',
          metadata: metadata as any,
          status: 'Processing',
          createdAt: new Date(),
        })
        .returning();

      this.log('Project created', { projectId: project.id });

      // Process and store documents
      const processedDocs = [];
      for (const file of files) {
        const doc = await processFile(
          file.buffer,
          file.originalname,
          project.id
        );
        processedDocs.push(doc);
      }

      this.log('Documents processed', { count: processedDocs.length });

      return {
        success: true,
        data: {
          project,
          documents: processedDocs,
          metadata,
        },
        nextAgent: 'analysis',
      };
    } catch (error) {
      this.error('Intake failed', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async extractMetadata(files: any[]): Promise<any> {
    // Extract text from first few files
    const texts = files.slice(0, 3).map(f => f.text || '');
    const combinedText = texts.join('\n\n').slice(0, 10000);

    const prompt = `
Extract the following information from this RFP/construction document:

1. Project Name
2. Project Type (residential, commercial, infrastructure, etc.)
3. Location (city, state, country)
4. Estimated Budget (if mentioned)
5. Timeline/Deadline
6. Key Requirements (top 5)
7. Submission Deadline
8. Client/Owner Name
9. Contact Information

Document:
${combinedText}

Return ONLY a JSON object with these fields. Use null for missing data.
`;

    const response = await this.llm.invoke(prompt);
    
    try {
      const metadata = JSON.parse(response.content as string);
      return metadata;
    } catch (error) {
      this.error('Failed to parse metadata', error);
      return {};
    }
  }
}
```

#### Step 2: Register Agent with Orchestrator
Update `server/agents/index.ts`:
```typescript
import { AgentOrchestrator } from './orchestrator';
import { IntakeAgent } from './intake-agent';

export function createOrchestrator(): AgentOrchestrator {
  const orchestrator = new AgentOrchestrator();
  
  // Register agents
  orchestrator.registerAgent(new IntakeAgent());
  // More agents will be registered here
  
  return orchestrator;
}

export { AgentOrchestrator };
```

#### Step 3: Create API Endpoint
Update `server/routes.ts`:
```typescript
import { createOrchestrator } from './agents';

app.post('/api/agents/process', 
  authenticateToken,
  requirePermission(PERMISSIONS.PROJECT_CREATE),
  async (req: AuthRequest, res) => {
    try {
      const { files } = req.body;
      const projectId = crypto.randomUUID();

      const orchestrator = createOrchestrator();
      
      const result = await orchestrator.execute({
        projectId,
        userId: req.user!.userId,
        files,
      });

      res.json({
        projectId: result.projectId,
        status: result.status,
        currentAgent: result.currentAgent,
      });
    } catch (error) {
      console.error('Agent processing error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  }
);

app.get('/api/agents/:projectId/status',
  authenticateToken,
  async (req, res) => {
    try {
      const executions = await db
        .select()
        .from(agentExecutions)
        .where(eq(agentExecutions.projectId, req.params.projectId))
        .orderBy(desc(agentExecutions.startedAt));

      const [currentState] = await db
        .select()
        .from(agentStates)
        .where(eq(agentStates.projectId, req.params.projectId))
        .limit(1);

      res.json({
        executions,
        currentState,
        progress: calculateProgress(executions),
      });
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  }
);

function calculateProgress(executions: any[]): number {
  const total = 5; // Total agents
  const completed = executions.filter(e => e.status === 'completed').length;
  return Math.round((completed / total) * 100);
}
```

### Acceptance Criteria:
- [ ] IntakeAgent class created
- [ ] Metadata extraction using GPT-4o
- [ ] Project creation automated
- [ ] Documents processed and stored
- [ ] Agent registered with orchestrator
- [ ] API endpoint functional
- [ ] Status tracking works

### Testing:
```bash
# Test intake agent
curl -X POST http://localhost:3000/api/agents/process \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"files":[{"buffer":"...","originalname":"rfp.pdf"}]}'

# Check status
curl http://localhost:3000/api/agents/{projectId}/status \
  -H "Authorization: Bearer <TOKEN>"
```

### Commit Message:
```
feat: implement intake agent for RFP processing

- Create IntakeAgent with GPT-4o metadata extraction
- Automate project creation from RFPs
- Process and store documents automatically
- Add agent status tracking API
- Register agent with orchestrator

Closes #007
```

---

## 🎯 REMAINING TASKS SUMMARY

Due to length constraints, here's the summary of remaining tasks. Each follows the same detailed format as above:

### **TASK 008-012: Remaining AI Agents** (Week 6-7)
- TASK 008: Analysis Agent (RFP analysis automation)
- TASK 009: Decision Agent (Go/No-Go logic)
- TASK 010: Generation Agent (Bid content generation)
- TASK 011: Review Agent (Quality checking)
- TASK 012: Submission Agent (Final delivery)

### **TASK 013-015: Conflict Detection** (Week 9-10)
- TASK 013: Semantic Conflict Detection
- TASK 014: Numeric Conflict Detection
- TASK 015: Conflict UI Components

### **TASK 016-018: Win Probability ML** (Week 11-12)
- TASK 016: Feature Engineering
- TASK 017: Model Training (Python)
- TASK 018: Model Integration API

### **TASK 019-025: Mobile App** (Week 13-14)
- TASK 019: React Native Setup
- TASK 020: Authentication Flow
- TASK 021: Project List & Detail Views
- TASK 022: Document Camera Integration
- TASK 023: Push Notifications
- TASK 024: Offline Mode
- TASK 025: App Store Deployment

### **TASK 026-030: Enterprise Features** (Week 15-16)
- TASK 026: Multi-tenant Architecture
- TASK 027: SSO Integration (SAML/OAuth)
- TASK 028: Advanced RBAC
- TASK 029: Audit Logging
- TASK 030: White-label Capabilities

### **TASK 031-035: Data Network Effect** (Week 17-18)
- TASK 031: Anonymization Layer
- TASK 032: Data Aggregation Pipeline
- TASK 033: Benchmark Dashboard
- TASK 034: Opt-in Consent System
- TASK 035: Network Intelligence API

### **TASK 036-040: Launch Preparation** (Week 19-20)
- TASK 036: Performance Optimization
- TASK 037: Security Audit
- TASK 038: Documentation Complete
- TASK 039: Deployment Scripts
- TASK 040: Production Launch

---

## 📊 PROGRESS TRACKING

### Checklist Format:
```
Phase 0: Critical Foundations (Weeks 1-4)
├─ [✓] TASK 001: JWT Authentication
├─ [✓] TASK 002: RBAC
├─ [✓] TASK 003: Security Hardening
└─ [✓] TASK 004: Testing Infrastructure

Phase 1: AI Agents (Weeks 5-8)
├─ [✓] TASK 005: LangChain Setup
├─ [✓] TASK 006: Agent Orchestrator
├─ [✓] TASK 007: Intake Agent
├─ [ ] TASK 008: Analysis Agent
├─ [ ] TASK 009: Decision Agent
├─ [ ] TASK 010: Generation Agent
├─ [ ] TASK 011: Review Agent
└─ [ ] TASK 012: Submission Agent

[Continue for all phases...]
```

### Daily Commit Protocol:
1. Complete task
2. Write tests
3. Update documentation
4. Commit with proper message
5. Push to remote
6. Mark task complete in tracking
7. Move to next task

---

## 🎯 SUCCESS METRICS

Track these after each phase:

```typescript
interface PhaseMetrics {
  tasksCompleted: number;
  testCoverage: number; // Target: 70%+
  apiResponseTime: number; // Target: <500ms
  errorRate: number; // Target: <1%
  performance: {
    documentProcessing: number; // Target: <5s
    analysisGeneration: number; // Target: <30s
    bidGeneration: number; // Target: <60s
  };
}
```

---

## 📝 COMPLETION CRITERIA

### Phase 0 Complete When:
- [ ] All routes protected with auth
- [ ] RBAC working on all endpoints
- [ ] Rate limiting active
- [ ] 70%+ test coverage
- [ ] Security headers present
- [ ] No critical vulnerabilities

### Phase 1 Complete When:
- [ ] All 6 agents implemented
- [ ] Orchestrator routing correctly
- [ ] 80%+ automation achieved
- [ ] Processing time <30 minutes
- [ ] State persistence working
- [ ] Error handling robust

### Full Project Complete When:
- [ ] All 40 tasks completed
- [ ] 80%+ test coverage overall
- [ ] Production deployment successful
- [ ] Documentation complete
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] **10.0/10 rating achieved** ✓

---

## 🚀 GETTING STARTED

### For Replit Agent:

```
1. Read this entire document
2. Start with TASK 001
3. Follow implementation steps exactly
4. Complete all acceptance criteria
5. Run tests before committing
6. Move to next task
7. Report blockers immediately
8. Update progress tracking
9. Maintain code quality
10. Document as you go
```

### Agent Command Template:
```
Implement TASK [NUMBER]: [TASK NAME]

Follow the implementation steps in REPLIT_AGENT_IMPLEMENTATION_PLAN.md
Complete all acceptance criteria.
Write tests for all functionality.
Commit with proper message format.
Report completion and any blockers.
```

---

**Total Tasks:** 40  
**Estimated Timeline:** 20 weeks  
**Current Progress:** 0/40 (0%)  
**Target Rating:** 10.0/10  

**LET'S BUILD THIS! 🚀**
