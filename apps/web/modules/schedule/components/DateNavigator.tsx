/**
 * Beautiful date navigator with frosted glass effect
 */

import React, { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, subDays, format, isToday } from 'date-fns';
import { useCanvasStore } from '../canvas/CanvasStore';
import { formatDateForNav } from '../canvas/utils/date-utils';
import { CANVAS_COLORS, TYPOGRAPHY, ANIMATION } from '../constants/grid-constants';
import { Button } from '@/components/ui/button';

export const DateNavigator = memo(() => {
  const currentDate = useCanvasStore(state => state.currentDate);
  const navigateToPreviousDay = useCanvasStore(state => state.navigateToPreviousDay);
  const navigateToNextDay = useCanvasStore(state => state.navigateToNextDay);
  const navigateToToday = useCanvasStore(state => state.navigateToToday);
  
  const formattedDate = format(currentDate, 'EEEE, MMMM d');
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-2 p-1 bg-card border border-border rounded-lg shadow-md">
          <Button variant="ghost" size="icon" onClick={() => navigateToPreviousDay(true)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <button onClick={() => navigateToToday(true)} className="text-sm font-medium text-center w-40 px-2 py-1 rounded-md hover:bg-accent transition-colors">
            {formattedDate}
          </button>
          
          <Button variant="ghost" size="icon" onClick={() => navigateToNextDay(true)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

DateNavigator.displayName = 'DateNavigator'; 