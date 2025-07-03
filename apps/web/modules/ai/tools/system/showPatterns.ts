import { tool } from 'ai';
import { z } from 'zod';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';
import { type UniversalToolResponse } from '../../schemas/universal.schema';

export const showPatterns = tool({
  description: 'Display learned patterns and insights about user behavior and preferences',
  parameters: z.object({
    category: z.enum(['all', 'scheduling', 'tasks', 'email', 'productivity']).default('all'),
    timeframe: z.enum(['week', 'month', 'all_time']).default('month'),
    includeRecommendations: z.boolean().default(true),
  }),
  execute: async ({ category, timeframe, includeRecommendations }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'showPatterns',
      operation: 'read' as const,
      resourceType: 'pattern' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      const factory = ServiceFactory.getInstance();
      const patternService = factory.getPatternService();
      
      // Get learned patterns
      const patterns = await patternService.getUserPatterns({
        userId,
        category: category === 'all' ? undefined : category,
        timeframe,
      });
      
      if (!patterns || patterns.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            message: 'No patterns detected yet. Keep using the system to build personalized insights.',
            category,
            timeframe,
          },
          {
            type: 'card',
            title: 'Building Your Patterns',
            description: 'I\'m still learning about your preferences. The more you use the system, the better I can help!',
            priority: 'low',
            components: [],
          }
        );
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
      let recommendations = [];
      if (includeRecommendations) {
        recommendations = await patternService.generateRecommendations({
          userId,
          patterns,
          limit: 5,
        });
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
      
      const statsComponent = {
        type: 'metrics' as const,
        data: {
          title: 'Pattern Statistics',
          metrics: [
            { label: 'Total Patterns', value: patterns.length.toString(), trend: 'up' },
            { label: 'Strong Patterns', value: strongPatterns.toString(), trend: 'up' },
            { label: 'Avg Confidence', value: `${Math.round(avgConfidence * 100)}%`, trend: avgConfidence > 0.7 ? 'up' : 'neutral' },
            { label: 'Categories', value: Object.keys(groupedPatterns).length.toString(), trend: 'neutral' },
          ],
        },
      };
      
      return buildToolResponse(
        toolOptions,
        {
          patterns,
          groupedPatterns,
          recommendations,
          statistics: {
            total: patterns.length,
            strongPatterns,
            avgConfidence,
            categories: Object.keys(groupedPatterns),
          },
        },
        {
          type: 'list',
          title: 'Your Learned Patterns',
          description: `Showing ${patterns.length} patterns from ${timeframe === 'all_time' ? 'all time' : `the last ${timeframe}`}`,
          priority: 'medium',
          components: [
            statsComponent,
            ...patternComponents,
            ...(recommendationComponents.length > 0 ? [{
              type: 'section' as const,
              data: {
                title: 'Personalized Recommendations',
                components: recommendationComponents,
              },
            }] : []),
          ],
        },
        {
          suggestions: [
            'Apply recommendations',
            'Update preferences based on patterns',
            'View specific category patterns',
          ],
          actions: recommendations.length > 0 ? [{
            id: 'apply-recommendations',
            label: 'Apply Top Recommendation',
            icon: 'sparkles',
            variant: 'primary',
            action: recommendations[0].suggestedAction,
          }] : [],
        }
      );
    } catch (error) {
      return buildErrorResponse(toolOptions, error, {
        title: 'Failed to retrieve patterns',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});