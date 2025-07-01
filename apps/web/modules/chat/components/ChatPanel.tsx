'use client';

import { useChat } from 'ai/react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore';
import { format } from 'date-fns';

export function ChatPanel() {
  const invalidateSchedule = useScheduleStore(state => state.invalidateSchedule);
  
  // Use AI SDK's useChat hook at the top level
  const chatState = useChat({
    api: '/api/chat',
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

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <ChatHeader onClear={handleClear} />
      <MessageList messages={chatState.messages} isLoading={chatState.isLoading} />
      <ChatInput {...chatState} />
    </div>
  );
} 