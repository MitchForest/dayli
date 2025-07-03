import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type GroupBySenderResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  emailIds: z.array(z.string()).describe('Array of email IDs to group'),
  minGroupSize: z.number().min(1).optional().default(2).describe('Minimum emails per sender to form a group'),
});

export const groupBySender = registerTool(
  createTool<typeof parameters, GroupBySenderResponse>({
    name: 'email_groupBySender',
    description: 'Group emails by sender for batch processing',
    parameters,
    metadata: {
      category: 'email',
      displayName: 'Group Emails by Sender',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ emailIds, minGroupSize }) => {
      try {
        const emailService = ServiceFactory.getInstance().getGmailService();
        
        const senderMap = new Map<string, {
          sender: string;
          senderEmail: string;
          emailIds: string[];
        }>();
        
        // Process each email to extract sender
        for (const emailId of emailIds) {
          try {
            const email = await emailService.getMessage(emailId);
            
            if (!email) continue;
            
            // Extract sender information
            const headers = email.payload?.headers || [];
            const fromHeader = headers.find(h => h.name === 'From');
            
            if (fromHeader?.value) {
              // Parse sender email and name
              const fromValue = fromHeader.value;
              const emailMatch = fromValue.match(/<(.+?)>/) || fromValue.match(/([^\s]+@[^\s]+)/);
              
              if (emailMatch && emailMatch[1]) {
                const senderEmail = emailMatch[1];
                const senderName = fromValue.replace(/<.*?>/, '').trim() || senderEmail;
                
                // Group by sender email
                if (!senderMap.has(senderEmail)) {
                  senderMap.set(senderEmail, {
                    sender: senderName,
                    senderEmail: senderEmail,
                    emailIds: [],
                  });
                }
                
                const group = senderMap.get(senderEmail);
                if (group) {
                  group.emailIds.push(emailId);
                }
              }
            }
          } catch (error) {
            console.warn(`[Tool: groupBySender] Failed to process email ${emailId}:`, error);
          }
        }
        
        // Convert to array and filter by minimum group size
        const groups = Array.from(senderMap.values())
          .filter(group => group.emailIds.length >= minGroupSize)
          .map(group => ({
            sender: group.sender,
            senderEmail: group.senderEmail,
            count: group.emailIds.length,
            emailIds: group.emailIds,
          }))
          .sort((a, b) => b.count - a.count); // Sort by count descending
        
        const totalGrouped = groups.reduce((sum, group) => sum + group.count, 0);
        
        console.log(`[Tool: groupBySender] Created ${groups.length} groups from ${emailIds.length} emails`);
        
        return {
          success: true,
          groups,
          totalGroups: groups.length,
          totalGroupedEmails: totalGrouped,
          ungroupedEmails: emailIds.length - totalGrouped,
        };
        
      } catch (error) {
        console.error('[Tool: groupBySender] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to group emails',
          groups: [],
          totalGroups: 0,
          totalGroupedEmails: 0,
          ungroupedEmails: emailIds.length,
        };
      }
    },
  })
); 