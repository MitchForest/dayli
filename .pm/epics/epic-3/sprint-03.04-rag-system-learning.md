# Sprint 03.04: RAG System & Learning

## Sprint Overview

**Sprint Number**: 03.04  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: NOT STARTED

### Sprint Goal
Build a multi-layer RAG (Retrieval-Augmented Generation) system that learns from user patterns, stores decisions, and makes the AI assistant increasingly personalized over time. This sprint transforms dayli from a generic assistant to one that truly knows and adapts to each user.

### Context for Executor
In previous sprints, we built:
- Sprint 03.01: Basic tools and chat interface
- Sprint 03.02: Adaptive scheduling workflow
- Sprint 03.03: Email triage workflows

Now we're adding memory and learning. The RAG system will:
- Store user patterns and decisions in vector embeddings
- Retrieve relevant context for every AI decision
- Learn from accepted/rejected proposals
- Track preferences that evolve over time
- Make increasingly personalized suggestions

Think of this as giving the AI long-term memory about how each user works, what they prefer, and how their patterns change.

## Prerequisites from Previous Sprints

Before starting, verify:
- [ ] pgvector extension is enabled in Supabase
- [ ] All workflows from previous sprints are functional
- [ ] OpenAI API key is configured for embeddings
- [ ] Database migrations from Sprint 03.01 are complete

## Key Concepts

### What is RAG?
RAG (Retrieval-Augmented Generation) enhances AI responses by:
1. **Storing** relevant information as vector embeddings
2. **Retrieving** similar/relevant information based on context
3. **Augmenting** AI prompts with this retrieved context
4. **Generating** more accurate, personalized responses

### Multi-Layer Context System
We use three layers of context:
1. **Pattern Layer**: Long-term behavioral patterns (e.g., "usually takes lunch at 11:30")
2. **Recent Layer**: Last 7 days of decisions (e.g., "moved meetings 3 times this week")
3. **Similar Layer**: Similar past situations (e.g., "last time with 5 urgent emails...")

### What We Store
- Schedule changes and the reasons
- Email triage decisions
- Task completion patterns
- Preference updates
- Rejected proposals (to avoid repeating mistakes)

## Key Deliverables

### 1. Create RAG Context Service

**File**: `apps/web/modules/rag/services/ragContext.service.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { z } from 'zod';

// Types for different context entries
export interface ContextEntry {
  id: string;
  userId: string;
  type: 'pattern' | 'decision' | 'preference' | 'rejection';
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
  timestamp: Date;
  relevanceScore?: number;
}

export interface RAGContext {
  patterns: ContextEntry[];
  recentDecisions: ContextEntry[];
  similarSituations: ContextEntry[];
}

export class RAGContextService {
  private supabase;
  private openai;
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  /**
   * Store a new context entry with embedding
   */
  async storeContext(params: {
    userId: string;
    type: ContextEntry['type'];
    content: string;
    metadata?: Record<string, any>;
  }): Promise<ContextEntry> {
    // Generate embedding for the content
    const embedding = await this.generateEmbedding(params.content);
    
    // Store in database
    const { data, error } = await this.supabase
      .from('rag_context')
      .insert({
        user_id: params.userId,
        type: params.type,
        content: params.content,
        metadata: params.metadata || {},
        embedding,
        created_at: new Date(),
      })
      .select()
      .single();

    if (error) throw error;
    
    return data;
  }

  /**
   * Retrieve multi-layer context for a query
   */
  async getContext(
    userId: string,
    query: string,
    options?: {
      includePatterns?: boolean;
      includeRecent?: boolean;
      includeSimilar?: boolean;
      limit?: number;
    }
  ): Promise<RAGContext> {
    const {
      includePatterns = true,
      includeRecent = true,
      includeSimilar = true,
      limit = 10,
    } = options || {};

    const queryEmbedding = await this.generateEmbedding(query);
    const context: RAGContext = {
      patterns: [],
      recentDecisions: [],
      similarSituations: [],
    };

    // Fetch patterns (long-term behavioral patterns)
    if (includePatterns) {
      const patterns = await this.fetchPatterns(userId, limit);
      context.patterns = patterns;
    }

    // Fetch recent decisions (last 7 days)
    if (includeRecent) {
      const recent = await this.fetchRecentDecisions(userId, 7);
      context.recentDecisions = recent;
    }

    // Fetch similar situations using vector similarity
    if (includeSimilar) {
      const similar = await this.fetchSimilarSituations(
        userId,
        queryEmbedding,
        limit
      );
      context.similarSituations = similar;
    }

    return context;
  }

  /**
   * Generate embedding using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    return response.data[0].embedding;
  }

  /**
   * Fetch long-term patterns
   */
  private async fetchPatterns(
    userId: string,
    limit: number
  ): Promise<ContextEntry[]> {
    const { data, error } = await this.supabase
      .from('rag_context')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'pattern')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    return data || [];
  }

  /**
   * Fetch recent decisions
   */
  private async fetchRecentDecisions(
    userId: string,
    days: number
  ): Promise<ContextEntry[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await this.supabase
      .from('rag_context')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'decision')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data || [];
  }

  /**
   * Fetch similar situations using vector similarity
   */
  private async fetchSimilarSituations(
    userId: string,
    queryEmbedding: number[],
    limit: number
  ): Promise<ContextEntry[]> {
    // Use pgvector's <-> operator for cosine similarity
    const { data, error } = await this.supabase.rpc('search_similar_contexts', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: limit,
      threshold: 0.7, // Similarity threshold
    });

    if (error) throw error;
    
    return data || [];
  }
}
```

### 2. Create Database Function for Vector Search

**File**: `migrations/006_rag_vector_search.sql`

```sql
-- Create the RAG context table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.rag_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('pattern', 'decision', 'preference', 'rejection')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536), -- OpenAI embedding dimension
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_rag_context_user_type (user_id, type),
  INDEX idx_rag_context_created (created_at DESC)
);

-- Enable RLS
ALTER TABLE public.rag_context ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can manage own context" ON public.rag_context
  FOR ALL USING (auth.uid() = user_id);

-- Create vector similarity search function
CREATE OR REPLACE FUNCTION search_similar_contexts(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 10,
  threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  content TEXT,
  metadata JSONB,
  embedding vector(1536),
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.user_id,
    rc.type,
    rc.content,
    rc.metadata,
    rc.embedding,
    rc.created_at,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM rag_context rc
  WHERE rc.user_id = match_user_id
    AND 1 - (rc.embedding <=> query_embedding) > threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_rag_context_embedding 
  ON rag_context 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### 3. Implement Learning Patterns

**File**: `apps/web/modules/rag/services/learningPatterns.ts`

```typescript
import { RAGContextService } from './ragContext.service';

export class LearningPatternsService {
  private ragService: RAGContextService;
  
  constructor() {
    this.ragService = new RAGContextService();
  }

  /**
   * Learn from schedule changes
   */
  async learnFromScheduleChange(params: {
    userId: string;
    changeType: 'create' | 'move' | 'delete';
    blockType: string;
    originalTime?: string;
    newTime?: string;
    reason?: string;
  }) {
    const content = this.formatScheduleChange(params);
    
    // Store as a decision
    await this.ragService.storeContext({
      userId: params.userId,
      type: 'decision',
      content,
      metadata: {
        changeType: params.changeType,
        blockType: params.blockType,
        timestamp: new Date().toISOString(),
      },
    });

    // Extract patterns after multiple similar changes
    await this.extractSchedulePatterns(params.userId);
  }

  /**
   * Learn from email triage decisions
   */
  async learnFromEmailDecision(params: {
    userId: string;
    sender: string;
    subject: string;
    importance: string;
    urgency: string;
    action: string;
  }) {
    const content = `Email from ${params.sender} about "${params.subject}" was marked as ${params.importance}/${params.urgency} and action: ${params.action}`;
    
    await this.ragService.storeContext({
      userId: params.userId,
      type: 'decision',
      content,
      metadata: {
        sender: params.sender,
        importance: params.importance,
        urgency: params.urgency,
        domain: this.extractDomain(params.sender),
      },
    });

    // Check for sender patterns
    await this.extractSenderPatterns(params.userId, params.sender);
  }

  /**
   * Learn from rejected proposals
   */
  async learnFromRejection(params: {
    userId: string;
    proposalType: string;
    proposal: any;
    reason?: string;
  }) {
    const content = `User rejected ${params.proposalType}: ${JSON.stringify(params.proposal)}. Reason: ${params.reason || 'Not specified'}`;
    
    await this.ragService.storeContext({
      userId: params.userId,
      type: 'rejection',
      content,
      metadata: {
        proposalType: params.proposalType,
        proposal: params.proposal,
      },
    });
  }

  /**
   * Learn preference changes
   */
  async learnPreferenceChange(params: {
    userId: string;
    preference: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }) {
    const content = `Preference "${params.preference}" changed from ${params.oldValue} to ${params.newValue}. Reason: ${params.reason}`;
    
    await this.ragService.storeContext({
      userId: params.userId,
      type: 'preference',
      content,
      metadata: {
        preference: params.preference,
        oldValue: params.oldValue,
        newValue: params.newValue,
      },
    });

    // Update user preferences if it's a recurring pattern
    await this.checkPreferencePattern(params.userId, params.preference);
  }

  /**
   * Extract schedule patterns from decisions
   */
  private async extractSchedulePatterns(userId: string) {
    // Get recent schedule decisions
    const recentDecisions = await this.supabase
      .from('rag_context')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'decision')
      .like('content', '%schedule%')
      .order('created_at', { ascending: false })
      .limit(20);

    // Analyze for patterns
    const patterns = this.analyzeSchedulePatterns(recentDecisions.data);
    
    // Store significant patterns
    for (const pattern of patterns) {
      if (pattern.confidence > 0.7) {
        await this.ragService.storeContext({
          userId,
          type: 'pattern',
          content: pattern.description,
          metadata: {
            patternType: 'schedule',
            confidence: pattern.confidence,
            occurrences: pattern.occurrences,
          },
        });
      }
    }
  }

  /**
   * Analyze schedule patterns
   */
  private analyzeSchedulePatterns(decisions: any[]): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Look for lunch time preferences
    const lunchTimes = decisions
      .filter(d => d.content.includes('lunch'))
      .map(d => this.extractTime(d.content));
    
    if (lunchTimes.length >= 3) {
      const mostCommon = this.findMostCommon(lunchTimes);
      if (mostCommon.count >= 3) {
        patterns.push({
          description: `User prefers lunch at ${mostCommon.value}`,
          confidence: mostCommon.count / lunchTimes.length,
          occurrences: mostCommon.count,
        });
      }
    }

    // Look for break patterns
    const breakMoves = decisions.filter(d => 
      d.content.includes('break') && d.metadata?.changeType === 'move'
    );
    
    if (breakMoves.length >= 2) {
      patterns.push({
        description: 'User frequently adjusts break times',
        confidence: 0.8,
        occurrences: breakMoves.length,
      });
    }

    return patterns;
  }

  private formatScheduleChange(params: any): string {
    if (params.changeType === 'move') {
      return `Moved ${params.blockType} block from ${params.originalTime} to ${params.newTime}`;
    } else if (params.changeType === 'create') {
      return `Created ${params.blockType} block at ${params.newTime}`;
    } else {
      return `Deleted ${params.blockType} block`;
    }
  }

  private extractDomain(email: string): string {
    const match = email.match(/@(.+)$/);
    return match ? match[1] : 'unknown';
  }

  private extractTime(text: string): string | null {
    const match = text.match(/\b(\d{1,2}:\d{2})\b/);
    return match ? match[1] : null;
  }

  private findMostCommon<T>(arr: T[]): { value: T; count: number } {
    const counts = new Map<T, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    
    let maxCount = 0;
    let mostCommon: T;
    
    for (const [value, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = value;
      }
    }
    
    return { value: mostCommon!, count: maxCount };
  }
}
```

### 4. Integrate RAG into Workflows

**File**: `apps/web/modules/workflows/utils/contextEnhancer.ts`

```typescript
import { RAGContextService } from '@/modules/rag/services/ragContext.service';

export class ContextEnhancer {
  private ragService: RAGContextService;
  
  constructor() {
    this.ragService = new RAGContextService();
  }

  /**
   * Enhance workflow state with RAG context
   */
  async enhanceWorkflowState(
    userId: string,
    workflowType: string,
    currentState: any
  ): Promise<any> {
    // Get relevant context based on workflow type
    const query = this.buildContextQuery(workflowType, currentState);
    const ragContext = await this.ragService.getContext(userId, query);
    
    // Add context to state
    return {
      ...currentState,
      ragContext: {
        patterns: this.summarizePatterns(ragContext.patterns),
        recentDecisions: this.summarizeDecisions(ragContext.recentDecisions),
        similarSituations: this.summarizeSituations(ragContext.similarSituations),
      },
    };
  }

  /**
   * Build context query based on workflow
   */
  private buildContextQuery(workflowType: string, state: any): string {
    switch (workflowType) {
      case 'schedule':
        return `Scheduling ${state.taskType || 'task'} for ${state.timeOfDay || 'today'}`;
      
      case 'email':
        return `Email triage for ${state.emailCount || 'multiple'} emails`;
      
      case 'task':
        return `Task prioritization with ${state.taskCount || 'multiple'} tasks`;
      
      default:
        return `Workflow: ${workflowType}`;
    }
  }

  /**
   * Summarize patterns for LLM consumption
   */
  private summarizePatterns(patterns: ContextEntry[]): string[] {
    return patterns.map(p => 
      `${p.content} (confidence: ${p.metadata?.confidence || 'high'})`
    );
  }

  /**
   * Summarize recent decisions
   */
  private summarizeDecisions(decisions: ContextEntry[]): string[] {
    return decisions.slice(0, 5).map(d => 
      `${d.content} (${this.getRelativeTime(d.timestamp)})`
    );
  }

  /**
   * Summarize similar situations
   */
  private summarizeSituations(situations: ContextEntry[]): string[] {
    return situations.slice(0, 3).map(s => 
      `Similar: ${s.content} (similarity: ${s.relevanceScore?.toFixed(2) || 'high'})`
    );
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
  }
}
```

### 5. Update Workflow Nodes to Use RAG

**File**: `apps/web/modules/workflows/graphs/nodes/scheduleNodes.ts` (Update existing)

```typescript
import { ContextEnhancer } from '../utils/contextEnhancer';
import { LearningPatternsService } from '@/modules/rag/services/learningPatterns';

// Update the analyze node to include RAG context
export async function analyzeScheduleNode(state: ScheduleState) {
  const enhancer = new ContextEnhancer();
  
  // Enhance state with RAG context
  const enhancedState = await enhancer.enhanceWorkflowState(
    state.userId,
    'schedule',
    state
  );

  // Build enhanced prompt with context
  const prompt = `
    Analyze the current schedule and determine the best scheduling strategy.
    
    Current Schedule:
    ${JSON.stringify(state.currentSchedule)}
    
    Tasks to Schedule:
    ${JSON.stringify(state.tasksToSchedule)}
    
    User Context from RAG:
    - Patterns: ${enhancedState.ragContext.patterns.join('; ')}
    - Recent Decisions: ${enhancedState.ragContext.recentDecisions.join('; ')}
    - Similar Situations: ${enhancedState.ragContext.similarSituations.join('; ')}
    
    Based on this context, recommend:
    1. Best time slots for each task
    2. Any schedule optimizations
    3. Potential conflicts to resolve
  `;

  // Rest of the implementation...
}

// Add learning after proposal acceptance
export async function applyScheduleChangesNode(state: ScheduleState) {
  const learningService = new LearningPatternsService();
  
  // Apply the changes
  const changes = state.proposedChanges;
  
  for (const change of changes) {
    // Apply change to database
    await applyChange(change);
    
    // Learn from the change
    await learningService.learnFromScheduleChange({
      userId: state.userId,
      changeType: change.type,
      blockType: change.blockType,
      originalTime: change.originalTime,
      newTime: change.newTime,
      reason: change.reason,
    });
  }
  
  return {
    ...state,
    changesApplied: true,
  };
}
```

### 6. Create RAG API Endpoints

**File**: `apps/web/app/api/rag/context/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RAGContextService } from '@/modules/rag/services/ragContext.service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, content, metadata } = body;

    const ragService = new RAGContextService();
    const entry = await ragService.storeContext({
      userId: user.id,
      type,
      content,
      metadata,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error storing context:', error);
    return NextResponse.json(
      { error: 'Failed to store context' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    
    const ragService = new RAGContextService();
    const context = await ragService.getContext(user.id, query);

    return NextResponse.json({ context });
  } catch (error) {
    console.error('Error retrieving context:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve context' },
      { status: 500 }
    );
  }
}
```

**File**: `apps/web/app/api/rag/learn/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { LearningPatternsService } from '@/modules/rag/services/learningPatterns';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { learningType, data } = body;

    const learningService = new LearningPatternsService();
    
    switch (learningType) {
      case 'schedule':
        await learningService.learnFromScheduleChange({
          userId: user.id,
          ...data,
        });
        break;
        
      case 'email':
        await learningService.learnFromEmailDecision({
          userId: user.id,
          ...data,
        });
        break;
        
      case 'rejection':
        await learningService.learnFromRejection({
          userId: user.id,
          ...data,
        });
        break;
        
      case 'preference':
        await learningService.learnPreferenceChange({
          userId: user.id,
          ...data,
        });
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid learning type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in learning:', error);
    return NextResponse.json(
      { error: 'Failed to process learning' },
      { status: 500 }
    );
  }
}
```

## Testing Guide

### 1. Test RAG Context Storage

```typescript
// Test storing different types of context
const testContextStorage = async () => {
  // Store a pattern
  await fetch('/api/rag/context', {
    method: 'POST',
    body: JSON.stringify({
      type: 'pattern',
      content: 'User prefers lunch at 11:30am',
      metadata: { confidence: 0.85, occurrences: 5 }
    })
  });

  // Store a decision
  await fetch('/api/rag/context', {
    method: 'POST',
    body: JSON.stringify({
      type: 'decision',
      content: 'Moved deep work block from 9am to 2pm',
      metadata: { blockType: 'deep-work', reason: 'morning meeting' }
    })
  });
};
```

### 2. Test Context Retrieval

```typescript
// Test retrieving context for a query
const testContextRetrieval = async () => {
  const response = await fetch('/api/rag/context?query=schedule lunch');
  const { context } = await response.json();
  
  console.log('Patterns:', context.patterns);
  console.log('Recent:', context.recentDecisions);
  console.log('Similar:', context.similarSituations);
};
```

### 3. Test Learning from Actions

```typescript
// Test learning from schedule change
const testLearning = async () => {
  await fetch('/api/rag/learn', {
    method: 'POST',
    body: JSON.stringify({
      learningType: 'schedule',
      data: {
        changeType: 'move',
        blockType: 'lunch',
        originalTime: '12:00',
        newTime: '11:30',
        reason: 'Earlier meeting'
      }
    })
  });
};
```

## Common Issues & Solutions

### Issue 1: pgvector Not Installed
**Error**: "type vector does not exist"
**Solution**: 
```sql
-- In Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue 2: Embedding Dimension Mismatch
**Error**: "expected 1536 dimensions, got 1024"
**Solution**: Ensure using correct OpenAI model:
```typescript
model: "text-embedding-3-small" // 1536 dimensions
// NOT "text-embedding-ada-002" // 1536 dimensions but older
```

### Issue 3: Missing Environment Variables
**Error**: "OpenAI API key not found"
**Solution**: Add to `.env.local`:
```
OPENAI_API_KEY=sk-...
SUPABASE_SERVICE_KEY=eyJ...
```

### Issue 4: RLS Policies Blocking Access
**Error**: "new row violates row-level security policy"
**Solution**: Ensure user is authenticated and policies are correct

## Success Criteria

- [ ] RAG context service successfully stores and retrieves embeddings
- [ ] Vector similarity search returns relevant results
- [ ] Learning patterns service extracts meaningful patterns
- [ ] Workflows successfully use RAG context for decisions
- [ ] API endpoints handle all learning types
- [ ] Pattern recognition improves with more data
- [ ] No errors in console during normal operation
- [ ] Database queries are performant (<100ms for searches)

## Architecture Decisions

### Why pgvector?
- Native PostgreSQL extension
- Works seamlessly with Supabase
- Supports efficient similarity search
- No need for separate vector database

### Why Three Context Layers?
- **Patterns**: Long-term stable behaviors
- **Recent**: Short-term context and changes
- **Similar**: Historical precedent for decisions

### Why Store Rejections?
- Avoid repeating mistakes
- Learn what users don't want
- Improve proposal quality over time

### Why OpenAI Embeddings?
- High quality semantic understanding
- Consistent across different text types
- Well-documented and reliable
- Good balance of performance and cost

## Next Steps

After completing this sprint:
1. Test with real user interactions
2. Monitor pattern extraction quality
3. Tune similarity thresholds
4. Add more sophisticated pattern analysis
5. Prepare for Sprint 03.05 (Change Preview & UX Polish)

## Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Supabase Vector Search](https://supabase.com/docs/guides/ai/vector-similarity)
- [RAG Best Practices](https://www.pinecone.io/learn/retrieval-augmented-generation/)