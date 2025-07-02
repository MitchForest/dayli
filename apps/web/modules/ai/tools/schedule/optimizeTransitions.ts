import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, differenceInMinutes, format } from 'date-fns';

interface TransitionIssue {
  type: 'context_switch' | 'location_change' | 'energy_mismatch' | 'no_buffer';
  fromBlock: any;
  toBlock: any;
  severity: 'high' | 'medium' | 'low';
  impact: string;
  transitionTime: number;
}

interface OptimizationSuggestion {
  type: 'reorder' | 'add_buffer' | 'batch_similar' | 'consolidate';
  description: string;
  blocks: any[];
  expectedImprovement: string;
  feasibility: 'high' | 'medium' | 'low';
}

const CONTEXT_GROUPS = {
  'deep_work': ['coding', 'writing', 'analysis', 'design'],
  'communication': ['email', 'meeting', 'calls', 'slack'],
  'administrative': ['planning', 'review', 'documentation'],
  'creative': ['brainstorming', 'ideation', 'strategy'],
};

export const optimizeTransitions = tool({
  description: 'Analyze and optimize transitions between activities to reduce context switching',
  parameters: z.object({
    date: z.string().describe('Date to analyze (YYYY-MM-DD)'),
    minBufferMinutes: z.number().optional().default(5)
      .describe('Minimum buffer time between activities'),
  }),
  execute: async ({ date, minBufferMinutes }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'optimizeTransitions',
      operation: 'read' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get user preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('meeting_buffer_minutes')
        .eq('user_id', user.id)
        .single();
      
      const preferredBuffer = preferences?.meeting_buffer_minutes || minBufferMinutes;
      
      // Get schedule blocks
      const blocks = await scheduleService.getScheduleForDate(date);
      
      // Get calendar events
      const calendarResponse = await calendarService.listEvents({
        calendarId: 'primary',
        timeMin: `${date}T00:00:00Z`,
        timeMax: `${date}T23:59:59Z`,
      });
      const events = calendarResponse.items || [];
      
      // Combine and sort all activities
      const allActivities = [
        ...blocks.map(b => ({
          ...b,
          source: 'schedule' as const,
          startDateTime: parseISO(`${date}T${b.startTime}`),
          endDateTime: parseISO(`${date}T${b.endTime}`),
        })),
        ...events
          .filter((e: any) => e.start?.dateTime)
          .map((e: any) => ({
            id: e.id,
            title: e.summary,
            type: 'meeting',
            startTime: format(parseISO(e.start.dateTime), 'HH:mm'),
            endTime: format(parseISO(e.end.dateTime), 'HH:mm'),
            startDateTime: parseISO(e.start.dateTime),
            endDateTime: parseISO(e.end.dateTime),
            source: 'calendar' as const,
            location: e.location,
            attendees: e.attendees?.length || 0,
          })),
      ].sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
      
      // Analyze transitions
      const issues: TransitionIssue[] = [];
      const suggestions: OptimizationSuggestion[] = [];
      
      for (let i = 0; i < allActivities.length - 1; i++) {
        const current = allActivities[i];
        const next = allActivities[i + 1];
        
        if (!current || !next) continue;
        
        const transitionTime = differenceInMinutes(next.startDateTime, current.endDateTime);
        
        // Check for no buffer time
        if (transitionTime < preferredBuffer) {
          issues.push({
            type: 'no_buffer',
            fromBlock: current,
            toBlock: next,
            severity: transitionTime < 0 ? 'high' : 'medium',
            impact: 'No time to prepare or transition',
            transitionTime,
          });
        }
        
        // Check for context switches
        const currentContext = getActivityContext(current);
        const nextContext = getActivityContext(next);
        
        if (currentContext !== nextContext && transitionTime < 15) {
          issues.push({
            type: 'context_switch',
            fromBlock: current,
            toBlock: next,
            severity: 'medium',
            impact: 'Mental energy required to switch contexts',
            transitionTime,
          });
        }
        
        // Check for location changes (for meetings)
        if (current.type === 'meeting' && next.type === 'meeting' &&
            current.location && next.location && 
            current.location !== next.location &&
            transitionTime < 15) {
          issues.push({
            type: 'location_change',
            fromBlock: current,
            toBlock: next,
            severity: 'high',
            impact: 'Insufficient time to change locations',
            transitionTime,
          });
        }
        
        // Check for energy mismatches
        if (isHighEnergyActivity(current) && isHighEnergyActivity(next) && 
            transitionTime < 30) {
          issues.push({
            type: 'energy_mismatch',
            fromBlock: current,
            toBlock: next,
            severity: 'low',
            impact: 'Back-to-back high-energy activities',
            transitionTime,
          });
        }
      }
      
      // Generate optimization suggestions
      
      // Look for activities that could be batched
      const contextGroups = new Map<string, typeof allActivities>();
      allActivities.forEach(activity => {
        const context = getActivityContext(activity);
        if (!contextGroups.has(context)) {
          contextGroups.set(context, []);
        }
        contextGroups.get(context)?.push(activity);
      });
      
      // Suggest batching similar activities
      contextGroups.forEach((activities, context) => {
        if (activities.length >= 2) {
          // Check if they're scattered throughout the day
          const firstTime = activities[0]?.startDateTime.getTime() || 0;
          const lastTime = activities[activities.length - 1]?.startDateTime.getTime() || 0;
          const spread = (lastTime - firstTime) / (1000 * 60 * 60); // hours
          
          if (spread > 4) {
            suggestions.push({
              type: 'batch_similar',
              description: `Batch ${context} activities together`,
              blocks: activities,
              expectedImprovement: `Reduce context switching by ${activities.length - 1} times`,
              feasibility: activities.some(a => a.source === 'calendar') ? 'low' : 'high',
            });
          }
        }
      });
      
      // Suggest adding buffers
      const criticalTransitions = issues.filter(i => i.severity === 'high');
      if (criticalTransitions.length > 0) {
        suggestions.push({
          type: 'add_buffer',
          description: `Add ${preferredBuffer}-minute buffers between activities`,
          blocks: criticalTransitions.map(t => t.fromBlock),
          expectedImprovement: 'Prevent rushed transitions and improve preparation',
          feasibility: 'medium',
        });
      }
      
      // Calculate transition efficiency score
      const totalTransitions = allActivities.length - 1;
      const problematicTransitions = issues.length;
      const efficiencyScore = totalTransitions > 0 
        ? Math.round((1 - problematicTransitions / totalTransitions) * 100)
        : 100;
      
      // Calculate context switches
      let contextSwitches = 0;
      for (let i = 0; i < allActivities.length - 1; i++) {
        if (getActivityContext(allActivities[i]) !== getActivityContext(allActivities[i + 1])) {
          contextSwitches++;
        }
      }
      
      return buildToolResponse(
        toolOptions,
        {
          date,
          totalActivities: allActivities.length,
          transitions: {
            total: totalTransitions,
            problematic: problematicTransitions,
            contextSwitches,
            efficiencyScore,
          },
          issues: issues.slice(0, 5).map(issue => ({
            type: issue.type,
            from: issue.fromBlock.title,
            to: issue.toBlock.title,
            severity: issue.severity,
            impact: issue.impact,
            transitionMinutes: issue.transitionTime,
          })),
          suggestions: suggestions.slice(0, 3),
          metrics: {
            averageTransitionTime: totalTransitions > 0
              ? Math.round(allActivities.reduce((sum, _, i) => {
                  if (i === 0) return sum;
                  return sum + differenceInMinutes(
                    allActivities[i]?.startDateTime || new Date(),
                    allActivities[i-1]?.endDateTime || new Date()
                  );
                }, 0) / totalTransitions)
              : 0,
            backToBackMeetings: allActivities.filter((a, i) => 
              i > 0 && a.type === 'meeting' && allActivities[i-1]?.type === 'meeting'
            ).length,
          },
        },
        {
          type: 'list',
          title: 'Transition Optimization Analysis',
          description: `Efficiency score: ${efficiencyScore}% - ${contextSwitches} context switches`,
          priority: efficiencyScore < 70 ? 'high' : 'medium',
          components: [
            {
              type: 'progressIndicator',
              data: {
                label: 'Transition Efficiency',
                percentage: efficiencyScore,
                current: totalTransitions - problematicTransitions,
                total: totalTransitions,
              },
            },
            ...issues.slice(0, 3).map(issue => ({
              type: 'scheduleBlock' as const,
              data: {
                id: `transition-${issue.fromBlock.id}-${issue.toBlock.id}`,
                type: 'blocked' as const,
                title: `${issue.type.replace('_', ' ')} issue`,
                startTime: issue.fromBlock.endTime,
                endTime: issue.toBlock.startTime,
                description: `${issue.fromBlock.title} → ${issue.toBlock.title}: ${issue.impact}`,
              },
            })),
          ],
        },
        {
          suggestions: suggestions.length > 0 ? [
            'Batch similar activities together',
            'Add buffer time between meetings',
            'Group deep work in continuous blocks',
            'Schedule breaks between high-energy tasks',
          ] : [
            'Current transition flow is optimal',
            'Consider protecting current schedule',
            'Maintain activity groupings',
          ],
          notification: {
            show: true,
            type: efficiencyScore < 70 ? 'warning' : 'success',
            message: efficiencyScore < 70
              ? `${issues.length} transition issues detected`
              : 'Transitions are well-optimized',
            duration: 4000,
          },
          actions: suggestions.length > 0 ? [{
            id: 'apply-optimization',
            label: 'Optimize Schedule',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Apply transition optimizations for ${date}`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[TRANSITION OPTIMIZATION] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Transition Optimization Failed',
          description: 'Could not analyze activity transitions.',
        }
      );
    }
  },
});

function getActivityContext(activity: any): string {
  const type = activity.type?.toLowerCase() || '';
  const title = activity.title?.toLowerCase() || '';
  
  for (const [context, keywords] of Object.entries(CONTEXT_GROUPS)) {
    if (keywords.some(keyword => type.includes(keyword) || title.includes(keyword))) {
      return context;
    }
  }
  
  // Default contexts based on type
  if (type === 'meeting') return 'communication';
  if (type === 'work') return 'deep_work';
  if (type === 'email') return 'communication';
  if (type === 'break') return 'break';
  
  return 'other';
}

function isHighEnergyActivity(activity: any): boolean {
  const type = activity.type?.toLowerCase() || '';
  const title = activity.title?.toLowerCase() || '';
  
  const highEnergyKeywords = [
    'meeting', 'presentation', 'interview', 'pitch',
    'brainstorm', 'workshop', 'training', 'call'
  ];
  
  return highEnergyKeywords.some(keyword => 
    type.includes(keyword) || title.includes(keyword)
  );
} 