'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Mail, Clock, Archive, CheckCircle, ChevronRight } from 'lucide-react';
import { EmailDecisionCard } from '@/modules/email/components/EmailDecisionCard';
import { useEmailTriage } from '@/modules/email/hooks/useEmailTriage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface EmailBlockProps {
  id: string;
  blockId: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  onComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function EmailBlock({ 
  id,
  blockId, 
  title,
  startTime, 
  endTime,
  duration,
  onComplete,
  className,
  style
}: EmailBlockProps) {
  const [isActive, setIsActive] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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
        setIsActive(false);
      }, 500);
    }
  };

  const handleStartTriage = () => {
    setIsActive(true);
    setShowDetails(false);
  };

  // Calculate height
  const baseHeight = Math.max(40, (duration / 15) * 30);
  
  const currentEmail = emails.find((e: any) => !e.decision);
  const progress = (stats.processed / Math.max(emails.length, 1)) * 100;
  const urgentCount = emails.filter((e: any) => e.urgency === 'urgent').length;

  // If triage is active, show full interface in a dialog
  if (isActive) {
    return (
      <Dialog open={isActive} onOpenChange={setIsActive}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-purple-600" />
              Email Triage
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
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
              <div className="text-center py-4 space-y-3">
                <CheckCircle className="mx-auto text-green-600" size={32} />
                <div>
                  <p className="text-sm font-medium">All emails processed!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {stats.now} tasks, deferred {stats.later}, archived {stats.never}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    onComplete?.();
                    setIsActive(false);
                  }}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Complete
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Collapsed view
  return (
    <>
      <div
        data-block-id={id}
        className={cn(
          "rounded-md border border-purple-500/20",
          "bg-gradient-to-br from-purple-100 to-purple-200",
          "hover:from-purple-200 hover:to-purple-300",
          "transition-all duration-200 cursor-pointer",
          "shadow-sm hover:shadow-md hover:shadow-purple-300/20",
          "overflow-hidden group",
          className
        )}
        style={{
          ...style,
          height: `${baseHeight}px`
        }}
        onClick={() => setShowDetails(true)}
      >
        <div className="p-2 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-purple-900">
              <Mail size={16} className="text-purple-700" />
              <span>{startTime} - {endTime}</span>
            </div>
            <ChevronRight size={14} className="text-purple-600 group-hover:translate-x-0.5 transition-transform" />
          </div>
          
          {/* Title */}
          <div className="text-sm font-semibold text-purple-900 mt-0.5 truncate">
            {title}
          </div>
          
          {/* Email count preview */}
          <div className="text-xs text-purple-700 mt-1">
            {emails.length > 0 ? (
              <>
                {emails.length} emails to process
                {urgentCount > 0 && (
                  <span className="text-purple-800 font-medium ml-1">
                    ({urgentCount} urgent)
                  </span>
                )}
              </>
            ) : (
              <span className="italic">No emails to triage</span>
            )}
          </div>
        </div>
      </div>

      {/* Details dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-purple-600" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{startTime} - {endTime} ({duration} minutes)</span>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Email Summary</h4>
              <div className="text-sm space-y-1">
                <p>Total emails: {emails.length}</p>
                {urgentCount > 0 && (
                  <p className="text-purple-700 font-medium">Urgent: {urgentCount}</p>
                )}
                {stats.processed > 0 && (
                  <p className="text-muted-foreground">
                    Already processed: {stats.processed}
                  </p>
                )}
              </div>
            </div>
            
            {emails.length > 0 && (
              <Button
                onClick={handleStartTriage}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Start Triage
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 