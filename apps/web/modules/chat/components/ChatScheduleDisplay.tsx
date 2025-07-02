'use client';

import { cn } from '@/lib/utils';
import { ChatScheduleBlock } from './ChatScheduleBlock';
import type { TimeBlock } from '@/modules/schedule/types/schedule.types';
import { Calendar, Sunrise, Sun, Moon } from 'lucide-react';

interface ChatScheduleDisplayProps {
  blocks: TimeBlock[];
  showTimeline?: boolean;
  groupByPeriod?: boolean;
  compact?: boolean;
  className?: string;
}

// Helper function to parse time to minutes for proper sorting
function parseTimeToMinutes(timeStr: string): number {
  // Handle various time formats: "2:30 PM", "14:30", "2:30PM", etc.
  const cleanTime = timeStr.trim().toUpperCase();
  
  // Extract time components
  const timeMatch = cleanTime.match(/(\d{1,2}):?(\d{0,2})\s*(AM|PM)?/);
  if (!timeMatch || !timeMatch[1]) return 0;
  
  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2] || '0', 10);
  const period = timeMatch[3];
  
  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
}

// Group blocks by time period
function groupBlocksByPeriod(blocks: TimeBlock[]) {
  const morning: TimeBlock[] = [];
  const afternoon: TimeBlock[] = [];
  const evening: TimeBlock[] = [];
  
  blocks.forEach(block => {
    const startMinutes = parseTimeToMinutes(block.startTime);
    const hours = Math.floor(startMinutes / 60);
    
    if (hours < 12) {
      morning.push(block);
    } else if (hours < 17) {
      afternoon.push(block);
    } else {
      evening.push(block);
    }
  });
  
  return { morning, afternoon, evening };
}

export function ChatScheduleDisplay({
  blocks,
  showTimeline = false,
  groupByPeriod = true,
  compact = false,
  className
}: ChatScheduleDisplayProps) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className={cn('text-center py-4 text-muted-foreground', className)}>
        No schedule blocks to display
      </div>
    );
  }
  
  // Sort blocks by start time
  const sortedBlocks = [...blocks].sort((a, b) => {
    const timeA = parseTimeToMinutes(a.startTime);
    const timeB = parseTimeToMinutes(b.startTime);
    return timeA - timeB;
  });
  
  // Group by period if requested
  if (groupByPeriod) {
    const { morning, afternoon, evening } = groupBlocksByPeriod(sortedBlocks);
    
    return (
      <div className={cn('space-y-4', className)}>
        {/* Header */}
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Today's Schedule</span>
        </div>
        
        {/* Morning blocks */}
        {morning.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sunrise className="w-3 h-3" />
              <span>Morning</span>
            </div>
            <div className="space-y-2 pl-5">
              {morning.map((block) => (
                <ChatScheduleBlock
                  key={block.id}
                  block={block}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Afternoon blocks */}
        {afternoon.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sun className="w-3 h-3" />
              <span>Afternoon</span>
            </div>
            <div className="space-y-2 pl-5">
              {afternoon.map((block) => (
                <ChatScheduleBlock
                  key={block.id}
                  block={block}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Evening blocks */}
        {evening.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Moon className="w-3 h-3" />
              <span>Evening</span>
            </div>
            <div className="space-y-2 pl-5">
              {evening.map((block) => (
                <ChatScheduleBlock
                  key={block.id}
                  block={block}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Simple list without grouping
  return (
    <div className={cn('space-y-2', className)}>
      {showTimeline && (
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <Calendar className="w-4 h-4" />
          <span>Schedule</span>
        </div>
      )}
      {sortedBlocks.map((block) => (
        <ChatScheduleBlock
          key={block.id}
          block={block}
          compact={compact}
        />
      ))}
    </div>
  );
}

export default ChatScheduleDisplay; 