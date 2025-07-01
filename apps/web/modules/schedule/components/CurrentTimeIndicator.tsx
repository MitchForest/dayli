/**
 * CurrentTimeIndicator - Shows current time with a beautiful animated line
 */

import React, { memo, useEffect, useState } from 'react';
import { Position } from './foundation/Position';
import { useCanvasStore } from '../canvas/CanvasStore';
import { HOUR_HEIGHT, TIME_LABEL_WIDTH, CANVAS_COLORS, ANIMATION } from '../constants/grid-constants';

export const CurrentTimeIndicator = memo(() => {
  const viewport = useCanvasStore(state => state.viewport);
  const currentDayOffset = useCanvasStore(state => state.getCurrentDayOffset());
  
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update time every minute
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    
    // Update immediately
    updateTime();
    
    // Then update every minute
    const interval = setInterval(updateTime, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Only show indicator on today
  if (currentDayOffset !== 0) return null;
  
  // Calculate Y position based on current time
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const yPosition = (hours + minutes / 60) * HOUR_HEIGHT;
  
  // Vertical padding to match the grid offset
  const VERTICAL_PADDING = 8;
  
  return (
    <div
      className="absolute"
      style={{
        top: 0,
        left: 0,
        transform: `translate(${TIME_LABEL_WIDTH}px, ${yPosition + VERTICAL_PADDING}px)`,
        width: viewport.width - TIME_LABEL_WIDTH,
        height: 2,
        zIndex: 20,
        willChange: 'transform',
      }}
    >
      <div className="relative w-full h-full">
        {/* Large glow effect */}
        <div
          className="absolute inset-x-0 -top-4 h-8"
          style={{
            background: 'radial-gradient(ellipse at center, var(--primary), transparent)',
            opacity: 0.15,
            filter: 'blur(12px)',
          }}
        />
        
        {/* Medium glow effect */}
        <div
          className="absolute inset-0 bg-primary/20"
          style={{
            filter: 'blur(8px)',
            transform: 'scaleY(6)',
          }}
        />
        
        {/* Main line */}
        <div
          className="absolute inset-0 bg-primary"
          style={{
            transition: `transform ${ANIMATION.currentTime} ease`,
          }}
        />
        
        {/* Time dot */}
        <div
          className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/50"
        />
      </div>
    </div>
  );
});

CurrentTimeIndicator.displayName = 'CurrentTimeIndicator'; 