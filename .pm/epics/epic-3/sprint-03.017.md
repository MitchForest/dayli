# Sprint 03.017: Comprehensive Structured Output Implementation

## Sprint Overview

**Sprint Number**: 03.017  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 5 days  
**Status**: PLANNING

### Sprint Goal
Implement comprehensive structured output system for all AI tools to ensure 100% consistent, type-safe, and reliable data handling. This eliminates parsing errors, enables rich UI components, and provides seamless streaming for all operations.

### Problem Statement
Current issues across the system:
- Schedule blocks showing garbled text and missing data
- Inconsistent tool response formats
- Regex parsing failures causing UI breaks
- No streaming support for most operations
- Unpredictable error handling
- Mixed data and display logic in tool responses

### Solution Overview
Implement AI SDK's structured output capabilities for ALL tools while maintaining conversational flexibility. Every data operation returns structured data, while conversational responses can remain text-based.

## Architecture Design

### Core Principles
1. **Separation of Concerns**: Data, Display, and Narrative are separate
2. **Type Safety**: End-to-end TypeScript with Zod validation
3. **Streaming First**: All operations support partial results
4. **Progressive Enhancement**: Fallback to text when needed
5. **Unified Error Handling**: Consistent error structure across all tools

### Response Types

```typescript
// Three types of AI responses
type AIResponse = 
  | ConversationalResponse    // Pure text conversation
  | StructuredDataResponse    // Tool operations with data
  | MixedResponse            // Combination of both
```

## Complete Tool Inventory

### Schedule Tools (9 tools)
1. `getSchedule` - View schedule for a date
2. `createTimeBlock` - Create new time blocks
3. `moveTimeBlock` - Move existing blocks
4. `deleteTimeBlock` - Delete blocks
5. `findTimeBlock` - Search for blocks
6. `assignTaskToBlock` - Assign tasks to blocks
7. `completeTask` - Mark tasks complete
8. `getUnassignedTasks` - View task backlog
9. `regenerateSchedule` - AI schedule optimization

### Task Tools (4 tools)
1. `createTask` - Create new tasks
2. `editTask` - Modify existing tasks
3. `deleteTask` - Remove tasks
4. `findTasks` - Search and filter tasks

### Email Tools (4 tools)
1. `listEmails` - View email list
2. `readEmailContent` - Read full email
3. `draftEmailResponse` - Create email drafts
4. `processEmailToTask` - Convert emails to tasks

### Calendar Tools (3 tools)
1. `scheduleMeeting` - Create calendar events
2. `rescheduleMeeting` - Move calendar events
3. `handleMeetingConflict` - Resolve conflicts

### Preference Tools (2 tools)
1. `getPreferences` - View user preferences
2. `updatePreference` - Modify preferences

### Workflow Tools (1 tool)
1. `scheduleDay` - Run daily planning workflow

**Total: 23 tools to update**

## File Structure & Changes

### New Files to Create

```
apps/web/modules/ai/
├── schemas/
│   ├── universal.schema.ts      # Universal response schema
│   ├── conversation.schema.ts   # Conversational response schema
│   ├── schedule.schema.ts       # Schedule-specific schemas
│   ├── task.schema.ts          # Task-specific schemas
│   ├── email.schema.ts         # Email-specific schemas
│   ├── calendar.schema.ts      # Calendar-specific schemas
│   ├── preference.schema.ts    # Preference-specific schemas
│   └── workflow.schema.ts      # Workflow-specific schemas
├── components/
│   ├── StructuredMessage.tsx   # Main structured message renderer
│   ├── DataCard.tsx           # Generic data card component
│   ├── ProgressStream.tsx     # Streaming progress component
│   ├── ActionButtons.tsx      # Contextual action buttons
│   └── ErrorDisplay.tsx       # Structured error display
├── hooks/
│   ├── useStructuredStream.ts # Hook for streaming structured data
│   └── useToolResponse.ts     # Hook for tool responses
└── utils/
    ├── validation.ts          # Schema validation utilities
    ├── repair.ts             # Data repair functions
    └── fallback.ts           # Fallback handlers
```

### Files to Modify

#### Core System Files
1. `apps/web/app/api/chat/route.ts` - Add structured output support
2. `apps/web/modules/ai/tools/types.ts` - Add universal types
3. `apps/web/modules/ai/tools/registry.ts` - Update for structured tools

#### All Tool Files (23 files)
Schedule Tools:
- `apps/web/modules/ai/tools/schedule/getSchedule.ts`
- `apps/web/modules/ai/tools/schedule/createTimeBlock.ts`
- `apps/web/modules/ai/tools/schedule/moveTimeBlock.ts`
- `apps/web/modules/ai/tools/schedule/deleteTimeBlock.ts`
- `apps/web/modules/ai/tools/schedule/findTimeBlock.ts`
- `apps/web/modules/ai/tools/schedule/assignTaskToBlock.ts`
- `apps/web/modules/ai/tools/schedule/completeTask.ts`
- `apps/web/modules/ai/tools/schedule/getUnassignedTasks.ts`
- `apps/web/modules/ai/tools/schedule/regenerateSchedule.ts`

Task Tools:
- `apps/web/modules/ai/tools/task/createTask.ts`
- `apps/web/modules/ai/tools/task/editTask.ts`
- `apps/web/modules/ai/tools/task/deleteTask.ts`
- `apps/web/modules/ai/tools/task/findTasks.ts`

Email Tools:
- `apps/web/modules/ai/tools/email/listEmails.ts`
- `apps/web/modules/ai/tools/email/readEmailContent.ts`
- `apps/web/modules/ai/tools/email/draftEmailResponse.ts`
- `apps/web/modules/ai/tools/email/processEmailToTask.ts`

Calendar Tools:
- `apps/web/modules/ai/tools/calendar/scheduleMeeting.ts`
- `apps/web/modules/ai/tools/calendar/rescheduleMeeting.ts`
- `apps/web/modules/ai/tools/calendar/handleMeetingConflict.ts`

Preference Tools:
- `apps/web/modules/ai/tools/preference/getPreferences.ts`
- `apps/web/modules/ai/tools/preference/updatePreference.ts`

Workflow Tools:
- `apps/web/modules/ai/tools/workflow/scheduleDay.ts`

#### UI Components to Update
1. `apps/web/modules/chat/components/MessageContent.tsx`
2. `apps/web/modules/chat/components/MessageList.tsx`
3. `apps/web/modules/chat/components/ChatPanel.tsx`
4. `apps/web/modules/chat/utils/messageParser.ts` (deprecate)

#### Components to Deprecate/Remove
1. `apps/web/modules/chat/components/ChatScheduleDisplay.tsx` (replace with StructuredMessage)
2. `apps/web/modules/chat/components/ChatScheduleBlock.tsx` (replace with DataCard)
3. `apps/web/modules/chat/utils/messageParser.ts` (no longer needed)

## Implementation Details

### 1. Universal Response Schema

```typescript
// apps/web/modules/ai/schemas/universal.schema.ts
import { z } from 'zod';

// Base response that ALL tools must return
export const universalToolResponseSchema = z.object({
  // Response metadata
  metadata: z.object({
    toolName: z.string(),
    operation: z.enum(['create', 'read', 'update', 'delete', 'execute']),
    resourceType: z.enum(['schedule', 'task', 'email', 'meeting', 'preference', 'workflow']),
    timestamp: z.string().datetime(),
    executionTime: z.number(), // milliseconds
  }),
  
  // The actual data - validated per resource type
  data: z.any(), // Will be refined by specific schemas
  
  // Display instructions for UI
  display: z.object({
    type: z.enum(['card', 'list', 'timeline', 'grid', 'form', 'confirmation', 'progress']),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    components: z.array(componentSchema),
  }),
  
  // UI behavior hints
  ui: z.object({
    notification: z.object({
      show: z.boolean(),
      type: z.enum(['success', 'info', 'warning', 'error']),
      message: z.string(),
      duration: z.number().default(3000),
    }).optional(),
    suggestions: z.array(z.string()),
    actions: z.array(actionSchema),
    confirmationRequired: z.boolean().default(false),
    confirmationId: z.string().optional(),
  }),
  
  // Streaming support
  streaming: z.object({
    supported: z.boolean(),
    progress: z.number().min(0).max(100).optional(),
    stage: z.enum(['initializing', 'processing', 'finalizing', 'complete']).optional(),
    partialData: z.any().optional(),
  }).optional(),
  
  // Error handling
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    recoverable: z.boolean(),
    suggestedActions: z.array(z.string()),
  }).optional(),
});

// Component schema for modular UI
export const componentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scheduleBlock'),
    data: scheduleBlockComponentSchema,
  }),
  z.object({
    type: z.literal('taskCard'),
    data: taskCardComponentSchema,
  }),
  z.object({
    type: z.literal('emailPreview'),
    data: emailPreviewComponentSchema,
  }),
  z.object({
    type: z.literal('meetingCard'),
    data: meetingCardComponentSchema,
  }),
  z.object({
    type: z.literal('preferenceForm'),
    data: preferenceFormComponentSchema,
  }),
  z.object({
    type: z.literal('progressIndicator'),
    data: progressIndicatorSchema,
  }),
  z.object({
    type: z.literal('confirmationDialog'),
    data: confirmationDialogSchema,
  }),
]);

// Action schema for contextual actions
export const actionSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  variant: z.enum(['primary', 'secondary', 'danger']).default('secondary'),
  action: z.object({
    type: z.enum(['tool', 'message', 'url']),
    tool: z.string().optional(),
    params: z.record(z.any()).optional(),
    message: z.string().optional(),
    url: z.string().optional(),
  }),
});
```

### 2. Conversation Response Schema

```typescript
// apps/web/modules/ai/schemas/conversation.schema.ts
export const conversationResponseSchema = z.object({
  type: z.literal('conversation'),
  content: z.string(),
  tone: z.enum(['friendly', 'professional', 'casual', 'urgent']).default('friendly'),
  formatting: z.object({
    paragraphs: z.boolean().default(true),
    emphasis: z.array(z.object({
      text: z.string(),
      type: z.enum(['bold', 'italic', 'code']),
    })).optional(),
  }).optional(),
});

// Mixed response for conversation + data
export const mixedResponseSchema = z.object({
  type: z.literal('mixed'),
  conversation: conversationResponseSchema,
  data: z.array(universalToolResponseSchema),
  layout: z.enum(['conversation-first', 'data-first', 'interleaved']).default('conversation-first'),
});
```

### 3. Schedule-Specific Schemas

```typescript
// apps/web/modules/ai/schemas/schedule.schema.ts
export const timeBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['work', 'meeting', 'email', 'break', 'blocked']),
  title: z.string(),
  startTime: z.string().regex(/^\d{1,2}:\d{2} (AM|PM)$/),
  endTime: z.string().regex(/^\d{1,2}:\d{2} (AM|PM)$/),
  description: z.string().optional(),
  color: z.string().optional(),
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    estimatedMinutes: z.number(),
    completed: z.boolean(),
  })).optional(),
  metadata: z.record(z.any()).optional(),
});

export const scheduleDataSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  blocks: z.array(timeBlockSchema),
  timePeriods: z.object({
    morning: z.array(timeBlockSchema),
    afternoon: z.array(timeBlockSchema),
    evening: z.array(timeBlockSchema),
  }),
  stats: z.object({
    totalBlocks: z.number(),
    totalHours: z.number(),
    focusHours: z.number(),
    meetingHours: z.number(),
    breakHours: z.number(),
    utilization: z.number().min(0).max(100),
  }),
  conflicts: z.array(z.object({
    blocks: z.array(z.string()), // block IDs
    type: z.enum(['overlap', 'back-to-back', 'insufficient-break']),
    severity: z.enum(['high', 'medium', 'low']),
  })).optional(),
});
```

### 4. Enhanced Chat Route

```typescript
// apps/web/app/api/chat/route.ts
import { streamText, Output } from 'ai';
import { 
  universalToolResponseSchema, 
  conversationResponseSchema, 
  mixedResponseSchema 
} from '@/modules/ai/schemas';

const enhancedSystemPrompt = `${systemPrompt}

RESPONSE STRUCTURE RULES:

1. CONVERSATION vs DATA:
   - Use 'conversation' type for explanations, confirmations, questions
   - Use 'data' type for ALL tool results (schedules, tasks, emails, etc.)
   - Use 'mixed' type when combining explanation with data

2. STRUCTURED DATA REQUIREMENTS:
   - Every tool call MUST return structured data
   - Include all required fields in the schema
   - Use consistent time formats (h:mm AM/PM)
   - Provide helpful UI hints and suggestions

3. STREAMING GUIDELINES:
   - Set streaming.supported = true for long operations
   - Update streaming.progress during multi-step operations
   - Provide streaming.stage updates

4. ERROR HANDLING:
   - Always include error details in structured format
   - Provide recoverable flag and suggested actions
   - Never show raw error messages to users`;

export async function POST(req: Request) {
  // ... existing setup ...

  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
    tools,
    maxSteps: 5,
    system: enhancedSystemPrompt,
    temperature: 0.7,
    
    // Enable structured output
    experimental_output: Output.object({
      schema: z.discriminatedUnion('type', [
        conversationResponseSchema,
        z.object({
          type: z.literal('data'),
          responses: z.array(universalToolResponseSchema),
        }),
        mixedResponseSchema,
      ]),
    }),
    
    onStepFinish: async ({ toolCalls, toolResults, experimental_output }) => {
      // Validate structured output
      if (experimental_output?.type === 'data') {
        for (const response of experimental_output.responses) {
          try {
            universalToolResponseSchema.parse(response);
          } catch (error) {
            console.error('[Chat API] Invalid structured response:', error);
          }
        }
      }
    },
  });
  
  return result.toDataStreamResponse();
}
```

### 5. Tool Implementation Pattern

Example of updating a tool to use structured output:

```typescript
// apps/web/modules/ai/tools/schedule/createTimeBlock.ts
import { tool } from 'ai';
import { z } from 'zod';
import { universalToolResponseSchema, scheduleDataSchema } from '@/modules/ai/schemas';

export const createTimeBlock = tool({
  description: 'Create a new time block in the schedule',
  parameters: z.object({
    type: z.enum(['work', 'email', 'break', 'meeting', 'blocked']),
    title: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    date: z.string().optional(),
    description: z.string().optional(),
  }),
  
  // Return structured data instead of custom format
  execute: async (params) => {
    try {
      const block = await scheduleService.createTimeBlock(params);
      
      // Build structured response
      const response: z.infer<typeof universalToolResponseSchema> = {
        metadata: {
          toolName: 'createTimeBlock',
          operation: 'create',
          resourceType: 'schedule',
          timestamp: new Date().toISOString(),
          executionTime: Date.now() - startTime,
        },
        
        data: {
          date: params.date || format(new Date(), 'yyyy-MM-dd'),
          blocks: [formatTimeBlock(block)],
          timePeriods: groupBlocksByPeriod([block]),
          stats: calculateScheduleStats([block]),
        },
        
        display: {
          type: 'card',
          title: `Created ${params.type} block`,
          description: `${params.title} scheduled for ${formatTimeRange(params.startTime, params.endTime)}`,
          priority: 'high',
          components: [{
            type: 'scheduleBlock',
            data: formatTimeBlock(block),
          }],
        },
        
        ui: {
          notification: {
            show: true,
            type: 'success',
            message: 'Time block created successfully',
            duration: 3000,
          },
          suggestions: [
            'View full schedule',
            'Add tasks to this block',
            'Create another block',
          ],
          actions: [
            {
              id: 'view-schedule',
              label: 'View Schedule',
              icon: 'calendar',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'getSchedule',
                params: { date: params.date },
              },
            },
            {
              id: 'assign-tasks',
              label: 'Add Tasks',
              icon: 'plus',
              action: {
                type: 'message',
                message: `Show me tasks I can add to the ${params.title} block`,
              },
            },
          ],
        },
        
        streaming: {
          supported: false,
        },
      };
      
      return response;
      
    } catch (error) {
      return {
        metadata: {
          toolName: 'createTimeBlock',
          operation: 'create',
          resourceType: 'schedule',
          timestamp: new Date().toISOString(),
          executionTime: Date.now() - startTime,
        },
        
        data: null,
        
        display: {
          type: 'card',
          title: 'Failed to create time block',
          priority: 'high',
          components: [],
        },
        
        ui: {
          notification: {
            show: true,
            type: 'error',
            message: error.message,
            duration: 5000,
          },
          suggestions: ['Try again', 'Check schedule for conflicts'],
          actions: [],
        },
        
        error: {
          code: error.code || 'CREATE_BLOCK_FAILED',
          message: error.message,
          details: error,
          recoverable: true,
          suggestedActions: ['Check for time conflicts', 'Verify time format'],
        },
      };
    }
  },
});
```

### 6. UI Component Implementation

```typescript
// apps/web/modules/ai/components/StructuredMessage.tsx
import { universalToolResponseSchema } from '../schemas';
import { DataCard } from './DataCard';
import { ProgressStream } from './ProgressStream';

interface StructuredMessageProps {
  response: z.infer<typeof universalToolResponseSchema>;
  onAction?: (action: Action) => void;
}

export function StructuredMessage({ response, onAction }: StructuredMessageProps) {
  const { display, ui, streaming, error } = response;
  
  if (error) {
    return <ErrorDisplay error={error} />;
  }
  
  if (streaming?.supported && streaming.progress < 100) {
    return (
      <ProgressStream
        progress={streaming.progress}
        stage={streaming.stage}
        title={display.title}
      />
    );
  }
  
  return (
    <div className="structured-message">
      {/* Render based on display type */}
      {display.type === 'card' && (
        <DataCard
          title={display.title}
          description={display.description}
          priority={display.priority}
        >
          {display.components.map((component, idx) => (
            <ComponentRenderer key={idx} component={component} />
          ))}
        </DataCard>
      )}
      
      {/* Action buttons */}
      {ui.actions.length > 0 && (
        <ActionButtons
          actions={ui.actions}
          onAction={onAction}
        />
      )}
      
      {/* Suggestions */}
      {ui.suggestions.length > 0 && (
        <SuggestionChips
          suggestions={ui.suggestions}
          onSelect={(s) => onAction?.({ type: 'message', message: s })}
        />
      )}
    </div>
  );
}
```

### 7. Message Content Update

```typescript
// apps/web/modules/chat/components/MessageContent.tsx
import { StructuredMessage } from '@/modules/ai/components/StructuredMessage';
import { useStructuredStream } from '@/modules/ai/hooks/useStructuredStream';

export const MessageContent = memo(function MessageContent({
  content,
  role,
  structuredData,
  onAction,
  className,
}: MessageContentProps) {
  // Handle structured responses
  if (structuredData) {
    switch (structuredData.type) {
      case 'conversation':
        return (
          <ConversationDisplay
            content={structuredData.content}
            tone={structuredData.tone}
            formatting={structuredData.formatting}
          />
        );
        
      case 'data':
        return (
          <div className="space-y-4">
            {structuredData.responses.map((response, idx) => (
              <StructuredMessage
                key={idx}
                response={response}
                onAction={onAction}
              />
            ))}
          </div>
        );
        
      case 'mixed':
        return (
          <MixedDisplay
            conversation={structuredData.conversation}
            data={structuredData.data}
            layout={structuredData.layout}
            onAction={onAction}
          />
        );
    }
  }
  
  // Fallback to text display
  return <TextDisplay content={content} />;
});
```

## Implementation Timeline

### Day 1: Foundation
- [x] Create schema directory structure
- [x] Create universal.schema.ts
- [x] Create conversation.schema.ts
- [x] Create schedule.schema.ts
- [x] Create task.schema.ts
- [x] Create email.schema.ts
- [x] Create calendar.schema.ts
- [x] Create preference.schema.ts
- [x] Create workflow.schema.ts
- [x] Update chat route with structured output support
- [x] Create base UI components directory
- [x] Create StructuredMessage.tsx
- [x] Create DataCard.tsx
- [x] Create ProgressStream.tsx
- [x] Create ActionButtons.tsx
- [x] Create ErrorDisplay.tsx

### Day 1 Status: COMPLETE ✅

### Day 2: Schedule & Task Tools
Schedule Tools (9/9): ✅ COMPLETE
- [x] getSchedule.ts
- [x] createTimeBlock.ts
- [x] moveTimeBlock.ts
- [x] deleteTimeBlock.ts
- [x] findTimeBlock.ts
- [x] assignTaskToBlock.ts
- [x] completeTask.ts
- [x] getUnassignedTasks.ts
- [x] regenerateSchedule.ts

Task Tools (4/4): ✅ COMPLETE
- [x] createTask.ts
- [x] editTask.ts
- [x] deleteTask.ts
- [x] findTasks.ts

### Day 2 Status: COMPLETE ✅ (13/13 tools converted)

### Day 3: Email & Calendar Tools
Email Tools (4/4):
- [x] listEmails.ts
- [x] readEmailContent.ts
- [x] draftEmailResponse.ts
- [x] processEmailToTask.ts

Calendar Tools (3/3):
- [x] scheduleMeeting.ts
- [x] rescheduleMeeting.ts
- [x] handleMeetingConflict.ts

### Day 3 Status: COMPLETE ✅ (7/7 tools converted)

### Day 4: Remaining Tools & UI
Preference Tools (2/2): ✅ COMPLETE
- [x] getPreferences.ts
- [x] updatePreference.ts

Workflow Tools (1/1): ✅ COMPLETE
- [x] scheduleDay.ts

### Day 4 Status: COMPLETE ✅ (3/3 tools converted)

### Day 5: Cleanup & Testing
UI Integration: ✅ COMPLETE
- [x] Update MessageContent.tsx ✅
- [x] Update MessageList.tsx ✅
- [x] Update ChatPanel.tsx (no changes needed) ✅
- [x] Create hooks (useStructuredStream, useToolResponse) ✅
- [x] Create utils (validation, repair, fallback) ✅

Cleanup:
- [x] Remove ChatScheduleDisplay.tsx ✅ (already deleted)
- [x] Remove ChatScheduleBlock.tsx ✅ (already deleted)
- [x] Deprecate messageParser.ts ✅ (deleted - no backward compatibility needed)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation updates

### Overall Progress: 23/23 Tools Updated (100% Complete) 🎉 

## Success Criteria

### Technical Requirements
- [x] All 23 tools return structured data ✅
- [ ] Zero parsing errors in UI
- [x] Full TypeScript type safety ✅
- [ ] Streaming works for all applicable operations
- [x] Consistent error handling across all tools ✅ 