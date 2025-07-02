import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { OpenAI } from 'openai';
import { addMinutes, parseISO, format } from 'date-fns';

interface ResolutionOption {
  id: string;
  type: 'move' | 'shorten' | 'cancel' | 'virtual' | 'delegate';
  description: string;
  impact: 'low' | 'medium' | 'high';
  details: {
    originalItem: { id: string; title: string; startTime: string; endTime: string };
    proposedChange: { startTime?: string; endTime?: string; cancelled?: boolean; virtual?: boolean };
    affectedItems: Array<{ id: string; title: string; change: string }>;
  };
  feasibility: number; // 0-100
  recommendation: string;
}

export const suggestConflictResolution = tool({
  description: 'Get AI-powered suggestions for resolving scheduling conflicts',
  parameters: z.object({
    conflictType: z.enum(['time_overlap', 'travel_time', 'resource', 'preference'])
      .describe('Type of conflict to resolve'),
    items: z.array(z.object({
      id: z.string(),
      title: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      type: z.enum(['meeting', 'block', 'event']),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      attendees: z.array(z.string()).optional(),
      location: z.string().optional(),
    })).describe('Items involved in the conflict'),
    constraints: z.object({
      mustKeepAll: z.boolean().optional().default(false),
      preferredResolution: z.enum(['minimize_changes', 'prioritize_important', 'maximize_focus']).optional(),
      availableSlots: z.array(z.object({
        startTime: z.string(),
        endTime: z.string(),
      })).optional(),
    }).optional(),
  }),
  execute: async ({ conflictType, items, constraints = {} }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'suggestConflictResolution',
      operation: 'read' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get user preferences for context
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      // Use OpenAI to analyze conflict and suggest resolutions
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const systemPrompt = `You are a scheduling conflict resolution expert. Analyze the conflict and suggest practical resolutions.
      Consider:
      - User preferences: ${JSON.stringify(preferences)}
      - Conflict type: ${conflictType}
      - Constraints: ${JSON.stringify(constraints)}
      
      Provide 3-5 resolution options ranked by feasibility and impact.`;
      
      const userPrompt = `Resolve this ${conflictType} conflict:
      Items: ${JSON.stringify(items)}
      
      Suggest resolutions that:
      1. Minimize disruption
      2. Respect priorities
      3. Consider practical constraints
      4. Maintain work-life balance`;
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });
      
      const aiSuggestions = JSON.parse(completion.choices[0]?.message?.content || '{}');
      
      // Generate resolution options based on conflict type
      const resolutions: ResolutionOption[] = [];
      
      if (conflictType === 'time_overlap') {
        // Option 1: Move the lower priority item
        const [item1, item2] = items;
        if (item1 && item2) {
          resolutions.push({
            id: 'move-lower-priority',
            type: 'move',
            description: `Move "${item2.title}" to a different time slot`,
            impact: 'low',
            details: {
              originalItem: item2,
              proposedChange: {
                startTime: addMinutes(parseISO(item1.endTime), 15).toISOString(),
                endTime: addMinutes(parseISO(item2.endTime), 
                  (parseISO(item1.endTime).getTime() - parseISO(item2.startTime).getTime()) / 60000 + 15
                ).toISOString(),
              },
              affectedItems: [],
            },
            feasibility: 85,
            recommendation: 'Least disruptive option - moves only one item',
          });
          
          // Option 2: Shorten both items
          const duration1 = (parseISO(item1.endTime).getTime() - parseISO(item1.startTime).getTime()) / 60000;
          const duration2 = (parseISO(item2.endTime).getTime() - parseISO(item2.startTime).getTime()) / 60000;
          
          if (duration1 > 30 && duration2 > 30) {
            resolutions.push({
              id: 'shorten-both',
              type: 'shorten',
              description: 'Shorten both items to fit',
              impact: 'medium',
              details: {
                originalItem: item1,
                proposedChange: {
                  endTime: addMinutes(parseISO(item1.startTime), duration1 * 0.8).toISOString(),
                },
                affectedItems: [{
                  id: item2.id,
                  title: item2.title,
                  change: `Shorten by ${Math.round(duration2 * 0.2)} minutes`,
                }],
              },
              feasibility: 70,
              recommendation: 'Good if both items can be condensed',
            });
          }
        }
      }
      
      if (conflictType === 'travel_time') {
        const [item1, item2] = items;
        if (item1 && item2) {
          // Option: Make second item virtual
          resolutions.push({
            id: 'make-virtual',
            type: 'virtual',
            description: `Convert "${item2.title}" to virtual/remote`,
            impact: 'low',
            details: {
              originalItem: item2,
              proposedChange: { virtual: true },
              affectedItems: [],
            },
            feasibility: 90,
            recommendation: 'Eliminates travel time completely',
          });
        }
      }
      
      // Add AI-generated options
      if (aiSuggestions.resolutions) {
        resolutions.push(...aiSuggestions.resolutions);
      }
      
      // Sort by feasibility
      resolutions.sort((a, b) => b.feasibility - a.feasibility);
      
      return buildToolResponse(
        toolOptions,
        {
          conflictType,
          items,
          resolutions: resolutions.slice(0, 5),
          bestOption: resolutions[0],
        },
        {
          type: 'list',
          title: 'Conflict Resolution Options',
          description: `Found ${resolutions.length} ways to resolve the ${conflictType.replace('_', ' ')} conflict`,
          priority: 'high',
          components: resolutions.slice(0, 3).map(resolution => ({
            type: 'confirmationDialog',
            data: {
              title: resolution.description,
              message: resolution.recommendation,
              confirmText: 'Apply This Solution',
              cancelText: 'View Other Options',
              variant: resolution.impact === 'high' ? 'warning' : 'info',
            },
          })),
        },
        {
          suggestions: [
            `Apply the ${resolutions[0]?.type} solution`,
            'View all resolution options',
            'Check calendar for available slots',
            'Adjust scheduling preferences',
          ],
          notification: {
            show: true,
            type: 'info',
            message: `${resolutions.length} resolution options available`,
            duration: 4000,
          },
          actions: resolutions.slice(0, 2).map(resolution => ({
            id: resolution.id,
            label: resolution.description,
            variant: 'primary' as const,
            action: {
              type: 'message',
              message: `Apply resolution: ${resolution.description}`,
            },
          })),
        }
      );
      
    } catch (error) {
      console.error('[SUGGEST RESOLUTION] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Resolution Suggestion Failed',
          description: 'Could not generate conflict resolution options.',
        }
      );
    }
  },
}); 