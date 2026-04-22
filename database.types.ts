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
      activity_log: {
        Row: {
          consumed: boolean | null
          correlation_id: string | null
          created_at: string
          domain: string | null
          emitted_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          event_version: string | null
          id: string
          metadata: Json | null
          source_system: string | null
          summary: string | null
          user_id: string | null
        }
        Insert: {
          consumed?: boolean | null
          correlation_id?: string | null
          created_at?: string
          domain?: string | null
          emitted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          event_version?: string | null
          id?: string
          metadata?: Json | null
          source_system?: string | null
          summary?: string | null
          user_id?: string | null
        }
        Update: {
          consumed?: boolean | null
          correlation_id?: string | null
          created_at?: string
          domain?: string | null
          emitted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          event_version?: string | null
          id?: string
          metadata?: Json | null
          source_system?: string | null
          summary?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agenda_thought_pieces: {
        Row: {
          content: string
          content_hash: string
          generated_at: string
          id: string
          retreat_year_id: string
          theme_tags: string[]
          title: string
        }
        Insert: {
          content: string
          content_hash: string
          generated_at?: string
          id?: string
          retreat_year_id?: string
          theme_tags?: string[]
          title: string
        }
        Update: {
          content?: string
          content_hash?: string
          generated_at?: string
          id?: string
          retreat_year_id?: string
          theme_tags?: string[]
          title?: string
        }
        Relationships: []
      }
      asset_evidence_link: {
        Row: {
          asset_registry_id: string
          created_at: string
          document_id: string
          evidence_role: Database["public"]["Enums"]["evidence_role"]
          id: string
          linked_at: string | null
          linked_by: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          asset_registry_id: string
          created_at?: string
          document_id: string
          evidence_role?: Database["public"]["Enums"]["evidence_role"]
          id?: string
          linked_at?: string | null
          linked_by?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          asset_registry_id?: string
          created_at?: string
          document_id?: string
          evidence_role?: Database["public"]["Enums"]["evidence_role"]
          id?: string
          linked_at?: string | null
          linked_by?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_evidence_link_asset_registry_id_fkey"
            columns: ["asset_registry_id"]
            isOneToOne: false
            referencedRelation: "asset_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_evidence_link_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_external_identity: {
        Row: {
          asset_registry_id: string
          created_at: string
          external_id: string
          external_label: string | null
          id: string
          identity_system: string
          updated_at: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          asset_registry_id: string
          created_at?: string
          external_id: string
          external_label?: string | null
          id?: string
          identity_system: string
          updated_at?: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          asset_registry_id?: string
          created_at?: string
          external_id?: string
          external_label?: string | null
          id?: string
          identity_system?: string
          updated_at?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_external_identity_asset_registry_id_fkey"
            columns: ["asset_registry_id"]
            isOneToOne: false
            referencedRelation: "asset_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_registry: {
        Row: {
          asset_kind: Database["public"]["Enums"]["asset_kind"]
          asset_subtype: string | null
          canonical_ecosystem_id: string | null
          charter_entity_id: string | null
          created_at: string
          domain: string | null
          governance_status: Database["public"]["Enums"]["asset_governance_status"]
          id: string
          kind: string | null
          label: string | null
          lifecycle_status: Database["public"]["Enums"]["asset_lifecycle_status"]
          local_record_id: string
          local_table: string
          manager_entity_id: string | null
          metadata: Json | null
          owner_entity_id: string | null
          provenance_captured_at: string | null
          provenance_source_system: string | null
          provenance_source_type:
            | Database["public"]["Enums"]["source_type"]
            | null
          provenance_source_url: string | null
          r2chart_governed_asset_id: string | null
          ref_id: string | null
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_kind: Database["public"]["Enums"]["asset_kind"]
          asset_subtype?: string | null
          canonical_ecosystem_id?: string | null
          charter_entity_id?: string | null
          created_at?: string
          domain?: string | null
          governance_status?: Database["public"]["Enums"]["asset_governance_status"]
          id?: string
          kind?: string | null
          label?: string | null
          lifecycle_status?: Database["public"]["Enums"]["asset_lifecycle_status"]
          local_record_id: string
          local_table: string
          manager_entity_id?: string | null
          metadata?: Json | null
          owner_entity_id?: string | null
          provenance_captured_at?: string | null
          provenance_source_system?: string | null
          provenance_source_type?:
            | Database["public"]["Enums"]["source_type"]
            | null
          provenance_source_url?: string | null
          r2chart_governed_asset_id?: string | null
          ref_id?: string | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_kind?: Database["public"]["Enums"]["asset_kind"]
          asset_subtype?: string | null
          canonical_ecosystem_id?: string | null
          charter_entity_id?: string | null
          created_at?: string
          domain?: string | null
          governance_status?: Database["public"]["Enums"]["asset_governance_status"]
          id?: string
          kind?: string | null
          label?: string | null
          lifecycle_status?: Database["public"]["Enums"]["asset_lifecycle_status"]
          local_record_id?: string
          local_table?: string
          manager_entity_id?: string | null
          metadata?: Json | null
          owner_entity_id?: string | null
          provenance_captured_at?: string | null
          provenance_source_system?: string | null
          provenance_source_type?:
            | Database["public"]["Enums"]["source_type"]
            | null
          provenance_source_url?: string | null
          r2chart_governed_asset_id?: string | null
          ref_id?: string | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_registry_manager_entity_id_fkey"
            columns: ["manager_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_registry_owner_entity_id_fkey"
            columns: ["owner_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_relationship: {
        Row: {
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: string
          notes: string | null
          relationship_type: Database["public"]["Enums"]["asset_relationship_type"]
          source_asset_id: string
          target_asset_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          relationship_type: Database["public"]["Enums"]["asset_relationship_type"]
          source_asset_id: string
          target_asset_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          relationship_type?: Database["public"]["Enums"]["asset_relationship_type"]
          source_asset_id?: string
          target_asset_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_relationship_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "asset_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_relationship_target_asset_id_fkey"
            columns: ["target_asset_id"]
            isOneToOne: false
            referencedRelation: "asset_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      autonomous_learning_outcomes: {
        Row: {
          actual_impact: number
          created_at: string
          error: number
          expected_impact: number
          id: string
          notes: string | null
          run_id: string
          strategy: string
          updated_weight: number
        }
        Insert: {
          actual_impact: number
          created_at?: string
          error: number
          expected_impact: number
          id?: string
          notes?: string | null
          run_id: string
          strategy: string
          updated_weight: number
        }
        Update: {
          actual_impact?: number
          created_at?: string
          error?: number
          expected_impact?: number
          id?: string
          notes?: string | null
          run_id?: string
          strategy?: string
          updated_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "autonomous_learning_outcomes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "retrieval_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      autonomous_runtime_state: {
        Row: {
          pause_reason: string | null
          paused: boolean
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          pause_reason?: string | null
          paused?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          pause_reason?: string | null
          paused?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      autonomous_strategy_weights: {
        Row: {
          strategy: string
          updated_at: string
          weight: number
        }
        Insert: {
          strategy: string
          updated_at?: string
          weight?: number
        }
        Update: {
          strategy?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      charter_asset_valuations: {
        Row: {
          amount_numeric: number
          as_of: string
          basis_notes: string | null
          charter_entity_id: string | null
          confidence: number
          created_at: string
          created_by: string
          currency: string
          id: string
          meg_entity_id: string
          metadata: Json
          methodology: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["charter_valuation_status"]
          supersedes_id: string | null
          updated_at: string
          valuation_kind: Database["public"]["Enums"]["charter_valuation_kind"]
        }
        Insert: {
          amount_numeric: number
          as_of: string
          basis_notes?: string | null
          charter_entity_id?: string | null
          confidence?: number
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          meg_entity_id: string
          metadata?: Json
          methodology?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["charter_valuation_status"]
          supersedes_id?: string | null
          updated_at?: string
          valuation_kind: Database["public"]["Enums"]["charter_valuation_kind"]
        }
        Update: {
          amount_numeric?: number
          as_of?: string
          basis_notes?: string | null
          charter_entity_id?: string | null
          confidence?: number
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          meg_entity_id?: string
          metadata?: Json
          methodology?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["charter_valuation_status"]
          supersedes_id?: string | null
          updated_at?: string
          valuation_kind?: Database["public"]["Enums"]["charter_valuation_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "charter_asset_valuations_charter_entity_id_fkey"
            columns: ["charter_entity_id"]
            isOneToOne: false
            referencedRelation: "charter_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charter_asset_valuations_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charter_asset_valuations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "charter_asset_valuations"
            referencedColumns: ["id"]
          },
        ]
      }
      charter_decisions: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string
          decided_at: string | null
          decided_by: string | null
          decision_type: Database["public"]["Enums"]["decision_type"]
          id: string
          linked_id: string
          linked_table: Database["public"]["Enums"]["decision_linked_table"]
          outcome: Json | null
          rationale: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by: string
          decided_at?: string | null
          decided_by?: string | null
          decision_type: Database["public"]["Enums"]["decision_type"]
          id?: string
          linked_id: string
          linked_table: Database["public"]["Enums"]["decision_linked_table"]
          outcome?: Json | null
          rationale?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_type?: Database["public"]["Enums"]["decision_type"]
          id?: string
          linked_id?: string
          linked_table?: Database["public"]["Enums"]["decision_linked_table"]
          outcome?: Json | null
          rationale?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      charter_entities: {
        Row: {
          canonical_entity_id: string | null
          confidence: number | null
          context_status: Database["public"]["Enums"]["charter_context_status"]
          created_at: string
          created_by: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          last_context_sync_at: string | null
          metadata: Json | null
          name: string
          reviewed_by: string | null
          source_platform: string | null
          source_record_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          canonical_entity_id?: string | null
          confidence?: number | null
          context_status?: Database["public"]["Enums"]["charter_context_status"]
          created_at?: string
          created_by: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          last_context_sync_at?: string | null
          metadata?: Json | null
          name: string
          reviewed_by?: string | null
          source_platform?: string | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          canonical_entity_id?: string | null
          confidence?: number | null
          context_status?: Database["public"]["Enums"]["charter_context_status"]
          created_at?: string
          created_by?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          last_context_sync_at?: string | null
          metadata?: Json | null
          name?: string
          reviewed_by?: string | null
          source_platform?: string | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      charter_evidence: {
        Row: {
          canonical_entity_id: string | null
          confidence: number | null
          created_at: string
          created_by: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          id: string
          linked_id: string
          linked_table: Database["public"]["Enums"]["evidence_linked_table"]
          metadata: Json | null
          provenance_record_id: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["evidence_status"]
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          canonical_entity_id?: string | null
          confidence?: number | null
          created_at?: string
          created_by: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          id?: string
          linked_id: string
          linked_table: Database["public"]["Enums"]["evidence_linked_table"]
          metadata?: Json | null
          provenance_record_id?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["evidence_status"]
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          canonical_entity_id?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          id?: string
          linked_id?: string
          linked_table?: Database["public"]["Enums"]["evidence_linked_table"]
          metadata?: Json | null
          provenance_record_id?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["evidence_status"]
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      charter_governance_entities: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          kind: Database["public"]["Enums"]["governance_entity_kind"]
          parent_id: string | null
          ref_code: string
          status: Database["public"]["Enums"]["governance_status"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          kind: Database["public"]["Enums"]["governance_entity_kind"]
          parent_id?: string | null
          ref_code: string
          status?: Database["public"]["Enums"]["governance_status"]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: Database["public"]["Enums"]["governance_entity_kind"]
          parent_id?: string | null
          ref_code?: string
          status?: Database["public"]["Enums"]["governance_status"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "charter_governance_entities_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "charter_audit_log"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "charter_governance_entities_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "charter_governance_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      charter_governance_transitions: {
        Row: {
          actor_id: string
          entity_id: string
          from_status: Database["public"]["Enums"]["governance_status"] | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["governance_status"]
          transitioned_at: string
        }
        Insert: {
          actor_id: string
          entity_id: string
          from_status?: Database["public"]["Enums"]["governance_status"] | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["governance_status"]
          transitioned_at?: string
        }
        Update: {
          actor_id?: string
          entity_id?: string
          from_status?: Database["public"]["Enums"]["governance_status"] | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["governance_status"]
          transitioned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charter_governance_transitions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "charter_audit_log"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "charter_governance_transitions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "charter_governance_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      charter_obligations: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          entity_id: string
          id: string
          obligation_type: Database["public"]["Enums"]["obligation_type"]
          reviewed_by: string | null
          right_id: string | null
          status: Database["public"]["Enums"]["obligation_status"]
          title: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          entity_id: string
          id?: string
          obligation_type: Database["public"]["Enums"]["obligation_type"]
          reviewed_by?: string | null
          right_id?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          title: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          entity_id?: string
          id?: string
          obligation_type?: Database["public"]["Enums"]["obligation_type"]
          reviewed_by?: string | null
          right_id?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charter_obligations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "charter_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charter_obligations_right_id_fkey"
            columns: ["right_id"]
            isOneToOne: false
            referencedRelation: "charter_rights"
            referencedColumns: ["id"]
          },
        ]
      }
      charter_payouts: {
        Row: {
          amount: number
          approved_by: string | null
          confidence: number | null
          created_at: string
          created_by: string
          currency: string
          entity_id: string
          id: string
          obligation_id: string | null
          payout_date: string | null
          reviewed_by: string | null
          right_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          confidence?: number | null
          created_at?: string
          created_by: string
          currency?: string
          entity_id: string
          id?: string
          obligation_id?: string | null
          payout_date?: string | null
          reviewed_by?: string | null
          right_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          entity_id?: string
          id?: string
          obligation_id?: string | null
          payout_date?: string | null
          reviewed_by?: string | null
          right_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charter_payouts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "charter_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charter_payouts_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "charter_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charter_payouts_right_id_fkey"
            columns: ["right_id"]
            isOneToOne: false
            referencedRelation: "charter_rights"
            referencedColumns: ["id"]
          },
        ]
      }
      charter_provenance_events: {
        Row: {
          actor_id: string
          actor_kind: string
          chain_hash: string
          domain: string
          entity_id: string
          event_type: string
          id: string
          metadata: Json
          payload_hash: string
          recorded_at: string
        }
        Insert: {
          actor_id: string
          actor_kind?: string
          chain_hash: string
          domain?: string
          entity_id: string
          event_type: string
          id?: string
          metadata?: Json
          payload_hash: string
          recorded_at?: string
        }
        Update: {
          actor_id?: string
          actor_kind?: string
          chain_hash?: string
          domain?: string
          entity_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          payload_hash?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charter_provenance_events_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "charter_audit_log"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "charter_provenance_events_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "charter_governance_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      charter_rights: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string
          description: string | null
          effective_date: string | null
          entity_id: string
          expiry_date: string | null
          id: string
          reviewed_by: string | null
          right_type: Database["public"]["Enums"]["right_type"]
          status: Database["public"]["Enums"]["right_status"]
          title: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          effective_date?: string | null
          entity_id: string
          expiry_date?: string | null
          id?: string
          reviewed_by?: string | null
          right_type: Database["public"]["Enums"]["right_type"]
          status?: Database["public"]["Enums"]["right_status"]
          title: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          effective_date?: string | null
          entity_id?: string
          expiry_date?: string | null
          id?: string
          reviewed_by?: string | null
          right_type?: Database["public"]["Enums"]["right_type"]
          status?: Database["public"]["Enums"]["right_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charter_rights_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "charter_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      charter_user_roles: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["charter_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["charter_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["charter_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_user_assignments: {
        Row: {
          assigned_at: string | null
          client_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          client_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          client_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_user_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          industry: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          name?: string
        }
        Relationships: []
      }
      coffee_matches: {
        Row: {
          compatibility_score: number
          conversation_topics: string[]
          created_at: string
          id: string
          match_reason: string
          matched_attendee_id: string
          matched_attendee_name: string
          status: string
          user_id: string
        }
        Insert: {
          compatibility_score?: number
          conversation_topics?: string[]
          created_at?: string
          id?: string
          match_reason: string
          matched_attendee_id: string
          matched_attendee_name: string
          status?: string
          user_id: string
        }
        Update: {
          compatibility_score?: number
          conversation_topics?: string[]
          created_at?: string
          id?: string
          match_reason?: string
          matched_attendee_id?: string
          matched_attendee_name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      competitors: {
        Row: {
          client_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          website: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          website?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_turn: {
        Row: {
          answer: string
          citations: Json
          confidence: Json | null
          created_at: string
          effective_policy_scope: string[]
          feedback_text: string | null
          feedback_value: number | null
          id: string
          idempotency_key: string | null
          latency_ms: number | null
          mode: string
          question: string
          retrieval_plan: Json | null
          retrieval_run_id: string | null
          site_id: string | null
          user_id: string | null
        }
        Insert: {
          answer: string
          citations?: Json
          confidence?: Json | null
          created_at?: string
          effective_policy_scope?: string[]
          feedback_text?: string | null
          feedback_value?: number | null
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          mode: string
          question: string
          retrieval_plan?: Json | null
          retrieval_run_id?: string | null
          site_id?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string
          citations?: Json
          confidence?: Json | null
          created_at?: string
          effective_policy_scope?: string[]
          feedback_text?: string | null
          feedback_value?: number | null
          id?: string
          idempotency_key?: string | null
          latency_ms?: number | null
          mode?: string
          question?: string
          retrieval_plan?: Json | null
          retrieval_run_id?: string | null
          site_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_turn_retrieval_run_id_fkey"
            columns: ["retrieval_run_id"]
            isOneToOne: false
            referencedRelation: "retrieval_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_turn_feedback: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string | null
          note: string | null
          turn_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          turn_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          turn_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversation_turn_feedback_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "conversation_turn"
            referencedColumns: ["id"]
          },
        ]
      }
      counterparties: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          meg_canonical_id: string | null
          meg_entity_id: string | null
          name: string
          notes: string | null
          phone: string | null
          source_system: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["counterparty_type"]
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source_system?: string | null
          tags?: string[] | null
          type: Database["public"]["Enums"]["counterparty_type"]
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source_system?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["counterparty_type"]
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          asking_price: number | null
          assigned_to: string | null
          captured_at: string | null
          confidence: number | null
          content_hash: string | null
          counterparty_id: string | null
          created_at: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          embedding_status: string | null
          entities_mentioned: string[] | null
          extracted_text_status: string | null
          id: string
          index_status: string | null
          indexed_at: string | null
          market: string | null
          meg_canonical_id: string | null
          meg_entity_id: string | null
          notes: string | null
          offer_price: number | null
          portfolio_id: string | null
          projected_cap_rate: number | null
          projected_cash_on_cash: number | null
          projected_irr: number | null
          property_address: string | null
          property_id: string | null
          published_at: string | null
          source_system: string | null
          source_title: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          source_url: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          storage_bucket: string | null
          storage_path: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          vector_store_ref: string | null
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          asking_price?: number | null
          assigned_to?: string | null
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string | null
          counterparty_id?: string | null
          created_at?: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          embedding_status?: string | null
          entities_mentioned?: string[] | null
          extracted_text_status?: string | null
          id?: string
          index_status?: string | null
          indexed_at?: string | null
          market?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          notes?: string | null
          offer_price?: number | null
          portfolio_id?: string | null
          projected_cap_rate?: number | null
          projected_cash_on_cash?: number | null
          projected_irr?: number | null
          property_address?: string | null
          property_id?: string | null
          published_at?: string | null
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          storage_bucket?: string | null
          storage_path?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          asking_price?: number | null
          assigned_to?: string | null
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string | null
          counterparty_id?: string | null
          created_at?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          embedding_status?: string | null
          entities_mentioned?: string[] | null
          extracted_text_status?: string | null
          id?: string
          index_status?: string | null
          indexed_at?: string | null
          market?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          notes?: string | null
          offer_price?: number | null
          portfolio_id?: string | null
          projected_cap_rate?: number | null
          projected_cash_on_cash?: number | null
          projected_irr?: number | null
          property_address?: string | null
          property_id?: string | null
          published_at?: string | null
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          storage_bucket?: string | null
          storage_path?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          body: string
          captured_at: string | null
          confidence: number | null
          content_hash: string
          content_type: string
          created_at: string
          embedding_status: Database["public"]["Enums"]["embedding_status"]
          entities_mentioned: string[] | null
          extracted_text_status: Database["public"]["Enums"]["extracted_text_status"]
          file_path: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          index_status: Database["public"]["Enums"]["index_status"]
          indexed_at: string | null
          meg_canonical_id: string | null
          meg_entity_id: string | null
          mime_type: string | null
          owner_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          rights_constraints: string[]
          source_authority_tier:
            | Database["public"]["Enums"]["oracle_authority_tier"]
            | null
          source_license: string | null
          source_ref: string | null
          source_system: string
          source_title: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          source_url: string | null
          status: Database["public"]["Enums"]["document_status"]
          storage_bucket: string | null
          storage_path: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string | null
          vector_store_ref: string | null
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          body?: string
          captured_at?: string | null
          confidence?: number | null
          content_hash: string
          content_type?: string
          created_at?: string
          embedding_status?: Database["public"]["Enums"]["embedding_status"]
          entities_mentioned?: string[] | null
          extracted_text_status?: Database["public"]["Enums"]["extracted_text_status"]
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          index_status?: Database["public"]["Enums"]["index_status"]
          indexed_at?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          mime_type?: string | null
          owner_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          rights_constraints?: string[]
          source_authority_tier?:
            | Database["public"]["Enums"]["oracle_authority_tier"]
            | null
          source_license?: string | null
          source_ref?: string | null
          source_system: string
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id?: string | null
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          body?: string
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string
          content_type?: string
          created_at?: string
          embedding_status?: Database["public"]["Enums"]["embedding_status"]
          entities_mentioned?: string[] | null
          extracted_text_status?: Database["public"]["Enums"]["extracted_text_status"]
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          index_status?: Database["public"]["Enums"]["index_status"]
          indexed_at?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          mime_type?: string | null
          owner_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          rights_constraints?: string[]
          source_authority_tier?:
            | Database["public"]["Enums"]["oracle_authority_tier"]
            | null
          source_license?: string | null
          source_ref?: string | null
          source_system?: string
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string | null
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: []
      }
      eigen_chat_sessions: {
        Row: {
          created_at: string
          entity_scope: Json
          id: string
          last_retrieval_run_id: string | null
          metadata: Json
          owner_id: string
          policy_scope: Json
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_scope?: Json
          id?: string
          last_retrieval_run_id?: string | null
          metadata?: Json
          owner_id: string
          policy_scope?: Json
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_scope?: Json
          id?: string
          last_retrieval_run_id?: string | null
          metadata?: Json
          owner_id?: string
          policy_scope?: Json
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eigen_chat_sessions_last_retrieval_run_id_fkey"
            columns: ["last_retrieval_run_id"]
            isOneToOne: false
            referencedRelation: "retrieval_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      eigen_chat_turns: {
        Row: {
          citations: Json
          confidence: Json | null
          content: string
          created_at: string
          id: string
          latency_ms: number | null
          llm_critic_used: boolean
          llm_fallback_used: boolean
          llm_model: string | null
          llm_provider: string | null
          owner_id: string
          retrieval_run_id: string | null
          role: string
          session_id: string
          turn_index: number
        }
        Insert: {
          citations?: Json
          confidence?: Json | null
          content: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          llm_critic_used?: boolean
          llm_fallback_used?: boolean
          llm_model?: string | null
          llm_provider?: string | null
          owner_id: string
          retrieval_run_id?: string | null
          role: string
          session_id: string
          turn_index?: number
        }
        Update: {
          citations?: Json
          confidence?: Json | null
          content?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          llm_critic_used?: boolean
          llm_fallback_used?: boolean
          llm_model?: string | null
          llm_provider?: string | null
          owner_id?: string
          retrieval_run_id?: string | null
          role?: string
          session_id?: string
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "eigen_chat_turns_retrieval_run_id_fkey"
            columns: ["retrieval_run_id"]
            isOneToOne: false
            referencedRelation: "retrieval_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eigen_chat_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "eigen_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      eigen_governance_audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          run_id: string | null
          thesis_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          run_id?: string | null
          thesis_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          run_id?: string | null
          thesis_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eigen_governance_audit_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "oracle_whitespace_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eigen_governance_audit_log_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
        ]
      }
      eigen_oracle_outbox: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          oracle_signal_id: string | null
          payload: Json
          processed_at: string | null
          source_document_id: string | null
          source_ref: string
          source_system: string
          status: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          oracle_signal_id?: string | null
          payload?: Json
          processed_at?: string | null
          source_document_id?: string | null
          source_ref: string
          source_system: string
          status?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          oracle_signal_id?: string | null
          payload?: Json
          processed_at?: string | null
          source_document_id?: string | null
          source_ref?: string
          source_system?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "eigen_oracle_outbox_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      eigen_policy_access_grants: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          policy_tag: string
          principal_id: string
          principal_type: Database["public"]["Enums"]["eigen_policy_principal_type"]
          status: Database["public"]["Enums"]["eigen_policy_grant_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          policy_tag: string
          principal_id: string
          principal_type: Database["public"]["Enums"]["eigen_policy_principal_type"]
          status?: Database["public"]["Enums"]["eigen_policy_grant_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          policy_tag?: string
          principal_id?: string
          principal_type?: Database["public"]["Enums"]["eigen_policy_principal_type"]
          status?: Database["public"]["Enums"]["eigen_policy_grant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      eigen_policy_rule_events: {
        Row: {
          actor_id: string | null
          after_snapshot: Json
          before_snapshot: Json | null
          created_at: string
          event_type: string
          id: string
          rule_id: string
        }
        Insert: {
          actor_id?: string | null
          after_snapshot: Json
          before_snapshot?: Json | null
          created_at?: string
          event_type: string
          id?: string
          rule_id: string
        }
        Update: {
          actor_id?: string | null
          after_snapshot?: Json
          before_snapshot?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eigen_policy_rule_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      eigen_policy_rules: {
        Row: {
          capability_tag_pattern: string
          created_at: string
          effect: string
          id: string
          metadata: Json
          policy_tag: string
          rationale: string | null
          required_role: Database["public"]["Enums"]["charter_role"] | null
          updated_at: string
        }
        Insert: {
          capability_tag_pattern: string
          created_at?: string
          effect: string
          id?: string
          metadata?: Json
          policy_tag: string
          rationale?: string | null
          required_role?: Database["public"]["Enums"]["charter_role"] | null
          updated_at?: string
        }
        Update: {
          capability_tag_pattern?: string
          created_at?: string
          effect?: string
          id?: string
          metadata?: Json
          policy_tag?: string
          rationale?: string | null
          required_role?: Database["public"]["Enums"]["charter_role"] | null
          updated_at?: string
        }
        Relationships: []
      }
      eigen_public_rate_buckets: {
        Row: {
          bucket_key: string
          created_at: string
          request_count: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          created_at?: string
          request_count?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          created_at?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      eigen_site_registry: {
        Row: {
          capability_profile: Json
          created_at: string
          default_policy_scope: Json
          display_name: string
          metadata: Json
          mode: Database["public"]["Enums"]["eigen_site_mode"]
          origins: Json
          policy_notes: string | null
          site_id: string
          source_systems: Json
          status: Database["public"]["Enums"]["eigen_site_status"]
          updated_at: string
        }
        Insert: {
          capability_profile?: Json
          created_at?: string
          default_policy_scope?: Json
          display_name: string
          metadata?: Json
          mode?: Database["public"]["Enums"]["eigen_site_mode"]
          origins?: Json
          policy_notes?: string | null
          site_id: string
          source_systems?: Json
          status?: Database["public"]["Enums"]["eigen_site_status"]
          updated_at?: string
        }
        Update: {
          capability_profile?: Json
          created_at?: string
          default_policy_scope?: Json
          display_name?: string
          metadata?: Json
          mode?: Database["public"]["Enums"]["eigen_site_mode"]
          origins?: Json
          policy_notes?: string | null
          site_id?: string
          source_systems?: Json
          status?: Database["public"]["Enums"]["eigen_site_status"]
          updated_at?: string
        }
        Relationships: []
      }
      embedding_job_log: {
        Row: {
          chunk_id: string
          content_hash: string
          embedding_model: string
          processed_at: string
        }
        Insert: {
          chunk_id: string
          content_hash: string
          embedding_model?: string
          processed_at?: string
        }
        Update: {
          chunk_id?: string
          content_hash?: string
          embedding_model?: string
          processed_at?: string
        }
        Relationships: []
      }
      emerging_signals: {
        Row: {
          category: string
          compound_name: string
          confidence_score: number
          created_at: string
          emergence_score: number
          id: string
          potential_benefits: string[] | null
          research_links: string[] | null
          research_phase: string
          research_summary: string
          signal_strength: number
          time_to_trend: string
          updated_at: string
        }
        Insert: {
          category: string
          compound_name: string
          confidence_score?: number
          created_at?: string
          emergence_score?: number
          id: string
          potential_benefits?: string[] | null
          research_links?: string[] | null
          research_phase: string
          research_summary?: string
          signal_strength?: number
          time_to_trend?: string
          updated_at?: string
        }
        Update: {
          category?: string
          compound_name?: string
          confidence_score?: number
          created_at?: string
          emergence_score?: number
          id?: string
          potential_benefits?: string[] | null
          research_links?: string[] | null
          research_phase?: string
          research_summary?: string
          signal_strength?: number
          time_to_trend?: string
          updated_at?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          created_at: string
          ein: string | null
          id: string
          meg_canonical_id: string | null
          meg_entity_id: string | null
          name: string
          parent_entity_id: string | null
          source_system: string | null
          state: string | null
          status: string
          tags: string[] | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          created_at?: string
          ein?: string | null
          id?: string
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          name: string
          parent_entity_id?: string | null
          source_system?: string | null
          state?: string | null
          status?: string
          tags?: string[] | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          created_at?: string
          ein?: string | null
          id?: string
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          name?: string
          parent_entity_id?: string | null
          source_system?: string | null
          state?: string | null
          status?: string
          tags?: string[] | null
          type?: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_mentions: {
        Row: {
          chunk_id: string
          confidence: number
          created_at: string
          end_offset: number | null
          entity_id: string
          extracted_by: string
          extraction_model: string | null
          id: string
          mention_text: string
          mention_type: Database["public"]["Enums"]["entity_mention_type"]
          start_offset: number | null
        }
        Insert: {
          chunk_id: string
          confidence?: number
          created_at?: string
          end_offset?: number | null
          entity_id: string
          extracted_by?: string
          extraction_model?: string | null
          id?: string
          mention_text: string
          mention_type?: Database["public"]["Enums"]["entity_mention_type"]
          start_offset?: number | null
        }
        Update: {
          chunk_id?: string
          confidence?: number
          created_at?: string
          end_offset?: number | null
          entity_id?: string
          extracted_by?: string
          extraction_model?: string | null
          id?: string
          mention_text?: string
          mention_type?: Database["public"]["Enums"]["entity_mention_type"]
          start_offset?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_mentions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "asset_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_relations: {
        Row: {
          created_at: string
          discovered_by: string
          discovered_in_run_id: string | null
          evidence_chunk_ids: string[]
          evidence_count: number
          extraction_model: string | null
          id: string
          metadata: Json
          relation_type: Database["public"]["Enums"]["entity_relation_type"]
          source_entity_id: string
          target_entity_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          discovered_by?: string
          discovered_in_run_id?: string | null
          evidence_chunk_ids?: string[]
          evidence_count?: number
          extraction_model?: string | null
          id?: string
          metadata?: Json
          relation_type: Database["public"]["Enums"]["entity_relation_type"]
          source_entity_id: string
          target_entity_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          discovered_by?: string
          discovered_in_run_id?: string | null
          evidence_chunk_ids?: string[]
          evidence_count?: number
          extraction_model?: string | null
          id?: string
          metadata?: Json
          relation_type?: Database["public"]["Enums"]["entity_relation_type"]
          source_entity_id?: string
          target_entity_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_relations_discovered_in_run_id_fkey"
            columns: ["discovered_in_run_id"]
            isOneToOne: false
            referencedRelation: "oracle_whitespace_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relations_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "asset_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relations_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "asset_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          chunk_count: number
          chunking_mode: string
          completed_at: string | null
          created_at: string
          document_id: string | null
          embedding_model: string
          id: string
          metadata: Json
          source_ref: string
          source_system: string
          started_at: string
          status: Database["public"]["Enums"]["ingestion_run_status"]
        }
        Insert: {
          chunk_count?: number
          chunking_mode?: string
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          embedding_model?: string
          id?: string
          metadata?: Json
          source_ref: string
          source_system: string
          started_at?: string
          status?: Database["public"]["Enums"]["ingestion_run_status"]
        }
        Update: {
          chunk_count?: number
          chunking_mode?: string
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          embedding_model?: string
          id?: string
          metadata?: Json
          source_ref?: string
          source_system?: string
          started_at?: string
          status?: Database["public"]["Enums"]["ingestion_run_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_opportunities: {
        Row: {
          asset_classes: string[] | null
          content_hash: string | null
          created_at: string
          embedding_status: string | null
          extracted_text_status: string | null
          id: string
          index_status: string | null
          indexed_at: string | null
          meg_canonical_id: string | null
          meg_entity_id: string | null
          minimum_investment: string | null
          published_at: string | null
          source_system: string | null
          source_title: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          source_url: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          strategy: string
          summary: string | null
          tags: string[] | null
          target_markets: string[] | null
          target_return: string | null
          thesis: string
          title: string
          updated_at: string
          user_id: string
          vector_store_ref: string | null
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          asset_classes?: string[] | null
          content_hash?: string | null
          created_at?: string
          embedding_status?: string | null
          extracted_text_status?: string | null
          id?: string
          index_status?: string | null
          indexed_at?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          minimum_investment?: string | null
          published_at?: string | null
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          strategy: string
          summary?: string | null
          tags?: string[] | null
          target_markets?: string[] | null
          target_return?: string | null
          thesis: string
          title: string
          updated_at?: string
          user_id: string
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          asset_classes?: string[] | null
          content_hash?: string | null
          created_at?: string
          embedding_status?: string | null
          extracted_text_status?: string | null
          id?: string
          index_status?: string | null
          indexed_at?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          minimum_investment?: string | null
          published_at?: string | null
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          strategy?: string
          summary?: string | null
          tags?: string[] | null
          target_markets?: string[] | null
          target_return?: string | null
          thesis?: string
          title?: string
          updated_at?: string
          user_id?: string
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: []
      }
      investor_inquiries: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          opportunity_id: string | null
          source_system: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          status: string
          tags: string[] | null
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          opportunity_id?: string | null
          source_system?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          opportunity_id?: string | null
          source_system?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_inquiries_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "investment_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_analytics_workspaces: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          workspace_data: Json | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          workspace_data?: Json | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          workspace_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ip_analytics_workspaces_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          authority_score: number
          chunk_level: Database["public"]["Enums"]["chunk_level"]
          content: string
          content_hash: string
          created_at: string
          document_id: string
          embedding: string | null
          embedding_version: string | null
          entity_ids: Json
          freshness_score: number
          fts: unknown
          heading_path: Json
          id: string
          ingestion_run_id: string | null
          meg_entity_id: string | null
          oracle_relevance_score: number | null
          oracle_signal_id: string | null
          parent_chunk_id: string | null
          policy_tags: Json
          provenance_completeness: number
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          authority_score?: number
          chunk_level: Database["public"]["Enums"]["chunk_level"]
          content: string
          content_hash: string
          created_at?: string
          document_id: string
          embedding?: string | null
          embedding_version?: string | null
          entity_ids?: Json
          freshness_score?: number
          fts?: unknown
          heading_path?: Json
          id?: string
          ingestion_run_id?: string | null
          meg_entity_id?: string | null
          oracle_relevance_score?: number | null
          oracle_signal_id?: string | null
          parent_chunk_id?: string | null
          policy_tags?: Json
          provenance_completeness?: number
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          authority_score?: number
          chunk_level?: Database["public"]["Enums"]["chunk_level"]
          content?: string
          content_hash?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          embedding_version?: string | null
          entity_ids?: Json
          freshness_score?: number
          fts?: unknown
          heading_path?: Json
          id?: string
          ingestion_run_id?: string | null
          meg_entity_id?: string | null
          oracle_relevance_score?: number | null
          oracle_signal_id?: string | null
          parent_chunk_id?: string | null
          policy_tags?: Json
          provenance_completeness?: number
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_parent_chunk_id_fkey"
            columns: ["parent_chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      live_polls: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          options: Json
          poll_type: string
          question: string
          retreat_year_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          poll_type?: string
          question: string
          retreat_year_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          poll_type?: string
          question?: string
          retreat_year_id?: string
        }
        Relationships: []
      }
      market_intel: {
        Row: {
          asset_class: string | null
          captured_at: string | null
          confidence: number | null
          content_hash: string | null
          created_at: string
          data_points: Json | null
          embedding_status: string | null
          entities_mentioned: string[] | null
          extracted_text_status: string | null
          id: string
          index_status: string | null
          indexed_at: string | null
          market: string | null
          meg_canonical_id: string | null
          meg_entity_id: string | null
          published_at: string | null
          source_system: string | null
          source_title: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          source_url: string | null
          storage_bucket: string | null
          storage_path: string | null
          summary: string
          summary_text: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          vector_store_ref: string | null
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          asset_class?: string | null
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string | null
          created_at?: string
          data_points?: Json | null
          embedding_status?: string | null
          entities_mentioned?: string[] | null
          extracted_text_status?: string | null
          id?: string
          index_status?: string | null
          indexed_at?: string | null
          market?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          published_at?: string | null
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          summary: string
          summary_text?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          asset_class?: string | null
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string | null
          created_at?: string
          data_points?: Json | null
          embedding_status?: string | null
          entities_mentioned?: string[] | null
          extracted_text_status?: string | null
          id?: string
          index_status?: string | null
          indexed_at?: string | null
          market?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          published_at?: string | null
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          summary?: string
          summary_text?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: []
      }
      meg_entities: {
        Row: {
          attributes: Json
          canonical_name: string
          created_at: string
          entity_type: Database["public"]["Enums"]["meg_entity_type"]
          external_ids: Json
          id: string
          merged_into_id: string | null
          metadata: Json
          profile_id: string | null
          status: Database["public"]["Enums"]["meg_entity_status"]
          updated_at: string
        }
        Insert: {
          attributes?: Json
          canonical_name: string
          created_at?: string
          entity_type: Database["public"]["Enums"]["meg_entity_type"]
          external_ids?: Json
          id?: string
          merged_into_id?: string | null
          metadata?: Json
          profile_id?: string | null
          status?: Database["public"]["Enums"]["meg_entity_status"]
          updated_at?: string
        }
        Update: {
          attributes?: Json
          canonical_name?: string
          created_at?: string
          entity_type?: Database["public"]["Enums"]["meg_entity_type"]
          external_ids?: Json
          id?: string
          merged_into_id?: string | null
          metadata?: Json
          profile_id?: string | null
          status?: Database["public"]["Enums"]["meg_entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_entities_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_entity_aliases: {
        Row: {
          alias_kind: Database["public"]["Enums"]["meg_alias_kind"]
          alias_value: string
          confidence: number
          created_at: string
          id: string
          meg_entity_id: string
          metadata: Json
          source: string | null
        }
        Insert: {
          alias_kind: Database["public"]["Enums"]["meg_alias_kind"]
          alias_value: string
          confidence?: number
          created_at?: string
          id?: string
          meg_entity_id: string
          metadata?: Json
          source?: string | null
        }
        Update: {
          alias_kind?: Database["public"]["Enums"]["meg_alias_kind"]
          alias_value?: string
          confidence?: number
          created_at?: string
          id?: string
          meg_entity_id?: string
          metadata?: Json
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meg_entity_aliases_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_entity_edges: {
        Row: {
          confidence: number
          created_at: string
          edge_type: Database["public"]["Enums"]["meg_edge_type"]
          id: string
          metadata: Json
          source: string | null
          source_entity_id: string
          target_entity_id: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          edge_type: Database["public"]["Enums"]["meg_edge_type"]
          id?: string
          metadata?: Json
          source?: string | null
          source_entity_id: string
          target_entity_id: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          edge_type?: Database["public"]["Enums"]["meg_edge_type"]
          id?: string
          metadata?: Json
          source?: string | null
          source_entity_id?: string
          target_entity_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meg_entity_edges_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meg_entity_edges_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_entries: {
        Row: {
          confidence_band: string
          conflict_group: string | null
          created_at: string
          expires_at: string | null
          id: string
          key: string
          owner_id: string
          retention_class: Database["public"]["Enums"]["retention_class"]
          scope: Database["public"]["Enums"]["memory_scope"]
          superseded_by: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          confidence_band?: string
          conflict_group?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          key: string
          owner_id: string
          retention_class?: Database["public"]["Enums"]["retention_class"]
          scope: Database["public"]["Enums"]["memory_scope"]
          superseded_by?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          confidence_band?: string
          conflict_group?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          key?: string
          owner_id?: string
          retention_class?: Database["public"]["Enums"]["retention_class"]
          scope?: Database["public"]["Enums"]["memory_scope"]
          superseded_by?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "memory_entries_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "memory_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          author: string | null
          body: string | null
          captured_at: string | null
          category: Database["public"]["Enums"]["news_category"]
          confidence: number | null
          content_hash: string | null
          created_at: string
          embedding_status: string | null
          entities_mentioned: string[] | null
          excerpt: string
          extracted_text_status: string | null
          featured: boolean | null
          id: string
          image_url: string | null
          index_status: string | null
          indexed_at: string | null
          meg_canonical_id: string | null
          meg_entity_id: string | null
          published_at: string | null
          slug: string
          source_system: string | null
          source_title: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          source_url: string | null
          storage_bucket: string | null
          storage_path: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          vector_store_ref: string | null
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          author?: string | null
          body?: string | null
          captured_at?: string | null
          category: Database["public"]["Enums"]["news_category"]
          confidence?: number | null
          content_hash?: string | null
          created_at?: string
          embedding_status?: string | null
          entities_mentioned?: string[] | null
          excerpt: string
          extracted_text_status?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          index_status?: string | null
          indexed_at?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          published_at?: string | null
          slug: string
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          author?: string | null
          body?: string | null
          captured_at?: string | null
          category?: Database["public"]["Enums"]["news_category"]
          confidence?: number | null
          content_hash?: string | null
          created_at?: string
          embedding_status?: string | null
          entities_mentioned?: string[] | null
          excerpt?: string
          extracted_text_status?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          index_status?: string | null
          indexed_at?: string | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          published_at?: string | null
          slug?: string
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          vector_store_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: []
      }
      oracle_calibration_log: {
        Row: {
          accuracy_score: number | null
          actual_verdict: string
          calibration_error: number | null
          confidence_delta: number | null
          created_at: string
          domain: string | null
          entity_types: string[]
          id: string
          model_version: string | null
          outcome_id: string
          predicted_confidence: number
          predicted_evidence_strength: number | null
          prompt_version: string | null
          run_id: string | null
          thesis_id: string
        }
        Insert: {
          accuracy_score?: number | null
          actual_verdict: string
          calibration_error?: number | null
          confidence_delta?: number | null
          created_at?: string
          domain?: string | null
          entity_types?: string[]
          id?: string
          model_version?: string | null
          outcome_id: string
          predicted_confidence: number
          predicted_evidence_strength?: number | null
          prompt_version?: string | null
          run_id?: string | null
          thesis_id: string
        }
        Update: {
          accuracy_score?: number | null
          actual_verdict?: string
          calibration_error?: number | null
          confidence_delta?: number | null
          created_at?: string
          domain?: string | null
          entity_types?: string[]
          id?: string
          model_version?: string | null
          outcome_id?: string
          predicted_confidence?: number
          predicted_evidence_strength?: number | null
          prompt_version?: string | null
          run_id?: string | null
          thesis_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_calibration_log_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "oracle_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_calibration_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "oracle_whitespace_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_calibration_log_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_evidence_items: {
        Row: {
          author_info: Json
          confidence: number
          content_summary: string
          created_at: string
          evidence_strength: number
          id: string
          metadata: Json
          profile_id: string
          publication_url: string | null
          signal_id: string | null
          source_class: string
          source_date: string | null
          source_lane: string
          source_ref: string
          updated_at: string
        }
        Insert: {
          author_info?: Json
          confidence?: number
          content_summary: string
          created_at?: string
          evidence_strength?: number
          id?: string
          metadata?: Json
          profile_id: string
          publication_url?: string | null
          signal_id?: string | null
          source_class: string
          source_date?: string | null
          source_lane: string
          source_ref: string
          updated_at?: string
        }
        Update: {
          author_info?: Json
          confidence?: number
          content_summary?: string
          created_at?: string
          evidence_strength?: number
          id?: string
          metadata?: Json
          profile_id?: string
          publication_url?: string | null
          signal_id?: string | null
          source_class?: string
          source_date?: string | null
          source_lane?: string
          source_ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_evidence_items_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "oracle_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_graph_extraction_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          priority: number
          run_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          priority?: number
          run_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          priority?: number
          run_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_graph_extraction_jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "oracle_whitespace_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_outcomes: {
        Row: {
          accuracy_score: number | null
          confidence_delta: number | null
          created_at: string
          evidence_refs: Json
          id: string
          metadata: Json
          observed_at: string
          outcome_source: Database["public"]["Enums"]["oracle_outcome_source"]
          profile_id: string | null
          summary: string
          thesis_id: string
          updated_at: string
          verdict: Database["public"]["Enums"]["oracle_outcome_verdict"]
        }
        Insert: {
          accuracy_score?: number | null
          confidence_delta?: number | null
          created_at?: string
          evidence_refs?: Json
          id?: string
          metadata?: Json
          observed_at?: string
          outcome_source?: Database["public"]["Enums"]["oracle_outcome_source"]
          profile_id?: string | null
          summary: string
          thesis_id: string
          updated_at?: string
          verdict?: Database["public"]["Enums"]["oracle_outcome_verdict"]
        }
        Update: {
          accuracy_score?: number | null
          confidence_delta?: number | null
          created_at?: string
          evidence_refs?: Json
          id?: string
          metadata?: Json
          observed_at?: string
          outcome_source?: Database["public"]["Enums"]["oracle_outcome_source"]
          profile_id?: string | null
          summary?: string
          thesis_id?: string
          updated_at?: string
          verdict?: Database["public"]["Enums"]["oracle_outcome_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "oracle_outcomes_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_publication_events: {
        Row: {
          created_at: string
          decided_at: string
          decided_by: string
          from_state: string | null
          id: string
          metadata: Json
          notes: string | null
          target_id: string
          target_type: string
          to_state: string
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decided_by: string
          from_state?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          target_id: string
          target_type: string
          to_state: string
        }
        Update: {
          created_at?: string
          decided_at?: string
          decided_by?: string
          from_state?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          target_id?: string
          target_type?: string
          to_state?: string
        }
        Relationships: []
      }
      oracle_profile_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          entity_asset_id: string
          id: string
          metadata: Json
          signal_count: number
          started_at: string | null
          status: string
          summary: string | null
          top_score: number | null
          triggered_by: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entity_asset_id: string
          id?: string
          metadata?: Json
          signal_count?: number
          started_at?: string | null
          status?: string
          summary?: string | null
          top_score?: number | null
          triggered_by: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entity_asset_id?: string
          id?: string
          metadata?: Json
          signal_count?: number
          started_at?: string | null
          status?: string
          summary?: string | null
          top_score?: number | null
          triggered_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      oracle_run_evidence: {
        Row: {
          adversarial_pass: boolean | null
          authority_score: number
          chunk_id: string | null
          content_excerpt: string | null
          created_at: string
          evidence_tier: string | null
          id: string
          ingest_run: Json
          provenance_chain: Json
          registry_verified_ratio: number | null
          relevance_score: number | null
          rights_constraints: string[]
          run_id: string
          source_ref: string
          source_system: string | null
          source_type: Database["public"]["Enums"]["oracle_authority_tier"]
          sources_queried: string[]
        }
        Insert: {
          adversarial_pass?: boolean | null
          authority_score?: number
          chunk_id?: string | null
          content_excerpt?: string | null
          created_at?: string
          evidence_tier?: string | null
          id?: string
          ingest_run?: Json
          provenance_chain?: Json
          registry_verified_ratio?: number | null
          relevance_score?: number | null
          rights_constraints?: string[]
          run_id: string
          source_ref: string
          source_system?: string | null
          source_type: Database["public"]["Enums"]["oracle_authority_tier"]
          sources_queried?: string[]
        }
        Update: {
          adversarial_pass?: boolean | null
          authority_score?: number
          chunk_id?: string | null
          content_excerpt?: string | null
          created_at?: string
          evidence_tier?: string | null
          id?: string
          ingest_run?: Json
          provenance_chain?: Json
          registry_verified_ratio?: number | null
          relevance_score?: number | null
          rights_constraints?: string[]
          run_id?: string
          source_ref?: string
          source_system?: string | null
          source_type?: Database["public"]["Enums"]["oracle_authority_tier"]
          sources_queried?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "oracle_run_evidence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "oracle_whitespace_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_run_hypotheses: {
        Row: {
          actionability: number | null
          citation_ids: string[]
          composite_score: number | null
          confidence: number | null
          created_at: string
          evidence_strength: number | null
          hypothesis_text: string
          id: string
          novelty_score: number | null
          publishable: boolean
          reasoning_trace: string | null
          run_id: string
          thesis_id: string | null
          verification_passed: boolean | null
        }
        Insert: {
          actionability?: number | null
          citation_ids?: string[]
          composite_score?: number | null
          confidence?: number | null
          created_at?: string
          evidence_strength?: number | null
          hypothesis_text: string
          id?: string
          novelty_score?: number | null
          publishable?: boolean
          reasoning_trace?: string | null
          run_id: string
          thesis_id?: string | null
          verification_passed?: boolean | null
        }
        Update: {
          actionability?: number | null
          citation_ids?: string[]
          composite_score?: number | null
          confidence?: number | null
          created_at?: string
          evidence_strength?: number | null
          hypothesis_text?: string
          id?: string
          novelty_score?: number | null
          publishable?: boolean
          reasoning_trace?: string | null
          run_id?: string
          thesis_id?: string | null
          verification_passed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "oracle_run_hypotheses_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "oracle_whitespace_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_run_hypotheses_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_run_scorecards: {
        Row: {
          avg_composite_score: number
          avg_confidence: number
          avg_evidence_strength: number
          citation_coverage: number
          created_at: string
          evidence_diversity: number
          hypothesis_count: number
          id: string
          model_version: string
          novelty_score: number
          published_count: number
          run_id: string
          updated_at: string
          verified_rate: number
        }
        Insert: {
          avg_composite_score?: number
          avg_confidence?: number
          avg_evidence_strength?: number
          citation_coverage?: number
          created_at?: string
          evidence_diversity?: number
          hypothesis_count?: number
          id?: string
          model_version: string
          novelty_score?: number
          published_count?: number
          run_id: string
          updated_at?: string
          verified_rate?: number
        }
        Update: {
          avg_composite_score?: number
          avg_confidence?: number
          avg_evidence_strength?: number
          citation_coverage?: number
          created_at?: string
          evidence_diversity?: number
          hypothesis_count?: number
          id?: string
          model_version?: string
          novelty_score?: number
          published_count?: number
          run_id?: string
          updated_at?: string
          verified_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "oracle_run_scorecards_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "oracle_whitespace_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_service_layer_run_decisions: {
        Row: {
          created_at: string
          decided_at: string
          decided_by: string
          decision_status: string
          id: string
          notes: string | null
          oracle_service_layer_run_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decided_by: string
          decision_status: string
          id?: string
          notes?: string | null
          oracle_service_layer_run_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string
          decided_by?: string
          decision_status?: string
          id?: string
          notes?: string | null
          oracle_service_layer_run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_service_layer_run_decis_oracle_service_layer_run_id_fkey"
            columns: ["oracle_service_layer_run_id"]
            isOneToOne: true
            referencedRelation: "oracle_service_layer_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_service_layer_run_outcomes: {
        Row: {
          created_at: string
          id: string
          oracle_service_layer_run_id: string
          outcome_closed_at: string | null
          outcome_notes: string | null
          outcome_revenue: number | null
          outcome_status: string
          recorded_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          oracle_service_layer_run_id: string
          outcome_closed_at?: string | null
          outcome_notes?: string | null
          outcome_revenue?: number | null
          outcome_status: string
          recorded_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          oracle_service_layer_run_id?: string
          outcome_closed_at?: string | null
          outcome_notes?: string | null
          outcome_revenue?: number | null
          outcome_status?: string
          recorded_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_service_layer_run_outco_oracle_service_layer_run_id_fkey"
            columns: ["oracle_service_layer_run_id"]
            isOneToOne: true
            referencedRelation: "oracle_service_layer_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_service_layer_runs: {
        Row: {
          analysis_json: Json | null
          created_at: string
          entity_asset_id: string
          error_message: string | null
          id: string
          metadata: Json
          profile_run_id: string
          run_label: string
          status: string
          triggered_by: string
          updated_at: string
          whitespace_run_id: string | null
        }
        Insert: {
          analysis_json?: Json | null
          created_at?: string
          entity_asset_id: string
          error_message?: string | null
          id?: string
          metadata?: Json
          profile_run_id: string
          run_label: string
          status?: string
          triggered_by: string
          updated_at?: string
          whitespace_run_id?: string | null
        }
        Update: {
          analysis_json?: Json | null
          created_at?: string
          entity_asset_id?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          profile_run_id?: string
          run_label?: string
          status?: string
          triggered_by?: string
          updated_at?: string
          whitespace_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oracle_service_layer_runs_profile_run_id_fkey"
            columns: ["profile_run_id"]
            isOneToOne: false
            referencedRelation: "oracle_profile_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_service_layer_runs_whitespace_run_id_fkey"
            columns: ["whitespace_run_id"]
            isOneToOne: false
            referencedRelation: "oracle_whitespace_core_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_signals: {
        Row: {
          analysis_document_id: string | null
          confidence: Database["public"]["Enums"]["confidence_band"]
          created_at: string
          entity_asset_id: string
          id: string
          producer_ref: string
          publication_notes: string | null
          publication_state: Database["public"]["Enums"]["oracle_publication_state"]
          published_at: string | null
          published_by: string | null
          reasons: string[]
          score: number
          scored_at: string
          source_asset_id: string | null
          status: Database["public"]["Enums"]["signal_status"]
          tags: string[]
          updated_at: string
          version: number
        }
        Insert: {
          analysis_document_id?: string | null
          confidence: Database["public"]["Enums"]["confidence_band"]
          created_at?: string
          entity_asset_id: string
          id?: string
          producer_ref: string
          publication_notes?: string | null
          publication_state?: Database["public"]["Enums"]["oracle_publication_state"]
          published_at?: string | null
          published_by?: string | null
          reasons?: string[]
          score: number
          scored_at?: string
          source_asset_id?: string | null
          status?: Database["public"]["Enums"]["signal_status"]
          tags?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          analysis_document_id?: string | null
          confidence?: Database["public"]["Enums"]["confidence_band"]
          created_at?: string
          entity_asset_id?: string
          id?: string
          producer_ref?: string
          publication_notes?: string | null
          publication_state?: Database["public"]["Enums"]["oracle_publication_state"]
          published_at?: string | null
          published_by?: string | null
          reasons?: string[]
          score?: number
          scored_at?: string
          source_asset_id?: string | null
          status?: Database["public"]["Enums"]["signal_status"]
          tags?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "oracle_signals_analysis_document_id_fkey"
            columns: ["analysis_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_source_packs: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          profile_id: string
          source_ids: Json
          source_lane: Database["public"]["Enums"]["oracle_source_lane"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          profile_id: string
          source_ids?: Json
          source_lane: Database["public"]["Enums"]["oracle_source_lane"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          profile_id?: string
          source_ids?: Json
          source_lane?: Database["public"]["Enums"]["oracle_source_lane"]
          updated_at?: string
        }
        Relationships: []
      }
      oracle_theses: {
        Row: {
          access_policy: Json
          confidence: number
          contradiction_evidence_item_ids: Json
          created_at: string
          decision_metadata: Json
          duplicate_of_thesis_id: string | null
          evidence_strength: number
          id: string
          inspiration_evidence_item_ids: Json
          inspiration_signal_ids: Json
          last_decision_at: string | null
          last_decision_by: string | null
          meg_entity_id: string | null
          metadata: Json
          novelty_status: Database["public"]["Enums"]["oracle_novelty_status"]
          platform_id: string | null
          profile_id: string
          publication_state: Database["public"]["Enums"]["oracle_publication_state"]
          published_at: string | null
          published_by: string | null
          site_domain: string | null
          status: Database["public"]["Enums"]["oracle_thesis_status"]
          superseded_by_thesis_id: string | null
          thesis_statement: string
          title: string
          uncertainty_summary: string | null
          updated_at: string
          validation_evidence_item_ids: Json
          visibility_class: string | null
        }
        Insert: {
          access_policy?: Json
          confidence?: number
          contradiction_evidence_item_ids?: Json
          created_at?: string
          decision_metadata?: Json
          duplicate_of_thesis_id?: string | null
          evidence_strength?: number
          id?: string
          inspiration_evidence_item_ids?: Json
          inspiration_signal_ids?: Json
          last_decision_at?: string | null
          last_decision_by?: string | null
          meg_entity_id?: string | null
          metadata?: Json
          novelty_status?: Database["public"]["Enums"]["oracle_novelty_status"]
          platform_id?: string | null
          profile_id: string
          publication_state?: Database["public"]["Enums"]["oracle_publication_state"]
          published_at?: string | null
          published_by?: string | null
          site_domain?: string | null
          status?: Database["public"]["Enums"]["oracle_thesis_status"]
          superseded_by_thesis_id?: string | null
          thesis_statement: string
          title: string
          uncertainty_summary?: string | null
          updated_at?: string
          validation_evidence_item_ids?: Json
          visibility_class?: string | null
        }
        Update: {
          access_policy?: Json
          confidence?: number
          contradiction_evidence_item_ids?: Json
          created_at?: string
          decision_metadata?: Json
          duplicate_of_thesis_id?: string | null
          evidence_strength?: number
          id?: string
          inspiration_evidence_item_ids?: Json
          inspiration_signal_ids?: Json
          last_decision_at?: string | null
          last_decision_by?: string | null
          meg_entity_id?: string | null
          metadata?: Json
          novelty_status?: Database["public"]["Enums"]["oracle_novelty_status"]
          platform_id?: string | null
          profile_id?: string
          publication_state?: Database["public"]["Enums"]["oracle_publication_state"]
          published_at?: string | null
          published_by?: string | null
          site_domain?: string | null
          status?: Database["public"]["Enums"]["oracle_thesis_status"]
          superseded_by_thesis_id?: string | null
          thesis_statement?: string
          title?: string
          uncertainty_summary?: string | null
          updated_at?: string
          validation_evidence_item_ids?: Json
          visibility_class?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oracle_theses_duplicate_of_thesis_id_fkey"
            columns: ["duplicate_of_thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_theses_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_theses_superseded_by_thesis_id_fkey"
            columns: ["superseded_by_thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_thesis_evidence_links: {
        Row: {
          created_at: string
          evidence_item_id: string
          notes: string | null
          role: Database["public"]["Enums"]["oracle_thesis_evidence_role"]
          thesis_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          evidence_item_id: string
          notes?: string | null
          role: Database["public"]["Enums"]["oracle_thesis_evidence_role"]
          thesis_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          evidence_item_id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["oracle_thesis_evidence_role"]
          thesis_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "oracle_thesis_evidence_links_evidence_item_id_fkey"
            columns: ["evidence_item_id"]
            isOneToOne: false
            referencedRelation: "oracle_evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_thesis_evidence_links_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_thesis_knowledge_links: {
        Row: {
          confidence: number
          created_at: string
          distillation_notes: string | null
          id: string
          knowledge_chunk_id: string
          link_type: Database["public"]["Enums"]["thesis_knowledge_link_type"]
          metadata: Json
          status: Database["public"]["Enums"]["thesis_knowledge_link_status"]
          thesis_id: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          distillation_notes?: string | null
          id?: string
          knowledge_chunk_id: string
          link_type: Database["public"]["Enums"]["thesis_knowledge_link_type"]
          metadata?: Json
          status?: Database["public"]["Enums"]["thesis_knowledge_link_status"]
          thesis_id: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          distillation_notes?: string | null
          id?: string
          knowledge_chunk_id?: string
          link_type?: Database["public"]["Enums"]["thesis_knowledge_link_type"]
          metadata?: Json
          status?: Database["public"]["Enums"]["thesis_knowledge_link_status"]
          thesis_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_thesis_knowledge_links_knowledge_chunk_id_fkey"
            columns: ["knowledge_chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oracle_thesis_knowledge_links_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_whitespace_core_runs: {
        Row: {
          analysis_json: Json
          created_at: string
          entity_asset_id: string
          id: string
          run_label: string
          updated_at: string
        }
        Insert: {
          analysis_json?: Json
          created_at?: string
          entity_asset_id: string
          id?: string
          run_label: string
          updated_at?: string
        }
        Update: {
          analysis_json?: Json
          created_at?: string
          entity_asset_id?: string
          id?: string
          run_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      oracle_whitespace_runs: {
        Row: {
          completed_at: string | null
          constraints: Json
          core_run_id: string | null
          created_at: string
          created_by: string
          domain: string
          error_message: string | null
          evaluation: Json
          evidence_sources_allowed: string[]
          id: string
          risk_level: Database["public"]["Enums"]["oracle_risk_level"]
          run_label: string | null
          stage_progress: Json
          started_at: string | null
          status: Database["public"]["Enums"]["oracle_run_status"]
          target_entities: string[]
          time_horizon: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          constraints?: Json
          core_run_id?: string | null
          created_at?: string
          created_by: string
          domain: string
          error_message?: string | null
          evaluation?: Json
          evidence_sources_allowed?: string[]
          id?: string
          risk_level?: Database["public"]["Enums"]["oracle_risk_level"]
          run_label?: string | null
          stage_progress?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["oracle_run_status"]
          target_entities?: string[]
          time_horizon?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          constraints?: Json
          core_run_id?: string | null
          created_at?: string
          created_by?: string
          domain?: string
          error_message?: string | null
          evaluation?: Json
          evidence_sources_allowed?: string[]
          id?: string
          risk_level?: Database["public"]["Enums"]["oracle_risk_level"]
          run_label?: string | null
          stage_progress?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["oracle_run_status"]
          target_entities?: string[]
          time_horizon?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_whitespace_runs_core_run_id_fkey"
            columns: ["core_run_id"]
            isOneToOne: false
            referencedRelation: "oracle_whitespace_core_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_submissions: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          photo_url: string
          retreat_year_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url: string
          retreat_year_id: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url?: string
          retreat_year_id?: string
          user_id?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          selected_option: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          selected_option: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          selected_option?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "live_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          description: string | null
          entity_id: string | null
          id: string
          meg_canonical_id: string | null
          meg_entity_id: string | null
          name: string
          property_count: number | null
          source_system: string | null
          status: string
          strategy: string | null
          tags: string[] | null
          total_value: number | null
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          name: string
          property_count?: number | null
          source_system?: string | null
          status?: string
          strategy?: string | null
          tags?: string[] | null
          total_value?: number | null
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          name?: string
          property_count?: number | null
          source_system?: string | null
          status?: string
          strategy?: string | null
          tags?: string[] | null
          total_value?: number | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          display_name: string | null
          id: string
          preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          acquisition_date: string | null
          acquisition_price: number | null
          address: string
          captured_at: string | null
          city: string
          confidence: number | null
          created_at: string
          current_value: number | null
          entities_mentioned: string[] | null
          entity_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          meg_canonical_id: string | null
          meg_entity_id: string | null
          name: string
          portfolio_id: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          source_system: string | null
          source_title: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          source_url: string | null
          sqft: number | null
          state: string
          status: string
          tags: string[] | null
          units: number | null
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["visibility_level"] | null
          year_built: number | null
          zip: string
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_price?: number | null
          address: string
          captured_at?: string | null
          city: string
          confidence?: number | null
          created_at?: string
          current_value?: number | null
          entities_mentioned?: string[] | null
          entity_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          name: string
          portfolio_id?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          sqft?: number | null
          state: string
          status?: string
          tags?: string[] | null
          units?: number | null
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
          year_built?: number | null
          zip: string
        }
        Update: {
          acquisition_date?: string | null
          acquisition_price?: number | null
          address?: string
          captured_at?: string | null
          city?: string
          confidence?: number | null
          created_at?: string
          current_value?: number | null
          entities_mentioned?: string[] | null
          entity_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          name?: string
          portfolio_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          source_system?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          sqft?: number | null
          state?: string
          status?: string
          tags?: string[] | null
          units?: number | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
          year_built?: number | null
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_questions: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          is_answered: boolean
          question: string
          retreat_year_id: string
          upvotes: number
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          is_answered?: boolean
          question: string
          retreat_year_id: string
          upvotes?: number
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          is_answered?: boolean
          question?: string
          retreat_year_id?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: []
      }
      qa_upvotes: {
        Row: {
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_upvotes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "qa_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      r2_core_asset_evidence_links: {
        Row: {
          confidence: number | null
          created_at: string
          from_asset_id: string
          id: string
          link_kind: Database["public"]["Enums"]["evidence_link_kind"]
          metadata: Json
          to_asset_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          from_asset_id: string
          id?: string
          link_kind: Database["public"]["Enums"]["evidence_link_kind"]
          metadata?: Json
          to_asset_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          from_asset_id?: string
          id?: string
          link_kind?: Database["public"]["Enums"]["evidence_link_kind"]
          metadata?: Json
          to_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_evidence_links_from_asset_id_fkey"
            columns: ["from_asset_id"]
            isOneToOne: false
            referencedRelation: "r2_core_asset_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_evidence_links_to_asset_id_fkey"
            columns: ["to_asset_id"]
            isOneToOne: false
            referencedRelation: "r2_core_asset_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      r2_core_asset_registry: {
        Row: {
          created_at: string
          domain: string
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          label: string
          metadata: Json
          ref_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          kind: Database["public"]["Enums"]["asset_kind"]
          label: string
          metadata?: Json
          ref_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          label?: string
          metadata?: Json
          ref_id?: string
        }
        Relationships: []
      }
      relationship_graph_edges: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          label: string | null
          metadata: Json | null
          source_node_id: string
          target_node_id: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          label?: string | null
          metadata?: Json | null
          source_node_id: string
          target_node_id: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          label?: string | null
          metadata?: Json | null
          source_node_id?: string
          target_node_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationship_graph_edges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_graph_nodes: {
        Row: {
          category: string
          client_id: string
          created_at: string | null
          id: string
          label: string
          metadata: Json | null
          sublabel: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string | null
          id?: string
          label: string
          metadata?: Json | null
          sublabel?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          sublabel?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationship_graph_nodes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      retreat_agenda_items: {
        Row: {
          created_at: string
          day_number: number
          description: string | null
          display_order: number | null
          end_time: string | null
          id: string
          location: string | null
          retreat_year_id: string
          session_type: string | null
          speaker_name: string | null
          start_time: string | null
          title: string
        }
        Insert: {
          created_at?: string
          day_number?: number
          description?: string | null
          display_order?: number | null
          end_time?: string | null
          id?: string
          location?: string | null
          retreat_year_id: string
          session_type?: string | null
          speaker_name?: string | null
          start_time?: string | null
          title: string
        }
        Update: {
          created_at?: string
          day_number?: number
          description?: string | null
          display_order?: number | null
          end_time?: string | null
          id?: string
          location?: string | null
          retreat_year_id?: string
          session_type?: string | null
          speaker_name?: string | null
          start_time?: string | null
          title?: string
        }
        Relationships: []
      }
      retreat_attendees: {
        Row: {
          attendance_count: number | null
          attendance_years: number[] | null
          avatar_url: string | null
          bio: string | null
          company: string | null
          created_at: string
          email: string | null
          first_attended_year: number | null
          id: string
          last_attended_year: number | null
          linkedin_url: string | null
          name: string
          title: string | null
          topics_of_interest: string | null
        }
        Insert: {
          attendance_count?: number | null
          attendance_years?: number[] | null
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          first_attended_year?: number | null
          id?: string
          last_attended_year?: number | null
          linkedin_url?: string | null
          name: string
          title?: string | null
          topics_of_interest?: string | null
        }
        Update: {
          attendance_count?: number | null
          attendance_years?: number[] | null
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          first_attended_year?: number | null
          id?: string
          last_attended_year?: number | null
          linkedin_url?: string | null
          name?: string
          title?: string | null
          topics_of_interest?: string | null
        }
        Relationships: []
      }
      retreat_content_reviews: {
        Row: {
          created_at: string
          id: string
          key_themes: string[] | null
          media_id: string | null
          rating: number | null
          review_text: string | null
          title: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          key_themes?: string[] | null
          media_id?: string | null
          rating?: number | null
          review_text?: string | null
          title: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          key_themes?: string[] | null
          media_id?: string | null
          rating?: number | null
          review_text?: string | null
          title?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "retreat_content_reviews_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "retreat_media"
            referencedColumns: ["id"]
          },
        ]
      }
      retreat_content_takeaways: {
        Row: {
          category: string | null
          created_at: string
          id: string
          importance: string | null
          media_id: string | null
          takeaway: string
          year: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          importance?: string | null
          media_id?: string | null
          takeaway: string
          year?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          importance?: string | null
          media_id?: string | null
          takeaway?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "retreat_content_takeaways_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "retreat_media"
            referencedColumns: ["id"]
          },
        ]
      }
      retreat_discussions: {
        Row: {
          created_at: string
          id: string
          message: string
          parent_id: string | null
          retreat_year_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          parent_id?: string | null
          retreat_year_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          parent_id?: string | null
          retreat_year_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retreat_discussions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "retreat_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      retreat_media: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          display_order: number | null
          file_url: string
          id: string
          key_themes: string[] | null
          media_type: string
          retreat_year_id: string | null
          speaker_id: string | null
          speaker_name: string | null
          thumbnail_url: string | null
          title: string
          year: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          file_url: string
          id?: string
          key_themes?: string[] | null
          media_type?: string
          retreat_year_id?: string | null
          speaker_id?: string | null
          speaker_name?: string | null
          thumbnail_url?: string | null
          title: string
          year?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          file_url?: string
          id?: string
          key_themes?: string[] | null
          media_type?: string
          retreat_year_id?: string | null
          speaker_id?: string | null
          speaker_name?: string | null
          thumbnail_url?: string | null
          title?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "retreat_media_retreat_year_id_fkey"
            columns: ["retreat_year_id"]
            isOneToOne: false
            referencedRelation: "retreat_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retreat_media_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "retreat_speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      retreat_rsvps: {
        Row: {
          created_at: string
          id: string
          retreat_year_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          retreat_year_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          retreat_year_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      retreat_speakers: {
        Row: {
          bio: string | null
          company: string | null
          created_at: string
          headshot_url: string | null
          id: string
          linkedin_url: string | null
          name: string
          title: string | null
        }
        Insert: {
          bio?: string | null
          company?: string | null
          created_at?: string
          headshot_url?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          title?: string | null
        }
        Update: {
          bio?: string | null
          company?: string | null
          created_at?: string
          headshot_url?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          title?: string | null
        }
        Relationships: []
      }
      retreat_years: {
        Row: {
          cover_image_url: string | null
          created_at: string
          date_end: string | null
          date_start: string | null
          description: string | null
          id: string
          location: string | null
          title: string | null
          year: number
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          description?: string | null
          id?: string
          location?: string | null
          title?: string | null
          year: number
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          description?: string | null
          id?: string
          location?: string | null
          title?: string | null
          year?: number
        }
        Relationships: []
      }
      retrieval_runs: {
        Row: {
          budget_profile: Json
          candidate_count: number
          created_at: string
          decomposition: Json
          dropped_context_reasons: Json
          filtered_count: number
          final_count: number
          id: string
          latency_ms: number
          metadata: Json
          oracle_context: Json
          query_hash: string
          status: Database["public"]["Enums"]["retrieval_run_status"]
        }
        Insert: {
          budget_profile?: Json
          candidate_count?: number
          created_at?: string
          decomposition?: Json
          dropped_context_reasons?: Json
          filtered_count?: number
          final_count?: number
          id?: string
          latency_ms?: number
          metadata?: Json
          oracle_context?: Json
          query_hash: string
          status?: Database["public"]["Enums"]["retrieval_run_status"]
        }
        Update: {
          budget_profile?: Json
          candidate_count?: number
          created_at?: string
          decomposition?: Json
          dropped_context_reasons?: Json
          filtered_count?: number
          final_count?: number
          id?: string
          latency_ms?: number
          metadata?: Json
          oracle_context?: Json
          query_hash?: string
          status?: Database["public"]["Enums"]["retrieval_run_status"]
        }
        Relationships: []
      }
      rr_photo_submissions: {
        Row: {
          approved: boolean
          caption: string | null
          created_at: string
          file_url: string
          id: string
          retreat_year: number | null
          review_status: string
          submitter_email: string
          submitter_name: string
        }
        Insert: {
          approved?: boolean
          caption?: string | null
          created_at?: string
          file_url: string
          id?: string
          retreat_year?: number | null
          review_status?: string
          submitter_email: string
          submitter_name: string
        }
        Update: {
          approved?: boolean
          caption?: string | null
          created_at?: string
          file_url?: string
          id?: string
          retreat_year?: number | null
          review_status?: string
          submitter_email?: string
          submitter_name?: string
        }
        Relationships: []
      }
      session_notes: {
        Row: {
          ai_summary: string | null
          content: string
          created_at: string
          id: string
          retreat_year_id: string
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          content?: string
          created_at?: string
          id?: string
          retreat_year_id: string
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          content?: string
          created_at?: string
          id?: string
          retreat_year_id?: string
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_request_upvotes: {
        Row: {
          created_at: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_request_upvotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "session_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      session_requests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          retreat_year_id: string
          title: string
          upvotes: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          retreat_year_id?: string
          title: string
          upvotes?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          retreat_year_id?: string
          title?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: []
      }
      supplement_combinations: {
        Row: {
          ai_insight: string | null
          created_at: string
          description: string
          discussion_links: Json | null
          id: string
          name: string
          popularity_score: number
          purpose: string
          references: string[] | null
          supplement_ids: string[]
          trend_data: number[]
          trend_direction: string
          updated_at: string
        }
        Insert: {
          ai_insight?: string | null
          created_at?: string
          description?: string
          discussion_links?: Json | null
          id: string
          name: string
          popularity_score?: number
          purpose?: string
          references?: string[] | null
          supplement_ids?: string[]
          trend_data?: number[]
          trend_direction: string
          updated_at?: string
        }
        Update: {
          ai_insight?: string | null
          created_at?: string
          description?: string
          discussion_links?: Json | null
          id?: string
          name?: string
          popularity_score?: number
          purpose?: string
          references?: string[] | null
          supplement_ids?: string[]
          trend_data?: number[]
          trend_direction?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplements: {
        Row: {
          ai_insight: string | null
          category: string
          created_at: string
          description: string
          discussion_links: Json | null
          id: string
          name: string
          popularity_score: number
          trend_data: number[]
          trend_direction: string
          updated_at: string
        }
        Insert: {
          ai_insight?: string | null
          category: string
          created_at?: string
          description?: string
          discussion_links?: Json | null
          id: string
          name: string
          popularity_score?: number
          trend_data?: number[]
          trend_direction: string
          updated_at?: string
        }
        Update: {
          ai_insight?: string | null
          category?: string
          created_at?: string
          description?: string
          discussion_links?: Json | null
          id?: string
          name?: string
          popularity_score?: number
          trend_data?: number[]
          trend_direction?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          related_entity_id: string | null
          related_entity_type: string | null
          source_system: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          source_system?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          source_system?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tool_capabilities: {
        Row: {
          approval_policy: Database["public"]["Enums"]["approval_policy"]
          blast_radius: string | null
          capability_tags: Json
          connector_dependencies: Json
          created_at: string
          fallback_mode: string | null
          id: string
          io_schema_ref: string | null
          mode: Database["public"]["Enums"]["tool_mode"]
          name: string
          role_requirements: Json
          tool_id: string
          updated_at: string
        }
        Insert: {
          approval_policy?: Database["public"]["Enums"]["approval_policy"]
          blast_radius?: string | null
          capability_tags?: Json
          connector_dependencies?: Json
          created_at?: string
          fallback_mode?: string | null
          id?: string
          io_schema_ref?: string | null
          mode: Database["public"]["Enums"]["tool_mode"]
          name: string
          role_requirements?: Json
          tool_id: string
          updated_at?: string
        }
        Update: {
          approval_policy?: Database["public"]["Enums"]["approval_policy"]
          blast_radius?: string | null
          capability_tags?: Json
          connector_dependencies?: Json
          created_at?: string
          fallback_mode?: string | null
          id?: string
          io_schema_ref?: string | null
          mode?: Database["public"]["Enums"]["tool_mode"]
          name?: string
          role_requirements?: Json
          tool_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tower_assets: {
        Row: {
          annual_rent: number | null
          carrier: string | null
          created_at: string
          escalation_rate: number | null
          id: string
          lease_end: string | null
          lease_start: string | null
          lease_type: Database["public"]["Enums"]["tower_lease_type"]
          location: string
          meg_canonical_id: string | null
          meg_entity_id: string | null
          property_id: string | null
          site_id: string | null
          source_system: string | null
          status: string
          tags: string[] | null
          tower_company: string | null
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["visibility_level"] | null
        }
        Insert: {
          annual_rent?: number | null
          carrier?: string | null
          created_at?: string
          escalation_rate?: number | null
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          lease_type: Database["public"]["Enums"]["tower_lease_type"]
          location: string
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          property_id?: string | null
          site_id?: string | null
          source_system?: string | null
          status?: string
          tags?: string[] | null
          tower_company?: string | null
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Update: {
          annual_rent?: number | null
          carrier?: string | null
          created_at?: string
          escalation_rate?: number | null
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          lease_type?: Database["public"]["Enums"]["tower_lease_type"]
          location?: string
          meg_canonical_id?: string | null
          meg_entity_id?: string | null
          property_id?: string | null
          site_id?: string | null
          source_system?: string | null
          status?: string
          tags?: string[] | null
          tower_company?: string | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["visibility_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "tower_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_platform_access: {
        Row: {
          access_level: string
          created_at: string
          granted_by: string | null
          id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          onboarding_completed: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_results: {
        Row: {
          adversarial_check_run: boolean
          adversarial_result: Json | null
          claim_text: string
          consensus_score: number | null
          consensus_threshold: number
          created_at: string
          hypothesis_id: string | null
          id: string
          run_id: string | null
          source_checks: Json
          sources_agreeing: number
          sources_checked: number
          verdict: Database["public"]["Enums"]["verification_verdict"]
          verification_duration_ms: number | null
          verified_at: string
          verifier_model: string | null
        }
        Insert: {
          adversarial_check_run?: boolean
          adversarial_result?: Json | null
          claim_text: string
          consensus_score?: number | null
          consensus_threshold?: number
          created_at?: string
          hypothesis_id?: string | null
          id?: string
          run_id?: string | null
          source_checks?: Json
          sources_agreeing?: number
          sources_checked?: number
          verdict: Database["public"]["Enums"]["verification_verdict"]
          verification_duration_ms?: number | null
          verified_at?: string
          verifier_model?: string | null
        }
        Update: {
          adversarial_check_run?: boolean
          adversarial_result?: Json | null
          claim_text?: string
          consensus_score?: number | null
          consensus_threshold?: number
          created_at?: string
          hypothesis_id?: string | null
          id?: string
          run_id?: string | null
          source_checks?: Json
          sources_agreeing?: number
          sources_checked?: number
          verdict?: Database["public"]["Enums"]["verification_verdict"]
          verification_duration_ms?: number | null
          verified_at?: string
          verifier_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_results_hypothesis_id_fkey"
            columns: ["hypothesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_run_hypotheses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "oracle_whitespace_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      charter_audit_log: {
        Row: {
          actor_id: string | null
          actor_kind: string | null
          chain_hash: string | null
          entity_id: string | null
          entity_kind:
            | Database["public"]["Enums"]["governance_entity_kind"]
            | null
          entity_status: Database["public"]["Enums"]["governance_status"] | null
          entity_title: string | null
          entity_version: number | null
          event_id: string | null
          event_type: string | null
          metadata: Json | null
          payload_hash: string | null
          recorded_at: string | null
          ref_code: string | null
        }
        Relationships: []
      }
      oracle_briefings_read_model: {
        Row: {
          confidence: number | null
          evidence_strength: number | null
          published_at: string | null
          published_by: string | null
          thesis_id: string | null
          thesis_statement: string | null
          title: string | null
          topic_tags: string[] | null
        }
        Relationships: []
      }
      oracle_feed_history_read_model: {
        Row: {
          item_id: string | null
          item_type: string | null
          metadata: Json | null
          published_at: string | null
          summary: string | null
          title: string | null
        }
        Relationships: []
      }
      oracle_theme_map_read_model: {
        Row: {
          avg_confidence: number | null
          latest_published_at: string | null
          theme: string | null
          thesis_count: number | null
        }
        Relationships: []
      }
      oracle_calibration_summary: {
        Row: {
          avg_accuracy: number | null
          avg_calibration_error: number | null
          avg_confidence_delta: number | null
          domain: string | null
          earliest_sample: string | null
          latest_sample: string | null
          model_version: string | null
          overconfident_count: number | null
          prompt_version: string | null
          sample_count: number | null
          stddev_calibration_error: number | null
          underconfident_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      algorithm_sign: {
        Args: { algorithm: string; secret: string; signables: string }
        Returns: string
      }
      backfill_asset_registry_phase1: {
        Args: { dry_run?: boolean }
        Returns: {
          already_registered: number
          local_table: string
          to_register: number
          total_rows: number
        }[]
      }
      bootstrap_admin_role: { Args: { p_user_id: string }; Returns: string }
      bump_eigen_public_rate: {
        Args: { p_bucket_key: string; p_window_start?: string }
        Returns: number
      }
      can_access_area: {
        Args: { _area: string; _user_id: string }
        Returns: boolean
      }
      can_read_centralr2: { Args: { _user_id: string }; Returns: boolean }
      dispatch_embedding_jobs: { Args: never; Returns: undefined }
      entity_neighborhood: {
        Args: {
          p_entity_id: string
          p_max_depth?: number
          p_min_weight?: number
        }
        Returns: {
          direction: string
          entity_id: string
          relation_type: Database["public"]["Enums"]["entity_relation_type"]
          weight: number
        }[]
      }
      has_platform_access: {
        Args: { _platform: string; _user_id: string }
        Returns: boolean
      }
      has_platform_access_level: {
        Args: { _level: string; _platform: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hybrid_search: {
        Args: {
          filter_owner_id?: string
          full_text_weight?: number
          match_count?: number
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          authority_score: number
          chunk_level: string
          content: string
          document_id: string
          entity_ids: Json
          freshness_score: number
          heading_path: Json
          id: string
          score: number
        }[]
      }
      is_assigned_to_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      match_knowledge_chunks: {
        Args: {
          ann_limit: number
          filter_entity_ids?: string[]
          filter_policy_tags?: string[]
          query_embedding: number[]
          valid_at?: string
        }
        Returns: Json
      }
      pgmq_delete: {
        Args: { msg_id: number; queue_name: string }
        Returns: boolean
      }
      sign: {
        Args: { algorithm?: string; payload: Json; secret: string }
        Returns: string
      }
      toggle_session_request_upvote: {
        Args: { p_request_id: string; p_user_id: string }
        Returns: undefined
      }
      try_cast_double: { Args: { inp: string }; Returns: number }
      url_decode: { Args: { data: string }; Returns: string }
      url_encode: { Args: { data: string }; Returns: string }
      verify: {
        Args: { algorithm?: string; secret: string; token: string }
        Returns: {
          header: Json
          payload: Json
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "analyst" | "viewer"
      approval_policy: "none_required" | "user_approval" | "admin_approval"
      asset_governance_status:
        | "local"
        | "review"
        | "promoted"
        | "governed"
        | "suspended"
      asset_kind:
        | "idea_submission"
        | "document"
        | "oracle_signal"
        | "governance_entity"
        | "work"
        | "contract"
        | "account"
        | "project"
        | "entity"
        | "property"
        | "portfolio"
        | "deal"
        | "tower_asset"
      asset_lifecycle_status: "draft" | "active" | "archived" | "retired"
      asset_relationship_type:
        | "owns"
        | "manages"
        | "member_of"
        | "collateral_for"
        | "parent_of"
        | "lease_on"
        | "secures"
        | "supports"
      charter_context_status: "unlinked" | "linked" | "stale" | "error"
      charter_role: "member" | "reviewer" | "operator" | "counsel" | "admin"
      charter_valuation_kind:
        | "market"
        | "book"
        | "insurance"
        | "replacement"
        | "liquidation"
        | "income_approach"
        | "charter_basis"
        | "tax_assessment"
        | "custom"
      charter_valuation_status: "draft" | "active" | "superseded"
      chunk_level: "document" | "section" | "paragraph" | "claim"
      confidence_band: "high" | "medium" | "low"
      counterparty_type:
        | "broker"
        | "seller"
        | "buyer"
        | "lender"
        | "investor"
        | "vendor"
        | "attorney"
        | "other"
      deal_stage:
        | "prospect"
        | "underwriting"
        | "loi"
        | "due-diligence"
        | "closing"
        | "closed"
        | "dead"
      deal_type:
        | "acquisition"
        | "disposition"
        | "refinance"
        | "development"
        | "jv"
      decision_linked_table:
        | "entities"
        | "rights"
        | "obligations"
        | "payouts"
        | "evidence"
        | "ip_matters"
        | "asset_valuations"
      decision_status: "pending" | "final" | "appealed"
      decision_type: "approval" | "rejection" | "escalation" | "override"
      document_status: "draft" | "active" | "archived" | "deleted"
      eigen_policy_grant_status: "active" | "paused" | "revoked"
      eigen_policy_principal_type: "user" | "role"
      eigen_site_mode: "public" | "eigenx" | "mixed"
      eigen_site_status: "active" | "paused" | "archived"
      embedding_status: "pending" | "embedded" | "failed" | "stale"
      entity_mention_type: "direct" | "inferred" | "alias_matched"
      entity_relation_type:
        | "related_to"
        | "part_of"
        | "instance_of"
        | "competes_with"
        | "derives_from"
        | "licensed_by"
        | "targets_market"
        | "disrupts"
        | "treats"
        | "interacts_with"
        | "formulated_with"
        | "clinical_trial_for"
        | "located_in"
        | "comparable_to"
        | "zoned_as"
        | "sold_by"
        | "supplied_by"
        | "priced_against"
        | "precedes"
        | "succeeds"
        | "trending_with"
      entity_status: "draft" | "active" | "archived"
      entity_type:
        | "person"
        | "org"
        | "property"
        | "product"
        | "ip"
        | "concept"
        | "location"
        | "llc"
        | "lp"
        | "trust"
        | "corp"
        | "s-corp"
        | "partnership"
      evidence_link_kind:
        | "supports"
        | "contradicts"
        | "derived_from"
        | "references"
        | "supersedes"
        | "scored_by"
      evidence_linked_table:
        | "entities"
        | "rights"
        | "obligations"
        | "payouts"
        | "decisions"
        | "ip_matters"
        | "asset_valuations"
      evidence_role:
        | "primary_evidence"
        | "supporting_evidence"
        | "source_record"
      evidence_status: "submitted" | "verified" | "challenged"
      evidence_type: "document" | "photo" | "filing" | "testimony"
      extracted_text_status:
        | "pending"
        | "extracted"
        | "failed"
        | "not_applicable"
      governance_entity_kind: "charter" | "policy" | "rule" | "amendment"
      governance_status: "draft" | "active" | "superseded" | "revoked"
      index_status: "pending" | "indexed" | "failed" | "stale"
      ingestion_run_status: "pending" | "running" | "completed" | "failed"
      meg_alias_kind:
        | "slug"
        | "external_id"
        | "display_name"
        | "shortcode"
        | "legal_name"
        | "dba"
      meg_edge_type:
        | "owns"
        | "employs"
        | "subsidiary_of"
        | "partner_of"
        | "located_at"
        | "related_to"
        | "derived_from"
        | "supersedes"
      meg_entity_status: "active" | "merged" | "archived"
      meg_entity_type:
        | "person"
        | "org"
        | "property"
        | "product"
        | "concept"
        | "location"
        | "ip"
      memory_scope: "session" | "user" | "workspace"
      news_category:
        | "market"
        | "portfolio"
        | "regulatory"
        | "deal"
        | "tower"
        | "ground-lease"
        | "opinion"
      obligation_status: "pending" | "fulfilled" | "overdue" | "waived"
      obligation_type: "payment" | "filing" | "compliance" | "delivery"
      oracle_authority_tier:
        | "registry_direct"
        | "curated_database"
        | "domain_export"
        | "web_search"
        | "llm_generation"
      oracle_novelty_status:
        | "new"
        | "known"
        | "duplicate"
        | "near_duplicate"
        | "updated_existing"
      oracle_outcome_source:
        | "manual"
        | "automated"
        | "external_feed"
        | "domain_event"
      oracle_outcome_verdict:
        | "confirmed"
        | "partially_confirmed"
        | "refuted"
        | "inconclusive"
        | "pending"
      oracle_publication_state:
        | "pending_review"
        | "approved"
        | "rejected"
        | "deferred"
        | "published"
      oracle_risk_level: "low" | "medium" | "high"
      oracle_run_status:
        | "queued"
        | "gathering_evidence"
        | "resolving_entities"
        | "generating_hypotheses"
        | "scoring"
        | "verification"
        | "review"
        | "published"
        | "failed"
        | "cancelled"
      oracle_source_lane:
        | "internal_canonical"
        | "external_authoritative"
        | "external_perspective"
        | "federated_openai_vector"
        | "narrative_context_scenario"
      oracle_thesis_evidence_role:
        | "inspiration"
        | "validation"
        | "contradiction"
      oracle_thesis_status:
        | "draft"
        | "active"
        | "challenged"
        | "superseded"
        | "retired"
      payout_status: "pending" | "approved" | "disbursed" | "rejected"
      property_type:
        | "multifamily"
        | "sfr"
        | "mixed-use"
        | "commercial"
        | "industrial"
        | "land"
        | "tower"
      retention_class: "ephemeral" | "short_term" | "long_term" | "permanent"
      retrieval_run_status: "pending" | "running" | "completed" | "failed"
      right_status: "pending" | "active" | "expired" | "revoked"
      right_type: "nil" | "license" | "lease" | "approval"
      signal_status: "pending" | "scored" | "expired" | "superseded"
      source_type:
        | "manual"
        | "import"
        | "api"
        | "scrape"
        | "derived"
        | "ai-generated"
      thesis_knowledge_link_status: "active" | "superseded" | "retracted"
      thesis_knowledge_link_type:
        | "generated"
        | "validated"
        | "contradicted"
        | "refined"
      tool_mode: "read" | "write"
      tower_lease_type: "ground-lease" | "rooftop" | "tower"
      verification_verdict:
        | "verified"
        | "partially_verified"
        | "unverified"
        | "refuted"
        | "skipped"
      visibility_level: "public" | "authenticated" | "internal" | "confidential"
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
      app_role: ["admin", "analyst", "viewer"],
      approval_policy: ["none_required", "user_approval", "admin_approval"],
      asset_governance_status: [
        "local",
        "review",
        "promoted",
        "governed",
        "suspended",
      ],
      asset_kind: [
        "idea_submission",
        "document",
        "oracle_signal",
        "governance_entity",
        "work",
        "contract",
        "account",
        "project",
        "entity",
        "property",
        "portfolio",
        "deal",
        "tower_asset",
      ],
      asset_lifecycle_status: ["draft", "active", "archived", "retired"],
      asset_relationship_type: [
        "owns",
        "manages",
        "member_of",
        "collateral_for",
        "parent_of",
        "lease_on",
        "secures",
        "supports",
      ],
      charter_context_status: ["unlinked", "linked", "stale", "error"],
      charter_role: ["member", "reviewer", "operator", "counsel", "admin"],
      charter_valuation_kind: [
        "market",
        "book",
        "insurance",
        "replacement",
        "liquidation",
        "income_approach",
        "charter_basis",
        "tax_assessment",
        "custom",
      ],
      charter_valuation_status: ["draft", "active", "superseded"],
      chunk_level: ["document", "section", "paragraph", "claim"],
      confidence_band: ["high", "medium", "low"],
      counterparty_type: [
        "broker",
        "seller",
        "buyer",
        "lender",
        "investor",
        "vendor",
        "attorney",
        "other",
      ],
      deal_stage: [
        "prospect",
        "underwriting",
        "loi",
        "due-diligence",
        "closing",
        "closed",
        "dead",
      ],
      deal_type: [
        "acquisition",
        "disposition",
        "refinance",
        "development",
        "jv",
      ],
      decision_linked_table: [
        "entities",
        "rights",
        "obligations",
        "payouts",
        "evidence",
        "ip_matters",
        "asset_valuations",
      ],
      decision_status: ["pending", "final", "appealed"],
      decision_type: ["approval", "rejection", "escalation", "override"],
      document_status: ["draft", "active", "archived", "deleted"],
      eigen_policy_grant_status: ["active", "paused", "revoked"],
      eigen_policy_principal_type: ["user", "role"],
      eigen_site_mode: ["public", "eigenx", "mixed"],
      eigen_site_status: ["active", "paused", "archived"],
      embedding_status: ["pending", "embedded", "failed", "stale"],
      entity_mention_type: ["direct", "inferred", "alias_matched"],
      entity_relation_type: [
        "related_to",
        "part_of",
        "instance_of",
        "competes_with",
        "derives_from",
        "licensed_by",
        "targets_market",
        "disrupts",
        "treats",
        "interacts_with",
        "formulated_with",
        "clinical_trial_for",
        "located_in",
        "comparable_to",
        "zoned_as",
        "sold_by",
        "supplied_by",
        "priced_against",
        "precedes",
        "succeeds",
        "trending_with",
      ],
      entity_status: ["draft", "active", "archived"],
      entity_type: [
        "person",
        "org",
        "property",
        "product",
        "ip",
        "concept",
        "location",
        "llc",
        "lp",
        "trust",
        "corp",
        "s-corp",
        "partnership",
      ],
      evidence_link_kind: [
        "supports",
        "contradicts",
        "derived_from",
        "references",
        "supersedes",
        "scored_by",
      ],
      evidence_linked_table: [
        "entities",
        "rights",
        "obligations",
        "payouts",
        "decisions",
        "ip_matters",
        "asset_valuations",
      ],
      evidence_role: [
        "primary_evidence",
        "supporting_evidence",
        "source_record",
      ],
      evidence_status: ["submitted", "verified", "challenged"],
      evidence_type: ["document", "photo", "filing", "testimony"],
      extracted_text_status: [
        "pending",
        "extracted",
        "failed",
        "not_applicable",
      ],
      governance_entity_kind: ["charter", "policy", "rule", "amendment"],
      governance_status: ["draft", "active", "superseded", "revoked"],
      index_status: ["pending", "indexed", "failed", "stale"],
      ingestion_run_status: ["pending", "running", "completed", "failed"],
      meg_alias_kind: [
        "slug",
        "external_id",
        "display_name",
        "shortcode",
        "legal_name",
        "dba",
      ],
      meg_edge_type: [
        "owns",
        "employs",
        "subsidiary_of",
        "partner_of",
        "located_at",
        "related_to",
        "derived_from",
        "supersedes",
      ],
      meg_entity_status: ["active", "merged", "archived"],
      meg_entity_type: [
        "person",
        "org",
        "property",
        "product",
        "concept",
        "location",
        "ip",
      ],
      memory_scope: ["session", "user", "workspace"],
      news_category: [
        "market",
        "portfolio",
        "regulatory",
        "deal",
        "tower",
        "ground-lease",
        "opinion",
      ],
      obligation_status: ["pending", "fulfilled", "overdue", "waived"],
      obligation_type: ["payment", "filing", "compliance", "delivery"],
      oracle_authority_tier: [
        "registry_direct",
        "curated_database",
        "domain_export",
        "web_search",
        "llm_generation",
      ],
      oracle_novelty_status: [
        "new",
        "known",
        "duplicate",
        "near_duplicate",
        "updated_existing",
      ],
      oracle_outcome_source: [
        "manual",
        "automated",
        "external_feed",
        "domain_event",
      ],
      oracle_outcome_verdict: [
        "confirmed",
        "partially_confirmed",
        "refuted",
        "inconclusive",
        "pending",
      ],
      oracle_publication_state: [
        "pending_review",
        "approved",
        "rejected",
        "deferred",
        "published",
      ],
      oracle_risk_level: ["low", "medium", "high"],
      oracle_run_status: [
        "queued",
        "gathering_evidence",
        "resolving_entities",
        "generating_hypotheses",
        "scoring",
        "verification",
        "review",
        "published",
        "failed",
        "cancelled",
      ],
      oracle_source_lane: [
        "internal_canonical",
        "external_authoritative",
        "external_perspective",
        "federated_openai_vector",
        "narrative_context_scenario",
      ],
      oracle_thesis_evidence_role: [
        "inspiration",
        "validation",
        "contradiction",
      ],
      oracle_thesis_status: [
        "draft",
        "active",
        "challenged",
        "superseded",
        "retired",
      ],
      payout_status: ["pending", "approved", "disbursed", "rejected"],
      property_type: [
        "multifamily",
        "sfr",
        "mixed-use",
        "commercial",
        "industrial",
        "land",
        "tower",
      ],
      retention_class: ["ephemeral", "short_term", "long_term", "permanent"],
      retrieval_run_status: ["pending", "running", "completed", "failed"],
      right_status: ["pending", "active", "expired", "revoked"],
      right_type: ["nil", "license", "lease", "approval"],
      signal_status: ["pending", "scored", "expired", "superseded"],
      source_type: [
        "manual",
        "import",
        "api",
        "scrape",
        "derived",
        "ai-generated",
      ],
      thesis_knowledge_link_status: ["active", "superseded", "retracted"],
      thesis_knowledge_link_type: [
        "generated",
        "validated",
        "contradicted",
        "refined",
      ],
      tool_mode: ["read", "write"],
      tower_lease_type: ["ground-lease", "rooftop", "tower"],
      verification_verdict: [
        "verified",
        "partially_verified",
        "unverified",
        "refuted",
        "skipped",
      ],
      visibility_level: ["public", "authenticated", "internal", "confidential"],
    },
  },
} as const
