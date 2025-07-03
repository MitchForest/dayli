-- Migration 009: Fix email tables
-- This migration adds missing columns to the emails table to eliminate the need for email_backlog
-- and consolidates all email-related data into a single table

BEGIN;

-- 1. Add missing columns to emails table
ALTER TABLE public.emails
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unread' 
    CHECK (status IN ('unread', 'read', 'archived', 'backlog', 'processed')),
ADD COLUMN IF NOT EXISTS days_in_backlog INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal' 
    CHECK (urgency IN ('urgent', 'important', 'normal', 'low')),
ADD COLUMN IF NOT EXISTS importance TEXT DEFAULT 'normal'
    CHECK (importance IN ('high', 'normal', 'low'));

-- 2. Update existing emails based on decision field
UPDATE public.emails
SET status = CASE
    WHEN decision = 'never' THEN 'archived'
    WHEN decision = 'tomorrow' THEN 'backlog'
    WHEN processed_at IS NOT NULL THEN 'processed'
    ELSE 'unread'
END
WHERE status IS NULL;

-- 3. Migrate data from email_backlog if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'email_backlog') THEN
        
        -- Update emails with backlog data
        UPDATE public.emails e
        SET 
            status = 'backlog',
            days_in_backlog = eb.days_in_backlog,
            urgency = eb.urgency,
            importance = eb.importance
        FROM public.email_backlog eb
        WHERE e.id = eb.email_id;
        
        -- Drop the redundant table
        DROP TABLE public.email_backlog;
    END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_status_user ON public.emails(status, user_id);
CREATE INDEX IF NOT EXISTS idx_emails_urgency ON public.emails(urgency);
CREATE INDEX IF NOT EXISTS idx_emails_importance ON public.emails(importance);
CREATE INDEX IF NOT EXISTS idx_emails_days_in_backlog ON public.emails(days_in_backlog);

-- 5. Create function to auto-update days_in_backlog
CREATE OR REPLACE FUNCTION update_email_days_in_backlog()
RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'backlog' AND OLD.status != 'backlog' THEN
        NEW.days_in_backlog = 0;
    ELSIF NEW.status = 'backlog' THEN
        NEW.days_in_backlog = EXTRACT(DAY FROM NOW() - NEW.updated_at)::integer;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for days_in_backlog updates
DROP TRIGGER IF EXISTS update_email_backlog_days ON public.emails;
CREATE TRIGGER update_email_backlog_days
    BEFORE UPDATE ON public.emails
    FOR EACH ROW
    EXECUTE FUNCTION update_email_days_in_backlog();

-- 7. Create view for backward compatibility
CREATE OR REPLACE VIEW public.email_backlog AS
SELECT 
    e.id,
    e.id as email_id,
    e.user_id,
    e.subject,
    e.from_email,
    e.snippet,
    e.urgency,
    e.importance,
    e.days_in_backlog,
    e.created_at,
    e.updated_at
FROM public.emails e
WHERE e.status = 'backlog';

-- 8. Add comments to document the consolidation
COMMENT ON TABLE public.emails IS 'Consolidated emails table that includes all email states including backlog';
COMMENT ON COLUMN public.emails.status IS 'Current email status in the workflow';
COMMENT ON COLUMN public.emails.days_in_backlog IS 'Number of days email has been in backlog status';
COMMENT ON COLUMN public.emails.urgency IS 'AI-determined urgency level';
COMMENT ON COLUMN public.emails.importance IS 'AI-determined importance level';

COMMIT;