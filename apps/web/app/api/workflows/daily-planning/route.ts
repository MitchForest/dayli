import { NextRequest, NextResponse } from 'next/server';
import { createDailyPlanningWorkflow } from '@/modules/workflows/graphs/dailyPlanning';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@repo/database/types';

export async function POST(request: NextRequest) {
  try {
    // Create server-side Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await request.json();
    const workflow = createDailyPlanningWorkflow();

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
    // For MVP, we'll use simple priority assignment
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
    console.error('Daily planning error:', error);
    return NextResponse.json(
      { error: 'Failed to generate schedule' },
      { status: 500 }
    );
  }
} 