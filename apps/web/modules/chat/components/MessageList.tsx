'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { cn } from '@/lib/utils';
import { Bot, User, Loader2, Check, X, Wrench } from 'lucide-react';
import { format } from 'date-fns';

export function MessageList() {
  const messages = useChatStore((state) => state.messages);
  const isLoading = useChatStore((state) => state.isLoading);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Helper to format tool execution status
  const getToolExecutionDisplay = (toolName: string, result: any) => {
    // Map tool names to user-friendly descriptions
    const toolDescriptions: Record<string, string> = {
      createTimeBlock: 'Creating time block',
      moveTimeBlock: 'Moving time block',
      deleteTimeBlock: 'Deleting time block',
      assignTaskToBlock: 'Assigning task',
      completeTask: 'Completing task',
      getSchedule: 'Checking schedule',
      getUnassignedTasks: 'Getting unassigned tasks',
      updatePreference: 'Updating preferences',
      getPreferences: 'Getting preferences',
    };

    const description = toolDescriptions[toolName] || toolName;
    const status = result?.success === false ? 'failed' : 'completed';
    
    return { description, status };
  };

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <div className="text-center text-muted-foreground mt-8">
          <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Hi! I'm dayli, your AI executive assistant.</p>
          <p className="text-sm mt-2">Try saying "Plan my day" or "What should I work on?"</p>
        </div>
      )}
      
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex gap-3",
            message.role === 'user' ? 'justify-end' : 'justify-start'
          )}
        >
          {message.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-primary" />
            </div>
          )}
          
          <div
            className={cn(
              "max-w-[80%] rounded-lg px-4 py-2",
              message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            )}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            
            {/* Display tool executions */}
            {message.toolInvocations && message.toolInvocations.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.toolInvocations.map((invocation, index) => {
                  const { description, status } = getToolExecutionDisplay(
                    invocation.toolName,
                    invocation.result
                  );
                  
                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        message.role === 'user' ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}
                    >
                      <Wrench className="h-3 w-3" />
                      <span>{description}</span>
                      {status === 'completed' && <Check className="h-3 w-3 text-green-500" />}
                      {status === 'failed' && <X className="h-3 w-3 text-red-500" />}
                    </div>
                  );
                })}
              </div>
            )}
            
            <p className={cn(
              "text-xs mt-1",
              message.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'
            )}>
              {format(message.timestamp, 'h:mm a')}
            </p>
          </div>
          
          {message.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5" />
            </div>
          )}
        </div>
      ))}
      
      {isLoading && (
        <div className="flex gap-3 justify-start">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="bg-muted rounded-lg px-4 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
} 