import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, Calendar, TrendingUp, AlertCircle, 
  BarChart3, Target, Zap
} from 'lucide-react';
import { formatDistanceStrict } from 'date-fns';

interface ScheduleAnalysisDisplayProps {
  toolName: string;
  data: any;
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const ScheduleAnalysisDisplay = memo(function ScheduleAnalysisDisplay({ 
  toolName,
  data, 
  onAction 
}: ScheduleAnalysisDisplayProps) {
  // Handle different schedule analysis tools
  if (toolName === 'schedule_findGaps') {
    return <FindGapsDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'schedule_batchCreateBlocks') {
    return <BatchCreateBlocksDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'schedule_analyzeUtilization') {
    return <AnalyzeUtilizationDisplay data={data} onAction={onAction} />;
  }
  
  // Fallback
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Find gaps display
const FindGapsDisplay = memo(function FindGapsDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to find gaps'}</p>
        </div>
      </Card>
    );
  }

  const gaps = data.gaps || [];
  const totalMinutes = data.totalAvailableMinutes || 0;
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-500/10">
            <Clock className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Available Time Slots</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {gaps.length} gaps found • {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m available
            </p>
          </div>
        </div>
        
        {gaps.length > 0 ? (
          <div className="space-y-2">
            {gaps.map((gap: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-md">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {gap.duration} min
                  </Badge>
                  <span className="text-sm">
                    {gap.startTime} - {gap.endTime}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAction?.({ 
                    type: 'fill_gap', 
                    payload: { gap } 
                  })}
                >
                  Fill
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No gaps found in the specified time range
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
});

// Batch create blocks display
const BatchCreateBlocksDisplay = memo(function BatchCreateBlocksDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to create blocks'}</p>
        </div>
      </Card>
    );
  }

  const created = data.created || [];
  const conflicts = data.conflicts || [];
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-500/10">
            <Calendar className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Batch Creation Results</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {created.length} blocks created successfully
              {conflicts.length > 0 && ` • ${conflicts.length} conflicts`}
            </p>
          </div>
        </div>
        
        {created.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Created Blocks:</h5>
            {created.map((block: any) => (
              <div key={block.id} className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="text-xs">
                  {block.type}
                </Badge>
                <span>{block.title}</span>
                <span className="text-muted-foreground">
                  {block.startTime} - {block.endTime}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {conflicts.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">Conflicts detected:</div>
                {conflicts.map((conflict: any, idx: number) => (
                  <div key={idx} className="text-xs">
                    {conflict.block.title}: {conflict.reason}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
});

// Analyze utilization display
const AnalyzeUtilizationDisplay = memo(function AnalyzeUtilizationDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to analyze schedule'}</p>
        </div>
      </Card>
    );
  }

  const utilization = data.utilization || 0;
  const focusTime = data.focusTime || 0;
  const fragmentedTime = data.fragmentedTime || 0;
  const suggestions = data.suggestions || [];
  
  const getUtilizationColor = (util: number) => {
    if (util >= 80) return 'text-red-600 bg-red-500/10';
    if (util >= 60) return 'text-green-600 bg-green-500/10';
    return 'text-yellow-600 bg-yellow-500/10';
  };
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-purple-500/10">
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Schedule Analysis</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Efficiency insights and optimization opportunities
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted rounded-md">
            <div className={`text-2xl font-bold ${getUtilizationColor(utilization)}`}>
              {utilization}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Utilization</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-md">
            <div className="text-2xl font-bold text-blue-600">
              {Math.floor(focusTime / 60)}h
            </div>
            <div className="text-xs text-muted-foreground mt-1">Focus Time</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-md">
            <div className="text-2xl font-bold text-orange-600">
              {fragmentedTime}m
            </div>
            <div className="text-xs text-muted-foreground mt-1">Fragmented</div>
          </div>
        </div>
        
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-600" />
              Suggestions
            </h5>
            {suggestions.map((suggestion: string, idx: number) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <Target className="h-3 w-3 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">{suggestion}</span>
              </div>
            ))}
          </div>
        )}
        
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onAction?.({ type: 'optimize_schedule' })}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Optimize Schedule
        </Button>
      </div>
    </Card>
  );
});

export default ScheduleAnalysisDisplay;
