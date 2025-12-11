import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { 
  PERMISSIONS, 
  hasPermission, 
  canAccessAllCompanies,
  hasAdminPrivileges,
  type Permission 
} from '../lib/permissions.js';
import { isSystemRole, isAdminRole } from '../../shared/schema.js';

/**
 * Middleware to require a specific permission
 */
export function requirePermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission 
      });
    }

    next();
  };
}

/**
 * Middleware to require one of the specified roles
 */
export function requireRole(roleName: string | string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allowedRoles = Array.isArray(roleName) ? roleName : [roleName];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles 
      });
    }

    next();
  };
}

/**
 * Middleware to require system admin role (full platform access)
 */
export function requireSystemAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'system_admin') {
    return res.status(403).json({ error: 'System admin access required' });
  }

  next();
}

/**
 * Middleware to require any system-level role (system_admin or system_user)
 */
export function requireSystemRole(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!isSystemRole(req.user.role as any)) {
    return res.status(403).json({ error: 'System-level access required' });
  }

  next();
}

/**
 * Middleware to require admin privileges (system_admin or company_admin)
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!isAdminRole(req.user.role as any)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

/**
 * Middleware to require company admin role
 */
export function requireCompanyAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // System admin can also access (they have full access)
  if (req.user.role !== 'company_admin' && req.user.role !== 'system_admin') {
    return res.status(403).json({ error: 'Company admin access required' });
  }

  next();
}

/**
 * Middleware to verify user can access the specified company's data
 * System roles can access any company, company roles can only access their own
 */
export function requireCompanyAccess(companyIdParam: string = 'companyId') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // System roles can access any company
    if (canAccessAllCompanies(req.user.role)) {
      return next();
    }

    // Get the company ID from params, body, or query
    const requestedCompanyId = 
      req.params[companyIdParam] || 
      req.body?.companyId || 
      req.query?.companyId;

    if (!requestedCompanyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }

    // Company roles can only access their own company
    if (req.user.companyId !== parseInt(requestedCompanyId as string)) {
      return res.status(403).json({ 
        error: 'Access denied: You can only access your own company\'s data' 
      });
    }

    next();
  };
}

/**
 * Middleware to ensure user can only access their own company's resources
 * Automatically scopes requests to the user's company
 */
export function scopeToCompany(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // For system roles, don't auto-scope (they can access all)
  if (canAccessAllCompanies(req.user.role)) {
    return next();
  }

  // For company roles, ensure companyId is set in the request
  if (!req.user.companyId) {
    return res.status(403).json({ error: 'User is not associated with a company' });
  }

  // Add companyId to request for downstream handlers
  req.body.companyId = req.user.companyId;
  
  next();
}

/**
 * Middleware to check if user can manage team members
 */
export function requireTeamManagement(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!hasPermission(req.user.role, PERMISSIONS.TEAM_MANAGE)) {
    return res.status(403).json({ error: 'Team management permission required' });
  }

  next();
}

export { PERMISSIONS };
