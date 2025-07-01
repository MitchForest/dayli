/**
 * Beautiful date navigator with frosted glass effect
 */

import React, { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, subDays } from 'date-fns';
import { useCanvasStore } from '../canvas/CanvasStore';
import { formatDateForNav, isToday } from '../canvas/utils/date-utils';
import { CANVAS_COLORS, TYPOGRAPHY, ANIMATION } from '../constants/grid-constants';

export const DateNavigator = memo(() => {
  const currentDate = useCanvasStore(state => state.currentDate);
  const navigateToDate = useCanvasStore(state => state.navigateToDate);
  const navigateToToday = useCanvasStore(state => state.navigateToToday);
  
  const handlePrevDay = () => {
    navigateToDate(subDays(currentDate, 1));
  };
  
  const handleNextDay = () => {
    navigateToDate(addDays(currentDate, 1));
  };
  
  const handleDateClick = () => {
    // Navigate to today with smart positioning
    navigateToToday(true);
  };
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div 
          className="flex items-center gap-3 px-4 py-2 rounded-lg backdrop-blur-md border"
          style={{
            background: CANVAS_COLORS.dateNavBackground,
            borderColor: CANVAS_COLORS.dateNavBorder,
          }}
        >
          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-full hover:bg-accent transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft 
              size={16} 
              style={{ color: CANVAS_COLORS.dateNavArrow }}
            />
          </button>
          
          <button
            onClick={handleDateClick}
            className="px-3 py-1 rounded-md hover:bg-accent transition-colors"
            style={{
              ...TYPOGRAPHY.dateNav,
              color: CANVAS_COLORS.dateNavText,
              minWidth: '120px',
              textAlign: 'center',
            }}
          >
            {formatDateForNav(currentDate)}
            {isToday(currentDate) && (
              <span className="ml-2 text-xs opacity-50">Today</span>
            )}
          </button>
          
          <button
            onClick={handleNextDay}
            className="p-1.5 rounded-full hover:bg-accent transition-colors"
            aria-label="Next day"
          >
            <ChevronRight 
              size={16} 
              style={{ color: CANVAS_COLORS.dateNavArrow }}
            />
          </button>
        </div>
      </div>
    </div>
  );
});

DateNavigator.displayName = 'DateNavigator'; 