-- Enable pgvector extension and create RAG/embedding tables
-- This migration sets up vector storage for AI-powered features

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- RAG/Embedding tables
CREATE TABLE IF NOT EXISTS public.embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('command', 'decision', 'pattern', 'preference')) NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  pattern_type TEXT CHECK (pattern_type IN ('email_sender', 'task_timing', 'meeting_preference', 'focus_time')) NOT NULL,
  pattern_data JSONB NOT NULL,
  confidence FLOAT DEFAULT 0.5,
  last_observed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vector similarity search
CREATE INDEX embeddings_embedding_idx ON public.embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_embeddings_user_content_type ON public.embeddings(user_id, content_type);
CREATE INDEX idx_user_patterns_user_type ON public.user_patterns(user_id, pattern_type);

-- Enable RLS on new tables
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for embeddings
CREATE POLICY "Users can view their own embeddings" 
ON public.embeddings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own embeddings"
ON public.embeddings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own embeddings" 
ON public.embeddings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own embeddings" 
ON public.embeddings FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for user_patterns
CREATE POLICY "Users can view their own patterns" 
ON public.user_patterns FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own patterns"
ON public.user_patterns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patterns" 
ON public.user_patterns FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patterns" 
ON public.user_patterns FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for user_patterns updated_at
CREATE TRIGGER update_user_patterns_updated_at BEFORE UPDATE ON public.user_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at(); 