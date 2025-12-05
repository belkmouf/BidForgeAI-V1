export const PERMISSIONS = {
  PROJECT_CREATE: 'project:create',
  PROJECT_VIEW: 'project:view',
  PROJECT_EDIT: 'project:edit',
  PROJECT_DELETE: 'project:delete',
  
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_VIEW: 'document:view',
  DOCUMENT_DELETE: 'document:delete',
  
  ANALYSIS_RUN: 'analysis:run',
  ANALYSIS_VIEW: 'analysis:view',
  
  GENERATION_CREATE: 'generation:create',
  GENERATION_EDIT: 'generation:edit',
  
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  
  SYSTEM_ADMIN: 'system:admin',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
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

export function hasPermission(userRole: string, requiredPermission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(requiredPermission) || rolePermissions.includes(PERMISSIONS.SYSTEM_ADMIN);
}

export function getUserPermissions(userRole: string): Permission[] {
  return ROLE_PERMISSIONS[userRole] || [];
}
