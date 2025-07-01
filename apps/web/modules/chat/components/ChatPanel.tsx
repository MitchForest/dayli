'use client';

import { useChatStore } from '../store/chatStore';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export function ChatPanel() {
  return (
    <div className="h-full flex flex-col bg-card relative">
      <ChatHeader />
      <MessageList />
      <ChatInput />
    </div>
  );
} 