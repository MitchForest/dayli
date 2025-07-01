'use client';

import { useRef, useEffect } from 'react';
import { useCanvasStore } from '@/modules/schedule/canvas/CanvasStore';
import { useUserPreferences } from '@/modules/settings/hooks/useUserPreferences';
import { useRenderLoop } from '@/modules/schedule/canvas/hooks/useRenderLoop';
import { useCanvasGestures } from '@/modules/schedule/canvas/hooks/useCanvasGestures';
import { DateNavigator } from '@/modules/schedule/components/DateNavigator';
import { InfiniteTimeGrid } from '@/modules/schedule/components/InfiniteTimeGrid';
import { CANVAS_COLORS } from '@/modules/schedule/constants/grid-constants';
import { UserMenu } from '@/components/user-menu';

export default function FocusNewPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { preferences, isLoading } = useUserPreferences();
  const initialize = useCanvasStore(state => state.initialize);
  const setPreferences = useCanvasStore(state => state.setPreferences);
  
  // Start render loop
  useRenderLoop();
  
  // Set up gestures with faster scroll speed
  useCanvasGestures(containerRef as React.RefObject<HTMLElement>, {
    scrollSpeed: 2.0,
  });
  
  // Initialize canvas dimensions
  useEffect(() => {
    const updateDimensions = () => {
      initialize(window.innerWidth, window.innerHeight);
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className="h-screen w-screen overflow-hidden relative bg-background"
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
      
      {/* User Menu - floating avatar in bottom left */}
      <UserMenu />
    </div>
  );
} 