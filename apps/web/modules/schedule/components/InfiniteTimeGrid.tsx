/**
 * InfiniteTimeGrid - Main component for the infinite canvas time grid
 */

import React, { memo } from 'react';
import { useCanvasStore } from '../canvas/CanvasStore';
import { TimeGridDay } from './TimeGridDay';
import { TimeLabel } from './TimeLabel';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { TIME_LABEL_WIDTH, CANVAS_COLORS } from '../constants/grid-constants';

export const InfiniteTimeGrid = memo(() => {
  const viewport = useCanvasStore(state => state.viewport);
  const camera = useCanvasStore(state => state.camera);
  const getCurrentDayOffset = useCanvasStore(state => state.getCurrentDayOffset);
  const preferences = useCanvasStore(state => state.preferences);
  const shouldRender = useCanvasStore(state => state.shouldRender);
  
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
    <div className="absolute inset-0 overflow-hidden bg-background">
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
        className="absolute"
        style={{
          transform: `translate(${-camera.x}px, ${-camera.y}px)`,
          willChange: 'transform',
          paddingTop: `${VERTICAL_PADDING}px`,
          paddingBottom: `${VERTICAL_PADDING}px`,
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
      
      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-card text-card-foreground text-xs p-2 rounded border border-border font-mono">
          <div>Camera: ({Math.round(camera.x)}, {Math.round(camera.y)})</div>
          <div>Day: {currentDayOffset} | Render: {shouldRender ? 'Y' : 'N'}</div>
          <div>Viewport: {viewport.width}x{viewport.height}</div>
        </div>
      )}
    </div>
  );
});

InfiniteTimeGrid.displayName = 'InfiniteTimeGrid'; 