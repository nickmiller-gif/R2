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
      asset_evidence_links: {
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
            referencedRelation: "asset_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_evidence_links_to_asset_id_fkey"
            columns: ["to_asset_id"]
            isOneToOne: false
            referencedRelation: "asset_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_registry: {
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
      documents: {
        Row: {
          body: string
          captured_at: string | null
          confidence: number | null
          content_hash: string
          content_type: string
          created_at: string
          embedding_status: Database["public"]["Enums"]["embedding_status"]
          extracted_text_status: Database["public"]["Enums"]["extracted_text_status"]
          id: string
          index_status: Database["public"]["Enums"]["index_status"]
          indexed_at: string | null
          owner_id: string
          source_system: string
          source_title: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["document_status"]
          title: string
          updated_at: string
          vector_store_ref: string | null
        }
        Insert: {
          body?: string
          captured_at?: string | null
          confidence?: number | null
          content_hash: string
          content_type?: string
          created_at?: string
          embedding_status?: Database["public"]["Enums"]["embedding_status"]
          extracted_text_status?: Database["public"]["Enums"]["extracted_text_status"]
          id?: string
          index_status?: Database["public"]["Enums"]["index_status"]
          indexed_at?: string | null
          owner_id: string
          source_system: string
          source_title?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title: string
          updated_at?: string
          vector_store_ref?: string | null
        }
        Update: {
          body?: string
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string
          content_type?: string
          created_at?: string
          embedding_status?: Database["public"]["Enums"]["embedding_status"]
          extracted_text_status?: Database["public"]["Enums"]["extracted_text_status"]
          id?: string
          index_status?: Database["public"]["Enums"]["index_status"]
          indexed_at?: string | null
          owner_id?: string
          source_system?: string
          source_title?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          title?: string
          updated_at?: string
          vector_store_ref?: string | null
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
          heading_path: Json
          id: string
          ingestion_run_id: string | null
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
          heading_path?: Json
          id?: string
          ingestion_run_id?: string | null
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
          heading_path?: Json
          id?: string
          ingestion_run_id?: string | null
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
            foreignKeyName: "knowledge_chunks_parent_chunk_id_fkey"
            columns: ["parent_chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
        ]
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
      oracle_signals: {
        Row: {
          analysis_document_id: string | null
          confidence: Database["public"]["Enums"]["confidence_band"]
          created_at: string
          entity_asset_id: string
          id: string
          producer_ref: string
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
    }
    Functions: {
      match_knowledge_chunks: {
        Args: {
          ann_limit: number
          filter_entity_ids?: string[] | null
          filter_policy_tags?: string[] | null
          query_embedding: number[]
          valid_at?: string
        }
        Returns: Json
      }
    }
    Enums: {
      approval_policy: "none_required" | "user_approval" | "admin_approval"
      asset_kind:
        | "idea_submission"
        | "document"
        | "oracle_signal"
        | "governance_entity"
        | "work"
        | "contract"
        | "account"
        | "project"
      charter_context_status: "unlinked" | "linked" | "stale" | "error"
      charter_role: "member" | "reviewer" | "operator" | "counsel" | "admin"
      chunk_level: "document" | "section" | "paragraph" | "claim"
      confidence_band: "high" | "medium" | "low"
      decision_linked_table:
        | "entities"
        | "rights"
        | "obligations"
        | "payouts"
        | "evidence"
        | "ip_matters"
      decision_status: "pending" | "final" | "appealed"
      decision_type: "approval" | "rejection" | "escalation" | "override"
      document_status: "draft" | "active" | "archived" | "deleted"
      embedding_status: "pending" | "embedded" | "failed" | "stale"
      entity_status: "draft" | "active" | "archived"
      entity_type: "person" | "org" | "property" | "product"
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
      evidence_status: "submitted" | "verified" | "challenged"
      evidence_type: "document" | "photo" | "filing" | "testimony"
      extracted_text_status:
        | "pending"
        | "extracted"
        | "failed"
        | "not_applicable"
      governance_entity_kind: "charter" | "policy" | "rule" | "amendment"
      governance_status: "draft" | "active" | "superseded" | "revoked"
      ingestion_run_status: "pending" | "running" | "completed" | "failed"
      index_status: "pending" | "indexed" | "failed" | "stale"
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
      memory_scope: "session" | "user" | "workspace"
      obligation_status: "pending" | "fulfilled" | "overdue" | "waived"
      obligation_type: "payment" | "filing" | "compliance" | "delivery"
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
      retention_class: "ephemeral" | "short_term" | "long_term" | "permanent"
      retrieval_run_status: "pending" | "running" | "completed" | "failed"
      right_status: "pending" | "active" | "expired" | "revoked"
      right_type: "nil" | "license" | "lease" | "approval"
      signal_status: "pending" | "scored" | "expired" | "superseded"
      thesis_knowledge_link_status: "active" | "superseded" | "retracted"
      thesis_knowledge_link_type:
        | "generated"
        | "validated"
        | "contradicted"
        | "refined"
      tool_mode: "read" | "write"
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
      approval_policy: ["none_required", "user_approval", "admin_approval"],
      asset_kind: [
        "idea_submission",
        "document",
        "oracle_signal",
        "governance_entity",
        "work",
        "contract",
        "account",
        "project",
      ],
      charter_context_status: ["unlinked", "linked", "stale", "error"],
      charter_role: ["member", "reviewer", "operator", "counsel", "admin"],
      chunk_level: ["document", "section", "paragraph", "claim"],
      confidence_band: ["high", "medium", "low"],
      decision_linked_table: [
        "entities",
        "rights",
        "obligations",
        "payouts",
        "evidence",
        "ip_matters",
      ],
      decision_status: ["pending", "final", "appealed"],
      decision_type: ["approval", "rejection", "escalation", "override"],
      document_status: ["draft", "active", "archived", "deleted"],
      embedding_status: ["pending", "embedded", "failed", "stale"],
      entity_status: ["draft", "active", "archived"],
      entity_type: ["person", "org", "property", "product"],
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
      ingestion_run_status: ["pending", "running", "completed", "failed"],
      index_status: ["pending", "indexed", "failed", "stale"],
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
      ],
      memory_scope: ["session", "user", "workspace"],
      obligation_status: ["pending", "fulfilled", "overdue", "waived"],
      obligation_type: ["payment", "filing", "compliance", "delivery"],
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
      retention_class: ["ephemeral", "short_term", "long_term", "permanent"],
      retrieval_run_status: ["pending", "running", "completed", "failed"],
      right_status: ["pending", "active", "expired", "revoked"],
      right_type: ["nil", "license", "lease", "approval"],
      signal_status: ["pending", "scored", "expired", "superseded"],
      thesis_knowledge_link_status: ["active", "superseded", "retracted"],
      thesis_knowledge_link_type: [
        "generated",
        "validated",
        "contradicted",
        "refined",
      ],
      tool_mode: ["read", "write"],
    },
  },
} as const
