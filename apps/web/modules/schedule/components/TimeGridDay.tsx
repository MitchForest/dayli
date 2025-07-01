/**
 * TimeGridDay component - renders a full 24-hour day grid
 */

import React, { memo, useMemo } from 'react';
import { GridHour } from './GridHour';
import { TimeLabel } from './TimeLabel';
import { HOUR_HEIGHT, TIME_LABEL_WIDTH, CANVAS_COLORS, DAY_SPACING } from '../constants/grid-constants';
import { parseTime } from '../canvas/utils/date-utils';
import type { UserPreferencesTyped } from '@/modules/settings/types/preferences.types';
import { DeepWorkBlock, MeetingBlock, EmailTriageBlock, BreakBlock, BlockedTimeBlock } from './blocks';

interface TimeGridDayProps {
  dayOffset: number; // Days from today
  viewportWidth: number;
  preferences: UserPreferencesTyped | null;
}

export const TimeGridDay = memo(({ dayOffset, viewportWidth, preferences }: TimeGridDayProps) => {
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
        
        {/* Sample blocks for today only */}
        {dayOffset === 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Morning email triage */}
            <EmailTriageBlock
              title="Morning Email Triage"
              startTime="8:00"
              endTime="8:30"
              duration={30}
              emailCount={15}
              className="pointer-events-auto"
              style={{ top: `${8 * HOUR_HEIGHT}px` }}
            />
            
            {/* Deep work block */}
            <DeepWorkBlock
              title="Sprint 01.025 Implementation"
              startTime="9:00"
              endTime="11:00"
              duration={120}
              className="pointer-events-auto"
              style={{ top: `${9 * HOUR_HEIGHT}px` }}
            />
            
            {/* Meeting */}
            <MeetingBlock
              title="Team Standup"
              startTime="11:00"
              endTime="11:30"
              duration={30}
              attendees={['John', 'Sarah', 'Mike']}
              className="pointer-events-auto"
              style={{ top: `${11 * HOUR_HEIGHT}px` }}
            />
            
            {/* Lunch break */}
            <BreakBlock
              title="Lunch Break"
              startTime="12:00"
              endTime="13:00"
              duration={60}
              type="lunch"
              className="pointer-events-auto"
              style={{ top: `${12 * HOUR_HEIGHT}px` }}
            />
            
            {/* Blocked time */}
            <BlockedTimeBlock
              title="Focus Time - No Meetings"
              startTime="14:00"
              endTime="16:00"
              duration={120}
              reason="Deep work protection"
              className="pointer-events-auto"
              style={{ top: `${14 * HOUR_HEIGHT}px` }}
            />
            
            {/* Afternoon email triage */}
            <EmailTriageBlock
              title="Afternoon Email Review"
              startTime="16:30"
              endTime="17:00"
              duration={30}
              emailCount={8}
              className="pointer-events-auto"
              style={{ top: `${16.5 * HOUR_HEIGHT}px` }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

TimeGridDay.displayName = 'TimeGridDay'; 