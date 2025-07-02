import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, differenceInMinutes, format } from 'date-fns';

interface Inefficiency {
  type: 'fragmentation' | 'context_switching' | 'energy_misalignment' | 'overload' | 'poor_batching';
  severity: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  examples: string[];
  recommendation: string;
  potentialTimeSaved?: number; // minutes
}

export const detectScheduleInefficiencies = tool({
  description: 'Analyze schedule for inefficiencies like fragmentation, context switching, and energy misalignment',
  parameters: z.object({
    date: z.string().describe('Date to analyze (YYYY-MM-DD)'),
    includeRecommendations: z.boolean().optional().default(true).describe('Include improvement recommendations'),
  }),
  execute: async ({ date, includeRecommendations }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'detectScheduleInefficiencies',
      operation: 'read' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const taskService = ServiceFactory.getInstance().getTaskService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get user preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      // Get schedule blocks
      const blocks = await scheduleService.getScheduleForDate(date);
      
      // Get tasks for context
      const tasks = await taskService.getTasks();
      
      const inefficiencies: Inefficiency[] = [];
      
      // 1. Detect fragmentation
      const gaps: number[] = [];
      for (let i = 0; i < blocks.length - 1; i++) {
        const gap = differenceInMinutes(blocks[i + 1].startTime, blocks[i].endTime);
        if (gap > 0 && gap < 30) {
          gaps.push(gap);
        }
      }
      
      if (gaps.length >= 3) {
        inefficiencies.push({
          type: 'fragmentation',
          severity: gaps.length >= 5 ? 'high' : 'medium',
          description: `${gaps.length} small gaps fragmenting your day`,
          impact: `Lost ${gaps.reduce((sum, g) => sum + g, 0)} minutes to transitions`,
          examples: gaps.slice(0, 3).map(g => `${g}-minute gap`),
          recommendation: 'Consolidate blocks to create longer focus periods',
          potentialTimeSaved: Math.round(gaps.reduce((sum, g) => sum + g, 0) * 0.5),
        });
      }
      
      // 2. Detect context switching
      let contextSwitches = 0;
      const contextMap = new Map<string, number>();
      
      for (let i = 0; i < blocks.length - 1; i++) {
        const current = blocks[i];
        const next = blocks[i + 1];
        
        // Count different types
        contextMap.set(current.type, (contextMap.get(current.type) || 0) + 1);
        
        if (current.type !== next.type) {
          contextSwitches++;
        }
      }
      
      if (contextSwitches >= 4) {
        inefficiencies.push({
          type: 'context_switching',
          severity: contextSwitches >= 6 ? 'high' : 'medium',
          description: `${contextSwitches} context switches between different activities`,
          impact: 'Each switch costs 15-25 minutes of refocus time',
          examples: Array.from(contextMap.entries())
            .map(([type, count]) => `${type}: ${count} blocks`),
          recommendation: 'Batch similar activities together',
          potentialTimeSaved: contextSwitches * 20,
        });
      }
      
      // 3. Detect energy misalignment
      const morningBlocks = blocks.filter(b => b.startTime.getHours() < 12);
      const afternoonBlocks = blocks.filter(b => b.startTime.getHours() >= 14 && b.startTime.getHours() < 17);
      
      const lowEnergyInMorning = morningBlocks.filter(b => 
        b.type === 'email' || b.type === 'break'
      ).length;
      
      const highEnergyInAfternoon = afternoonBlocks.filter(b => 
        b.type === 'work' && b.metadata?.complexity === 'high'
      ).length;
      
      if (lowEnergyInMorning >= 2 || highEnergyInAfternoon >= 2) {
        inefficiencies.push({
          type: 'energy_misalignment',
          severity: 'medium',
          description: 'Activities not aligned with natural energy levels',
          impact: 'Reduced productivity and increased fatigue',
          examples: [
            `${lowEnergyInMorning} low-energy tasks in high-energy morning`,
            `${highEnergyInAfternoon} complex tasks in lower-energy afternoon`,
          ],
          recommendation: 'Schedule deep work in morning, meetings in afternoon',
        });
      }
      
      // 4. Detect overload
      const totalWorkMinutes = blocks
        .filter(b => b.type !== 'break')
        .reduce((sum, b) => sum + differenceInMinutes(b.endTime, b.startTime), 0);
      
      const breakMinutes = blocks
        .filter(b => b.type === 'break')
        .reduce((sum, b) => sum + differenceInMinutes(b.endTime, b.startTime), 0);
      
      if (totalWorkMinutes > 420 && breakMinutes < 60) { // 7+ hours work, <1 hour breaks
        inefficiencies.push({
          type: 'overload',
          severity: 'high',
          description: 'Insufficient breaks for workload',
          impact: 'Risk of burnout and decreased afternoon productivity',
          examples: [
            `${Math.round(totalWorkMinutes / 60)} hours of work`,
            `Only ${breakMinutes} minutes of breaks`,
          ],
          recommendation: 'Add 5-10 minute breaks every hour',
          potentialTimeSaved: -60, // Negative because we're adding breaks
        });
      }
      
      // 5. Detect poor batching
      const emailBlocks = blocks.filter(b => b.type === 'email');
      if (emailBlocks.length >= 3) {
        inefficiencies.push({
          type: 'poor_batching',
          severity: 'low',
          description: 'Email processing scattered throughout the day',
          impact: 'Constant interruptions and reactive workflow',
          examples: emailBlocks.map(b => 
            `Email at ${format(b.startTime, 'HH:mm')}`
          ).slice(0, 3),
          recommendation: 'Batch emails into 2-3 dedicated blocks',
          potentialTimeSaved: 30,
        });
      }
      
      // Calculate efficiency score
      const efficiencyScore = Math.max(0, 100 - (inefficiencies.length * 15) - 
        inefficiencies.filter(i => i.severity === 'high').length * 10);
      
      const totalPotentialSaved = inefficiencies
        .filter(i => i.potentialTimeSaved)
        .reduce((sum, i) => sum + (i.potentialTimeSaved || 0), 0);
      
      return buildToolResponse(
        toolOptions,
        {
          date,
          inefficiencies,
          efficiencyScore,
          summary: {
            totalInefficiencies: inefficiencies.length,
            highSeverity: inefficiencies.filter(i => i.severity === 'high').length,
            mediumSeverity: inefficiencies.filter(i => i.severity === 'medium').length,
            lowSeverity: inefficiencies.filter(i => i.severity === 'low').length,
            potentialTimeSaved: totalPotentialSaved,
          },
        },
        {
          type: 'list',
          title: 'Schedule Inefficiencies Detected',
          description: `Found ${inefficiencies.length} inefficiencies - Efficiency score: ${efficiencyScore}%`,
          priority: inefficiencies.some(i => i.severity === 'high') ? 'high' : 'medium',
          components: inefficiencies.slice(0, 3).map(inefficiency => ({
            type: 'progressIndicator',
            data: {
              label: inefficiency.description,
              percentage: inefficiency.severity === 'high' ? 80 : inefficiency.severity === 'medium' ? 50 : 30,
              description: inefficiency.recommendation,
              current: 0,
              total: 100,
            },
          })),
        },
        {
          suggestions: includeRecommendations && inefficiencies.length > 0 ? [
            'Apply time-blocking for better focus',
            'Batch similar activities together',
            'Protect morning hours for deep work',
            'Schedule regular breaks',
          ] : [],
          notification: {
            show: true,
            type: efficiencyScore < 70 ? 'warning' : 'info',
            message: efficiencyScore < 70 
              ? `Schedule needs optimization - ${Math.abs(totalPotentialSaved)} minutes could be saved`
              : 'Schedule is reasonably efficient',
            duration: 4000,
          },
          actions: inefficiencies.length > 0 ? [{
            id: 'optimize-schedule',
            label: 'Optimize Schedule',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Help me fix the ${inefficiencies[0].type.replace('_', ' ')} issue`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[DETECT INEFFICIENCIES] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Inefficiency Detection Failed',
          description: 'Could not analyze schedule inefficiencies.',
        }
      );
    }
  },
}); 