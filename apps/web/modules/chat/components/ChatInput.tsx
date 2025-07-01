'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '../store/chatStore';
import { cn } from '@/lib/utils';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { addMessage, setLoading, commandHistory, addToHistory } = useChatStore();

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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Add to history
    addToHistory(trimmedInput);
    
    // Add user message
    addMessage({
      content: trimmedInput,
      role: 'user',
    });

    // Clear input and reset history index
    setInput('');
    setHistoryIndex(-1);

    // Check for /commands
    if (trimmedInput === '/commands') {
      setTimeout(() => {
        addMessage({
          content: '📋 Available Commands:',
          role: 'assistant',
        });
      }, 300);
      return;
    }

    // Mock responses
    setLoading(true);
    setTimeout(() => {
      let response = '';
      
      if (trimmedInput.toLowerCase().includes('plan my day')) {
        response = "I'll analyze your calendar and create the perfect schedule...";
      } else if (trimmedInput.toLowerCase().includes('email')) {
        response = "I'll help you triage your emails. You have 42 unread messages. Let me categorize them by importance...";
      } else if (trimmedInput.toLowerCase().includes('schedule')) {
        response = "✅ Task scheduled successfully!";
      } else if (trimmedInput.toLowerCase().includes('what\'s next')) {
        response = "Your next task is 'Review Q1 strategy deck' scheduled for 2:00 PM. You have 45 minutes of focus time before your team standup.";
      } else {
        response = `I understand you want to ${trimmedInput.toLowerCase()}. This feature will be available in Sprint 3.`;
      }
      
      addMessage({
        content: response,
        role: 'assistant',
      });
      setLoading(false);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp' && input === '') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex] || '');
      }
    } else if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div className="text-xs text-muted-foreground mb-2">
        Type /commands to see list of available commands
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          className={cn(
            "flex-1 resize-none rounded-md border border-input bg-background px-3 py-2",
            "text-sm placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[40px] max-h-[120px]"
          )}
          rows={1}
        />
        <Button type="submit" size="icon" disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
} 