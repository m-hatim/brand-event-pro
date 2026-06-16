export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      architecture_outputs: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          owner_id: string
          payload: Json
          run_id: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          owner_id: string
          payload?: Json
          run_id: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "architecture_outputs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      assumptions: {
        Row: {
          correction: string | null
          created_at: string
          id: string
          impact: string
          owner_id: string
          run_id: string
          status: string
          text: string
          type: string
          updated_at: string
        }
        Insert: {
          correction?: string | null
          created_at?: string
          id?: string
          impact?: string
          owner_id: string
          run_id: string
          status?: string
          text: string
          type?: string
          updated_at?: string
        }
        Update: {
          correction?: string | null
          created_at?: string
          id?: string
          impact?: string
          owner_id?: string
          run_id?: string
          status?: string
          text?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assumptions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_chunks: {
        Row: {
          acked: boolean
          chunk_index: number
          created_at: string
          id: string
          module_id: string | null
          owner_id: string
          run_id: string
          status: string
          updated_at: string
          validation: string
        }
        Insert: {
          acked?: boolean
          chunk_index: number
          created_at?: string
          id?: string
          module_id?: string | null
          owner_id: string
          run_id: string
          status?: string
          updated_at?: string
          validation?: string
        }
        Update: {
          acked?: boolean
          chunk_index?: number
          created_at?: string
          id?: string
          module_id?: string | null
          owner_id?: string
          run_id?: string
          status?: string
          updated_at?: string
          validation?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_chunks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "output_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_chunks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      description_corrections: {
        Row: {
          confirmed: boolean
          corrected: string
          created_at: string
          id: string
          original: string
          owner_id: string
          run_id: string | null
        }
        Insert: {
          confirmed?: boolean
          corrected: string
          created_at?: string
          id?: string
          original: string
          owner_id: string
          run_id?: string | null
        }
        Update: {
          confirmed?: boolean
          corrected?: string
          created_at?: string
          id?: string
          original?: string
          owner_id?: string
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "description_corrections_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          payload: Json
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          payload?: Json
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      manifests: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          payload: Json
          run_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          payload?: Json
          run_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manifests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_bundle_results: {
        Row: {
          created_at: string
          id: string
          marketplace: string
          owner_id: string
          payload: Json
          run_id: string
          validation: string
        }
        Insert: {
          created_at?: string
          id?: string
          marketplace: string
          owner_id: string
          payload?: Json
          run_id: string
          validation?: string
        }
        Update: {
          created_at?: string
          id?: string
          marketplace?: string
          owner_id?: string
          payload?: Json
          run_id?: string
          validation?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_bundle_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_selections: {
        Row: {
          created_at: string
          id: string
          marketplace: string
          owner_id: string
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marketplace: string
          owner_id: string
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marketplace?: string
          owner_id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_selections_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      output_modules: {
        Row: {
          content: string | null
          created_at: string
          file_name: string
          id: string
          module_key: string
          owner_id: string
          run_id: string
          status: string
          updated_at: string
          validation: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name: string
          id?: string
          module_key: string
          owner_id: string
          run_id: string
          status?: string
          updated_at?: string
          validation?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string
          id?: string
          module_key?: string
          owner_id?: string
          run_id?: string
          status?: string
          updated_at?: string
          validation?: string
        }
        Relationships: [
          {
            foreignKeyName: "output_modules_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_results: {
        Row: {
          blocking_errors: number
          created_at: string
          id: string
          owner_id: string
          payload: Json
          run_id: string
          updated_at: string
        }
        Insert: {
          blocking_errors?: number
          created_at?: string
          id?: string
          owner_id: string
          payload?: Json
          run_id: string
          updated_at?: string
        }
        Update: {
          blocking_errors?: number
          created_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      redacted_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          owner_id: string
          run_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message: string
          owner_id: string
          run_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          owner_id?: string
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redacted_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          adapter: string
          approval_token: string | null
          approved_at: string | null
          created_at: string
          generation_mode: string
          id: string
          marketplaces: string[]
          owner_id: string
          run_request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          adapter: string
          approval_token?: string | null
          approved_at?: string | null
          created_at?: string
          generation_mode?: string
          id?: string
          marketplaces?: string[]
          owner_id: string
          run_request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          adapter?: string
          approval_token?: string | null
          approved_at?: string | null
          created_at?: string
          generation_mode?: string
          id?: string
          marketplaces?: string[]
          owner_id?: string
          run_request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_inputs: {
        Row: {
          audience: string | null
          brand: string | null
          confirmed_product_description: string | null
          corrected_description: string | null
          created_at: string
          description: string | null
          id: string
          key_anchors: string[]
          language: string | null
          license: string | null
          niche: string | null
          original_description: string | null
          owner_id: string
          prompt_count: number | null
          run_id: string
          target_market: string | null
          target_price: string | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          audience?: string | null
          brand?: string | null
          confirmed_product_description?: string | null
          corrected_description?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key_anchors?: string[]
          language?: string | null
          license?: string | null
          niche?: string | null
          original_description?: string | null
          owner_id: string
          prompt_count?: number | null
          run_id: string
          target_market?: string | null
          target_price?: string | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string | null
          brand?: string | null
          confirmed_product_description?: string | null
          corrected_description?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key_anchors?: string[]
          language?: string | null
          license?: string | null
          niche?: string | null
          original_description?: string | null
          owner_id?: string
          prompt_count?: number | null
          run_id?: string
          target_market?: string | null
          target_price?: string | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_inputs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          api_mode_enabled: boolean
          created_at: string
          default_generation_mode: string
          low_model_mode: boolean
          output_language_default: string
          redacted_logs_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          api_mode_enabled?: boolean
          created_at?: string
          default_generation_mode?: string
          low_model_mode?: boolean
          output_language_default?: string
          redacted_logs_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          api_mode_enabled?: boolean
          created_at?: string
          default_generation_mode?: string
          low_model_mode?: boolean
          output_language_default?: string
          redacted_logs_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      email_template_type: "confirmation" | "reminder" | "followup"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      email_template_type: ["confirmation", "reminder", "followup"],
    },
  },
} as const
