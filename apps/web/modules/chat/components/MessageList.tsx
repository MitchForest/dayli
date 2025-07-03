'use client';

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { MessageContent } from './MessageContent';
import { CommandListMessage } from './CommandListMessage';
import { ToolResultRenderer } from './ToolResultRenderer';
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

  // Handle tool actions from ToolResultRenderer
  const handleToolAction = useCallback((action: { type: string; payload?: any }) => {
    console.log('[MessageList] Tool action received:', action);
    
    // Handle different action types
    switch (action.type) {
      case 'create_block':
      case 'edit_block':
      case 'view_task':
      case 'complete_task':
      case 'read_email':
      case 'draft_reply':
      case 'confirm_proposal':
        // These could trigger new messages or navigation
        if (onSuggestionSelect) {
          // Convert action to a natural language command
          const command = convertActionToCommand(action);
          if (command) {
            onSuggestionSelect(command);
          }
        }
        break;
      default:
        console.log('[MessageList] Unhandled action type:', action.type);
    }
  }, [onSuggestionSelect]);
  
  // Convert tool action to natural language command
  const convertActionToCommand = (action: { type: string; payload?: any }): string | null => {
    switch (action.type) {
      case 'create_block':
        return `Create a new time block${action.payload?.date ? ` for ${action.payload.date}` : ''}`;
      case 'edit_block':
        return `Edit time block ${action.payload?.blockId}`;
      case 'view_task':
        return `Show task details for ${action.payload?.taskId}`;
      case 'complete_task':
        return `Complete task ${action.payload?.taskId}`;
      case 'read_email':
        return `Read email ${action.payload?.emailId}`;
      case 'draft_reply':
        return `Draft a reply to email ${action.payload?.emailId}`;
      case 'confirm_proposal':
        return action.payload?.confirmed 
          ? `Confirm proposal ${action.payload?.proposalId}`
          : `Cancel proposal ${action.payload?.proposalId}`;
      default:
        return null;
    }
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

  // Render tool results using the new ToolResultRenderer
  const renderToolResults = (message: Message) => {
    if (!message.toolInvocations || message.toolInvocations.length === 0) {
      return null;
    }
    
    return (
      <div className="mt-3 space-y-3">
        {message.toolInvocations
          .filter(inv => inv.state === 'result' || inv.state === 'partial-call')
          .map((invocation, idx) => {
            const isStreaming = invocation.state === 'partial-call';
            const progress = isStreaming ? 50 : 100;
            const result = invocation.state === 'result' ? invocation.result : null;
            
            return (
              <ToolResultRenderer
                key={`${message.id}-tool-${idx}`}
                toolName={invocation.toolName}
                result={result}
                isStreaming={isStreaming}
                streamProgress={progress}
                onAction={handleToolAction}
              />
            );
          })}
      </div>
    );
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
            {/* Display message content */}
            {message.content && (
              <MessageContent
                content={message.content}
                role={message.role as 'user' | 'assistant' | 'system'}
                metadata={getMessageMetadata(message)}
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
            )}
            
            {/* Display tool results using new renderer */}
            {renderToolResults(message)}
            
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