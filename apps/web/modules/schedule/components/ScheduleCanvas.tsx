'use client';

import { useRef, useEffect } from 'react';
import { useCanvasStore } from '@/modules/schedule/canvas/CanvasStore';
import { useUserPreferences } from '@/modules/settings/hooks/useUserPreferences';
import { useRenderLoop } from '@/modules/schedule/canvas/hooks/useRenderLoop';
import { useCanvasGestures } from '@/modules/schedule/canvas/hooks/useCanvasGestures';
import { useMockSchedule } from '@/modules/schedule/hooks/useMockSchedule';
import { DateNavigator } from './DateNavigator';
import { InfiniteTimeGrid } from './InfiniteTimeGrid';
import { DailyPlanningTrigger } from './DailyPlanningTrigger';
import { UserMenu } from '@/components/user-menu';

export function ScheduleCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { preferences, isLoading } = useUserPreferences();
  const initialize = useCanvasStore(state => state.initialize);
  const setPreferences = useCanvasStore(state => state.setPreferences);
  
  // Initialize mock schedule
  useMockSchedule('typical_day');
  
  // Start render loop
  useRenderLoop();
  
  // Set up gestures with faster scroll speed
  useCanvasGestures(containerRef as React.RefObject<HTMLElement>, {
    scrollSpeed: 2.0,
  });
  
  // Initialize canvas dimensions
  useEffect(() => {
    const updateDimensions = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        initialize(rect.width, rect.height);
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, [initialize]);
  
  // Set preferences when loaded
  useEffect(() => {
    if (preferences) {
      setPreferences(preferences);
    }
  }, [preferences, setPreferences]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className="h-full w-full overflow-hidden relative bg-background"
      style={{ 
        cursor: 'grab',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Date Navigator */}
      <DateNavigator />
      
      {/* Infinite Time Grid */}
      <InfiniteTimeGrid />
      
      {/* Daily Planning Trigger - floating button */}
      <DailyPlanningTrigger />
      
      {/* User Menu - now in bottom right to avoid chat overlap */}
      <div className="absolute bottom-4 right-4 z-50">
        <UserMenu />
      </div>
    </div>
  );
} 