
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "daily_priorities": {
                  Row: {
                    "created_at": string,"date": string,"done": boolean,"id": string,"position": number,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"done"?: boolean,"id"?: string,"position": number,"title": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"done"?: boolean,"id"?: string,"position"?: number,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"focus_sessions": {
                  Row: {
                    "actual_minutes": number,"created_at": string,"ended_at": string,"goal_id": string | null,"habit_id": string | null,"id": string,"kind": string,"planned_minutes": number,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_minutes": number,"created_at"?: string,"ended_at": string,"goal_id"?: string | null,"habit_id"?: string | null,"id"?: string,"kind"?: string,"planned_minutes": number,"started_at": string,"user_id"?: string
                  }
                  Update: {
                    "actual_minutes"?: number,"created_at"?: string,"ended_at"?: string,"goal_id"?: string | null,"habit_id"?: string | null,"id"?: string,"kind"?: string,"planned_minutes"?: number,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "focus_sessions_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "focus_sessions_habit_id_user_id_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"deleted_at": string | null,"description": string | null,"due_date": string,"id": string,"start_date": string,"status": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"due_date": string,"id"?: string,"start_date"?: string,"status"?: string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"due_date"?: string,"id"?: string,"start_date"?: string,"status"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"habit_logs": {
                  Row: {
                    "date": string,"habit_id": string,"updated_at": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "date": string,"habit_id": string,"updated_at"?: string,"user_id"?: string,"value": number
                  }
                  Update: {
                    "date"?: string,"habit_id"?: string,"updated_at"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_logs_habit_id_user_id_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"habit_schedules": {
                  Row: {
                    "days": (number)[] | null,"frequency": string,"habit_id": string,"id": string,"target": number | null,"times_per_week": number | null,"user_id": string,"valid_from": string,"valid_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "days"?: (number)[] | null,"frequency": string,"habit_id": string,"id"?: string,"target"?: number | null,"times_per_week"?: number | null,"user_id"?: string,"valid_from": string,"valid_to"?: string | null
                  }
                  Update: {
                    "days"?: (number)[] | null,"frequency"?: string,"habit_id"?: string,"id"?: string,"target"?: number | null,"times_per_week"?: number | null,"user_id"?: string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_schedules_habit_id_user_id_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"habit_skips": {
                  Row: {
                    "created_at": string,"date": string,"habit_id": string,"reason": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"habit_id": string,"reason": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"habit_id"?: string,"reason"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_skips_habit_id_user_id_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"habits": {
                  Row: {
                    "archived_at": string | null,"area": string,"created_at": string,"days": (number)[] | null,"deleted_at": string | null,"end_time": string | null,"frequency": string,"goal_id": string | null,"id": string,"kind": string,"name": string,"position": number,"start_time": string | null,"target": number | null,"times_per_week": number | null,"unit": string | null,"user_id": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"area"?: string,"created_at"?: string,"days"?: (number)[] | null,"deleted_at"?: string | null,"end_time"?: string | null,"frequency": string,"goal_id"?: string | null,"id"?: string,"kind": string,"name": string,"position"?: number,"start_time"?: string | null,"target"?: number | null,"times_per_week"?: number | null,"unit"?: string | null,"user_id"?: string,"weight"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"area"?: string,"created_at"?: string,"days"?: (number)[] | null,"deleted_at"?: string | null,"end_time"?: string | null,"frequency"?: string,"goal_id"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"position"?: number,"start_time"?: string | null,"target"?: number | null,"times_per_week"?: number | null,"unit"?: string | null,"user_id"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "habits_goal_fk"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"journal_entries": {
                  Row: {
                    "body": string,"created_at": string,"entry_date": string,"id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"entry_date": string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"entry_date"?: string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"milestones": {
                  Row: {
                    "created_at": string,"done": boolean,"done_at": string | null,"goal_id": string,"id": string,"position": number,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done"?: boolean,"done_at"?: string | null,"goal_id": string,"id"?: string,"position"?: number,"title": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"done"?: boolean,"done_at"?: string | null,"goal_id"?: string,"id"?: string,"position"?: number,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "body": string,"created_at": string,"deleted_at": string | null,"id": string,"pinned": boolean,"search": unknown,"tags": (string)[],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"pinned"?: boolean,"search"?: never,"tags"?: (string)[],"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"pinned"?: boolean,"search"?: never,"tags"?: (string)[],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "reminders": NonNullable<Json>,"timezone": string,"today_layout": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "reminders"?: NonNullable<Json>,"timezone"?: string,"today_layout"?: NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "reminders"?: NonNullable<Json>,"timezone"?: string,"today_layout"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminder_log": {
                  Row: {
                    "day": string,"kind": string,"ref": string,"sent_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"kind": string,"ref": string,"sent_at"?: string,"user_id": string
                  }
                  Update: {
                    "day"?: string,"kind"?: string,"ref"?: string,"sent_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rest_days": {
                  Row: {
                    "created_at": string,"date": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"note"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"weekly_reviews": {
                  Row: {
                    "created_at": string,"id": string,"next_focus": string,"to_improve": string,"updated_at": string,"user_id": string,"week_start": string,"went_well": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"next_focus"?: string,"to_improve"?: string,"updated_at"?: string,"user_id"?: string,"week_start": string,"went_well"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"next_focus"?: string,"to_improve"?: string,"updated_at"?: string,"user_id"?: string,"week_start"?: string,"went_well"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "archive_habit":
{ Args: { "p_habit_id": string }; Returns: undefined
                           },
"create_habit":
{ Args: { "p_area"?: string,"p_days": (number)[],"p_end_time"?: string,"p_frequency": string,"p_kind": string,"p_name": string,"p_start_time"?: string,"p_target": number,"p_times_per_week": number,"p_unit": string,"p_weight"?: number }; Returns: string
                           },
"due_reminders":
{ Args: { "p_now"?: string }; Returns: {
              "body": string,"day": string,"kind": string,"ref": string,"title": string,"url": string,"user_id": string
            }[]
                           },
"move_habit":
{ Args: { "p_direction": string,"p_habit_id": string }; Returns: undefined
                           },
"unarchive_habit":
{ Args: { "p_habit_id": string }; Returns: undefined
                           },
"update_habit":
{ Args: { "p_area"?: string,"p_days": (number)[],"p_end_time"?: string,"p_frequency": string,"p_habit_id": string,"p_name": string,"p_start_time"?: string,"p_target": number,"p_times_per_week": number,"p_unit": string,"p_weight"?: number }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
