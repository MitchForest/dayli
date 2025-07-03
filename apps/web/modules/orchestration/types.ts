/**
 * Orchestration Layer Type Definitions
 * 
 * Core types for intent classification and routing decisions
 */

import type { Message } from 'ai';

/**
 * User intent classification result
 */
export interface UserIntent {
  // Primary classification
  category: 'workflow' | 'tool' | 'conversation';
  confidence: number; // 0-1 confidence score
  
  // Optional subcategory for more specific routing
  subcategory?: string;
  
  // Extracted entities from the message
  entities: {
    dates?: string[];
    times?: string[];
    people?: string[];
    tasks?: string[];
    duration?: number; // in minutes
  };
  
  // Suggested handler based on classification
  suggestedHandler: {
    type: 'workflow' | 'tool' | 'direct';
    name?: string; // workflow or tool name
    params?: Record<string, unknown>;
  };
  
  // AI's reasoning for this classification
  reasoning: string;
}

/**
 * Context for orchestration decisions
 */
export interface OrchestrationContext {
  // User identification
  userId: string;
  
  // Temporal context
  currentTime: Date;
  timezone: string;
  
  // Conversation context
  recentMessages: Message[];
  
  // Current schedule state
  scheduleState: {
    hasBlocksToday: boolean;
    nextBlock?: {
      id: string;
      user_id: string;
      type: string;
      title: string;
      start_time: string;
      end_time: string;
      created_at: string;
    };
    utilization: number; // 0-100%
    gaps?: Array<{
      startTime: Date;
      endTime: Date;
      duration: number;
    }>;
  };
  
  // Task backlog state
  taskState: {
    pendingCount: number;
    urgentCount: number;
    overdueCount: number;
    topTasks?: Array<{
      id: string;
      title: string;
      priority?: string;
      urgency?: number;
      score: number;
      [key: string]: unknown;
    }>;
  };
  
  // Email state
  emailState: {
    unreadCount: number;
    urgentCount: number;
    importantCount: number;
  };
  
  // User behavior patterns (from future RAG integration)
  userPatterns?: {
    typicalStartTime?: string;
    preferredBlockDuration?: number;
    commonRequests?: string[];
    rejectedActions?: Array<{
      action: string;
      reason: string;
      timestamp: Date;
    }>;
  };
}

/**
 * Classification schema for AI SDK generateObject
 */
export const intentClassificationSchema = {
  reasoning: 'string',
  category: "enum['workflow', 'tool', 'conversation']",
  confidence: 'number',
  subcategory: 'string?',
  complexity: "enum['simple', 'complex']",
  entities: {
    dates: 'string[]?',
    times: 'string[]?',
    people: 'string[]?',
    tasks: 'string[]?',
  },
  suggestedHandler: {
    type: "enum['workflow', 'tool', 'direct']",
    name: 'string?',
    params: 'object?',
  },
};

/**
 * Cache entry for intent classifications
 */
export interface IntentCacheEntry {
  intent: UserIntent;
  timestamp: number;
  contextHash: string;
}

/**
 * Rejection pattern from user history
 */
export interface RejectionPattern {
  id: string;
  pattern: string;
  reason: string;
  count: number;
  lastOccurrence: Date;
  similarIntents: string[];
}

/**
 * Orchestration result with routing decision
 */
export interface OrchestrationResult {
  intent: UserIntent;
  route: 'workflow' | 'tool' | 'conversation';
  handler: string | null;
  context: OrchestrationContext;
  cached: boolean;
  processingTime: number;
}