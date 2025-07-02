-- Migration: Update email_backlog table structure
-- Ensures all required columns exist for email backlog management

-- The email_backlog table already exists in database.types.ts
-- This migration ensures it has all the columns our tools expect

-- Add any missing columns (these may already exist)
ALTER TABLE public.email_backlog 
  ADD COLUMN IF NOT EXISTS days_in_backlog INTEGER 
    GENERATED ALWAYS AS (
      EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
    ) STORED;

-- Create function to update days_in_backlog if not using generated column
-- This is an alternative approach if the generated column doesn't work
CREATE OR REPLACE FUNCTION public.update_email_backlog_days()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if days_in_backlog is not a generated column
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Check if the column can be updated (not generated)
    BEGIN
      NEW.days_in_backlog := EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(NEW.created_at, OLD.created_at)))::INTEGER;
    EXCEPTION
      WHEN OTHERS THEN
        -- Column is generated, do nothing
        NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating days_in_backlog (if needed)
DROP TRIGGER IF EXISTS update_email_backlog_days_trigger ON public.email_backlog;
CREATE TRIGGER update_email_backlog_days_trigger
  BEFORE INSERT OR UPDATE ON public.email_backlog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_backlog_days();

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_backlog_user_id ON public.email_backlog(user_id);
CREATE INDEX IF NOT EXISTS idx_email_backlog_urgency ON public.email_backlog(urgency);
CREATE INDEX IF NOT EXISTS idx_email_backlog_importance ON public.email_backlog(importance);
CREATE INDEX IF NOT EXISTS idx_email_backlog_created_at ON public.email_backlog(created_at);
CREATE INDEX IF NOT EXISTS idx_email_backlog_email_id ON public.email_backlog(email_id);

-- Enable RLS if not already enabled
ALTER TABLE public.email_backlog ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$ 
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'email_backlog' 
    AND policyname = 'Users can view their own email backlog'
  ) THEN
    CREATE POLICY "Users can view their own email backlog"
      ON public.email_backlog
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'email_backlog' 
    AND policyname = 'Users can manage their own email backlog'
  ) THEN
    CREATE POLICY "Users can manage their own email backlog"
      ON public.email_backlog
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add helpful comments
COMMENT ON TABLE public.email_backlog IS 'Tracks emails that need processing with urgency and importance scores';
COMMENT ON COLUMN public.email_backlog.urgency IS 'Urgency level: critical, high, medium, low';
COMMENT ON COLUMN public.email_backlog.importance IS 'Importance level: critical, high, medium, low';
COMMENT ON COLUMN public.email_backlog.days_in_backlog IS 'Number of days the email has been in the backlog';
COMMENT ON COLUMN public.email_backlog.last_reviewed_at IS 'Last time this email was reviewed or updated'; 