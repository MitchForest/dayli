-- Migration: Create workflow_states table for workflow persistence
-- This table stores the state of interrupted workflows for resumption

-- Create workflow_states table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT,
  status TEXT,
  current_node TEXT,
  state JSONB DEFAULT '{}',
  error TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workflow_states_user_id ON public.workflow_states(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_states_type ON public.workflow_states(type);
CREATE INDEX IF NOT EXISTS idx_workflow_states_status ON public.workflow_states(status);
CREATE INDEX IF NOT EXISTS idx_workflow_states_expires_at ON public.workflow_states(expires_at);

-- Enable RLS
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own workflow states"
  ON public.workflow_states
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workflow states"
  ON public.workflow_states
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflow states"
  ON public.workflow_states
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflow states"
  ON public.workflow_states
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_workflow_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_workflow_states_updated_at
  BEFORE UPDATE ON public.workflow_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_workflow_states_updated_at();

-- Create function to cleanup expired workflows (already exists in database.types.ts)
-- This function is called periodically to remove expired workflow states
-- The function cleanup_expired_workflows() is already defined in the database

-- Add comment to table
COMMENT ON TABLE public.workflow_states IS 'Stores workflow execution state for interruption recovery and resumption';
COMMENT ON COLUMN public.workflow_states.type IS 'Type of workflow (e.g., daily-planning, email-triage)';
COMMENT ON COLUMN public.workflow_states.status IS 'Current status (active, paused, completed, failed)';
COMMENT ON COLUMN public.workflow_states.current_node IS 'Current node in the workflow graph';
COMMENT ON COLUMN public.workflow_states.state IS 'Serialized workflow state as JSON';
COMMENT ON COLUMN public.workflow_states.expires_at IS 'When this workflow state expires and can be cleaned up'; 