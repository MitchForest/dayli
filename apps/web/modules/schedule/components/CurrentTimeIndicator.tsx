/**
 * CurrentTimeIndicator - Shows current time with a beautiful animated line
 */

import React, { memo, useEffect, useState } from 'react';
import { HOUR_HEIGHT, TIME_LABEL_WIDTH } from '../constants/grid-constants';

export const CurrentTimeIndicator = memo(() => {
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
  
  // Calculate Y position based on current time
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const yPosition = (hours + minutes / 60) * HOUR_HEIGHT;
  
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: `${yPosition}px`,
        left: 0,
        right: 0,
        height: '2px',
        zIndex: 15,
      }}
    >
      <div className="relative w-full h-full">
        {/* Glow effect */}
        <div
          className="absolute inset-x-0 -top-2 h-4"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(var(--primary)), transparent)',
            opacity: 0.3,
            filter: 'blur(8px)',
          }}
        />
        
        {/* Main line */}
        <div className="absolute inset-0 bg-primary" />
        
        {/* Time dot */}
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/50" />
      </div>
    </div>
  );
});

CurrentTimeIndicator.displayName = 'CurrentTimeIndicator'; 