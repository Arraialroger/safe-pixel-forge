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
      profiles: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          cpf_cnpj: string | null
          created_at: string
          custom_logo_url: string | null
          email: string | null
          full_name: string | null
          id: string
          subscription_status: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          custom_logo_url?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          subscription_status?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          custom_logo_url?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          subscription_status?: string | null
        }
        Relationships: []
      }
      vault_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          vault_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          vault_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_events_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      vaults: {
        Row: {
          allowed_payment_methods: string
          client_email: string | null
          client_name: string
          client_whatsapp: string | null
          created_at: string
          downloaded_at: string | null
          expires_at: string | null
          file_name: string | null
          file_path: string | null
          id: string
          owner_id: string
          price: number
          public_slug: string
          status: string
          title: string
        }
        Insert: {
          allowed_payment_methods?: string
          client_email?: string | null
          client_name: string
          client_whatsapp?: string | null
          created_at?: string
          downloaded_at?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          owner_id: string
          price: number
          public_slug?: string
          status?: string
          title: string
        }
        Update: {
          allowed_payment_methods?: string
          client_email?: string | null
          client_name?: string
          client_whatsapp?: string | null
          created_at?: string
          downloaded_at?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          owner_id?: string
          price?: number
          public_slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          mp_access_token: string | null
          mp_public_key: string | null
          mp_refresh_token: string | null
          mp_user_id: string | null
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mp_access_token?: string | null
          mp_public_key?: string | null
          mp_refresh_token?: string | null
          mp_user_id?: string | null
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mp_access_token?: string | null
          mp_public_key?: string | null
          mp_refresh_token?: string | null
          mp_user_id?: string | null
          owner_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_achievement_data: {
        Args: { p_vault_id: string }
        Returns: {
          id: string
          paid_at: string
          price: number
          title: string
        }[]
      }
      get_public_vault_by_slug: {
        Args: { _slug: string }
        Returns: {
          client_name: string
          expires_at: string
          file_name: string
          id: string
          owner_id: string
          price: number
          public_slug: string
          status: string
          title: string
        }[]
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
    Enums: {},
  },
} as const
