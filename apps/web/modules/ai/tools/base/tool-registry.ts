// Central registry for all tools
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools = new Map<string, any>();
  private categories = new Map<string, Set<string>>();
  
  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }
  
  register(tool: any): void {
    const name = tool.__name;
    const category = tool.__metadata?.category;
    
    if (!name) {
      throw new Error('Tool must have a name');
    }
    
    this.tools.set(name, tool);
    
    if (category) {
      if (!this.categories.has(category)) {
        this.categories.set(category, new Set());
      }
      this.categories.get(category)!.add(name);
    }
    
    console.log(`[ToolRegistry] Registered tool: ${name} in category: ${category}`);
  }
  
  getAll(): Record<string, any> {
    return Object.fromEntries(this.tools);
  }
  
  getByCategory(category: string): any[] {
    const toolNames = this.categories.get(category) || new Set();
    return Array.from(toolNames).map(name => this.tools.get(name)).filter(Boolean);
  }
  
  get(name: string): any {
    return this.tools.get(name);
  }
  
  getCategoryList(): string[] {
    return Array.from(this.categories.keys());
  }
  
  getToolCount(): number {
    return this.tools.size;
  }
  
  clear(): void {
    this.tools.clear();
    this.categories.clear();
  }
}

// Helper to auto-register tools
export function registerTool(tool: any): any {
  ToolRegistry.getInstance().register(tool);
  return tool;
}