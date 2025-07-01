import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { DecisionButtons } from './DecisionButtons';
import type { EmailDecision } from '../types/email.types';

interface EmailDecisionCardProps {
  email: EmailDecision;
  onDecision: (emailId: string, decision: 'now' | 'tomorrow' | 'never') => void;
  className?: string;
  compact?: boolean;
}

export function EmailDecisionCard({ 
  email, 
  onDecision, 
  className,
  compact = false 
}: EmailDecisionCardProps) {
  const [isDeciding, setIsDeciding] = useState(false);
  const [decision, setDecision] = useState<'now' | 'tomorrow' | 'never' | null>(null);

  const handleDecision = (selectedDecision: 'now' | 'tomorrow' | 'never') => {
    setDecision(selectedDecision);
    setIsDeciding(true);
    
    // Trigger the decision with a slight delay for animation
    setTimeout(() => {
      onDecision(email.id, selectedDecision);
    }, 300);
  };

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg transition-all duration-300",
        compact ? "p-3" : "p-4",
        isDeciding && decision === 'never' && "-translate-x-full opacity-0",
        isDeciding && decision === 'now' && "translate-x-full opacity-0",
        isDeciding && decision === 'tomorrow' && "opacity-0 scale-95",
        className
      )}
    >
      <div className={cn("space-y-2", compact && "space-y-1")}>
        <div>
          <p className={cn(
            "font-medium text-foreground",
            compact ? "text-sm" : "text-base"
          )}>
            {email.from}
          </p>
          <p className={cn(
            "text-foreground line-clamp-1",
            compact ? "text-xs" : "text-sm"
          )}>
            {email.subject}
          </p>
        </div>
        
        {!compact && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {email.preview}
          </p>
        )}
        
        <DecisionButtons
          onDecision={handleDecision}
          disabled={isDeciding}
          size={compact ? 'sm' : 'default'}
        />
      </div>
    </div>
  );
} 