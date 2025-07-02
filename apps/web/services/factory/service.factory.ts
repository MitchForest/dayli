import { ServiceConfig } from '../interfaces/base.interface';
import { ScheduleService } from '../interfaces/schedule.interface';
import { TaskService } from '../interfaces/task.interface';
import { PreferenceService } from '../interfaces/preference.interface';
import type { IGmailService } from '../interfaces/gmail.interface';
import type { ICalendarService } from '../interfaces/calendar.interface';
import { RealPreferenceService } from '../real/preference.service';
import { RealScheduleService } from '../real/schedule.service';
import { RealTaskService } from '../real/task.service';
import { RealGmailService } from '../real/gmail.service';
import { RealCalendarService } from '../real/calendar.service';
import { createClient } from '@supabase/supabase-js';
import { withRetry, isNetworkError } from '../utils/retry';
import { ServiceError } from '../utils/error-handling';
import { queueForOffline } from '../utils/offline-queue';

// Error handling wrapper
class ErrorHandlingProxy<T extends object> implements ProxyHandler<T> {
  constructor(private target: T, private serviceName: string) {}
  
  get(target: T, prop: string | symbol): any {
    const original = (target as any)[prop];
    if (typeof original === 'function') {
      return async (...args: any[]) => {
        try {
          return await withRetry(
            () => original.apply(target, args),
            {
              maxAttempts: 3,
              initialDelay: 1000,
              shouldRetry: (error) => isNetworkError(error)
            }
          );
        } catch (error) {
          // Log error
          console.error(`[${this.serviceName}] Error in ${String(prop)}:`, error);
          
          // Queue for offline if network error
          if (isNetworkError(error)) {
            await queueForOffline({ 
              service: this.serviceName, 
              method: String(prop), 
              args,
              timestamp: new Date().toISOString()
            });
          }
          
          throw new ServiceError(
            `Failed to ${String(prop)}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'SERVICE_ERROR',
            error
          );
        }
      };
    }
    return original;
  }
}

export class ServiceFactory {
  private static instance: ServiceFactory;
  private config: ServiceConfig;
  private preferenceService: PreferenceService;
  private scheduleService: ScheduleService;
  private taskService: TaskService;
  private gmailService: IGmailService;
  private calendarService: ICalendarService;

  private constructor() {
    // Initialize configuration
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    this.config = {
      userId: 'default-user', // This should be set dynamically
      supabaseClient,
    };

    // Always use real services now
    this.preferenceService = new RealPreferenceService(this.config);
    this.scheduleService = new RealScheduleService(this.config);
    this.taskService = new RealTaskService(this.config);
    this.gmailService = new RealGmailService(this.config);
    this.calendarService = new RealCalendarService(this.config);
  }

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  updateUserId(userId: string): void {
    this.config.userId = userId;
    // Update all services with new config
    this.preferenceService = new RealPreferenceService(this.config);
    this.scheduleService = new RealScheduleService(this.config);
    this.taskService = new RealTaskService(this.config);
    this.gmailService = new RealGmailService(this.config);
    this.calendarService = new RealCalendarService(this.config);
  }

  getPreferenceService(): PreferenceService {
    return new Proxy(
      this.preferenceService,
      new ErrorHandlingProxy(this.preferenceService, 'PreferenceService')
    ) as PreferenceService;
  }

  getScheduleService(): ScheduleService {
    return new Proxy(
      this.scheduleService,
      new ErrorHandlingProxy(this.scheduleService, 'ScheduleService')
    ) as ScheduleService;
  }

  getTaskService(): TaskService {
    return new Proxy(
      this.taskService,
      new ErrorHandlingProxy(this.taskService, 'TaskService')
    ) as TaskService;
  }

  getGmailService(): IGmailService {
    return new Proxy(
      this.gmailService,
      new ErrorHandlingProxy(this.gmailService, 'GmailService')
    ) as IGmailService;
  }

  getCalendarService(): ICalendarService {
    return new Proxy(
      this.calendarService,
      new ErrorHandlingProxy(this.calendarService, 'CalendarService')
    ) as ICalendarService;
  }
} 