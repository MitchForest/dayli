/**
 * TimeGridDay component - renders a full 24-hour day grid
 */

import React, { memo, useMemo } from 'react';
import { GridHour } from './GridHour';
import { TimeLabel } from './TimeLabel';
import { HOUR_HEIGHT, TIME_LABEL_WIDTH, CANVAS_COLORS, DAY_SPACING } from '../constants/grid-constants';
import { parseTime } from '../canvas/utils/date-utils';
import type { UserPreferencesTyped } from '@/modules/settings/types/preferences.types';

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
      </div>
    </div>
  );
});

TimeGridDay.displayName = 'TimeGridDay'; 