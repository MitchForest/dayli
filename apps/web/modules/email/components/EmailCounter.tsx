import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface EmailCounterProps {
  count: number;
  className?: string;
}

export function EmailCounter({ count, className }: EmailCounterProps) {
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "text-xs font-normal transition-all duration-200",
        className
      )}
    >
      +{count} more {count === 1 ? 'email' : 'emails'}
    </Badge>
  );
} 