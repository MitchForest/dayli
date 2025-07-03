-- Migration 010: Enhance time_blocks
-- This migration adds columns to support conflict detection, energy-based scheduling,
-- and direct task/email assignment to time blocks

BEGIN;

-- 1. Add new columns to time_blocks table
ALTER TABLE public.time_blocks
ADD COLUMN IF NOT EXISTS conflict_group INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS energy_level TEXT DEFAULT 'medium' 
    CHECK (energy_level IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS assigned_tasks JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS assigned_emails JSONB DEFAULT '[]'::jsonb;

-- 2. Create index for conflict detection
CREATE INDEX IF NOT EXISTS idx_time_blocks_conflicts 
ON public.time_blocks(user_id, start_time, end_time, conflict_group);

-- 3. Create index for energy level queries
CREATE INDEX IF NOT EXISTS idx_time_blocks_energy 
ON public.time_blocks(user_id, energy_level, start_time);

-- 4. Create index for JSONB columns
CREATE INDEX IF NOT EXISTS idx_time_blocks_assigned_tasks 
ON public.time_blocks USING GIN(assigned_tasks);

CREATE INDEX IF NOT EXISTS idx_time_blocks_assigned_emails 
ON public.time_blocks USING GIN(assigned_emails);

-- 5. Migrate existing data from junction tables to JSONB
DO $$
BEGIN
    -- Migrate tasks from time_block_tasks
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'time_block_tasks') THEN
        
        UPDATE public.time_blocks tb
        SET assigned_tasks = (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', tbt.task_id,
                    'position', tbt.position
                ) ORDER BY tbt.position
            )
            FROM public.time_block_tasks tbt
            WHERE tbt.time_block_id = tb.id
        )
        WHERE EXISTS (
            SELECT 1 FROM public.time_block_tasks tbt2 
            WHERE tbt2.time_block_id = tb.id
        );
    END IF;
    
    -- Migrate emails from time_block_emails
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'time_block_emails') THEN
        
        UPDATE public.time_blocks tb
        SET assigned_emails = (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', tbe.email_id,
                    'position', tbe.position
                ) ORDER BY tbe.position
            )
            FROM public.time_block_emails tbe
            WHERE tbe.time_block_id = tb.id
        )
        WHERE EXISTS (
            SELECT 1 FROM public.time_block_emails tbe2 
            WHERE tbe2.time_block_id = tb.id
        );
    END IF;
END $$;

-- 6. Set default energy levels based on time of day
UPDATE public.time_blocks
SET energy_level = CASE
    WHEN EXTRACT(HOUR FROM start_time) < 12 THEN 'high'
    WHEN EXTRACT(HOUR FROM start_time) < 15 THEN 'medium'
    ELSE 'low'
END
WHERE energy_level IS NULL;

-- 7. Create function to detect conflicts
CREATE OR REPLACE FUNCTION detect_time_block_conflicts()
RETURNS trigger AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    -- Check for overlapping time blocks
    SELECT COUNT(*) INTO conflict_count
    FROM public.time_blocks
    WHERE user_id = NEW.user_id
    AND id != NEW.id
    AND daily_schedule_id = NEW.daily_schedule_id
    AND (
        (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
    );
    
    -- Set conflict group if conflicts exist
    IF conflict_count > 0 THEN
        NEW.conflict_group = COALESCE(
            (SELECT MAX(conflict_group) + 1 
             FROM public.time_blocks 
             WHERE user_id = NEW.user_id),
            1
        );
    ELSE
        NEW.conflict_group = 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for conflict detection
DROP TRIGGER IF EXISTS detect_conflicts_on_time_blocks ON public.time_blocks;
CREATE TRIGGER detect_conflicts_on_time_blocks
    BEFORE INSERT OR UPDATE ON public.time_blocks
    FOR EACH ROW
    EXECUTE FUNCTION detect_time_block_conflicts();

-- 9. Create views for backward compatibility with junction tables
CREATE OR REPLACE VIEW public.time_block_tasks AS
SELECT 
    tb.id as time_block_id,
    (task_obj->>'id')::uuid as task_id,
    (task_obj->>'position')::integer as position,
    tb.created_at,
    tb.updated_at
FROM public.time_blocks tb,
     jsonb_array_elements(tb.assigned_tasks) as task_obj;

CREATE OR REPLACE VIEW public.time_block_emails AS
SELECT 
    tb.id as time_block_id,
    (email_obj->>'id')::text as email_id,
    (email_obj->>'position')::integer as position,
    tb.created_at,
    tb.updated_at
FROM public.time_blocks tb,
     jsonb_array_elements(tb.assigned_emails) as email_obj;

-- 10. Add comments to document the enhancements
COMMENT ON TABLE public.time_blocks IS 'Enhanced time blocks with conflict detection and direct task/email assignment';
COMMENT ON COLUMN public.time_blocks.conflict_group IS 'Non-zero value indicates this block conflicts with others in the same group';
COMMENT ON COLUMN public.time_blocks.energy_level IS 'Expected energy level during this time block for task matching';
COMMENT ON COLUMN public.time_blocks.assigned_tasks IS 'JSONB array of assigned tasks with positions';
COMMENT ON COLUMN public.time_blocks.assigned_emails IS 'JSONB array of assigned emails with positions';

COMMIT;