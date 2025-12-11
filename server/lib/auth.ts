import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

const getJwtSecret = (): string => {
  // Use SESSION_SECRET for JWT signing (already configured in deployment)
  // Fall back to JWT_SECRET for backwards compatibility
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET or JWT_SECRET environment variable is required in production",
    );
  }
  return (
    secret || "bidforge-dev-secret-" + crypto.randomBytes(16).toString("hex")
  );
};

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = "24h";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  companyId: number | null;
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string,
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

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateEmail(email: string): boolean {
  // RFC 5322 simplified email validation
  // - No consecutive dots
  // - Must have @ symbol
  // - Domain must have at least 2 chars after last dot (TLD)
  // - No spaces
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Additional checks
  if (!emailRegex.test(email)) return false;
  if (email.includes("..")) return false; // No consecutive dots
  if (email.split("@").length !== 2) return false; // Exactly one @

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return false; // Both parts must exist
  if (!domain.includes(".")) return false; // Domain must have a dot

  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) return false; // TLD must be at least 2 characters

  return true;
}

export async function hashRefreshToken(token: string): Promise<string> {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyRefreshTokenHash(token: string, hash: string): boolean {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return tokenHash === hash;
}
