# Sprint 03.03: Email Triage & Task Workflows

## Sprint Overview

**Sprint Number**: 03.03  
**Epic**: Epic 3 - AI-First Chat & Intelligent Workflows  
**Duration**: 2 days  
**Status**: NOT STARTED

### Sprint Goal
Build intelligent email triage workflows that analyze emails by importance and urgency, batch them efficiently, and maintain a smart backlog system. This sprint transforms how users handle email - from overwhelming inbox to organized, actionable time blocks.

### Context for Executor
In Sprint 03.01, we built tools for basic CRUD operations. In Sprint 03.02, we created the adaptive scheduling workflow. Now we're adding email intelligence. The system should:
- Fetch both new emails and backlog emails from previous days
- Analyze each email on two dimensions: importance (important/not important/archive) and urgency (urgent/can wait/no response)
- Batch similar emails together for efficient processing
- Create appropriate time blocks in the schedule
- Maintain a backlog for non-urgent emails

Think of this as building an intelligent email assistant that knows which emails matter, which can wait, and which should be archived.

## Prerequisites from Previous Sprints

Before starting, verify:
- [ ] Email backlog database tables exist (from Sprint 03.01)
- [ ] Basic email tools are working
- [ ] Adaptive scheduling workflow is functional (Sprint 03.02)
- [ ] LangGraph is properly configured

## Key Concepts

### Two-Dimensional Email Analysis
Instead of complex categories, we use two simple dimensions:

**Importance**:
- `important`: Requires thoughtful response or action
- `not_important`: Quick acknowledgment or FYI
- `archive`: No action needed, auto-archive

**Urgency**:
- `urgent`: Needs response today
- `can_wait`: Can be handled tomorrow or later
- `no_response`: No response needed

### Email Batching Strategy
- **Important + Urgent** → Schedule dedicated time block today
- **Important + Can Wait** → Tomorrow's priority list
- **Not Important + Urgent** → Quick batch processing today
- **Archive** → Auto-archive, no time needed

## Key Deliverables

### 1. Create Email Triage Workflow

**File**: `apps/web/modules/workflows/graphs/emailTriage.ts`

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

interface EmailTriageState {
  userId: string;
  emails: Email[];
  backlogEmails: EmailBacklog[];
  analyzedEmails: AnalyzedEmail[];
  emailBatches: EmailBatch[];
  proposedScheduleBlocks: ScheduleBlock[];
  filter?: "urgent" | "important" | "all";
  messages: BaseMessage[];
}

interface AnalyzedEmail {
  emailId: string;
  subject: string;
  from: string;
  snippet: string;
  importance: "important" | "not_important" | "archive";
  urgency: "urgent" | "can_wait" | "no_response";
  suggestedAction: string;
  estimatedResponseTime: number; // minutes
}

interface EmailBatch {
  type: "important_urgent" | "quick_replies" | "thoughtful_responses";
  emails: AnalyzedEmail[];
  totalTime: number;
  suggestedTimeSlot?: string;
}

export function createEmailTriageWorkflow() {
  const workflow = new StateGraph<EmailTriageState>({
    channels: {
      userId: null,
      emails: [],
      backlogEmails: [],
      analyzedEmails: [],
      emailBatches: [],
      proposedScheduleBlocks: [],
      filter: null,
      messages: [],
    },
  });

  // Define nodes
  workflow.addNode("fetchEmails", fetchEmailsNode);
  workflow.addNode("fetchBacklog", fetchBacklogNode);
  workflow.addNode("mergeAndPrioritize", mergeAndPrioritizeNode);
  workflow.addNode("analyzeEmails", analyzeEmailsNode);
  workflow.addNode("detectUrgency", detectUrgencyNode);
  workflow.addNode("batchEmails", batchEmailsNode);
  workflow.addNode("generateSchedule", generateScheduleNode);
  workflow.addNode("updateBacklog", updateBacklogNode);
  workflow.addNode("generateSummary", generateSummaryNode);

  // Define flow
  workflow.addEdge("fetchEmails", "fetchBacklog");
  workflow.addEdge("fetchBacklog", "mergeAndPrioritize");
  workflow.addEdge("mergeAndPrioritize", "analyzeEmails");
  workflow.addEdge("analyzeEmails", "detectUrgency");
  workflow.addEdge("detectUrgency", "batchEmails");
  workflow.addEdge("batchEmails", "generateSchedule");
  workflow.addEdge("generateSchedule", "updateBacklog");
  workflow.addEdge("updateBacklog", "generateSummary");
  workflow.addEdge("generateSummary", END);

  workflow.setEntryPoint("fetchEmails");

  return workflow.compile();
}
```

### 2. Implement Email Analysis Nodes

#### Fetch Emails Node
```typescript
async function fetchEmailsNode(state: EmailTriageState): Promise<Partial<EmailTriageState>> {
  // Fetch unread emails from Gmail
  const gmailService = new GmailService(state.userId);
  const unreadEmails = await gmailService.getUnreadEmails({
    maxResults: 50, // Limit for performance
    // Exclude automated emails
    query: "-from:noreply -from:no-reply -from:donotreply",
  });

  return {
    emails: unreadEmails.map(email => ({
      id: email.id,
      threadId: email.threadId,
      subject: email.subject,
      from: email.from,
      to: email.to,
      snippet: email.snippet,
      date: email.date,
      labels: email.labels,
      hasAttachments: email.hasAttachments,
    })),
  };
}
```

#### Fetch Backlog Node
```typescript
async function fetchBacklogNode(state: EmailTriageState): Promise<Partial<EmailTriageState>> {
  // Get emails marked as "later" from previous days
  const backlog = await db
    .from('email_backlog')
    .select('*')
    .eq('user_id', state.userId)
    .in('urgency', ['can_wait', 'no_response'])
    .order('days_in_backlog', { ascending: false })
    .limit(20); // Don't overwhelm with old emails

  // Update days in backlog
  const today = new Date();
  const updatedBacklog = backlog.data?.map(email => ({
    ...email,
    daysInBacklog: Math.floor(
      (today.getTime() - new Date(email.created_at).getTime()) / (1000 * 60 * 60 * 24)
    ),
  })) || [];

  return {
    backlogEmails: updatedBacklog,
  };
}
```

#### Analyze Emails Node
```typescript
async function analyzeEmailsNode(state: EmailTriageState): Promise<Partial<EmailTriageState>> {
  const model = new ChatOpenAI({ 
    temperature: 0,
    modelName: "gpt-4-turbo",
  });

  // Combine new and backlog emails
  const allEmails = [
    ...state.emails,
    ...state.backlogEmails.map(be => ({
      id: be.email_id,
      subject: be.subject,
      from: be.from_email,
      snippet: be.snippet,
      daysOld: be.days_in_backlog,
    })),
  ];

  const analyzedEmails: AnalyzedEmail[] = [];

  // Batch analyze for efficiency
  const batchSize = 10;
  for (let i = 0; i < allEmails.length; i += batchSize) {
    const batch = allEmails.slice(i, i + batchSize);
    
    const prompt = `Analyze these emails and categorize each by importance and urgency.

Importance:
- important: Requires thoughtful response, from key people, or about important topics
- not_important: FYI, newsletters, automated updates, quick acknowledgments
- archive: Spam, marketing, no action needed

For each email, return: importance, suggested action, estimated response time in minutes.

Emails to analyze:
${batch.map((e, idx) => `
${idx + 1}. From: ${e.from}
Subject: ${e.subject}
Preview: ${e.snippet}
${e.daysOld ? `Days old: ${e.daysOld}` : ''}
`).join('\n')}`;

    const response = await model.invoke([new HumanMessage(prompt)]);
    const parsed = parseEmailAnalysis(response.content);
    
    parsed.forEach((analysis, idx) => {
      analyzedEmails.push({
        emailId: batch[idx].id,
        subject: batch[idx].subject,
        from: batch[idx].from,
        snippet: batch[idx].snippet,
        importance: analysis.importance,
        urgency: "pending", // Will be set in next node
        suggestedAction: analysis.action,
        estimatedResponseTime: analysis.responseTime,
      });
    });
  }

  return { analyzedEmails };
}
```

#### Detect Urgency Node
```typescript
async function detectUrgencyNode(state: EmailTriageState): Promise<Partial<EmailTriageState>> {
  const urgencyKeywords = {
    urgent: [
      "urgent", "asap", "immediately", "today", "eod", "end of day",
      "deadline", "expires", "time sensitive", "action required",
      "please respond", "waiting for", "blocker", "blocking"
    ],
    meeting: [
      "meeting", "calendar", "invite", "schedule", "call",
      "zoom", "teams", "1:1", "sync", "catch up"
    ],
  };

  const updatedEmails = state.analyzedEmails.map(email => {
    let urgency: "urgent" | "can_wait" | "no_response" = "can_wait";

    // Check for urgent keywords
    const lowerSubject = email.subject.toLowerCase();
    const lowerSnippet = email.snippet.toLowerCase();
    const combinedText = `${lowerSubject} ${lowerSnippet}`;

    // Check urgent keywords
    const hasUrgentKeyword = urgencyKeywords.urgent.some(keyword => 
      combinedText.includes(keyword)
    );

    // Check for meeting invites (usually urgent)
    const isMeetingRelated = urgencyKeywords.meeting.some(keyword => 
      combinedText.includes(keyword)
    );

    // Check sender importance (could be enhanced with a VIP list)
    const isFromManager = email.from.toLowerCase().includes("manager") ||
                         email.from.toLowerCase().includes("boss");

    // Determine urgency
    if (email.importance === "archive") {
      urgency = "no_response";
    } else if (hasUrgentKeyword || isMeetingRelated || isFromManager) {
      urgency = "urgent";
    } else if (email.importance === "not_important") {
      urgency = email.estimatedResponseTime <= 5 ? "urgent" : "can_wait";
    }

    // Emails in backlog > 3 days might need attention
    const daysOld = state.backlogEmails.find(be => be.email_id === email.emailId)?.days_in_backlog || 0;
    if (daysOld > 3 && email.importance === "important") {
      urgency = "urgent";
    }

    return { ...email, urgency };
  });

  return { analyzedEmails: updatedEmails };
}
```

#### Batch Emails Node
```typescript
async function batchEmailsNode(state: EmailTriageState): Promise<Partial<EmailTriageState>> {
  const batches: EmailBatch[] = [];
  
  // Group emails by category
  const importantUrgent = state.analyzedEmails.filter(
    e => e.importance === "important" && e.urgency === "urgent"
  );
  
  const quickReplies = state.analyzedEmails.filter(
    e => e.importance === "not_important" && e.urgency === "urgent"
  );
  
  const thoughtfulResponses = state.analyzedEmails.filter(
    e => e.importance === "important" && e.urgency === "can_wait"
  );

  // Create batches with time estimates
  if (importantUrgent.length > 0) {
    batches.push({
      type: "important_urgent",
      emails: importantUrgent,
      totalTime: importantUrgent.reduce((sum, e) => sum + e.estimatedResponseTime, 0),
      suggestedTimeSlot: "morning", // Prioritize for morning
    });
  }

  if (quickReplies.length > 0) {
    batches.push({
      type: "quick_replies",
      emails: quickReplies,
      totalTime: Math.min(30, quickReplies.length * 3), // Cap at 30 minutes
      suggestedTimeSlot: "before_lunch",
    });
  }

  if (thoughtfulResponses.length > 0 && state.filter !== "urgent") {
    // Only include if not filtering for urgent only
    batches.push({
      type: "thoughtful_responses",
      emails: thoughtfulResponses.slice(0, 5), // Limit to 5 per day
      totalTime: thoughtfulResponses.slice(0, 5).reduce((sum, e) => sum + e.estimatedResponseTime, 0),
      suggestedTimeSlot: "afternoon",
    });
  }

  // Apply filter if specified
  const filteredBatches = state.filter 
    ? batches.filter(batch => {
        if (state.filter === "urgent") {
          return batch.type !== "thoughtful_responses";
        }
        if (state.filter === "important") {
          return batch.type !== "quick_replies";
        }
        return true;
      })
    : batches;

  return { emailBatches: filteredBatches };
}
```

#### Generate Schedule Node
```typescript
async function generateScheduleNode(state: EmailTriageState): Promise<Partial<EmailTriageState>> {
  const proposedBlocks: ScheduleBlock[] = [];
  const currentTime = new Date();
  const currentHour = currentTime.getHours();

  for (const batch of state.emailBatches) {
    let startTime: string;
    let title: string;

    // Determine time slot based on batch type and current time
    switch (batch.type) {
      case "important_urgent":
        // Schedule ASAP
        if (currentHour < 10) {
          startTime = "10:00"; // After morning routine
        } else if (currentHour < 14) {
          startTime = "14:00"; // After lunch
        } else {
          startTime = "16:00"; // Late afternoon
        }
        title = "Urgent Emails";
        break;

      case "quick_replies":
        // Batch before lunch or end of day
        if (currentHour < 11) {
          startTime = "11:30";
        } else {
          startTime = "16:30";
        }
        title = "Quick Email Replies";
        break;

      case "thoughtful_responses":
        // Afternoon when energy is good
        startTime = "14:30";
        title = "Email Deep Work";
        break;
    }

    const duration = Math.ceil(batch.totalTime / 15) * 15; // Round to 15-min increments
    const endTime = addMinutes(parseTime(startTime), duration);

    proposedBlocks.push({
      type: "email",
      title,
      startTime,
      endTime: formatTime(endTime),
      description: `Process ${batch.emails.length} ${batch.type.replace('_', ' ')} emails`,
      metadata: {
        emailIds: batch.emails.map(e => e.emailId),
        batchType: batch.type,
      },
    });
  }

  return { proposedScheduleBlocks: proposedBlocks };
}
```

#### Update Backlog Node
```typescript
async function updateBacklogNode(state: EmailTriageState): Promise<Partial<EmailTriageState>> {
  const updates = [];
  const processedEmailIds = new Set(
    state.proposedScheduleBlocks.flatMap(block => 
      block.metadata?.emailIds || []
    )
  );

  // Update or create backlog entries for unprocessed emails
  for (const email of state.analyzedEmails) {
    if (!processedEmailIds.has(email.emailId) && 
        email.importance !== "archive" &&
        email.urgency === "can_wait") {
      
      // Check if already in backlog
      const existingBacklog = state.backlogEmails.find(
        be => be.email_id === email.emailId
      );

      if (existingBacklog) {
        // Update existing
        updates.push(
          db.from('email_backlog')
            .update({
              days_in_backlog: existingBacklog.days_in_backlog + 1,
              last_reviewed_at: new Date(),
            })
            .eq('id', existingBacklog.id)
        );
      } else {
        // Create new backlog entry
        updates.push(
          db.from('email_backlog')
            .insert({
              user_id: state.userId,
              email_id: email.emailId,
              subject: email.subject,
              from_email: email.from,
              importance: email.importance,
              urgency: email.urgency,
              snippet: email.snippet,
              days_in_backlog: 0,
              last_reviewed_at: new Date(),
            })
        );
      }
    }
  }

  // Archive emails marked for archiving
  const archiveEmails = state.analyzedEmails.filter(
    e => e.importance === "archive"
  );
  
  if (archiveEmails.length > 0) {
    const gmailService = new GmailService(state.userId);
    await gmailService.batchArchive(
      archiveEmails.map(e => e.emailId)
    );
  }

  // Execute all updates
  await Promise.all(updates);

  return {
    messages: [
      ...state.messages,
      new AIMessage(`Updated backlog with ${updates.length} emails`),
    ],
  };
}
```

### 3. Create Task Prioritization Workflow

**File**: `apps/web/modules/workflows/graphs/taskPrioritization.ts`

```typescript
export function createTaskPrioritizationWorkflow() {
  const workflow = new StateGraph<TaskPrioritizationState>({
    channels: {
      userId: null,
      availableTime: null,
      currentEnergy: null,
      taskBacklog: [],
      prioritizedTasks: [],
      recommendations: [],
    },
  });

  workflow.addNode("fetchBacklog", fetchTaskBacklogNode);
  workflow.addNode("analyzeContext", analyzeContextNode);
  workflow.addNode("scoreTasks", scoreTasksNode);
  workflow.addNode("matchToTime", matchToAvailableTimeNode);
  workflow.addNode("generateRecommendations", generateRecommendationsNode);

  // Linear flow for task prioritization
  workflow.addEdge("fetchBacklog", "analyzeContext");
  workflow.addEdge("analyzeContext", "scoreTasks");
  workflow.addEdge("scoreTasks", "matchToTime");
  workflow.addEdge("matchToTime", "generateRecommendations");
  workflow.addEdge("generateRecommendations", END);

  workflow.setEntryPoint("fetchBacklog");

  return workflow.compile();
}

async function scoreTasksNode(state: TaskPrioritizationState): Promise<Partial<TaskPrioritizationState>> {
  const currentTime = new Date();
  const isAfternoon = currentTime.getHours() >= 14;

  const scoredTasks = state.taskBacklog.map(task => {
    let score = task.priority; // Base score from priority (0-100)

    // Urgency boost
    score += task.urgency * 0.5;

    // Age boost (older tasks get slight boost)
    const daysOld = Math.floor(
      (currentTime.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    score += Math.min(daysOld * 2, 10); // Max 10 points for age

    // Energy matching
    if (state.currentEnergy === "high" && task.estimated_minutes > 60) {
      score += 10; // Boost hard tasks when energy is high
    } else if (state.currentEnergy === "low" && task.estimated_minutes <= 30) {
      score += 10; // Boost easy tasks when energy is low
    }

    // Time of day matching
    if (isAfternoon && task.tags?.includes("admin")) {
      score += 5; // Admin tasks better for afternoon
    } else if (!isAfternoon && task.tags?.includes("creative")) {
      score += 5; // Creative tasks better for morning
    }

    return { ...task, score };
  });

  // Sort by score descending
  const prioritizedTasks = scoredTasks.sort((a, b) => b.score - a.score);

  return { prioritizedTasks };
}
```

### 4. Integrate Workflows as AI Tools

**File**: `apps/web/modules/ai/tools/email-tools.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";
import { createEmailTriageWorkflow } from "@/modules/workflows/graphs/emailTriage";
import { createTaskPrioritizationWorkflow } from "@/modules/workflows/graphs/taskPrioritization";

export const triageEmails = tool({
  description: "Process and categorize emails by importance and urgency",
  parameters: z.object({
    includeBacklog: z.boolean().default(true).describe("Include emails from previous days"),
    filter: z.enum(["urgent", "important", "all"]).optional().describe("Filter emails by type"),
  }),
  execute: async ({ includeBacklog, filter }) => {
    const workflow = createEmailTriageWorkflow();
    
    const result = await workflow.invoke({
      userId: getCurrentUserId(),
      includeBacklog,
      filter,
      emails: [],
      backlogEmails: [],
      analyzedEmails: [],
      emailBatches: [],
      proposedScheduleBlocks: [],
      messages: [],
    });

    // Format summary for chat
    const summary = formatEmailTriageSummary(result);
    
    return {
      success: true,
      summary,
      stats: {
        totalEmails: result.analyzedEmails.length,
        urgent: result.analyzedEmails.filter(e => e.urgency === "urgent").length,
        important: result.analyzedEmails.filter(e => e.importance === "important").length,
        archived: result.analyzedEmails.filter(e => e.importance === "archive").length,
      },
      proposedBlocks: result.proposedScheduleBlocks,
    };
  },
});

export const suggestTasks = tool({
  description: "Get task recommendations based on available time and energy",
  parameters: z.object({
    timeAvailable: z.number().describe("Minutes available"),
    energy: z.enum(["high", "medium", "low"]).optional(),
  }),
  execute: async ({ timeAvailable, energy }) => {
    const workflow = createTaskPrioritizationWorkflow();
    
    const result = await workflow.invoke({
      userId: getCurrentUserId(),
      availableTime: timeAvailable,
      currentEnergy: energy || "medium",
      taskBacklog: [],
      prioritizedTasks: [],
      recommendations: [],
    });

    return {
      success: true,
      recommendations: result.recommendations,
      topTasks: result.prioritizedTasks.slice(0, 3),
    };
  },
});

// Helper function to format email summary
function formatEmailTriageSummary(result: EmailTriageResult): string {
  const parts = [];
  
  if (result.emailBatches.length === 0) {
    return "No emails need immediate attention. Your inbox is under control!";
  }

  parts.push(`I've analyzed ${result.analyzedEmails.length} emails:`);
  
  result.emailBatches.forEach(batch => {
    const timeStr = batch.totalTime < 60 
      ? `${batch.totalTime} minutes`
      : `${Math.round(batch.totalTime / 60)} hour${batch.totalTime >= 120 ? 's' : ''}`;
      
    switch (batch.type) {
      case "important_urgent":
        parts.push(`\n📨 ${batch.emails.length} urgent emails need attention (${timeStr})`);
        break;
      case "quick_replies":
        parts.push(`\n✉️ ${batch.emails.length} quick replies to batch (${timeStr})`);
        break;
      case "thoughtful_responses":
        parts.push(`\n📝 ${batch.emails.length} emails need thoughtful responses (${timeStr})`);
        break;
    }
  });

  if (result.proposedScheduleBlocks.length > 0) {
    parts.push("\n\nI can schedule email time:");
    result.proposedScheduleBlocks.forEach(block => {
      parts.push(`- ${block.title} at ${block.startTime}`);
    });
  }

  const archived = result.analyzedEmails.filter(e => e.importance === "archive").length;
  if (archived > 0) {
    parts.push(`\n\n🗄️ I'll archive ${archived} emails automatically.`);
  }

  return parts.join('\n');
}
```

### 5. Gmail Service Implementation

**File**: `apps/web/modules/email/services/gmail.service.ts`

```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class GmailService {
  private gmail;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    const auth = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    
    // Get user's tokens from database
    const tokens = await getUserTokens(userId);
    auth.setCredentials(tokens);
    
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  async getUnreadEmails(options: {
    maxResults?: number;
    query?: string;
  }) {
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: `is:unread ${options.query || ''}`,
      maxResults: options.maxResults || 50,
    });

    if (!response.data.messages) {
      return [];
    }

    // Fetch full message details
    const emails = await Promise.all(
      response.data.messages.map(async (message) => {
        const fullMessage = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
        });

        return this.parseEmail(fullMessage.data);
      })
    );

    return emails;
  }

  async batchArchive(emailIds: string[]) {
    // Remove UNREAD label and add ARCHIVED
    const batch = emailIds.map(id => ({
      method: 'POST',
      path: `/gmail/v1/users/me/messages/${id}/modify`,
      body: {
        removeLabelIds: ['UNREAD', 'INBOX'],
      },
    }));

    // Execute batch request
    await this.gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: emailIds,
        removeLabelIds: ['UNREAD', 'INBOX'],
      },
    });
  }

  private parseEmail(message: any) {
    const headers = message.payload.headers;
    const getHeader = (name: string) => 
      headers.find((h: any) => h.name === name)?.value || '';

    return {
      id: message.id,
      threadId: message.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: getHeader('Date'),
      snippet: message.snippet,
      labels: message.labelIds || [],
      hasAttachments: this.hasAttachments(message.payload),
    };
  }

  private hasAttachments(payload: any): boolean {
    if (payload.parts) {
      return payload.parts.some((part: any) => 
        part.filename && part.filename.length > 0
      );
    }
    return false;
  }
}
```

## Testing Guide

### Test Scenario 1: Mixed Email Batch
**Setup**: User has:
- 2 urgent work emails
- 5 newsletters
- 3 emails from boss
- 10 promotional emails

**Test Command**: "Process my emails"

**Expected Behavior**:
1. Fetches all unread emails
2. Analyzes and categorizes:
   - Boss emails → Important + Urgent
   - Work emails → Important + Urgent  
   - Newsletters → Not Important + Can Wait
   - Promotional → Archive
3. Creates batches:
   - Urgent batch: 5 emails (boss + work)
   - Archive: 10 promotional
4. Proposes schedule block: "Urgent Emails at 10:00 AM (45 minutes)"
5. Auto-archives promotional emails

### Test Scenario 2: Backlog Processing
**Setup**: User has 15 emails in backlog from last 3 days

**Test Command**: "Show me important emails"

**Expected Behavior**:
1. Fetches backlog emails
2. Filters for important only
3. Emails > 3 days old get urgency boost
4. Shows only important emails needing attention

### Test Scenario 3: Quick Reply Batch
**Setup**: User has many quick acknowledgment emails

**Test Command**: "Handle quick emails"

**Expected Behavior**:
1. Identifies all "Not Important + Urgent" emails
2. Batches them together (max 30 minutes)
3. Schedules before lunch or end of day
4. Shows: "15 quick replies batched for 11:30 AM"

### Test Scenario 4: Task Suggestions
**Setup**: User asks "What should I work on?" at 3 PM

**Test Command**: "What should I work on?"

**Expected Behavior**:
1. Detects afternoon time
2. Checks user energy (assumes medium)
3. Suggests admin/low-energy tasks
4. Returns top 3 tasks matching context

## Common Issues & Solutions

### Issue: Gmail API rate limits
**Solution**: Implement exponential backoff
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

### Issue: Email analysis takes too long
**Solution**: Process in smaller batches (10 emails at a time) and show progress

### Issue: Urgency detection too aggressive
**Solution**: Add sender allowlist/blocklist in user preferences

### Issue: Backlog grows too large
**Solution**: Auto-archive emails in backlog > 7 days with no interaction

## Integration Checklist

- [ ] Email triage workflow created and tested
- [ ] Task prioritization workflow implemented
- [ ] Gmail service connected with proper auth
- [ ] Two-dimensional analysis working correctly
- [ ] Batching logic groups emails efficiently
- [ ] Backlog table updates properly
- [ ] Auto-archive functionality works
- [ ] Natural language summaries are clear
- [ ] Schedule blocks are created appropriately
- [ ] Error handling for API failures

## Success Criteria

1. **Accurate Categorization**: 90%+ emails correctly categorized
2. **Efficient Batching**: Similar emails grouped together
3. **Smart Urgency Detection**: Real urgent emails identified
4. **Backlog Management**: Old emails don't get lost
5. **Time Estimates**: Email blocks have realistic durations
6. **Auto-Archive**: Junk emails removed automatically
7. **Natural Summaries**: User understands what will happen

## Next Sprint Preview

Sprint 03.04 will add the RAG system for learning:
- Store email patterns and user decisions
- Learn sender importance over time
- Improve categorization accuracy
- Remember user preferences
- Context-aware suggestions

---

**Remember**: This sprint makes email manageable. Users should feel relief when they see "5 urgent emails need 30 minutes" instead of an overwhelming inbox. The two-dimensional system (importance + urgency) keeps it simple while being effective. 