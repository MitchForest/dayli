import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ToolInvocationDisplay } from './ToolInvocationDisplay';
import { ArrowRight, Sparkles } from 'lucide-react';

interface WorkflowTool {
  name: string;
  state: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

interface WorkflowToolSequenceProps {
  workflowName: string;
  tools: WorkflowTool[];
  overallProgress?: number;
}

export const WorkflowToolSequence = memo(function WorkflowToolSequence({
  workflowName,
  tools,
  overallProgress
}: WorkflowToolSequenceProps) {
  const completedCount = tools.filter(t => t.state === 'completed').length;
  const progress = overallProgress || (completedCount / tools.length) * 100;
  
  // Get workflow display name
  const getWorkflowDisplayName = (name: string): string => {
    if (name.includes('schedule')) return 'Schedule Planning';
    if (name.includes('fillWorkBlock')) return 'Work Block Optimization';
    if (name.includes('fillEmailBlock')) return 'Email Processing';
    return name.replace(/_/g, ' ');
  };
  
  return (
    <Card className="p-4 bg-muted/30">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-pink-500/10">
              <Sparkles className="h-4 w-4 text-pink-600" />
            </div>
            <span className="font-medium text-sm">
              {getWorkflowDisplayName(workflowName)}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {completedCount}/{tools.length} steps
          </Badge>
        </div>
        
        {/* Progress bar */}
        <Progress value={progress} className="h-1.5" />
        
        {/* Tool sequence */}
        <div className="space-y-2">
          {tools.map((tool, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <ToolInvocationDisplay
                toolName={tool.name}
                state={tool.state}
                error={tool.error}
                isPartOfWorkflow={true}
                workflowStep={idx + 1}
                totalSteps={tools.length}
              />
              {idx < tools.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground ml-2" />
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
});

export default WorkflowToolSequence; 