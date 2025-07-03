import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ArchiveBatchResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  emailIds: z.array(z.string()).describe('Array of email IDs to archive'),
  reason: z.string().optional().describe('Reason for archiving'),
});

export const archiveBatch = registerTool(
  createTool<typeof parameters, ArchiveBatchResponse>({
    name: 'email_archiveBatch',
    description: 'Archive multiple emails at once',
    parameters,
    metadata: {
      category: 'email',
      displayName: 'Archive Emails in Batch',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ emailIds, reason }) => {
      try {
        const emailService = ServiceFactory.getInstance().getGmailService();
        
        const archivedIds: string[] = [];
        const failed: string[] = [];
        
        // Process each email
        for (const emailId of emailIds) {
          try {
            await emailService.archiveMessage(emailId);
            archivedIds.push(emailId);
          } catch (error) {
            console.warn(`[Tool: archiveBatch] Failed to archive ${emailId}:`, error);
            failed.push(emailId);
          }
        }
        
        console.log(`[Tool: archiveBatch] Archived ${archivedIds.length}/${emailIds.length} emails${reason ? ` (${reason})` : ''}`);
        
        return {
          success: true,
          archived: archivedIds.length,
          failed,
          archivedIds,
        };
        
      } catch (error) {
        console.error('[Tool: archiveBatch] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to archive emails',
          archived: 0,
          failed: emailIds,
          archivedIds: [],
        };
      }
    },
  })
); 