'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Command, Calendar, X, Briefcase, Users, Mail, Coffee, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '../store/chatStore';
import { useSimpleScheduleStore } from '@/modules/schedule/store/simpleScheduleStore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { UseChatHelpers } from 'ai/react';

interface ChatInputProps extends UseChatHelpers {
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

interface BlockContext {
  type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
  title: string;
  startTime: string;
  endTime: string;
  raw: string;
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
  const [blockContext, setBlockContext] = useState<BlockContext | null>(null);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const { commandHistory, addToHistory } = useChatStore();
  const currentDate = useSimpleScheduleStore(state => state.currentDate);
  
  // Parse block context from command history
  useEffect(() => {
    const latestCommand = commandHistory[0];
    if (!latestCommand) return;
    
    // Check if it's a block context command
    const workMatch = latestCommand.match(/^Work on "(.+)" from (\d+:\d+) to (\d+:\d+)$/);
    const meetingMatch = latestCommand.match(/^Meeting "(.+)" from (\d+:\d+) to (\d+:\d+)$/);
    const emailMatch = latestCommand.match(/^Email block "(.+)" from (\d+:\d+) to (\d+:\d+)$/);
    const breakMatch = latestCommand.match(/^Break "(.+)" from (\d+:\d+) to (\d+:\d+)$/);
    const blockedMatch = latestCommand.match(/^Blocked time "(.+)" from (\d+:\d+) to (\d+:\d+)$/);
    
    if (workMatch && workMatch[1] && workMatch[2] && workMatch[3]) {
      setBlockContext({
        type: 'work',
        title: workMatch[1],
        startTime: workMatch[2],
        endTime: workMatch[3],
        raw: latestCommand
      });
      inputRef.current?.focus();
    } else if (meetingMatch && meetingMatch[1] && meetingMatch[2] && meetingMatch[3]) {
      setBlockContext({
        type: 'meeting',
        title: meetingMatch[1],
        startTime: meetingMatch[2],
        endTime: meetingMatch[3],
        raw: latestCommand
      });
      inputRef.current?.focus();
    } else if (emailMatch && emailMatch[1] && emailMatch[2] && emailMatch[3]) {
      setBlockContext({
        type: 'email',
        title: emailMatch[1],
        startTime: emailMatch[2],
        endTime: emailMatch[3],
        raw: latestCommand
      });
      inputRef.current?.focus();
    } else if (breakMatch && breakMatch[1] && breakMatch[2] && breakMatch[3]) {
      setBlockContext({
        type: 'break',
        title: breakMatch[1],
        startTime: breakMatch[2],
        endTime: breakMatch[3],
        raw: latestCommand
      });
      inputRef.current?.focus();
    } else if (blockedMatch && blockedMatch[1] && blockedMatch[2] && blockedMatch[3]) {
      setBlockContext({
        type: 'blocked',
        title: blockedMatch[1],
        startTime: blockedMatch[2],
        endTime: blockedMatch[3],
        raw: latestCommand
      });
      inputRef.current?.focus();
    }
  }, [commandHistory, inputRef]);

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

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedInput = input.trim();
    if (!trimmedInput && !blockContext) return;

    console.log('[ChatInput] Submitting with:', { 
      input: trimmedInput, 
      blockContext,
      hasBlockContext: !!blockContext 
    });

    // If we have block context, prepend it to the message
    let finalMessage = trimmedInput;
    if (blockContext && trimmedInput) {
      finalMessage = `${blockContext.raw}\n\n${trimmedInput}`;
    } else if (blockContext && !trimmedInput) {
      finalMessage = blockContext.raw;
    }
    
    console.log('[ChatInput] Final message:', finalMessage);

    // Add to history (without the block context prefix)
    if (trimmedInput) {
      addToHistory(trimmedInput);
    }
    setHistoryIndex(-1);

    // Clear block context
    setBlockContext(null);

    // Update the input with the final message and submit
    // We need to update the input state before submitting
    await new Promise<void>((resolve) => {
      handleInputChange({ target: { value: finalMessage } } as any);
      // Use setTimeout to ensure state update completes
      setTimeout(() => resolve(), 0);
    });

    // Now submit with the updated input
    handleSubmit(e);
  }, [input, blockContext, addToHistory, handleSubmit, handleInputChange]);

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

  const getBlockIcon = (type: BlockContext['type']) => {
    switch (type) {
      case 'work': return <Briefcase className="h-3 w-3" />;
      case 'meeting': return <Users className="h-3 w-3" />;
      case 'email': return <Mail className="h-3 w-3" />;
      case 'break': return <Coffee className="h-3 w-3" />;
      case 'blocked': return <Ban className="h-3 w-3" />;
    }
  };

  const getBlockColor = (type: BlockContext['type']) => {
    switch (type) {
      case 'work': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      case 'meeting': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800';
      case 'email': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
      case 'break': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800';
      case 'blocked': return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-950/50 dark:text-gray-300 dark:border-gray-800';
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>Ask me anything. Type /commands for help.</span>
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3" />
          <span>Viewing: {format(currentDate, 'MMM d, yyyy')}</span>
        </div>
      </div>
      
      {showCommandHint && (
        <div className="mb-2 p-2 bg-muted/50 rounded-md text-xs flex items-center gap-2 animate-in fade-in-0 slide-in-from-bottom-2">
          <Command className="h-3 w-3" />
          <span>Type <code className="px-1 py-0.5 bg-background rounded">commands</code> to see all available commands</span>
        </div>
      )}
      
      {blockContext && (
        <div className={cn(
          "mb-2 px-3 py-2 rounded-md border text-xs flex items-center justify-between animate-in fade-in-0 slide-in-from-bottom-2",
          getBlockColor(blockContext.type)
        )}>
          <div className="flex items-center gap-2">
            {getBlockIcon(blockContext.type)}
            <span className="font-medium">{blockContext.title}</span>
            <span className="opacity-70">{blockContext.startTime} - {blockContext.endTime}</span>
          </div>
          <button
            onClick={() => setBlockContext(null)}
            className="hover:opacity-70 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      
      <form onSubmit={onSubmit} className="chat-input-form flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={blockContext ? "Ask about this block..." : "Ask me anything..."}
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
        <Button type="submit" size="icon" disabled={(!input.trim() && !blockContext) || isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
} 