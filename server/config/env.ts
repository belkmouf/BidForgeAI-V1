import { z } from 'zod';

/**
 * Environment variable validation schema
 * Ensures all required configuration is present and valid
 */
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string()
    .default('5000')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  
  // Database Configuration - REQUIRED
  DATABASE_URL: z.string()
    .min(1, 'DATABASE_URL is required'),
  
  // Security - JWT/Session (required in production)
  JWT_SECRET: z.string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security')
    .default('dev-jwt-secret-do-not-use-in-production-minimum-32-chars'),
  SESSION_SECRET: z.string()
    .min(32, 'SESSION_SECRET must be at least 32 characters for security')
    .default('dev-session-secret-do-not-use-in-production-32-chars'),
  
  // CORS Configuration
  ALLOWED_ORIGINS: z.string()
    .default('http://localhost:5000,http://localhost:5173')
    .transform(val => val.split(',').map(s => s.trim())),
  
  // AI API Keys (at least one recommended)
  OPENAI_API_KEY: z.string().min(10).optional(),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  GOOGLE_API_KEY: z.string().min(10).optional(),
  DEEPSEEK_API_KEY: z.string().min(10).optional(),
  
  // WhatsApp Integration (optional)
  WA_PHONE_NUMBER_ID: z.string().optional(),
  CLOUD_API_ACCESS_TOKEN: z.string().optional(),
  WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WA_APP_SECRET: z.string().optional(),
});

// Type for validated environment
type ValidatedEnv = z.infer<typeof envSchema>;

// Parse and validate environment variables
let validatedEnv: ValidatedEnv;

try {
  validatedEnv = envSchema.parse(process.env);
  
  // Log which AI providers are configured (without exposing keys)
  const configuredProviders = [];
  if (validatedEnv.OPENAI_API_KEY) configuredProviders.push('OpenAI');
  if (validatedEnv.ANTHROPIC_API_KEY) configuredProviders.push('Anthropic');
  if (validatedEnv.GOOGLE_API_KEY) configuredProviders.push('Google');
  if (validatedEnv.DEEPSEEK_API_KEY) configuredProviders.push('DeepSeek');
  
  if (configuredProviders.length > 0) {
    console.log(`[env] AI Providers configured: ${configuredProviders.join(', ')}`);
  } else {
    console.warn('[env] No AI API keys configured - AI features may not work');
  }
  
} catch (error) {
  console.error('[env] Environment validation failed:');
  if (error instanceof z.ZodError) {
    error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  } else {
    console.error(error);
  }
  console.error('[env] Please check your environment variables.');
  
  // In production, always fail if validation errors
  if (process.env.NODE_ENV === 'production') {
    console.error('[env] FATAL: Cannot start in production with invalid configuration.');
    process.exit(1);
  }
  
  // In development, warn about using default secrets (not secure)
  console.warn('[env] Using development defaults. DO NOT USE IN PRODUCTION.');
  validatedEnv = {
    NODE_ENV: 'development',
    PORT: 5000,
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_SECRET: 'dev-jwt-secret-do-not-use-in-production-minimum-32-chars',
    SESSION_SECRET: 'dev-session-secret-do-not-use-in-production-32-chars',
    ALLOWED_ORIGINS: ['http://localhost:5000', 'http://localhost:5173'],
  } as ValidatedEnv;
}

export const env = validatedEnv;

/**
 * Check if a specific AI provider is configured
 */
export function isAIProviderConfigured(provider: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'grok'): boolean {
  switch (provider) {
    case 'openai': return !!env.OPENAI_API_KEY;
    case 'anthropic': return !!env.ANTHROPIC_API_KEY;
    case 'gemini': return !!env.GOOGLE_API_KEY;
    case 'deepseek': return !!env.DEEPSEEK_API_KEY;
    case 'grok': return !!process.env.XAI_API_KEY;
    default: return false;
  }
}

/**
 * Get list of configured AI providers
 */
export function getConfiguredAIProviders(): string[] {
  const providers: string[] = [];
  if (env.OPENAI_API_KEY) providers.push('openai');
  if (env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (env.GOOGLE_API_KEY) providers.push('gemini');
  if (env.DEEPSEEK_API_KEY) providers.push('deepseek');
  if (process.env.XAI_API_KEY) providers.push('grok');
  return providers;
}

/**
 * Log environment configuration (without sensitive data)
 */
export function logEnvironmentInfo() {
  console.log('[env] Configuration:');
  console.log(`  Environment: ${env.NODE_ENV}`);
  console.log(`  Port: ${env.PORT}`);
  console.log(`  Allowed Origins: ${env.ALLOWED_ORIGINS.length} configured`);
  console.log(`  Database: ${env.DATABASE_URL ? 'configured' : 'not configured'}`);
}
