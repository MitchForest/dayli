import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ShowPatternsResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';

export const showPatterns = registerTool(
  createTool<typeof parameters, ShowPatternsResponse>({
    name: 'system_showPatterns',
    description: 'Display learned patterns and insights about user behavior and preferences',
    parameters: z.object({
      category: z.enum(['all', 'scheduling', 'tasks', 'email', 'productivity']).default('all'),
      timeframe: z.enum(['week', 'month', 'all_time']).default('month'),
      includeRecommendations: z.boolean().default(true),
    }),
    metadata: {
      category: 'system',
      displayName: 'Show Patterns',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ category, timeframe, includeRecommendations }) => {
      const userId = await getCurrentUserId();
      
      // TODO: Implement pattern service in Sprint 4.4
      // For now, return empty patterns
      const patterns: any[] = [];
      
      if (!patterns || patterns.length === 0) {
        return {
          success: true,
          patterns: [],
        };
      }
      
      // Group patterns by category
      const groupedPatterns = patterns.reduce((acc: any, pattern: any) => {
        const cat = pattern.category || 'general';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(pattern);
        return acc;
      }, {});
      
      // Create pattern components
      const patternComponents = Object.entries(groupedPatterns).map(([cat, catPatterns]: any) => ({
        type: 'patternGroup' as const,
        data: {
          category: cat,
          patterns: catPatterns.map((p: any) => ({
            id: p.id,
            type: p.type,
            description: p.description,
            confidence: p.confidence,
            frequency: p.frequency,
            lastSeen: p.lastSeen,
            examples: p.examples?.slice(0, 3),
          })),
        },
      }));
      
      // Generate recommendations if requested
      let recommendations: any[] = [];
      if (includeRecommendations && patterns.length > 0) {
        // TODO: Implement recommendation generation in Sprint 4.4
        recommendations = [];
      }
      
      const recommendationComponents = recommendations.map((rec: any) => ({
        type: 'recommendation' as const,
        data: {
          title: rec.title,
          description: rec.description,
          confidence: rec.confidence,
          basedOn: rec.basedOnPatterns,
          action: rec.suggestedAction,
        },
      }));
      
      // Calculate pattern statistics
      const avgConfidence = patterns.reduce((sum: number, p: any) => sum + p.confidence, 0) / patterns.length;
      const strongPatterns = patterns.filter((p: any) => p.confidence > 0.8).length;
      
      console.log(`[Tool: showPatterns] Found ${patterns.length} patterns for ${category}`);
      
      // Return pure data
      return {
        success: true,
        patterns: patterns.map((p: any) => ({
          category: p.category || 'general',
          pattern: p.description || p.pattern || '',
          confidence: p.confidence || 0,
          examples: p.examples || [],
        })),
      };
    },
  })
);

const parameters = z.object({
  category: z.enum(['all', 'scheduling', 'tasks', 'email', 'productivity']).default('all'),
  timeframe: z.enum(['week', 'month', 'all_time']).default('month'),
  includeRecommendations: z.boolean().default(true),
});