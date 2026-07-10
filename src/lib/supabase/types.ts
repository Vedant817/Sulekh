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
      capital_structure: {
        Row: {
          allotment_history: Json
          authorized_capital: number | null
          created_at: string
          face_value: number | null
          id: string
          post_issue_capital: number | null
          pre_issue_capital: number | null
          project_id: string
          shareholding: Json
          updated_at: string
        }
        Insert: {
          allotment_history?: Json
          authorized_capital?: number | null
          created_at?: string
          face_value?: number | null
          id?: string
          post_issue_capital?: number | null
          pre_issue_capital?: number | null
          project_id: string
          shareholding?: Json
          updated_at?: string
        }
        Update: {
          allotment_history?: Json
          authorized_capital?: number | null
          created_at?: string
          face_value?: number | null
          id?: string
          post_issue_capital?: number | null
          pre_issue_capital?: number | null
          project_id?: string
          shareholding?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_structure_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      corpus_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          section_tag: string | null
          source_ref: string | null
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          section_tag?: string | null
          source_ref?: string | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          section_tag?: string | null
          source_ref?: string | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "corpus_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "corpus_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      corpus_documents: {
        Row: {
          checksum: string | null
          created_at: string
          id: string
          source_key: string
          source_type: string
          title: string
          uri: string | null
          version: string | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          id?: string
          source_key: string
          source_type: string
          title: string
          uri?: string | null
          version?: string | null
        }
        Update: {
          checksum?: string | null
          created_at?: string
          id?: string
          source_key?: string
          source_type?: string
          title?: string
          uri?: string | null
          version?: string | null
        }
        Relationships: []
      }
      drhp_section_catalog: {
        Row: {
          created_at: string
          description: string | null
          mandatory: boolean
          ordinal: number
          section_key: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          mandatory?: boolean
          ordinal: number
          section_key: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          mandatory?: boolean
          ordinal?: number
          section_key?: string
          title?: string
        }
        Relationships: []
      }
      drhp_sections: {
        Row: {
          created_at: string
          draft_markdown: string | null
          id: string
          is_mandatory: boolean
          model_used: string | null
          ordinal: number
          project_id: string
          section_key: string
          status: Database["public"]["Enums"]["section_status"]
          template_version: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_markdown?: string | null
          id?: string
          is_mandatory?: boolean
          model_used?: string | null
          ordinal: number
          project_id: string
          section_key: string
          status?: Database["public"]["Enums"]["section_status"]
          template_version?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_markdown?: string | null
          id?: string
          is_mandatory?: boolean
          model_used?: string | null
          ordinal?: number
          project_id?: string
          section_key?: string
          status?: Database["public"]["Enums"]["section_status"]
          template_version?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drhp_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_drhp_section_catalog"
            columns: ["section_key"]
            isOneToOne: false
            referencedRelation: "drhp_section_catalog"
            referencedColumns: ["section_key"]
          },
        ]
      }
      extracted_entities: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_by_promoter: boolean
          corrected_data: Json | null
          created_at: string
          data: Json
          document_id: string | null
          entity_type: string
          id: string
          project_id: string
          source_snippet: string | null
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_by_promoter?: boolean
          corrected_data?: Json | null
          created_at?: string
          data: Json
          document_id?: string | null
          entity_type: string
          id?: string
          project_id: string
          source_snippet?: string | null
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_by_promoter?: boolean
          corrected_data?: Json | null
          created_at?: string
          data?: Json
          document_id?: string | null
          entity_type?: string
          id?: string
          project_id?: string
          source_snippet?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracted_entities_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_entities_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_entities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_statements: {
        Row: {
          created_at: string
          currency: string
          id: string
          line_items: Json
          period_end: string | null
          period_label: string
          project_id: string
          restated: boolean
          source_document_id: string | null
          statement_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          line_items?: Json
          period_end?: string | null
          period_label: string
          project_id: string
          restated?: boolean
          source_document_id?: string | null
          statement_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          line_items?: Json
          period_end?: string | null
          period_label?: string
          project_id?: string
          restated?: boolean
          source_document_id?: string | null
          statement_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_statements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_statements_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_flags: {
        Row: {
          created_at: string
          details: Json
          field_key: string | null
          flag_type: Database["public"]["Enums"]["gap_type"]
          id: string
          message: string
          project_id: string
          resolved_at: string | null
          section_key: string | null
          severity: Database["public"]["Enums"]["gap_severity"]
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json
          field_key?: string | null
          flag_type: Database["public"]["Enums"]["gap_type"]
          id?: string
          message: string
          project_id: string
          resolved_at?: string | null
          section_key?: string | null
          severity?: Database["public"]["Enums"]["gap_severity"]
          status?: string
        }
        Update: {
          created_at?: string
          details?: Json
          field_key?: string | null
          flag_type?: Database["public"]["Enums"]["gap_type"]
          id?: string
          message?: string
          project_id?: string
          resolved_at?: string | null
          section_key?: string | null
          severity?: Database["public"]["Enums"]["gap_severity"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          completed_sections: number
          completion_tokens: number
          created_at: string
          current_section: string | null
          error: string | null
          id: string
          model_used: string | null
          progress: number
          project_id: string
          prompt_tokens: number
          state: Database["public"]["Enums"]["job_state"]
          total_sections: number
          updated_at: string
        }
        Insert: {
          completed_sections?: number
          completion_tokens?: number
          created_at?: string
          current_section?: string | null
          error?: string | null
          id?: string
          model_used?: string | null
          progress?: number
          project_id: string
          prompt_tokens?: number
          state?: Database["public"]["Enums"]["job_state"]
          total_sections?: number
          updated_at?: string
        }
        Update: {
          completed_sections?: number
          completion_tokens?: number
          created_at?: string
          current_section?: string | null
          error?: string | null
          id?: string
          model_used?: string | null
          progress?: number
          project_id?: string
          prompt_tokens?: number
          state?: Database["public"]["Enums"]["job_state"]
          total_sections?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_answers: {
        Row: {
          answer_key: string
          created_at: string
          id: string
          project_id: string
          question_id: string
          value: Json | null
          version: number
        }
        Insert: {
          answer_key: string
          created_at?: string
          id?: string
          project_id: string
          question_id: string
          value?: Json | null
          version?: number
        }
        Update: {
          answer_key?: string
          created_at?: string
          id?: string
          project_id?: string
          question_id?: string
          value?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "intake_answers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ipo_projects: {
        Row: {
          assigned_intermediary_id: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          status: Database["public"]["Enums"]["project_status"]
          target_board: string
          updated_at: string
        }
        Insert: {
          assigned_intermediary_id?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          status?: Database["public"]["Enums"]["project_status"]
          target_board?: string
          updated_at?: string
        }
        Update: {
          assigned_intermediary_id?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["project_status"]
          target_board?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipo_projects_assigned_intermediary_id_fkey"
            columns: ["assigned_intermediary_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipo_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      issuer_profile: {
        Row: {
          cin: string | null
          created_at: string
          group_structure: Json
          id: string
          incorporation_date: string | null
          legal_name: string | null
          project_id: string
          registered_office: Json
          sector: string | null
          updated_at: string
        }
        Insert: {
          cin?: string | null
          created_at?: string
          group_structure?: Json
          id?: string
          incorporation_date?: string | null
          legal_name?: string | null
          project_id: string
          registered_office?: Json
          sector?: string | null
          updated_at?: string
        }
        Update: {
          cin?: string | null
          created_at?: string
          group_structure?: Json
          id?: string
          incorporation_date?: string | null
          legal_name?: string | null
          project_id?: string
          registered_office?: Json
          sector?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issuer_profile_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_details: {
        Row: {
          created_at: string
          deployment_schedule: Json
          fresh_issue_amount: number | null
          id: string
          issue_type: string | null
          objects: Json
          ofs_amount: number | null
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deployment_schedule?: Json
          fresh_issue_amount?: number | null
          id?: string
          issue_type?: string | null
          objects?: Json
          ofs_amount?: number | null
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deployment_schedule?: Json
          fresh_issue_amount?: number | null
          id?: string
          issue_type?: string | null
          objects?: Json
          ofs_amount?: number | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_details_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_checklist: {
        Row: {
          applies_to: Json
          code: string
          created_at: string
          description: string | null
          id: string
          mandatory: boolean
          ordinal: number
          section_key: string
          source_citation: string
          title: string
        }
        Insert: {
          applies_to?: Json
          code: string
          created_at?: string
          description?: string | null
          id?: string
          mandatory?: boolean
          ordinal?: number
          section_key: string
          source_citation: string
          title: string
        }
        Update: {
          applies_to?: Json
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          mandatory?: boolean
          ordinal?: number
          section_key?: string
          source_citation?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_requirement_section"
            columns: ["section_key"]
            isOneToOne: false
            referencedRelation: "drhp_section_catalog"
            referencedColumns: ["section_key"]
          },
        ]
      }
      requirement_coverage: {
        Row: {
          evidence: Json
          id: string
          project_id: string
          requirement_id: string
          status: Database["public"]["Enums"]["coverage_status"]
          updated_at: string
        }
        Insert: {
          evidence?: Json
          id?: string
          project_id: string
          requirement_id: string
          status?: Database["public"]["Enums"]["coverage_status"]
          updated_at?: string
        }
        Update: {
          evidence?: Json
          id?: string
          project_id?: string
          requirement_id?: string
          status?: Database["public"]["Enums"]["coverage_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_coverage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_coverage_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirement_checklist"
            referencedColumns: ["id"]
          },
        ]
      }
      review_events: {
        Row: {
          action: string
          actor_id: string | null
          after_ref: Json | null
          before_ref: Json | null
          comment: string | null
          created_at: string
          id: string
          project_id: string
          section_key: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_ref?: Json | null
          before_ref?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          project_id: string
          section_key?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_ref?: Json | null
          before_ref?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          project_id?: string
          section_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          id: string
        }
        Insert: {
          applied_at?: string
          id: string
        }
        Update: {
          applied_at?: string
          id?: string
        }
        Relationships: []
      }
      section_provenance: {
        Row: {
          corpus_chunk_ids: string[]
          entity_ids: string[]
          generated_at: string
          id: string
          intake_field_keys: string[]
          notes: string | null
          project_id: string
          section_id: string
        }
        Insert: {
          corpus_chunk_ids?: string[]
          entity_ids?: string[]
          generated_at?: string
          id?: string
          intake_field_keys?: string[]
          notes?: string | null
          project_id: string
          section_id: string
        }
        Update: {
          corpus_chunk_ids?: string[]
          entity_ids?: string[]
          generated_at?: string
          id?: string
          intake_field_keys?: string[]
          notes?: string | null
          project_id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_provenance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_provenance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "drhp_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          id: string
          mime_type: string | null
          parse_error: string | null
          parse_status: Database["public"]["Enums"]["parse_status"]
          project_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploader_id: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          id?: string
          mime_type?: string | null
          parse_error?: string | null
          parse_status?: Database["public"]["Enums"]["parse_status"]
          project_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploader_id?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          parse_error?: string | null
          parse_status?: Database["public"]["Enums"]["parse_status"]
          project_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ipo_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_project: { Args: { p_project: string }; Returns: boolean }
      current_role_is: {
        Args: { target: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_project_owner: { Args: { p_project: string }; Returns: boolean }
    }
    Enums: {
      coverage_status: "covered" | "partial" | "missing" | "not_applicable"
      gap_severity: "info" | "warning" | "blocker"
      gap_type: "missing" | "inconsistent" | "unaddressed"
      job_state: "queued" | "running" | "succeeded" | "failed" | "cancelled"
      parse_status: "pending" | "parsing" | "parsed" | "failed"
      project_status:
        | "draft"
        | "intake"
        | "extraction"
        | "generation"
        | "review"
        | "approved"
        | "exported"
      section_status:
        | "empty"
        | "generating"
        | "draft"
        | "needs_changes"
        | "approved"
      user_role: "promoter" | "intermediary" | "admin"
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
      coverage_status: ["covered", "partial", "missing", "not_applicable"],
      gap_severity: ["info", "warning", "blocker"],
      gap_type: ["missing", "inconsistent", "unaddressed"],
      job_state: ["queued", "running", "succeeded", "failed", "cancelled"],
      parse_status: ["pending", "parsing", "parsed", "failed"],
      project_status: [
        "draft",
        "intake",
        "extraction",
        "generation",
        "review",
        "approved",
        "exported",
      ],
      section_status: [
        "empty",
        "generating",
        "draft",
        "needs_changes",
        "approved",
      ],
      user_role: ["promoter", "intermediary", "admin"],
    },
  },
} as const

