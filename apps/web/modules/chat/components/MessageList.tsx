'use client';

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User, Loader2, Check, X, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { MessageContent } from './MessageContent';
import { CommandListMessage } from './CommandListMessage';
import type { Message } from 'ai';
import type { Entity, MessageMetadata } from '../types/chat.types';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onEntityClick?: (entity: Entity) => void;
  onSuggestionSelect?: (suggestion: string) => void;
  showCommands?: boolean;
}

export function MessageList({ 
  messages, 
  isLoading = false,
  onEntityClick,
  onSuggestionSelect,
  showCommands = false
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle command selection - wrapper to ensure commands close
  const handleCommandSelect = useCallback((command: string) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(command);
    }
  }, [onSuggestionSelect]);

  // Helper to format tool execution status
  const getToolExecutionDisplay = (toolName: string, invocation: any) => {
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
    
    // Check if the invocation has completed (has a result)
    const hasResult = invocation.state === 'result';
    const result = hasResult ? invocation.result : null;
    const status = result?.success === false ? 'failed' : hasResult ? 'completed' : 'pending';
    
    return { description, status };
  };

  // Extract metadata from message including tool results
  const getMessageMetadata = (message: Message): MessageMetadata => {
    const metadata: MessageMetadata = {};
    
    // Extract suggestions from tool results
    if (message.toolInvocations && message.toolInvocations.length > 0) {
      const suggestions: string[] = [];
      
      message.toolInvocations.forEach((invocation) => {
        if (invocation.state === 'result' && invocation.result?.metadata?.suggestions) {
          suggestions.push(...invocation.result.metadata.suggestions);
        }
      });
      
      if (suggestions.length > 0) {
        // Deduplicate suggestions
        metadata.suggestions = [...new Set(suggestions)];
      }
    }
    
    return metadata;
  };

  // Extract structured data from tool results
  const getStructuredData = (message: Message) => {
    if (!message.toolInvocations || message.toolInvocations.length === 0) {
      return undefined;
    }

    const structuredResponses = message.toolInvocations
      .filter((invocation: any) => {
        // Check if we have a result
        if (invocation.state !== 'result' || !invocation.result) {
          return false;
        }
        
        const result = invocation.result;
        
        // Check if the result itself is a UniversalToolResponse
        const hasDirectStructure = 
          typeof result === 'object' &&
          'metadata' in result &&
          'display' in result &&
          'ui' in result;
        
        // Also check if it's wrapped in a success/data structure (legacy format)
        const hasWrappedStructure = 
          typeof result === 'object' &&
          'success' in result &&
          'data' in result &&
          result.data &&
          typeof result.data === 'object' &&
          'metadata' in result.data &&
          'display' in result.data &&
          'ui' in result.data;
        
        // Debug logging
        console.log('[MessageList] Tool result structure check:', {
          toolName: invocation.toolName,
          hasResult: !!result,
          hasDirectStructure,
          hasWrappedStructure,
          resultKeys: result ? Object.keys(result) : [],
          result: result
        });
        
        return hasDirectStructure || hasWrappedStructure;
      })
      .map((invocation: any) => {
        const result = invocation.result;
        
        // If it's wrapped in success/data, unwrap it
        if (result.success && result.data && 'metadata' in result.data) {
          return result.data;
        }
        
        // Otherwise, it's already in the right format
        return result;
      });

    console.log('[MessageList] Structured responses found:', structuredResponses.length);
    return structuredResponses.length > 0 ? structuredResponses : undefined;
  };

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && !showCommands && (
        <div className="max-w-3xl mx-auto mt-8">
          <CommandListMessage onCommandSelect={handleCommandSelect} />
        </div>
      )}
      
      {showCommands && (
        <div className="max-w-3xl mx-auto mt-8">
          <CommandListMessage 
            onCommandSelect={handleCommandSelect} 
            showAll={true}
          />
        </div>
      )}
      
      {messages.map((message) => (
        <div
          key={message.id}
          data-role={message.role}
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
            {/* Use MessageContent for rich display */}
            <MessageContent
              content={message.content}
              role={message.role as 'user' | 'assistant' | 'system'}
              metadata={getMessageMetadata(message)}
              structuredData={getStructuredData(message)}
              message={message}
              onSuggestionSelect={onSuggestionSelect}
              onAction={(action) => {
                // Handle structured actions
                if (action.type === 'message') {
                  onSuggestionSelect?.(action.message);
                }
                // Add more action handlers as needed
              }}
              isLoading={isLoading && message === messages[messages.length - 1]}
            />
            
            {/* Display tool executions */}
            {message.toolInvocations && message.toolInvocations.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.toolInvocations.map((invocation, index) => {
                  const { description, status } = getToolExecutionDisplay(
                    invocation.toolName,
                    invocation
                  );
                  
                  return (
                    <div
                      key={`${message.id}-tool-${index}`}
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        message.role === 'user' ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}
                    >
                      <Wrench className="h-3 w-3" />
                      <span>{description}</span>
                      {status === 'completed' && <Check className="h-3 w-3 text-green-500" />}
                      {status === 'failed' && <X className="h-3 w-3 text-red-500" />}
                      {status === 'pending' && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  );
                })}
              </div>
            )}
            
            <p className={cn(
              "text-xs mt-1",
              message.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'
            )}>
              {message.createdAt ? format(new Date(message.createdAt), 'h:mm a') : ''}
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