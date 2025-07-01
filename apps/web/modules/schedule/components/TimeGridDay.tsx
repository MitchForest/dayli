/**
 * TimeGridDay component - renders a full 24-hour day grid
 */

import React, { memo, useMemo } from 'react';
import { GridHour } from './GridHour';
import { useCanvasStore } from '../canvas/CanvasStore';
import { HOUR_HEIGHT, TIME_LABEL_WIDTH, DAY_SPACING, CANVAS_COLORS } from '../constants/grid-constants';
import { parseTime } from '../canvas/utils/date-utils';
import type { UserPreferencesTyped } from '@/modules/settings/types/preferences.types';
import type { DailySchedule } from '../types/schedule.types';
import { DeepWorkBlock, MeetingBlock, EmailTriageBlock, BreakBlock } from './blocks';
import { useScheduleStore } from '../store/scheduleStore';
import { format } from 'date-fns';

interface TimeGridDayProps {
  dayOffset: number; // Days from today
  viewportWidth: number;
  preferences: UserPreferencesTyped | null;
}

export const TimeGridDay = memo(({ dayOffset, viewportWidth, preferences }: TimeGridDayProps) => {
  const getSchedule = useScheduleStore(state => state.getSchedule);
  const referenceDate = useCanvasStore(state => state.referenceDate);

  const date = new Date(referenceDate);
  date.setDate(date.getDate() + dayOffset);
  const dateString = format(date, 'yyyy-MM-dd');
  const schedule = getSchedule(dateString);

  const viewport = useCanvasStore(state => state.viewport);
  
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
  
  // Position for this day with spacing
  const dayX = dayOffset * (viewportWidth + DAY_SPACING) + TIME_LABEL_WIDTH;
  
  const blocksToRender = schedule?.timeBlocks || [];
  
  // Helper to parse time string to hour position
  const getTimePosition = (timeStr: string) => {
    // Handle both "HH:MM" and "HH:MM:SS" formats
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const position = hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
    
    return position;
  };
  
  return (
    <div
      className="absolute top-0"
      style={{
        left: `${dayX}px`,
        width: `${viewportWidth - TIME_LABEL_WIDTH}px`,
        height: `${24 * HOUR_HEIGHT}px`,
      }}
    >
      <div 
        className="relative bg-card"
        style={{ 
          width: '100%',
          height: '100%',
          borderLeft: `1px solid ${CANVAS_COLORS.gridLineHour}`,
          borderRight: `1px solid ${CANVAS_COLORS.gridLineHour}`,
        }}
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
        
        {/* Render actual time blocks from database */}
        {blocksToRender.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {blocksToRender.map((block) => {
              const top = getTimePosition(block.startTime);
              // Calculate duration from start and end times
              const startParts = block.startTime.split(':').map(Number);
              const endParts = block.endTime.split(':').map(Number);
              const startMinutes = (startParts[0] || 0) * 60 + (startParts[1] || 0);
              const endMinutes = (endParts[0] || 0) * 60 + (endParts[1] || 0);
              const duration = endMinutes - startMinutes;
              
              const commonProps = {
                title: block.title,
                startTime: block.startTime,
                endTime: block.endTime,
                duration,
                className: "pointer-events-auto",
                style: { top: `${top}px` }
              };
              
              switch (block.type) {
                case 'focus':
                  return (
                    <DeepWorkBlock
                      key={block.id}
                      {...commonProps}
                      id={block.id}
                      tasks={block.tasks}
                    />
                  );
                case 'meeting':
                  return (
                    <MeetingBlock
                      key={block.id}
                      {...commonProps}
                      attendees={[]} // TODO: Get from metadata
                    />
                  );
                case 'email':
                  return (
                    <EmailTriageBlock
                      key={block.id}
                      {...commonProps}
                      emailCount={block.emailQueue?.length || 0}
                    />
                  );
                case 'break':
                  return (
                    <BreakBlock
                      key={block.id}
                      {...commonProps}
                      type={block.title.toLowerCase().includes('lunch') ? 'lunch' : 'other'}
                    />
                  );
                default:
                  return null;
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
});

TimeGridDay.displayName = 'TimeGridDay'; 