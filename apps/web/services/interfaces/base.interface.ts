export interface BaseService {
  readonly serviceName: string;
  readonly isRealImplementation: boolean;
}

export interface ServiceConfig {
  userId: string;
  supabaseClient?: any; // Will be typed properly when using real implementation
} 