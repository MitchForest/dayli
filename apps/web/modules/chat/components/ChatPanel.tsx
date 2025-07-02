'use client';

import { useChat } from 'ai/react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SelectionToolbar, useTextSelection } from './SelectionToolbar';
import { SuggestionButtons, useContextualSuggestions } from './SuggestionButtons';
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore';
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
    onError: (error) => {
      console.error('Chat error:', error);
    },
    onFinish: (message) => {
      // Check if any schedule-related tools were executed
      const scheduleTools = [
        'schedule_createTimeBlock',
        'schedule_moveTimeBlock', 
        'schedule_deleteTimeBlock',
        'schedule_assignTaskToBlock',
        'schedule_completeTask',
        'task_createTask',
        'task_editTask',
        'task_deleteTask'
      ];
      
      console.log('[ChatPanel] Message finished, tool invocations:', message.toolInvocations);
      
      if (message.toolInvocations?.some(inv => scheduleTools.includes(inv.toolName))) {
        // Invalidate today's schedule to force a refresh
        const today = format(new Date(), 'yyyy-MM-dd');
        console.log('[ChatPanel] Invalidating schedule for:', today);
        invalidateSchedule(today);
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
    chatState.setInput(suggestion);
    setShowCommands(false);
    // Submit immediately
    chatState.handleSubmit(new Event('submit') as any);
  }, [chatState]);

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