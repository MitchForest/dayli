export interface ToolExecution {
  toolName: string;
  args: any;
  result: any;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  timestamp: Date;
  toolInvocations?: ToolExecution[];
  metadata?: MessageMetadata;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}

// New interfaces for rich message display

export interface Entity {
  type: 'task' | 'email' | 'meeting' | 'time' | 'person' | 'block';
  value: string;
  id?: string;
  metadata?: {
    taskId?: string;
    emailId?: string;
    eventId?: string;
    blockId?: string;
    email?: string;
    startTime?: string;
    endTime?: string;
    blockType?: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
  };
}

export interface MessageMetadata {
  entities?: Entity[];
  suggestions?: string[];
  actions?: Action[];
  error?: string;
  toolResults?: any[]; // Will be typed as ToolResult[] when we import the type
}

export interface Action {
  label: string;
  action: string;
  params?: Record<string, any>;
  variant?: 'default' | 'primary' | 'destructive';
}

export interface ListItem {
  title: string;
  subtitle?: string;
  icon?: any; // Will be a Lucide icon component
  time?: string;
  metadata?: Record<string, any>;
}

export interface ParsedSegment {
  type: 'text' | 'entity' | 'list' | 'schedule' | 'code';
  value?: string;
  entity?: Entity;
  items?: ListItem[];
  blocks?: any[]; // Will be TimeBlock[] when we import the type
  language?: string;
} 