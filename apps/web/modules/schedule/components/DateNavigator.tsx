/**
 * Beautiful date navigator with frosted glass effect
 */

import React, { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useSimpleScheduleStore } from '../store/simpleScheduleStore';
import { Button } from '@/components/ui/button';

export const DateNavigator = memo(() => {
  const currentDate = useSimpleScheduleStore(state => state.currentDate);
  const navigateToPreviousDay = useSimpleScheduleStore(state => state.navigateToPreviousDay);
  const navigateToNextDay = useSimpleScheduleStore(state => state.navigateToNextDay);
  const navigateToToday = useSimpleScheduleStore(state => state.navigateToToday);
  
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