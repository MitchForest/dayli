/*
import { NextRequest, NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase-server';
import { createDailyPlanningWorkflow } from '@/modules/workflows/graphs/dailyPlanning';

export async function POST(req: NextRequest) {
  try {
    // Create server-side Supabase client
    const supabase = await createServerActionClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await req.json();
    const workflow = createDailyPlanningWorkflow(supabase);
    
    // Get initial state
    const initialState = {
      userId: user.id,
      date: date || new Date().toISOString().split('T')[0],
      userPreferences: null,
      existingMeetings: [],
      unreadEmails: {
        count: 42, // Mock data for MVP
        urgent: 3,
        newsletters: 15,
      },
      backlogTasks: [] as Array<{
        id: string;
        title: string;
        priority: 'high' | 'medium' | 'low' | null;
        estimated_minutes?: number;
        source: string | null;
      }>,
      generatedSchedule: [],
    };

    // Fetch backlog tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'backlog')
      .order('created_at', { ascending: false });

    // Transform tasks to match workflow expectations
    initialState.backlogTasks = (tasks || []).map((task, index) => ({
      id: task.id,
      title: task.title,
      priority: index < 3 ? 'high' : index < 7 ? 'medium' : 'low' as 'high' | 'medium' | 'low',
      estimated_minutes: 60, // Default 1 hour per task
      source: task.source,
    }));

    // Run the workflow
    const result = await workflow.invoke(initialState);

    return NextResponse.json({
      success: true,
      schedule: result.generatedSchedule,
    });
  } catch (error) {
    console.error('Daily planning workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to run daily planning workflow' },
      { status: 500 }
    );
  }
}
*/

// Temporary placeholder until workflow is reimplemented
import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Daily planning workflow is currently being refactored' },
    { status: 503 }
  );
} 