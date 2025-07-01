/**
 * Beautiful date navigator with frosted glass effect
 */

import React, { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useSimpleScheduleStore } from '../store/simpleScheduleStore';
import { Button } from '@/components/ui/button';

// This is a hack - we need to access the animation controls from ScheduleView
// In a production app, this would be done through context or props
let scheduleViewAnimationCallbacks: {
  animateNext?: () => Promise<void>;
  animatePrev?: () => Promise<void>;
} = {};

export function setScheduleViewAnimationCallbacks(callbacks: typeof scheduleViewAnimationCallbacks) {
  scheduleViewAnimationCallbacks = callbacks;
}

export const DateNavigator = memo(() => {
  const currentDate = useSimpleScheduleStore(state => state.currentDate);
  const storeNavigatePrev = useSimpleScheduleStore(state => state.navigateToPreviousDay);
  const storeNavigateNext = useSimpleScheduleStore(state => state.navigateToNextDay);
  const navigateToToday = useSimpleScheduleStore(state => state.navigateToToday);
  
  const navigateToPreviousDay = async () => {
    if (scheduleViewAnimationCallbacks.animatePrev) {
      await scheduleViewAnimationCallbacks.animatePrev();
    } else {
      storeNavigatePrev();
    }
  };
  
  const navigateToNextDay = async () => {
    if (scheduleViewAnimationCallbacks.animateNext) {
      await scheduleViewAnimationCallbacks.animateNext();
    } else {
      storeNavigateNext();
    }
  };
  
  const formattedDate = format(currentDate, 'EEEE, MMMM d');
  
  return (
    <div className="flex items-center gap-2 p-2 bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-lg">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={navigateToPreviousDay}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <button 
        onClick={navigateToToday} 
        className="text-sm font-medium text-center min-w-[160px] px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
      >
        {formattedDate}
      </button>
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={navigateToNextDay}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
});

DateNavigator.displayName = 'DateNavigator'; 