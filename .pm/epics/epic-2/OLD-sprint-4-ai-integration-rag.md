# Sprint 4: AI Integration & RAG

**Duration**: Days 8-9 (2 days)  
**Goal**: Integrate AI SDK, implement RAG system, and enhance LangGraph workflows with natural language understanding

## Sprint Overview

This sprint adds intelligence to dayli:
- pgvector RAG implementation for context-aware responses
- AI SDK integration for chat functionality
- Natural language command processing
- Enhanced workflows with memory and learning

## Prerequisites from Sprint 3
- ✅ Daily planning workflow functional
- ✅ Email triage system working
- ✅ Task management integrated
- ✅ Real-time updates configured

## Day 8: pgvector RAG Implementation & AI SDK Setup

### 8.1 RAG Database Setup

Create migration `migrations/004_rag_functions.sql`:

```sql
-- Function to generate embeddings (called from application)
CREATE OR REPLACE FUNCTION store_embedding(
  p_user_id UUID,
  p_content TEXT,
  p_content_type TEXT,
  p_embedding vector(1536),
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_embedding_id UUID;
BEGIN
  INSERT INTO embeddings (user_id, content, content_type, embedding, metadata)
  VALUES (p_user_id, p_content, p_content_type, p_embedding, p_metadata)
  RETURNING id INTO v_embedding_id;
  
  RETURN v_embedding_id;
END;
$$ LANGUAGE plpgsql;

-- Function to search similar embeddings
CREATE OR REPLACE FUNCTION search_similar_embeddings(
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_content_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.8
) RETURNS TABLE (
  id UUID,
  content TEXT,
  content_type TEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.content,
    e.content_type,
    e.metadata,
    1 - (e.embedding <=> p_query_embedding) as similarity
  FROM embeddings e
  WHERE e.user_id = p_user_id
    AND (p_content_type IS NULL OR e.content_type = p_content_type)
    AND 1 - (e.embedding <=> p_query_embedding) > p_threshold
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to update user patterns
CREATE OR REPLACE FUNCTION update_user_pattern(
  p_user_id UUID,
  p_pattern_type TEXT,
  p_pattern_data JSONB,
  p_confidence FLOAT DEFAULT 0.5
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_patterns (user_id, pattern_type, pattern_data, confidence, last_observed)
  VALUES (p_user_id, p_pattern_type, p_pattern_data, p_confidence, NOW())
  ON CONFLICT (user_id, pattern_type) DO UPDATE
  SET 
    pattern_data = user_patterns.pattern_data || p_pattern_data,
    confidence = LEAST(1.0, user_patterns.confidence + 0.1),
    last_observed = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get sender patterns
CREATE OR REPLACE FUNCTION get_sender_pattern(
  p_user_id UUID,
  p_sender_email TEXT
) RETURNS TABLE (
  importance FLOAT,
  avg_response_time INT,
  total_interactions INT,
  last_interaction TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(AVG(CASE 
      WHEN decision = 'now' THEN 1.0
      WHEN decision = 'tomorrow' THEN 0.5
      ELSE 0.0
    END), 0.5) as importance,
    COALESCE(AVG(EXTRACT(EPOCH FROM (processed_at - received_at))/3600)::INT, 24) as avg_response_time,
    COUNT(*)::INT as total_interactions,
    MAX(processed_at) as last_interaction
  FROM emails
  WHERE user_id = p_user_id 
    AND from_email = p_sender_email
    AND processed_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
```

### 8.2 Embedding Service

Create `apps/web/services/embeddings/embedding.service.ts`:

```typescript
import { OpenAI } from 'openai';
import { supabase } from '@/lib/supabase';

export class EmbeddingService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536,
    });
    
    return response.data[0].embedding;
  }

  async storeEmbedding(
    userId: string,
    content: string,
    contentType: 'command' | 'decision' | 'pattern' | 'preference',
    metadata: Record<string, any> = {}
  ) {
    const embedding = await this.generateEmbedding(content);
    
    const { data, error } = await supabase.rpc('store_embedding', {
      p_user_id: userId,
      p_content: content,
      p_content_type: contentType,
      p_embedding: embedding,
      p_metadata: metadata,
    });
    
    if (error) throw error;
    return data;
  }

  async searchSimilar(
    userId: string,
    query: string,
    contentType?: string,
    limit: number = 10
  ) {
    const queryEmbedding = await this.generateEmbedding(query);
    
    const { data, error } = await supabase.rpc('search_similar_embeddings', {
      p_user_id: userId,
      p_query_embedding: queryEmbedding,
      p_content_type: contentType,
      p_limit: limit,
      p_threshold: 0.7,
    });
    
    if (error) throw error;
    return data;
  }

  async storeUserInteraction(
    userId: string,
    interaction: {
      type: 'command' | 'decision';
      content: string;
      context?: any;
      result?: any;
    }
  ) {
    const metadata = {
      timestamp: new Date().toISOString(),
      context: interaction.context,
      result: interaction.result,
    };
    
    await this.storeEmbedding(
      userId,
      interaction.content,
      interaction.type,
      metadata
    );
  }
}
```

### 8.3 RAG Context Provider

Create `apps/web/services/rag/context.service.ts`:

```typescript
import { EmbeddingService } from '../embeddings/embedding.service';
import { supabase } from '@/lib/supabase';

interface RAGContext {
  recentCommands: Array<{
    content: string;
    metadata: any;
    similarity: number;
  }>;
  userPatterns: Array<{
    pattern_type: string;
    pattern_data: any;
    confidence: number;
  }>;
  scheduleContext: {
    todayStats: any;
    upcomingMeetings: any[];
    pendingTasks: any[];
  };
}

export class RAGContextService {
  private embeddingService: EmbeddingService;
  
  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  async getContextForQuery(userId: string, query: string): Promise<RAGContext> {
    // Get similar past commands
    const recentCommands = await this.embeddingService.searchSimilar(
      userId,
      query,
      'command',
      5
    );

    // Get user patterns
    const { data: patterns } = await supabase
      .from('user_patterns')
      .select('*')
      .eq('user_id', userId)
      .order('confidence', { ascending: false })
      .limit(10);

    // Get current schedule context
    const today = new Date().toISOString().split('T')[0];
    const { data: schedule } = await supabase
      .from('daily_schedules')
      .select(`
        stats,
        time_blocks (
          type,
          title,
          start_time,
          end_time,
          time_block_tasks (
            tasks (*)
          )
        )
      `)
      .eq('user_id', userId)
      .eq('schedule_date', today)
      .single();

    // Get upcoming meetings
    const { data: meetings } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'meeting')
      .gte('start_time', new Date().toISOString())
      .order('start_time')
      .limit(5);

    // Get pending tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'backlog')
      .eq('priority', 'high')
      .limit(10);

    return {
      recentCommands: recentCommands || [],
      userPatterns: patterns || [],
      scheduleContext: {
        todayStats: schedule?.stats || {},
        upcomingMeetings: meetings || [],
        pendingTasks: tasks || [],
      },
    };
  }

  async learnFromInteraction(
    userId: string,
    command: string,
    result: any,
    success: boolean
  ) {
    // Store the interaction
    await this.embeddingService.storeUserInteraction(userId, {
      type: 'command',
      content: command,
      context: { success },
      result,
    });

    // Extract and update patterns
    if (success) {
      // Update command success pattern
      await supabase.rpc('update_user_pattern', {
        p_user_id: userId,
        p_pattern_type: 'command_preference',
        p_pattern_data: {
          command_type: this.classifyCommand(command),
          time_of_day: new Date().getHours(),
          success: true,
        },
        p_confidence: 0.1,
      });
    }
  }

  private classifyCommand(command: string): string {
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('schedule') || lowerCommand.includes('plan')) {
      return 'scheduling';
    } else if (lowerCommand.includes('email') || lowerCommand.includes('triage')) {
      return 'email';
    } else if (lowerCommand.includes('task') || lowerCommand.includes('complete')) {
      return 'task_management';
    } else if (lowerCommand.includes('move') || lowerCommand.includes('reschedule')) {
      return 'modification';
    }
    
    return 'other';
  }
}
```

### 8.4 AI SDK Chat Integration

Create `apps/web/app/api/chat/route.ts`:

```typescript
import { StreamingTextResponse } from 'ai';
import { OpenAI } from 'openai';
import { RAGContextService } from '@/services/rag/context.service';
import { CommandProcessor } from '@/services/chat/command-processor';
import { getServerSession } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ragService = new RAGContextService();
const commandProcessor = new CommandProcessor();

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];
    
    // Get RAG context
    const context = await ragService.getContextForQuery(
      session.user.id,
      lastMessage.content
    );

    // Check if this is a command
    const command = await commandProcessor.parseCommand(lastMessage.content);
    
    if (command) {
      // Execute command
      const result = await commandProcessor.executeCommand(
        command,
        session.user.id,
        context
      );
      
      // Learn from the interaction
      await ragService.learnFromInteraction(
        session.user.id,
        lastMessage.content,
        result,
        true
      );
      
      // Return command result as stream
      return new StreamingTextResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(result.message));
            controller.close();
          },
        })
      );
    }

    // For general chat, use OpenAI with context
    const systemPrompt = `You are dayli, an AI executive assistant focused on helping users manage their time effectively.

Current context:
- Today's stats: ${JSON.stringify(context.scheduleContext.todayStats)}
- Upcoming meetings: ${context.scheduleContext.upcomingMeetings.length} meetings
- Pending high-priority tasks: ${context.scheduleContext.pendingTasks.length} tasks

Recent similar commands:
${context.recentCommands.map(c => `- "${c.content}" (similarity: ${c.similarity})`).join('\n')}

User patterns:
${context.userPatterns.map(p => `- ${p.pattern_type}: ${JSON.stringify(p.pattern_data)}`).join('\n')}

Respond concisely and suggest specific actions the user can take.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
      temperature: 0.7,
    });

    // Store the interaction
    const fullResponse = [];
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content || '';
          fullResponse.push(text);
          controller.enqueue(new TextEncoder().encode(text));
        }
        controller.close();
        
        // Store after streaming completes
        await ragService.learnFromInteraction(
          session.user.id,
          lastMessage.content,
          { response: fullResponse.join('') },
          true
        );
      },
    });

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error('Chat error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
``` 

## Day 9: Natural Language Commands & Enhanced Workflows

### 9.1 Command Processor

Create `apps/web/services/chat/command-processor.ts`:

```typescript
import { z } from 'zod';
import { LangChain } from '@langchain/core';

// Command schemas
const CommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('schedule_task'),
    task: z.string(),
    time: z.string().optional(),
    duration: z.number().optional(),
  }),
  z.object({
    type: z.literal('move_task'),
    taskId: z.string(),
    newTime: z.string(),
  }),
  z.object({
    type: z.literal('complete_task'),
    taskId: z.string(),
  }),
  z.object({
    type: z.literal('triage_emails'),
    timeBlock: z.string().optional(),
  }),
  z.object({
    type: z.literal('show_schedule'),
    date: z.string().optional(),
  }),
  z.object({
    type: z.literal('plan_day'),
    date: z.string().optional(),
  }),
  z.object({
    type: z.literal('clear_time'),
    startTime: z.string(),
    endTime: z.string(),
  }),
  z.object({
    type: z.literal('find_time'),
    duration: z.number(),
    preferences: z.object({
      morning: z.boolean().optional(),
      afternoon: z.boolean().optional(),
    }).optional(),
  }),
]);

type Command = z.infer<typeof CommandSchema>;

export class CommandProcessor {
  private model: ChatOpenAI;
  
  constructor() {
    this.model = new ChatOpenAI({
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.1,
    });
  }

  async parseCommand(input: string): Promise<Command | null> {
    const prompt = `Parse this natural language command into a structured format:
    
    Input: "${input}"
    
    Available command types:
    - schedule_task: Schedule a new task
    - move_task: Move an existing task to a different time
    - complete_task: Mark a task as complete
    - triage_emails: Start email triage
    - show_schedule: Display schedule
    - plan_day: Run daily planning
    - clear_time: Clear a time block
    - find_time: Find available time slot
    
    Return JSON matching the command schema, or null if not a command.`;

    try {
      const response = await this.model.invoke(prompt);
      const parsed = JSON.parse(response.content as string);
      return CommandSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  async executeCommand(
    command: Command,
    userId: string,
    context: RAGContext
  ): Promise<{ success: boolean; message: string; data?: any }> {
    switch (command.type) {
      case 'schedule_task':
        return this.scheduleTask(command, userId, context);
      
      case 'move_task':
        return this.moveTask(command, userId);
      
      case 'complete_task':
        return this.completeTask(command, userId);
      
      case 'triage_emails':
        return this.startEmailTriage(command, userId);
      
      case 'show_schedule':
        return this.showSchedule(command, userId, context);
      
      case 'plan_day':
        return this.planDay(command, userId);
      
      case 'clear_time':
        return this.clearTimeBlock(command, userId);
      
      case 'find_time':
        return this.findAvailableTime(command, userId, context);
      
      default:
        return {
          success: false,
          message: 'Unknown command type',
        };
    }
  }

  private async scheduleTask(
    command: { task: string; time?: string; duration?: number },
    userId: string,
    context: RAGContext
  ) {
    // Find best time slot if not specified
    let targetTime = command.time;
    if (!targetTime) {
      const availableSlot = await this.findNextAvailableSlot(
        userId,
        command.duration || 30,
        context
      );
      targetTime = availableSlot?.startTime;
    }

    if (!targetTime) {
      return {
        success: false,
        message: 'No available time slots found today. Would you like me to check tomorrow?',
      };
    }

    // Create task
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: command.task,
        source: 'ai',
        status: 'scheduled',
        estimated_minutes: command.duration || 30,
      })
      .select()
      .single();

    // Find or create time block
    const { data: block } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'focus')
      .gte('start_time', targetTime)
      .order('start_time')
      .limit(1)
      .single();

    if (block && task) {
      await supabase.from('time_block_tasks').insert({
        time_block_id: block.id,
        task_id: task.id,
      });

      return {
        success: true,
        message: `✅ Scheduled "${command.task}" for ${new Date(targetTime).toLocaleTimeString()}`,
        data: { task, block },
      };
    }

    return {
      success: false,
      message: 'Failed to schedule task',
    };
  }

  private async findNextAvailableSlot(
    userId: string,
    durationMinutes: number,
    context: RAGContext
  ) {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(18, 0, 0, 0);

    // Get all blocks for today
    const { data: blocks } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', now.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time');

    // Find gaps
    let currentTime = now;
    for (const block of blocks || []) {
      const blockStart = new Date(block.start_time);
      const gap = (blockStart.getTime() - currentTime.getTime()) / 60000;
      
      if (gap >= durationMinutes) {
        return {
          startTime: currentTime.toISOString(),
          endTime: new Date(currentTime.getTime() + durationMinutes * 60000).toISOString(),
        };
      }
      
      currentTime = new Date(block.end_time);
    }

    // Check if there's time before end of day
    const remainingTime = (endOfDay.getTime() - currentTime.getTime()) / 60000;
    if (remainingTime >= durationMinutes) {
      return {
        startTime: currentTime.toISOString(),
        endTime: new Date(currentTime.getTime() + durationMinutes * 60000).toISOString(),
      };
    }

    return null;
  }
}
```

### 9.2 Enhanced Email Triage with Learning

Update `apps/web/modules/workflows/graphs/emailTriage.ts`:

```typescript
// Add to existing email triage workflow

// Node: Learn from decisions
workflow.addNode('learnFromDecisions', async (state) => {
  const embeddingService = new EmbeddingService();
  
  for (const decision of state.decisions) {
    const email = state.emails.find(e => e.id === decision.emailId);
    if (!email) continue;

    // Store decision as embedding
    await embeddingService.storeEmbedding(
      state.userId,
      `Email from ${email.from} about "${email.subject}" decided as ${decision.decision}`,
      'decision',
      {
        emailId: email.id,
        sender: email.from,
        subject: email.subject,
        decision: decision.decision,
        reasoning: decision.reasoning,
      }
    );

    // Update sender pattern
    await supabase.rpc('update_user_pattern', {
      p_user_id: state.userId,
      p_pattern_type: 'email_sender',
      p_pattern_data: {
        [email.from]: {
          lastDecision: decision.decision,
          decisionCount: 1,
        },
      },
      p_confidence: 0.1,
    });
  }

  return state;
});

// Add edge
workflow.addEdge('processDecisions', 'learnFromDecisions');
```

### 9.3 Schedule Optimization with Patterns

Create `apps/web/services/schedule/optimizer.service.ts`:

```typescript
export class ScheduleOptimizer {
  private ragService: RAGContextService;
  
  constructor() {
    this.ragService = new RAGContextService();
  }

  async optimizeSchedule(userId: string, date: string) {
    // Get user patterns
    const { data: patterns } = await supabase
      .from('user_patterns')
      .select('*')
      .eq('user_id', userId)
      .in('pattern_type', ['focus_time', 'task_timing', 'meeting_preference']);

    // Analyze patterns
    const focusTimePattern = patterns?.find(p => p.pattern_type === 'focus_time');
    const preferredFocusHours = focusTimePattern?.pattern_data?.preferred_hours || [9, 10, 11];

    // Get current schedule
    const { data: schedule } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', `${date}T00:00:00`)
      .lte('start_time', `${date}T23:59:59`)
      .order('start_time');

    // Optimization rules based on patterns
    const optimizations = [];

    // 1. Move focus blocks to preferred times
    for (const block of schedule || []) {
      if (block.type === 'focus') {
        const hour = new Date(block.start_time).getHours();
        if (!preferredFocusHours.includes(hour)) {
          optimizations.push({
            blockId: block.id,
            suggestion: 'move_to_preferred_time',
            reason: `You usually focus better at ${preferredFocusHours[0]}:00`,
          });
        }
      }
    }

    // 2. Consolidate fragmented time
    const gaps = this.findGaps(schedule || []);
    for (const gap of gaps) {
      if (gap.duration < 30) {
        optimizations.push({
          suggestion: 'consolidate_time',
          reason: `${gap.duration} minute gap is too short for productive work`,
          startTime: gap.start,
          endTime: gap.end,
        });
      }
    }

    return optimizations;
  }

  private findGaps(blocks: any[]) {
    const gaps = [];
    for (let i = 0; i < blocks.length - 1; i++) {
      const currentEnd = new Date(blocks[i].end_time);
      const nextStart = new Date(blocks[i + 1].start_time);
      const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / 60000;
      
      if (gapMinutes > 0) {
        gaps.push({
          start: currentEnd.toISOString(),
          end: nextStart.toISOString(),
          duration: gapMinutes,
        });
      }
    }
    return gaps;
  }
}
```

### 9.4 Chat UI Enhancements

Update `apps/web/modules/chat/components/CommandSuggestions.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Command, Clock, Mail, Calendar, Target } from 'lucide-react';

interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  command: string;
  description: string;
}

const SUGGESTIONS: CommandSuggestion[] = [
  {
    icon: <Calendar size={16} />,
    label: 'Plan my day',
    command: 'Plan my day',
    description: 'Generate optimal schedule for today',
  },
  {
    icon: <Mail size={16} />,
    label: 'Triage emails',
    command: 'Start email triage',
    description: 'Process unread emails quickly',
  },
  {
    icon: <Target size={16} />,
    label: 'Schedule task',
    command: 'Schedule ',
    description: 'Add a task to your calendar',
  },
  {
    icon: <Clock size={16} />,
    label: 'Find time',
    command: 'Find 30 minutes for ',
    description: 'Find available time slot',
  },
  {
    icon: <Command size={16} />,
    label: 'Show commands',
    command: 'What can you do?',
    description: 'See all available commands',
  },
];

export function CommandSuggestions({ onSelectCommand }: { onSelectCommand: (cmd: string) => void }) {
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  useEffect(() => {
    // Load recent commands from chat store
    const stored = localStorage.getItem('dayli-recent-commands');
    if (stored) {
      setRecentCommands(JSON.parse(stored));
    }
  }, []);

  return (
    <div className="p-3 border-t border-border">
      <div className="text-xs text-muted-foreground mb-2">Suggestions</div>
      <div className="space-y-1">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            onClick={() => onSelectCommand(suggestion.command)}
            className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-muted text-left transition-colors"
          >
            <div className="mt-0.5 text-muted-foreground">{suggestion.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{suggestion.label}</div>
              <div className="text-xs text-muted-foreground">{suggestion.description}</div>
            </div>
          </button>
        ))}
      </div>
      
      {recentCommands.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground mt-3 mb-2">Recent</div>
          <div className="space-y-1">
            {recentCommands.slice(0, 3).map((cmd, i) => (
              <button
                key={i}
                onClick={() => onSelectCommand(cmd)}
                className="w-full text-left text-sm p-2 rounded hover:bg-muted truncate"
              >
                {cmd}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

## Deliverables Checklist

### pgvector RAG Implementation ✓
- [ ] Database functions for embeddings
- [ ] Embedding generation service
- [ ] Similarity search functionality
- [ ] Pattern storage and retrieval
- [ ] Context aggregation for queries

### AI SDK Integration ✓
- [ ] Chat endpoint with streaming
- [ ] RAG context injection
- [ ] Command detection and routing
- [ ] Learning from interactions
- [ ] Error handling

### Natural Language Commands ✓
- [ ] Command parser with schemas
- [ ] Command executor
- [ ] Schedule task command
- [ ] Move/complete task commands
- [ ] Email triage command
- [ ] Time finding commands
- [ ] Schedule display command

### Enhanced Workflows ✓
- [ ] Email triage with learning
- [ ] Schedule optimization
- [ ] Pattern recognition
- [ ] Personalized suggestions
- [ ] Context-aware responses

### UI Enhancements ✓
- [ ] Command suggestions
- [ ] Recent commands
- [ ] Streaming indicators
- [ ] Error states
- [ ] Success feedback

## Testing Plan

### RAG System Testing
1. **Embedding Storage**
   - Verify embeddings are stored correctly
   - Test similarity search accuracy
   - Check pattern updates

2. **Context Retrieval**
   - Test context relevance
   - Verify performance (<100ms)
   - Check memory usage

### Command Testing
1. **Natural Language Understanding**
   - Test various phrasings
   - Verify command extraction
   - Check parameter parsing

2. **Command Execution**
   - Test all command types
   - Verify state changes
   - Check error handling

### Integration Testing
1. **End-to-End Flows**
   - Chat → Command → Action → Update
   - Learning from interactions
   - Pattern recognition improvement

## Success Criteria

- [ ] RAG queries return in <100ms
- [ ] Commands understood with 90%+ accuracy
- [ ] Context improves responses noticeably
- [ ] Learning system updates patterns
- [ ] Chat feels intelligent and responsive
- [ ] All commands execute reliably
- [ ] Errors handled gracefully

## Handoff to Sprint 5

Sprint 5 will have:
- Fully intelligent chat system
- Working RAG with learning
- All commands functional
- Context-aware responses
- Ready for polish and optimization

## Performance Optimizations

### Embedding Optimizations
- Use smaller embedding model (text-embedding-3-small)
- Implement caching for frequent queries
- Batch embedding generation
- Index optimization with IVFFlat

### Query Optimizations
- Limit context window size
- Implement query result caching
- Use connection pooling
- Optimize database queries

### Chat Optimizations
- Stream responses immediately
- Implement request debouncing
- Cache command parsing results
- Preload common contexts

## Notes for Implementation

- Store all user interactions for continuous learning
- Implement graceful degradation if RAG fails
- Add telemetry for command usage
- Consider privacy implications of storing embeddings
- Plan for embedding model upgrades
- Monitor token usage for cost optimization
``` 
</rewritten_file>