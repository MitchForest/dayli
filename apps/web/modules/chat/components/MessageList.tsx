'use client';

import { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '../store/chatStore';
import { CommandListMessage } from './CommandListMessage';

export function MessageList() {
  const { messages, isLoading } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Add welcome message if no messages
  const displayMessages = messages.length === 0 
    ? [{
        id: 'welcome',
        role: 'assistant' as const,
        content: "Good morning! I'm ready to help you plan your day. You can ask me to schedule tasks, triage emails, or optimize your calendar.\n\nType /commands to see available commands.",
        timestamp: new Date(),
      }]
    : messages;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {displayMessages.map((message) => {
        // Special handling for command list
        if (message.content.includes('📋 Available Commands:')) {
          return <CommandListMessage key={message.id} />;
        }

        return (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' && 'flex-row-reverse'
            )}
          >
            <div className={cn(
              'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full',
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted'
            )}>
              {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={cn(
              'flex-1 space-y-2 overflow-hidden',
              message.role === 'user' && 'flex items-end flex-col'
            )}>
              <div className={cn(
                'inline-block p-3 rounded-lg',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground max-w-[80%]'
                  : 'bg-muted max-w-[85%]'
              )}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          </div>
        );
      })}
      
      {isLoading && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted">
            <Bot size={16} />
          </div>
          <div className="flex-1 space-y-2 overflow-hidden">
            <div className="bg-muted inline-block p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 