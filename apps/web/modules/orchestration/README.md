# Orchestration Layer

## Overview

The orchestration layer intelligently routes user requests to the appropriate handler:
- **Workflows**: Complex, multi-step operations (e.g., daily planning, email triage)
- **Tools**: Specific, atomic operations (e.g., view schedule, create task)
- **Direct**: Conversational responses without tool execution

## Architecture

```
User Message
    ↓
Context Building (parallel data fetching)
    ↓
Intent Classification (AI-powered with caching)
    ↓
Routing Decision
    ↓
┌─────────┴─────────┬─────────────┐
Workflow         Tool          Direct
(LangGraph)   (AI SDK)    (Conversation)
```

## How It Works

### 1. Context Building
Aggregates current user state in parallel:
- Schedule state (blocks, gaps, utilization)
- Task state (pending, urgent, overdue counts)
- Email state (unread, urgent counts)
- User patterns (work hours, preferences, rejection history)

Performance target: <100ms

### 2. Intent Classification
Uses GPT-4 to understand requests with:
- Entity extraction (dates, times, people, tasks, duration)
- Confidence scoring (0-1)
- Reasoning explanation
- Cache for common requests (5-minute TTL)

Performance target: 200-300ms (cached: <10ms)

### 3. Smart Routing
Routes based on classification:
- **High confidence (>0.8)**: Execute immediately
- **Medium confidence (0.5-0.8)**: Execute with explanation
- **Low confidence (<0.5)**: Ask for clarification
- **Rejected patterns**: Return conversation response

## Intent Examples

### Workflow Intents
```
"Plan my day" → optimizeSchedule
"Help me be productive" → optimizeSchedule (context-aware)
"Process my emails" → triageEmails
"What should I work on?" → prioritizeTasks
"Fix my calendar" → optimizeCalendar
```

### Tool Intents
```
"Show my schedule" → viewSchedule
"Create a meeting at 2pm" → scheduleMeeting
"Mark task as done" → completeTask
"Read email from John" → readEmail
"Block 2 hours for deep work" → createTimeBlock
```

### Conversation Intents
```
"How does this work?"
"What can you help me with?"
"Tell me about task scoring"
"Why did you suggest that?"
```

## Context Awareness

The orchestrator considers:

### Time of Day
- **Morning (before 10am)**: Suggests planning workflows
- **Late morning (10am-12pm)**: Focuses on deep work
- **Afternoon (12pm-5pm)**: Checks progress, suggests emails
- **Evening (after 5pm)**: Wrapping up, planning tomorrow

### Schedule State
- **Empty**: Suggests comprehensive planning
- **Partially scheduled**: Offers gap filling
- **Fully scheduled**: Proposes optimization
- **Overbooked**: Recommends deferrals

### Backlog Pressure
- **Many urgent emails**: Routes to email triage
- **Overdue tasks**: Suggests task prioritization
- **Everything clear**: Focuses on planning ahead

## Configuration

### Environment Variables
```env
OPENAI_API_KEY=your-key-here
```

### Tuning Parameters
```typescript
// Confidence thresholds
const HIGH_CONFIDENCE = 0.8;    // Execute immediately
const LOW_CONFIDENCE = 0.5;     // Ask for clarification

// Cache settings
const CACHE_TTL = 5 * 60 * 1000;      // 5 minutes
const CACHE_MAX_SIZE = 1000;          // entries

// Context weights (future enhancement)
const TIME_WEIGHT = 0.3;
const SCHEDULE_WEIGHT = 0.3;
const BACKLOG_WEIGHT = 0.4;
```

## API Usage

### In Chat Route
```typescript
import { OrchestrationService } from '@/modules/orchestration/orchestration.service';
import { buildOrchestrationContext } from '@/modules/orchestration/context-builder';

const orchestrator = new OrchestrationService();

// Build context
const context = await buildOrchestrationContext(userId);

// Classify intent
const intent = await orchestrator.classifyIntent(
  message,
  context
);

// Route based on intent
switch (intent.suggestedHandler.type) {
  case 'workflow':
    return handleWorkflowRequest(messages, intent);
  case 'tool':
    return handleToolRequest(messages, intent);
  case 'direct':
    return handleDirectResponse(messages, intent);
}
```

### Testing Classification
```typescript
const testContext: OrchestrationContext = {
  userId: 'test-user',
  currentTime: new Date(),
  timezone: 'America/New_York',
  // ... other context
};

const intent = await orchestrator.classifyIntent(
  'help me plan my day',
  testContext
);

console.log({
  category: intent.category,        // 'workflow'
  handler: intent.suggestedHandler,  // { type: 'workflow', name: 'optimizeSchedule' }
  confidence: intent.confidence,     // 0.92
  reasoning: intent.reasoning        // 'User wants daily planning...'
});
```

## Adding New Intents

1. **Update Classification Prompt**
   Add examples to the prompt in `OrchestrationService.classifyIntent()`

2. **Add Keyword Patterns**
   Update `keywordFallback()` for offline/fallback support

3. **Add Tests**
   Create test cases in `__tests__/orchestration.service.test.ts`

4. **Document**
   Add examples to this README

## Performance

### Current Metrics
- Context building: ~80ms average
- Intent classification: 250ms average (uncached)
- Cache hit rate: ~60% for common requests
- Total orchestration: <300ms (target met)

### Optimization Tips
1. **Pre-warm cache** with common requests on startup
2. **Batch context fetches** - always use Promise.all()
3. **Skip unused services** - e.g., email service if not implemented
4. **Reduce prompt size** for faster classification

## Debugging

### Enable Detailed Logging
```typescript
// In chat route
console.log('[Orchestration] Intent classified:', {
  category: intent.category,
  confidence: intent.confidence,
  handler: intent.suggestedHandler,
  reasoning: intent.reasoning,
  entities: intent.entities,
  cached: cached
});
```

### Common Issues

**Low Confidence Classifications**
- Check if examples are in the prompt
- Verify entity extraction is working
- Consider adding to keyword fallback

**Slow Performance**
- Check cache hit rate
- Verify parallel context fetching
- Consider reducing context data

**Wrong Classifications**
- Add negative examples to prompt
- Adjust confidence thresholds
- Check for ambiguous keywords

## Future Enhancements

### Sprint 4.4 - RAG Integration
- Load user patterns from RAG context
- Check rejection history before routing
- Learn from user feedback
- Personalized classification

### Sprint 4.5 - UI Enhancement
- Show confidence in UI
- Display reasoning on hover
- Allow manual route override
- Visual intent indicators

### Sprint 4.6 - Advanced Features
- Multi-turn intent tracking
- Contextual intent chaining
- Proactive suggestions
- Intent analytics

## Related Documentation
- [AI Tools Architecture](../ai/ARCHITECTURE.md)
- [Service Factory](../../services/factory/README.md)
- [Universal Tool Response](../ai/schemas/README.md)