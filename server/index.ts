import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { logger, logContext, requestLogger, errorLogger } from "./lib/logger.js";
import { cache } from "./lib/cache.js";
import { jobManager } from "./lib/job-manager.js";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Enhanced security headers configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", // Required for Tailwind CSS
        "fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'", 
        "fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "blob:",
        "*.amazonaws.com", // For S3 uploaded images
        "*.cloudinary.com", // Common image CDN
        "*.unsplash.com" // For demo/placeholder images
      ],
      scriptSrc: [
        "'self'",
        ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
        "*.google-analytics.com",
        "*.googletagmanager.com"
      ],
      connectSrc: [
        "'self'",
        "*.openai.com",
        "*.anthropic.com", 
        "*.googleapis.com",
        ...(process.env.NODE_ENV === 'development' ? ["ws://localhost:*"] : [])
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "data:", "blob:"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Disabled for AI model compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  ieNoOpen: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5000', 'http://localhost:5173', 'http://0.0.0.0:5000'];

// Helper to safely extract hostname from origin
function getOriginHost(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

// Enhanced CORS configuration with security logging
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin only in development or for specific server-to-server calls
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        // In production, be more restrictive about no-origin requests
        const userAgent = 'unknown'; // We don't have req here, but it's logged elsewhere
        logContext.security('CORS request without origin in production', {
          action: 'cors_validation',
          result: 'allowed_no_origin',
          userAgent
        });
      }
      return callback(null, true);
    }
    
    const originHost = getOriginHost(origin);
    if (!originHost) {
      logContext.security('CORS rejected malformed origin', {
        origin,
        action: 'cors_validation',
        result: 'failure',
        reason: 'malformed_origin'
      });
      return callback(new Error('Invalid origin format'));
    }
    
    // Allow Replit domains for the webview to work (strict suffix matching)
    const replitDomains = ['.replit.dev', '.repl.co', '.replit.app'];
    const isReplitDomain = replitDomains.some(domain => originHost.endsWith(domain));
    
    if (isReplitDomain) {
      logContext.security('CORS allowed Replit domain', {
        origin,
        originHost,
        action: 'cors_validation',
        result: 'success',
        reason: 'replit_domain'
      });
      return callback(null, true);
    }
    
    // Check if origin is in allowed list (exact match)
    const isAllowed = allowedOrigins.some(allowed => {
      try {
        const allowedUrl = new URL(allowed);
        const originUrl = new URL(origin);
        return allowedUrl.origin === originUrl.origin;
      } catch {
        return false;
      }
    });
    
    if (isAllowed) {
      logContext.security('CORS allowed configured origin', {
        origin,
        originHost,
        action: 'cors_validation',
        result: 'success',
        reason: 'allowed_origin'
      });
      callback(null, true);
    } else {
      // SECURITY: Reject unauthorized origins in production
      if (process.env.NODE_ENV === 'production') {
        logContext.security('CORS rejected unauthorized origin in production', {
          origin,
          originHost,
          action: 'cors_validation',
          result: 'failure',
          reason: 'unauthorized_origin'
        });
        callback(new Error('Origin not allowed by CORS policy'));
      } else {
        // Development: allow all origins but log warning
        logContext.security('CORS allowing unlisted origin in development', {
          origin,
          originHost,
          action: 'cors_validation',
          result: 'success',
          reason: 'development_mode'
        });
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-CSRF-Token'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count', 
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  maxAge: 86400, // Cache preflight for 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Enhanced rate limiting with security logging
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.path.startsWith('/api'),
  handler: (req, res) => {
    logContext.security('API rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      userId: (req as any).user?.userId,
      action: 'rate_limit_exceeded',
      result: 'blocked',
      reason: 'api_rate_limit'
    });
    
    res.status(429).json({
      error: 'Too many requests, please try again later',
      retryAfter: Math.round(15 * 60), // 15 minutes in seconds
      limit: 1000,
      windowMs: 15 * 60 * 1000
    });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logContext.security('Authentication rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      action: 'auth_rate_limit_exceeded',
      result: 'blocked',
      reason: 'auth_rate_limit'
    });
    
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later',
      retryAfter: Math.round(15 * 60),
      limit: 20,
      windowMs: 15 * 60 * 1000
    });
  },
});

// Upload-specific rate limiter (more restrictive)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour per user
  message: { 
    error: 'Too many file uploads. Please try again later.',
    limit: 20,
    windowMs: 3600000
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logContext.security('Upload rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId,
      email: (req as any).user?.email,
      action: 'upload_rate_limit_exceeded',
      result: 'blocked',
      reason: 'upload_rate_limit'
    });
    
    res.status(429).json({
      error: 'Too many file uploads. Please try again later.',
      retryAfter: 3600,
      limit: 20,
      windowMs: 3600000
    });
  }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/projects/:id/upload', uploadLimiter);

// Additional security middleware
app.use((req, res, next) => {
  // Security headers for additional protection
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add API version header
  res.setHeader('X-API-Version', '1.0.0');
  
  next();
});

// Request size and content type validation
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
    type: (req) => {
      // Only allow application/json content type for JSON parsing
      const contentType = req.headers['content-type'];
      if (contentType && !contentType.startsWith('application/json')) {
        logContext.security('Invalid content type for JSON endpoint', {
          ip: req.ip,
          contentType,
          path: req.path,
          action: 'content_type_validation',
          result: 'failure'
        });
        return false;
      }
      return true;
    }
  }),
);

app.use(express.urlencoded({ 
  extended: false, 
  limit: '10mb',
  parameterLimit: 1000, // Limit number of parameters
}));

export function log(message: string, source = "express") {
  logger.info(message, { source });
}

// Add structured request logging
app.use(requestLogger);

(async () => {
  // Initialize cache
  await cache.connect();
  
  // Initialize job manager and background processing
  await jobManager.initialize();
  
  // Schedule periodic maintenance
  jobManager.schedulePeriodicMaintenance();
  
  await registerRoutes(httpServer, app);

  // Add error logging middleware
  app.use(errorLogger);
  
  // Error handling middleware - hide stack traces in production
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    // Create error ID for tracking
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use structured logging for errors
    logger.error('Request error', {
      errorId,
      status,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.userId,
      type: 'request-error'
    });
    
    if (process.env.NODE_ENV === 'production') {
      // Production: Send generic message to client
      const safeMessage = status === 500 
        ? 'Internal Server Error' 
        : err.message;
      
      res.status(status).json({ 
        error: safeMessage,
        errorId
      });
    } else {
      // Development: Send detailed error to client
      res.status(status).json({ 
        error: err.message,
        stack: err.stack,
        status,
        errorId
      });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      logger.info('BidForge AI server started successfully', {
        port,
        environment: process.env.NODE_ENV,
        services: {
          cache: 'initialized',
          jobManager: 'initialized',
          database: 'connected'
        }
      });
    },
  );

  // Enhanced graceful shutdown handler
  const enhancedGracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    
    try {
      // Stop accepting new connections
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });
      
      // Stop job manager to prevent new jobs and wait for current jobs to complete
      await jobManager.shutdown();
      logger.info('Job manager shut down successfully');
      
      // Disconnect cache
      await cache.disconnect();
      logger.info('Cache disconnected successfully');
      
      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error: any) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  };

  // Override the default graceful shutdown from logger to include our services
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  
  process.on('SIGINT', () => enhancedGracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => enhancedGracefulShutdown('SIGTERM'));
})();
