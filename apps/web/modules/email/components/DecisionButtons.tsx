import React from 'react';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DecisionButtonsProps {
  onDecision: (decision: 'now' | 'tomorrow' | 'never') => void;
  disabled?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function DecisionButtons({ 
  onDecision, 
  disabled = false,
  size = 'default',
  className 
}: DecisionButtonsProps) {
  const buttonSize = size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  
  return (
    <div className={cn("flex gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDecision('now')}
        disabled={disabled}
        className={cn(
          buttonSize,
          "flex-1 border-success/30 text-success hover:bg-success/10 hover:text-success hover:border-success/50",
          "transition-all duration-200 hover:scale-105"
        )}
      >
        <CheckCircle className={cn(iconSize, "mr-1")} />
        Now
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDecision('tomorrow')}
        disabled={disabled}
        className={cn(
          buttonSize,
          "flex-1 border-warning/30 text-warning hover:bg-warning/10 hover:text-warning hover:border-warning/50",
          "transition-all duration-200 hover:scale-105"
        )}
      >
        <Clock className={cn(iconSize, "mr-1")} />
        Tomorrow
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDecision('never')}
        disabled={disabled}
        className={cn(
          buttonSize,
          "flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50",
          "transition-all duration-200 hover:scale-105"
        )}
      >
        <XCircle className={cn(iconSize, "mr-1")} />
        Never
      </Button>
    </div>
  );
} 