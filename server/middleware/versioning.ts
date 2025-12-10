import { Request, Response, NextFunction } from 'express';
import { logger, logContext } from '../lib/logger.js';

export interface VersionedRequest extends Request {
  apiVersion: string;
  isLatestVersion: boolean;
  deprecationWarning?: string;
}

export interface VersionConfig {
  current: string;
  supported: string[];
  deprecated: string[];
  sunset: { [version: string]: Date };
  defaultVersion: string;
}

export const API_VERSIONS: VersionConfig = {
  current: '1.0.0',
  supported: ['1.0.0'],
  deprecated: [],
  sunset: {},
  defaultVersion: '1.0.0'
};

/**
 * Extract API version from request
 * Supports multiple version extraction methods:
 * 1. URL path: /api/v1/endpoint
 * 2. Accept header: Accept: application/vnd.bidforge.v1+json
 * 3. Custom header: X-API-Version: 1.0.0
 * 4. Query parameter: ?version=1.0.0
 */
function extractApiVersion(req: Request): string | null {
  // Method 1: URL path versioning
  const pathMatch = req.path.match(/^\/api\/v(\d+(?:\.\d+)*)\//);
  if (pathMatch) {
    return pathMatch[1] + '.0'; // Convert v1 to 1.0.0 format
  }
  
  // Method 2: Accept header versioning
  const acceptHeader = req.headers.accept;
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/application\/vnd\.bidforge\.v(\d+(?:\.\d+)*)\+json/);
    if (versionMatch) {
      return versionMatch[1];
    }
  }
  
  // Method 3: Custom header versioning
  const versionHeader = req.headers['x-api-version'] as string;
  if (versionHeader) {
    return versionHeader;
  }
  
  // Method 4: Query parameter versioning
  const versionQuery = req.query.version as string;
  if (versionQuery) {
    return versionQuery;
  }
  
  return null;
}

/**
 * Normalize version string to semver format
 */
function normalizeVersion(version: string): string {
  if (!version) return API_VERSIONS.defaultVersion;
  
  // Convert v1, v1.0, etc. to proper semver
  const cleaned = version.replace(/^v/, '');
  const parts = cleaned.split('.');
  
  while (parts.length < 3) {
    parts.push('0');
  }
  
  return parts.slice(0, 3).join('.');
}

/**
 * Check if version is supported
 */
function isVersionSupported(version: string): boolean {
  return API_VERSIONS.supported.includes(version);
}

/**
 * Check if version is deprecated
 */
function isVersionDeprecated(version: string): boolean {
  return API_VERSIONS.deprecated.includes(version);
}

/**
 * Check if version is sunset (no longer supported)
 */
function isVersionSunset(version: string): boolean {
  const sunsetDate = API_VERSIONS.sunset[version];
  return sunsetDate ? new Date() > sunsetDate : false;
}

/**
 * Get deprecation warning for version
 */
function getDeprecationWarning(version: string): string | undefined {
  if (isVersionDeprecated(version)) {
    const sunsetDate = API_VERSIONS.sunset[version];
    if (sunsetDate) {
      return `API version ${version} is deprecated and will be sunset on ${sunsetDate.toISOString().split('T')[0]}. Please upgrade to version ${API_VERSIONS.current}.`;
    }
    return `API version ${version} is deprecated. Please upgrade to version ${API_VERSIONS.current}.`;
  }
  return undefined;
}

/**
 * API versioning middleware
 */
export function apiVersioning(req: VersionedRequest, res: Response, next: NextFunction): void {
  const extractedVersion = extractApiVersion(req);
  const version = normalizeVersion(extractedVersion || API_VERSIONS.defaultVersion);
  
  // Check if version is sunset
  if (isVersionSunset(version)) {
    logContext.api('Sunset API version requested', {
      method: req.method,
      path: req.path,
      statusCode: 410,
      duration: 0,
      userId: (req as any).user?.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: `API version ${version} is no longer supported`
    });
    
    res.status(410).json({
      error: 'API Version No Longer Supported',
      message: `API version ${version} has been sunset and is no longer supported.`,
      currentVersion: API_VERSIONS.current,
      upgradeRequired: true,
      documentationUrl: '/docs/api/migration'
    });
    return;
  }
  
  // Check if version is supported
  if (!isVersionSupported(version)) {
    logContext.api('Unsupported API version requested', {
      method: req.method,
      path: req.path,
      statusCode: 400,
      duration: 0,
      userId: (req as any).user?.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: `API version ${version} is not supported`
    });
    
    res.status(400).json({
      error: 'Unsupported API Version',
      message: `API version ${version} is not supported.`,
      supportedVersions: API_VERSIONS.supported,
      currentVersion: API_VERSIONS.current,
      defaultVersion: API_VERSIONS.defaultVersion
    });
    return;
  }
  
  // Set version information on request
  req.apiVersion = version;
  req.isLatestVersion = version === API_VERSIONS.current;
  req.deprecationWarning = getDeprecationWarning(version);
  
  // Set response headers
  res.setHeader('X-API-Version', version);
  res.setHeader('X-API-Current-Version', API_VERSIONS.current);
  res.setHeader('X-API-Supported-Versions', API_VERSIONS.supported.join(', '));
  
  // Add deprecation warning header if applicable
  if (req.deprecationWarning) {
    res.setHeader('X-API-Deprecation-Warning', req.deprecationWarning);
    res.setHeader('Sunset', API_VERSIONS.sunset[version]?.toISOString() || '');
    
    logContext.api('Deprecated API version used', {
      method: req.method,
      path: req.path,
      statusCode: 200,
      duration: 0,
      userId: (req as any).user?.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: `Deprecated version ${version} used`
    });
  }
  
  // Log version usage for analytics
  logContext.api('API version detected', {
    method: req.method,
    path: req.path,
    statusCode: 200,
    duration: 0,
    userId: (req as any).user?.userId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  next();
}

/**
 * Version-specific route handler wrapper
 */
export function versionedRoute(
  version: string,
  handler: (req: VersionedRequest, res: Response, next: NextFunction) => void
) {
  return (req: VersionedRequest, res: Response, next: NextFunction) => {
    if (req.apiVersion === version) {
      return handler(req, res, next);
    }
    next(); // Continue to next middleware/route
  };
}

/**
 * Create version-aware response helper
 */
export function createVersionedResponse(req: VersionedRequest, res: Response) {
  const originalJson = res.json.bind(res);
  
  res.json = function(data: any) {
    // Add versioning metadata to response
    const versionedData = {
      ...data,
      _meta: {
        apiVersion: req.apiVersion,
        isLatestVersion: req.isLatestVersion,
        deprecationWarning: req.deprecationWarning,
        timestamp: new Date().toISOString()
      }
    };
    
    return originalJson(versionedData);
  };
  
  return res;
}

/**
 * Version migration helper
 */
export function migrateResponse(
  data: any,
  fromVersion: string,
  toVersion: string
): any {
  // Implement specific migration logic between versions
  // This is where you'd handle breaking changes between API versions
  
  if (fromVersion === '1.0.0' && toVersion === '1.1.0') {
    // Example migration: rename field
    if (data.projectName) {
      data.name = data.projectName;
      delete data.projectName;
    }
  }
  
  return data;
}

/**
 * Backwards compatibility middleware
 */
export function backwardsCompatibility(req: VersionedRequest, res: Response, next: NextFunction): void {
  // Handle backwards compatibility transformations here
  
  // Example: Convert old parameter names to new ones
  if (req.apiVersion === '1.0.0') {
    if (req.query.projectName) {
      req.query.name = req.query.projectName;
      delete req.query.projectName;
    }
    
    if (req.body?.projectName) {
      req.body.name = req.body.projectName;
      delete req.body.projectName;
    }
  }
  
  next();
}

/**
 * Generate API documentation links based on version
 */
export function getDocumentationUrl(version: string, endpoint?: string): string {
  const baseUrl = '/docs/api';
  const versionPath = version === API_VERSIONS.current ? '' : `/v${version.split('.')[0]}`;
  const endpointPath = endpoint ? `#${endpoint}` : '';
  
  return `${baseUrl}${versionPath}${endpointPath}`;
}

/**
 * Version analytics helper
 */
export function trackVersionUsage(req: VersionedRequest): void {
  logContext.system('API version usage', {
    event: 'version_usage',
    severity: 'low',
    metadata: {
      version: req.apiVersion,
      isLatest: req.isLatestVersion,
      isDeprecated: isVersionDeprecated(req.apiVersion),
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId
    }
  });
}

export default apiVersioning;