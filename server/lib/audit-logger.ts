import winston from 'winston';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || './logs';

const auditFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.json()
);

export interface AuditLogEntry {
  userId?: number;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource?: string;
  resourceId?: string | number;
  status: 'success' | 'failure' | 'attempt';
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
  duration?: number;
}

const auditLogger = winston.createLogger({
  level: 'info',
  format: auditFormat,
  defaultMeta: { service: 'bidforge-ai' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'audit.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
      tailable: true,
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'audit-error.log'), 
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  auditLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, action, userId, status, resource }) => {
        return `${timestamp} [${level}] ${action} by user:${userId || 'anonymous'} on ${resource || 'system'} - ${status}`;
      })
    ),
  }));
}

export function logAuditEvent(entry: AuditLogEntry): void {
  const sanitizedDetails = entry.details ? sanitizeForLogging(entry.details) : undefined;
  
  auditLogger.info({
    ...entry,
    details: sanitizedDetails,
  });
}

export function logSecurityEvent(entry: AuditLogEntry & { severity: 'low' | 'medium' | 'high' | 'critical' }): void {
  const logLevel = entry.severity === 'critical' || entry.severity === 'high' ? 'error' : 'warn';
  
  auditLogger.log(logLevel, {
    ...entry,
    eventType: 'security',
    details: entry.details ? sanitizeForLogging(entry.details) : undefined,
  });
}

export function logAuthEvent(
  action: 'login' | 'logout' | 'register' | 'password_change' | 'token_refresh' | 'login_failed',
  userId: number | undefined,
  email: string,
  status: 'success' | 'failure',
  ip?: string,
  userAgent?: string,
  details?: Record<string, any>
): void {
  logAuditEvent({
    userId,
    userEmail: email,
    action: `auth:${action}`,
    resource: 'authentication',
    status,
    ip,
    userAgent,
    details,
  });
}

export function logAccessEvent(
  userId: number,
  action: string,
  resource: string,
  resourceId: string | number,
  status: 'success' | 'failure',
  details?: Record<string, any>
): void {
  logAuditEvent({
    userId,
    action,
    resource,
    resourceId,
    status,
    details,
  });
}

export function logWhatsAppEvent(
  userId: number,
  action: 'send_message' | 'send_document' | 'send_template' | 'receive_message',
  recipient: string,
  status: 'success' | 'failure',
  details?: Record<string, any>
): void {
  logAuditEvent({
    userId,
    action: `whatsapp:${action}`,
    resource: 'whatsapp',
    resourceId: maskPhoneNumber(recipient),
    status,
    details: {
      ...details,
      recipient: maskPhoneNumber(recipient),
    },
  });
}

function sanitizeForLogging(obj: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie', 'creditCard', 'ssn'];
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

function maskPhoneNumber(phone: string): string {
  if (!phone) return '***';
  if (phone.length <= 4) return '*'.repeat(phone.length);
  if (phone.length <= 8) {
    return phone.substring(0, 2) + '*'.repeat(phone.length - 2);
  }
  const visibleStart = Math.min(3, Math.floor(phone.length / 4));
  const visibleEnd = Math.min(3, Math.floor(phone.length / 4));
  const maskLength = phone.length - visibleStart - visibleEnd;
  return phone.substring(0, visibleStart) + '*'.repeat(maskLength) + phone.substring(phone.length - visibleEnd);
}

export { auditLogger };
