# Code Reorganization Plan

## Overview
The `server/routes.ts` file is 4177+ lines and needs to be split into feature-based route modules for better maintainability.

## Current Structure
- Single large `routes.ts` file with all routes
- Some routes already extracted (auth, agents, analytics, etc.)
- Many routes still in main file

## Target Structure

```
server/routes/
├── auth.ts                    ✅ Already exists
├── agents.ts                  ✅ Already exists
├── agent-progress.ts          ✅ Already exists
├── conflicts.ts               ✅ Already exists
├── win-probability.ts         ✅ Already exists
├── team.ts                    ✅ Already exists
├── audit.ts                   ✅ Already exists
├── analytics.ts               ✅ Already exists
├── reports.ts                 ✅ Already exists
├── admin.ts                   ✅ Already exists
├── document-summary.ts        ✅ Already exists
├── website-info.ts            ✅ Already exists
├── v1/
│   └── index.ts               ✅ Already exists
├── projects.ts                ⚠️ TO CREATE
├── documents.ts                ⚠️ TO CREATE
├── bids.ts                     ⚠️ TO CREATE
├── templates.ts                ⚠️ TO CREATE
├── knowledge-base.ts           ⚠️ TO CREATE
├── whatsapp.ts                 ⚠️ TO CREATE
├── analysis.ts                 ⚠️ TO CREATE
├── checklist.ts                ⚠️ TO CREATE
├── requirements.ts             ⚠️ TO CREATE
├── vendors.ts                  ⚠️ TO CREATE
├── dashboard.ts                ⚠️ TO CREATE
├── branding.ts                 ⚠️ TO CREATE
├── public.ts                   ⚠️ TO CREATE
├── ai-instructions.ts          ⚠️ TO CREATE
└── uploads.ts                  ⚠️ TO CREATE
```

## Extraction Plan

### Phase 1: Core Routes (High Priority)
1. **projects.ts** - Project CRUD, workflow status, archive/unarchive
2. **documents.ts** - Document upload, list, delete, download
3. **bids.ts** - Bid generation, refinement, listing

### Phase 2: Feature Routes (Medium Priority)
4. **templates.ts** - Template CRUD, upload
5. **analysis.ts** - RFP analysis, alerts, decision logs
6. **checklist.ts** - Checklist generation, verification
7. **requirements.ts** - Requirements extraction

### Phase 3: Integration Routes (Lower Priority)
8. **whatsapp.ts** - WhatsApp messaging, webhooks
9. **knowledge-base.ts** - Knowledge base document management
10. **vendors.ts** - Vendor database management
11. **dashboard.ts** - Dashboard statistics
12. **branding.ts** - Branding profile management
13. **public.ts** - Public bid sharing
14. **ai-instructions.ts** - AI instruction templates
15. **uploads.ts** - File uploads (logo, etc.)

## Implementation Steps

1. Create route files using Express Router pattern
2. Extract route handlers from `routes.ts`
3. Update `routes.ts` to import and register new route modules
4. Test each module independently
5. Remove old code from `routes.ts`

## Benefits

- **Maintainability**: Easier to find and modify specific features
- **Testability**: Can test routes in isolation
- **Scalability**: Easier to add new routes
- **Code Organization**: Clear separation of concerns
- **Reduced File Size**: Main routes.ts becomes a simple registry

## Notes

- All route files should follow the existing pattern (Express Router)
- Maintain authentication middleware usage
- Preserve all existing functionality
- Update imports in `routes.ts` after extraction

