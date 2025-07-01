-- User Preferences for Schedule Settings
-- This migration creates the user_preferences table for storing individual schedule configuration

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Work Hours
  work_start_time TIME DEFAULT '08:00',
  work_end_time TIME DEFAULT '18:00',
  work_days TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
  lunch_start_time TIME DEFAULT '12:00',
  lunch_duration_minutes INT DEFAULT 60,
  
  -- Deep Work Preferences
  target_deep_work_blocks INT DEFAULT 2,
  deep_work_duration_hours INT DEFAULT 2,
  deep_work_preference TEXT DEFAULT 'no_preference', -- 'morning', 'afternoon', 'no_preference'
  
  -- Email Triage Times
  morning_triage_time TIME DEFAULT '08:00',
  morning_triage_duration_minutes INT DEFAULT 30,
  evening_triage_time TIME DEFAULT '16:30',
  evening_triage_duration_minutes INT DEFAULT 30,
  
  -- Meeting Rules (stored as JSONB for flexibility)
  meeting_windows JSONB DEFAULT '[{"start": "10:00", "end": "12:00"}, {"start": "14:00", "end": "16:00"}]'::jsonb,
  focus_blocks JSONB DEFAULT '[{"day": "monday", "start": "09:00", "end": "11:00"}, {"day": "friday", "start": "14:00", "end": "17:00"}]'::jsonb,
  
  -- Calendar Auto-Blocking
  protect_deep_work BOOLEAN DEFAULT true,
  show_busy_during_triage BOOLEAN DEFAULT true,
  add_meeting_buffer BOOLEAN DEFAULT true,
  meeting_buffer_minutes INT DEFAULT 15,
  
  -- UI Preferences
  timezone TEXT DEFAULT 'America/New_York',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy - users can only manage their own preferences
CREATE POLICY "Users can manage own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Note: Default values are set for a typical 9-5 work schedule
-- Users can customize these through the settings page 