'use client';

import { useChat } from 'ai/react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SelectionToolbar, useTextSelection } from './SelectionToolbar';
import { SuggestionButtons, useContextualSuggestions } from './SuggestionButtons';
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore';
import { useSimpleScheduleStore } from '@/modules/schedule/store/simpleScheduleStore';
import { format } from 'date-fns';
import { isTauri } from '@/lib/utils';
import { useAuth } from '@repo/auth/hooks';
import { useEffect, useCallback, useRef, useState } from 'react';
import type { Entity } from '../types/chat.types';

export function ChatPanel() {
  const invalidateSchedule = useScheduleStore(state => state.invalidateSchedule);
  const { supabase } = useAuth();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showCommands, setShowCommands] = useState(false);
  
  // Get the current viewing date from the schedule store
  const currentViewingDate = useSimpleScheduleStore(state => state.currentDate);
  
  // Text selection handling
  const { selectedText, clearSelection } = useTextSelection();
  
  // Custom fetch function for desktop app
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    
    // If running in Tauri, add the auth token from localStorage
    if (isTauri()) {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }
    }
    
    return fetch(input, {
      ...init,
      headers,
    });
  };
  
  // Use AI SDK's useChat hook at the top level
  const chatState = useChat({
    api: '/api/chat',
    fetch: customFetch,
    body: {
      viewingDate: format(currentViewingDate, 'yyyy-MM-dd'),
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
    onFinish: (message) => {
      // Check if any schedule-related tools were executed
      const scheduleTools = [
        'schedule_createTimeBlock',
        'schedule_moveTimeBlock', 
        'schedule_deleteTimeBlock',
        'schedule_batchCreateBlocks',
        'schedule_assignTaskToBlock',
        'schedule_completeTask',
        'task_createTask',
        'task_editTask',
        'task_deleteTask',
        'workflow_schedule',
        'workflow_fillWorkBlock',
        'workflow_fillEmailBlock'
      ];
      
      console.log('[ChatPanel] Message finished, tool invocations:', message.toolInvocations);
      
      // Check if any schedule-modifying tools were executed
      const scheduleModified = message.toolInvocations?.some(inv => {
        // Check if it's a schedule-related tool
        if (scheduleTools.includes(inv.toolName)) {
          return true;
        }
        
        // For workflows, check if they completed successfully
        if (inv.toolName.startsWith('workflow_') && inv.state === 'result') {
          const result = (inv as any).result;
          // Check if it's a completed workflow that modified the schedule
          if (result?.phase === 'completed' && result?.success) {
            return true;
          }
        }
        
        return false;
      });
      
      if (scheduleModified) {
        // Find the date that was modified
        let dateToInvalidate: string | null = null;
        
        // Check tool invocations for date parameters
        message.toolInvocations?.forEach(inv => {
          if (inv.args && typeof inv.args === 'object') {
            const args = inv.args as Record<string, any>;
            if (args.date) {
              dateToInvalidate = args.date;
            }
          }
          
          // For completed workflows, check the result for the date
          if (inv.state === 'result' && (inv as any).result?.date) {
            dateToInvalidate = (inv as any).result.date;
          }
        });
        
        if (dateToInvalidate) {
          console.log('[ChatPanel] Invalidating schedule for date:', dateToInvalidate);
          invalidateSchedule(dateToInvalidate);
        } else {
          // Fallback to invalidating current viewing date
          const viewingDateStr = format(currentViewingDate, 'yyyy-MM-dd');
          console.log('[ChatPanel] No specific date found, invalidating viewing date:', viewingDateStr);
          invalidateSchedule(viewingDateStr);
        }
      }
    },
  });

  // The reload function clears messages and resets the chat
  const handleClear = () => {
    chatState.reload();
    setShowCommands(false);
  };

  // Add error display
  useEffect(() => {
    if (chatState.error) {
      console.error('Chat error details:', chatState.error);
    }
  }, [chatState.error]);

  // Handle entity clicks - insert into chat input
  const handleEntityClick = useCallback((entity: Entity) => {
    // Update the input value with the entity value
    const currentValue = chatState.input;
    const newValue = currentValue ? `${currentValue} ${entity.value}` : entity.value;
    chatState.setInput(newValue);
    
    // Focus the input
    if (inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      inputRef.current.setSelectionRange(
        inputRef.current.value.length, 
        inputRef.current.value.length
      );
    }
  }, [chatState]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    console.log('[ChatPanel] Suggestion selected:', suggestion);
    chatState.setInput(suggestion);
    setShowCommands(false);
    
    // Submit immediately - trigger the form submit event on the actual form
    // This ensures ChatInput's onSubmit handler runs, which includes block context
    setTimeout(() => {
      console.log('[ChatPanel] Looking for chat input form...');
      // Find the form inside the chat input area
      const chatForm = document.querySelector('.chat-input-form');
      if (chatForm) {
        console.log('[ChatPanel] Found chat input form, dispatching submit event');
        // Create and dispatch a submit event
        const submitEvent = new Event('submit', { 
          bubbles: true, 
          cancelable: true 
        });
        chatForm.dispatchEvent(submitEvent);
      } else {
        console.log('[ChatPanel] Chat input form not found, trying fallback');
        // Fallback: try to find any form
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        } else {
          // Last resort: direct submit
          console.log('[ChatPanel] No form found, using direct submit');
          chatState.handleSubmit(new Event('submit', { bubbles: true, cancelable: true }) as any);
        }
      }
    }, 100); // Increased delay to ensure form is ready
  }, [chatState]);

  // Handle modify proposal event (just set input, don't submit)
  useEffect(() => {
    const handleModifyProposal = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.text) {
        chatState.setInput(customEvent.detail.text);
        // Focus the input
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    };

    window.addEventListener('modify_proposal', handleModifyProposal);
    return () => window.removeEventListener('modify_proposal', handleModifyProposal);
  }, [chatState, inputRef]);

  // Handle selection toolbar actions
  const handleCopy = useCallback(() => {
    // Just for tracking, actual copy is handled by the toolbar
    console.log('[ChatPanel] Text copied:', selectedText);
  }, [selectedText]);

  const handleCreateTask = useCallback(() => {
    const taskCommand = `Create task: ${selectedText}`;
    chatState.setInput(taskCommand);
    chatState.handleSubmit(new Event('submit') as any);
    clearSelection();
  }, [selectedText, chatState, clearSelection]);

  // Get contextual suggestions based on last message
  const lastMessage = chatState.messages[chatState.messages.length - 1];
  const suggestions = useContextualSuggestions(
    lastMessage?.role === 'assistant' ? lastMessage.content : undefined
  );

  // Watch for /commands input
  useEffect(() => {
    if (chatState.input.trim() === '/commands') {
      setShowCommands(true);
      // Clear the input after a small delay to ensure the state update happens
      setTimeout(() => {
        chatState.setInput('');
      }, 0);
    }
  }, [chatState.input, chatState.setInput]);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <ChatHeader onClear={handleClear} />
      
      {/* Selection toolbar */}
      {selectedText && (
        <SelectionToolbar
          selectedText={selectedText}
          onCopy={handleCopy}
          onCreateTask={handleCreateTask}
          onDismiss={clearSelection}
        />
      )}
      
      <MessageList 
        messages={chatState.messages} 
        isLoading={chatState.isLoading}
        onEntityClick={handleEntityClick}
        onSuggestionSelect={handleSuggestionSelect}
        showCommands={showCommands}
      />
      
      {chatState.error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <p className="font-semibold">Error:</p>
          <p>{chatState.error.message || 'An error occurred'}</p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(chatState.error, null, 2)}</pre>
          )}
        </div>
      )}
      
      {/* Contextual suggestions */}
      {!chatState.isLoading && suggestions.length > 0 && (
        <div className="px-4 py-2 border-t border-border">
          <SuggestionButtons
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
            isLoading={chatState.isLoading}
          />
        </div>
      )}
      
      <ChatInput {...chatState} inputRef={inputRef} />
    </div>
  );
} 