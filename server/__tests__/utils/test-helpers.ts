import { db } from '../../db';
import { users, sessions, projects, documents, documentChunks } from '../../../shared/schema';
import { hashPassword, generateAccessToken, generateRefreshToken, hashRefreshToken } from '../../lib/auth';
import { eq } from 'drizzle-orm';

export interface TestUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
}

export interface CreateTestUserResult {
  user: TestUser;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export async function createTestUser(data?: {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
}): Promise<CreateTestUserResult> {
  const email = data?.email || `test-${Date.now()}@example.com`;
  const password = data?.password || 'TestPassword123!';
  const name = data?.name || 'Test User';
  const role = data?.role || 'user';

  const passwordHash = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name,
      role,
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

  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    },
    password,
    accessToken,
    refreshToken,
  };
}

export async function cleanupTestUsers() {
  await db.delete(sessions);
  await db.delete(users).where(eq(users.email, users.email));
}

export async function cleanupTestProjects() {
  await db.delete(documentChunks);
  await db.delete(documents);
  await db.delete(projects);
}

export async function cleanupDatabase() {
  await db.delete(sessions);
  await cleanupTestProjects();
  await db.delete(users);
}

export function generateRandomEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

export function generateRandomProjectId(): string {
  return `proj-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
