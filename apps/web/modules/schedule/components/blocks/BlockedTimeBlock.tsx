'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Ban, Clock } from 'lucide-react';
import { CELL_HEIGHT, MIN_BLOCK_HEIGHT } from '../../constants/grid-constants';

interface BlockedTimeBlockProps {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  className?: string;
  style?: React.CSSProperties;
}

export function BlockedTimeBlock({ 
  id,
  title,
  startTime, 
  endTime,
  duration,
  className,
  style
}: BlockedTimeBlockProps) {
  // Calculate height based on duration, ensuring it's a multiple of CELL_HEIGHT
  const cells = Math.ceil(duration / 15);
  const baseHeight = Math.max(cells * CELL_HEIGHT, MIN_BLOCK_HEIGHT);

  return (
    <div
      data-block-id={id}
      className={cn(
        "rounded-md border border-gray-400/30",
        "bg-gradient-to-br from-gray-200 to-gray-300",
        "transition-all duration-200",
        "shadow-sm overflow-hidden",
        className
      )}
      style={{
        ...style,
        height: `${baseHeight}px`
      }}
    >
      <div className="p-2 h-full flex flex-col">
        {/* Header - Always shown */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <Ban size={14} className="text-gray-600" />
          <span>{startTime} - {endTime}</span>
        </div>
        
        {/* Title - Always shown */}
        <div className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
          {title}
        </div>
        
        {/* Duration indicator - Show if 60px+ */}
        {baseHeight >= 60 && (
          <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
            <Clock size={12} />
            <span>{duration} minutes blocked</span>
          </div>
        )}
      </div>
    </div>
  );
} 