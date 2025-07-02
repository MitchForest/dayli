import { createServerActionClient } from '@/lib/supabase-server';
import { z } from 'zod';

// Schema for workflow state
const workflowStateSchema = z.object({
  workflowId: z.string(),
  userId: z.string(),
  workflowType: z.string(),
  currentStep: z.string(),
  state: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorkflowState = z.infer<typeof workflowStateSchema>;

interface PersistenceOptions {
  ttlHours?: number; // Time to live in hours
  autoCleanup?: boolean; // Whether to auto-cleanup expired states
}

export class WorkflowPersistenceService {
  private static instance: WorkflowPersistenceService;
  private cleanupInterval?: NodeJS.Timeout;
  
  static getInstance(): WorkflowPersistenceService {
    if (!WorkflowPersistenceService.instance) {
      WorkflowPersistenceService.instance = new WorkflowPersistenceService();
    }
    return WorkflowPersistenceService.instance;
  }
  
  constructor() {
    // Start cleanup routine if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupRoutine();
    }
  }
  
  /**
   * Save workflow state to database
   */
  async saveState(
    workflowId: string,
    workflowType: string,
    currentStep: string,
    state: Record<string, any>,
    options: PersistenceOptions = {}
  ): Promise<void> {
    const { ttlHours = 24 } = options;
    
    try {
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ttlHours);
      
      // Upsert workflow state
      const { error } = await supabase
        .from('workflow_states')
        .upsert({
          workflow_id: workflowId,
          user_id: user.id,
          workflow_type: workflowType,
          current_step: currentStep,
          state: state,
          metadata: {
            ttl_hours: ttlHours,
            saved_at: new Date().toISOString(),
          },
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'workflow_id,user_id',
        });
      
      if (error) {
        console.error('[WorkflowPersistence] Save error:', error);
        throw new Error(`Failed to save workflow state: ${error.message}`);
      }
      
      console.log(`[WorkflowPersistence] Saved state for workflow ${workflowId}`);
    } catch (error) {
      console.error('[WorkflowPersistence] Save failed:', error);
      throw error;
    }
  }
  
  /**
   * Restore workflow state from database
   */
  async restoreState(workflowId: string): Promise<WorkflowState | null> {
    try {
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get workflow state
      const { data, error } = await supabase
        .from('workflow_states')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No state found
          return null;
        }
        throw new Error(`Failed to restore workflow state: ${error.message}`);
      }
      
      // Check if expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        console.log(`[WorkflowPersistence] State for workflow ${workflowId} has expired`);
        // Clean up expired state
        await this.deleteState(workflowId);
        return null;
      }
      
      return {
        workflowId: data.workflow_id,
        userId: data.user_id,
        workflowType: data.workflow_type,
        currentStep: data.current_step,
        state: data.state,
        metadata: data.metadata,
        expiresAt: data.expires_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error('[WorkflowPersistence] Restore failed:', error);
      return null;
    }
  }
  
  /**
   * Delete workflow state
   */
  async deleteState(workflowId: string): Promise<void> {
    try {
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      const { error } = await supabase
        .from('workflow_states')
        .delete()
        .eq('workflow_id', workflowId)
        .eq('user_id', user.id);
      
      if (error) {
        throw new Error(`Failed to delete workflow state: ${error.message}`);
      }
      
      console.log(`[WorkflowPersistence] Deleted state for workflow ${workflowId}`);
    } catch (error) {
      console.error('[WorkflowPersistence] Delete failed:', error);
      throw error;
    }
  }
  
  /**
   * List all workflow states for current user
   */
  async listStates(workflowType?: string): Promise<WorkflowState[]> {
    try {
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      let query = supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (workflowType) {
        query = query.eq('workflow_type', workflowType);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Failed to list workflow states: ${error.message}`);
      }
      
      return (data || []).map(item => ({
        workflowId: item.workflow_id,
        userId: item.user_id,
        workflowType: item.workflow_type,
        currentStep: item.current_step,
        state: item.state,
        metadata: item.metadata,
        expiresAt: item.expires_at,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    } catch (error) {
      console.error('[WorkflowPersistence] List failed:', error);
      return [];
    }
  }
  
  /**
   * Clean up expired workflow states
   */
  async cleanupExpired(): Promise<number> {
    try {
      const supabase = await createServerActionClient();
      
      const { data, error } = await supabase
        .from('workflow_states')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('workflow_id');
      
      if (error) {
        console.error('[WorkflowPersistence] Cleanup error:', error);
        return 0;
      }
      
      const count = data?.length || 0;
      if (count > 0) {
        console.log(`[WorkflowPersistence] Cleaned up ${count} expired workflow states`);
      }
      
      return count;
    } catch (error) {
      console.error('[WorkflowPersistence] Cleanup failed:', error);
      return 0;
    }
  }
  
  /**
   * Start automatic cleanup routine
   */
  private startCleanupRoutine(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpired();
    }, 60 * 60 * 1000); // 1 hour
    
    // Also run cleanup on startup
    this.cleanupExpired();
  }
  
  /**
   * Stop cleanup routine (for testing)
   */
  stopCleanupRoutine(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  
  /**
   * Check if a workflow can be resumed
   */
  async canResume(workflowId: string): Promise<boolean> {
    const state = await this.restoreState(workflowId);
    return state !== null;
  }
  
  /**
   * Update just the current step without changing state
   */
  async updateStep(workflowId: string, currentStep: string): Promise<void> {
    try {
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      const { error } = await supabase
        .from('workflow_states')
        .update({
          current_step: currentStep,
          updated_at: new Date().toISOString(),
        })
        .eq('workflow_id', workflowId)
        .eq('user_id', user.id);
      
      if (error) {
        throw new Error(`Failed to update workflow step: ${error.message}`);
      }
    } catch (error) {
      console.error('[WorkflowPersistence] Update step failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const workflowPersistence = WorkflowPersistenceService.getInstance(); 