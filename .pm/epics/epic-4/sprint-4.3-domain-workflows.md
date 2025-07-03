# Sprint 4.3: Domain Workflows

**Sprint Goal**: Implement 4 powerful LangGraph workflows that orchestrate tools  
**Duration**: 5 days  
**Status**: PLANNING

## Objectives

1. Enhance existing Adaptive Scheduling workflow
2. Implement Email Management workflow
3. Implement Task Intelligence workflow
4. Implement Calendar Optimization workflow
5. Add streaming progress to all workflows

## Day 1-2: Adaptive Scheduling Enhancement

### Current State
- Basic implementation exists but commented out
- Needs email/task integration
- Missing progress streaming

### Enhancements
```typescript
// Key improvements:
- Fetch email backlog in initial state
- Create email blocks for urgent emails  
- Fill work blocks with scored tasks
- Stream progress through workflow stages
- Better conflict handling for 4 overlapping blocks
- Energy-aware task matching (morning = complex, afternoon = simple)
- Pull from task/email backlogs intelligently
```

### Implementation with AI SDK Tools

```typescript
// apps/web/modules/workflows/graphs/adaptiveScheduling.ts
import { StateGraph } from '@langchain/langgraph';
import { streamText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { toolRegistry } from '@/modules/ai/tools/registry';

// Workflow nodes use AI SDK tools internally
const analyzeScheduleNode = async (state: WorkflowState) => {
  // Use AI SDK to analyze current state
  const { object: analysis } = await generateObject({
    model: openai('gpt-4o'),
    schema: z.object({
      gaps: z.array(z.object({
        start: z.string(),
        end: z.string(),
        duration: z.number(),
        quality: z.enum(['prime', 'good', 'poor'])
      })),
      inefficiencies: z.array(z.string()),
      suggestions: z.array(z.string()),
    }),
    prompt: `Analyze this schedule for optimization opportunities:
    ${JSON.stringify(state.currentSchedule)}
    
    Consider:
    - Gaps that could be filled productively
    - Fragmented time that could be consolidated
    - Energy patterns (morning for deep work, afternoon for meetings)
    - Break protection requirements`,
  });
  
  return { analysis };
};

const fillGapsNode = async (state: WorkflowState) => {
  // Use AI SDK tools to fill gaps
  const tools = toolRegistry.getByCategory('schedule');
  
  for (const gap of state.analysis.gaps) {
    if (gap.quality === 'prime' && gap.duration >= 60) {
      // Use fillWorkBlock tool via AI SDK
      const result = await tools.fillWorkBlock.execute({
        startTime: gap.start,
        endTime: gap.end,
        strategy: 'high-priority-tasks'
      });
      
      state.proposedChanges.push({
        type: 'create',
        block: result.block,
        tasks: result.tasks
      });
    }
  }
  
  return { proposedChanges: state.proposedChanges };
};
```

### Sophisticated Behaviors to Implement
1. **Morning vs Afternoon Intelligence**
   - Morning: Assign complex, creative tasks requiring deep focus
   - Afternoon: Assign routine tasks, emails, meetings
   - Evening: Quick wins and administrative tasks

2. **Backlog Integration**
   - Automatically pull high-scoring tasks from backlog
   - Create email blocks when backlog has 5+ urgent emails
   - Balance new items with backlog clearance

3. **Break Protection**
   - Never schedule over lunch (configurable time)
   - Ensure 5-min breaks between back-to-back blocks
   - Protect existing break blocks

## Day 3: Email Management Workflow

### Implementation
```typescript
// Workflow stages:
1. fetchEmails - Get new + backlog
2. analyzeEmails - AI scoring for importance/urgency
3. detectPatterns - Sender patterns from RAG
4. batchEmails - Group by strategy
5. createEmailBlocks - Schedule processing time
6. updateBacklog - Track aging
```

### Sophisticated Features
- **2D Analysis**: Importance × Urgency matrix
- **Smart Batching**: 
  - CEO/urgent → Immediate block
  - Important/not urgent → Tomorrow's list
  - Not important/urgent → Quick batch today
  - Not important/not urgent → Archive
- **Pattern Detection**: Learn sender importance over time

## Day 4: Task Intelligence Workflow

### Implementation
```typescript
// Workflow stages:
1. fetchTasks - All pending + backlog
2. scoreTasks - Multi-factor scoring
3. analyzeCapacity - Available time/energy
4. matchTasksToTime - Optimal assignments
5. suggestCombinations - Task batching
6. generateRecommendations - Top tasks with reasons
```

### Sophisticated Scoring
```typescript
score = (priority * 0.6) + (urgency * 0.4) + ageBonus
// Age bonus: min(daysInBacklog * 5, 20)
// Energy matching: +15 points for alignment
// Context batching: +10 points for similar tasks
```

## Day 5: Calendar Optimization & Integration

### Calendar Optimization
```typescript
// Workflow stages:
1. fetchCalendarData - Meetings for date range
2. detectConflicts - Find overlaps/issues
3. analyzeEfficiency - Pattern detection
4. generateResolutions - Conflict solutions
5. optimizeMeetings - Consolidation opportunities
6. protectFocusTime - Block calendar
```

### Sophisticated Behaviors
- **Meeting Consolidation**: Same attendees, similar topics
- **Travel Time**: Auto-detect location changes
- **Energy Optimization**: No deep work after 4 back-to-back meetings
- **Focus Protection**: Block calendar for scheduled focus time

### Integration Testing
- Test all workflows end-to-end
- Verify streaming updates
- Check orchestration routing

## Key Patterns

### Streaming Progress
```typescript
// Every node updates progress
return {
  ...state,
  streaming: {
    progress: 30,
    stage: 'analyzing_emails',
    message: 'Found 15 urgent emails'
  }
};
```

### RAG Integration
```typescript
// Each workflow gets context
const ragContext = await ragProvider.getRelevantContext(
  `${workflowType} for ${date}`,
  userId
);
```

## Success Criteria

- [ ] All 4 workflows implemented
- [ ] Progress streaming working
- [ ] RAG context integrated
- [ ] Error handling robust
- [ ] Performance under 5s

## Next Sprint
Sprint 4.4: RAG & Learning 