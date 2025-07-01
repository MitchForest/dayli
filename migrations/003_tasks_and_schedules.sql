-- Tasks and Schedules Schema
-- This migration creates the core tables for task management and scheduling

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  source TEXT CHECK (source IN ('email', 'calendar', 'ai', 'manual')) DEFAULT 'manual',
  email_id UUID,
  status TEXT CHECK (status IN ('backlog', 'scheduled', 'completed', 'cancelled')) DEFAULT 'backlog',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create emails table
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  gmail_id TEXT UNIQUE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT NOT NULL,
  body_preview TEXT,
  full_body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  decision TEXT CHECK (decision IN ('now', 'tomorrow', 'never')),
  action_type TEXT CHECK (action_type IN ('quick_reply', 'thoughtful_response', 'archive', 'no_action')),
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create daily_schedules table
CREATE TABLE IF NOT EXISTS public.daily_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  schedule_date DATE NOT NULL,
  stats JSONB DEFAULT '{"emailsProcessed": 0, "tasksCompleted": 0, "focusMinutes": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, schedule_date)
);

-- Create time_blocks table
CREATE TABLE IF NOT EXISTS public.time_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  daily_schedule_id UUID REFERENCES public.daily_schedules ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  type TEXT CHECK (type IN ('focus', 'meeting', 'email', 'quick-decisions', 'break', 'blocked')) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT CHECK (source IN ('calendar', 'ai', 'manual')) DEFAULT 'manual',
  calendar_event_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create time_block_tasks junction table
CREATE TABLE IF NOT EXISTS public.time_block_tasks (
  time_block_id UUID REFERENCES public.time_blocks ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks ON DELETE CASCADE,
  position INT DEFAULT 0,
  PRIMARY KEY (time_block_id, task_id)
);

-- Create time_block_emails junction table
CREATE TABLE IF NOT EXISTS public.time_block_emails (
  time_block_id UUID REFERENCES public.time_blocks ON DELETE CASCADE,
  email_id UUID REFERENCES public.emails ON DELETE CASCADE,
  position INT DEFAULT 0,
  PRIMARY KEY (time_block_id, email_id)
);

-- Add foreign key constraint for tasks.email_id
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_email_id_fkey 
FOREIGN KEY (email_id) REFERENCES public.emails(id) ON DELETE SET NULL;

-- Enable RLS on all tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_block_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_block_emails ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tasks
CREATE POLICY "Users can view their own tasks" 
ON public.tasks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
ON public.tasks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" 
ON public.tasks FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" 
ON public.tasks FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for emails
CREATE POLICY "Users can view their own emails" 
ON public.emails FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own emails"
ON public.emails FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own emails" 
ON public.emails FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own emails" 
ON public.emails FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for daily_schedules
CREATE POLICY "Users can view their own schedules" 
ON public.daily_schedules FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own schedules"
ON public.daily_schedules FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules" 
ON public.daily_schedules FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules" 
ON public.daily_schedules FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for time_blocks
CREATE POLICY "Users can view their own time blocks" 
ON public.time_blocks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own time blocks"
ON public.time_blocks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time blocks" 
ON public.time_blocks FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time blocks" 
ON public.time_blocks FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for junction tables
CREATE POLICY "Users can view their time block tasks" 
ON public.time_block_tasks FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.time_blocks 
  WHERE time_blocks.id = time_block_tasks.time_block_id 
  AND time_blocks.user_id = auth.uid()
));

CREATE POLICY "Users can manage their time block tasks"
ON public.time_block_tasks FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.time_blocks 
  WHERE time_blocks.id = time_block_tasks.time_block_id 
  AND time_blocks.user_id = auth.uid()
));

CREATE POLICY "Users can view their time block emails" 
ON public.time_block_emails FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.time_blocks 
  WHERE time_blocks.id = time_block_emails.time_block_id 
  AND time_blocks.user_id = auth.uid()
));

CREATE POLICY "Users can manage their time block emails"
ON public.time_block_emails FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.time_blocks 
  WHERE time_blocks.id = time_block_emails.time_block_id 
  AND time_blocks.user_id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_emails_user_id ON public.emails(user_id);
CREATE INDEX idx_emails_decision ON public.emails(decision);
CREATE INDEX idx_daily_schedules_user_date ON public.daily_schedules(user_id, schedule_date);
CREATE INDEX idx_time_blocks_user_id ON public.time_blocks(user_id);
CREATE INDEX idx_time_blocks_schedule_id ON public.time_blocks(daily_schedule_id);
CREATE INDEX idx_time_blocks_start_time ON public.time_blocks(start_time);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON public.emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_daily_schedules_updated_at BEFORE UPDATE ON public.daily_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_time_blocks_updated_at BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at(); 