/**
 * Complete context provided to AI for understanding user intent
 * This contains ALL information the AI needs to resolve natural language
 */
export interface CompleteContext {
  // User identification
  userId: string;
  
  // Temporal context - ALWAYS included
  temporal: {
    currentDateTime: string;      // ISO string: "2025-07-04T22:15:00Z"
    viewingDate: string;         // Date only: "2025-07-04"
    viewingDateTime: string;     // ISO string for viewing date start
    timezone: string;            // IANA timezone: "America/New_York"
    isViewingToday: boolean;     // Whether viewing date equals current date
  };
  
  // Current state - all entities the user might reference
  state: {
    // Full schedule for the viewing date
    schedule: Array<{
      id: string;
      type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
      title: string;
      startTime: string;          // ISO string
      endTime: string;            // ISO string
      description?: string;
      metadata?: Record<string, any>;
    }>;
    
    // Active tasks (not completed)
    tasks: Array<{
      id: string;
      title: string;
      status: 'pending' | 'in_progress';
      priority: number;           // 1-4, where 1 is highest
      dueDate?: string;          // ISO date string
      estimatedMinutes?: number;
      tags?: string[];
    }>;
    
    // Unprocessed emails
    emails: Array<{
      id: string;
      subject: string;
      from: string;
      receivedAt: string;         // ISO string
      priority: 'urgent' | 'normal' | 'low';
      preview?: string;
    }>;
  };
  
  // Conversation memory for reference resolution
  memory: {
    // Recent chat messages for context
    recentMessages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;          // ISO string
    }>;
    
    // Recent tool executions for "it/that" references
    recentOperations: Array<{
      tool: string;
      params: Record<string, any>;
      result: any;
      timestamp: string;          // ISO string
      affectedEntities?: {
        blocks?: string[];
        tasks?: string[];
        emails?: string[];
      };
    }>;
    
    // Active proposals awaiting confirmation
    activeProposals: Array<{
      id: string;
      type: string;
      data: any;
      expiresAt: string;          // ISO string
    }>;
    
    // Entities mentioned in conversation
    mentionedEntities: {
      // Most recently mentioned entity (for "it")
      primary?: {
        type: 'block' | 'task' | 'email' | 'meeting';
        id: string;
        name: string;
        lastMentioned: string;    // ISO string
      };
      
      // Second most recent (for "that other one")
      secondary?: {
        type: 'block' | 'task' | 'email' | 'meeting';
        id: string;
        name: string;
        lastMentioned: string;    // ISO string
      };
      
      // All recent entities by type
      all: Array<{
        type: 'block' | 'task' | 'email' | 'meeting';
        id: string;
        name: string;
        lastMentioned: string;    // ISO string
      }>;
    };
  };
  
  // User patterns for better understanding
  patterns: {
    // Typical work schedule
    workHours: {
      start: string;              // "09:00"
      end: string;                // "17:00"
    };
    
    // Lunch preferences
    lunchTime: {
      start: string;              // "12:00"
      duration: number;           // minutes
    };
    
    // Common naming patterns
    commonPhrases: Record<string, string>; // "my morning block" -> "Deep Work Block"
    
    // Typical email processing times
    emailTimes: string[];         // ["08:00", "16:00"]
    
    // Break preferences
    breakPreferences: {
      duration: number;           // minutes
      frequency: number;          // breaks per day
    };
    
    // Meeting patterns
    meetingPreferences: {
      defaultDuration: number;    // minutes
      bufferTime: number;         // minutes between meetings
    };
  };
} 