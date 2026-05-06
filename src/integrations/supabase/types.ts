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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string | null
          active: boolean
          agency: string | null
          bank_name: string
          business_unit_id: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          bank_name: string
          business_unit_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          bank_name?: string
          business_unit_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_entries: {
        Row: {
          amount: number
          bank_account_id: string | null
          conciliation_status: Database["public"]["Enums"]["conciliation_status"]
          created_at: string
          description: string | null
          direction: string | null
          document_number: string | null
          id: string
          import_batch_id: string | null
          raw_payload: Json | null
          suggested_match_id: string | null
          transaction_date: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          conciliation_status?: Database["public"]["Enums"]["conciliation_status"]
          created_at?: string
          description?: string | null
          direction?: string | null
          document_number?: string | null
          id?: string
          import_batch_id?: string | null
          raw_payload?: Json | null
          suggested_match_id?: string | null
          transaction_date: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          conciliation_status?: Database["public"]["Enums"]["conciliation_status"]
          created_at?: string
          description?: string | null
          direction?: string | null
          document_number?: string | null
          id?: string
          import_batch_id?: string | null
          raw_payload?: Json | null
          suggested_match_id?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_entries_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          active: boolean
          address: string | null
          business_unit_id: string | null
          city: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          business_unit_id?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          business_unit_id?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliation_matches: {
        Row: {
          bank_statement_entry_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          financial_entry_id: string
          id: string
          match_score: number | null
          match_type: Database["public"]["Enums"]["match_type"]
          status: Database["public"]["Enums"]["match_status"]
        }
        Insert: {
          bank_statement_entry_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          financial_entry_id: string
          id?: string
          match_score?: number | null
          match_type?: Database["public"]["Enums"]["match_type"]
          status?: Database["public"]["Enums"]["match_status"]
        }
        Update: {
          bank_statement_entry_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          financial_entry_id?: string
          id?: string
          match_score?: number | null
          match_type?: Database["public"]["Enums"]["match_type"]
          status?: Database["public"]["Enums"]["match_status"]
        }
        Relationships: [
          {
            foreignKeyName: "conciliation_matches_bank_statement_entry_id_fkey"
            columns: ["bank_statement_entry_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliation_matches_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          accept_token: string
          accepted_at: string | null
          accepted_ip: string | null
          approved_at: string | null
          business_unit: string | null
          client_id: string | null
          commercial_responsible: string | null
          created_at: string
          created_by: string | null
          deadline_date: string | null
          description: string | null
          down_payment_amount: number
          final_charge_generated: boolean | null
          id: string
          initial_charge_generated: boolean | null
          meeting_date: string | null
          meeting_report: string | null
          meeting_summary: string | null
          notes: string | null
          proposal_structure: string | null
          reference_number: string | null
          responsible_sector: string | null
          scope_description: string | null
          sent_at: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["devis_status"]
          title: string
          total_amount: number
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_amount_confirmed: boolean
          validation_client_confirmed: boolean
          validation_deadline_defined: boolean
          validation_sector_defined: boolean
          validation_service_confirmed: boolean
        }
        Insert: {
          accept_token?: string
          accepted_at?: string | null
          accepted_ip?: string | null
          approved_at?: string | null
          business_unit?: string | null
          client_id?: string | null
          commercial_responsible?: string | null
          created_at?: string
          created_by?: string | null
          deadline_date?: string | null
          description?: string | null
          down_payment_amount?: number
          final_charge_generated?: boolean | null
          id?: string
          initial_charge_generated?: boolean | null
          meeting_date?: string | null
          meeting_report?: string | null
          meeting_summary?: string | null
          notes?: string | null
          proposal_structure?: string | null
          reference_number?: string | null
          responsible_sector?: string | null
          scope_description?: string | null
          sent_at?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          title: string
          total_amount?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_amount_confirmed?: boolean
          validation_client_confirmed?: boolean
          validation_deadline_defined?: boolean
          validation_sector_defined?: boolean
          validation_service_confirmed?: boolean
        }
        Update: {
          accept_token?: string
          accepted_at?: string | null
          accepted_ip?: string | null
          approved_at?: string | null
          business_unit?: string | null
          client_id?: string | null
          commercial_responsible?: string | null
          created_at?: string
          created_by?: string | null
          deadline_date?: string | null
          description?: string | null
          down_payment_amount?: number
          final_charge_generated?: boolean | null
          id?: string
          initial_charge_generated?: boolean | null
          meeting_date?: string | null
          meeting_report?: string | null
          meeting_summary?: string | null
          notes?: string | null
          proposal_structure?: string | null
          reference_number?: string | null
          responsible_sector?: string | null
          scope_description?: string | null
          sent_at?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          title?: string
          total_amount?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_amount_confirmed?: boolean
          validation_client_confirmed?: boolean
          validation_deadline_defined?: boolean
          validation_sector_defined?: boolean
          validation_service_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount_in: number | null
          amount_out: number | null
          amount_signed: number | null
          bank_account_id: string | null
          business_unit: string | null
          competence_month: string | null
          conciliation_group_id: string | null
          conciliation_status: Database["public"]["Enums"]["conciliation_status"]
          counterparty_name: string | null
          created_at: string
          document_reference: string | null
          entry_date: string
          entry_type: Database["public"]["Enums"]["entry_type"] | null
          id: string
          import_batch_id: string | null
          movement_account: string | null
          movement_description: string | null
          source_file_name: string | null
          source_sheet_name: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_in?: number | null
          amount_out?: number | null
          amount_signed?: number | null
          bank_account_id?: string | null
          business_unit?: string | null
          competence_month?: string | null
          conciliation_group_id?: string | null
          conciliation_status?: Database["public"]["Enums"]["conciliation_status"]
          counterparty_name?: string | null
          created_at?: string
          document_reference?: string | null
          entry_date: string
          entry_type?: Database["public"]["Enums"]["entry_type"] | null
          id?: string
          import_batch_id?: string | null
          movement_account?: string | null
          movement_description?: string | null
          source_file_name?: string | null
          source_sheet_name?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_in?: number | null
          amount_out?: number | null
          amount_signed?: number | null
          bank_account_id?: string | null
          business_unit?: string | null
          competence_month?: string | null
          conciliation_group_id?: string | null
          conciliation_status?: Database["public"]["Enums"]["conciliation_status"]
          counterparty_name?: string | null
          created_at?: string
          document_reference?: string | null
          entry_date?: string
          entry_type?: Database["public"]["Enums"]["entry_type"] | null
          id?: string
          import_batch_id?: string | null
          movement_account?: string | null
          movement_description?: string | null
          source_file_name?: string | null
          source_sheet_name?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          error_count: number | null
          error_log: Json | null
          file_name: string
          id: string
          imported_at: string
          imported_by: string | null
          row_count: number | null
          source_kind: string
          status: Database["public"]["Enums"]["import_status"]
          success_count: number | null
        }
        Insert: {
          error_count?: number | null
          error_log?: Json | null
          file_name: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          row_count?: number | null
          source_kind: string
          status?: Database["public"]["Enums"]["import_status"]
          success_count?: number | null
        }
        Update: {
          error_count?: number | null
          error_log?: Json | null
          file_name?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          row_count?: number | null
          source_kind?: string
          status?: Database["public"]["Enums"]["import_status"]
          success_count?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          actual_end_date: string | null
          assigned_to: string | null
          business_unit: string | null
          client_id: string | null
          created_at: string
          description: string | null
          devis_id: string | null
          expected_end_date: string | null
          final_charge_generated: boolean | null
          id: string
          responsible_sector: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          assigned_to?: string | null
          business_unit?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          devis_id?: string | null
          expected_end_date?: string | null
          final_charge_generated?: boolean | null
          id?: string
          responsible_sector?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          title: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          assigned_to?: string | null
          business_unit?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          devis_id?: string | null
          expected_end_date?: string | null
          final_charge_generated?: boolean | null
          id?: string
          responsible_sector?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "financeiro"
        | "comercial"
        | "operacao"
        | "gestao"
        | "bi_viewer"
        | "gerencial"
      conciliation_status: "pendente" | "conciliado" | "divergente" | "ignorado"
      devis_status:
        | "rascunho"
        | "enviado"
        | "aprovado"
        | "rejeitado"
        | "convertido"
        | "reuniao_realizada"
        | "proposta_em_geracao"
        | "aguardando_validacao"
        | "pronta_para_envio"
        | "enviada_ao_cliente"
        | "aguardando_aceite"
        | "aceita"
        | "rejeitada"
        | "cobranca_pendente"
        | "entrada_recebida"
        | "enviado_para_operacao"
      entry_type: "receita" | "despesa" | "transferencia"
      import_status: "processando" | "concluido" | "erro" | "parcial"
      match_status: "sugerido" | "confirmado" | "rejeitado"
      match_type: "automatico" | "manual"
      service_status:
        | "pendente"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "a_iniciar"
      source_type:
        | "manual"
        | "importacao_planilha"
        | "importacao_extrato"
        | "sistema"
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
      app_role: [
        "admin",
        "financeiro",
        "comercial",
        "operacao",
        "gestao",
        "bi_viewer",
        "gerencial",
      ],
      conciliation_status: ["pendente", "conciliado", "divergente", "ignorado"],
      devis_status: [
        "rascunho",
        "enviado",
        "aprovado",
        "rejeitado",
        "convertido",
        "reuniao_realizada",
        "proposta_em_geracao",
        "aguardando_validacao",
        "pronta_para_envio",
        "enviada_ao_cliente",
        "aguardando_aceite",
        "aceita",
        "rejeitada",
        "cobranca_pendente",
        "entrada_recebida",
        "enviado_para_operacao",
      ],
      entry_type: ["receita", "despesa", "transferencia"],
      import_status: ["processando", "concluido", "erro", "parcial"],
      match_status: ["sugerido", "confirmado", "rejeitado"],
      match_type: ["automatico", "manual"],
      service_status: [
        "pendente",
        "em_andamento",
        "concluido",
        "cancelado",
        "a_iniciar",
      ],
      source_type: [
        "manual",
        "importacao_planilha",
        "importacao_extrato",
        "sistema",
      ],
    },
  },
} as const
