'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useCallback, useRef, useEffect, useState } from 'react';

interface SuggestionButtonsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
  isLoading?: boolean;
}

export function SuggestionButtons({ 
  suggestions, 
  onSelect, 
  className,
  isLoading = false 
}: SuggestionButtonsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  // Check if we need scroll indicator
  useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollWidth, clientWidth } = scrollContainerRef.current;
        setShowScrollIndicator(scrollWidth > clientWidth);
      }
    };

    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [suggestions]);

  const handleClick = useCallback((suggestion: string) => {
    if (!isLoading) {
      onSelect(suggestion);
    }
  }, [isLoading, onSelect]);

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Suggested actions</span>
      </div>
      
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className={cn(
            'flex gap-2 overflow-x-auto scrollbar-none',
            'pb-1' // Space for scrollbar on systems that show it
          )}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          } as React.CSSProperties}
        >
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleClick(suggestion)}
              disabled={isLoading}
              className={cn(
                'flex-shrink-0 text-xs transition-all',
                'hover:shadow-sm hover:border-primary/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {suggestion}
            </Button>
          ))}
        </div>
        
        {showScrollIndicator && (
          <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none flex items-center justify-end">
            <ArrowRight className="h-3 w-3 text-muted-foreground animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

// Context-aware suggestion generator
export function useContextualSuggestions(
  lastMessage?: string,
  toolResults?: any[]
): string[] {
  if (!lastMessage) {
    return [
      "What should I focus on today?",
      "Show my schedule",
      "Any urgent emails?",
      "Plan my day"
    ];
  }

  const lower = lastMessage.toLowerCase();

  // Schedule-related suggestions
  if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('block')) {
    return [
      "Show my schedule",
      "What's next?",
      "Find free time",
      "Add a work block",
      "Clear my afternoon"
    ];
  }

  // Email-related suggestions
  if (lower.includes('email') || lower.includes('message')) {
    return [
      "Show urgent emails",
      "Process email backlog",
      "Draft a response",
      "Archive newsletters",
      "Create email block"
    ];
  }

  // Task-related suggestions
  if (lower.includes('task') || lower.includes('todo')) {
    return [
      "Show all tasks",
      "What's most important?",
      "Create a task",
      "Show completed tasks",
      "Add tasks to schedule"
    ];
  }

  // Meeting-related suggestions
  if (lower.includes('meeting') || lower.includes('call')) {
    return [
      "Schedule a meeting",
      "Find meeting times",
      "Show today's meetings",
      "Add prep time",
      "Reschedule meeting"
    ];
  }

  // Time-specific suggestions
  const hour = new Date().getHours();
  if (hour < 10) {
    return [
      "Plan my day",
      "What's my first task?",
      "Show morning routine",
      "Review priorities"
    ];
  } else if (hour < 14) {
    return [
      "What's next?",
      "Schedule lunch break",
      "Show afternoon tasks",
      "Find focus time"
    ];
  } else if (hour < 17) {
    return [
      "Review progress",
      "Clear urgent items",
      "Plan tomorrow",
      "Wrap up tasks"
    ];
  } else {
    return [
      "Plan tomorrow",
      "Review today",
      "Clear inbox",
      "Set priorities"
    ];
  }
}

export default SuggestionButtons; 