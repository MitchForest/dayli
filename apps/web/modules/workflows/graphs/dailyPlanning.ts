import { StateGraph, END } from '@langchain/langgraph';
import { createChatModel, parseJSONResponse } from '../utils/openai';
import { DailyPlanningStateType, GeneratedBlock } from '../types/workflow.types';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@repo/database/types';

// Create the workflow
export function createDailyPlanningWorkflow() {
  const model = createChatModel({ temperature: 0.3 });

  // Initialize state graph without schema - LangGraph will infer types
  const workflow = new StateGraph<DailyPlanningStateType>({
    channels: {
      userId: null,
      date: null,
      userPreferences: null,
      existingMeetings: null,
      unreadEmails: null,
      backlogTasks: null,
      generatedSchedule: null,
    },
  });

  // Node: Fetch user context (simplified - no RAG for MVP)
  workflow.addNode('fetchUserContext', async (state: DailyPlanningStateType) => {
    // Create Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch user preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', state.userId)
      .single();

    // Use defaults if no preferences
    const defaultPreferences = {
      work_start_time: '09:00',
      work_end_time: '17:00',
      lunch_start_time: '12:00',
      lunch_duration_minutes: 60,
      target_deep_work_blocks: 2,
      deep_work_duration_hours: 2,
    };

    return {
      ...state,
      userPreferences: preferences || defaultPreferences,
    };
  });

  // Node: Analyze existing meetings
  workflow.addNode('analyzeMeetings', async (state: DailyPlanningStateType) => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch existing meetings for the day
    const { data: meetings } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', state.userId)
      .eq('type', 'meetings')
      .gte('start_time', `${state.date}T00:00:00`)
      .lte('start_time', `${state.date}T23:59:59`);

    const existingMeetings = (meetings || []).map(m => ({
      id: m.id,
      title: m.title,
      start_time: m.start_time,
      end_time: m.end_time,
    }));

    return {
      ...state,
      existingMeetings,
    };
  });

  // Node: Generate optimal time blocks
  workflow.addNode('generateTimeBlocks', async (state: DailyPlanningStateType) => {
    const prompt = `
      You are a scheduling assistant. Generate an optimal daily schedule based on these constraints:
      
      Work hours: ${state.userPreferences?.work_start_time} to ${state.userPreferences?.work_end_time}
      Existing meetings: ${JSON.stringify(state.existingMeetings)}
      Target work blocks: ${state.userPreferences?.target_deep_work_blocks || 2}
      Work block duration: ${state.userPreferences?.deep_work_duration_hours || 2} hours each
      Lunch time: ${state.userPreferences?.lunch_start_time} at ${state.userPreferences?.lunch_duration_minutes} minutes
      Unread emails: ${state.unreadEmails.count} (${state.unreadEmails.urgent} urgent)
      
      Rules:
      1. Add morning email block (30 min) if emails > 10
      2. Add ${state.userPreferences?.target_deep_work_blocks || 2} work blocks (${state.userPreferences?.deep_work_duration_hours || 2} hours each)
      3. Add lunch break at ${state.userPreferences?.lunch_start_time} for ${state.userPreferences?.lunch_duration_minutes} minutes
      4. Add evening email block if urgent emails > 0
      5. Work around existing meetings
      6. Block remaining time to prevent meeting overload
      
      Return a JSON object with a "schedule" array containing time blocks.
      Each block must have: type (work/email/break/meetings/blocked), title, start_time (HH:MM), end_time (HH:MM).
      Use 24-hour format for times.
    `;

    const response = await model.invoke(prompt);
    const result = parseJSONResponse(response.content as string) as { schedule: GeneratedBlock[] };

    return {
      ...state,
      generatedSchedule: result.schedule,
    };
  });

  // Node: Assign tasks to blocks
  workflow.addNode('assignTasks', async (state: DailyPlanningStateType) => {
    const workBlocks = state.generatedSchedule.filter(b => b.type === 'work');
    const highPriorityTasks = state.backlogTasks
      .filter(t => t.priority === 'high')
      .slice(0, 10); // Limit to top 10 tasks

    // Simple distribution - assign tasks evenly across work blocks
    let taskIndex = 0;
    const scheduleWithTasks = state.generatedSchedule.map(block => {
      if (block.type === 'work' && taskIndex < highPriorityTasks.length) {
        const tasksPerBlock = Math.ceil(highPriorityTasks.length / workBlocks.length);
        const blockTasks = highPriorityTasks
          .slice(taskIndex, taskIndex + tasksPerBlock)
          .map(t => t.id);
        
        taskIndex += tasksPerBlock;
        
        return { ...block, tasks: blockTasks };
      }
      return block;
    });

    return {
      ...state,
      generatedSchedule: scheduleWithTasks,
    };
  });

  // Node: Save to database
  workflow.addNode('saveSchedule', async (state: DailyPlanningStateType) => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Create daily schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('daily_schedules')
      .upsert({
        user_id: state.userId,
        schedule_date: state.date,
        stats: {
          emailsProcessed: 0,
          tasksCompleted: 0,
          focusMinutes: state.generatedSchedule
            .filter(b => b.type === 'work')
            .reduce((acc, b) => {
              const start = new Date(`2024-01-01T${b.start_time}`);
              const end = new Date(`2024-01-01T${b.end_time}`);
              return acc + (end.getTime() - start.getTime()) / 60000;
            }, 0),
        },
      })
      .select()
      .single();

    if (scheduleError) {
      console.error('Error creating schedule:', scheduleError);
      return state;
    }

    // Create time blocks
    const timeBlocks = state.generatedSchedule.map(block => ({
      user_id: state.userId,
      daily_schedule_id: schedule.id,
      start_time: `${state.date}T${block.start_time}:00`,
      end_time: `${state.date}T${block.end_time}:00`,
      type: block.type,
      title: block.title,
      source: 'ai' as const,
      metadata: {
        protected: true,
        tasks: block.tasks,
      },
    }));

    const { error: blocksError } = await supabase
      .from('time_blocks')
      .insert(timeBlocks);

    if (blocksError) {
      console.error('Error creating time blocks:', blocksError);
    }

    return state;
  });

  // Define the workflow edges
  workflow.addEdge('fetchUserContext' as any, 'analyzeMeetings' as any);
  workflow.addEdge('analyzeMeetings' as any, 'generateTimeBlocks' as any);
  workflow.addEdge('generateTimeBlocks' as any, 'assignTasks' as any);
  workflow.addEdge('assignTasks' as any, 'saveSchedule' as any);
  workflow.addEdge('saveSchedule' as any, END as any);

  return workflow.compile();
} 