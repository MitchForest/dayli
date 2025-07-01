'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Video, MapPin, Users, ExternalLink, ChevronRight, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface MeetingBlockProps {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  attendees?: string[];
  location?: string;
  videoLink?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function MeetingBlock({ 
  id,
  title,
  startTime, 
  endTime,
  duration,
  attendees = [],
  location,
  videoLink,
  className,
  style
}: MeetingBlockProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  // Calculate height based on duration
  const baseHeight = Math.max(40, (duration / 15) * 30);
  
  const hasVideoCall = !!videoLink;
  const hasLocation = !!location && !hasVideoCall;

  return (
    <>
      <div
        data-block-id={id}
        className={cn(
          "rounded-md border border-red-500/20",
          "bg-gradient-to-br from-red-100 to-red-200",
          "hover:from-red-200 hover:to-red-300",
          "transition-all duration-200 cursor-pointer",
          "shadow-sm hover:shadow-md hover:shadow-red-300/20",
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
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-900">
              {hasVideoCall ? (
                <Video size={16} className="text-red-700" />
              ) : hasLocation ? (
                <MapPin size={16} className="text-red-700" />
              ) : (
                <Users size={16} className="text-red-700" />
              )}
              <span>{startTime} - {endTime}</span>
            </div>
            <ChevronRight size={14} className="text-red-600 group-hover:translate-x-0.5 transition-transform" />
          </div>
          
          {/* Title */}
          <div className="text-sm font-semibold text-red-900 mt-0.5 truncate">
            {title}
          </div>
          
          {/* Attendees preview */}
          {attendees.length > 0 && baseHeight > 60 && (
            <div className="text-xs text-red-700 mt-1 truncate">
              {attendees.length === 1 ? attendees[0] : `${attendees.length} attendees`}
            </div>
          )}
        </div>
      </div>

      {/* Details dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-red-600" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{startTime} - {endTime} ({duration} minutes)</span>
            </div>
            
            {attendees.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Attendees ({attendees.length})</h4>
                <div className="text-sm text-muted-foreground">
                  {attendees.join(', ')}
                </div>
              </div>
            )}
            
            {(hasVideoCall || hasLocation) && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Location</h4>
                {hasVideoCall && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => window.open(videoLink, '_blank')}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Join Video Call
                    <ExternalLink className="ml-auto h-3 w-3" />
                  </Button>
                )}
                {hasLocation && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{location}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 