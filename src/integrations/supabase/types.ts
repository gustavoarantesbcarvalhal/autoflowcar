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
      appointments: {
        Row: {
          created_at: string
          customer_id: string | null
          done: boolean
          id: string
          notes: string | null
          responsavel_id: string | null
          scheduled_at: string
          tenant_id: string | null
          title: string | null
          type: Database["public"]["Enums"]["appointment_type"]
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          done?: boolean
          id?: string
          notes?: string | null
          responsavel_id?: string | null
          scheduled_at: string
          tenant_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["appointment_type"]
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          done?: boolean
          id?: string
          notes?: string | null
          responsavel_id?: string | null
          scheduled_at?: string
          tenant_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["appointment_type"]
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          interest_brand: string | null
          interest_model: string | null
          interest_vehicle_id: string | null
          interest_year: string | null
          is_priority: boolean
          last_contact_at: string | null
          lost_reason: string | null
          name: string
          next_action_notes: string | null
          next_action_type: string | null
          next_return_at: string | null
          notes: string | null
          phone: string | null
          price_max: number | null
          price_min: number | null
          responsavel_id: string | null
          sale_value: number | null
          sold_at: string | null
          source: Database["public"]["Enums"]["lead_source"] | null
          source_ad_id: string | null
          source_ad_name: string | null
          source_adset_id: string | null
          source_adset_name: string | null
          source_campaign: string | null
          source_campaign_id: string | null
          source_campaign_name: string | null
          source_platform: string | null
          source_raw: Json | null
          status: Database["public"]["Enums"]["lead_status"]
          status_changed_at: string | null
          tenant_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_brand?: string | null
          interest_model?: string | null
          interest_vehicle_id?: string | null
          interest_year?: string | null
          is_priority?: boolean
          last_contact_at?: string | null
          lost_reason?: string | null
          name: string
          next_action_notes?: string | null
          next_action_type?: string | null
          next_return_at?: string | null
          notes?: string | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          responsavel_id?: string | null
          sale_value?: number | null
          sold_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          source_ad_id?: string | null
          source_ad_name?: string | null
          source_adset_id?: string | null
          source_adset_name?: string | null
          source_campaign?: string | null
          source_campaign_id?: string | null
          source_campaign_name?: string | null
          source_platform?: string | null
          source_raw?: Json | null
          status?: Database["public"]["Enums"]["lead_status"]
          status_changed_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_brand?: string | null
          interest_model?: string | null
          interest_vehicle_id?: string | null
          interest_year?: string | null
          is_priority?: boolean
          last_contact_at?: string | null
          lost_reason?: string | null
          name?: string
          next_action_notes?: string | null
          next_action_type?: string | null
          next_return_at?: string | null
          notes?: string | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          responsavel_id?: string | null
          sale_value?: number | null
          sold_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          source_ad_id?: string | null
          source_ad_name?: string | null
          source_adset_id?: string | null
          source_adset_name?: string | null
          source_campaign?: string | null
          source_campaign_id?: string | null
          source_campaign_name?: string | null
          source_platform?: string | null
          source_raw?: Json | null
          status?: Database["public"]["Enums"]["lead_status"]
          status_changed_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_interest_vehicle_id_fkey"
            columns: ["interest_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          content: string | null
          created_at: string
          customer_id: string
          id: string
          tenant_id: string | null
          type: Database["public"]["Enums"]["interaction_type"]
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          customer_id: string
          id?: string
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_dedup_index: {
        Row: {
          created_at: string
          customer_id: string
          email_lower: string | null
          id: string
          normalized_phone: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email_lower?: string | null
          id?: string
          normalized_phone?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email_lower?: string | null
          id?: string
          normalized_phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_dedup_index_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_dedup_index_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          read: boolean
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          tenant_id: string
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      tenant_actions_log: {
        Row: {
          acao: string
          created_at: string
          feito_por_id: string | null
          feito_por_nome: string | null
          id: string
          tenant_id: string | null
          tenant_nome: string
        }
        Insert: {
          acao: string
          created_at?: string
          feito_por_id?: string | null
          feito_por_nome?: string | null
          id?: string
          tenant_id?: string | null
          tenant_nome: string
        }
        Update: {
          acao?: string
          created_at?: string
          feito_por_id?: string | null
          feito_por_nome?: string | null
          id?: string
          tenant_id?: string | null
          tenant_nome?: string
        }
        Relationships: []
      }
      tenant_integrations: {
        Row: {
          config: Json | null
          created_at: string
          fb_page_access_token: string | null
          fb_page_id: string | null
          id: string
          last_error: string | null
          last_error_at: string | null
          last_sync_at: string | null
          platform: string
          status: string
          tenant_id: string
          updated_at: string
          wa_api_token: string | null
          waba_phone_number_id: string | null
          webhook_verify_token: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          fb_page_access_token?: string | null
          fb_page_id?: string | null
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_sync_at?: string | null
          platform: string
          status?: string
          tenant_id: string
          updated_at?: string
          wa_api_token?: string | null
          waba_phone_number_id?: string | null
          webhook_verify_token?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          fb_page_access_token?: string | null
          fb_page_id?: string | null
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_sync_at?: string | null
          platform?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          wa_api_token?: string | null
          waba_phone_number_id?: string | null
          webhook_verify_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          archived_at: string | null
          archived_by_id: string | null
          blocked_at: string | null
          blocked_by_id: string | null
          cor_primaria: string
          created_at: string
          created_by_id: string | null
          email_admin: string
          id: string
          logo_url: string | null
          nome: string
          plano: Database["public"]["Enums"]["tenant_plano"]
          status: Database["public"]["Enums"]["tenant_status"]
        }
        Insert: {
          archived_at?: string | null
          archived_by_id?: string | null
          blocked_at?: string | null
          blocked_by_id?: string | null
          cor_primaria?: string
          created_at?: string
          created_by_id?: string | null
          email_admin: string
          id?: string
          logo_url?: string | null
          nome: string
          plano?: Database["public"]["Enums"]["tenant_plano"]
          status?: Database["public"]["Enums"]["tenant_status"]
        }
        Update: {
          archived_at?: string | null
          archived_by_id?: string | null
          blocked_at?: string | null
          blocked_by_id?: string | null
          cor_primaria?: string
          created_at?: string
          created_by_id?: string | null
          email_admin?: string
          id?: string
          logo_url?: string | null
          nome?: string
          plano?: Database["public"]["Enums"]["tenant_plano"]
          status?: Database["public"]["Enums"]["tenant_status"]
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["user_perfil"]
          tenant_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id: string
          nome: string
          perfil?: Database["public"]["Enums"]["user_perfil"]
          tenant_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["user_perfil"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photos: {
        Row: {
          created_at: string
          id: string
          is_main: boolean
          ordem: number
          path: string
          tenant_id: string
          url: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_main?: boolean
          ordem?: number
          path: string
          tenant_id?: string
          url: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_main?: boolean
          ordem?: number
          path?: string
          tenant_id?: string
          url?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          color: string | null
          created_at: string
          deal_offer: string | null
          description: string | null
          fuel: string | null
          id: string
          mileage: number | null
          model: string
          notes: string | null
          photo_main_url: string | null
          price: number | null
          price_fipe: number | null
          price_listed: number | null
          price_min_neg: number | null
          status: Database["public"]["Enums"]["vehicle_status"]
          tenant_id: string | null
          transmission: string | null
          updated_at: string
          version: string | null
          year: number | null
        }
        Insert: {
          brand: string
          color?: string | null
          created_at?: string
          deal_offer?: string | null
          description?: string | null
          fuel?: string | null
          id?: string
          mileage?: number | null
          model: string
          notes?: string | null
          photo_main_url?: string | null
          price?: number | null
          price_fipe?: number | null
          price_listed?: number | null
          price_min_neg?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tenant_id?: string | null
          transmission?: string | null
          updated_at?: string
          version?: string | null
          year?: number | null
        }
        Update: {
          brand?: string
          color?: string | null
          created_at?: string
          deal_offer?: string | null
          description?: string | null
          fuel?: string | null
          id?: string
          mileage?: number | null
          model?: string
          notes?: string | null
          photo_main_url?: string | null
          price?: number | null
          price_fipe?: number | null
          price_listed?: number | null
          price_min_neg?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tenant_id?: string | null
          transmission?: string | null
          updated_at?: string
          version?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events_log: {
        Row: {
          created_at: string
          created_customer_id: string | null
          error_message: string | null
          id: string
          payload_hash: string
          platform: string
          processed_at: string | null
          raw_payload: Json | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_customer_id?: string | null
          error_message?: string | null
          id?: string
          payload_hash: string
          platform: string
          processed_at?: string | null
          raw_payload?: Json | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_customer_id?: string | null
          error_message?: string | null
          id?: string
          payload_hash?: string
          platform?: string
          processed_at?: string | null
          raw_payload?: Json | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_log_created_customer_id_fkey"
            columns: ["created_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_tenant: {
        Args: {
          p_cor_primaria?: string
          p_email_admin: string
          p_logo_url?: string
          p_nome: string
          p_plano?: Database["public"]["Enums"]["tenant_plano"]
        }
        Returns: string
      }
      get_meu_perfil: {
        Args: never
        Returns: {
          email: string
          nome: string
          perfil: string
          plano: string
          tenant_id: string
          tenant_status: string
        }[]
      }
      is_super_admin: { Args: never; Returns: boolean }
      meu_perfil_enum: {
        Args: never
        Returns: Database["public"]["Enums"]["user_perfil"]
      }
      meu_tenant_id: { Args: never; Returns: string }
      normalize_phone: { Args: { p: string }; Returns: string }
    }
    Enums: {
      appointment_type: "retorno" | "visita" | "test_drive"
      interaction_type:
        | "nota"
        | "ligacao"
        | "whatsapp"
        | "email"
        | "visita"
        | "test_drive"
        | "proposta"
        | "veiculo_apresentado"
        | "perda"
        | "retorno"
        | "edicao"
      lead_source:
        | "instagram"
        | "facebook"
        | "marketplace"
        | "olx"
        | "site"
        | "indicacao"
        | "outros"
      lead_status:
        | "novo_lead"
        | "primeiro_contato"
        | "interessado"
        | "em_negociacao"
        | "test_drive"
        | "proposta_enviada"
        | "venda_realizada"
        | "perdido"
        | "em_atendimento"
        | "visita"
      tenant_plano: "starter" | "pro" | "white_label"
      tenant_status: "ativo" | "inativo" | "bloqueado"
      user_perfil: "super_admin" | "admin_loja" | "gerente" | "vendedor"
      vehicle_status: "disponivel" | "reservado" | "vendido"
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
      appointment_type: ["retorno", "visita", "test_drive"],
      interaction_type: [
        "nota",
        "ligacao",
        "whatsapp",
        "email",
        "visita",
        "test_drive",
        "proposta",
        "veiculo_apresentado",
        "perda",
        "retorno",
        "edicao",
      ],
      lead_source: [
        "instagram",
        "facebook",
        "marketplace",
        "olx",
        "site",
        "indicacao",
        "outros",
      ],
      lead_status: [
        "novo_lead",
        "primeiro_contato",
        "interessado",
        "em_negociacao",
        "test_drive",
        "proposta_enviada",
        "venda_realizada",
        "perdido",
        "em_atendimento",
        "visita",
      ],
      tenant_plano: ["starter", "pro", "white_label"],
      tenant_status: ["ativo", "inativo", "bloqueado"],
      user_perfil: ["super_admin", "admin_loja", "gerente", "vendedor"],
      vehicle_status: ["disponivel", "reservado", "vendido"],
    },
  },
} as const
