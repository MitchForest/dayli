import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle2, Clock, Coffee, Mail, Calendar, AlertCircle } from 'lucide-react';
import type { UpdatePreferencesResponse } from '@/modules/ai/tools/types/responses';

interface PreferenceDisplayProps {
  toolName: string;
  data: any; // Will be UpdatePreferencesResponse
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const PreferenceDisplay = memo(function PreferenceDisplay({ 
  toolName,
  data, 
  onAction 
}: PreferenceDisplayProps) {
  if (toolName === 'preference_updatePreferences') {
    return <PreferenceUpdated data={data as UpdatePreferencesResponse} onAction={onAction} />;
  }
  
  // Fallback
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Preference updated component
interface PreferenceUpdatedProps {
  data: UpdatePreferencesResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const PreferenceUpdated = memo(function PreferenceUpdated({ data, onAction }: PreferenceUpdatedProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to update preference'}</p>
        </div>
      </Card>
    );
  }

  const getPreferenceIcon = (key: string) => {
    if (key.includes('Time') || key.includes('Duration')) return Clock;
    if (key.includes('lunch')) return Coffee;
    if (key.includes('email')) return Mail;
    if (key.includes('meeting')) return Calendar;
    return Settings;
  };
  
  const formatPreferenceDisplay = (key: string, value: any) => {
    // Format time values
    if (key.includes('Time') && !key.includes('Duration')) {
      return value; // Already in HH:MM format
    }
    
    // Format duration values
    if (key.includes('Duration') || key.includes('Buffer') || key.includes('Frequency')) {
      return `${value} minutes`;
    }
    
    // Format batch size
    if (key.includes('Size')) {
      return `${value} items`;
    }
    
    return value;
  };
  
  const getPreferenceLabel = (key: string) => {
    const labels: Record<string, string> = {
      workStartTime: 'Work Start Time',
      workEndTime: 'Work End Time',
      lunchTime: 'Lunch Time',
      lunchDuration: 'Lunch Duration',
      focusBlockDuration: 'Focus Block Duration',
      breakFrequency: 'Break Frequency',
      emailBatchSize: 'Email Batch Size',
      meetingBuffer: 'Meeting Buffer Time',
    };
    return labels[key] || key;
  };
  
  const Icon = getPreferenceIcon(data.key);
  
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-green-500/10">
          <Icon className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">Preference Updated</h4>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between p-2 bg-muted rounded-md">
              <span className="text-sm font-medium">{getPreferenceLabel(data.key)}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {formatPreferenceDisplay(data.key, data.previousValue)}
                </Badge>
                <span className="text-muted-foreground">→</span>
                <Badge className="text-xs">
                  {formatPreferenceDisplay(data.key, data.newValue)}
                </Badge>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3">
            Your preference has been updated and will take effect immediately.
          </p>
        </div>
      </div>
    </Card>
  );
});

export default PreferenceDisplay;