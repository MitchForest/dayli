'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useAnimation, useMotionValue, PanInfo } from 'framer-motion';
import { useSimpleScheduleStore } from '../store/simpleScheduleStore';
import { useUserPreferences } from '@/modules/settings/hooks/useUserPreferences';
import { useSchedule } from '../hooks/useSchedule';
import { TimeGridDay } from './TimeGridDay';
import { TimeLabel } from './TimeLabel';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { TIME_LABEL_WIDTH, HOUR_HEIGHT } from '../constants/grid-constants';
import { addDays, isToday, startOfDay } from 'date-fns';
import { setScheduleViewAnimationCallbacks } from './DateNavigator';

export function ScheduleView() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const x = useMotionValue(0);
  
  const currentDate = useSimpleScheduleStore(state => state.currentDate);
  const setCurrentDate = useSimpleScheduleStore(state => state.setCurrentDate);
  const setPreferences = useSimpleScheduleStore(state => state.setPreferences);
  const navigatedToTodayViaButton = useSimpleScheduleStore(state => state.navigatedToTodayViaButton);
  const clearTodayNavigation = useSimpleScheduleStore(state => state.clearTodayNavigation);
  
  const { preferences } = useUserPreferences();
  const [viewportWidth, setViewportWidth] = useState(0);
  const previousDateRef = useRef(currentDate);
  const animationSourceRef = useRef<'drag' | 'button' | null>(null);
  const hasInitiallyScrolledRef = useRef(false);
  
  // Fetch schedule data - this ensures data is loaded
  const { loading } = useSchedule();
  
  // Set preferences when loaded
  useEffect(() => {
    if (preferences) {
      setPreferences(preferences);
    }
  }, [preferences, setPreferences]);
  
  // Calculate day width (viewport width minus time labels)
  const dayWidth = viewportWidth - TIME_LABEL_WIDTH;
  
  // Set up animation callbacks for DateNavigator
  useEffect(() => {
    setScheduleViewAnimationCallbacks({
      animateNext: async () => {
        // Animate to show the next day (already rendered)
        await controls.start({
          x: -dayWidth,
          transition: { type: "spring", stiffness: 500, damping: 35 }
        });
        
        // Then update the date
        const nextDay = addDays(currentDate, 1);
        setCurrentDate(nextDay);
        
        // Reset position instantly
        x.set(0);
      },
      animatePrev: async () => {
        // Animate to show the previous day (already rendered)
        await controls.start({
          x: dayWidth,
          transition: { type: "spring", stiffness: 500, damping: 35 }
        });
        
        // Then update the date
        const prevDay = addDays(currentDate, -1);
        setCurrentDate(prevDay);
        
        // Reset position instantly
        x.set(0);
      }
    });
  }, [controls, x, dayWidth, currentDate, setCurrentDate]);
  
  // Update viewport width on resize
  useEffect(() => {
    const updateSize = () => {
      if (scrollContainerRef.current) {
        const width = scrollContainerRef.current.offsetWidth;
        setViewportWidth(width);
      }
    };
    
    // Use RAF to ensure DOM is ready
    requestAnimationFrame(() => {
      updateSize();
    });
    
    // Update on window resize
    window.addEventListener('resize', updateSize);
    
    // Also observe the container for size changes (when panels resize)
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, []);
  
  // We'll handle button navigation differently - no animation here
  useEffect(() => {
    previousDateRef.current = currentDate;
  }, [currentDate]);
  
  // Handle scroll position on initial load ONLY
  useEffect(() => {
    if (!scrollContainerRef.current || loading || viewportWidth === 0 || hasInitiallyScrolledRef.current) {
      return;
    }
    
    // Mark that we've done the initial scroll
    hasInitiallyScrolledRef.current = true;
    
    if (isToday(currentDate)) {
      // Initial load on today - center on current time
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const scrollTop = currentHour * HOUR_HEIGHT - scrollContainerRef.current.offsetHeight / 2;
      
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'auto'
      });
    } else {
      // Initial load on other day - start at work hours
      const start = preferences?.work_start_time || '08:00';
      const [hour = 8] = start.split(':').map(Number);
      const scrollTop = hour * HOUR_HEIGHT - 100;
      
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'auto'
      });
    }
  }, [loading, viewportWidth, currentDate, preferences]); // Include dependencies for initial load
  
  // Handle scrolling when today button is clicked
  useEffect(() => {
    if (navigatedToTodayViaButton && scrollContainerRef.current && !loading) {
      // Scroll to current time
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const scrollTop = currentHour * HOUR_HEIGHT - scrollContainerRef.current.offsetHeight / 2;
      
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      });
      
      // Clear the flag after scrolling
      clearTodayNavigation();
    }
  }, [navigatedToTodayViaButton, loading, clearTodayNavigation]);
  
  // Handle drag to change days
  const handleDragEnd = useCallback(async (_: any, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.x;
    const offset = x.get();
    
    if (Math.abs(offset) > threshold || Math.abs(velocity) > 500) {
      const direction = offset > 0 ? -1 : 1;
      const newDate = addDays(currentDate, direction);
      
      // Mark this as a drag animation
      animationSourceRef.current = 'drag';
      
      // Animate to the edge
      await controls.start({
        x: offset > 0 ? dayWidth : -dayWidth,
        transition: { type: "spring", stiffness: 500, damping: 35 }
      });
      
      // Update date
      setCurrentDate(newDate);
      
      // Reset position instantly
      x.set(0);
    } else {
      // Snap back
      controls.start({
        x: 0,
        transition: { type: "spring", stiffness: 500, damping: 35 }
      });
    }
  }, [controls, x, dayWidth, currentDate, setCurrentDate]);
  
  // Render days
  const renderDays = () => {
    const days = [];
    for (let i = -1; i <= 1; i++) {
      const date = addDays(currentDate, i);
      
      days.push(
        <div
          key={startOfDay(date).getTime()} // Stable key for smoother animations
          className="absolute top-0"
          style={{
            left: `${(i + 1) * dayWidth}px`,
            width: `${dayWidth}px`,
            height: '100%',
          }}
        >
          <TimeGridDay
            dayOffset={i}
            viewportWidth={dayWidth}
            preferences={preferences}
          />
          {isToday(date) && <CurrentTimeIndicator />}
        </div>
      );
    }
    return days;
  };
  
  // Wait for viewport to be measured
  const isReady = viewportWidth > 0;
  
  return (
    <div className="relative h-full w-full bg-background">
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-y-auto overflow-x-hidden"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Time labels */}
          <div
            className="absolute left-0 top-0 bg-background border-r border-border z-10"
            style={{
              width: `${TIME_LABEL_WIDTH}px`,
              height: '100%',
            }}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <TimeLabel key={hour} hour={hour} />
            ))}
          </div>
          
          {/* Days container */}
          <div
            className="absolute top-0 overflow-hidden"
            style={{
              left: `${TIME_LABEL_WIDTH}px`,
              width: `${dayWidth}px`,
              height: '100%',
            }}
          >
            <motion.div
              className="relative h-full"
              style={{
                width: `${dayWidth * 3}px`,
                x,
                left: `-${dayWidth}px`,
              }}
              drag="x"
              dragElastic={0.2}
              dragConstraints={{ left: -dayWidth, right: dayWidth }}
              onDragEnd={handleDragEnd}
              animate={controls}
              whileDrag={{ cursor: 'grabbing' }}
            >
              {isReady && renderDays()}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
} 