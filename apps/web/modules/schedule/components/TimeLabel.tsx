import React from 'react';
import { cn } from '@/lib/utils';

interface TimeLabelProps {
  time: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TimeLabel({ time, className, style }: TimeLabelProps) {
  return (
    <div 
      className={cn(
        "text-xs text-muted-foreground font-medium pr-4 text-right",
        className
      )}
      style={style}
    >
      {time}
    </div>
  );
} 