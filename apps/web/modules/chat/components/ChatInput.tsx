'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '../store/chatStore';
import { cn } from '@/lib/utils';
import { useChat } from 'ai/react';

export function ChatInput() {
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { commandHistory, addToHistory } = useChatStore();
  
  // Use AI SDK's useChat hook
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Focus input on mount and when pressing Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update store when messages change
  useEffect(() => {
    const store = useChatStore.getState();
    // Clear existing messages and add new ones
    store.clearMessages();
    messages.forEach(msg => {
      store.addMessage({
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        toolInvocations: msg.toolInvocations as any,
      });
    });
    store.setLoading(isLoading);
  }, [messages, isLoading]);

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Add to history
    addToHistory(trimmedInput);
    setHistoryIndex(-1);

    // Submit using AI SDK
    handleSubmit(e);
  }, [input, addToHistory, handleSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as any);
    } else if (e.key === 'ArrowUp' && input === '') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        const historicCommand = commandHistory[newIndex] || '';
        // Update input using AI SDK's handler
        handleInputChange({ target: { value: historicCommand } } as any);
      }
    } else if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const historicCommand = commandHistory[newIndex] || '';
        handleInputChange({ target: { value: historicCommand } } as any);
      } else {
        setHistoryIndex(-1);
        handleInputChange({ target: { value: '' } } as any);
      }
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div className="text-xs text-muted-foreground mb-2">
        Type /commands to see list of available commands
      </div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          disabled={isLoading}
          className={cn(
            "flex-1 resize-none rounded-md border border-input bg-background px-3 py-2",
            "text-sm placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[40px] max-h-[120px]"
          )}
          rows={1}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
} 