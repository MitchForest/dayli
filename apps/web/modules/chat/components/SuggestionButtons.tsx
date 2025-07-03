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
      "Plan my day",
      "What should I work on?",
      "Process my emails",
      "Show my schedule"
    ];
  }

  const lower = lastMessage.toLowerCase();

  // Workflow-related suggestions (proposals)
  if (lower.includes('proposal') || lower.includes('review') || lower.includes('approve')) {
    return [
      "Approve this proposal",
      "I'd like to modify it",
      "Cancel the proposal",
      "Show me the details again"
    ];
  }

  // Schedule-related suggestions
  if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('block')) {
    return [
      "Find gaps in my schedule",
      "Analyze my schedule efficiency",
      "Create a work block",
      "Move a time block",
      "What's next?"
    ];
  }

  // Task-related suggestions
  if (lower.includes('task') || lower.includes('todo') || lower.includes('work on')) {
    return [
      "Show task scores",
      "What can I do in 30 minutes?",
      "Fill my work block",
      "Create a new task",
      "Show completed tasks"
    ];
  }

  // Email-related suggestions
  if (lower.includes('email') || lower.includes('inbox') || lower.includes('message')) {
    return [
      "Show email backlog",
      "Categorize my emails",
      "Group emails by sender",
      "Process urgent emails",
      "Archive old emails"
    ];
  }

  // Meeting-related suggestions
  if (lower.includes('meeting') || lower.includes('call')) {
    return [
      "Schedule a meeting",
      "Find meeting times",
      "Reschedule meeting",
      "Add prep time",
      "Show today's meetings"
    ];
  }

  // Analysis/insights suggestions
  if (lower.includes('analyze') || lower.includes('efficiency') || lower.includes('pattern')) {
    return [
      "Show my work patterns",
      "Analyze schedule utilization",
      "View workflow history",
      "Show productivity insights"
    ];
  }

  // Time-specific suggestions based on context
  const hour = new Date().getHours();
  if (hour < 10) {
    return [
      "Plan my day",
      "What's my first task?",
      "Show morning schedule",
      "Find focus time"
    ];
  } else if (hour < 14) {
    return [
      "What should I work on?",
      "Fill my work block",
      "Schedule lunch break",
      "Show afternoon tasks"
    ];
  } else if (hour < 17) {
    return [
      "Process emails",
      "Review today's progress",
      "Plan tomorrow",
      "Find remaining gaps"
    ];
  } else {
    return [
      "Plan tomorrow",
      "Review today",
      "Process email backlog",
      "Set priorities"
    ];
  }
}

export default SuggestionButtons; 