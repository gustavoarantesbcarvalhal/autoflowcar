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
      tenants: {
        Row: {
          id: string
          nome: string
          email_admin: string
          plano: Database["public"]["Enums"]["tenant_plano"]
          status: Database["public"]["Enums"]["tenant_status"]
          logo_url: string | null
          cor_primaria: string
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          email_admin: string
          plano?: Database["public"]["Enums"]["tenant_plano"]
          status?: Database["public"]["Enums"]["tenant_status"]
          logo_url?: string | null
          cor_primaria?: string
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          email_admin?: string
          plano?: Database["public"]["Enums"]["tenant_plano"]
          status?: Database["public"]["Enums"]["tenant_status"]
          logo_url?: string | null
          cor_primaria?: string
          created_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          tenant_id: string | null
          nome: string
          email: string
          perfil: Database["public"]["Enums"]["user_perfil"]
          ativo: boolean
          created_at: string
        }
        Insert: {
          id: string
          tenant_id?: string | null
          nome: string
          email: string
          perfil?: Database["public"]["Enums"]["user_perfil"]
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          nome?: string
          email?: string
          perfil?: Database["public"]["Enums"]["user_perfil"]
          ativo?: boolean
          created_at?: string
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
      super_admins: {
        Row: {
          id: string
          nome: string
          email: string
          created_at: string
        }
        Insert: {
          id: string
          nome: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          email?: string
          created_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          customer_id: string | null
          done: boolean
          id: string
          notes: string | null
          scheduled_at: string
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
          scheduled_at: string
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
          scheduled_at?: string
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
          created_at: string
          email: string | null
          id: string
          interest_brand: string | null
          interest_model: string | null
          interest_year: string | null
          last_contact_at: string | null
          lost_reason: string | null
          name: string
          next_return_at: string | null
          notes: string | null
          phone: string | null
          price_max: number | null
          price_min: number | null
          source: Database["public"]["Enums"]["lead_source"] | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_brand?: string | null
          interest_model?: string | null
          interest_year?: string | null
          last_contact_at?: string | null
          lost_reason?: string | null
          name: string
          next_return_at?: string | null
          notes?: string | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_brand?: string | null
          interest_model?: string | null
          interest_year?: string | null
          last_contact_at?: string | null
          lost_reason?: string | null
          name?: string
          next_return_at?: string | null
          notes?: string | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      interactions: {
        Row: {
          content: string | null
          created_at: string
          customer_id: string
          id: string
          type: Database["public"]["Enums"]["interaction_type"]
          vehicle_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          customer_id: string
          id?: string
          type?: Database["public"]["Enums"]["interaction_type"]
          vehicle_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          type?: Database["public"]["Enums"]["interaction_type"]
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
            foreignKeyName: "interactions_vehicle_id_fkey"
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
          id: string
          mileage: number | null
          model: string
          notes: string | null
          price: number | null
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          year: number | null
        }
        Insert: {
          brand: string
          color?: string | null
          created_at?: string
          id?: string
          mileage?: number | null
          model: string
          notes?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string
          color?: string | null
          created_at?: string
          id?: string
          mileage?: number | null
          model?: string
          notes?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_meu_perfil: {
        Args: Record<PropertyKey, never>
        Returns: {
          perfil: string
          tenant_id: string | null
          plano: string | null
          tenant_status: string | null
          nome: string
          email: string
        }[]
      }
      criar_tenant: {
        Args: {
          p_nome: string
          p_email_admin: string
          p_plano?: Database["public"]["Enums"]["tenant_plano"]
          p_logo_url?: string | null
          p_cor_primaria?: string | null
        }
        Returns: string
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      meu_tenant_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      tenant_plano: "starter" | "pro" | "white_label"
      tenant_status: "ativo" | "inativo" | "bloqueado"
      user_perfil: "super_admin" | "admin_loja" | "gerente" | "vendedor"
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
      tenant_plano: ["starter", "pro", "white_label"],
      tenant_status: ["ativo", "inativo", "bloqueado"],
      user_perfil: ["super_admin", "admin_loja", "gerente", "vendedor"],
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
      ],
      vehicle_status: ["disponivel", "reservado", "vendido"],
    },
  },
} as const
