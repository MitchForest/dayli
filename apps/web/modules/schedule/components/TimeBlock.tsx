import React from 'react';
import { cn } from '@/lib/utils';
import type { TimeBlock as TimeBlockType } from '../types/schedule.types';
import type { TimeGridPosition } from '../utils/timeGrid';

interface TimeBlockProps {
  block: TimeBlockType;
  gridPosition: TimeGridPosition;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function TimeBlock({ 
  block, 
  gridPosition, 
  children, 
  className,
  style,
  onClick 
}: TimeBlockProps) {
  return (
    <div
      className={cn(
        "relative rounded-md border p-3 transition-all duration-200 ease-out",
        "border-border/50 shadow-sm hover:shadow-md hover:border-accent/50",
        "cursor-default select-none",
        "hover:-translate-y-0.5",
        className
      )}
      style={{
        gridRow: `${gridPosition.row} / span ${gridPosition.span}`,
        ...style,
      }}
      onClick={onClick}
      role="article"
      aria-label={`${block.type} block: ${block.title} from ${block.startTime} to ${block.endTime}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-medium line-clamp-2">{block.title}</h3>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {block.startTime}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
} 