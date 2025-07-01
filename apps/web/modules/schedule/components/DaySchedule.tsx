import React from 'react';
import { cn } from '@/lib/utils';
import { useScheduleStore } from '@/stores';
import { TimeLabel } from './TimeLabel';
import { FocusBlock } from './FocusBlock';
import { MeetingBlock } from './MeetingBlock';
import { EmailBlock } from './EmailBlock';
import { BreakBlock } from './BreakBlock';
import { QuickDecisionsBlock } from './QuickDecisionsBlock';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { DailyStats } from './DailyStats';
import { generateHourLabels, getTimeGridPosition } from '../utils/timeGrid';
import type { TimeBlock } from '../types/schedule.types';
import { Skeleton } from '@/components/ui/skeleton';

interface DayScheduleProps {
  className?: string;
}

function DayScheduleSkeleton({ className }: { className?: string }) {
  const hourLabels = generateHourLabels();
  return (
    <div className={cn("relative", className)}>
      {/* Skeleton for stats */}
      <Skeleton className="h-32 mb-6" />
      
      <div 
        className="grid gap-0 relative"
        style={{
          gridTemplateColumns: '80px 1fr',
          gridTemplateRows: 'repeat(40, 20px)',
        }}
      >
        <div className="col-start-1 row-span-full">
          {hourLabels.map((label, index) => (
            <TimeLabel
              key={label}
              hour={index + 8}
            />
          ))}
        </div>
        <div className="col-start-2 row-span-full relative">
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 11 }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-border/50"
                style={{ top: `${i * 80}px` }}
              />
            ))}
          </div>
          {/* Mock blocks */}
          <Skeleton className="absolute w-[calc(100%-1rem)] ml-2 h-24" style={{ top: '80px' }} />
          <Skeleton className="absolute w-[calc(100%-1rem)] ml-2 h-16" style={{ top: '240px' }} />
          <Skeleton className="absolute w-[calc(100%-1rem)] ml-2 h-40" style={{ top: '360px' }} />
        </div>
      </div>
    </div>
  );
}

export function DaySchedule({ className }: DayScheduleProps) {
  const { schedule, toggleTaskComplete } = useScheduleStore();
  const hourLabels = generateHourLabels();
  
  if (!schedule) {
    return <DayScheduleSkeleton className={className} />;
  }
  
  const renderTimeBlock = (block: TimeBlock, index: number) => {
    const gridPosition = getTimeGridPosition(block.startTime, block.endTime);
    const key = block.id;
    
    // Applying animation delay here
    const animationStyle = {
      animation: `fade-in-slide-up 0.5s ease-out forwards`,
      animationDelay: `${index * 50}ms`,
      opacity: 0, // Start with opacity 0 for the animation
    };

    switch (block.type) {
      case 'focus':
        return (
          <FocusBlock
            key={key}
            block={block}
            gridPosition={gridPosition}
            onTaskToggle={toggleTaskComplete}
            style={animationStyle}
          />
        );
      case 'meeting':
        return (
          <MeetingBlock
            key={key}
            block={block}
            gridPosition={gridPosition}
            style={animationStyle}
          />
        );
      case 'email':
        return (
          <EmailBlock
            key={key}
            block={block}
            gridPosition={gridPosition}
            style={animationStyle}
          />
        );
      case 'break':
        return (
          <BreakBlock
            key={key}
            block={block}
            gridPosition={gridPosition}
            style={animationStyle}
          />
        );
      case 'quick-decisions':
        return (
          <QuickDecisionsBlock
            key={key}
            block={block}
            gridPosition={gridPosition}
            style={animationStyle}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <div className={cn("relative", className)}>
      {/* Daily Stats */}
      <DailyStats schedule={schedule} />
      
      {/* Schedule Grid */}
      <div 
        className="grid gap-0 relative"
        style={{
          gridTemplateColumns: '80px 1fr',
          gridTemplateRows: 'repeat(40, 20px)', // 10 hours * 4 quarters = 40 rows
        }}
      >
        {/* Time Labels Column */}
        <div className="col-start-1 row-span-full">
          {hourLabels.map((label, index) => (
            <TimeLabel
              key={label}
              hour={index + 8}
            />
          ))}
        </div>
        
        {/* Time Blocks Column */}
        <div className="col-start-2 row-span-full relative">
          {/* Grid lines for visual reference */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 11 }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-border/50"
                style={{ top: `${i * 80}px` }}
              />
            ))}
          </div>
          
          {/* Time blocks */}
          {schedule.timeBlocks.map(renderTimeBlock)}
          
          {/* Current time indicator */}
          <CurrentTimeIndicator />
        </div>
      </div>
      
      {/* Daily Summary */}
      <div className="mt-6 p-4 bg-card rounded-lg border border-border">
        <h3 className="text-sm font-medium mb-2">Today's Summary</h3>
        <div className="flex gap-6 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">{schedule.dailyTasks.length}</span> tasks scheduled
          </div>
          <div>
            <span className="font-medium">{schedule.stats.tasksCompleted}</span> completed
          </div>
          <div>
            <span className="font-medium">{Math.round(schedule.stats.focusMinutes / 60)}h</span> focus time
          </div>
          <div>
            <span className="font-medium">{schedule.stats.emailsProcessed}</span> emails processed
          </div>
        </div>
      </div>
    </div>
  );
} 