# Sprint 03.03 NEW: RAG Memory System

## Sprint Overview

**Sprint Number**: 03.03  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: PLANNING

### Sprint Goal
Build a multi-layer RAG (Retrieval-Augmented Generation) system that learns from user patterns, stores decisions, and makes the AI assistant increasingly personalized over time. This system will be used by all workflows to make smarter decisions.

### Key Architecture
- **Three-Layer Context**: Patterns (long-term), Recent (7 days), Similar (vector search)
- **Learning Types**: Decisions, Rejections, Preferences, Patterns
- **Integration**: Used by all workflows, especially EOD for daily learning

## RAG Context Service

### Core Service Implementation

```typescript
// apps/web/modules/rag/services/ragContext.service.ts

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

  async storeContext(params: {
    userId: string;
    type: ContextEntry['type'];
    content: string;
    metadata?: Record<string, any>;
  }): Promise<ContextEntry> {
    const embedding = await this.generateEmbedding(params.content);
    
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

    if (includePatterns) {
      context.patterns = await this.fetchPatterns(userId, limit);
    }

    if (includeRecent) {
      context.recentDecisions = await this.fetchRecentDecisions(userId, 7);
    }

    if (includeSimilar) {
      context.similarSituations = await this.fetchSimilarSituations(
        userId,
        queryEmbedding,
        limit
      );
    }

    return context;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    return response.data[0].embedding;
  }

  private async fetchPatterns(userId: string, limit: number): Promise<ContextEntry[]> {
    const { data } = await this.supabase
      .from('rag_context')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'pattern')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return data || [];
  }

  private async fetchRecentDecisions(userId: string, days: number): Promise<ContextEntry[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await this.supabase
      .from('rag_context')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'decision')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });
    
    return data || [];
  }

  private async fetchSimilarSituations(
    userId: string,
    queryEmbedding: number[],
    limit: number
  ): Promise<ContextEntry[]> {
    const { data } = await this.supabase.rpc('search_similar_contexts', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: limit,
      threshold: 0.7,
    });
    
    return data || [];
  }
}
```

## Learning Patterns Service

### Learning from All User Actions

```typescript
// apps/web/modules/rag/services/learningPatterns.ts

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

    await this.extractSenderPatterns(params.userId, params.sender);
  }

  /**
   * CRITICAL: Learn from rejected proposals
   * This prevents the AI from making the same mistakes repeatedly
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
        rejectedAt: new Date().toISOString(),
      },
    });

    // Analyze rejection patterns
    await this.analyzeRejectionPatterns(params.userId, params.proposalType);
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

    await this.checkPreferencePattern(params.userId, params.preference);
  }

  /**
   * Learn from task completion patterns
   */
  async learnFromTaskCompletion(params: {
    userId: string;
    task: Task;
    completedAt: Date;
    actualDuration: number;
    timeOfDay: string;
    energyLevel?: string;
  }) {
    const content = `Completed task "${params.task.title}" at ${params.timeOfDay} in ${params.actualDuration} minutes (estimated: ${params.task.estimated_minutes})`;
    
    await this.ragService.storeContext({
      userId: params.userId,
      type: 'decision',
      content,
      metadata: {
        taskId: params.task.id,
        accuracy: params.actualDuration / params.task.estimated_minutes,
        timeOfDay: params.timeOfDay,
        energyLevel: params.energyLevel,
      },
    });
  }

  /**
   * Extract patterns from multiple decisions
   */
  private async extractSchedulePatterns(userId: string) {
    const recentDecisions = await this.supabase
      .from('rag_context')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'decision')
      .like('content', '%schedule%')
      .order('created_at', { ascending: false })
      .limit(20);

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
   * Analyze rejection patterns to avoid repeated mistakes
   */
  private async analyzeRejectionPatterns(userId: string, proposalType: string) {
    const rejections = await this.supabase
      .from('rag_context')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'rejection')
      .eq('metadata->proposalType', proposalType)
      .order('created_at', { ascending: false })
      .limit(10);

    if (rejections.data && rejections.data.length >= 3) {
      // Find common elements in rejections
      const commonElements = this.findCommonRejectionElements(rejections.data);
      
      if (commonElements.length > 0) {
        await this.ragService.storeContext({
          userId,
          type: 'pattern',
          content: `User consistently rejects ${proposalType} with: ${commonElements.join(', ')}`,
          metadata: {
            patternType: 'rejection',
            proposalType,
            avoidElements: commonElements,
          },
        });
      }
    }
  }

  private findCommonRejectionElements(rejections: any[]): string[] {
    // Analyze rejected proposals for common patterns
    const elements: Record<string, number> = {};
    
    rejections.forEach(rejection => {
      const proposal = rejection.metadata?.proposal;
      if (proposal) {
        // Extract key elements (time, type, duration, etc.)
        Object.entries(proposal).forEach(([key, value]) => {
          const element = `${key}:${value}`;
          elements[element] = (elements[element] || 0) + 1;
        });
      }
    });
    
    // Return elements that appear in >50% of rejections
    const threshold = rejections.length * 0.5;
    return Object.entries(elements)
      .filter(([_, count]) => count > threshold)
      .map(([element]) => element);
  }
}
```

## Integration with Workflows

### Context Enhancement for All Workflows

```typescript
// apps/web/modules/workflows/utils/contextEnhancer.ts

export class ContextEnhancer {
  private ragService: RAGContextService;
  
  constructor() {
    this.ragService = new RAGContextService();
  }

  /**
   * Enhance any workflow state with RAG context
   */
  async enhanceWorkflowState(
    userId: string,
    workflowType: string,
    currentState: any
  ): Promise<any> {
    const query = this.buildContextQuery(workflowType, currentState);
    const ragContext = await this.ragService.getContext(userId, query);
    
    // Check for relevant rejections to avoid
    const relevantRejections = await this.getRelevantRejections(userId, workflowType);
    
    return {
      ...currentState,
      ragContext: {
        patterns: this.summarizePatterns(ragContext.patterns),
        recentDecisions: this.summarizeDecisions(ragContext.recentDecisions),
        similarSituations: this.summarizeSituations(ragContext.similarSituations),
        avoidPatterns: relevantRejections,
      },
    };
  }

  private async getRelevantRejections(userId: string, workflowType: string): Promise<string[]> {
    const { data } = await this.supabase
      .from('rag_context')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'pattern')
      .eq('metadata->patternType', 'rejection')
      .eq('metadata->proposalType', workflowType);
    
    return data?.map(d => d.content) || [];
  }

  private buildContextQuery(workflowType: string, state: any): string {
    switch (workflowType) {
      case 'schedule':
        return `Scheduling ${state.taskType || 'task'} for ${state.timeOfDay || 'today'}`;
      case 'email':
        return `Email triage for ${state.emailCount || 'multiple'} emails`;
      case 'task':
        return `Task prioritization with ${state.taskCount || 'multiple'} tasks`;
      case 'eod': // End of Day workflow
        return `Daily review and planning for tomorrow`;
      default:
        return `Workflow: ${workflowType}`;
    }
  }
}
```

## Integration with End of Day (EOD) Workflow

The EOD workflow (in Sprint 03.04) will use this RAG system extensively:

```typescript
// This shows how EOD workflow will use RAG - actual implementation in Sprint 03.04

// In EOD workflow's updateLearnings node:
async function updateLearningsNode(state: EODState): Promise<Partial<EODState>> {
  const learningService = new LearningPatternsService();
  const ragService = new RAGContextService();

  // 1. Store patterns found during the day
  for (const pattern of state.todayPatterns) {
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

  // 2. Learn from completed tasks
  for (const task of state.completedTasks) {
    await learningService.learnFromTaskCompletion({
      userId: state.userId,
      task,
      completedAt: task.completed_at,
      actualDuration: task.actual_duration,
      timeOfDay: getTimeOfDay(task.completed_at),
    });
  }

  // 3. Learn from schedule adherence
  if (state.scheduleDeviations.length > 0) {
    for (const deviation of state.scheduleDeviations) {
      await learningService.learnFromScheduleChange({
        userId: state.userId,
        changeType: 'move',
        blockType: deviation.blockType,
        originalTime: deviation.planned,
        newTime: deviation.actual,
        reason: deviation.reason || 'Schedule adjustment',
      });
    }
  }

  // 4. Store daily summary for future reference
  const dailySummary = {
    date: state.date,
    completionRate: state.completedTasks.length / 
      (state.completedTasks.length + state.incompleteTasks.length),
    focusHours: state.todaySchedule.filter(b => b.type === 'focus').length,
    emailsProcessed: state.emailStats.totalProcessed,
    patterns: state.todayPatterns.map(p => p.description),
  };

  await ragService.storeContext({
    userId: state.userId,
    type: 'decision',
    content: `Daily review for ${state.date}: ${JSON.stringify(dailySummary)}`,
    metadata: dailySummary,
  });

  return { learningsStored: true };
}
```

## RAG Tools for Chat Interface

```typescript
// apps/web/modules/ai/tools/rag/index.ts

export const storeUserFeedback = tool({
  description: "Store user feedback or correction for learning",
  parameters: z.object({
    feedbackType: z.enum(['correction', 'preference', 'rejection']),
    context: z.string(),
    feedback: z.string(),
    metadata: z.record(z.any()).optional(),
  }),
  execute: async ({ feedbackType, context, feedback, metadata }) => {
    try {
      const learningService = new LearningPatternsService();
      const userId = await getCurrentUserId();
      
      if (feedbackType === 'rejection') {
        await learningService.learnFromRejection({
          userId,
          proposalType: metadata?.proposalType || 'general',
          proposal: metadata?.proposal || {},
          reason: feedback,
        });
      } else {
        await ragService.storeContext({
          userId,
          type: feedbackType === 'correction' ? 'decision' : 'preference',
          content: `${context}: ${feedback}`,
          metadata: metadata || {},
        });
      }
      
      return toolSuccess({
        stored: true,
        message: "I'll remember that for next time",
      });
    } catch (error) {
      return toolError('FEEDBACK_STORAGE_FAILED', error.message);
    }
  },
});

export const getPersonalizedContext = tool({
  description: "Retrieve personalized context for better recommendations",
  parameters: z.object({
    query: z.string(),
    contextType: z.enum(['patterns', 'recent', 'similar', 'all']).default('all'),
  }),
  execute: async ({ query, contextType }) => {
    try {
      const ragService = new RAGContextService();
      const userId = await getCurrentUserId();
      
      const options = {
        includePatterns: contextType === 'patterns' || contextType === 'all',
        includeRecent: contextType === 'recent' || contextType === 'all',
        includeSimilar: contextType === 'similar' || contextType === 'all',
      };
      
      const context = await ragService.getContext(userId, query, options);
      
      return toolSuccess({
        context,
        insights: generateInsights(context),
      });
    } catch (error) {
      return toolError('CONTEXT_RETRIEVAL_FAILED', error.message);
    }
  },
});
```

## Database Schema

```sql
-- RAG context table with vector embeddings
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

-- Vector similarity search function
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

## Testing the RAG System

```typescript
// Test storing and retrieving context
describe('RAG Context Service', () => {
  it('should store and retrieve patterns', async () => {
    const service = new RAGContextService();
    
    // Store a pattern
    const pattern = await service.storeContext({
      userId: 'test-user',
      type: 'pattern',
      content: 'User prefers meetings in the afternoon',
      metadata: { confidence: 0.85 },
    });
    
    expect(pattern.id).toBeDefined();
    
    // Retrieve similar context
    const context = await service.getContext(
      'test-user',
      'schedule meeting time'
    );
    
    expect(context.patterns).toContainEqual(
      expect.objectContaining({ content: pattern.content })
    );
  });
  
  it('should learn from rejections', async () => {
    const learningService = new LearningPatternsService();
    
    // Simulate multiple rejections
    for (let i = 0; i < 3; i++) {
      await learningService.learnFromRejection({
        userId: 'test-user',
        proposalType: 'meeting_time',
        proposal: { time: '8:00 AM', duration: 60 },
        reason: 'Too early',
      });
    }
    
    // Should create a pattern
    const patterns = await ragService.getContext(
      'test-user',
      'schedule morning meeting'
    );
    
    expect(patterns.patterns).toContainEqual(
      expect.objectContaining({
        content: expect.stringContaining('consistently rejects'),
      })
    );
  });
});
```

## Success Criteria

- [ ] RAG context service stores and retrieves embeddings
- [ ] Vector similarity search returns relevant results
- [ ] Learning from all user actions (decisions, rejections, preferences)
- [ ] Pattern extraction works for schedule, email, and task domains
- [ ] Rejection patterns prevent repeated mistakes
- [ ] Integration with workflow context enhancement
- [ ] EOD workflow can store daily learnings
- [ ] Chat tools for feedback and context retrieval
- [ ] Database migrations successful
- [ ] Performance <100ms for context retrieval
- [ ] Embeddings generated correctly with OpenAI
- [ ] RLS policies protect user data 