-- Migration: Create task_backlog view
-- This view provides a unified interface for managing task backlogs

-- Drop view if exists to recreate
DROP VIEW IF EXISTS public.task_backlog_view;

-- Create view for task backlog
-- This combines data from tasks table with calculated fields
CREATE VIEW public.task_backlog_view AS
SELECT 
  t.id,
  t.user_id,
  t.title,
  t.description,
  t.priority,
  t.status,
  t.estimated_minutes,
  t.source,
  t.email_id,
  t.created_at,
  t.updated_at,
  -- Calculate days in backlog
  EXTRACT(DAY FROM (CURRENT_TIMESTAMP - t.created_at))::INTEGER as days_in_backlog,
  -- Determine if task is stale (>7 days old and not completed)
  CASE 
    WHEN t.completed = false AND EXTRACT(DAY FROM (CURRENT_TIMESTAMP - t.created_at)) > 7 
    THEN true 
    ELSE false 
  END as is_stale,
  -- Priority score (for sorting)
  CASE t.priority
    WHEN 'critical' THEN 4
    WHEN 'high' THEN 3
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 1
    ELSE 0
  END as priority_score,
  -- Completion status
  t.completed,
  -- Estimated completion date (if in progress)
  CASE 
    WHEN t.status = 'in_progress' AND t.estimated_minutes IS NOT NULL
    THEN t.updated_at + (t.estimated_minutes || ' minutes')::INTERVAL
    ELSE NULL
  END as estimated_completion
FROM public.tasks t
WHERE t.completed = false OR t.completed IS NULL;

-- Create RLS policy for the view
-- Views inherit RLS from their base tables, but we can add comments
COMMENT ON VIEW public.task_backlog_view IS 'Unified view of incomplete tasks with backlog metrics';
COMMENT ON COLUMN public.task_backlog_view.days_in_backlog IS 'Number of days since task creation';
COMMENT ON COLUMN public.task_backlog_view.is_stale IS 'True if task is older than 7 days and not completed';
COMMENT ON COLUMN public.task_backlog_view.priority_score IS 'Numeric priority for sorting (4=critical, 3=high, 2=medium, 1=low)';
COMMENT ON COLUMN public.task_backlog_view.estimated_completion IS 'Estimated completion time for in-progress tasks';

-- Create function to get task backlog summary
CREATE OR REPLACE FUNCTION public.get_task_backlog_summary(p_user_id UUID)
RETURNS TABLE (
  total_tasks INTEGER,
  stale_tasks INTEGER,
  critical_tasks INTEGER,
  high_priority_tasks INTEGER,
  medium_priority_tasks INTEGER,
  low_priority_tasks INTEGER,
  total_estimated_minutes INTEGER,
  average_age_days NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_tasks,
    COUNT(*) FILTER (WHERE is_stale = true)::INTEGER as stale_tasks,
    COUNT(*) FILTER (WHERE priority = 'critical')::INTEGER as critical_tasks,
    COUNT(*) FILTER (WHERE priority = 'high')::INTEGER as high_priority_tasks,
    COUNT(*) FILTER (WHERE priority = 'medium')::INTEGER as medium_priority_tasks,
    COUNT(*) FILTER (WHERE priority = 'low')::INTEGER as low_priority_tasks,
    COALESCE(SUM(estimated_minutes), 0)::INTEGER as total_estimated_minutes,
    COALESCE(AVG(days_in_backlog), 0)::NUMERIC(10,2) as average_age_days
  FROM public.task_backlog_view
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_task_backlog_summary(UUID) TO authenticated;

-- Create index on tasks table for better view performance
CREATE INDEX IF NOT EXISTS idx_tasks_completed_user ON public.tasks(completed, user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority); 