import { ServiceConfig } from '../interfaces/base.interface';
import { ScheduleService } from '../interfaces/schedule.interface';
import { TaskService } from '../interfaces/task.interface';
import { PreferenceService } from '../interfaces/preference.interface';

// Real implementations only
import { RealScheduleService } from '../real/schedule.service';
import { RealTaskService } from '../real/task.service';
import { RealPreferenceService } from '../real/preference.service';

export class ServiceFactory {
  private static instance: ServiceFactory;
  private config: ServiceConfig | null = null;

  private constructor() {}

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  configure(config: ServiceConfig | null): void {
    this.config = config;
    
    if (config) {
      console.log('[ServiceFactory] Configured with user:', config.userId);
    } else {
      console.log('[ServiceFactory] Configuration cleared');
    }
  }

  getScheduleService(): ScheduleService {
    if (!this.config) {
      throw new Error('ServiceFactory not configured. Call configure() first.');
    }
    
    return new RealScheduleService(this.config);
  }

  getTaskService(): TaskService {
    if (!this.config) {
      throw new Error('ServiceFactory not configured. Call configure() first.');
    }
    
    return new RealTaskService(this.config);
  }

  getPreferenceService(): PreferenceService {
    if (!this.config) {
      throw new Error('ServiceFactory not configured. Call configure() first.');
    }
    
    return new RealPreferenceService(this.config);
  }
  
  // Helper to check if configured
  isConfigured(): boolean {
    return this.config !== null;
  }
} 