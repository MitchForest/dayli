/**
 * TimeGridDay component - renders a full 24-hour day grid
 */

import React, { memo, useMemo } from 'react';
import { GridHour } from './GridHour';
import { useSimpleScheduleStore } from '../store/simpleScheduleStore';
import { HOUR_HEIGHT, CANVAS_COLORS } from '../constants/grid-constants';
import type { UserPreferencesTyped } from '@/modules/settings/types/preferences.types';
import { WorkBlock, MeetingBlock, EmailBlock, BreakBlock, BlockedTimeBlock } from './blocks';
import { useScheduleStore } from '../store/scheduleStore';
import { format, addDays } from 'date-fns';
import { calculateBlockLayout, getBlockLayoutStyle, type LayoutBlock } from '../utils/blockLayout';

// Simple helper to parse 24-hour time format (e.g., "08:00" -> { hour: 8, minute: 0 })
const parseTime = (timeStr: string) => {
  const [hourStr, minuteStr] = timeStr.split(':');
  return {
    hour: parseInt(hourStr || '0', 10),
    minute: parseInt(minuteStr || '0', 10)
  };
};

interface TimeGridDayProps {
  dayOffset: number; // Days from current date (-1, 0, 1)
  viewportWidth: number;
  preferences: UserPreferencesTyped | null;
}

export const TimeGridDay = ({ dayOffset, viewportWidth, preferences }: TimeGridDayProps) => {
  const currentDate = useSimpleScheduleStore(state => state.currentDate);
  
  // Calculate the actual date for this day
  const date = addDays(currentDate, dayOffset);
  const dateString = format(date, 'yyyy-MM-dd');
  
  // Subscribe to schedule changes for this specific date
  const schedule = useScheduleStore(state => state.schedules[dateString]);

  // Calculate work hours
  const { workStartHour, workEndHour } = useMemo(() => {
    if (!preferences) {
      return { workStartHour: 8, workEndHour: 18 };
    }
    
    const start = parseTime(preferences.work_start_time || '08:00');
    const end = parseTime(preferences.work_end_time || '18:00');
    
    return {
      workStartHour: start.hour,
      workEndHour: end.hour,
    };
  }, [preferences]);
  
  // Calculate layout for blocks to handle overlaps
  const layoutBlocks = useMemo(() => {
    const blocks = schedule?.timeBlocks || [];
    return calculateBlockLayout(blocks);
  }, [schedule?.timeBlocks]);
  
  // Helper to parse time string to hour position
  const getTimePosition = (timeStr: string) => {
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    return hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
  };
  
  // Helper to determine break type
  const getBreakType = (title: string): 'lunch' | 'coffee' | 'other' => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('lunch')) return 'lunch';
    if (lowerTitle.includes('coffee') || lowerTitle.includes('break')) return 'coffee';
    return 'other';
  };
  
  return (
    <div 
      className="relative bg-card h-full w-full"
    >
      {/* Hour blocks */}
      {Array.from({ length: 24 }, (_, hour) => (
        <GridHour
          key={hour}
          hour={hour}
          isWorkHour={hour >= workStartHour && hour < workEndHour}
          dayOffset={dayOffset}
        />
      ))}
      
      {/* Render actual time blocks from database with overlap handling */}
      {layoutBlocks.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {layoutBlocks.map((block: LayoutBlock) => {
            const top = getTimePosition(block.startTime);
            // Calculate duration from start and end times
            const startParts = block.startTime.split(':').map(Number);
            const endParts = block.endTime.split(':').map(Number);
            const startMinutes = (startParts[0] || 0) * 60 + (startParts[1] || 0);
            const endMinutes = (endParts[0] || 0) * 60 + (endParts[1] || 0);
            const duration = endMinutes - startMinutes;
            
            // Get layout styles for overlapping blocks
            const layoutStyles = getBlockLayoutStyle(block, viewportWidth - 48); // Subtract time label width
            
            const commonProps = {
              id: block.id,
              title: block.title,
              startTime: block.startTime,
              endTime: block.endTime,
              duration,
              className: "pointer-events-auto",
              style: { 
                top: `${top}px`,
                left: layoutStyles.left,
                width: layoutStyles.width,
                position: 'absolute' as const
              }
            };
            
            switch (block.type) {
              case 'work':
                return (
                  <WorkBlock
                    key={block.id}
                    {...commonProps}
                    tasks={block.tasks || []}
                  />
                );
              case 'meeting':
                return (
                  <MeetingBlock
                    key={block.id}
                    {...commonProps}
                    attendees={block.metadata?.attendeeCount ? [`${block.metadata.attendeeCount} attendees`] : []}
                    videoLink={block.metadata?.videoLink}
                    location={block.metadata?.location}
                  />
                );
              case 'email':
                return (
                  <EmailBlock
                    key={block.id}
                    {...commonProps}
                    blockId={block.id}
                    onComplete={() => {}}
                  />
                );
              case 'break':
                return (
                  <BreakBlock
                    key={block.id}
                    {...commonProps}
                    type={block.metadata?.breakType === 'lunch' ? 'lunch' : 
                          block.metadata?.breakType === 'coffee' ? 'coffee' : 'break'}
                  />
                );
              case 'blocked':
                return (
                  <BlockedTimeBlock
                    key={block.id}
                    {...commonProps}
                    reason={block.metadata?.reason}
                  />
                );
              default:
                return null;
            }
          })}
        </div>
      )}
    </div>
  );
}; 