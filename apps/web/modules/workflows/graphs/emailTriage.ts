import { StateGraph, END } from '@langchain/langgraph';
import { createChatModel, parseJSONResponse } from '../utils/openai';
import { EmailTriageStateType } from '../types/workflow.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@repo/database/types';

export function createEmailTriageWorkflow(supabase: SupabaseClient<Database>) {
  const model = createChatModel({ temperature: 0.2 });

  const workflow = new StateGraph<EmailTriageStateType>({
    channels: {
      userId: null,
      blockId: null,
      emails: null,
      decisions: null,
      stats: null,
    },
  });

  // Node: Analyze and decide on emails
  workflow.addNode('analyzeEmails', async (state: EmailTriageStateType) => {
    const decisions = [];

    for (const email of state.emails) {
      // Simple decision logic for MVP (no embeddings)
      const senderImportance = Math.floor(Math.random() * 10);
      const isUrgent = email.subject.toLowerCase().includes('urgent') || 
                      email.subject.toLowerCase().includes('asap') ||
                      email.subject.toLowerCase().includes('important');
      
      const prompt = `
        Analyze this email and decide how to handle it:
        
        From: ${email.from_email} ${email.from_name ? `(${email.from_name})` : ''}
        Subject: ${email.subject}
        Preview: ${email.body_preview || 'No preview available'}
        
        Sender importance score: ${senderImportance}/10
        Contains urgent keywords: ${isUrgent}
        
        Decide:
        1. When to handle: "now" (urgent/important), "later" (can wait), or "never" (archive/spam)
        2. Action type: "quick_reply", "thoughtful_response", "archive", or "no_action"
        3. If creating a task for "now" emails, suggest a concise task title
        
        Return a JSON object with: decision, actionType, reasoning, taskTitle (if applicable)
      `;

      const response = await model.invoke(prompt);
      const decision = parseJSONResponse(response.content as string) as any;
      
      decisions.push({
        emailId: email.id,
        decision: decision.decision || (isUrgent || senderImportance > 8 ? 'now' : senderImportance > 5 ? 'later' : 'never'),
        actionType: decision.actionType || 'no_action',
        reasoning: decision.reasoning || 'Automated decision based on importance',
        taskTitle: decision.taskTitle,
      });
    }

    return {
      ...state,
      decisions,
    };
  });

  // Node: Process decisions and update database
  workflow.addNode('processDecisions', async (state: EmailTriageStateType) => {
    const tasksToCreate = [];
    const emailUpdates = [];
    let nowCount = 0;
    let laterCount = 0;
    let neverCount = 0;

    for (const decision of state.decisions) {
      // Update email decision
      emailUpdates.push({
        emailId: decision.emailId,
        decision: decision.decision,
        actionType: decision.actionType,
        processed_at: new Date().toISOString(),
      });

      // Count decisions
      if (decision.decision === 'now') {
        nowCount++;
        // Create task if needed
        if (decision.taskTitle) {
          tasksToCreate.push({
            user_id: state.userId,
            title: decision.taskTitle,
            source: 'email',
            email_id: decision.emailId,
            status: 'backlog',
            priority: 'high',
            estimated_minutes: 30, // Default 30 min for email tasks
          });
        }
      } else if (decision.decision === 'later') {
        laterCount++;
      } else {
        neverCount++;
      }
    }

    // Batch update emails
    for (const update of emailUpdates) {
      const { error } = await supabase
        .from('emails')
        .update({
          decision: update.decision,
          action_type: update.actionType,
          processed_at: update.processed_at,
        })
        .eq('id', update.emailId);
      
      if (error) {
        console.error('Error updating email:', error);
      }
    }

    // Create tasks
    if (tasksToCreate.length > 0) {
      const { error } = await supabase
        .from('tasks')
        .insert(tasksToCreate);
      
      if (error) {
        console.error('Error creating tasks:', error);
      }
    }

    return {
      ...state,
      stats: {
        processed: state.emails.length,
        now: nowCount,
        later: laterCount,
        never: neverCount,
      },
    };
  });

  // Define workflow edges
  workflow.addEdge('analyzeEmails' as any, 'processDecisions' as any);
  workflow.addEdge('processDecisions' as any, END as any);

  return workflow.compile();
} 