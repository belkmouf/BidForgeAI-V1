import { isSystemRole, isAdminRole, type UserRole } from '../../shared/schema.js';

export const PERMISSIONS = {
  // Project permissions
  PROJECT_CREATE: 'project:create',
  PROJECT_VIEW: 'project:view',
  PROJECT_EDIT: 'project:edit',
  PROJECT_DELETE: 'project:delete',
  PROJECT_ARCHIVE: 'project:archive',
  
  // Document permissions
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_VIEW: 'document:view',
  DOCUMENT_DELETE: 'document:delete',
  
  // Analysis permissions
  ANALYSIS_RUN: 'analysis:run',
  ANALYSIS_VIEW: 'analysis:view',
  
  // Bid generation permissions
  GENERATION_CREATE: 'generation:create',
  GENERATION_EDIT: 'generation:edit',
  
  // Team management (within company)
  TEAM_VIEW: 'team:view',
  TEAM_INVITE: 'team:invite',
  TEAM_MANAGE: 'team:manage',
  
  // Company settings
  COMPANY_SETTINGS_VIEW: 'company:settings:view',
  COMPANY_SETTINGS_EDIT: 'company:settings:edit',
  
  // Template management
  TEMPLATE_VIEW: 'template:view',
  TEMPLATE_CREATE: 'template:create',
  TEMPLATE_EDIT: 'template:edit',
  TEMPLATE_DELETE: 'template:delete',
  
  // Knowledge base
  KNOWLEDGE_VIEW: 'knowledge:view',
  KNOWLEDGE_UPLOAD: 'knowledge:upload',
  KNOWLEDGE_DELETE: 'knowledge:delete',
  
  // WhatsApp/communication
  WHATSAPP_SEND: 'whatsapp:send',
  
  // System-level permissions (cross-company)
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_VIEW_ALL_COMPANIES: 'system:view_all_companies',
  SYSTEM_MANAGE_COMPANIES: 'system:manage_companies',
  SYSTEM_VIEW_PLATFORM_STATS: 'system:view_platform_stats',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Role-based permission mapping
 * 
 * system_admin: Full access to everything (all companies, all features)
 * system_user: Platform access with partial authority (view across platform, limited actions)
 * company_admin: Full access within their company
 * company_user: Limited access within their company
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // System Admin: Full access to everything
  system_admin: [
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_EDIT,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_ARCHIVE,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_DELETE,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.ANALYSIS_VIEW,
    PERMISSIONS.GENERATION_CREATE,
    PERMISSIONS.GENERATION_EDIT,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.COMPANY_SETTINGS_VIEW,
    PERMISSIONS.COMPANY_SETTINGS_EDIT,
    PERMISSIONS.TEMPLATE_VIEW,
    PERMISSIONS.TEMPLATE_CREATE,
    PERMISSIONS.TEMPLATE_EDIT,
    PERMISSIONS.TEMPLATE_DELETE,
    PERMISSIONS.KNOWLEDGE_VIEW,
    PERMISSIONS.KNOWLEDGE_UPLOAD,
    PERMISSIONS.KNOWLEDGE_DELETE,
    PERMISSIONS.WHATSAPP_SEND,
    PERMISSIONS.SYSTEM_ADMIN,
    PERMISSIONS.SYSTEM_VIEW_ALL_COMPANIES,
    PERMISSIONS.SYSTEM_MANAGE_COMPANIES,
    PERMISSIONS.SYSTEM_VIEW_PLATFORM_STATS,
  ],
  
  // System User: Platform access with partial authority
  system_user: [
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.ANALYSIS_VIEW,
    PERMISSIONS.TEMPLATE_VIEW,
    PERMISSIONS.KNOWLEDGE_VIEW,
    PERMISSIONS.SYSTEM_VIEW_ALL_COMPANIES,
    PERMISSIONS.SYSTEM_VIEW_PLATFORM_STATS,
  ],
  
  // Company Admin: Full access within their company
  company_admin: [
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_EDIT,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_ARCHIVE,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_DELETE,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.ANALYSIS_VIEW,
    PERMISSIONS.GENERATION_CREATE,
    PERMISSIONS.GENERATION_EDIT,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.COMPANY_SETTINGS_VIEW,
    PERMISSIONS.COMPANY_SETTINGS_EDIT,
    PERMISSIONS.TEMPLATE_VIEW,
    PERMISSIONS.TEMPLATE_CREATE,
    PERMISSIONS.TEMPLATE_EDIT,
    PERMISSIONS.TEMPLATE_DELETE,
    PERMISSIONS.KNOWLEDGE_VIEW,
    PERMISSIONS.KNOWLEDGE_UPLOAD,
    PERMISSIONS.KNOWLEDGE_DELETE,
    PERMISSIONS.WHATSAPP_SEND,
  ],
  
  // Company User: Limited access within their company
  company_user: [
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_EDIT,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.ANALYSIS_RUN,
    PERMISSIONS.ANALYSIS_VIEW,
    PERMISSIONS.GENERATION_CREATE,
    PERMISSIONS.GENERATION_EDIT,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEMPLATE_VIEW,
    PERMISSIONS.KNOWLEDGE_VIEW,
    PERMISSIONS.WHATSAPP_SEND,
  ],
};

/**
 * Check if a user has a specific permission based on their role
 */
export function hasPermission(userRole: string, requiredPermission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole as UserRole] || [];
  
  // System admin has all permissions
  if (rolePermissions.includes(PERMISSIONS.SYSTEM_ADMIN)) {
    return true;
  }
  
  return rolePermissions.includes(requiredPermission);
}

/**
 * Get all permissions for a given role
 */
export function getUserPermissions(userRole: string): Permission[] {
  return ROLE_PERMISSIONS[userRole as UserRole] || [];
}

/**
 * Check if user can access data across all companies
 */
export function canAccessAllCompanies(userRole: string): boolean {
  return isSystemRole(userRole as UserRole);
}

/**
 * Check if user has admin-level privileges (within their scope)
 */
export function hasAdminPrivileges(userRole: string): boolean {
  return isAdminRole(userRole as UserRole);
}

/**
 * Check if user can manage team members
 */
export function canManageTeam(userRole: string): boolean {
  return hasPermission(userRole, PERMISSIONS.TEAM_MANAGE);
}

/**
 * Check if user can modify company settings
 */
export function canEditCompanySettings(userRole: string): boolean {
  return hasPermission(userRole, PERMISSIONS.COMPANY_SETTINGS_EDIT);
}
