/**
 * InfiniteTimeGrid - Main component for the infinite canvas time grid
 */

import React, { memo } from 'react';
import { useCanvasStore } from '../canvas/CanvasStore';
import { useSchedule } from '../hooks/useSchedule';
import { useScheduleStore } from '../store/scheduleStore';
import { TimeGridDay } from './TimeGridDay';
import { TimeLabel } from './TimeLabel';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { TIME_LABEL_WIDTH, CANVAS_COLORS, HOUR_HEIGHT } from '../constants/grid-constants';
import { format, addDays } from 'date-fns';

export const InfiniteTimeGrid = memo(() => {
  const viewport = useCanvasStore(state => state.viewport);
  const camera = useCanvasStore(state => state.camera);
  const getCurrentDayOffset = useCanvasStore(state => state.getCurrentDayOffset);
  const currentDate = useCanvasStore(state => state.currentDate);
  const referenceDate = useCanvasStore(state => state.referenceDate);
  const preferences = useCanvasStore(state => state.preferences);
  const shouldRender = useCanvasStore(state => state.shouldRender);
  const getSchedule = useScheduleStore(state => state.getSchedule);
  
  // Fetch schedule data for the current date and adjacent days
  useSchedule();
  
  // Top and bottom padding to prevent content from being cut off
  const VERTICAL_PADDING = 8;
  
  // Calculate current day offset, handling zero width
  const currentDayOffset = viewport.width > 0 ? getCurrentDayOffset() : 0;
  
  // Render current day and adjacent days for smooth scrolling
  const daysToRender = [-1, 0, 1].map(offset => currentDayOffset + offset);
  
  // Don't render if viewport is not initialized
  if (viewport.width === 0 || viewport.height === 0) {
    return null;
  }
  
  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* Time labels - fixed on left side */}
      <div 
        className="absolute left-0 top-0 z-20 bg-background"
        style={{
          width: `${TIME_LABEL_WIDTH}px`,
          height: '100%',
          transform: `translateY(${-camera.y}px)`,
          paddingTop: `${VERTICAL_PADDING}px`,
          paddingBottom: `${VERTICAL_PADDING}px`,
        }}
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <TimeLabel key={hour} hour={hour} />
        ))}
      </div>
      
      {/* Container that moves with camera */}
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${-camera.x}px, ${-camera.y}px)`,
          willChange: 'transform',
          paddingTop: `${VERTICAL_PADDING}px`,
          paddingBottom: `${VERTICAL_PADDING}px`,
          width: '9999px', // Large width to accommodate multiple days
          height: `${24 * HOUR_HEIGHT + VERTICAL_PADDING * 2}px`,
        }}
      >
        {/* Render visible days */}
        {daysToRender.map(dayOffset => (
          <TimeGridDay
            key={`day-${dayOffset}`}
            dayOffset={dayOffset}
            viewportWidth={viewport.width}
            preferences={preferences}
          />
        ))}
      </div>
      
      {/* Current time indicator - fixed position */}
      <CurrentTimeIndicator />
    </div>
  );
});

InfiniteTimeGrid.displayName = 'InfiniteTimeGrid'; 