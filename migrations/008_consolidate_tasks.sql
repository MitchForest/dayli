-- Migration 008: Consolidate task tables
-- This migration adds missing columns to the tasks table to eliminate the need for task_backlog
-- and creates a view for backward compatibility

BEGIN;

-- 1. Add missing columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS days_in_backlog INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS urgency INTEGER DEFAULT 50 CHECK (urgency >= 0 AND urgency <= 100),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'backlog', 'scheduled', 'completed', 'cancelled')),
ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('manual', 'email', 'calendar', 'ai')),
ADD COLUMN IF NOT EXISTS source_id TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 2. Update existing completed tasks to have 'completed' status
UPDATE public.tasks 
SET status = 'completed' 
WHERE completed = true AND status IS NULL;

-- 3. Update existing incomplete tasks to have appropriate status
UPDATE public.tasks 
SET status = CASE 
    WHEN scheduled_for IS NOT NULL THEN 'scheduled'
    ELSE 'active'
END
WHERE completed = false AND status IS NULL;

-- 4. Migrate data from task_backlog if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'task_backlog') THEN
        
        INSERT INTO public.tasks (
            id, user_id, title, description, priority, urgency, 
            status, days_in_backlog, estimated_minutes, created_at, updated_at,
            source, source_id, tags
        )
        SELECT 
            tb.id,
            tb.user_id,
            tb.title,
            tb.description,
            CASE 
                WHEN tb.priority >= 80 THEN 'high'
                WHEN tb.priority >= 50 THEN 'medium'
                ELSE 'low'
            END::text as priority,
            tb.urgency,
            'backlog' as status,
            EXTRACT(DAY FROM NOW() - tb.created_at)::integer as days_in_backlog,
            tb.estimated_minutes,
            tb.created_at,
            tb.updated_at,
            tb.source,
            tb.source_id,
            tb.tags
        FROM public.task_backlog tb
        WHERE NOT EXISTS (
            SELECT 1 FROM public.tasks t WHERE t.id = tb.id
        );
        
        -- Drop the redundant table
        DROP TABLE public.task_backlog;
    END IF;
END $$;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status_user ON public.tasks(status, user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_score ON public.tasks(score DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_days_backlog ON public.tasks(days_in_backlog);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON public.tasks(source);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON public.tasks USING GIN(tags);

-- 6. Create or replace view for backward compatibility
CREATE OR REPLACE VIEW public.task_backlog AS
SELECT 
    id,
    user_id,
    title,
    description,
    CASE 
        WHEN priority = 'high' THEN 80
        WHEN priority = 'medium' THEN 50
        ELSE 20
    END as priority,
    urgency,
    status,
    days_in_backlog,
    estimated_minutes,
    created_at,
    updated_at,
    source,
    source_id,
    tags
FROM public.tasks 
WHERE status = 'backlog';

-- 7. Add comment to document the consolidation
COMMENT ON TABLE public.tasks IS 'Consolidated tasks table that includes all task states including backlog';
COMMENT ON COLUMN public.tasks.score IS 'AI-calculated priority score based on multiple factors';
COMMENT ON COLUMN public.tasks.days_in_backlog IS 'Number of days task has been in backlog status';
COMMENT ON COLUMN public.tasks.urgency IS 'User or AI assigned urgency level (0-100)';
COMMENT ON COLUMN public.tasks.status IS 'Current task status in the workflow';
COMMENT ON COLUMN public.tasks.source IS 'Origin of the task creation';
COMMENT ON COLUMN public.tasks.source_id IS 'ID from the source system (e.g., email ID)';
COMMENT ON COLUMN public.tasks.tags IS 'Array of tags for categorization';

COMMIT;