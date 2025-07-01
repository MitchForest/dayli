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
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
} 