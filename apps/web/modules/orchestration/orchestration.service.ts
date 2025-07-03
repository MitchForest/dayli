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
  entities: z.object({
    dates: z.array(z.string()).optional().describe('Date references found'),
    times: z.array(z.string()).optional().describe('Time references found'),
    people: z.array(z.string()).optional().describe('People mentioned'),
    tasks: z.array(z.string()).optional().describe('Task references'),
    duration: z.number().optional().describe('Duration in minutes if mentioned'),
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
- "Plan my day" → optimizeSchedule workflow
- "Process my emails" → triageEmails workflow
- "What should I work on?" → prioritizeTasks workflow
- "Fix my calendar" → optimizeCalendar workflow

Tool examples:
- "Show my schedule" → viewSchedule tool
- "Create a meeting at 2pm" → scheduleMeeting tool
- "Mark task as done" → completeTask tool

Provide high confidence (>0.8) when the intent is clear.`,
        system: `You are an expert at understanding user intent in a productivity assistant context.
        
Classify requests accurately considering:
- Time of day and user's typical patterns
- Current schedule state (empty, busy, gaps)
- Task and email backlog pressure
- Past user behavior and preferences

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
        suggestedHandler: {
          type: classification.suggestedHandler.type || 'direct',
          name: classification.suggestedHandler.name,
          params: classification.suggestedHandler.params,
        },
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
    
    // Workflow keywords
    const workflowKeywords = {
      optimizeSchedule: ['plan', 'organize', 'schedule my day', 'optimize my day'],
      triageEmails: ['process emails', 'triage emails', 'handle emails', 'email backlog'],
      prioritizeTasks: ['what should i work on', 'prioritize', 'task recommendations'],
      optimizeCalendar: ['fix calendar', 'optimize calendar', 'reschedule meetings'],
    };
    
    for (const [workflow, keywords] of Object.entries(workflowKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return {
          category: 'workflow',
          confidence: 0.7,
          suggestedHandler: { type: 'workflow', name: workflow },
          entities,
          reasoning: `Keyword match for ${workflow} workflow`,
        };
      }
    }
    
    // Tool keywords
    const toolKeywords = {
      viewSchedule: ['show schedule', 'view schedule', 'my schedule', 'calendar'],
      createTimeBlock: ['block time', 'create block', 'add block'],
      createTask: ['create task', 'add task', 'new task'],
      viewTasks: ['show tasks', 'list tasks', 'my tasks'],
      viewEmails: ['show emails', 'list emails', 'my emails'],
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
}