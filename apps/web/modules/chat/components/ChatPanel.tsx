'use client';

import { useChat } from 'ai/react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore';
import { format } from 'date-fns';
import { isTauri } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';
import { useEffect } from 'react';

export function ChatPanel() {
  const invalidateSchedule = useScheduleStore(state => state.invalidateSchedule);
  
  // Custom fetch function for desktop app
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    
    // If running in Tauri, add the auth token from localStorage
    if (isTauri()) {
      const supabase = createClient();
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
        'createTimeBlock',
        'moveTimeBlock', 
        'deleteTimeBlock',
        'assignTaskToBlock',
        'completeTask'
      ];
      
      if (message.toolInvocations?.some(inv => scheduleTools.includes(inv.toolName))) {
        // Invalidate today's schedule to force a refresh
        const today = format(new Date(), 'yyyy-MM-dd');
        invalidateSchedule(today);
      }
    },
  });

  // The reload function clears messages and resets the chat
  const handleClear = () => {
    chatState.reload();
  };

  // Add error display
  useEffect(() => {
    if (chatState.error) {
      console.error('Chat error details:', chatState.error);
    }
  }, [chatState.error]);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <ChatHeader onClear={handleClear} />
      <MessageList messages={chatState.messages} isLoading={chatState.isLoading} />
      {chatState.error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <p className="font-semibold">Error:</p>
          <p>{chatState.error.message || 'An error occurred'}</p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(chatState.error, null, 2)}</pre>
          )}
        </div>
      )}
      <ChatInput {...chatState} />
    </div>
  );
} 