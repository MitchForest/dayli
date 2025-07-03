'use client';

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { MessageContent } from './MessageContent';
import { CommandListMessage } from './CommandListMessage';
import { ToolResultRenderer } from './ToolResultRenderer';
import { ToolInvocationDisplay } from './ToolInvocationDisplay';
import { WorkflowToolSequence } from './WorkflowToolSequence';
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
      // Schedule workflow actions
      case 'confirm_schedule':
        if (onSuggestionSelect) {
          // The schedule is already created, so this is just acknowledging it
          onSuggestionSelect(`Great! The schedule for ${action.payload?.date || 'today'} is confirmed.`);
        }
        break;
      case 'adjust_schedule':
        if (onSuggestionSelect) {
          // Ask for specific adjustments
          onSuggestionSelect(`What adjustments would you like to make to the schedule for ${action.payload?.date || 'today'}? For example: "Move lunch to 1pm" or "Add a 2-hour work block at 3pm"`);
        }
        break;
      
      // Proposal actions (NEW for Sprint 4.3)
      case 'approve_proposal':
        if (onSuggestionSelect) {
          const workflowType = action.payload?.workflowType;
          if (workflowType === 'schedule') {
            onSuggestionSelect(`Approve the schedule proposal for ${action.payload?.date || 'today'}`);
          } else if (workflowType === 'tasks') {
            onSuggestionSelect(`Approve the task assignments for block ${action.payload?.blockId}`);
          } else if (workflowType === 'emails') {
            onSuggestionSelect(`Approve the email triage plan`);
          } else {
            onSuggestionSelect(`Approve this proposal`);
          }
        }
        break;
      
      case 'modify_proposal':
        if (onSuggestionSelect) {
          const workflowType = action.payload?.workflowType;
          let modifyText = '';
          if (workflowType === 'schedule') {
            modifyText = `I'd like to modify the schedule proposal. `;
          } else if (workflowType === 'tasks') {
            modifyText = `I'd like different tasks for this block. `;
          } else if (workflowType === 'emails') {
            modifyText = `I'd like to modify the email triage plan. `;
          } else {
            modifyText = `I'd like to modify this proposal. `;
          }
          // For modify, just set the input without submitting
          // This allows the user to type their specific modifications
          const event = new Event('modify_proposal', { bubbles: true });
          (event as any).detail = { text: modifyText, submit: false };
          window.dispatchEvent(event);
        }
        break;
      
      case 'cancel_proposal':
        if (onSuggestionSelect) {
          onSuggestionSelect(`Cancel the ${action.payload?.workflowType || 'current'} proposal`);
        }
        break;
      
      // Task workflow actions
      case 'confirm_tasks':
        if (onSuggestionSelect) {
          // Tasks are already assigned, this confirms them
          onSuggestionSelect(`Perfect! The tasks have been assigned to block ${action.payload?.blockId}. You can start working on them now.`);
        }
        break;
      case 'select_different_tasks':
        if (onSuggestionSelect) {
          // Ask for different task selection criteria
          onSuggestionSelect(`What kind of tasks would you prefer for block ${action.payload?.blockId}? For example: "Only high priority tasks" or "Tasks that take less than 30 minutes"`);
        }
        break;
      
      // Email workflow actions
      case 'process_emails':
        if (onSuggestionSelect) {
          // Start processing the organized emails
          onSuggestionSelect(`Let's process these emails. Which batch would you like to start with? Say "Process urgent emails" or "Process emails from [sender]"`);
        }
        break;
      case 'review_batches':
        if (onSuggestionSelect) {
          // Show more details about the email batches
          onSuggestionSelect(`Show me more details about the email batches`);
        }
        break;
      
      // Task selection actions
      case 'select_task':
        if (onSuggestionSelect && action.payload?.taskId) {
          onSuggestionSelect(`Assign task ${action.payload.taskId} to my next available work block`);
        }
        break;
      
      case 'select_combination':
        if (onSuggestionSelect && action.payload?.combination) {
          const taskIds = action.payload.combination.map((t: any) => t.id).join(', ');
          onSuggestionSelect(`Create a work block with these tasks: ${taskIds}`);
        }
        break;
      
      // Original tool actions
      case 'create_block':
      case 'edit_block':
      case 'view_task':
      case 'complete_task':
      case 'read_email':
      case 'draft_reply':
      case 'confirm_proposal':
      case 'view_block':
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
      case 'view_block':
        return `Show my schedule${action.payload?.blockId ? ` for block ${action.payload.blockId}` : ''}`;
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

  // Render tool invocations and results
  const renderToolInvocations = (message: Message) => {
    if (!message.toolInvocations || message.toolInvocations.length === 0) {
      return null;
    }
    
    console.log('[MessageList] Rendering tool invocations for message:', {
      messageId: message.id,
      toolInvocations: message.toolInvocations.map(inv => ({
        toolName: inv.toolName,
        state: inv.state,
        result: inv.state === 'result' ? (inv as any).result : undefined,
        args: inv.args
      }))
    });
    
    // Check if this is a workflow (multiple related tools)
    const isWorkflow = message.toolInvocations.some(inv => inv.toolName.includes('workflow_'));
    const hasMultipleTools = message.toolInvocations.length > 1;
    
    if (isWorkflow && hasMultipleTools) {
      // Extract workflow info from the first workflow tool
      const workflowTool = message.toolInvocations.find(inv => inv.toolName.includes('workflow_'));
      const workflowName = workflowTool?.toolName || 'workflow';
      
      // Map all tools to workflow tool format
      const tools = message.toolInvocations.map(inv => ({
        name: inv.toolName,
        state: (inv.state === 'result' ? 'completed' : 
               inv.state === 'partial-call' ? 'running' : 
               'pending') as 'completed' | 'running' | 'pending' | 'failed',
        error: inv.state === 'result' && (inv as any).result?.error
      }));
      
      return (
        <div className="mt-3 space-y-3">
          <WorkflowToolSequence
            workflowName={workflowName}
            tools={tools}
          />
          {/* Show results for completed tools */}
          {message.toolInvocations
            .filter(inv => inv.state === 'result')
            .map((invocation, idx) => {
              const result = (invocation as any).result;
              return (
                <ToolResultRenderer
                  key={`${message.id}-result-${idx}`}
                  toolName={invocation.toolName}
                  result={result}
                  isStreaming={false}
                  streamProgress={100}
                  onAction={handleToolAction}
                />
              );
            })}
        </div>
      );
    }
    
    // Single tool or multiple independent tools
    return (
      <div className="mt-3 space-y-3">
        {message.toolInvocations.map((invocation, idx) => {
          const isStreaming = invocation.state === 'partial-call';
          const isComplete = invocation.state === 'result';
          const result = isComplete ? (invocation as any).result : null;
          
          console.log(`[MessageList] Tool ${idx}:`, {
            toolName: invocation.toolName,
            state: invocation.state,
            result: result
          });
          
          return (
            <div key={`${message.id}-tool-${idx}`} className="space-y-2">
              {/* Show tool invocation */}
              {!isComplete && (
                <ToolInvocationDisplay
                  toolName={invocation.toolName}
                  state={isStreaming ? 'running' : 'pending'}
                />
              )}
              
              {/* Show tool result when complete */}
              {isComplete && (
                <ToolResultRenderer
                  toolName={invocation.toolName}
                  result={result}
                  isStreaming={false}
                  streamProgress={100}
                  onAction={handleToolAction}
                />
              )}
              
              {/* Show streaming progress if available */}
              {isStreaming && invocation.args && (
                <ToolResultRenderer
                  toolName={invocation.toolName}
                  result={invocation.args}
                  isStreaming={true}
                  streamProgress={50}
                  onAction={handleToolAction}
                />
              )}
            </div>
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
            {renderToolInvocations(message)}
            
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