import { ServiceConfig } from '../interfaces/base.interface';
import { ScheduleService } from '../interfaces/schedule.interface';
import { TaskService } from '../interfaces/task.interface';
import { PreferenceService } from '../interfaces/preference.interface';

// Real implementations
import { RealScheduleService } from '../real/schedule.service';
import { RealTaskService } from '../real/task.service';
import { RealPreferenceService } from '../real/preference.service';

// Mock implementations
import { MockScheduleService } from '../mock/schedule.service';
import { MockTaskService } from '../mock/task.service';
import { MockPreferenceService } from '../mock/preference.service';

export class ServiceFactory {
  private static instance: ServiceFactory;
  private config: ServiceConfig | null = null;
  private useMockServices = true; // Default to mock for now

  private constructor() {}

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  configure(config: ServiceConfig | null, useMock = true): void {
    this.config = config;
    this.useMockServices = useMock;
    
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
    
    return this.useMockServices
      ? new MockScheduleService(this.config)
      : new RealScheduleService(this.config);
  }

  getTaskService(): TaskService {
    if (!this.config) {
      throw new Error('ServiceFactory not configured. Call configure() first.');
    }
    
    return this.useMockServices
      ? new MockTaskService(this.config)
      : new RealTaskService(this.config);
  }

  getPreferenceService(): PreferenceService {
    if (!this.config) {
      throw new Error('ServiceFactory not configured. Call configure() first.');
    }
    
    return this.useMockServices
      ? new MockPreferenceService(this.config)
      : new RealPreferenceService(this.config);
  }

  // Helper to check if using mock services
  isUsingMockServices(): boolean {
    return this.useMockServices;
  }
  
  // Helper to check if configured
  isConfigured(): boolean {
    return this.config !== null;
  }
} 