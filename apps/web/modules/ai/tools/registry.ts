import { CoreTool } from 'ai';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools = new Map<string, CoreTool<any, any>>();

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(name: string, tool: CoreTool<any, any>) {
    this.tools.set(name, tool);
    console.log(`[ToolRegistry] Registered tool: ${name}`);
  }

  registerMany(tools: Record<string, CoreTool<any, any>>) {
    Object.entries(tools).forEach(([name, tool]) => {
      this.register(name, tool);
    });
  }

  getAll(): Record<string, CoreTool<any, any>> {
    return Object.fromEntries(this.tools);
  }

  getByCategory(category: string): Record<string, CoreTool<any, any>> {
    const filtered = Array.from(this.tools.entries())
      .filter(([name]) => name.startsWith(`${category}_`));
    return Object.fromEntries(filtered);
  }

  // Auto-register all tools from subdirectories
  async autoRegister() {
    console.log('[ToolRegistry] Starting auto-registration...');
    
    try {
      // Register new tools with ToolResult format
      const emailTools = await import('./email');
      Object.entries(emailTools).forEach(([name, tool]) => {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
          this.register(`email_${name}`, tool as CoreTool<any, any>);
        }
      });
      
      const taskTools = await import('./task');
      Object.entries(taskTools).forEach(([name, tool]) => {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
          this.register(`task_${name}`, tool as CoreTool<any, any>);
        }
      });
      
      // Register new schedule tools
      const scheduleTools = await import('./schedule');
      Object.entries(scheduleTools).forEach(([name, tool]) => {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
          this.register(`schedule_${name}`, tool as CoreTool<any, any>);
        }
      });
      
      // Register calendar tools
      const calendarTools = await import('./calendar');
      Object.entries(calendarTools).forEach(([name, tool]) => {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
          this.register(`calendar_${name}`, tool as CoreTool<any, any>);
        }
      });
      
      // Register preference tools
      const preferenceTools = await import('./preference');
      Object.entries(preferenceTools).forEach(([name, tool]) => {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
          this.register(`preference_${name}`, tool as CoreTool<any, any>);
        }
      });
      
      // Register workflow tools
      const { optimizeSchedule } = await import('./workflow/optimizeSchedule');
      const { triageEmails } = await import('./workflow/triageEmails');
      const { prioritizeTasks } = await import('./workflow/prioritizeTasks');
      const { optimizeCalendar } = await import('./workflow/optimizeCalendar');
      
      this.register('workflow_optimizeSchedule', optimizeSchedule as CoreTool<any, any>);
      this.register('workflow_triageEmails', triageEmails as CoreTool<any, any>);
      this.register('workflow_prioritizeTasks', prioritizeTasks as CoreTool<any, any>);
      this.register('workflow_optimizeCalendar', optimizeCalendar as CoreTool<any, any>);
      
      // Register system tools
      const systemTools = await import('./system');
      Object.entries(systemTools).forEach(([name, tool]) => {
        if (tool && typeof tool === 'object' && 'execute' in tool) {
          this.register(`system_${name}`, tool as CoreTool<any, any>);
        }
      });
      
      console.log(`[ToolRegistry] Auto-registration complete. Total tools: ${this.tools.size}`);
    } catch (error) {
      console.error('[ToolRegistry] Error during auto-registration:', error);
      throw error;
    }
  }

  // Helper to list all registered tools
  listTools(): string[] {
    return Array.from(this.tools.keys()).sort();
  }

  // Get tool count
  size(): number {
    return this.tools.size;
  }

  // Check if a tool exists
  has(name: string): boolean {
    return this.tools.has(name);
  }

  // Clear all tools (useful for testing)
  clear() {
    this.tools.clear();
  }
}

// Export singleton instance
export const toolRegistry = ToolRegistry.getInstance(); 