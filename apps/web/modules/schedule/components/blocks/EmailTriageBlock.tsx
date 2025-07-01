'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Mail, Clock, Archive, CheckCircle } from 'lucide-react';
import { EmailDecisionCard } from '@/modules/email/components/EmailDecisionCard';
import { useEmailTriage } from '@/modules/email/hooks/useEmailTriage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface EmailTriageBlockProps {
  blockId: string;
  startTime: string;
  endTime: string;
  onComplete?: () => void;
  className?: string;
}

export function EmailTriageBlock({ 
  blockId, 
  startTime, 
  endTime, 
  onComplete,
  className 
}: EmailTriageBlockProps) {
  const [isActive, setIsActive] = useState(false);
  const { emails, processEmail, isLoading, stats, loadEmails } = useEmailTriage(blockId);

  useEffect(() => {
    if (isActive) {
      loadEmails();
    }
  }, [isActive, loadEmails]);

  const handleDecision = async (emailId: string, decision: 'now' | 'tomorrow' | 'never') => {
    // Map 'tomorrow' to 'later' for the API
    const apiDecision = decision === 'tomorrow' ? 'later' : decision;
    await processEmail(emailId, apiDecision);
    
    // Check if all emails processed
    if (emails.filter((e: any) => !e.decision).length === 1) {
      setTimeout(() => {
        onComplete?.();
      }, 500);
    }
  };

  if (!isActive) {
    return (
      <button
        onClick={() => setIsActive(true)}
        className={cn(
          "w-full p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg",
          "hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors",
          "border border-purple-200 dark:border-purple-800",
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="text-purple-600 dark:text-purple-400" size={20} />
            <span className="font-medium text-foreground">Start Email Triage</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {emails.length} emails to process
          </span>
        </div>
      </button>
    );
  }

  const currentEmail = emails.find((e: any) => !e.decision);
  const progress = (stats.processed / Math.max(emails.length, 1)) * 100;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {stats.processed} / {emails.length} processed
          </span>
          <span className="text-muted-foreground">
            {stats.now} tasks created
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Current email */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : currentEmail ? (
        <EmailDecisionCard
          email={{
            id: currentEmail.id,
            from: `${currentEmail.from_name || currentEmail.from_email}`,
            subject: currentEmail.subject,
            preview: currentEmail.body_preview || '',
          }}
          onDecision={(_, decision) => handleDecision(currentEmail.id, decision)}
        />
      ) : (
        <div className="text-center py-8 space-y-4">
          <CheckCircle className="mx-auto text-green-600 dark:text-green-400" size={48} />
          <div>
            <p className="text-lg font-medium text-foreground">All emails processed!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Created {stats.now} tasks, deferred {stats.later}, archived {stats.never}
            </p>
          </div>
          <Button
            onClick={onComplete}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Complete Triage
          </Button>
        </div>
      )}
    </div>
  );
} 