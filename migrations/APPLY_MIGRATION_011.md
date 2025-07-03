# Apply Migration 011: Remove Backward Compatibility Views

## Purpose
This migration removes the backward compatibility views that were created during the database consolidation. Since we only have mock data and all code references have been updated, these views are no longer needed and can cause confusion.

## Views to be Dropped
- `task_backlog` (view)
- `email_backlog` (view)
- `time_block_tasks` (view)
- `time_block_emails` (view)

## Pre-Migration Checklist
✅ All code references updated to use main tables directly
✅ Mock data scripts updated
✅ Service files updated

## Apply Migration Steps

### 1. Apply the Migration
Use the Supabase MCP tool with the following SQL:

```sql
-- Drop all compatibility views
DROP VIEW IF EXISTS public.task_backlog CASCADE;
DROP VIEW IF EXISTS public.email_backlog CASCADE;
DROP VIEW IF EXISTS public.time_block_tasks CASCADE;
DROP VIEW IF EXISTS public.time_block_emails CASCADE;

-- Add comments to main tables for clarity
COMMENT ON TABLE public.tasks IS 'Consolidated tasks table including all task states (active, backlog, scheduled, completed)';
COMMENT ON TABLE public.emails IS 'Consolidated emails table including all email states (unread, read, backlog, processed)';
COMMENT ON COLUMN public.time_blocks.assigned_tasks IS 'JSONB array of task assignments, replaces time_block_tasks junction table';
COMMENT ON COLUMN public.time_blocks.assigned_emails IS 'JSONB array of email assignments, replaces time_block_emails junction table';
```

### 2. Regenerate Types
After applying the migration, regenerate the TypeScript types:

```bash
bun x supabase gen types typescript --project-id krgqhfjugnrvtnkoabwd > packages/database/src/types.ts
```

### 3. Verify Success
Run these commands to ensure everything still works:

```bash
# Check types compile
bun typecheck

# Test mock data setup
bun mock:setup --user-email=test@example.com

# Clear mock data
bun mock:clear --user-email=test@example.com
```

## Expected Results
- The views will no longer appear in the database schema
- The regenerated types will not include View types for these tables
- All functionality should continue working normally

## Rollback Plan
If needed, the views can be recreated using the original migration SQL from migrations 008, 009, and 010.