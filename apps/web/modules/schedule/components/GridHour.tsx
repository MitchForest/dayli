/**
 * GridHour component - represents one hour with 4 15-minute cells
 */

import React, { memo } from 'react';
import { HOUR_HEIGHT, CELL_HEIGHT, CANVAS_COLORS } from '../constants/grid-constants';

interface GridHourProps {
  hour: number;
  isWorkHour: boolean;
  dayOffset: number; // Add dayOffset to know which day this hour belongs to
}

export const GridHour = memo(({ hour, isWorkHour, dayOffset }: GridHourProps) => {
  return (
    <div 
      className="relative"
      style={{ 
        height: `${HOUR_HEIGHT}px`,
        borderBottom: `1px solid ${CANVAS_COLORS.gridLineHour}`,
      }}
    >
      {/* 15-minute cells */}
      {[0, 1, 2, 3].map((quarter) => (
        <div
          key={quarter}
          className="absolute w-full"
          style={{
            top: `${quarter * CELL_HEIGHT}px`,
            height: `${CELL_HEIGHT}px`,
            borderBottom: quarter < 3 ? `1px solid ${
              quarter === 1 ? CANVAS_COLORS.gridLineQuarter : CANVAS_COLORS.gridLine
            }` : 'none',
          }}
        />
      ))}
    </div>
  );
});

GridHour.displayName = 'GridHour'; 