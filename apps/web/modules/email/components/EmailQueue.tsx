import React from 'react';
import { cn } from '@/lib/utils';
import { EmailDecisionCard } from './EmailDecisionCard';
import { EmailCounter } from './EmailCounter';
import type { EmailDecision } from '../types/email.types';

interface EmailQueueProps {
  emails: EmailDecision[];
  onDecision: (emailId: string, decision: 'now' | 'tomorrow' | 'never') => void;
  compact?: boolean;
  className?: string;
}

export function EmailQueue({ 
  emails, 
  onDecision,
  compact = false,
  className 
}: EmailQueueProps) {
  if (emails.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground italic", className)}>
        No emails to process
      </div>
    );
  }

  const visibleEmails = emails.slice(0, 3);
  const remainingCount = emails.length - visibleEmails.length;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        {/* Stack effect for remaining emails */}
        {emails.length > 1 && (
          <>
            {emails.length > 2 && (
              <div 
                className="absolute inset-x-0 top-2 h-full bg-card border border-border rounded-lg opacity-40 scale-95"
                style={{ transform: 'translateY(8px)' }}
              />
            )}
            <div 
              className="absolute inset-x-0 top-1 h-full bg-card border border-border rounded-lg opacity-60 scale-[0.975]"
              style={{ transform: 'translateY(4px)' }}
            />
          </>
        )}
        
        {/* Top email as decision card */}
        {emails[0] && (
          <div className="relative">
            <EmailDecisionCard
              email={emails[0]}
              onDecision={onDecision}
              compact={compact}
            />
          </div>
        )}
      </div>
      
      {/* Email counter */}
      {remainingCount > 0 && (
        <EmailCounter 
          count={remainingCount} 
          className="ml-2"
        />
      )}
    </div>
  );
} 