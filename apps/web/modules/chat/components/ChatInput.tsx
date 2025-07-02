'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '../store/chatStore';
import { cn } from '@/lib/utils';
import type { UseChatHelpers } from 'ai/react';

interface ChatInputProps extends UseChatHelpers {
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatInput({ 
  input, 
  handleInputChange, 
  handleSubmit, 
  isLoading,
  inputRef: externalInputRef
}: ChatInputProps) {
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCommandHint, setShowCommandHint] = useState(false);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const { commandHistory, addToHistory } = useChatStore();

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
  }, [inputRef]);

  // Watch for / to show command hint
  useEffect(() => {
    setShowCommandHint(input === '/');
  }, [input]);

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
        Ask me anything. Type /commands for help.
      </div>
      
      {showCommandHint && (
        <div className="mb-2 p-2 bg-muted/50 rounded-md text-xs flex items-center gap-2 animate-in fade-in-0 slide-in-from-bottom-2">
          <Command className="h-3 w-3" />
          <span>Type <code className="px-1 py-0.5 bg-background rounded">commands</code> to see all available commands</span>
        </div>
      )}
      
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