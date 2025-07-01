'use client';

import { useRef, useEffect } from 'react';
import { useCanvasStore } from '@/modules/schedule/canvas/CanvasStore';
import { useUserPreferences } from '@/modules/settings/hooks/useUserPreferences';
import { useRenderLoop } from '@/modules/schedule/canvas/hooks/useRenderLoop';
import { useCanvasGestures } from '@/modules/schedule/canvas/hooks/useCanvasGestures';
import { useSchedule } from '../hooks/useSchedule';
import { InfiniteTimeGrid } from './InfiniteTimeGrid';

export function ScheduleCanvas() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const { preferences } = useUserPreferences();
  const initialize = useCanvasStore(state => state.initialize);
  const setPreferences = useCanvasStore(state => state.setPreferences);
  
  // This hook is essential for fetching and managing schedule data
  useSchedule();
  
  // Start render loop
  useRenderLoop();
  
  // Set up gestures with faster scroll speed
  useCanvasGestures(containerRef);  
  // Initialize and update canvas dimensions using ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        // Only initialize if we have a valid size to prevent race conditions
        if (width > 0 && height > 0) {
          initialize(width, height);
        }
      }
    });

    observer.observe(container);
    
    return () => observer.disconnect();
  }, [initialize]);
  
  // Set preferences when loaded
  useEffect(() => {
    if (preferences) {
      setPreferences(preferences);
    }
  }, [preferences, setPreferences]);
  
  return (
    <div 
      ref={containerRef}
      className="h-full w-full relative overflow-hidden bg-background"
      style={{ 
        cursor: 'grab',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Infinite Time Grid - fills the container */}
      <InfiniteTimeGrid />
    </div>
  );
} 