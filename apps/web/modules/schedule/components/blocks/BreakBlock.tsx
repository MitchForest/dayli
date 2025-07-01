'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Coffee, Clock } from 'lucide-react';
import { CELL_HEIGHT, MIN_BLOCK_HEIGHT } from '../../constants/grid-constants';

interface BreakBlockProps {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  type?: 'lunch' | 'coffee' | 'break';
  className?: string;
  style?: React.CSSProperties;
}

export function BreakBlock({ 
  id,
  title,
  startTime, 
  endTime,
  duration,
  type = 'break',
  className,
  style
}: BreakBlockProps) {
  // Calculate height based on duration, ensuring it's a multiple of CELL_HEIGHT
  const cells = Math.ceil(duration / 15);
  const baseHeight = Math.max(cells * CELL_HEIGHT, MIN_BLOCK_HEIGHT);
  
  const getIcon = () => {
    switch(type) {
      case 'lunch': return '🍽️';
      case 'coffee': return '☕';
      default: return <Coffee size={16} className="text-green-700" />;
    }
  };

  return (
    <div
      data-block-id={id}
      className={cn(
        "rounded-md border border-green-500/20",
        "bg-gradient-to-br from-green-100 to-green-200",
        "hover:from-green-200 hover:to-green-300",
        "transition-all duration-200",
        "shadow-sm hover:shadow-md hover:shadow-green-300/20",
        "overflow-hidden",
        className
      )}
      style={{
        ...style,
        height: `${baseHeight}px`
      }}
    >
      <div className="p-2 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-green-900">
            {getIcon()}
            <span>{startTime} - {endTime}</span>
          </div>
        </div>
        
        {/* Title */}
        <div className="text-sm font-semibold text-green-900 mt-0.5 truncate">
          {title}
        </div>
        
        {/* Duration */}
        {baseHeight > 60 && (
          <div className="text-xs text-green-700 mt-1">
            {duration} minutes
          </div>
        )}
      </div>
    </div>
  );
} 