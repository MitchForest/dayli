/**
 * TimeLabel component - displays hour labels on the left side
 */

import React, { memo } from 'react';
import { formatTimeLabel } from '../canvas/utils/date-utils';
import { HOUR_HEIGHT, TIME_LABEL_WIDTH, CANVAS_COLORS, TYPOGRAPHY } from '../constants/grid-constants';

interface TimeLabelProps {
  hour: number;
}

export const TimeLabel = memo(({ hour }: TimeLabelProps) => {
  return (
    <div
      className="absolute flex items-start justify-end pr-3"
      style={{
        top: `${hour * HOUR_HEIGHT}px`,
        height: `${HOUR_HEIGHT}px`,
        width: `${TIME_LABEL_WIDTH}px`,
      }}
    >
      <span
        style={{
          ...TYPOGRAPHY.timeLabel,
          color: hour % 3 === 0 ? CANVAS_COLORS.timeLabelHour : CANVAS_COLORS.timeLabel,
          marginTop: hour === 0 ? '2px' : '-6px', // Give 12 AM more space, align others with hour line
        }}
      >
        {formatTimeLabel(hour)}
      </span>
    </div>
  );
});

TimeLabel.displayName = 'TimeLabel'; 