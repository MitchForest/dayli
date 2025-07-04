import { generateObject, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { format } from 'date-fns';
import { z } from 'zod';
import { CompleteContext } from '../types/complete-context';
import { CompleteUnderstanding, completeUnderstandingSchema } from '../types/complete-understanding';
import { 
  buildComprehensivePrompt,
  getWorkflowSystemPrompt,
  getToolSystemPrompt,
  getConversationSystemPrompt
} from './prompt-builder';
import { ServiceFactory } from '@/services/factory/service.factory';
import { toolRegistry } from '../tools/registry';
import { useSimpleScheduleStore } from '@/modules/schedule/store/simpleScheduleStore';
import type { Message } from 'ai';
import { getExecutionEngine, type TrackedOperation } from './execution-engine';

// Cache entry type
interface IntentCacheEntry {
  understanding: CompleteUnderstanding;
  timestamp: number;
  contextHash: string;
}

/**
 * AI Orchestrator - The single brain that understands all natural language
 * 
 * This service consolidates ALL AI logic from:
 * - orchestration.service.ts (intent classification, entity extraction)
 * - context-builder.ts (context aggregation, state calculation)
 * - chat route (routing, system prompts)
 * 
 * Making this the ONLY place where natural language understanding happens.
 */
export class AIOrchestrator {
  private model = openai('gpt-4o');
  private cache: Map<string, IntentCacheEntry> = new Map();
  private readonly cacheMaxSize = 1000;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Initialize the orchestrator and ensure tools are registered
   */
  async initialize(): Promise<void> {
    // Ensure tools are registered
    if (toolRegistry.listTools().length === 0) {
      console.log('[AI Orchestrator] Registering tools...');
      await toolRegistry.autoRegister();
      console.log('[AI Orchestrator] Registered tools:', toolRegistry.listTools());
    }
  }
  
  /**
   * Process a message end-to-end: context → understanding → execution
   * This is the MAIN entry point that the chat route should call
   */
  async processMessage(
    messages: Message[],
    userId: string,
    viewingDate?: string
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 1. Build complete context (absorbing context-builder.ts)
      const context = await this.buildCompleteContext(userId, messages, viewingDate);
      
      // 2. Get the last user message
      const lastMessage = messages[messages.length - 1]?.content;
      if (!lastMessage) {
        throw new Error('No message to process');
      }
      
      // 3. Check for active proposals in recent messages
      const hasActiveProposal = this.checkForActiveProposal(messages);
      
      // 4. Understand the message (absorbing orchestration.service.ts)
      let understanding = await this.understand(lastMessage, context);
      
      // 5. Handle approval routing if needed
      if (hasActiveProposal && lastMessage.toLowerCase().includes('approve')) {
        understanding = this.routeToApproval(understanding, messages, viewingDate);
      }
      
      // 6. Always use streaming for chat interface
      return await this.execute(understanding, context, messages);
      
    } catch (error) {
      console.error('[AI Orchestrator] Error processing message:', error);
      throw error;
    } finally {
      console.log('[AI Orchestrator] Total processing time:', Date.now() - startTime + 'ms');
    }
  }
  
  /**
   * Understand user intent and resolve all natural language to concrete parameters
   * (Enhanced version that includes logic from orchestration.service.ts)
   */
  async understand(
    message: string,
    context: CompleteContext
  ): Promise<CompleteUnderstanding> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.getCacheKey(message, context);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('[AI Orchestrator] Cache hit for understanding');
      return cached;
    }
    
    try {
      console.log('[AI Orchestrator] Processing message:', message);
      console.log('[AI Orchestrator] Context viewing date:', context.temporal.viewingDate);
      
      // Extract entities using regex (from orchestration.service.ts)
      const entities = this.extractEntities(message);
      
      // Generate comprehensive prompt with all context
      const prompt = buildComprehensivePrompt(message, context);
      
      // Get AI understanding
      const result = await generateObject({
        model: this.model,
        schema: completeUnderstandingSchema,
        prompt,
        temperature: 0.1, // Low temperature for consistent resolution
      });
      
      const understanding = result.object;
      
      // Merge extracted entities if they exist
      if (entities.dates && entities.dates.length > 0) {
        understanding.resolved.dates = [
          ...understanding.resolved.dates,
          ...entities.dates.map((d: string) => ({ original: d, resolved: d, confidence: 0.8 }))
        ];
      }
      if (entities.times && entities.times.length > 0) {
        understanding.resolved.times = [
          ...understanding.resolved.times,
          ...entities.times.map((t: string) => ({ original: t, resolved: t, confidence: 0.8 }))
        ];
      }
      
      // Add processing time and userId to metadata
      understanding.metadata.processingTime = Date.now() - startTime;
      // Store userId in a different way since metadata doesn't have userId field
      
      console.log('[AI Orchestrator] Understanding:', {
        intent: understanding.intent.primary,
        confidence: understanding.intent.confidence,
        execution: understanding.execution.type,
        resolved: {
          dates: understanding.resolved.dates.length,
          times: understanding.resolved.times.length,
          blocks: understanding.resolved.blocks.length,
          entities: understanding.resolved.entities.length,
        }
      });
      
      // Cache the result
      this.addToCache(cacheKey, understanding);
      
      // If there are ambiguities, return for clarification
      if (understanding.ambiguities && understanding.ambiguities.length > 0) {
        console.log('[AI Orchestrator] Ambiguities found:', understanding.ambiguities);
        return understanding;
      }
      
      // Validate the understanding
      this.validateUnderstanding(understanding);
      
      return understanding;
      
    } catch (error) {
      console.error('[AI Orchestrator] Error understanding message:', error);
      
      // Fallback to keyword-based understanding
      const fallbackEntities = this.extractEntities(message);
      return this.keywordFallback(message, fallbackEntities || {});
    }
  }
  
  /**
   * Build complete context for a user (absorbing context-builder.ts)
   */
  private async buildCompleteContext(
    userId: string,
    messages: Message[],
    viewingDateOverride?: string
  ): Promise<CompleteContext> {
    const startTime = Date.now();
    
    try {
      const factory = ServiceFactory.getInstance();
      
      // Ensure factory is configured
      if (!factory.isConfigured()) {
        throw new Error('ServiceFactory not configured');
      }
      
      // Get all services
      const scheduleService = factory.getScheduleService();
      const taskService = factory.getTaskService();
      const preferenceService = factory.getPreferenceService();
      
      // Get the current view date
      let viewingDate: Date;
      let viewingDateStr: string;
      
      if (viewingDateOverride) {
        viewingDate = new Date(viewingDateOverride);
        viewingDateStr = viewingDateOverride;
      } else {
        const scheduleStore = useSimpleScheduleStore.getState();
        viewingDate = scheduleStore.currentDate;
        viewingDateStr = format(viewingDate, 'yyyy-MM-dd');
      }
      
      // Fetch all data in parallel
      const currentTime = new Date();
      const todayStr = format(currentTime, 'yyyy-MM-dd');
      const timezone = 'America/New_York'; // TODO: Get from user preferences
      
      const [
        todaySchedule,
        viewDateSchedule,
        backlogTasks,
        preferences,
      ] = await Promise.all([
        scheduleService.getScheduleForDate(todayStr),
        viewingDateStr !== todayStr ? scheduleService.getScheduleForDate(viewingDateStr) : Promise.resolve([]),
        taskService.getTaskBacklog(),
        preferenceService.getUserPreferences(),
      ]);
      
      // Convert schedule blocks to the expected format
      const scheduleBlocks = (viewingDateStr === todayStr ? todaySchedule : viewDateSchedule).map(block => ({
        id: block.id,
        type: block.type as 'work' | 'meeting' | 'email' | 'break' | 'blocked',
        title: block.title,
        startTime: block.startTime.toISOString(),
        endTime: block.endTime.toISOString(),
        description: block.description,
        metadata: block.metadata,
      }));
      
      // Convert tasks to expected format
      const tasks = backlogTasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status === 'backlog' ? 'pending' as const : task.status === 'scheduled' ? 'in_progress' as const : 'pending' as const,
        priority: typeof task.priority === 'string' ? 
          (task.priority === 'high' ? 1 : task.priority === 'medium' ? 2 : 3) : 
          task.priority,
        // Tasks from service don't have dueDate, only deferredUntil for backlog items
        dueDate: undefined,
      }));
      
      // Extract recent messages for conversation memory
      const recentMessages = messages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date().toISOString(), // TODO: Get actual timestamp
      }));
      
      // Extract mentioned entities from recent messages
      const mentionedEntities = this.extractMentionedEntities(recentMessages);
      
      // Get recent operations from ExecutionEngine
      const executionEngine = getExecutionEngine();
      const recentOperations = executionEngine.getRecentOperations(10).map(op => ({
        tool: op.tool,
        params: op.params,
        result: op.result,
        timestamp: op.timestamp,
        affectedEntities: op.affectedEntities,
      }));
      
      // Build complete context
      const context: CompleteContext = {
        userId,
        temporal: {
          currentDateTime: currentTime.toISOString(),
          viewingDate: viewingDateStr,
          viewingDateTime: viewingDate.toISOString(),
          timezone,
          isViewingToday: viewingDateStr === todayStr,
        },
        state: {
          schedule: scheduleBlocks,
          tasks,
          emails: [], // TODO: Implement when email service is available
        },
        memory: {
          recentMessages,
          recentOperations,
          activeProposals: [], // TODO: Track proposals
          mentionedEntities,
        },
        patterns: preferences ? {
          workHours: {
            start: preferences.workStartTime || '09:00',
            end: preferences.workEndTime || '17:00',
          },
          lunchTime: {
            start: preferences.lunchStartTime || '12:00',
            duration: preferences.lunchDurationMinutes || 60,
          },
          commonPhrases: {},
          emailTimes: preferences.emailPreferences?.batchProcessing ? ['08:00', '16:00'] : [],
          breakPreferences: {
            duration: preferences.breakSchedule?.morningBreak?.duration || 15,
            frequency: 2, // Default to 2 breaks per day
          },
          meetingPreferences: {
            defaultDuration: 30, // Default meeting duration
            bufferTime: 15, // Default buffer time
          },
        } : {
          workHours: { start: '09:00', end: '17:00' },
          lunchTime: { start: '12:00', duration: 60 },
          commonPhrases: {},
          emailTimes: [],
          breakPreferences: { duration: 15, frequency: 2 },
          meetingPreferences: { defaultDuration: 30, bufferTime: 15 },
        },
      };
      
      console.log('[AI Orchestrator] Built context in', Date.now() - startTime, 'ms');
      
      return context;
      
    } catch (error) {
      console.error('[AI Orchestrator] Failed to build context:', error);
      
      // Return minimal context on error
      return this.getMinimalContext(userId);
    }
  }
  
  /**
   * Execute based on understanding
   */
  private async execute(
    understanding: CompleteUnderstanding,
    context: CompleteContext,
    messages: Message[]
  ): Promise<any> {
    const { execution } = understanding;
    
    // Get all tools from registry
    const tools = toolRegistry.getAll();
    
    switch (execution.type) {
      case 'single':
        if (!execution.tool || !tools[execution.tool]) {
          // If no tool specified or tool not found, just have a conversation
          return streamText({
            model: this.model,
            messages,
            system: this.getConversationPrompt(understanding),
            temperature: 0.7,
          });
        }
        
        // Execute single tool with streaming - pass all tools like the original
        return streamText({
          model: this.model,
          messages,
          tools,
          toolChoice: { type: 'tool', toolName: execution.tool },
          system: this.getSystemPrompt(execution.tool, understanding, context.userId),
          temperature: 0.7,
          maxSteps: 1,
          experimental_toolCallStreaming: true,
        });
        
      case 'workflow':
        if (!execution.workflow || !tools[execution.workflow]) {
          throw new Error(`Workflow ${execution.workflow} not found`);
        }
        
        // Execute workflow with streaming - pass all tools like the original
        return streamText({
          model: this.model,
          messages,
          tools,
          toolChoice: { type: 'tool', toolName: execution.workflow },
          system: this.getSystemPrompt(execution.workflow, understanding, context.userId),
          temperature: 0.7,
          maxSteps: 1,
          experimental_toolCallStreaming: true,
        });
        
      case 'multi_step':
        // TODO: Implement multi-step execution
        throw new Error('Multi-step execution not yet implemented');
        
      default:
        // Direct conversation response
        return streamText({
          model: this.model,
          messages,
          system: this.getConversationPrompt(understanding),
          temperature: 0.7,
        });
    }
  }
  
  /**
   * Extract entities from message using regex patterns (from orchestration.service.ts)
   */
  private extractEntities(message: string): any {
    const entities: any = {};
    
    // Extract dates
    const datePattern = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/gi;
    const dates = message.match(datePattern);
    if (dates) entities.dates = Array.from(new Set(dates.map(d => d.toLowerCase())));
    
    // Extract times
    const timePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon|evening|night)\b/gi;
    const times = message.match(timePattern);
    if (times) entities.times = Array.from(new Set(times.map(t => t.toLowerCase())));
    
    // Extract duration
    const durationPattern = /\b(\d+)\s*(?:hour|hr|minute|min)s?\b/i;
    const duration = message.match(durationPattern);
    if (duration) {
      const num = parseInt(duration[1] || '0');
      const isHours = duration[0].toLowerCase().includes('hour') || duration[0].toLowerCase().includes('hr');
      entities.duration = isHours ? num * 60 : num;
    }
    
    // Extract people
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
   * Extract mentioned entities from recent messages
   */
  private extractMentionedEntities(
    messages: Array<{ role: string; content: string; timestamp: string }>
  ): CompleteContext['memory']['mentionedEntities'] {
    // Get recent operations to find mentioned entities
    const executionEngine = getExecutionEngine();
    const recentOps = executionEngine.getRecentOperations(5);
    
    // Find most recent entity mentions
    let primary: CompleteContext['memory']['mentionedEntities']['primary'];
    let secondary: CompleteContext['memory']['mentionedEntities']['secondary'];
    const all: CompleteContext['memory']['mentionedEntities']['all'] = [];
    
    // Look through recent operations for entities
    for (const op of recentOps) {
      if (op.affectedEntities.blocks?.length) {
        const blockId = op.affectedEntities.blocks[0];
        if (blockId) {
          const entity = {
            type: 'block' as const,
            id: blockId,
            name: String(op.params.title || op.params.blockDescription || 'Block'),
            lastMentioned: op.timestamp,
          };
          all.push(entity);
          if (!primary) primary = entity;
          else if (!secondary) secondary = entity;
        }
      }
      
      if (op.affectedEntities.tasks?.length) {
        const taskId = op.affectedEntities.tasks[0];
        if (taskId) {
          const entity = {
            type: 'task' as const,
            id: taskId,
            name: String(op.params.title || 'Task'),
            lastMentioned: op.timestamp,
          };
          all.push(entity);
          if (!primary) primary = entity;
          else if (!secondary) secondary = entity;
        }
      }
    }
    
    return {
      primary,
      secondary,
      all,
    };
  }
  
  /**
   * Check for active proposals in recent messages
   */
  private checkForActiveProposal(messages: Message[]): boolean {
    const recentMessages = messages.slice(-5);
    return recentMessages.some((msg: any) => 
      msg.toolInvocations?.some((inv: any) => 
        inv.state === 'result' && 
        inv.result?.phase === 'proposal' && 
        inv.result?.requiresConfirmation
      )
    );
  }
  
  /**
   * Route to approval workflow if needed
   */
  private routeToApproval(
    understanding: CompleteUnderstanding,
    messages: Message[],
    viewingDate?: string
  ): CompleteUnderstanding {
    // Find the workflow that created the proposal
    const recentMessages = messages.slice(-5);
    const proposalMessage = recentMessages.find((msg: any) => 
      msg.toolInvocations?.some((inv: any) => 
        inv.state === 'result' && 
        inv.result?.phase === 'proposal' && 
        inv.result?.requiresConfirmation
      )
    );
    
    const workflowTool = proposalMessage?.toolInvocations?.find((inv: any) => 
      inv.toolName.includes('workflow_')
    );
    
    if (workflowTool) {
      console.log('[AI Orchestrator] Routing to approval for workflow:', workflowTool.toolName);
      
      return {
        ...understanding,
        intent: {
          primary: 'approve_proposal',
          confidence: 0.9,
          reasoning: 'User is approving an active proposal',
        },
        execution: {
          type: 'workflow',
          workflow: workflowTool.toolName,
          parameters: {
            isApproval: true,
            date: workflowTool.args?.date || viewingDate,
          },
        },
      };
    }
    
    return understanding;
  }
  
  /**
   * Keyword-based fallback understanding
   */
  private keywordFallback(message: string, entities: any): CompleteUnderstanding {
    const lower = message.toLowerCase();
    
    // Check for approval patterns
    if (lower.includes('approve') && (lower.includes('schedule') || lower.includes('proposal'))) {
      return {
        intent: {
          primary: 'approve_proposal',
          confidence: 0.8,
          reasoning: 'Keyword match for approval',
        },
        execution: {
          type: 'workflow',
          workflow: 'workflow_schedule',
          parameters: { isApproval: true },
        },
        resolved: {
          dates: [],
          times: [],
          blocks: [],
          entities: [],
        },
        metadata: {
          processingTime: 0,
          contextUsed: ['keywords'],
          confidence: 0.8,
        },
      };
    }
    
    // Default to conversation
    return {
      intent: {
        primary: 'conversation',
        confidence: 0.5,
        reasoning: 'No clear intent detected, defaulting to conversation',
      },
      execution: {
        type: 'single',
      },
      resolved: {
        dates: [],
        times: [],
        blocks: [],
        entities: [],
      },
      metadata: {
        processingTime: 0,
        contextUsed: [],
        confidence: 0.5,
      },
    };
  }
  
  /**
   * Get system prompt for tool/workflow execution
   */
  private getSystemPrompt(toolName: string, understanding: CompleteUnderstanding, userId: string): string {
    // Check if it's a workflow
    if (toolName.startsWith('workflow_')) {
      return getWorkflowSystemPrompt(toolName, understanding, userId);
    }
    
    // Otherwise it's a regular tool
    return getToolSystemPrompt(toolName, understanding);
  }
  
  /**
   * Get conversation prompt
   */
  private getConversationPrompt(understanding: CompleteUnderstanding): string {
    return getConversationSystemPrompt(understanding);
  }
  
  /**
   * Get minimal context for error cases
   */
  private getMinimalContext(userId: string): CompleteContext {
    const now = new Date();
    const timezone = 'America/New_York';
    
    return {
      userId,
      temporal: {
        currentDateTime: now.toISOString(),
        viewingDate: format(now, 'yyyy-MM-dd'),
        viewingDateTime: now.toISOString(),
        timezone,
        isViewingToday: true,
      },
      state: {
        schedule: [],
        tasks: [],
        emails: [],
      },
      memory: {
        recentMessages: [],
        recentOperations: [],
        activeProposals: [],
        mentionedEntities: { all: [] },
      },
      patterns: {
        workHours: { start: '09:00', end: '17:00' },
        lunchTime: { start: '12:00', duration: 60 },
        commonPhrases: {},
        emailTimes: [],
        breakPreferences: { duration: 15, frequency: 2 },
        meetingPreferences: { defaultDuration: 30, bufferTime: 15 },
      },
    };
  }
  
  /**
   * Cache management methods (from orchestration.service.ts)
   */
  private getCacheKey(message: string, context: CompleteContext): string {
    const hour = new Date(context.temporal.currentDateTime).getHours();
    const hasSchedule = context.state.schedule.length > 0;
    const taskCount = context.state.tasks.length;
    
    return `${message.toLowerCase().trim()}_${hour}_${hasSchedule}_${taskCount}_${context.temporal.viewingDate}`;
  }
  
  private getFromCache(key: string): CompleteUnderstanding | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.understanding;
  }
  
  private addToCache(key: string, understanding: CompleteUnderstanding): void {
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      understanding,
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
   * Validate that the understanding makes sense
   */
  private validateUnderstanding(understanding: CompleteUnderstanding): void {
    const { execution } = understanding;
    
    // Ensure execution has required fields based on type
    switch (execution.type) {
      case 'single':
        if (!execution.tool && !execution.parameters) {
          // Allow conversation responses without tools
          return;
        }
        if (execution.tool && !execution.parameters) {
          // For view operations, we can provide default parameters based on context
          if (execution.tool === 'schedule_viewSchedule') {
            console.log('[AI Orchestrator] Adding default date parameter for viewSchedule');
            // Get the viewing date from resolved dates or use today
            const date = understanding.resolved.dates.length > 0 && understanding.resolved.dates[0]?.resolved
              ? understanding.resolved.dates[0].resolved
              : new Date().toISOString().split('T')[0];
            
            execution.parameters = { date };
          } else {
            console.warn(`[AI Orchestrator] Tool ${execution.tool} specified without parameters`);
            // Don't throw error, let the tool execution handle missing params
          }
        }
        break;
        
      case 'workflow':
        if (!execution.workflow) {
          throw new Error('Workflow execution requires workflow name');
        }
        // Workflows might have optional parameters
        if (!execution.parameters) {
          execution.parameters = {};
        }
        break;
        
      case 'multi_step':
        if (!execution.steps || execution.steps.length === 0) {
          throw new Error('Multi-step execution requires steps');
        }
        break;
    }
    
    // Validate all resolved entities have high enough confidence
    const lowConfidenceThreshold = 0.7;
    
    const allResolutions = [
      ...understanding.resolved.dates.map(d => ({ ...d, type: 'date' })),
      ...understanding.resolved.times.map(t => ({ ...t, type: 'time' })),
      ...understanding.resolved.blocks.map(b => ({ ...b, type: 'block' })),
      ...understanding.resolved.entities.map(e => ({ ...e, type: 'entity' })),
    ];
    
    const lowConfidence = allResolutions.filter(r => r.confidence < lowConfidenceThreshold);
    if (lowConfidence.length > 0) {
      console.warn('[AI Orchestrator] Low confidence resolutions:', lowConfidence);
    }
  }
  
  /**
   * Update context with operation results
   */
  private updateContextWithOperation(
    context: CompleteContext,
    operation: TrackedOperation
  ): void {
    // Add to recent operations
    context.memory.recentOperations.unshift({
      tool: operation.tool,
      params: operation.params,
      result: operation.result,
      timestamp: operation.timestamp,
      affectedEntities: operation.affectedEntities,
    });
    
    // Limit to 10 operations
    if (context.memory.recentOperations.length > 10) {
      context.memory.recentOperations = context.memory.recentOperations.slice(0, 10);
    }
  }
}

// Singleton instance
let instance: AIOrchestrator | null = null;

export function getAIOrchestrator(): AIOrchestrator {
  if (!instance) {
    instance = new AIOrchestrator();
  }
  return instance;
} 