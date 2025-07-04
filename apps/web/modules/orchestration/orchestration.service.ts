/**
 * Orchestration Service
 * 
 * Intelligent routing system that classifies user intent and routes to appropriate handlers
 */

import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { 
  UserIntent, 
  OrchestrationContext, 
  IntentCacheEntry, 
  RejectionPattern 
} from './types';

/**
 * Intent classification schema for AI SDK generateObject
 */
const intentSchema = z.object({
  reasoning: z.string().describe('Explanation of why this classification was chosen'),
  category: z.enum(['workflow', 'tool', 'conversation']).describe('Primary intent category'),
  confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
  subcategory: z.string().optional().describe('More specific categorization'),
  complexity: z.enum(['simple', 'complex']).describe('Task complexity assessment'),
  workflow: z.string().optional().describe('Workflow name if category is workflow'),
  tools: z.array(z.string()).optional().describe('Tool names if category is tool'),
  params: z.record(z.any()).optional().describe('Parameters for the workflow or tool'),
  entities: z.object({
    dates: z.array(z.string()).optional().describe('Date references found'),
    times: z.array(z.string()).optional().describe('Time references found'),
    people: z.array(z.string()).optional().describe('People mentioned'),
    tasks: z.array(z.string()).optional().describe('Task references'),
    duration: z.number().nullable().optional().describe('Duration in minutes if mentioned'),
  }),
  suggestedHandler: z.object({
    type: z.enum(['workflow', 'tool', 'direct']).describe('Handler type'),
    name: z.string().optional().describe('Specific workflow or tool name'),
    params: z.record(z.any()).optional().describe('Suggested parameters'),
  }),
});

export class OrchestrationService {
  private cache: Map<string, IntentCacheEntry> = new Map();
  private readonly cacheMaxSize = 1000;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Classify user intent using AI with context awareness
   */
  async classifyIntent(
    message: string,
    context: OrchestrationContext
  ): Promise<UserIntent> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.getCacheKey(message, context);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('[Orchestration] Cache hit for intent classification');
      return cached;
    }
    
    try {
      // Check rejection patterns first (stub for future RAG integration)
      const rejectionPattern = await this.checkRejectionPatterns(message, context);
      if (rejectionPattern) {
        console.log('[Orchestration] Rejection pattern detected:', rejectionPattern.reason);
        return this.createRejectionIntent(rejectionPattern);
      }
      
      // Extract entities first for better classification
      const entities = this.extractEntities(message);
      
      // Build classification prompt with context
      const contextPrompt = this.buildContextPrompt(context);
      
      // Use AI SDK's generateObject for structured classification
      const { object: classification } = await generateObject({
        model: openai('gpt-4o'),
        schema: intentSchema,
        prompt: `Classify this user request and determine the best way to handle it.

User message: "${message}"

${contextPrompt}

Extracted entities: ${JSON.stringify(entities)}

Consider:
1. Is this a complex multi-step workflow (daily planning, email triage)?
2. Is this a simple tool operation (view schedule, create task)?
3. Is this just a conversation/question?

Workflow examples:
- "Plan my day" → workflow: "workflow_schedule"
- "What should I work on?" → workflow: "workflow_fillWorkBlock"
- "Fill my work block" → workflow: "workflow_fillWorkBlock"
- "Process my emails" → workflow: "workflow_fillEmailBlock"
- "Handle my emails" → workflow: "workflow_fillEmailBlock"

Tool examples (use the exact tool name):
- "Show my schedule" → tools: ["schedule_viewSchedule"]
- "Add a work block" → tools: ["schedule_createTimeBlock"]
- "Create a time block" → tools: ["schedule_createTimeBlock"]
- "Block time for deep work" → tools: ["schedule_createTimeBlock"]
- "Add a break at 3pm" → tools: ["schedule_createTimeBlock"]
- "Move my work block to 2pm" → tools: ["schedule_moveTimeBlock"]
- "Delete the meeting block" → tools: ["schedule_deleteTimeBlock"]
- "Fill my work block with tasks" → tools: ["schedule_fillWorkBlock"]
- "Create a meeting at 2pm" → tools: ["calendar_scheduleMeeting"]
- "Schedule a call with John" → tools: ["calendar_scheduleMeeting"]
- "Mark task as done" → tools: ["task_completeTask"]
- "Show my tasks" → tools: ["task_viewTasks"]
- "Read email from John" → tools: ["email_readEmail"]

Important distinctions:
- Time blocks (work, break, email, blocked time) → use schedule_createTimeBlock
- Meetings with attendees → use calendar_scheduleMeeting

Provide high confidence (>0.8) when the intent is clear.`,
        system: `You are an expert at understanding user intent in a productivity assistant context.
        
Classify requests accurately considering:
- Time of day and user's typical patterns
- Current schedule state (empty, busy, gaps)
- Task and email backlog pressure
- Past user behavior and preferences

When classifying as 'tool', provide the full tool name with prefix (e.g., "schedule_viewSchedule", not just "viewSchedule").
Be specific with workflow/tool names when confidence is high.`,
        temperature: 0.3, // Lower temperature for more consistent classification
      });
      
      // Convert to UserIntent format
      const intent: UserIntent = {
        category: classification.category,
        confidence: classification.confidence,
        subcategory: classification.subcategory,
        entities: {
          ...entities,
          ...(classification.entities || {}),
        },
        suggestedHandler: this.determineHandler(classification, context, message),
        reasoning: classification.reasoning,
      };
      
      // Cache the result
      this.addToCache(cacheKey, intent);
      
      // Log for debugging
      console.log('[Orchestration] Intent classified:', {
        category: intent.category,
        confidence: intent.confidence,
        handler: intent.suggestedHandler,
        time: Date.now() - startTime + 'ms',
      });
      
      return intent;
      
    } catch (error) {
      console.error('[Orchestration] Classification failed:', error);
      // Fallback to keyword-based classification
      const fallbackEntities = this.extractEntities(message);
      return this.keywordFallback(message, fallbackEntities);
    }
  }
  
  /**
   * Build context prompt for AI classification
   */
  private buildContextPrompt(context: OrchestrationContext): string {
    const parts = [];
    
    // Time context
    const hour = context.currentTime.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    parts.push(`Current time: ${context.currentTime.toLocaleString()} (${timeOfDay})`);
    parts.push(`Timezone: ${context.timezone}`);
    
    // Viewing context
    if (context.viewingContext) {
      if (!context.viewingContext.isViewingToday) {
        parts.push(`User is viewing schedule for: ${context.viewingContext.scheduleDateStr}`);
      }
    }
    
    // Schedule state
    if (context.scheduleState.hasBlocksToday) {
      parts.push(`Schedule: ${context.scheduleState.utilization}% utilized today`);
      if (context.scheduleState.nextBlock) {
        const nextBlockTime = new Date(context.scheduleState.nextBlock.start_time);
        parts.push(`Next block: "${context.scheduleState.nextBlock.title}" at ${nextBlockTime.toLocaleTimeString()}`);
      }
    } else {
      parts.push('Schedule: Empty (no blocks scheduled today)');
    }
    
    // Task state
    parts.push(`Tasks: ${context.taskState.pendingCount} pending`);
    if (context.taskState.urgentCount > 0) {
      parts.push(`  - ${context.taskState.urgentCount} urgent tasks need attention`);
    }
    if (context.taskState.overdueCount > 0) {
      parts.push(`  - ${context.taskState.overdueCount} overdue tasks`);
    }
    
    // Email state
    if (context.emailState.unreadCount > 0) {
      parts.push(`Emails: ${context.emailState.unreadCount} unread`);
      if (context.emailState.urgentCount > 0) {
        parts.push(`  - ${context.emailState.urgentCount} marked as urgent`);
      }
    }
    
    // User patterns (when available from RAG)
    if (context.userPatterns) {
      if (context.userPatterns.typicalStartTime) {
        parts.push(`User typically starts work at ${context.userPatterns.typicalStartTime}`);
      }
      if (context.userPatterns.commonRequests?.length) {
        parts.push(`Common requests: ${context.userPatterns.commonRequests.slice(0, 3).join(', ')}`);
      }
    }
    
    return parts.join('\n');
  }
  
  /**
   * Extract entities from message using regex patterns
   */
  private extractEntities(message: string): UserIntent['entities'] {
    const entities: UserIntent['entities'] = {};
    
    // Extract dates
    const datePattern = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/gi;
    const dates = message.match(datePattern);
    if (dates) entities.dates = Array.from(new Set(dates.map(d => d.toLowerCase()))).filter((d): d is string => d !== undefined);
    
    // Extract times
    const timePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon|evening|night)\b/gi;
    const times = message.match(timePattern);
    if (times) entities.times = Array.from(new Set(times.map(t => t.toLowerCase()))).filter((t): t is string => t !== undefined);
    
    // Extract duration
    const durationPattern = /\b(\d+)\s*(?:hour|hr|minute|min)s?\b/i;
    const duration = message.match(durationPattern);
    if (duration) {
      const num = parseInt(duration[1] || '0');
      const durationStr = duration[0] || '';
      const isHours = durationStr.toLowerCase().includes('hour') || durationStr.toLowerCase().includes('hr');
      entities.duration = isHours ? num * 60 : num;
    }
    
    // Extract people (basic pattern for names)
    const peoplePattern = /\b(?:with|from|to|cc)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
    let peopleMatch;
    const people: string[] = [];
    while ((peopleMatch = peoplePattern.exec(message)) !== null) {
      if (peopleMatch[1]) {
        people.push(peopleMatch[1]);
      }
    }
    if (people.length > 0) {
      entities.people = people;
    }
    
    return entities;
  }
  
  /**
   * Check for rejection patterns (stub for future RAG integration)
   */
  private async checkRejectionPatterns(
    message: string,
    context: OrchestrationContext
  ): Promise<RejectionPattern | null> {
    // TODO: Integrate with RAG context provider in sprint 4.4
    // For now, just check user patterns if available
    if (context.userPatterns?.rejectedActions) {
      const messageLower = message.toLowerCase();
      for (const rejection of context.userPatterns.rejectedActions) {
        if (messageLower.includes(rejection.action.toLowerCase())) {
          return {
            id: `rejection-${Date.now()}`,
            pattern: rejection.action,
            reason: rejection.reason,
            count: 1,
            lastOccurrence: rejection.timestamp,
            similarIntents: [],
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Create intent for rejected patterns
   */
  private createRejectionIntent(pattern: RejectionPattern): UserIntent {
    return {
      category: 'conversation',
      confidence: 0.9,
      entities: {},
      suggestedHandler: { type: 'direct' },
      reasoning: `Similar request was previously rejected: ${pattern.reason}`,
    };
  }
  
  /**
   * Fallback classification using keywords
   */
  private keywordFallback(message: string, entities: UserIntent['entities']): UserIntent {
    const lower = message.toLowerCase();
    
    // Check for approval patterns first
    if (lower.includes('approve') && (lower.includes('schedule') || lower.includes('proposal'))) {
      // Extract date if mentioned
      const dateMatch = message.match(/\d{4}-\d{2}-\d{2}/);
      return {
        category: 'workflow',
        confidence: 0.8,
        suggestedHandler: { 
          type: 'workflow', 
          name: 'workflow_schedule',
          params: { 
            isApproval: true,
            date: dateMatch ? dateMatch[0] : undefined
          }
        },
        entities,
        reasoning: 'User is approving a schedule proposal',
      };
    }
    
    // Workflow keywords
    const workflowKeywords = {
      workflow_schedule: ['plan', 'organize', 'schedule my day', 'optimize my day', 'plan my day'],
      workflow_fillWorkBlock: ['what should i work on', 'fill work block', 'assign tasks', 'task recommendations'],
      workflow_fillEmailBlock: ['process emails', 'triage emails', 'handle emails', 'email backlog'],
    };
    
    for (const [workflow, keywords] of Object.entries(workflowKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        const params: Record<string, any> = {};
        
        // For schedule workflow, check if we should use viewing date
        if (workflow === 'workflow_schedule') {
          // This is a fallback, so we don't have full context
          // But we can still check for explicit date mentions
          const hasExplicitDate = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i.test(message);
          if (!hasExplicitDate) {
            // In fallback mode, we can't access viewing context
            // The date will need to be determined by the workflow itself
            params.useViewingDate = true;
          }
        }
        
        return {
          category: 'workflow',
          confidence: 0.7,
          suggestedHandler: { type: 'workflow', name: workflow, params },
          entities,
          reasoning: `Keyword match for ${workflow} workflow`,
        };
      }
    }
    
    // Tool keywords - ORDER MATTERS! More specific patterns first
    const toolKeywords = {
      deleteTimeBlock: ['delete block', 'remove block', 'cancel block', 'delete the', 'remove the', 'cancel the'],
      moveTimeBlock: ['move block', 'reschedule block', 'change block time', 'move the', 'reschedule the'],
      fillWorkBlock: ['fill work block', 'assign tasks to block', 'populate block'],
      createTimeBlock: ['create block', 'add block', 'add a break', 'block for', 'schedule block', 'new block'],
      viewSchedule: ['show schedule', 'view schedule', 'my schedule', 'see schedule', 'what\'s on my schedule'],
      createTask: ['create task', 'add task', 'new task'],
      viewTasks: ['show tasks', 'list tasks', 'my tasks'],
      viewEmails: ['show emails', 'list emails', 'my emails'],
      scheduleMeeting: ['schedule meeting', 'create meeting', 'book meeting', 'meeting with'],
      rescheduleMeeting: ['reschedule meeting', 'move meeting', 'change meeting time'],
    };
    
    for (const [tool, keywords] of Object.entries(toolKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return {
          category: 'tool',
          confidence: 0.7,
          suggestedHandler: { type: 'tool', name: tool },
          entities,
          reasoning: `Keyword match for ${tool} tool`,
        };
      }
    }
    
    // Default to conversation
    return {
      category: 'conversation',
      confidence: 0.5,
      suggestedHandler: { type: 'direct' },
      entities,
      reasoning: 'No clear keyword match - defaulting to conversation',
    };
  }
  
  /**
   * Generate cache key from message and context
   */
  private getCacheKey(message: string, context: OrchestrationContext): string {
    // Include relevant context in cache key
    const hour = context.currentTime.getHours();
    const hasSchedule = context.scheduleState.hasBlocksToday;
    const taskPressure = context.taskState.urgentCount > 0;
    const emailPressure = context.emailState.urgentCount > 0;
    
    return `${message.toLowerCase().trim()}_${hour}_${hasSchedule}_${taskPressure}_${emailPressure}`;
  }
  
  /**
   * Get intent from cache if valid
   */
  private getFromCache(key: string): UserIntent | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.intent;
  }
  
  /**
   * Add intent to cache with LRU eviction
   */
  private addToCache(key: string, intent: UserIntent): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      intent,
      timestamp: Date.now(),
      contextHash: key,
    });
  }
  
  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      ttl: this.cacheTTL,
    };
  }
  
  private determineHandler(
    classification: any,
    context: OrchestrationContext,
    message: string
  ): UserIntent['suggestedHandler'] {
    // Handle explicit tool names from classification
    if (classification.suggestedHandler?.name) {
      const handler = classification.suggestedHandler;
      
      // For schedule-related operations, ensure we pass the viewing date
      if (handler.name && (handler.name.includes('schedule') || handler.name.includes('workflow_schedule'))) {
        const params = handler.params || {};
        
        // If user is viewing a different date and didn't specify a date, use the viewing date
        if (context.viewingContext && !context.viewingContext.isViewingToday) {
          // Check if the message contains explicit date references
          const hasExplicitDate = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i.test(message);
          
          if (!hasExplicitDate && !params.date) {
            params.date = context.viewingContext.scheduleDateStr;
            console.log('[Orchestrator] Using viewing date for schedule operation:', params.date);
          }
        }
        
        return {
          ...handler,
          params,
        };
      }
      
      return handler;
    }
    
    // Handle workflow routing based on classification
    if (classification.category === 'workflow' && classification.suggestedHandler?.name) {
      const workflowName = classification.suggestedHandler.name;
      const params = classification.suggestedHandler.params || {};
      
      // Add viewing date if needed
      if (!params.date && context.viewingContext && !context.viewingContext.isViewingToday) {
        const hasExplicitDate = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i.test(message);
        
        if (!hasExplicitDate) {
          params.date = context.viewingContext.scheduleDateStr;
          console.log('[Orchestrator] Using viewing date for workflow:', params.date);
        }
      }
      
      // Special handling for fillWorkBlock workflow
      if (workflowName === 'workflow_fillWorkBlock') {
        console.log('[Orchestrator] Processing fillWorkBlock with message:', message);
        
        // Check if message contains block context pattern (including multi-line)
        const fullMessage = message; // This includes the block context if it was prepended
        const blockPatterns = [
          /Work on "(.+)" from (\d+:\d+) to (\d+:\d+)/i,
          /Meeting "(.+)" from (\d+:\d+) to (\d+:\d+)/i,
          /Email block "(.+)" from (\d+:\d+) to (\d+:\d+)/i,
          /Break "(.+)" from (\d+:\d+) to (\d+:\d+)/i,
          /Blocked time "(.+)" from (\d+:\d+) to (\d+:\d+)/i,
        ];
        
        let blockMatch = null;
        for (const pattern of blockPatterns) {
          blockMatch = fullMessage.match(pattern);
          if (blockMatch) break;
        }
        
        console.log('[Orchestrator] Block match result:', blockMatch);
        
        if (blockMatch) {
          const matchedTitle = blockMatch[1];
          const matchedStartTime = blockMatch[2];
          const matchedEndTime = blockMatch[3];
          
          if (!matchedTitle || !matchedStartTime || !matchedEndTime) {
            console.log('[Orchestrator] Invalid block match format');
          } else {
            console.log('[Orchestrator] Detected block context:', { 
              blockTitle: matchedTitle, 
              startTime: matchedStartTime, 
              endTime: matchedEndTime 
            });
            
            // Find the block in the viewing date's schedule
            const scheduleBlocks = context.viewingContext?.viewDateSchedule || [];
            const matchingBlock = scheduleBlocks.find((block: any) => {
              // Match by title and time
              const blockStartTime = new Date(block.startTime || block.start_time);
              const blockEndTime = new Date(block.endTime || block.end_time);
              
              const blockStartStr = `${blockStartTime.getHours().toString().padStart(2, '0')}:${blockStartTime.getMinutes().toString().padStart(2, '0')}`;
              const blockEndStr = `${blockEndTime.getHours().toString().padStart(2, '0')}:${blockEndTime.getMinutes().toString().padStart(2, '0')}`;
              
              return block.title === matchedTitle && 
                     blockStartStr === matchedStartTime && 
                     blockEndStr === matchedEndTime;
            });
            
            if (matchingBlock) {
              console.log('[Orchestrator] Found matching block:', matchingBlock.id);
              params.blockId = matchingBlock.id;
              // Also pass the date so the workflow knows which schedule to look at
              params.date = context.viewingContext?.scheduleDateStr || new Date().toISOString().split('T')[0];
            } else {
              console.log('[Orchestrator] No matching block found for context');
              // Still pass what we know so the workflow can provide a better error
              if (matchedStartTime && matchedStartTime.includes(':')) {
                const hour = parseInt(matchedStartTime.split(':')[0] as string);
                params.blockTime = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
              }
              params.date = context.viewingContext?.scheduleDateStr || new Date().toISOString().split('T')[0];
            }
          }
        } else {
          // Check for time references in the message (e.g., "9 am work block")
          const timeMatch = message.match(/(\d{1,2})\s*(?::\d{2})?\s*(?:am|pm|AM|PM)?\s*(?:work\s*block|block)/i);
          if (timeMatch && timeMatch[1]) {
            const timeRef = timeMatch[1];
            const isPM = message.toLowerCase().includes('pm');
            const isAM = message.toLowerCase().includes('am');
            
            let targetHour = parseInt(timeRef);
            if (isPM && targetHour < 12) targetHour += 12;
            if (isAM && targetHour === 12) targetHour = 0;
            
            console.log('[Orchestrator] Detected time reference for work block:', { timeRef, targetHour });
            
            // Find a work block at this time
            const scheduleBlocks = context.viewingContext?.viewDateSchedule || [];
            const matchingBlock = scheduleBlocks.find((block: any) => {
              if (block.type !== 'work') return false;
              
              const blockTime = new Date(block.startTime || block.start_time);
              const blockHour = blockTime.getHours();
              
              return blockHour === targetHour;
            });
            
            if (matchingBlock) {
              console.log('[Orchestrator] Found work block at time:', matchingBlock.id);
              params.blockId = matchingBlock.id;
              params.date = context.viewingContext?.scheduleDateStr || new Date().toISOString().split('T')[0];
            } else {
              console.log('[Orchestrator] No work block found at time:', targetHour);
              // Pass the time reference so the workflow can provide a better error
              params.blockTime = targetHour < 12 ? 'morning' : targetHour < 17 ? 'afternoon' : 'evening';
              params.date = context.viewingContext?.scheduleDateStr || new Date().toISOString().split('T')[0];
            }
          } else if (message.toLowerCase().includes('this block') || message.toLowerCase().includes('in this block')) {
            console.log('[Orchestrator] User asking about "this block" but no context found');
            // The AI will need to ask for clarification
          }
        }
      }
      
      // Special handling for fillEmailBlock workflow
      if (workflowName === 'workflow_fillEmailBlock') {
        // Check if message contains block context pattern for email blocks
        const emailBlockMatch = message.match(/Email block "(.+)" from (\d+:\d+) to (\d+:\d+)/i);
        
        if (emailBlockMatch) {
          const [_, blockTitle, startTime, endTime] = emailBlockMatch;
          console.log('[Orchestrator] Detected email block context:', { blockTitle, startTime, endTime });
          
          // Find the block in the viewing date's schedule
          const scheduleBlocks = context.viewingContext?.viewDateSchedule || [];
          const matchingBlock = scheduleBlocks.find((block: any) => {
            // Match by title and time
            const blockStartTime = new Date(block.startTime || block.start_time);
            const blockEndTime = new Date(block.endTime || block.end_time);
            
            const blockStartStr = `${blockStartTime.getHours().toString().padStart(2, '0')}:${blockStartTime.getMinutes().toString().padStart(2, '0')}`;
            const blockEndStr = `${blockEndTime.getHours().toString().padStart(2, '0')}:${blockEndTime.getMinutes().toString().padStart(2, '0')}`;
            
            return block.title === blockTitle && 
                   blockStartStr === startTime && 
                   blockEndStr === endTime &&
                   block.type === 'email';
          });
          
          if (matchingBlock) {
            console.log('[Orchestrator] Found matching email block:', matchingBlock.id);
            params.blockId = matchingBlock.id;
            // Also pass the date so the workflow knows which schedule to look at
            params.date = context.viewingContext?.scheduleDateStr || new Date().toISOString().split('T')[0];
          } else {
            console.log('[Orchestrator] No matching email block found for context');
          }
        } else {
          // Extract time reference from the message
          const timeMatch = message.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?|\d{1,2}:\d{2})/i);
          if (timeMatch) {
            const timeRef = timeMatch[0];
            console.log('[Orchestrator] Detected time reference in message:', timeRef);
            
            // Find the block that matches this time
            const scheduleBlocks = context.viewingContext?.viewDateSchedule || [];
            const matchingBlock = scheduleBlocks.find((block: any) => {
              if (block.type !== 'email') return false;
              
              // Parse the block's start time
              const blockTime = new Date(block.startTime || block.start_time);
              const blockHour = blockTime.getHours();
              const blockMinute = blockTime.getMinutes();
              
              // Parse the user's time reference
              const normalizedTime = timeRef.toLowerCase().replace(/\s+/g, '');
              let targetHour: number;
              let targetMinute = 0;
              
              if (normalizedTime.includes(':')) {
                const parts = normalizedTime.split(':');
                const h = parts[0];
                const m = parts[1];
                if (h && m) {
                  targetHour = parseInt(h);
                  const minutePart = m.replace(/[apm]/g, '');
                  targetMinute = parseInt(minutePart) || 0;
                } else {
                  return false;
                }
              } else {
                targetHour = parseInt(normalizedTime.replace(/[apm]/g, ''));
              }
              
              // Adjust for PM
              if (normalizedTime.includes('pm') && targetHour < 12) {
                targetHour += 12;
              } else if (normalizedTime.includes('am') && targetHour === 12) {
                targetHour = 0;
              }
              
              // If no AM/PM specified and hour is <= 6, assume PM for work hours
              if (!normalizedTime.includes('am') && !normalizedTime.includes('pm') && targetHour <= 6) {
                targetHour += 12;
              }
              
              // Check if times match
              return blockHour === targetHour && blockMinute === targetMinute;
            });
            
            if (matchingBlock) {
              console.log('[Orchestrator] Found matching email block:', matchingBlock.id);
              params.blockId = matchingBlock.id;
              // Also pass the date
              params.date = context.viewingContext?.scheduleDateStr || new Date().toISOString().split('T')[0];
            } else {
              console.log('[Orchestrator] No email block found for time:', timeRef);
              // Still pass the time reference so the workflow can provide a better error
              params.blockId = timeRef;
              params.date = context.viewingContext?.scheduleDateStr || new Date().toISOString().split('T')[0];
            }
          }
        }
      }
      
      return {
        type: 'workflow',
        name: workflowName,
        params,
      };
    }
    
    if (classification.category === 'tool' && classification.tools?.length > 0) {
      // Map tool names to full registered names
      const toolMap: Record<string, string> = {
        'viewSchedule': 'schedule_viewSchedule',
        'createTimeBlock': 'schedule_createTimeBlock',
        'moveTimeBlock': 'schedule_moveTimeBlock',
        'deleteTimeBlock': 'schedule_deleteTimeBlock',
        'fillWorkBlock': 'schedule_fillWorkBlock',
        'viewTasks': 'task_viewTasks',
        'createTask': 'task_createTask',
        'updateTask': 'task_updateTask',
        'completeTask': 'task_completeTask',
        'viewEmails': 'email_viewEmails',
        'readEmail': 'email_readEmail',
        'processEmail': 'email_processEmail',
        'scheduleMeeting': 'calendar_scheduleMeeting',
        'rescheduleMeeting': 'calendar_rescheduleMeeting',
        'updatePreferences': 'preference_updatePreferences',
        'confirmProposal': 'system_confirmProposal',
        'showWorkflowHistory': 'system_showWorkflowHistory',
        'resumeWorkflow': 'system_resumeWorkflow',
        'provideFeedback': 'system_provideFeedback',
        'showPatterns': 'system_showPatterns',
        'clearContext': 'system_clearContext',
      };
      
      const toolName = classification.tools[0];
      const mappedName = toolMap[toolName] || toolName;
      const params = classification.params || {};
      
      // For schedule tools, add viewing date if needed
      if (mappedName.includes('schedule_') && context.viewingContext && !context.viewingContext.isViewingToday) {
        const hasExplicitDate = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i.test(message);
        
        if (!hasExplicitDate && !params.date) {
          params.date = context.viewingContext.scheduleDateStr;
          console.log('[Orchestrator] Using viewing date for schedule tool:', params.date);
        }
      }
      
      return {
        type: 'tool',
        name: mappedName,
        params,
      };
    }
    
    // Default to direct conversation
    return {
      type: 'direct',
    };
  }
}