# Sprint 4.3 NEW: Multi-Step Domain Workflows with Atomic Tools

**Sprint Goal**: Refactor 3 workflows to use atomic tool composition for multi-step operations  
**Duration**: 3 days  
**Status**: PLANNING  
**Dependencies**: Existing tool patterns must be followed

## Architecture Overview

We're refactoring our three workflows to be true multi-step processes that compose atomic tools:
1. **Schedule Workflow** - Orchestrates multiple schedule tools to plan a day
2. **Task Workflow** - Composes task tools to fill work blocks intelligently  
3. **Email Workflow** - Coordinates email tools to triage and batch process

All atomic tools will be available to both workflows AND the orchestrator for direct use.

## Current Atomic Tools (21 Total)

### Schedule Tools (5)
1. `schedule_viewSchedule` - View schedule for a date with time blocks
2. `schedule_createTimeBlock` - Create a single time block
3. `schedule_moveTimeBlock` - Move an existing time block
4. `schedule_deleteTimeBlock` - Delete a time block
5. `schedule_fillWorkBlock` - Fill a work block with tasks (confusingly named - should be task tool)

### Task Tools (4)
1. `task_viewTasks` - View tasks with scoring and filters
2. `task_createTask` - Create a new task
3. `task_updateTask` - Update task properties
4. `task_completeTask` - Mark task as complete

### Email Tools (3)
1. `email_viewEmails` - List emails with metadata
2. `email_readEmail` - Read full email content
3. `email_processEmail` - Process email (archive/task/reply)

### Calendar Tools (2)
1. `calendar_scheduleMeeting` - Schedule meetings with attendees
2. `calendar_rescheduleMeeting` - Reschedule existing meetings

### Other Tools (7)
- `preference_updatePreferences` - Update user preferences
- `system_confirmProposal` - Confirm workflow proposals
- `system_showWorkflowHistory` - Display past executions
- `system_resumeWorkflow` - Resume paused workflows
- `system_provideFeedback` - Collect user feedback
- `system_showPatterns` - Display usage patterns
- `system_clearContext` - Reset conversation context

## New Atomic Tools Needed (12 Total)

### Schedule Analysis Tools (3)
1. **`schedule_findGaps`**
   ```typescript
   // Find available time slots in schedule
   parameters: {
     date: string;
     minDuration: number;  // minimum gap size in minutes
     between?: { start: string; end: string };  // time range
   }
   returns: {
     gaps: Array<{
       startTime: string;
       endTime: string;
       duration: number;
     }>;
   }
   ```

2. **`schedule_batchCreateBlocks`**
   ```typescript
   // Create multiple time blocks atomically
   parameters: {
     date: string;
     blocks: Array<{
       type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
       title: string;
       startTime: string;
       endTime: string;
     }>;
   }
   returns: {
     created: Array<TimeBlock>;
     conflicts: Array<{ block: any; reason: string }>;
   }
   ```

3. **`schedule_analyzeUtilization`**
   ```typescript
   // Analyze schedule efficiency and patterns
   parameters: {
     date: string;
   }
   returns: {
     utilization: number;  // percentage
     focusTime: number;    // total deep work minutes
     fragmentedTime: number;  // gaps < 30 min
     suggestions: string[];
   }
   ```

### Task Management Tools (3)
4. **`task_getBacklogWithScores`**
   ```typescript
   // Get task backlog with pre-calculated scores
   parameters: {
     minScore?: number;
     maxDuration?: number;
     includeCompleted?: boolean;
   }
   returns: {
     tasks: Array<{
       id: string;
       title: string;
       score: number;  // 0-100
       scoreBreakdown: {
         priority: number;
         age: number;
         urgency: number;
       };
       estimatedMinutes: number;
     }>;
   }
   ```

5. **`task_assignToTimeBlock`**
   ```typescript
   // Assign one or more tasks to a time block
   parameters: {
     taskIds: string[];
     blockId: string;
   }
   returns: {
     assigned: string[];
     failed: Array<{ taskId: string; reason: string }>;
   }
   ```

6. **`task_suggestForDuration`**
   ```typescript
   // Get tasks that fit in a specific duration
   parameters: {
     duration: number;  // available minutes
     strategy: 'priority' | 'quick_wins' | 'mixed';
   }
   returns: {
     suggestions: Array<{
       combination: Task[];
       totalMinutes: number;
       totalScore: number;
       reasoning: string;
     }>;
   }
   ```

### Email Management Tools (6)
7. **`email_getBacklog`**
   ```typescript
   // Get unread and backlog emails
   parameters: {
     status?: ('unread' | 'backlog')[];
     limit?: number;
   }
   returns: {
     emails: Array<{
       id: string;
       from: string;
       subject: string;
       receivedAt: Date;
       status: string;
       hasAttachments: boolean;
     }>;
     total: number;
   }
   ```

8. **`email_categorizeEmail`**
   ```typescript
   // Categorize a single email
   parameters: {
     emailId: string;
   }
   returns: {
     category: 'needs_reply' | 'important_info' | 'potential_task' | 'can_archive';
     confidence: number;
     suggestedAction: string;
   }
   ```

9. **`email_batchCategorize`**
   ```typescript
   // Categorize multiple emails efficiently
   parameters: {
     emailIds: string[];
   }
   returns: {
     categorized: Array<{
       emailId: string;
       category: string;
       urgencyScore: number;
     }>;
   }
   ```

10. **`email_groupBySender`**
    ```typescript
    // Group emails by sender for batch processing
    parameters: {
      emailIds: string[];
      minGroupSize?: number;
    }
    returns: {
      groups: Array<{
        sender: string;
        count: number;
        emailIds: string[];
      }>;
    }
    ```

11. **`email_archiveBatch`**
    ```typescript
    // Archive multiple emails
    parameters: {
      emailIds: string[];
      reason?: string;
    }
    returns: {
      archived: number;
      failed: string[];
    }
    ```

12. **`email_createTaskFromEmail`**
    ```typescript
    // Convert email to task with smart extraction
    parameters: {
      emailId: string;
      customTitle?: string;
    }
    returns: {
      task: {
        id: string;
        title: string;
        description: string;
        estimatedMinutes: number;
        source: 'email';
      };
    }
    ```

## Refactored Multi-Step Workflows

### Workflow Interaction Pattern

**CRITICAL**: All workflows follow a proposal-confirmation pattern:

1. **Analysis & Proposal Generation**: Workflow analyzes the situation and generates proposals
2. **User Review**: Proposals are presented to the user with clear explanations
3. **User Decision**: User can:
   - **Approve**: Execute the proposals as-is
   - **Modify**: Provide feedback to regenerate proposals
   - **Cancel**: Abort the workflow
4. **Execution**: Only after approval are changes made

This ensures users maintain control and can adjust proposals before any changes are committed.

### 1. Schedule Workflow (`workflow_schedule`)

**Purpose**: Multi-step process to create an optimal daily schedule with user confirmation

**Workflow Phases**:

**Phase 1: Analysis & Proposal Generation**
1. Call `schedule_viewSchedule` to get existing blocks
2. Call `schedule_findGaps` to identify available slots
3. Call `schedule_analyzeUtilization` for insights
4. Generate schedule proposals based on preferences and feedback
5. **Return proposals for user review** (no blocks created yet)

**Phase 2: User Confirmation**
- Present proposed schedule to user
- Show what will be created/changed
- Wait for user response

**Phase 3: Execution (only after approval)**
- Call `schedule_batchCreateBlocks` to create approved blocks
- Handle any conflicts
- Return final results

**Implementation Pattern**:
```typescript
export const schedule = tool({
  name: 'workflow_schedule',
  description: 'Multi-step schedule optimization workflow with user confirmation',
  parameters: scheduleParams,
  execute: async ({ date, preferences, feedback, confirmation }) => {
    const steps = [];
    
    // PHASE 1: ANALYSIS & PROPOSAL
    if (!confirmation) {
      // Step 1: Analyze current state
      const currentSchedule = await schedule_viewSchedule.execute({ date });
      const gaps = await schedule_findGaps.execute({ 
        date, 
        minDuration: 30,
        between: { start: preferences.workStart, end: preferences.workEnd }
      });
      const analysis = await schedule_analyzeUtilization.execute({ date });
      
      steps.push({ 
        phase: 'analysis', 
        data: { currentSchedule, gaps, analysis } 
      });
      
      // Step 2: Generate proposals
      const proposals = await generateScheduleProposals(
        steps[0].data,
        preferences,
        feedback
      );
      
      // Return proposals for user confirmation
      return {
        success: true,
        phase: 'proposal',
        requiresConfirmation: true,
        proposals: proposals.blocks,
        changes: proposals.changes,
        message: "Here's your proposed schedule. Would you like me to create these blocks?"
      };
    }
    
    // PHASE 2: EXECUTION (user confirmed)
    const createResult = await schedule_batchCreateBlocks.execute({
      date,
      blocks: confirmation.approvedBlocks
    });
    
    const finalAnalysis = await schedule_analyzeUtilization.execute({ date });
    
    return {
      success: true,
      phase: 'completed',
      date,
      blocks: createResult.created,
      summary: `Created ${createResult.created.length} time blocks`,
      utilization: finalAnalysis.utilization
    };
  }
});
```

### 2. Task Workflow (`workflow_fillWorkBlock`)

**Purpose**: Multi-step process to propose tasks for a work block with user confirmation

**Workflow Phases**:

**Phase 1: Analysis & Proposal Generation**
1. Get block context and duration
2. Call `task_getBacklogWithScores` for scored tasks
3. Call `task_suggestForDuration` for optimal combinations
4. **Return task proposals for user review** (no assignments yet)

**Phase 2: User Confirmation**
- Present proposed task assignments
- Show reasoning for each task
- Wait for user decision

**Phase 3: Execution (only after approval)**
- Call `task_assignToTimeBlock` to assign approved tasks
- Update task status
- Return results

**Implementation Pattern**:
```typescript
export const fillWorkBlock = tool({
  name: 'workflow_fillWorkBlock',
  execute: async ({ blockId, confirmation }) => {
    // PHASE 1: ANALYSIS & PROPOSAL
    if (!confirmation) {
      // Get block context
      const schedule = await schedule_viewSchedule.execute({ 
        date: new Date().toISOString().split('T')[0] 
      });
      const block = schedule.blocks.find(b => b.id === blockId);
      
      // Analyze backlog
      const scoredTasks = await task_getBacklogWithScores.execute({
        maxDuration: block.duration
      });
      
      const suggestions = await task_suggestForDuration.execute({
        duration: block.duration,
        strategy: block.startTime.getHours() < 12 ? 'priority' : 'mixed'
      });
      
      // Return proposals
      return {
        success: true,
        phase: 'proposal',
        requiresConfirmation: true,
        blockId,
        blockTitle: block.title,
        proposals: suggestions.suggestions[0],
        message: `I suggest these tasks for your ${block.title} (${block.duration} min). Shall I assign them?`
      };
    }
    
    // PHASE 2: EXECUTION
    const assignResult = await task_assignToTimeBlock.execute({
      taskIds: confirmation.approvedTaskIds,
      blockId
    });
    
    return {
      success: true,
      phase: 'completed',
      blockId,
      assigned: assignResult.assigned,
      summary: `Assigned ${assignResult.assigned.length} tasks to the block`
    };
  }
});
```

### 3. Email Workflow (`workflow_fillEmailBlock`)

**Purpose**: Multi-step process to propose email triage plan with user confirmation

**Workflow Phases**:

**Phase 1: Analysis & Proposal Generation**
1. Fetch email backlog
2. Categorize and score emails
3. Group by sender for efficiency
4. **Return triage proposals** (no actions taken yet)

**Phase 2: User Confirmation**
- Present email triage plan
- Show which emails to process, batch, or archive
- Wait for user approval

**Phase 3: Execution (only after approval)**
- Archive approved emails
- Mark others for processing
- Return results

**Implementation Pattern**:
```typescript
export const fillEmailBlock = tool({
  name: 'workflow_fillEmailBlock',
  execute: async ({ blockId, blockDuration, confirmation }) => {
    // PHASE 1: ANALYSIS & PROPOSAL
    if (!confirmation) {
      // Fetch and analyze
      const backlog = await email_getBacklog.execute({
        status: ['unread', 'backlog'],
        limit: 100
      });
      
      const categorized = await email_batchCategorize.execute({
        emailIds: backlog.emails.map(e => e.id)
      });
      
      const groups = await email_groupBySender.execute({
        emailIds: categorized.categorized
          .filter(e => e.category === 'needs_reply')
          .map(e => e.emailId),
        minGroupSize: 2
      });
      
      // Build proposals
      const proposals = {
        urgent: categorized.categorized
          .filter(e => e.urgencyScore > 80)
          .slice(0, 5),
        batched: groups.groups,
        toArchive: categorized.categorized
          .filter(e => e.category === 'can_archive')
          .map(e => e.emailId)
      };
      
      return {
        success: true,
        phase: 'proposal',
        requiresConfirmation: true,
        proposals,
        message: `I found ${proposals.urgent.length} urgent emails and can archive ${proposals.toArchive.length} others. Proceed?`
      };
    }
    
    // PHASE 2: EXECUTION
    const archiveResult = await email_archiveBatch.execute({
      emailIds: confirmation.approvedArchiveIds,
      reason: 'User-approved archive during triage'
    });
    
    return {
      success: true,
      phase: 'completed',
      blockId,
      processed: confirmation.approvedUrgentIds.length,
      archived: archiveResult.archived,
      summary: `Ready to process ${confirmation.approvedUrgentIds.length} emails, archived ${archiveResult.archived}`
    };
  }
});
```

## Confirmation Flow Tools

We also need these system tools to handle the confirmation flow:

1. **`system_presentProposal`** - Presents workflow proposals to user
2. **`system_awaitConfirmation`** - Waits for user decision
3. **`system_modifyProposal`** - Allows user to adjust proposals

The orchestrator will handle the confirmation flow:
1. Call workflow without confirmation → Get proposals
2. Present proposals to user
3. If approved: Call workflow again with confirmation
4. If modified: Call workflow with new feedback
5. If cancelled: End workflow

## Implementation Plan

### Phase 1: Create New Atomic Tools (Day 1)
- [ ] Implement all 12 new atomic tools
- [ ] Follow existing tool patterns exactly
- [ ] Add comprehensive tests for each tool
- [ ] Ensure all tools are registered and available

### Phase 2: Refactor Workflows (Day 2)
- [ ] Refactor schedule workflow to use atomic tools
- [ ] Refactor task workflow to use atomic tools
- [ ] Refactor email workflow to use atomic tools
- [ ] Remove all internal implementations from workflows

### Phase 3: Integration & Testing (Day 3)
- [ ] Test workflows with various scenarios
- [ ] Ensure orchestrator can call tools directly
- [ ] Update response types if needed
- [ ] Full linter and typecheck pass

## Key Principles

1. **Atomic Tools Are Universal**: Every tool should be useful standalone AND in workflows
2. **Workflows Compose, Not Implement**: Workflows only orchestrate tool calls
3. **Error Boundaries**: Each step in a workflow should handle errors gracefully
4. **Partial Success**: Workflows can return partial results if some steps fail
5. **Tool Naming**: Clear, action-oriented names (verb_noun pattern)

## Example Tool Implementation

```typescript
// New atomic tool example
export const findGaps = registerTool(
  createTool<typeof parameters, FindGapsResponse>({
    name: 'schedule_findGaps',
    description: 'Find available time slots in a schedule',
    parameters: z.object({
      date: z.string(),
      minDuration: z.number().min(15),
      between: z.object({
        start: z.string(),
        end: z.string()
      }).optional()
    }),
    metadata: {
      category: 'schedule',
      displayName: 'Find Schedule Gaps',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ date, minDuration, between }) => {
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const blocks = await scheduleService.getScheduleForDate(date);
      
      // Find gaps logic here
      const gaps = calculateGaps(blocks, minDuration, between);
      
      return {
        success: true,
        gaps,
        totalAvailableMinutes: gaps.reduce((sum, gap) => sum + gap.duration, 0)
      };
    }
  })
);
```

## Success Criteria

1. All 12 new atomic tools implemented and working
2. All 3 workflows refactored to use only atomic tools
3. No duplicate logic between tools and workflows
4. Orchestrator can call any tool directly
5. Workflows handle partial failures gracefully
6. Full test coverage and documentation

---

**Status**: PLANNING - Ready to implement
**Next Step**: Create the 12 new atomic tools following existing patterns 