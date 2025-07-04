# Sprint: AI-First Natural Language System

## Overview
Replace our fragmented system with a single AI brain that understands natural language, context, and user intent - translating everything to concrete operations that dumb tools execute.

## The Problem
- Natural language parsing scattered across 25+ tools
- Date/time resolution happens inconsistently 
- Context gets lost between layers
- Each tool interprets things differently
- Regex patterns everywhere trying to understand language

## The Solution: One AI Brain

### Core Architecture

```
User Input → AI Orchestrator → Execution Engine → Dumb Tools
                    ↓
            Complete Understanding
            (intent, entities, parameters)
```

## Phase 1: Build the AI Brain (Days 1-3)

### 1.1 AI Orchestrator

```typescript
// ai-orchestrator.ts
export class AIOrchestrator {
  async understand(
    message: string,
    context: CompleteContext
  ): Promise<CompleteUnderstanding> {
    
    const understanding = await generateObject({
      model: openai('gpt-4o'),
      schema: completeUnderstandingSchema,
      prompt: buildComprehensivePrompt(message, context)
    });
    
    // If ambiguous, get clarification
    if (understanding.ambiguities?.length > 0) {
      return this.requestClarification(understanding.ambiguities);
    }
    
    return understanding;
  }
}
```

### 1.2 Complete Context

```typescript
interface CompleteContext {
  // Temporal - ALWAYS included
  temporal: {
    currentDateTime: string;      // "2025-07-04T22:15:00Z"
    viewingDate: string;         // "2025-07-04"
    viewingDateTime: string;     // "2025-07-04T00:00:00Z"
    timezone: string;            // "America/New_York"
    isViewingToday: boolean;
  };
  
  // Current state
  state: {
    schedule: Array<{
      id: string;
      type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
      title: string;
      startTime: string;
      endTime: string;
      description?: string;
      metadata?: Record<string, any>;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: number;
      dueDate?: string;
    }>;
    emails: Array<{
      id: string;
      subject: string;
      from: string;
      priority: 'urgent' | 'normal' | 'low';
    }>;
  };
  
  // Conversation memory
  memory: {
    recentMessages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    recentOperations: Array<{
      tool: string;
      params: any;
      result: any;
      timestamp: string;
    }>;
    activeProposals: Array<{
      id: string;
      type: string;
      data: any;
    }>;
    mentionedEntities: {
      primary?: { type: string; id: string; name: string };
      secondary?: { type: string; id: string; name: string };
      all: Array<{ type: string; id: string; name: string; lastMentioned: string }>;
    };
  };
  
  // User patterns
  patterns: {
    workHours: { start: string; end: string };
    lunchTime: { start: string; duration: number };
    commonPhrases: Record<string, string>; // "my morning block" -> "Deep Work"
    emailTimes: string[];
    breakPreferences: { duration: number; frequency: number };
  };
}
```

### 1.3 Complete Understanding Schema

```typescript
const completeUnderstandingSchema = z.object({
  // User's intent
  intent: z.object({
    primary: z.string(),        // "schedule_meeting"
    confidence: z.number(),     // 0.95
    reasoning: z.string(),      // Why AI chose this
  }),
  
  // Exact execution plan
  execution: z.object({
    type: z.enum(['single', 'workflow', 'multi_step']),
    
    // For single operations
    tool: z.string().optional(),
    parameters: z.record(z.any()).optional(),
    
    // For workflows/multi-step
    workflow: z.string().optional(),
    steps: z.array(z.object({
      tool: z.string(),
      parameters: z.record(z.any()),
      dependsOn: z.array(z.number()).optional(),
    })).optional(),
  }),
  
  // All resolved entities
  resolved: z.object({
    // Natural language -> concrete values
    dates: z.array(z.object({
      original: z.string(),     // "tomorrow"
      resolved: z.string(),     // "2025-07-05"
      confidence: z.number(),
    })),
    times: z.array(z.object({
      original: z.string(),     // "after lunch"
      resolved: z.string(),     // "13:00"
      confidence: z.number(),
    })),
    blocks: z.array(z.object({
      original: z.string(),     // "my last work block"
      resolved: z.string(),     // "block-789"
      confidence: z.number(),
    })),
    entities: z.array(z.object({
      original: z.string(),     // "it"
      type: z.string(),         // "meeting"
      resolved: z.string(),     // "meeting-123"
      confidence: z.number(),
    })),
  }),
  
  // Ambiguities that need clarification
  ambiguities: z.array(z.object({
    type: z.string(),
    message: z.string(),
    options: z.array(z.object({
      value: z.any(),
      display: z.string(),
    })),
  })).optional(),
  
  // Response metadata
  metadata: z.object({
    processingTime: z.number(),
    contextUsed: z.array(z.string()), // Which context parts were relevant
    confidence: z.number(),
  }),
});
```

## Phase 1.5: Consolidate Scattered Logic (Day 2)

### CRITICAL: Merge Three Files Into One Brain

The current system has logic scattered across multiple files that ALL need to be consolidated into the AIOrchestrator:

#### 1. From `orchestration.service.ts` → INTO `ai-orchestrator.ts`
- Intent classification logic
- Context prompt building
- Entity extraction
- Handler determination
- Caching system

#### 2. From `context-builder.ts` → INTO `ai-orchestrator.ts`
- Schedule state calculation
- Task state aggregation
- User pattern extraction
- Viewing date management

#### 3. From `chat/route.ts` → REMOVE (make it thin)
- ALL system prompts → Move to prompt-builder.ts
- ALL routing logic → Move to ai-orchestrator.ts
- ALL context building → Move to ai-orchestrator.ts
- ALL intent handling → Move to ai-orchestrator.ts

### The Result: One Brain, Thin API

**BEFORE (Current - BAD):**
```typescript
// chat/route.ts (728 lines! 😱)
- Authentication
- Service configuration
- Intent classification
- Routing logic
- System prompts
- Response handling
- Context building
- Proposal detection

// orchestration.service.ts
- Intent classification
- Prompt building
- Entity extraction

// context-builder.ts
- Context aggregation
- State calculation
```

**AFTER (Target - GOOD):**
```typescript
// chat/route.ts (~50 lines)
export async function POST(req: Request) {
  const { messages, viewingDate } = await req.json();
  const user = await authenticate(req);
  
  const result = await aiOrchestrator.processMessage(
    messages,
    user.id,
    viewingDate
  );
  
  return result.toDataStreamResponse();
}

// ai-orchestrator.ts (The ONE Brain)
export class AIOrchestrator {
  // Absorbs EVERYTHING from:
  // - orchestration.service.ts (delete after merge)
  // - context-builder.ts (delete after merge)
  // - chat route logic (strip down route)
  
  async processMessage(messages, userId, viewingDate) {
    // 1. Build context (from context-builder)
    const context = await this.buildCompleteContext(userId, viewingDate, messages);
    
    // 2. Understand intent (from orchestration service)
    const understanding = await this.understand(
      messages[messages.length - 1].content,
      context
    );
    
    // 3. Execute (new clean logic)
    return await this.execute(understanding, context);
  }
}
```

### Migration Steps

1. **Copy all methods from orchestration.service.ts to ai-orchestrator.ts**
   - `classifyIntent` → `understand`
   - `buildContextPrompt` → internal method
   - `extractEntities` → internal method
   - Keep the caching system

2. **Copy all logic from context-builder.ts to ai-orchestrator.ts**
   - `buildOrchestrationContext` → `buildCompleteContext`
   - `calculateScheduleState` → internal method
   - `calculateTaskState` → internal method

3. **Strip chat/route.ts down to bare minimum**
   - ONLY: Auth, parse request, call orchestrator, return response
   - Move ALL prompts to prompt-builder.ts
   - Remove ALL routing/handling logic

4. **Delete the old files**
   - `orchestration.service.ts` - fully absorbed
   - `context-builder.ts` - fully absorbed
   - `orchestration/types.ts` - merge needed types into ai/types

This consolidation is REQUIRED for the AI-first approach to work properly.

## Phase 2: Comprehensive Prompt Engineering (Days 2-3)

### 2.1 The Master Prompt

```typescript
function buildComprehensivePrompt(message: string, context: CompleteContext): string {
  return `
You are an intelligent scheduling assistant with COMPLETE understanding of the user's context.

CRITICAL CONTEXT AWARENESS:
- Current actual date/time: ${context.temporal.currentDateTime}
- User is VIEWING: ${context.temporal.viewingDate} (${context.temporal.isViewingToday ? 'today' : 'different day'})
- When user says "today" while viewing ${context.temporal.viewingDate}, they mean ${context.temporal.viewingDate}
- All date references should be relative to VIEWING DATE, not current date

USER MESSAGE: "${message}"

CURRENT SCHEDULE (for ${context.temporal.viewingDate}):
${formatSchedule(context.state.schedule)}

RECENT CONVERSATION:
${formatConversation(context.memory.recentMessages)}

LAST OPERATIONS:
${formatOperations(context.memory.recentOperations)}

USER PATTERNS:
- Work hours: ${context.patterns.workHours.start} - ${context.patterns.workHours.end}
- Lunch typically at: ${context.patterns.lunchTime.start}
- Common phrases: ${JSON.stringify(context.patterns.commonPhrases)}

RESOLUTION RULES:
1. Date Resolution:
   - "today" = ${context.temporal.viewingDate}
   - "tomorrow" = day after ${context.temporal.viewingDate}
   - "next [day]" = relative to ${context.temporal.viewingDate}

2. Time Resolution:
   - "morning" = 9:00-12:00
   - "afternoon" = 12:00-17:00
   - "evening" = 17:00-21:00
   - "after [block]" = end time of that block
   - "before [block]" = with appropriate gap

3. Block Resolution:
   - Match by type, title, time, or description
   - "last [type] block" = final block of that type
   - "my [time] [type] block" = block of type in time period

4. Entity Resolution:
   - "it/that" = ${context.memory.mentionedEntities.primary?.name || 'unknown'}
   - Check recent operations for context

RETURN FORMAT:
You must determine the user's intent and provide FULLY RESOLVED parameters.
No natural language should remain in parameters - only IDs, dates, times.
`;
}
```

## Phase 3: Execution Engine (Days 4-5)

### 3.1 Simple Execution

```typescript
// execution-engine.ts
export class ExecutionEngine {
  constructor(
    private tools: Map<string, Tool>,
    private operationStore: OperationStore
  ) {}
  
  async execute(
    understanding: CompleteUnderstanding,
    context: CompleteContext
  ): Promise<ExecutionResult> {
    
    // Track the operation
    const operationId = generateId();
    
    switch (understanding.execution.type) {
      case 'single':
        return this.executeSingle(
          understanding.execution.tool!,
          understanding.execution.parameters!,
          operationId,
          context
        );
        
      case 'workflow':
        return this.executeWorkflow(
          understanding.execution.workflow!,
          understanding.execution.parameters!,
          operationId,
          context
        );
        
      case 'multi_step':
        return this.executeMultiStep(
          understanding.execution.steps!,
          operationId,
          context
        );
    }
  }
  
  private async executeSingle(
    toolName: string,
    parameters: any,
    operationId: string,
    context: CompleteContext
  ) {
    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`Tool ${toolName} not found`);
    
    // Tools receive ONLY concrete parameters
    const result = await tool.execute(parameters, {
      userId: context.userId,
      operationId
    });
    
    // Track for future reference resolution
    this.operationStore.track(operationId, toolName, parameters, result);
    
    return result;
  }
}
```

## Phase 4: Tool Simplification (Days 6-8)

### 4.1 Before vs After

**BEFORE - Complex Tool:**
```typescript
export const moveTimeBlock = {
  execute: async (params) => {
    // Parse natural language time
    const time = parseTime(params.time || params.newTime);
    
    // Find block by description
    let block;
    if (params.blockId) {
      block = await getBlock(params.blockId);
    } else if (params.blockDescription) {
      block = await findBlockByDescription(params.blockDescription);
    } else if (params.currentTime) {
      block = await findCurrentBlock();
    }
    
    // Complex date handling
    const date = params.date || new Date().toISOString().split('T')[0];
    
    // Move the block
    return await moveBlock(block.id, time, date);
  }
};
```

**AFTER - Dumb Tool:**
```typescript
export const moveTimeBlock = {
  parameters: z.object({
    blockId: z.string(),        // ALWAYS provided
    newStartTime: z.string(),   // ALWAYS in HH:MM format
    date: z.string(),          // ALWAYS in YYYY-MM-DD format
  }),
  
  execute: async (params, context) => {
    // Just do the operation
    return await scheduleService.moveBlock(
      params.blockId,
      params.newStartTime,
      params.date,
      context.userId
    );
  }
};
```

### 4.2 Tool Migration Checklist

For EVERY tool:
- [ ] Remove ALL natural language parsing
- [ ] Remove ALL date/time logic
- [ ] Remove ALL entity matching
- [ ] Remove ALL defaults
- [ ] Accept ONLY concrete IDs and values
- [ ] Make ALL parameters required
- [ ] Focus on single responsibility

## Phase 5: Integration (Days 9-10)

### 5.1 Update Chat Route

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages, viewingDate } = await req.json();
  
  // Build complete context
  const context = await buildCompleteContext(userId, viewingDate, messages);
  
  // Get AI understanding
  const understanding = await aiOrchestrator.understand(
    messages[messages.length - 1].content,
    context
  );
  
  // Execute with concrete parameters
  const result = await executionEngine.execute(understanding, context);
  
  return new Response(result);
}
```

### 5.2 Remove Old Systems

Delete:
- [ ] `time-parser.ts` - AI handles this
- [ ] `proposal-store.ts` - Part of operation store
- [ ] All regex patterns in tools
- [ ] All parameter defaults
- [ ] Entity extraction in orchestrator
- [ ] Date handling logic everywhere

## Success Metrics

1. **Natural Language Understanding**: 95%+ accuracy
2. **Zero Natural Language in Tools**: 100% compliance
3. **Context Preservation**: Never lose viewing date
4. **Reference Resolution**: "it/that" works every time
5. **User Satisfaction**: No more date confusion

## What This Solves

✅ **Date confusion** - AI always knows viewing context
✅ **Block ambiguity** - AI resolves to specific IDs
✅ **Lost context** - Everything tracked in one place
✅ **Inconsistent behavior** - One brain, one interpretation
✅ **Complex tools** - Tools become trivially simple
✅ **"It/that" references** - AI tracks conversation flow

## The Result

A system where:
- **One AI brain** understands everything
- **Tools are dumb** - just execute operations
- **Context flows perfectly** - never lost
- **Natural language works** - anywhere, consistently
- **Adding features is trivial** - just teach the AI

This is a TRUE AI-first system, not a bunch of regex patterns pretending to understand language. 