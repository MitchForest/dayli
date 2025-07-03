-- Migration 011: Remove backward compatibility views
-- These views were created for migration compatibility but are no longer needed
-- All references have been updated to use the main tables directly

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

-- Verify the views are gone
SELECT 'Views successfully dropped' AS status
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name IN ('task_backlog', 'email_backlog', 'time_block_tasks', 'time_block_emails')
);