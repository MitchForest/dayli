export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      daily_schedules: {
        Row: {
          created_at: string | null
          id: string
          schedule_date: string
          stats: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          schedule_date: string
          stats?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          schedule_date?: string
          stats?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      emails: {
        Row: {
          action_type: string | null
          body_preview: string | null
          created_at: string | null
          days_in_backlog: number | null
          decision: string | null
          from_email: string
          from_name: string | null
          full_body: string | null
          gmail_id: string | null
          id: string
          importance: string | null
          is_read: boolean | null
          metadata: Json | null
          processed_at: string | null
          received_at: string
          status: string | null
          subject: string
          updated_at: string | null
          urgency: string | null
          user_id: string
        }
        Insert: {
          action_type?: string | null
          body_preview?: string | null
          created_at?: string | null
          days_in_backlog?: number | null
          decision?: string | null
          from_email: string
          from_name?: string | null
          full_body?: string | null
          gmail_id?: string | null
          id?: string
          importance?: string | null
          is_read?: boolean | null
          metadata?: Json | null
          processed_at?: string | null
          received_at: string
          status?: string | null
          subject: string
          updated_at?: string | null
          urgency?: string | null
          user_id: string
        }
        Update: {
          action_type?: string | null
          body_preview?: string | null
          created_at?: string | null
          days_in_backlog?: number | null
          decision?: string | null
          from_email?: string
          from_name?: string | null
          full_body?: string | null
          gmail_id?: string | null
          id?: string
          importance?: string | null
          is_read?: boolean | null
          metadata?: Json | null
          processed_at?: string | null
          received_at?: string
          status?: string | null
          subject?: string
          updated_at?: string | null
          urgency?: string | null
          user_id?: string
        }
        Relationships: []
      }
      embeddings: {
        Row: {
          content: string
          content_type: string
          created_at: string | null
          embedding: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          content: string
          content_type: string
          created_at?: string | null
          embedding: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string | null
          embedding?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean | null
          created_at: string | null
          days_in_backlog: number | null
          description: string | null
          email_id: string | null
          estimated_minutes: number | null
          id: string
          priority: string | null
          score: number | null
          source: string | null
          source_id: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          urgency: number | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          days_in_backlog?: number | null
          description?: string | null
          email_id?: string | null
          estimated_minutes?: number | null
          id?: string
          priority?: string | null
          score?: number | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          urgency?: number | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          days_in_backlog?: number | null
          description?: string | null
          email_id?: string | null
          estimated_minutes?: number | null
          id?: string
          priority?: string | null
          score?: number | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          urgency?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          assigned_emails: Json | null
          assigned_tasks: Json | null
          calendar_event_id: string | null
          conflict_group: number | null
          created_at: string | null
          daily_schedule_id: string | null
          description: string | null
          end_time: string
          energy_level: string | null
          id: string
          metadata: Json | null
          source: string | null
          start_time: string
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_emails?: Json | null
          assigned_tasks?: Json | null
          calendar_event_id?: string | null
          conflict_group?: number | null
          created_at?: string | null
          daily_schedule_id?: string | null
          description?: string | null
          end_time: string
          energy_level?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          start_time: string
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_emails?: Json | null
          assigned_tasks?: Json | null
          calendar_event_id?: string | null
          conflict_group?: number | null
          created_at?: string | null
          daily_schedule_id?: string | null
          description?: string | null
          end_time?: string
          energy_level?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          start_time?: string
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_daily_schedule_id_fkey"
            columns: ["daily_schedule_id"]
            isOneToOne: false
            referencedRelation: "daily_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_patterns: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          last_observed: string | null
          pattern_data: Json
          pattern_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_observed?: string | null
          pattern_data: Json
          pattern_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_observed?: string | null
          pattern_data?: Json
          pattern_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          add_meeting_buffer: boolean | null
          break_schedule: Json | null
          created_at: string | null
          deep_work_duration_hours: number | null
          deep_work_preference: string | null
          email_preferences: Json | null
          evening_triage_duration_minutes: number | null
          evening_triage_time: string | null
          focus_blocks: Json | null
          id: string
          lunch_duration_minutes: number | null
          lunch_start_time: string | null
          meeting_buffer_minutes: number | null
          meeting_windows: Json | null
          morning_triage_duration_minutes: number | null
          morning_triage_time: string | null
          open_time_preferences: Json | null
          protect_deep_work: boolean | null
          show_busy_during_triage: boolean | null
          target_deep_work_blocks: number | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
          work_days: string[] | null
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          add_meeting_buffer?: boolean | null
          break_schedule?: Json | null
          created_at?: string | null
          deep_work_duration_hours?: number | null
          deep_work_preference?: string | null
          email_preferences?: Json | null
          evening_triage_duration_minutes?: number | null
          evening_triage_time?: string | null
          focus_blocks?: Json | null
          id?: string
          lunch_duration_minutes?: number | null
          lunch_start_time?: string | null
          meeting_buffer_minutes?: number | null
          meeting_windows?: Json | null
          morning_triage_duration_minutes?: number | null
          morning_triage_time?: string | null
          open_time_preferences?: Json | null
          protect_deep_work?: boolean | null
          show_busy_during_triage?: boolean | null
          target_deep_work_blocks?: number | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_days?: string[] | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          add_meeting_buffer?: boolean | null
          break_schedule?: Json | null
          created_at?: string | null
          deep_work_duration_hours?: number | null
          deep_work_preference?: string | null
          email_preferences?: Json | null
          evening_triage_duration_minutes?: number | null
          evening_triage_time?: string | null
          focus_blocks?: Json | null
          id?: string
          lunch_duration_minutes?: number | null
          lunch_start_time?: string | null
          meeting_buffer_minutes?: number | null
          meeting_windows?: Json | null
          morning_triage_duration_minutes?: number | null
          morning_triage_time?: string | null
          open_time_preferences?: Json | null
          protect_deep_work?: boolean | null
          show_busy_during_triage?: boolean | null
          target_deep_work_blocks?: number | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_days?: string[] | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: []
      }
      workflow_states: {
        Row: {
          created_at: string | null
          current_node: string | null
          error: string | null
          expires_at: string | null
          id: string
          state: Json
          status: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_node?: string | null
          error?: string | null
          expires_at?: string | null
          id?: string
          state?: Json
          status?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_node?: string | null
          error?: string | null
          expires_at?: string | null
          id?: string
          state?: Json
          status?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      cleanup_expired_workflows: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_mock_patterns: {
        Args: { p_user_id: string }
        Returns: Json
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      task_backlog_summary: {
        Args: { p_user_id: string }
        Returns: {
          total_tasks: number
          high_priority_count: number
          medium_priority_count: number
          low_priority_count: number
          avg_days_in_backlog: number
          stale_tasks_count: number
          categories: Json
        }[]
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
