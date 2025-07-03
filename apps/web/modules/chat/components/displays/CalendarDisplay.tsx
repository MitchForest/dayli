import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface CalendarDisplayProps {
  toolName: string;
  data: any;
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const CalendarDisplay = memo(function CalendarDisplay({ 
  toolName,
  data, 
  onAction 
}: CalendarDisplayProps) {
  // Handle different calendar tool responses
  if (toolName === 'calendar_scheduleMeeting') {
    return <MeetingScheduled data={data} onAction={onAction} />;
  }
  if (toolName === 'calendar_rescheduleMeeting') {
    return <MeetingRescheduled data={data} onAction={onAction} />;
  }
  
  // Fallback
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Meeting scheduled component
const MeetingScheduled = memo(function MeetingScheduled({ data, onAction }: any) {
  const meeting = data.meeting;
  
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-green-500/10">
          <Calendar className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h4 className="font-medium">Meeting Scheduled</h4>
            <h3 className="text-lg font-semibold mt-1">{meeting.title}</h3>
          </div>
          
          <div className="space-y-2">
            {/* Time */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(new Date(meeting.startTime), 'EEEE, MMMM d, yyyy')}
              </span>
              <span className="text-muted-foreground">•</span>
              <span>
                {format(new Date(meeting.startTime), 'h:mm a')} - {format(new Date(meeting.endTime), 'h:mm a')}
              </span>
            </div>
            
            {/* Attendees */}
            {meeting.attendees && meeting.attendees.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <span className="text-muted-foreground">Attendees:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {meeting.attendees.map((email: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {email}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Location */}
            {meeting.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{meeting.location}</span>
              </div>
            )}
            
            {/* Description */}
            {meeting.description && (
              <div className="text-sm">
                <p className="text-muted-foreground">Description:</p>
                <p className="mt-1">{meeting.description}</p>
              </div>
            )}
            
            {/* Prep block */}
            {data.prepBlockCreated && (
              <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-md text-sm">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span>Preparation time blocked before meeting</span>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.({ 
                type: 'add_to_calendar', 
                payload: { meetingId: meeting.id } 
              })}
            >
              Add to Calendar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.({ 
                type: 'reschedule_meeting', 
                payload: { meetingId: meeting.id } 
              })}
            >
              Reschedule
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
});

// Meeting rescheduled component
const MeetingRescheduled = memo(function MeetingRescheduled({ data }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-blue-500/10">
          <Calendar className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 space-y-3">
          <h4 className="font-medium">Meeting Rescheduled</h4>
          
          <div className="space-y-2">
            {/* Previous time */}
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">Previous Time:</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {format(new Date(data.previousTime.startTime), 'MMM d, h:mm a')} - 
                  {format(new Date(data.previousTime.endTime), 'h:mm a')}
                </span>
              </div>
            </div>
            
            {/* New time */}
            <div className="p-3 bg-primary/10 rounded-md">
              <p className="text-sm font-medium mb-1">New Time:</p>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3 w-3" />
                <span>
                  {format(new Date(data.newTime.startTime), 'MMM d, h:mm a')} - 
                  {format(new Date(data.newTime.endTime), 'h:mm a')}
                </span>
              </div>
            </div>
            
            {/* Notifications */}
            {data.notificationsSent && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>All attendees have been notified</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});

export default CalendarDisplay;