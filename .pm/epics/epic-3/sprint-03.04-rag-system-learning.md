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

### 4. Test Daily Review Workflow

```typescript
// Test end-of-day review and learning
const testDailyReview = async () => {
  // Trigger daily review
  const response = await fetch('/api/workflows/daily-review', {
    method: 'POST',
    body: JSON.stringify({
      date: '2024-01-15',
      includeBacklogReview: true
    })
  });
  
  const { summary, patterns, tomorrowSuggestions } = await response.json();
  
  console.log('Today Summary:', summary);
  console.log('Patterns Found:', patterns);
  console.log('Tomorrow:', tomorrowSuggestions);
};
```

## Daily Review Workflow Implementation

### 7. Create Daily Review Workflow

**File**: `apps/web/modules/workflows/graphs/dailyReview.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { LearningPatternsService } from '@/modules/rag/services/learningPatterns';
import { RAGContextService } from '@/modules/rag/services/ragContext.service';

interface DailyReviewState {
  userId: string;
  date: string;
  todaySchedule: TimeBlock[];
  completedTasks: Task[];
  incompleteTasks: Task[];
  emailStats: EmailStatistics;
  backlogStatus: BacklogSummary;
  patterns: Pattern[];
  tomorrowSuggestions: Suggestion[];
  reviewSummary: string;
  messages: BaseMessage[];
}

interface Pattern {
  type: 'productivity' | 'timing' | 'preference' | 'behavior';
  description: string;
  confidence: number;
  actionable: boolean;
}

interface Suggestion {
  priority: 'high' | 'medium' | 'low';
  description: string;
  reasoning: string;
  timeBlock?: Partial<TimeBlock>;
}

export function createDailyReviewWorkflow() {
  const workflow = new StateGraph<DailyReviewState>({
    channels: {
      userId: null,
      date: null,
      todaySchedule: null,
      completedTasks: null,
      incompleteTasks: null,
      emailStats: null,
      backlogStatus: null,
      patterns: [],
      tomorrowSuggestions: [],
      reviewSummary: '',
      messages: [],
    },
  });

  // Add nodes
  workflow.addNode("fetchTodayData", fetchTodayDataNode);
  workflow.addNode("extractTodayPatterns", extractTodayPatternsNode);
  workflow.addNode("analyzeProductivity", analyzeProductivityNode);
  workflow.addNode("reviewBacklog", reviewBacklogNode);
  workflow.addNode("prepareTomorrow", prepareTomorrowNode);
  workflow.addNode("updateLearnings", updateLearningsNode);
  workflow.addNode("generateReviewSummary", generateReviewSummaryNode);

  // Define flow
  workflow.addEdge("fetchTodayData", "extractTodayPatterns");
  workflow.addEdge("extractTodayPatterns", "analyzeProductivity");
  workflow.addEdge("analyzeProductivity", "reviewBacklog");
  workflow.addEdge("reviewBacklog", "prepareTomorrow");
  workflow.addEdge("prepareTomorrow", "updateLearnings");
  workflow.addEdge("updateLearnings", "generateReviewSummary");
  workflow.addEdge("generateReviewSummary", END);

  workflow.setEntryPoint("fetchTodayData");

  return workflow.compile();
}

// Fetch all data from today
async function fetchTodayDataNode(state: DailyReviewState): Promise<Partial<DailyReviewState>> {
  const [schedule, tasks, emailStats, backlog] = await Promise.all([
    scheduleService.getScheduleForDate(state.date, state.userId),
    taskService.getTasksForDate(state.date, state.userId),
    emailService.getEmailStatsForDate(state.date, state.userId),
    backlogService.getBacklogSummary(state.userId),
  ]);

  const completedTasks = tasks.filter(t => t.completed);
  const incompleteTasks = tasks.filter(t => !t.completed);

  return {
    todaySchedule: schedule.blocks,
    completedTasks,
    incompleteTasks,
    emailStats,
    backlogStatus: backlog,
  };
}

// Extract patterns from today's activities
async function extractTodayPatternsNode(state: DailyReviewState): Promise<Partial<DailyReviewState>> {
  const patterns: Pattern[] = [];
  
  // 1. Analyze actual vs planned schedule
  const scheduledVsActual = analyzeScheduleAdherence(state.todaySchedule);
  if (scheduledVsActual.deviationPercent > 30) {
    patterns.push({
      type: 'behavior',
      description: `You deviated from planned schedule by ${scheduledVsActual.deviationPercent}%`,
      confidence: 0.9,
      actionable: true,
    });
  }

  // 2. Analyze task completion patterns
  const completionRate = state.completedTasks.length / 
    (state.completedTasks.length + state.incompleteTasks.length);
  
  const tasksByTimeOfDay = groupTasksByTimeOfDay(state.completedTasks);
  const mostProductiveTime = findMostProductiveTime(tasksByTimeOfDay);
  
  patterns.push({
    type: 'productivity',
    description: `Most productive time: ${mostProductiveTime} (${tasksByTimeOfDay[mostProductiveTime]} tasks completed)`,
    confidence: 0.85,
    actionable: true,
  });

  // 3. Analyze break patterns
  const breaksTaken = state.todaySchedule.filter(b => b.type === 'break');
  const lunchTaken = breaksTaken.find(b => isLunchTime(b));
  
  if (!lunchTaken) {
    patterns.push({
      type: 'behavior',
      description: 'Skipped lunch break today',
      confidence: 1.0,
      actionable: true,
    });
  }

  // 4. Email response patterns
  if (state.emailStats.averageResponseTime < 30) {
    patterns.push({
      type: 'behavior',
      description: 'Quick email responder - average response time under 30 minutes',
      confidence: 0.9,
      actionable: false,
    });
  }

  return { patterns };
}

// Analyze productivity metrics
async function analyzeProductivityNode(state: DailyReviewState): Promise<Partial<DailyReviewState>> {
  // Calculate deep work hours
  const focusBlocks = state.todaySchedule.filter(b => b.type === 'focus');
  const totalFocusHours = focusBlocks.reduce((sum, block) => 
    sum + calculateDuration(block.startTime, block.endTime) / 60, 0
  );

  // Task velocity
  const taskVelocity = state.completedTasks.length / totalFocusHours;

  // Add productivity insights to patterns
  const productivityPattern: Pattern = {
    type: 'productivity',
    description: `Completed ${state.completedTasks.length} tasks in ${totalFocusHours.toFixed(1)} focus hours (${taskVelocity.toFixed(1)} tasks/hour)`,
    confidence: 1.0,
    actionable: taskVelocity < 1,
  };

  return {
    patterns: [...state.patterns, productivityPattern],
  };
}

// Review backlog and prioritize
async function reviewBacklogNode(state: DailyReviewState): Promise<Partial<DailyReviewState>> {
  const { taskBacklog, emailBacklog } = state.backlogStatus;
  
  // Age analysis
  const agedTasks = taskBacklog.filter(t => t.daysInBacklog > 3);
  const urgentEmails = emailBacklog.filter(e => e.urgency === 'urgent' && e.daysInBacklog > 1);

  // Update patterns if backlog is growing
  if (agedTasks.length > 5) {
    state.patterns.push({
      type: 'behavior',
      description: `${agedTasks.length} tasks have been in backlog for over 3 days`,
      confidence: 1.0,
      actionable: true,
    });
  }

  // Prepare high-priority items for tomorrow
  const tomorrowPriorities = [
    ...agedTasks.slice(0, 3).map(t => ({
      type: 'task',
      item: t,
      reason: `In backlog for ${t.daysInBacklog} days`,
    })),
    ...urgentEmails.slice(0, 2).map(e => ({
      type: 'email',
      item: e,
      reason: 'Urgent email pending response',
    })),
  ];

  return {
    backlogStatus: {
      ...state.backlogStatus,
      tomorrowPriorities,
    },
  };
}

// Prepare suggestions for tomorrow
async function prepareTomorrowNode(state: DailyReviewState): Promise<Partial<DailyReviewState>> {
  const ragService = new RAGContextService();
  const suggestions: Suggestion[] = [];

  // Get similar past days for context
  const tomorrowContext = await ragService.getContext(
    state.userId,
    `Planning for day after ${state.date}`,
    { includeSimilar: true }
  );

  // 1. Suggest optimal focus time based on today's productivity
  const optimalFocusTime = state.patterns.find(p => 
    p.description.includes('Most productive time')
  );
  
  if (optimalFocusTime) {
    suggestions.push({
      priority: 'high',
      description: 'Schedule deep work during your most productive time',
      reasoning: optimalFocusTime.description,
      timeBlock: {
        type: 'focus',
        title: 'Deep Work - High Priority Tasks',
        startTime: extractTimeFromPattern(optimalFocusTime.description),
        duration: 120,
      },
    });
  }

  // 2. Address backlog items
  if (state.backlogStatus.tomorrowPriorities?.length > 0) {
    suggestions.push({
      priority: 'high',
      description: `Address ${state.backlogStatus.tomorrowPriorities.length} high-priority backlog items`,
      reasoning: 'Items have been pending too long',
    });
  }

  // 3. Protect lunch if skipped today
  const skippedLunch = state.patterns.find(p => 
    p.description.includes('Skipped lunch')
  );
  
  if (skippedLunch) {
    suggestions.push({
      priority: 'high',
      description: 'Block lunch time in calendar',
      reasoning: 'You skipped lunch today - protect tomorrow\'s break',
      timeBlock: {
        type: 'break',
        title: 'Lunch Break',
        startTime: '12:00',
        duration: 60,
      },
    });
  }

  // 4. Adjust schedule based on incomplete tasks
  if (state.incompleteTasks.length > 3) {
    suggestions.push({
      priority: 'medium',
      description: 'Start with incomplete tasks from today',
      reasoning: `${state.incompleteTasks.length} tasks carried over`,
    });
  }

  return { tomorrowSuggestions: suggestions };
}

// Update RAG system with learnings
async function updateLearningsNode(state: DailyReviewState): Promise<Partial<DailyReviewState>> {
  const learningService = new LearningPatternsService();
  const ragService = new RAGContextService();

  // Store significant patterns
  for (const pattern of state.patterns) {
    if (pattern.confidence > 0.7 && pattern.actionable) {
      await ragService.storeContext({
        userId: state.userId,
        type: 'pattern',
        content: pattern.description,
        metadata: {
          date: state.date,
          patternType: pattern.type,
          confidence: pattern.confidence,
        },
      });
    }
  }

  // Store daily summary for future reference
  const dailySummary = {
    date: state.date,
    completionRate: state.completedTasks.length / 
      (state.completedTasks.length + state.incompleteTasks.length),
    focusHours: state.todaySchedule.filter(b => b.type === 'focus').length,
    emailsProcessed: state.emailStats.totalProcessed,
    backlogGrowth: state.backlogStatus.growthRate,
  };

  await ragService.storeContext({
    userId: state.userId,
    type: 'decision',
    content: `Daily review for ${state.date}: ${JSON.stringify(dailySummary)}`,
    metadata: dailySummary,
  });

  return { messages: [...state.messages, new AIMessage('Learnings updated')] };
}

// Generate human-readable summary
async function generateReviewSummaryNode(state: DailyReviewState): Promise<Partial<DailyReviewState>> {
  const summary = `# Daily Review for ${formatDate(state.date)}

## Today's Performance
- ✅ Completed ${state.completedTasks.length} tasks
- ⏳ ${state.incompleteTasks.length} tasks carried to tomorrow
- 📧 Processed ${state.emailStats.totalProcessed} emails (avg response: ${state.emailStats.averageResponseTime}min)
- 🎯 ${state.todaySchedule.filter(b => b.type === 'focus').length} focus sessions

## Key Insights
${state.patterns.map(p => `- ${p.description}`).join('\n')}

## Tomorrow's Priorities
${state.tomorrowSuggestions.map((s, i) => 
  `${i + 1}. [${s.priority.toUpperCase()}] ${s.description}\n   → ${s.reasoning}`
).join('\n\n')}

## Backlog Status
- 📋 Tasks: ${state.backlogStatus.taskBacklog.length} items
- 📧 Emails: ${state.backlogStatus.emailBacklog.length} pending
${state.backlogStatus.tomorrowPriorities?.length > 0 ? 
  `- ⚡ High priority: ${state.backlogStatus.tomorrowPriorities.length} items need attention` : ''}

Ready to plan tomorrow? Just say "Plan my day" in the morning!`;

  return { reviewSummary: summary };
}

// Helper functions
function analyzeScheduleAdherence(blocks: TimeBlock[]): { deviationPercent: number } {
  // Simplified - in practice would compare planned vs actual
  return { deviationPercent: Math.random() * 50 };
}

function groupTasksByTimeOfDay(tasks: Task[]): Record<string, number> {
  const groups: Record<string, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
  };
  
  tasks.forEach(task => {
    const hour = new Date(task.completedAt).getHours();
    if (hour < 12) groups.morning++;
    else if (hour < 17) groups.afternoon++;
    else groups.evening++;
  });
  
  return groups;
}

function findMostProductiveTime(tasksByTime: Record<string, number>): string {
  return Object.entries(tasksByTime)
    .sort(([,a], [,b]) => b - a)[0][0];
}

// Create the tool for daily review
export const dailyReviewTool = tool({
  description: 'Perform end-of-day review and prepare for tomorrow',
  parameters: z.object({
    date: z.string().optional().describe("Date to review (defaults to today)"),
    includeBacklogReview: z.boolean().default(true),
  }),
  execute: async (params) => {
    const workflow = createDailyReviewWorkflow();
    const userId = await getCurrentUserId();
    
    const result = await workflow.invoke({
      userId,
      date: params.date || format(new Date(), 'yyyy-MM-dd'),
    });

    return {
      summary: result.reviewSummary,
      patterns: result.patterns,
      suggestions: result.tomorrowSuggestions,
    };
  }
});
```

### Integration with Chat

Update the chat endpoint to trigger daily review automatically:

```typescript
// In chat route, add time-based triggers
if (isEndOfDay() && !hasRunDailyReview(userId, today)) {
  // Automatically suggest daily review
  return new Response(
    "It's the end of your workday! Would you like me to review today and prepare for tomorrow?",
    {
      headers: { 'Content-Type': 'text/plain' },
    }
  );
}
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
- [ ] Daily Review Workflow implemented and functional
- [ ] Daily patterns extracted and stored in RAG
- [ ] Tomorrow suggestions based on today's performance
- [ ] Backlog review integrated into daily workflow

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