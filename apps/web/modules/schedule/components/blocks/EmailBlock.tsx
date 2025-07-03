'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Mail, Clock, Inbox, AlertCircle } from 'lucide-react';
import type { EmailDecision } from '@/modules/email/types/email.types';
import { CELL_HEIGHT, MIN_BLOCK_HEIGHT } from '../../constants/grid-constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BlockContextMenu } from './BlockContextMenu';

interface EmailBlockProps {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  emailQueue?: EmailDecision[];
  className?: string;
  style?: React.CSSProperties;
}

export function EmailBlock({ 
  id,
  title,
  startTime, 
  endTime,
  duration,
  emailQueue = [],
  className,
  style
}: EmailBlockProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  // Calculate height based on duration, ensuring it's a multiple of CELL_HEIGHT
  const cells = Math.ceil(duration / 15);
  const baseHeight = Math.max(cells * CELL_HEIGHT, MIN_BLOCK_HEIGHT);
  
  // Smart content display based on height
  const showEmailCount = baseHeight >= 60; // 2+ cells
  const showUrgentCount = baseHeight >= 90 && emailQueue.length > 0; // 3+ cells
  
  const urgentCount = emailQueue.filter(e => 
    e.subject?.toLowerCase().includes('urgent') || 
    e.subject?.toLowerCase().includes('asap')
  ).length;

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
          "overflow-hidden group relative",
          className
        )}
        style={{
          ...style,
          height: `${baseHeight}px`
        }}
        onClick={() => setShowDetails(true)}
      >
        {/* Context menu button */}
        <BlockContextMenu
          id={id}
          title={title}
          type="email"
          startTime={startTime}
          endTime={endTime}
          color="purple"
        />
        
        <div className="p-2 h-full flex flex-col">
          {/* Header - Always shown */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-purple-900">
            <Mail size={14} className="text-purple-700" />
            <span>{startTime} - {endTime}</span>
          </div>
          
          {/* Title - Always shown */}
          <div className="text-sm font-semibold text-purple-900 mt-0.5 truncate">
            {title}
          </div>
          
          {/* Email count - Show if 60px+ AND there are emails */}
          {showEmailCount && emailQueue.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-purple-700 mt-1">
              <Inbox size={12} />
              <span>{emailQueue.length} {emailQueue.length === 1 ? 'email' : 'emails'} to process</span>
            </div>
          )}
          
          {/* Urgent indicator - Show if 90px+ AND there are urgent emails */}
          {showUrgentCount && urgentCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-purple-600 mt-1">
              <AlertCircle size={12} />
              <span>{urgentCount} urgent</span>
            </div>
          )}
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
            
            {emailQueue.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Emails to Process ({emailQueue.length})</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {emailQueue.map((email) => (
                    <div
                      key={email.id}
                      className="p-2 rounded-md bg-gray-50 space-y-1"
                    >
                      <div className="text-sm font-medium">{email.from}</div>
                      <div className="text-sm text-muted-foreground">{email.subject}</div>
                      {email.preview && (
                        <div className="text-xs text-muted-foreground truncate">
                          {email.preview}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No emails in queue.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 