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
      access_requests: {
        Row: {
          created_at: string
          domain: string | null
          email: string
          id: string
          idempotency_key: string | null
          message: string | null
          name: string
          organization: string | null
          pathway: string
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          email: string
          id?: string
          idempotency_key?: string | null
          message?: string | null
          name: string
          organization?: string | null
          pathway: string
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          email?: string
          id?: string
          idempotency_key?: string | null
          message?: string | null
          name?: string
          organization?: string | null
          pathway?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
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
          meg_event_entity_id: string | null
          retreat_year_id: string
          theme_tags: string[]
          title: string
        }
        Insert: {
          content: string
          content_hash: string
          generated_at?: string
          id?: string
          meg_event_entity_id?: string | null
          retreat_year_id?: string
          theme_tags?: string[]
          title: string
        }
        Update: {
          content?: string
          content_hash?: string
          generated_at?: string
          id?: string
          meg_event_entity_id?: string | null
          retreat_year_id?: string
          theme_tags?: string[]
          title?: string
        }
        Relationships: []
      }
      agent_evidence: {
        Row: {
          created_at: string
          excerpt: string
          id: string
          relevance_score: number | null
          retrieved_at: string
          run_id: string
          source_type: string
          title: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          excerpt: string
          id?: string
          relevance_score?: number | null
          retrieved_at?: string
          run_id: string
          source_type?: string
          title?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          excerpt?: string
          id?: string
          relevance_score?: number | null
          retrieved_at?: string
          run_id?: string
          source_type?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_evidence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          parts: Json | null
          report_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parts?: Json | null
          report_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          report_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "validation_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          batch_id: string
          budget_usd: number
          created_at: string
          current_stage: string | null
          error: string | null
          finished_at: string | null
          id: string
          started_at: string | null
          status: string
          tier: string
          total_cost_usd: number
          total_tokens: number
        }
        Insert: {
          batch_id: string
          budget_usd?: number
          created_at?: string
          current_stage?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tier?: string
          total_cost_usd?: number
          total_tokens?: number
        }
        Update: {
          batch_id?: string
          budget_usd?: number
          created_at?: string
          current_stage?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tier?: string
          total_cost_usd?: number
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "validation_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_steps: {
        Row: {
          cost_usd: number
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          input: Json | null
          output: Json | null
          run_id: string
          sort_order: number
          stage: string
          started_at: string | null
          status: string
          tokens: number
          tool_name: string | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          run_id: string
          sort_order?: number
          stage: string
          started_at?: string | null
          status?: string
          tokens?: number
          tool_name?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          run_id?: string
          sort_order?: number
          stage?: string
          started_at?: string | null
          status?: string
          tokens?: number
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
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
      atlas_crawls: {
        Row: {
          brand_key: string
          completed_at: string | null
          id: string
          metadata: Json
          source: Database["public"]["Enums"]["atlas_crawl_source"]
          started_at: string
          status: Database["public"]["Enums"]["atlas_crawl_status"]
        }
        Insert: {
          brand_key: string
          completed_at?: string | null
          id?: string
          metadata?: Json
          source?: Database["public"]["Enums"]["atlas_crawl_source"]
          started_at?: string
          status?: Database["public"]["Enums"]["atlas_crawl_status"]
        }
        Update: {
          brand_key?: string
          completed_at?: string | null
          id?: string
          metadata?: Json
          source?: Database["public"]["Enums"]["atlas_crawl_source"]
          started_at?: string
          status?: Database["public"]["Enums"]["atlas_crawl_status"]
        }
        Relationships: []
      }
      atlas_links: {
        Row: {
          crawl_id: string
          from_url: string
          id: string
          link_kind: string
          to_url: string
        }
        Insert: {
          crawl_id: string
          from_url: string
          id?: string
          link_kind: string
          to_url: string
        }
        Update: {
          crawl_id?: string
          from_url?: string
          id?: string
          link_kind?: string
          to_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "atlas_links_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "atlas_crawls"
            referencedColumns: ["id"]
          },
        ]
      }
      atlas_snapshots: {
        Row: {
          captured_at: string
          crawl_id: string | null
          id: string
          notes: string | null
        }
        Insert: {
          captured_at?: string
          crawl_id?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          captured_at?: string
          crawl_id?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atlas_snapshots_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "atlas_crawls"
            referencedColumns: ["id"]
          },
        ]
      }
      atlas_urls: {
        Row: {
          crawl_id: string
          first_seen_at: string
          id: string
          ingest_ok: boolean | null
          last_error: string | null
          url: string
        }
        Insert: {
          crawl_id: string
          first_seen_at?: string
          id?: string
          ingest_ok?: boolean | null
          last_error?: string | null
          url: string
        }
        Update: {
          crawl_id?: string
          first_seen_at?: string
          id?: string
          ingest_ok?: boolean | null
          last_error?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "atlas_urls_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "atlas_crawls"
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
      batch_messages: {
        Row: {
          batch_id: string
          content: string
          created_at: string
          id: string
          sender: string
        }
        Insert: {
          batch_id: string
          content: string
          created_at?: string
          id?: string
          sender: string
        }
        Update: {
          batch_id?: string
          content?: string
          created_at?: string
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_messages_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "validation_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_steps: {
        Row: {
          batch_id: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          label: string
          sort_order: number
          status: string
        }
        Insert: {
          batch_id: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          label: string
          sort_order?: number
          status?: string
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          label?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_steps_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "validation_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_action_proposals: {
        Row: {
          agent_id: string
          approved_at: string | null
          created_at: string
          description: string
          evidence_ids: string[]
          executed_at: string | null
          expected_gain: string
          id: string
          metadata: Json | null
          rationale: string | null
          risk: string
          status: string
          title: string
          type: string
        }
        Insert: {
          agent_id: string
          approved_at?: string | null
          created_at?: string
          description: string
          evidence_ids?: string[]
          executed_at?: string | null
          expected_gain: string
          id: string
          metadata?: Json | null
          rationale?: string | null
          risk: string
          status?: string
          title: string
          type: string
        }
        Update: {
          agent_id?: string
          approved_at?: string | null
          created_at?: string
          description?: string
          evidence_ids?: string[]
          executed_at?: string | null
          expected_gain?: string
          id?: string
          metadata?: Json | null
          rationale?: string | null
          risk?: string
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "botos_action_proposals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "botos_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_adjustment_requests: {
        Row: {
          agent_id: string
          created_at: string
          evidence_ids: string[]
          executed_at: string | null
          expected_gain: string
          expiry_date: string | null
          id: string
          rationale: string
          resolution: string | null
          resolved_at: string | null
          review_date: string | null
          risk: string
          status: string
          title: string
          type: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          evidence_ids?: string[]
          executed_at?: string | null
          expected_gain: string
          expiry_date?: string | null
          id: string
          rationale: string
          resolution?: string | null
          resolved_at?: string | null
          review_date?: string | null
          risk: string
          status?: string
          title: string
          type: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          evidence_ids?: string[]
          executed_at?: string | null
          expected_gain?: string
          expiry_date?: string | null
          id?: string
          rationale?: string
          resolution?: string | null
          resolved_at?: string | null
          review_date?: string | null
          risk?: string
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "botos_adjustment_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "botos_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_agents: {
        Row: {
          approval_policy: string
          autonomy_mode: string
          bot_profile: Json | null
          budget_policy: Json | null
          created_at: string
          github_repo: string | null
          id: string
          journal_policy: Json | null
          kind: string
          last_run: string | null
          name: string
          status: string
          total_runs: number
          updated_at: string
        }
        Insert: {
          approval_policy?: string
          autonomy_mode?: string
          bot_profile?: Json | null
          budget_policy?: Json | null
          created_at?: string
          github_repo?: string | null
          id: string
          journal_policy?: Json | null
          kind: string
          last_run?: string | null
          name: string
          status?: string
          total_runs?: number
          updated_at?: string
        }
        Update: {
          approval_policy?: string
          autonomy_mode?: string
          bot_profile?: Json | null
          budget_policy?: Json | null
          created_at?: string
          github_repo?: string | null
          id?: string
          journal_policy?: Json | null
          kind?: string
          last_run?: string | null
          name?: string
          status?: string
          total_runs?: number
          updated_at?: string
        }
        Relationships: []
      }
      botos_article_recommendations: {
        Row: {
          anticipated_questions: string[]
          confidence: number
          content_type: string
          created_at: string
          id: string
          proposed_outline: string[]
          proposed_title: string
          reasoning: string
          related_features: string[]
          suggested_visuals: string[]
          target_word_count: number
          urgency: string
        }
        Insert: {
          anticipated_questions?: string[]
          confidence?: number
          content_type: string
          created_at?: string
          id: string
          proposed_outline?: string[]
          proposed_title: string
          reasoning: string
          related_features?: string[]
          suggested_visuals?: string[]
          target_word_count?: number
          urgency: string
        }
        Update: {
          anticipated_questions?: string[]
          confidence?: number
          content_type?: string
          created_at?: string
          id?: string
          proposed_outline?: string[]
          proposed_title?: string
          reasoning?: string
          related_features?: string[]
          suggested_visuals?: string[]
          target_word_count?: number
          urgency?: string
        }
        Relationships: []
      }
      botos_audit_trail: {
        Row: {
          action: string
          actor_id: string | null
          agent_id: string | null
          id: string
          ip_hash: string | null
          metadata: Json | null
          timestamp: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          agent_id?: string | null
          id: string
          ip_hash?: string | null
          metadata?: Json | null
          timestamp?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          agent_id?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          timestamp?: string
        }
        Relationships: []
      }
      botos_autonomous_runs: {
        Row: {
          agent_id: string
          end_time: string | null
          errors_count: number | null
          findings_count: number | null
          id: string
          metadata: Json | null
          opportunities_count: number | null
          start_time: string
          status: string
          trigger_type: string
        }
        Insert: {
          agent_id: string
          end_time?: string | null
          errors_count?: number | null
          findings_count?: number | null
          id: string
          metadata?: Json | null
          opportunities_count?: number | null
          start_time?: string
          status?: string
          trigger_type: string
        }
        Update: {
          agent_id?: string
          end_time?: string | null
          errors_count?: number | null
          findings_count?: number | null
          id?: string
          metadata?: Json | null
          opportunities_count?: number | null
          start_time?: string
          status?: string
          trigger_type?: string
        }
        Relationships: []
      }
      botos_behavior_snapshots: {
        Row: {
          agent_id: string
          created_at: string
          decision_patterns: Json
          id: string
          performance_metrics: Json
          reasoning_style: Json
          timestamp: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          decision_patterns?: Json
          id: string
          performance_metrics?: Json
          reasoning_style?: Json
          timestamp: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          decision_patterns?: Json
          id?: string
          performance_metrics?: Json
          reasoning_style?: Json
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "botos_behavior_snapshots_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "botos_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_bot_tasks: {
        Row: {
          action: string
          agent_id: string
          attempts: number
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          policy_scope: string
          status: string
        }
        Insert: {
          action?: string
          agent_id: string
          attempts?: number
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          policy_scope?: string
          status?: string
        }
        Update: {
          action?: string
          agent_id?: string
          attempts?: number
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          policy_scope?: string
          status?: string
        }
        Relationships: []
      }
      botos_capability_grants: {
        Row: {
          agent_id: string
          allowed_actions: string[]
          allowed_policy_scope: string[]
          capability_id: string
          created_at: string
          expires_at: string | null
          id: string
          signed_by: string | null
        }
        Insert: {
          agent_id: string
          allowed_actions?: string[]
          allowed_policy_scope: string[]
          capability_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          signed_by?: string | null
        }
        Update: {
          agent_id?: string
          allowed_actions?: string[]
          allowed_policy_scope?: string[]
          capability_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          signed_by?: string | null
        }
        Relationships: []
      }
      botos_content_gaps: {
        Row: {
          created_at: string
          description: string
          estimated_impact: string
          id: string
          keywords_for_seo: string[]
          missing_topics: string[]
          priority: string
          reasoning: string
          related_code_paths: string[]
          suggested_structure: string[]
          target_audience: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          estimated_impact: string
          id: string
          keywords_for_seo?: string[]
          missing_topics?: string[]
          priority?: string
          reasoning: string
          related_code_paths?: string[]
          suggested_structure?: string[]
          target_audience: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          estimated_impact?: string
          id?: string
          keywords_for_seo?: string[]
          missing_topics?: string[]
          priority?: string
          reasoning?: string
          related_code_paths?: string[]
          suggested_structure?: string[]
          target_audience?: string
          title?: string
        }
        Relationships: []
      }
      botos_drift_detections: {
        Row: {
          agent_id: string
          comparison_period: Json
          description: string
          detected_at: string
          drift_type: string
          evidence: string[]
          id: string
          metrics: Json
          recommendation: string
          resolution: string | null
          resolved_at: string | null
          saved_to_supabase: boolean | null
          severity: string
          status: string
        }
        Insert: {
          agent_id: string
          comparison_period: Json
          description: string
          detected_at: string
          drift_type: string
          evidence?: string[]
          id: string
          metrics?: Json
          recommendation: string
          resolution?: string | null
          resolved_at?: string | null
          saved_to_supabase?: boolean | null
          severity: string
          status?: string
        }
        Update: {
          agent_id?: string
          comparison_period?: Json
          description?: string
          detected_at?: string
          drift_type?: string
          evidence?: string[]
          id?: string
          metrics?: Json
          recommendation?: string
          resolution?: string | null
          resolved_at?: string | null
          saved_to_supabase?: boolean | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "botos_drift_detections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "botos_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_evidence: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          source: string
          timestamp: string
          type: string
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          id: string
          metadata?: Json | null
          source: string
          timestamp: string
          type: string
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          source?: string
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "botos_evidence_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "botos_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_flow_profiles: {
        Row: {
          authentication: Json | null
          created_at: string
          description: string
          error_detection: Json
          id: string
          name: string
          notifications: Json | null
          schedule: Json | null
          steps: Json
          target_url: string
          updated_at: string
        }
        Insert: {
          authentication?: Json | null
          created_at?: string
          description: string
          error_detection?: Json
          id: string
          name: string
          notifications?: Json | null
          schedule?: Json | null
          steps?: Json
          target_url: string
          updated_at?: string
        }
        Update: {
          authentication?: Json | null
          created_at?: string
          description?: string
          error_detection?: Json
          id?: string
          name?: string
          notifications?: Json | null
          schedule?: Json | null
          steps?: Json
          target_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      botos_flow_results: {
        Row: {
          agent_id: string
          completed_at: string | null
          completed_steps: number
          console_errors: Json
          errors: Json
          id: string
          metrics: Json
          network_errors: Json
          profile_id: string
          screenshots: string[]
          started_at: string
          status: string
          total_steps: number
          warnings: string[]
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          completed_steps?: number
          console_errors?: Json
          errors?: Json
          id: string
          metrics?: Json
          network_errors?: Json
          profile_id: string
          screenshots?: string[]
          started_at: string
          status: string
          total_steps?: number
          warnings?: string[]
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          completed_steps?: number
          console_errors?: Json
          errors?: Json
          id?: string
          metrics?: Json
          network_errors?: Json
          profile_id?: string
          screenshots?: string[]
          started_at?: string
          status?: string
          total_steps?: number
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "botos_flow_results_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "botos_flow_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_journal_entries: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          evidence_links: string[]
          id: string
          metadata: Json | null
          timestamp: string
          type: string
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          evidence_links?: string[]
          id: string
          metadata?: Json | null
          timestamp: string
          type: string
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          evidence_links?: string[]
          id?: string
          metadata?: Json | null
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "botos_journal_entries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "botos_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_memory_edges: {
        Row: {
          created_at: string
          from_id: string
          id: string
          metadata: Json | null
          relation: string
          to_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          from_id: string
          id: string
          metadata?: Json | null
          relation: string
          to_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          from_id?: string
          id?: string
          metadata?: Json | null
          relation?: string
          to_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "botos_memory_edges_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "botos_memory_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "botos_memory_edges_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "botos_memory_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_memory_nodes: {
        Row: {
          created_at: string
          id: string
          label: string
          metadata: Json | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          label: string
          metadata?: Json | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          metadata?: Json | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      botos_outcome_records: {
        Row: {
          action: string
          agent_id: string
          created_at: string
          duration_ms: number
          evidence: string[]
          id: string
          impact: number
          metadata: Json | null
          run_id: string
          started_at: string
          status: string
          strategy: string
        }
        Insert: {
          action: string
          agent_id: string
          created_at?: string
          duration_ms?: number
          evidence?: string[]
          id: string
          impact?: number
          metadata?: Json | null
          run_id: string
          started_at: string
          status: string
          strategy: string
        }
        Update: {
          action?: string
          agent_id?: string
          created_at?: string
          duration_ms?: number
          evidence?: string[]
          id?: string
          impact?: number
          metadata?: Json | null
          run_id?: string
          started_at?: string
          status?: string
          strategy?: string
        }
        Relationships: []
      }
      botos_policy_state: {
        Row: {
          action_cooldown_until: Json
          denial_log: Json
          execution_log: Json
          global_blocked_until: string | null
          id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          action_cooldown_until?: Json
          denial_log?: Json
          execution_log?: Json
          global_blocked_until?: string | null
          id?: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          action_cooldown_until?: Json
          denial_log?: Json
          execution_log?: Json
          global_blocked_until?: string | null
          id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: []
      }
      botos_predictive_opportunities: {
        Row: {
          agent_id: string | null
          category: string
          confidence: number
          created_at: string
          description: string
          estimated_effort: string
          evidence_ids: string[] | null
          id: string
          potential_impact: string
          reasoning: string
          risk_factors: string[]
          signals: Json
          status: string
          success_metrics: string[]
          suggested_actions: string[]
          time_to_relevance: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          category: string
          confidence?: number
          created_at?: string
          description: string
          estimated_effort: string
          evidence_ids?: string[] | null
          id: string
          potential_impact: string
          reasoning: string
          risk_factors?: string[]
          signals?: Json
          status?: string
          success_metrics?: string[]
          suggested_actions?: string[]
          time_to_relevance: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          category?: string
          confidence?: number
          created_at?: string
          description?: string
          estimated_effort?: string
          evidence_ids?: string[] | null
          id?: string
          potential_impact?: string
          reasoning?: string
          risk_factors?: string[]
          signals?: Json
          status?: string
          success_metrics?: string[]
          suggested_actions?: string[]
          time_to_relevance?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "botos_predictive_opportunities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "botos_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_secrets: {
        Row: {
          created_at: string
          description: string | null
          encrypted_value: string
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          encrypted_value: string
          id: string
          key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          encrypted_value?: string
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      botos_strategy_posteriors: {
        Row: {
          agent_id: string
          alpha: number
          beta: number
          id: string
          last_outcome: string | null
          posterior_mean: number
          samples: number
          strategy: string
          updated_at: string
        }
        Insert: {
          agent_id?: string
          alpha?: number
          beta?: number
          id: string
          last_outcome?: string | null
          posterior_mean?: number
          samples?: number
          strategy: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          alpha?: number
          beta?: number
          id?: string
          last_outcome?: string | null
          posterior_mean?: number
          samples?: number
          strategy?: string
          updated_at?: string
        }
        Relationships: []
      }
      botos_webhook_configs: {
        Row: {
          agent_id: string
          created_at: string
          enabled: boolean
          events: string[]
          github_repo: string
          id: string
          last_triggered: string | null
          secret: string
          total_triggers: number
          webhook_url: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          enabled?: boolean
          events?: string[]
          github_repo: string
          id: string
          last_triggered?: string | null
          secret: string
          total_triggers?: number
          webhook_url: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          enabled?: boolean
          events?: string[]
          github_repo?: string
          id?: string
          last_triggered?: string | null
          secret?: string
          total_triggers?: number
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "botos_webhook_configs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "botos_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      botos_webhook_events: {
        Row: {
          agent_id: string
          event: string
          hmac_valid: boolean | null
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          received_at: string
          verified: boolean
          webhook_id: string | null
        }
        Insert: {
          agent_id: string
          event: string
          hmac_valid?: boolean | null
          id: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          verified?: boolean
          webhook_id?: string | null
        }
        Update: {
          agent_id?: string
          event?: string
          hmac_valid?: boolean | null
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          verified?: boolean
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "botos_webhook_events_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "botos_webhook_configs"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "charter_asset_valuations_charter_entity_id_fkey"
            columns: ["charter_entity_id"]
            isOneToOne: false
            referencedRelation: "generational_brand_index"
            referencedColumns: ["charter_entity_id"]
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
            foreignKeyName: "charter_obligations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "generational_brand_index"
            referencedColumns: ["charter_entity_id"]
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
            foreignKeyName: "charter_payouts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "generational_brand_index"
            referencedColumns: ["charter_entity_id"]
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
          {
            foreignKeyName: "charter_rights_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "generational_brand_index"
            referencedColumns: ["charter_entity_id"]
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
      claim_checks: {
        Row: {
          claim_path: string | null
          claim_text: string
          created_at: string
          deterministic_pass: boolean
          evidence_ids: string[]
          final_status: string
          id: string
          run_id: string
          verifier_model: string
          verifier_reasoning: string
          verifier_verdict: string
        }
        Insert: {
          claim_path?: string | null
          claim_text: string
          created_at?: string
          deterministic_pass?: boolean
          evidence_ids?: string[]
          final_status?: string
          id?: string
          run_id: string
          verifier_model?: string
          verifier_reasoning?: string
          verifier_verdict?: string
        }
        Update: {
          claim_path?: string | null
          claim_text?: string
          created_at?: string
          deterministic_pass?: boolean
          evidence_ids?: string[]
          final_status?: string
          id?: string
          run_id?: string
          verifier_model?: string
          verifier_reasoning?: string
          verifier_verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_checks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
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
          governance_scope: string
          id: string
          industry: string | null
          kind: string
          name: string
          primary_site_id: string | null
          seen_on_sites: Json
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          governance_scope?: string
          id?: string
          industry?: string | null
          kind?: string
          name: string
          primary_site_id?: string | null
          seen_on_sites?: Json
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          governance_scope?: string
          id?: string
          industry?: string | null
          kind?: string
          name?: string
          primary_site_id?: string | null
          seen_on_sites?: Json
          workspace_id?: string | null
        }
        Relationships: []
      }
      coffee_matches: {
        Row: {
          actor_meg_entity_id: string | null
          compatibility_score: number
          conversation_topics: string[]
          created_at: string
          id: string
          match_reason: string
          matched_attendee_id: string
          matched_attendee_name: string
          matched_meg_entity_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          actor_meg_entity_id?: string | null
          compatibility_score?: number
          conversation_topics?: string[]
          created_at?: string
          id?: string
          match_reason: string
          matched_attendee_id: string
          matched_attendee_name: string
          matched_meg_entity_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          actor_meg_entity_id?: string | null
          compatibility_score?: number
          conversation_topics?: string[]
          created_at?: string
          id?: string
          match_reason?: string
          matched_attendee_id?: string
          matched_attendee_name?: string
          matched_meg_entity_id?: string | null
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
      continuity_agent_access_scopes: {
        Row: {
          charter_id: string
          created_at: string
          grants: Json
          id: string
          metadata: Json
          scope_key: string
          updated_at: string
        }
        Insert: {
          charter_id: string
          created_at?: string
          grants?: Json
          id?: string
          metadata?: Json
          scope_key: string
          updated_at?: string
        }
        Update: {
          charter_id?: string
          created_at?: string
          grants?: Json
          id?: string
          metadata?: Json
          scope_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_agent_access_scopes_charter_id_fkey"
            columns: ["charter_id"]
            isOneToOne: false
            referencedRelation: "continuity_agent_charters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_agent_access_scopes_charter_id_fkey"
            columns: ["charter_id"]
            isOneToOne: false
            referencedRelation: "v_agent_authority_surface"
            referencedColumns: ["id"]
          },
        ]
      }
      continuity_agent_actions: {
        Row: {
          action_type: string
          charter_id: string
          created_at: string
          decision: string
          decision_reason: string
          evidence_link_ids: string[]
          id: string
          metadata: Json
          requested_by: string | null
          target_id: string | null
          target_kind: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_type: string
          charter_id: string
          created_at?: string
          decision: string
          decision_reason?: string
          evidence_link_ids?: string[]
          id?: string
          metadata?: Json
          requested_by?: string | null
          target_id?: string | null
          target_kind?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_type?: string
          charter_id?: string
          created_at?: string
          decision?: string
          decision_reason?: string
          evidence_link_ids?: string[]
          id?: string
          metadata?: Json
          requested_by?: string | null
          target_id?: string | null
          target_kind?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_agent_actions_charter_id_fkey"
            columns: ["charter_id"]
            isOneToOne: false
            referencedRelation: "continuity_agent_charters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_agent_actions_charter_id_fkey"
            columns: ["charter_id"]
            isOneToOne: false
            referencedRelation: "v_agent_authority_surface"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_agent_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_agent_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_agent_charters: {
        Row: {
          agent_name: string
          agent_type: string | null
          allowed_actions: Json
          approval_thresholds: Json
          contract_authority_limit: string | null
          created_at: string
          created_by: string | null
          data_access_scope: Json
          display_code: string
          evidence_requirements: Json
          expires_at: string | null
          id: string
          metadata: Json
          owner_external_ref: string | null
          owner_label: string | null
          principal_external_ref: string | null
          principal_label: string | null
          prohibited_actions: Json
          requires_human_approval: boolean
          revoked_at: string | null
          spending_limit: number | null
          status: Database["public"]["Enums"]["continuity_agent_charter_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_name: string
          agent_type?: string | null
          allowed_actions?: Json
          approval_thresholds?: Json
          contract_authority_limit?: string | null
          created_at?: string
          created_by?: string | null
          data_access_scope?: Json
          display_code: string
          evidence_requirements?: Json
          expires_at?: string | null
          id?: string
          metadata?: Json
          owner_external_ref?: string | null
          owner_label?: string | null
          principal_external_ref?: string | null
          principal_label?: string | null
          prohibited_actions?: Json
          requires_human_approval?: boolean
          revoked_at?: string | null
          spending_limit?: number | null
          status?: Database["public"]["Enums"]["continuity_agent_charter_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_name?: string
          agent_type?: string | null
          allowed_actions?: Json
          approval_thresholds?: Json
          contract_authority_limit?: string | null
          created_at?: string
          created_by?: string | null
          data_access_scope?: Json
          display_code?: string
          evidence_requirements?: Json
          expires_at?: string | null
          id?: string
          metadata?: Json
          owner_external_ref?: string | null
          owner_label?: string | null
          principal_external_ref?: string | null
          principal_label?: string | null
          prohibited_actions?: Json
          requires_human_approval?: boolean
          revoked_at?: string | null
          spending_limit?: number | null
          status?: Database["public"]["Enums"]["continuity_agent_charter_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_agent_charters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_agent_charters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_claims: {
        Row: {
          claim_type: string
          confidence: number | null
          context_asset_id: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          sensitivity_level: string
          signal_item_id: string | null
          statement: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          claim_type?: string
          confidence?: number | null
          context_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          sensitivity_level?: string
          signal_item_id?: string | null
          statement: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          claim_type?: string
          confidence?: number | null
          context_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          sensitivity_level?: string
          signal_item_id?: string | null
          statement?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_claims_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "continuity_context_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "v_context_assets_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_signal_item_id_fkey"
            columns: ["signal_item_id"]
            isOneToOne: false
            referencedRelation: "continuity_signal_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_signal_item_id_fkey"
            columns: ["signal_item_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_signal_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_context_asset_entities: {
        Row: {
          confidence: number | null
          context_asset_id: string
          created_at: string
          created_by: string | null
          entity_label: string | null
          entity_type: string
          external_entity_id: string | null
          external_system: string | null
          future_meg_entity_id: string | null
          id: string
          metadata: Json
          relationship_type: string
          workspace_id: string
        }
        Insert: {
          confidence?: number | null
          context_asset_id: string
          created_at?: string
          created_by?: string | null
          entity_label?: string | null
          entity_type?: string
          external_entity_id?: string | null
          external_system?: string | null
          future_meg_entity_id?: string | null
          id?: string
          metadata?: Json
          relationship_type?: string
          workspace_id: string
        }
        Update: {
          confidence?: number | null
          context_asset_id?: string
          created_at?: string
          created_by?: string | null
          entity_label?: string | null
          entity_type?: string
          external_entity_id?: string | null
          external_system?: string | null
          future_meg_entity_id?: string | null
          id?: string
          metadata?: Json
          relationship_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_context_asset_entities_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "continuity_context_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_context_asset_entities_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "v_context_assets_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_context_asset_entities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_context_asset_entities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_context_assets: {
        Row: {
          ai_access_policy: Database["public"]["Enums"]["continuity_ai_access_policy"]
          confidence_band: Database["public"]["Enums"]["continuity_confidence_band"]
          confidence_score: number | null
          context_type: string
          continuity_risk_level: string | null
          contradiction_open_count: number
          created_at: string
          created_by: string | null
          custodian_external_ref: string | null
          custodian_label: string | null
          description: string | null
          display_code: string
          economic_relevance_score: number | null
          freshness_score: number | null
          governance_status: Database["public"]["Enums"]["continuity_governance_status"]
          id: string
          metadata: Json
          owner_external_ref: string | null
          owner_label: string | null
          sensitivity_level: string
          source_record_id: string | null
          source_system: string | null
          title: string
          uniqueness_score: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_access_policy?: Database["public"]["Enums"]["continuity_ai_access_policy"]
          confidence_band?: Database["public"]["Enums"]["continuity_confidence_band"]
          confidence_score?: number | null
          context_type?: string
          continuity_risk_level?: string | null
          contradiction_open_count?: number
          created_at?: string
          created_by?: string | null
          custodian_external_ref?: string | null
          custodian_label?: string | null
          description?: string | null
          display_code: string
          economic_relevance_score?: number | null
          freshness_score?: number | null
          governance_status?: Database["public"]["Enums"]["continuity_governance_status"]
          id?: string
          metadata?: Json
          owner_external_ref?: string | null
          owner_label?: string | null
          sensitivity_level?: string
          source_record_id?: string | null
          source_system?: string | null
          title: string
          uniqueness_score?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_access_policy?: Database["public"]["Enums"]["continuity_ai_access_policy"]
          confidence_band?: Database["public"]["Enums"]["continuity_confidence_band"]
          confidence_score?: number | null
          context_type?: string
          continuity_risk_level?: string | null
          contradiction_open_count?: number
          created_at?: string
          created_by?: string | null
          custodian_external_ref?: string | null
          custodian_label?: string | null
          description?: string | null
          display_code?: string
          economic_relevance_score?: number | null
          freshness_score?: number | null
          governance_status?: Database["public"]["Enums"]["continuity_governance_status"]
          id?: string
          metadata?: Json
          owner_external_ref?: string | null
          owner_label?: string | null
          sensitivity_level?: string
          source_record_id?: string | null
          source_system?: string | null
          title?: string
          uniqueness_score?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_context_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_context_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_evidence_links: {
        Row: {
          claim_id: string | null
          context_asset_id: string | null
          contradiction_state: string
          created_at: string
          created_by: string | null
          evidence_source_id: string | null
          evidence_summary: string | null
          evidence_type: string | null
          freshness_band: string
          id: string
          metadata: Json
          missing_proof_item: string | null
          provenance_status: string
          review_posture: string
          source_authority: string
          source_record_id: string | null
          source_system: string | null
          source_url: string | null
          workspace_id: string
        }
        Insert: {
          claim_id?: string | null
          context_asset_id?: string | null
          contradiction_state?: string
          created_at?: string
          created_by?: string | null
          evidence_source_id?: string | null
          evidence_summary?: string | null
          evidence_type?: string | null
          freshness_band?: string
          id?: string
          metadata?: Json
          missing_proof_item?: string | null
          provenance_status?: string
          review_posture?: string
          source_authority?: string
          source_record_id?: string | null
          source_system?: string | null
          source_url?: string | null
          workspace_id: string
        }
        Update: {
          claim_id?: string | null
          context_asset_id?: string | null
          contradiction_state?: string
          created_at?: string
          created_by?: string | null
          evidence_source_id?: string | null
          evidence_summary?: string | null
          evidence_type?: string | null
          freshness_band?: string
          id?: string
          metadata?: Json
          missing_proof_item?: string | null
          provenance_status?: string
          review_posture?: string
          source_authority?: string
          source_record_id?: string | null
          source_system?: string | null
          source_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_evidence_links_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "continuity_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_claims_surface"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "continuity_context_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "v_context_assets_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_evidence_source_id_fkey"
            columns: ["evidence_source_id"]
            isOneToOne: false
            referencedRelation: "continuity_evidence_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_evidence_sources: {
        Row: {
          authority_tier: string
          base_uri: string | null
          created_at: string
          created_by: string | null
          custodian_notes: string | null
          display_label: string
          id: string
          metadata: Json
          source_system: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          authority_tier?: string
          base_uri?: string | null
          created_at?: string
          created_by?: string | null
          custodian_notes?: string | null
          display_label: string
          id?: string
          metadata?: Json
          source_system: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          authority_tier?: string
          base_uri?: string | null
          created_at?: string
          created_by?: string | null
          custodian_notes?: string | null
          display_label?: string
          id?: string
          metadata?: Json
          source_system?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_evidence_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_friction_surfaces: {
        Row: {
          agent_capability_required: string | null
          agent_vector: string | null
          compression_probability: number | null
          created_at: string
          created_by: string | null
          current_agent_readiness: string | null
          defensible_context_assets: Json
          exposure_score: number
          friction_dependency_score: number | null
          human_friction_type: string | null
          id: string
          industry: string | null
          metadata: Json
          recommended_actions: Json
          regulatory_brakes: string | null
          revenue_pool: string | null
          status: string
          target_external_ref: string | null
          target_label: string | null
          time_horizon: string | null
          trend: string
          updated_at: string
          workflow: string
          workspace_id: string
        }
        Insert: {
          agent_capability_required?: string | null
          agent_vector?: string | null
          compression_probability?: number | null
          created_at?: string
          created_by?: string | null
          current_agent_readiness?: string | null
          defensible_context_assets?: Json
          exposure_score?: number
          friction_dependency_score?: number | null
          human_friction_type?: string | null
          id?: string
          industry?: string | null
          metadata?: Json
          recommended_actions?: Json
          regulatory_brakes?: string | null
          revenue_pool?: string | null
          status?: string
          target_external_ref?: string | null
          target_label?: string | null
          time_horizon?: string | null
          trend?: string
          updated_at?: string
          workflow: string
          workspace_id: string
        }
        Update: {
          agent_capability_required?: string | null
          agent_vector?: string | null
          compression_probability?: number | null
          created_at?: string
          created_by?: string | null
          current_agent_readiness?: string | null
          defensible_context_assets?: Json
          exposure_score?: number
          friction_dependency_score?: number | null
          human_friction_type?: string | null
          id?: string
          industry?: string | null
          metadata?: Json
          recommended_actions?: Json
          regulatory_brakes?: string | null
          revenue_pool?: string | null
          status?: string
          target_external_ref?: string | null
          target_label?: string | null
          time_horizon?: string | null
          trend?: string
          updated_at?: string
          workflow?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_friction_surfaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_friction_surfaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_governance_events: {
        Row: {
          actor_agent_charter_id: string | null
          actor_label: string | null
          actor_type: string
          actor_user_id: string | null
          audit_hash: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          previous_hash: string | null
          severity: string
          subject_id: string | null
          subject_type: string | null
          summary: string
          workspace_id: string
        }
        Insert: {
          actor_agent_charter_id?: string | null
          actor_label?: string | null
          actor_type?: string
          actor_user_id?: string | null
          audit_hash: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          previous_hash?: string | null
          severity?: string
          subject_id?: string | null
          subject_type?: string | null
          summary: string
          workspace_id: string
        }
        Update: {
          actor_agent_charter_id?: string | null
          actor_label?: string | null
          actor_type?: string
          actor_user_id?: string | null
          audit_hash?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          previous_hash?: string | null
          severity?: string
          subject_id?: string | null
          subject_type?: string | null
          summary?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_governance_events_actor_agent_charter_id_fkey"
            columns: ["actor_agent_charter_id"]
            isOneToOne: false
            referencedRelation: "continuity_agent_charters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_governance_events_actor_agent_charter_id_fkey"
            columns: ["actor_agent_charter_id"]
            isOneToOne: false
            referencedRelation: "v_agent_authority_surface"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_governance_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_governance_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_ingest_runs: {
        Row: {
          completed_at: string | null
          created_by: string | null
          destination_system: string
          error_summary: string | null
          id: string
          metadata: Json
          rows_accepted: number
          rows_rejected: number
          signal_channel_id: string | null
          source_system: string
          started_at: string
          status: Database["public"]["Enums"]["continuity_ingest_run_status"]
          trigger_kind: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          destination_system?: string
          error_summary?: string | null
          id?: string
          metadata?: Json
          rows_accepted?: number
          rows_rejected?: number
          signal_channel_id?: string | null
          source_system: string
          started_at?: string
          status?: Database["public"]["Enums"]["continuity_ingest_run_status"]
          trigger_kind?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          destination_system?: string
          error_summary?: string | null
          id?: string
          metadata?: Json
          rows_accepted?: number
          rows_rejected?: number
          signal_channel_id?: string | null
          source_system?: string
          started_at?: string
          status?: Database["public"]["Enums"]["continuity_ingest_run_status"]
          trigger_kind?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_ingest_runs_signal_channel_id_fkey"
            columns: ["signal_channel_id"]
            isOneToOne: false
            referencedRelation: "continuity_signal_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_ingest_runs_signal_channel_id_fkey"
            columns: ["signal_channel_id"]
            isOneToOne: false
            referencedRelation: "v_signal_channel_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_ingest_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_ingest_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_signal_channels: {
        Row: {
          created_at: string
          created_by: string | null
          destination_system: string
          id: string
          integrity_band: Database["public"]["Enums"]["continuity_confidence_band"]
          integrity_score: number
          last_handshake_at: string | null
          last_ingest_run_id: string | null
          metadata: Json
          policy_scope: Json
          signal_type: string
          source_system: string
          state: Database["public"]["Enums"]["continuity_signal_channel_state"]
          throughput_score: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_system?: string
          id?: string
          integrity_band?: Database["public"]["Enums"]["continuity_confidence_band"]
          integrity_score?: number
          last_handshake_at?: string | null
          last_ingest_run_id?: string | null
          metadata?: Json
          policy_scope?: Json
          signal_type?: string
          source_system: string
          state?: Database["public"]["Enums"]["continuity_signal_channel_state"]
          throughput_score?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_system?: string
          id?: string
          integrity_band?: Database["public"]["Enums"]["continuity_confidence_band"]
          integrity_score?: number
          last_handshake_at?: string | null
          last_ingest_run_id?: string | null
          metadata?: Json
          policy_scope?: Json
          signal_type?: string
          source_system?: string
          state?: Database["public"]["Enums"]["continuity_signal_channel_state"]
          throughput_score?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_signal_channels_last_ingest_run_id_fkey"
            columns: ["last_ingest_run_id"]
            isOneToOne: false
            referencedRelation: "continuity_ingest_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_signal_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_signal_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_signal_items: {
        Row: {
          actor_external_ref: string | null
          confidence: number | null
          created_at: string
          id: string
          idempotency_key: string
          ingest_run_id: string | null
          metadata: Json
          processed_at: string | null
          processing_status: Database["public"]["Enums"]["continuity_signal_processing_status"]
          related_external_refs: Json
          sensitivity_level: string
          signal_type: string
          source_event_type: string
          source_payload: Json
          source_record_id: string | null
          source_system: string
          source_url: string | null
          subject_external_ref: string | null
          summary: string
          workspace_id: string
        }
        Insert: {
          actor_external_ref?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          idempotency_key: string
          ingest_run_id?: string | null
          metadata?: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["continuity_signal_processing_status"]
          related_external_refs?: Json
          sensitivity_level?: string
          signal_type?: string
          source_event_type: string
          source_payload?: Json
          source_record_id?: string | null
          source_system: string
          source_url?: string | null
          subject_external_ref?: string | null
          summary: string
          workspace_id: string
        }
        Update: {
          actor_external_ref?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          idempotency_key?: string
          ingest_run_id?: string | null
          metadata?: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["continuity_signal_processing_status"]
          related_external_refs?: Json
          sensitivity_level?: string
          signal_type?: string
          source_event_type?: string
          source_payload?: Json
          source_record_id?: string | null
          source_system?: string
          source_url?: string | null
          subject_external_ref?: string | null
          summary?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_signal_items_ingest_run_id_fkey"
            columns: ["ingest_run_id"]
            isOneToOne: false
            referencedRelation: "continuity_ingest_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_signal_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_signal_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_underwriting_runs: {
        Row: {
          agent_authority_risks: Json
          completed_at: string | null
          component_scores: Json
          context_asset_recommendations: Json
          created_at: string
          created_by: string | null
          evidence_gaps: Json
          friction_risks: Json
          id: string
          oracle_opportunity_candidates: Json
          recommended_actions: Json
          risk_level: string | null
          score: number | null
          score_band: string | null
          status: string
          summary: string | null
          target_external_ref: string | null
          target_label: string | null
          target_type: string
          workspace_id: string
        }
        Insert: {
          agent_authority_risks?: Json
          completed_at?: string | null
          component_scores?: Json
          context_asset_recommendations?: Json
          created_at?: string
          created_by?: string | null
          evidence_gaps?: Json
          friction_risks?: Json
          id?: string
          oracle_opportunity_candidates?: Json
          recommended_actions?: Json
          risk_level?: string | null
          score?: number | null
          score_band?: string | null
          status?: string
          summary?: string | null
          target_external_ref?: string | null
          target_label?: string | null
          target_type?: string
          workspace_id: string
        }
        Update: {
          agent_authority_risks?: Json
          completed_at?: string | null
          component_scores?: Json
          context_asset_recommendations?: Json
          created_at?: string
          created_by?: string | null
          evidence_gaps?: Json
          friction_risks?: Json
          id?: string
          oracle_opportunity_candidates?: Json
          recommended_actions?: Json
          risk_level?: string | null
          score?: number | null
          score_band?: string | null
          status?: string
          summary?: string | null
          target_external_ref?: string | null
          target_label?: string | null
          target_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuity_underwriting_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_underwriting_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      continuity_workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
          module: string | null
          operator_id: string | null
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
          module?: string | null
          operator_id?: string | null
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
          module?: string | null
          operator_id?: string | null
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
            referencedRelation: "oracle_briefings_read_model"
            referencedColumns: ["thesis_id"]
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
      eigen_policy_decisions: {
        Row: {
          allowed: boolean
          caller_roles: string[]
          caller_subject: string | null
          capability_tags: string[]
          correlation_id: string | null
          deny_reasons: string[]
          evaluation_ms: number | null
          id: string
          matched_rule_ids: string[]
          metadata: Json
          policy_tags: string[]
          recorded_at: string
        }
        Insert: {
          allowed: boolean
          caller_roles?: string[]
          caller_subject?: string | null
          capability_tags?: string[]
          correlation_id?: string | null
          deny_reasons?: string[]
          evaluation_ms?: number | null
          id?: string
          matched_rule_ids?: string[]
          metadata?: Json
          policy_tags?: string[]
          recorded_at?: string
        }
        Update: {
          allowed?: boolean
          caller_roles?: string[]
          caller_subject?: string | null
          capability_tags?: string[]
          correlation_id?: string | null
          deny_reasons?: string[]
          evaluation_ms?: number | null
          id?: string
          matched_rule_ids?: string[]
          metadata?: Json
          policy_tags?: string[]
          recorded_at?: string
        }
        Relationships: []
      }
      eigen_policy_rule_history: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          correlation_id: string | null
          id: string
          metadata: Json
          occurred_at: string
          rationale: string | null
          rule_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          correlation_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          rationale?: string | null
          rule_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          correlation_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          rationale?: string | null
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eigen_policy_rule_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eigen_policy_rule_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules_active_read_model"
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
          is_active: boolean
          metadata: Json
          policy_tag: string
          rationale: string | null
          required_role: Database["public"]["Enums"]["charter_role"] | null
          superseded_by: string | null
          updated_at: string
          version: number
        }
        Insert: {
          capability_tag_pattern: string
          created_at?: string
          effect: string
          id?: string
          is_active?: boolean
          metadata?: Json
          policy_tag: string
          rationale?: string | null
          required_role?: Database["public"]["Enums"]["charter_role"] | null
          superseded_by?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          capability_tag_pattern?: string
          created_at?: string
          effect?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          policy_tag?: string
          rationale?: string | null
          required_role?: Database["public"]["Enums"]["charter_role"] | null
          superseded_by?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "eigen_policy_rules_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eigen_policy_rules_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules_active_read_model"
            referencedColumns: ["id"]
          },
        ]
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
      entity_enrichment_evidence: {
        Row: {
          created_at: string
          entity_type: string
          field_path: string
          id: string
          ingest_run_id: string | null
          meg_entity_id: string
          observed_at: string
          raw_snippet: string | null
          site_id: string
          source_key: string
          source_tier: number
          value_json: Json
        }
        Insert: {
          created_at?: string
          entity_type: string
          field_path: string
          id?: string
          ingest_run_id?: string | null
          meg_entity_id: string
          observed_at: string
          raw_snippet?: string | null
          site_id: string
          source_key: string
          source_tier: number
          value_json: Json
        }
        Update: {
          created_at?: string
          entity_type?: string
          field_path?: string
          id?: string
          ingest_run_id?: string | null
          meg_entity_id?: string
          observed_at?: string
          raw_snippet?: string | null
          site_id?: string
          source_key?: string
          source_tier?: number
          value_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "entity_enrichment_evidence_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_enrichment_field_consensus: {
        Row: {
          consensus_reason_json: Json
          consensus_score: number
          consensus_value_json: Json | null
          decided_at: string
          entity_type: string
          field_path: string
          id: string
          meg_entity_id: string
          site_id: string
        }
        Insert: {
          consensus_reason_json: Json
          consensus_score: number
          consensus_value_json?: Json | null
          decided_at?: string
          entity_type: string
          field_path: string
          id?: string
          meg_entity_id: string
          site_id: string
        }
        Update: {
          consensus_reason_json?: Json
          consensus_score?: number
          consensus_value_json?: Json | null
          decided_at?: string
          entity_type?: string
          field_path?: string
          id?: string
          meg_entity_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_enrichment_field_consensus_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_enrichment_review_queue: {
        Row: {
          created_at: string
          entity_type: string
          field_path: string
          id: string
          meg_entity_id: string
          payload_json: Json
          resolved_at: string | null
          resolved_by: string | null
          site_id: string
          status: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          field_path: string
          id?: string
          meg_entity_id: string
          payload_json: Json
          resolved_at?: string | null
          resolved_by?: string | null
          site_id: string
          status: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          field_path?: string
          id?: string
          meg_entity_id?: string
          payload_json?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          site_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_enrichment_review_queue_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_enrichment_run_checkpoints: {
        Row: {
          fields_refreshed: number
          id: string
          last_meg_entity_id: string | null
          run_kind: string
          site_id: string
          updated_at: string
        }
        Insert: {
          fields_refreshed?: number
          id?: string
          last_meg_entity_id?: string | null
          run_kind: string
          site_id: string
          updated_at?: string
        }
        Update: {
          fields_refreshed?: number
          id?: string
          last_meg_entity_id?: string | null
          run_kind?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: []
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
      idea_submissions: {
        Row: {
          additional_context: string | null
          created_at: string
          existing_solutions: string | null
          id: string
          idea: string
          meg_entity_id: string | null
          plan_tier: string
          problem: string
          stage: string
          target_customer: string
          user_id: string | null
        }
        Insert: {
          additional_context?: string | null
          created_at?: string
          existing_solutions?: string | null
          id?: string
          idea: string
          meg_entity_id?: string | null
          plan_tier?: string
          problem: string
          stage?: string
          target_customer: string
          user_id?: string | null
        }
        Update: {
          additional_context?: string | null
          created_at?: string
          existing_solutions?: string | null
          id?: string
          idea?: string
          meg_entity_id?: string | null
          plan_tier?: string
          problem?: string
          stage?: string
          target_customer?: string
          user_id?: string | null
        }
        Relationships: []
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
          meg_event_entity_id: string | null
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
          meg_event_entity_id?: string | null
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
          meg_event_entity_id?: string | null
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
      meg_backfill_runs: {
        Row: {
          dry_run: boolean
          errors: number
          finished_at: string | null
          id: string
          inserted_new: number
          matched_existing: number
          notes: string | null
          scanned: number
          source_system: string
          source_table: string
          started_at: string
          status: string
        }
        Insert: {
          dry_run?: boolean
          errors?: number
          finished_at?: string | null
          id?: string
          inserted_new?: number
          matched_existing?: number
          notes?: string | null
          scanned?: number
          source_system: string
          source_table: string
          started_at?: string
          status?: string
        }
        Update: {
          dry_run?: boolean
          errors?: number
          finished_at?: string | null
          id?: string
          inserted_new?: number
          matched_existing?: number
          notes?: string | null
          scanned?: number
          source_system?: string
          source_table?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      meg_closing_file_sidecar: {
        Row: {
          meg_entity_id: string
          property_meg_entity_id: string | null
          scheduled_close_date: string | null
          seller_closing_file_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          meg_entity_id: string
          property_meg_entity_id?: string | null
          scheduled_close_date?: string | null
          seller_closing_file_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          meg_entity_id?: string
          property_meg_entity_id?: string | null
          scheduled_close_date?: string | null
          seller_closing_file_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_closing_file_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meg_closing_file_sidecar_property_meg_entity_id_fkey"
            columns: ["property_meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_company_sidecar: {
        Row: {
          ci_client_id: string | null
          domain: string | null
          ein: string | null
          founded_year: number | null
          hq_city: string | null
          hq_state: string | null
          industry: string | null
          legal_name: string | null
          meg_entity_id: string
          size_band: string | null
          updated_at: string
        }
        Insert: {
          ci_client_id?: string | null
          domain?: string | null
          ein?: string | null
          founded_year?: number | null
          hq_city?: string | null
          hq_state?: string | null
          industry?: string | null
          legal_name?: string | null
          meg_entity_id: string
          size_band?: string | null
          updated_at?: string
        }
        Update: {
          ci_client_id?: string | null
          domain?: string | null
          ein?: string | null
          founded_year?: number | null
          hq_city?: string | null
          hq_state?: string | null
          industry?: string | null
          legal_name?: string | null
          meg_entity_id?: string
          size_band?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_company_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_document_sidecar: {
        Row: {
          document_uri: string | null
          meg_entity_id: string
          mime_type: string | null
          retention_class: string | null
          size_bytes: number | null
          source_row_id: string | null
          source_system: string | null
          source_table: string | null
          updated_at: string
        }
        Insert: {
          document_uri?: string | null
          meg_entity_id: string
          mime_type?: string | null
          retention_class?: string | null
          size_bytes?: number | null
          source_row_id?: string | null
          source_system?: string | null
          source_table?: string | null
          updated_at?: string
        }
        Update: {
          document_uri?: string | null
          meg_entity_id?: string
          mime_type?: string | null
          retention_class?: string | null
          size_bytes?: number | null
          source_row_id?: string | null
          source_system?: string | null
          source_table?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_document_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_entities: {
        Row: {
          attributes: Json
          canonical_name: string
          created_at: string
          enrichment_consensus: Json
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
          enrichment_consensus?: Json
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
          enrichment_consensus?: Json
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
      meg_entity_source_refs: {
        Row: {
          id: string
          meg_entity_id: string
          resolved_at: string
          resolver_version: string
          source_row_id: string
          source_row_pk_type: string
          source_system: string
          source_table: string
        }
        Insert: {
          id?: string
          meg_entity_id: string
          resolved_at?: string
          resolver_version?: string
          source_row_id: string
          source_row_pk_type?: string
          source_system: string
          source_table: string
        }
        Update: {
          id?: string
          meg_entity_id?: string
          resolved_at?: string
          resolver_version?: string
          source_row_id?: string
          source_row_pk_type?: string
          source_system?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_entity_source_refs_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_event_session_sidecar: {
        Row: {
          day_number: number | null
          end_time: string | null
          meg_entity_id: string
          parent_event_id: string | null
          session_type: string | null
          speaker_meg_entity_id: string | null
          start_time: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          day_number?: number | null
          end_time?: string | null
          meg_entity_id: string
          parent_event_id?: string | null
          session_type?: string | null
          speaker_meg_entity_id?: string | null
          start_time?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          day_number?: number | null
          end_time?: string | null
          meg_entity_id?: string
          parent_event_id?: string | null
          session_type?: string | null
          speaker_meg_entity_id?: string | null
          start_time?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_event_session_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meg_event_session_sidecar_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meg_event_session_sidecar_speaker_meg_entity_id_fkey"
            columns: ["speaker_meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_event_sidecar: {
        Row: {
          end_date: string | null
          hero_image_url: string | null
          location: string | null
          meg_entity_id: string
          retreat_year: number | null
          start_date: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          end_date?: string | null
          hero_image_url?: string | null
          location?: string | null
          meg_entity_id: string
          retreat_year?: number | null
          start_date?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          end_date?: string | null
          hero_image_url?: string | null
          location?: string | null
          meg_entity_id?: string
          retreat_year?: number | null
          start_date?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_event_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_ip_matter_sidecar: {
        Row: {
          ip_matter_id: string | null
          matter_type: string | null
          meg_entity_id: string
          participant_meg_ids: string[] | null
          status: string | null
          updated_at: string
          uspto_application_no: string | null
        }
        Insert: {
          ip_matter_id?: string | null
          matter_type?: string | null
          meg_entity_id: string
          participant_meg_ids?: string[] | null
          status?: string | null
          updated_at?: string
          uspto_application_no?: string | null
        }
        Update: {
          ip_matter_id?: string | null
          matter_type?: string | null
          meg_entity_id?: string
          participant_meg_ids?: string[] | null
          status?: string | null
          updated_at?: string
          uspto_application_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meg_ip_matter_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_opportunity_sidecar: {
        Row: {
          economic_value_estimate: number | null
          meg_entity_id: string
          opportunity_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          economic_value_estimate?: number | null
          meg_entity_id: string
          opportunity_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          economic_value_estimate?: number | null
          meg_entity_id?: string
          opportunity_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_opportunity_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_person_athlete_sidecar: {
        Row: {
          athlete_id: string
          conference: string | null
          graduation_year: number | null
          meg_entity_id: string
          nil_deal_count: number | null
          school: string | null
          sport: string | null
          total_nil_value: number | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          conference?: string | null
          graduation_year?: number | null
          meg_entity_id: string
          nil_deal_count?: number | null
          school?: string | null
          sport?: string | null
          total_nil_value?: number | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          conference?: string | null
          graduation_year?: number | null
          meg_entity_id?: string
          nil_deal_count?: number | null
          school?: string | null
          sport?: string | null
          total_nil_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_person_athlete_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_person_attendee_sidecar: {
        Row: {
          attendance_years: number[] | null
          bio: string | null
          email: string | null
          interests: string[] | null
          is_speaker: boolean
          is_sponsor: boolean
          linkedin_url: string | null
          meg_entity_id: string
          organization: string | null
          retreat_attendee_id: string | null
          role: string | null
          source_system: string
          updated_at: string
        }
        Insert: {
          attendance_years?: number[] | null
          bio?: string | null
          email?: string | null
          interests?: string[] | null
          is_speaker?: boolean
          is_sponsor?: boolean
          linkedin_url?: string | null
          meg_entity_id: string
          organization?: string | null
          retreat_attendee_id?: string | null
          role?: string | null
          source_system: string
          updated_at?: string
        }
        Update: {
          attendance_years?: number[] | null
          bio?: string | null
          email?: string | null
          interests?: string[] | null
          is_speaker?: boolean
          is_sponsor?: boolean
          linkedin_url?: string | null
          meg_entity_id?: string
          organization?: string | null
          retreat_attendee_id?: string | null
          role?: string | null
          source_system?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_person_attendee_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_person_contact_sidecar: {
        Row: {
          alternate_emails: string[] | null
          ci_contact_ids: string[] | null
          ci_master_contact_id: string | null
          company_meg_entity_id: string | null
          meg_entity_id: string
          primary_email: string | null
          primary_phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          alternate_emails?: string[] | null
          ci_contact_ids?: string[] | null
          ci_master_contact_id?: string | null
          company_meg_entity_id?: string | null
          meg_entity_id: string
          primary_email?: string | null
          primary_phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          alternate_emails?: string[] | null
          ci_contact_ids?: string[] | null
          ci_master_contact_id?: string | null
          company_meg_entity_id?: string | null
          meg_entity_id?: string
          primary_email?: string | null
          primary_phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_person_contact_sidecar_company_meg_entity_id_fkey"
            columns: ["company_meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meg_person_contact_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_person_operator_sidecar: {
        Row: {
          is_active: boolean
          is_admin: boolean
          last_seen_at: string | null
          meg_entity_id: string
          operator_profile_id: string
          scope_grants: Json | null
          updated_at: string
        }
        Insert: {
          is_active?: boolean
          is_admin?: boolean
          last_seen_at?: string | null
          meg_entity_id: string
          operator_profile_id: string
          scope_grants?: Json | null
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          is_admin?: boolean
          last_seen_at?: string | null
          meg_entity_id?: string
          operator_profile_id?: string
          scope_grants?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_person_operator_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_person_speaker_sidecar: {
        Row: {
          bio: string | null
          events_spoken_at: string[] | null
          meg_entity_id: string
          speaker_topics: string[] | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          events_spoken_at?: string[] | null
          meg_entity_id: string
          speaker_topics?: string[] | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          events_spoken_at?: string[] | null
          meg_entity_id?: string
          speaker_topics?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_person_speaker_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_property_sidecar: {
        Row: {
          acreage: number | null
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          county: string | null
          meg_entity_id: string
          parcel_id: string | null
          postal_code: string | null
          property_id: string | null
          property_type: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          acreage?: number | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          county?: string | null
          meg_entity_id: string
          parcel_id?: string | null
          postal_code?: string | null
          property_id?: string | null
          property_type?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          acreage?: number | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          county?: string | null
          meg_entity_id?: string
          parcel_id?: string | null
          postal_code?: string | null
          property_id?: string | null
          property_type?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_property_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_property_tower_sidecar: {
        Row: {
          carriers_on_tower: string[] | null
          fcc_registration_id: string | null
          ground_lease_status: string | null
          height_ft: number | null
          meg_entity_id: string
          tower_asset_id: string | null
          updated_at: string
        }
        Insert: {
          carriers_on_tower?: string[] | null
          fcc_registration_id?: string | null
          ground_lease_status?: string | null
          height_ft?: number | null
          meg_entity_id: string
          tower_asset_id?: string | null
          updated_at?: string
        }
        Update: {
          carriers_on_tower?: string[] | null
          fcc_registration_id?: string | null
          ground_lease_status?: string | null
          height_ft?: number | null
          meg_entity_id?: string
          tower_asset_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_property_tower_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_thesis_sidecar: {
        Row: {
          confidence: number | null
          domain: string | null
          meg_entity_id: string
          publication_status: string | null
          thesis_id: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          domain?: string | null
          meg_entity_id: string
          publication_status?: string | null
          thesis_id?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          domain?: string | null
          meg_entity_id?: string
          publication_status?: string | null
          thesis_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_thesis_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meg_topic_sidecar: {
        Row: {
          embedding_vector_id: string | null
          meg_entity_id: string
          parent_topic_meg_entity_id: string | null
          topic_label: string | null
          updated_at: string
        }
        Insert: {
          embedding_vector_id?: string | null
          meg_entity_id: string
          parent_topic_meg_entity_id?: string | null
          topic_label?: string | null
          updated_at?: string
        }
        Update: {
          embedding_vector_id?: string | null
          meg_entity_id?: string
          parent_topic_meg_entity_id?: string | null
          topic_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meg_topic_sidecar_meg_entity_id_fkey"
            columns: ["meg_entity_id"]
            isOneToOne: true
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meg_topic_sidecar_parent_topic_meg_entity_id_fkey"
            columns: ["parent_topic_meg_entity_id"]
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
      missing_institution_briefs: {
        Row: {
          affected_domains: string[]
          contradiction_summary: Json
          created_at: string
          governance_requirements: Json
          id: string
          institution_gap_summary: string
          kill_tests: Json
          metadata: Json
          owner_user_id: string | null
          primary_opportunity_id: string | null
          proof_plan: Json
          related_meg_entity_ids: string[]
          status: Database["public"]["Enums"]["missing_institution_brief_status"]
          title: string
          updated_at: string
        }
        Insert: {
          affected_domains?: string[]
          contradiction_summary?: Json
          created_at?: string
          governance_requirements?: Json
          id?: string
          institution_gap_summary: string
          kill_tests?: Json
          metadata?: Json
          owner_user_id?: string | null
          primary_opportunity_id?: string | null
          proof_plan?: Json
          related_meg_entity_ids?: string[]
          status?: Database["public"]["Enums"]["missing_institution_brief_status"]
          title: string
          updated_at?: string
        }
        Update: {
          affected_domains?: string[]
          contradiction_summary?: Json
          created_at?: string
          governance_requirements?: Json
          id?: string
          institution_gap_summary?: string
          kill_tests?: Json
          metadata?: Json
          owner_user_id?: string | null
          primary_opportunity_id?: string | null
          proof_plan?: Json
          related_meg_entity_ids?: string[]
          status?: Database["public"]["Enums"]["missing_institution_brief_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missing_institution_briefs_primary_opportunity_id_fkey"
            columns: ["primary_opportunity_id"]
            isOneToOne: false
            referencedRelation: "oracle_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      missing_institution_evidence_links: {
        Row: {
          brief_id: string
          created_at: string
          id: string
          knowledge_chunk_id: string | null
          link_role: string
          oracle_evidence_item_id: string | null
          platform_feed_item_id: string | null
        }
        Insert: {
          brief_id: string
          created_at?: string
          id?: string
          knowledge_chunk_id?: string | null
          link_role?: string
          oracle_evidence_item_id?: string | null
          platform_feed_item_id?: string | null
        }
        Update: {
          brief_id?: string
          created_at?: string
          id?: string
          knowledge_chunk_id?: string | null
          link_role?: string
          oracle_evidence_item_id?: string | null
          platform_feed_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missing_institution_evidence_links_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "missing_institution_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missing_institution_evidence_links_knowledge_chunk_id_fkey"
            columns: ["knowledge_chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missing_institution_evidence_links_oracle_evidence_item_id_fkey"
            columns: ["oracle_evidence_item_id"]
            isOneToOne: false
            referencedRelation: "oracle_evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missing_institution_evidence_links_platform_feed_item_id_fkey"
            columns: ["platform_feed_item_id"]
            isOneToOne: false
            referencedRelation: "platform_feed_items"
            referencedColumns: ["id"]
          },
        ]
      }
      model_reviews: {
        Row: {
          blind_spots: string[]
          cost_usd: number
          created_at: string
          dissent_flags: Json
          error: string | null
          id: string
          model: string
          provider: string
          raw_response: Json | null
          run_id: string
          score: number | null
          status: string
          themes_json: Json
          tokens: number
          top_opportunity: string | null
          top_risk: string | null
          verdict: string | null
        }
        Insert: {
          blind_spots?: string[]
          cost_usd?: number
          created_at?: string
          dissent_flags?: Json
          error?: string | null
          id?: string
          model: string
          provider: string
          raw_response?: Json | null
          run_id: string
          score?: number | null
          status?: string
          themes_json?: Json
          tokens?: number
          top_opportunity?: string | null
          top_risk?: string | null
          verdict?: string | null
        }
        Update: {
          blind_spots?: string[]
          cost_usd?: number
          created_at?: string
          dissent_flags?: Json
          error?: string | null
          id?: string
          model?: string
          provider?: string
          raw_response?: Json | null
          run_id?: string
          score?: number | null
          status?: string
          themes_json?: Json
          tokens?: number
          top_opportunity?: string | null
          top_risk?: string | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_reviews_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
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
      operator_proposals: {
        Row: {
          actor_meg_entity_id: string | null
          alternatives: Json
          confidence: number | null
          cross_brand_count: number
          downstream_run_id: string | null
          drafted_at: string
          drafter: string
          drafter_run_id: string | null
          estimated_reversal_cost: string | null
          evidence_chunk_ids: string[]
          evidence_item_ids: string[]
          executed_at: string | null
          execution_error: string | null
          execution_started_at: string | null
          expires_at: string | null
          id: string
          modified_actions: Json | null
          privacy_level: string
          proposal_kind: string
          proposed_actions: Json
          rationale: string
          related_entity_ids: string[]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_systems: string[]
          status: string
          title: string
          triggering_signal_ids: string[]
        }
        Insert: {
          actor_meg_entity_id?: string | null
          alternatives?: Json
          confidence?: number | null
          cross_brand_count?: number
          downstream_run_id?: string | null
          drafted_at?: string
          drafter: string
          drafter_run_id?: string | null
          estimated_reversal_cost?: string | null
          evidence_chunk_ids?: string[]
          evidence_item_ids?: string[]
          executed_at?: string | null
          execution_error?: string | null
          execution_started_at?: string | null
          expires_at?: string | null
          id?: string
          modified_actions?: Json | null
          privacy_level?: string
          proposal_kind: string
          proposed_actions: Json
          rationale: string
          related_entity_ids?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_systems?: string[]
          status?: string
          title: string
          triggering_signal_ids: string[]
        }
        Update: {
          actor_meg_entity_id?: string | null
          alternatives?: Json
          confidence?: number | null
          cross_brand_count?: number
          downstream_run_id?: string | null
          drafted_at?: string
          drafter?: string
          drafter_run_id?: string | null
          estimated_reversal_cost?: string | null
          evidence_chunk_ids?: string[]
          evidence_item_ids?: string[]
          executed_at?: string | null
          execution_error?: string | null
          execution_started_at?: string | null
          expires_at?: string | null
          id?: string
          modified_actions?: Json | null
          privacy_level?: string
          proposal_kind?: string
          proposed_actions?: Json
          rationale?: string
          related_entity_ids?: string[]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_systems?: string[]
          status?: string
          title?: string
          triggering_signal_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "operator_proposals_actor_meg_entity_id_fkey"
            columns: ["actor_meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "oracle_briefings_read_model"
            referencedColumns: ["thesis_id"]
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
      oracle_opportunities: {
        Row: {
          affected_domains: string[]
          buyer_or_beneficiary: string | null
          confidence: number | null
          contradiction_flags: Json
          created_at: string
          description: string | null
          economic_value_basis: string | null
          economic_value_estimate: number | null
          evidence_pack_ref: Json
          id: string
          metadata: Json
          outcome_closed_at: string | null
          outcome_learnings: string | null
          outcome_revenue: number | null
          outcome_status: string | null
          owner_user_id: string | null
          primary_thesis_id: string | null
          recommended_next_action: string | null
          related_meg_entities: string[]
          status: Database["public"]["Enums"]["oracle_opportunity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          affected_domains?: string[]
          buyer_or_beneficiary?: string | null
          confidence?: number | null
          contradiction_flags?: Json
          created_at?: string
          description?: string | null
          economic_value_basis?: string | null
          economic_value_estimate?: number | null
          evidence_pack_ref?: Json
          id?: string
          metadata?: Json
          outcome_closed_at?: string | null
          outcome_learnings?: string | null
          outcome_revenue?: number | null
          outcome_status?: string | null
          owner_user_id?: string | null
          primary_thesis_id?: string | null
          recommended_next_action?: string | null
          related_meg_entities?: string[]
          status?: Database["public"]["Enums"]["oracle_opportunity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          affected_domains?: string[]
          buyer_or_beneficiary?: string | null
          confidence?: number | null
          contradiction_flags?: Json
          created_at?: string
          description?: string | null
          economic_value_basis?: string | null
          economic_value_estimate?: number | null
          evidence_pack_ref?: Json
          id?: string
          metadata?: Json
          outcome_closed_at?: string | null
          outcome_learnings?: string | null
          outcome_revenue?: number | null
          outcome_status?: string | null
          owner_user_id?: string | null
          primary_thesis_id?: string | null
          recommended_next_action?: string | null
          related_meg_entities?: string[]
          status?: Database["public"]["Enums"]["oracle_opportunity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oracle_opportunities_primary_thesis_id_fkey"
            columns: ["primary_thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_briefings_read_model"
            referencedColumns: ["thesis_id"]
          },
          {
            foreignKeyName: "oracle_opportunities_primary_thesis_id_fkey"
            columns: ["primary_thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
        ]
      }
      oracle_opportunity_transitions: {
        Row: {
          from_status: string | null
          id: string
          opportunity_id: string
          rationale: string | null
          to_status: string
          transitioned_at: string
          transitioned_by: string | null
        }
        Insert: {
          from_status?: string | null
          id?: string
          opportunity_id: string
          rationale?: string | null
          to_status: string
          transitioned_at?: string
          transitioned_by?: string | null
        }
        Update: {
          from_status?: string | null
          id?: string
          opportunity_id?: string
          rationale?: string | null
          to_status?: string
          transitioned_at?: string
          transitioned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oracle_opportunity_transitions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "oracle_opportunities"
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
            referencedRelation: "oracle_briefings_read_model"
            referencedColumns: ["thesis_id"]
          },
          {
            foreignKeyName: "oracle_outcomes_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "oracle_theses"
            referencedColumns: ["id"]
          },
        ]
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
      oracle_publication_events: {
        Row: {
          created_at: string
          decided_at: string
          decided_by: string
          from_state:
            | Database["public"]["Enums"]["oracle_publication_state"]
            | null
          id: string
          metadata: Json
          notes: string | null
          target_id: string
          target_type: string
          to_state: Database["public"]["Enums"]["oracle_publication_state"]
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decided_by: string
          from_state?:
            | Database["public"]["Enums"]["oracle_publication_state"]
            | null
          id?: string
          metadata?: Json
          notes?: string | null
          target_id: string
          target_type: string
          to_state: Database["public"]["Enums"]["oracle_publication_state"]
        }
        Update: {
          created_at?: string
          decided_at?: string
          decided_by?: string
          from_state?:
            | Database["public"]["Enums"]["oracle_publication_state"]
            | null
          id?: string
          metadata?: Json
          notes?: string | null
          target_id?: string
          target_type?: string
          to_state?: Database["public"]["Enums"]["oracle_publication_state"]
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
            referencedRelation: "oracle_briefings_read_model"
            referencedColumns: ["thesis_id"]
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
            referencedRelation: "oracle_briefings_read_model"
            referencedColumns: ["thesis_id"]
          },
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
            referencedRelation: "oracle_briefings_read_model"
            referencedColumns: ["thesis_id"]
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
            referencedRelation: "oracle_briefings_read_model"
            referencedColumns: ["thesis_id"]
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
            referencedRelation: "oracle_briefings_read_model"
            referencedColumns: ["thesis_id"]
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
          meg_event_entity_id: string | null
          photo_url: string
          retreat_year_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          meg_event_entity_id?: string | null
          photo_url: string
          retreat_year_id: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          meg_event_entity_id?: string | null
          photo_url?: string
          retreat_year_id?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_feed_items: {
        Row: {
          actor_meg_entity_id: string | null
          attempt_count: number
          confidence: number | null
          contract_version: string
          error: string | null
          event_time: string
          evidence_item_id: string | null
          id: string
          ingest_run_id: string | null
          ingested_at: string
          next_retry_at: string | null
          payload: Json
          privacy_level: string
          processed_at: string | null
          processing_status: string
          provenance: Json
          related_entity_ids: string[]
          routing_targets: string[]
          source_event_type: string
          source_repo: string
          source_signal_key: string
          source_system: string
          summary: string
          thesis_ids: string[]
        }
        Insert: {
          actor_meg_entity_id?: string | null
          attempt_count?: number
          confidence?: number | null
          contract_version: string
          error?: string | null
          event_time: string
          evidence_item_id?: string | null
          id?: string
          ingest_run_id?: string | null
          ingested_at?: string
          next_retry_at?: string | null
          payload: Json
          privacy_level: string
          processed_at?: string | null
          processing_status?: string
          provenance?: Json
          related_entity_ids?: string[]
          routing_targets?: string[]
          source_event_type: string
          source_repo: string
          source_signal_key: string
          source_system: string
          summary: string
          thesis_ids?: string[]
        }
        Update: {
          actor_meg_entity_id?: string | null
          attempt_count?: number
          confidence?: number | null
          contract_version?: string
          error?: string | null
          event_time?: string
          evidence_item_id?: string | null
          id?: string
          ingest_run_id?: string | null
          ingested_at?: string
          next_retry_at?: string | null
          payload?: Json
          privacy_level?: string
          processed_at?: string | null
          processing_status?: string
          provenance?: Json
          related_entity_ids?: string[]
          routing_targets?: string[]
          source_event_type?: string
          source_repo?: string
          source_signal_key?: string
          source_system?: string
          summary?: string
          thesis_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "platform_feed_items_actor_meg_entity_id_fkey"
            columns: ["actor_meg_entity_id"]
            isOneToOne: false
            referencedRelation: "meg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_feed_items_evidence_item_id_fkey"
            columns: ["evidence_item_id"]
            isOneToOne: false
            referencedRelation: "oracle_evidence_items"
            referencedColumns: ["id"]
          },
        ]
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
          affiliation: string | null
          avatar_url: string | null
          bio: string | null
          company: string | null
          created_at: string
          display_name: string | null
          id: string
          links: Json
          meg_entity_id: string | null
          preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliation?: string | null
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          links?: Json
          meg_entity_id?: string | null
          preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliation?: string | null
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          links?: Json
          meg_entity_id?: string | null
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
      publication_audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["publication_status"] | null
          id: string
          note: string | null
          publication_id: string
          to_status: Database["public"]["Enums"]["publication_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["publication_status"] | null
          id?: string
          note?: string | null
          publication_id: string
          to_status: Database["public"]["Enums"]["publication_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["publication_status"] | null
          id?: string
          note?: string | null
          publication_id?: string
          to_status?: Database["public"]["Enums"]["publication_status"]
        }
        Relationships: [
          {
            foreignKeyName: "publication_audit_log_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_authors: {
        Row: {
          author_role: Database["public"]["Enums"]["publication_author_role"]
          created_at: string
          id: string
          ordinal: number
          profile_id: string
          publication_id: string
        }
        Insert: {
          author_role?: Database["public"]["Enums"]["publication_author_role"]
          created_at?: string
          id?: string
          ordinal?: number
          profile_id: string
          publication_id: string
        }
        Update: {
          author_role?: Database["public"]["Enums"]["publication_author_role"]
          created_at?: string
          id?: string
          ordinal?: number
          profile_id?: string
          publication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_authors_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_citations: {
        Row: {
          accessed_at: string | null
          citation_text: string
          created_at: string
          doi: string | null
          evidence_item_id: string | null
          id: string
          ordinal: number
          publication_id: string
          source_url: string | null
        }
        Insert: {
          accessed_at?: string | null
          citation_text: string
          created_at?: string
          doi?: string | null
          evidence_item_id?: string | null
          id?: string
          ordinal?: number
          publication_id: string
          source_url?: string | null
        }
        Update: {
          accessed_at?: string | null
          citation_text?: string
          created_at?: string
          doi?: string | null
          evidence_item_id?: string | null
          id?: string
          ordinal?: number
          publication_id?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_citations_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_tags: {
        Row: {
          created_at: string
          id: string
          publication_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          publication_id: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          publication_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_tags_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_versions: {
        Row: {
          body_html: string | null
          body_md: string | null
          changelog: string | null
          created_at: string
          id: string
          publication_id: string
          snapshot_at: string
          snapshot_by: string | null
          version: string
        }
        Insert: {
          body_html?: string | null
          body_md?: string | null
          changelog?: string | null
          created_at?: string
          id?: string
          publication_id: string
          snapshot_at?: string
          snapshot_by?: string | null
          version: string
        }
        Update: {
          body_html?: string | null
          body_md?: string | null
          changelog?: string | null
          created_at?: string
          id?: string
          publication_id?: string
          snapshot_at?: string
          snapshot_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_versions_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          abstract: string | null
          cover_image_path: string | null
          created_at: string
          deck: string | null
          doi: string | null
          domain: Database["public"]["Enums"]["publication_domain"]
          id: string
          lead_author_id: string | null
          license: string
          og_image_path: string | null
          published_at: string | null
          retracted_at: string | null
          slug: string
          status: Database["public"]["Enums"]["publication_status"]
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          abstract?: string | null
          cover_image_path?: string | null
          created_at?: string
          deck?: string | null
          doi?: string | null
          domain: Database["public"]["Enums"]["publication_domain"]
          id?: string
          lead_author_id?: string | null
          license?: string
          og_image_path?: string | null
          published_at?: string | null
          retracted_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["publication_status"]
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          abstract?: string | null
          cover_image_path?: string | null
          created_at?: string
          deck?: string | null
          doi?: string | null
          domain?: Database["public"]["Enums"]["publication_domain"]
          id?: string
          lead_author_id?: string | null
          license?: string
          og_image_path?: string | null
          published_at?: string | null
          retracted_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["publication_status"]
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      qa_questions: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          is_answered: boolean
          meg_event_entity_id: string | null
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
          meg_event_entity_id?: string | null
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
          meg_event_entity_id?: string | null
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
      researchers: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          interviews_completed: number
          name: string
          title: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          interviews_completed?: number
          name: string
          title?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          interviews_completed?: number
          name?: string
          title?: string | null
        }
        Relationships: []
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
          meg_session_entity_id: string | null
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
          meg_session_entity_id?: string | null
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
          meg_session_entity_id?: string | null
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
          meg_entity_id: string | null
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
          meg_entity_id?: string | null
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
          meg_entity_id?: string | null
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
          meg_event_entity_id: string | null
          message: string
          parent_id: string | null
          retreat_year_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meg_event_entity_id?: string | null
          message: string
          parent_id?: string | null
          retreat_year_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meg_event_entity_id?: string | null
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
          meg_document_entity_id: string | null
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
          meg_document_entity_id?: string | null
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
          meg_document_entity_id?: string | null
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
          meg_event_entity_id: string | null
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
          meg_event_entity_id?: string | null
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
          meg_event_entity_id?: string | null
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
      review_decisions: {
        Row: {
          created_at: string
          decided_at: string
          decision: string
          edits: Json | null
          id: string
          notes: string | null
          report_id: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decision: string
          edits?: Json | null
          id?: string
          notes?: string | null
          report_id: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string
          decision?: string
          edits?: Json | null
          id?: string
          notes?: string | null
          report_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_decisions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "validation_reports"
            referencedColumns: ["id"]
          },
        ]
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
          meg_session_entity_id: string | null
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
          meg_session_entity_id?: string | null
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
          meg_session_entity_id?: string | null
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
          meg_event_entity_id: string | null
          retreat_year_id: string
          title: string
          upvotes: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          meg_event_entity_id?: string | null
          retreat_year_id?: string
          title: string
          upvotes?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          meg_event_entity_id?: string | null
          retreat_year_id?: string
          title?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: []
      }
      submission_attachments: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          submission_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          submission_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          submission_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_attachments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "idea_submissions"
            referencedColumns: ["id"]
          },
        ]
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
      synthetic_interviews: {
        Row: {
          alternatives_mentioned: string[]
          created_at: string
          evidence_ids: string[]
          id: string
          interview_source: string
          key_quotes: string[]
          participant_label: string
          participant_profile: string
          run_id: string
          severity_rating: number
          takeaway: string
          willingness_to_pay: string | null
        }
        Insert: {
          alternatives_mentioned?: string[]
          created_at?: string
          evidence_ids?: string[]
          id?: string
          interview_source?: string
          key_quotes?: string[]
          participant_label: string
          participant_profile: string
          run_id: string
          severity_rating?: number
          takeaway: string
          willingness_to_pay?: string | null
        }
        Update: {
          alternatives_mentioned?: string[]
          created_at?: string
          evidence_ids?: string[]
          id?: string
          interview_source?: string
          key_quotes?: string[]
          participant_label?: string
          participant_profile?: string
          run_id?: string
          severity_rating?: number
          takeaway?: string
          willingness_to_pay?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "synthetic_interviews_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
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
      text_origin_feedback: {
        Row: {
          created_at: string
          helpful: string | null
          id: string
          length_bucket: number
          retention_purge_after: string
          score_run_id: string | null
          scores: Json
          source: string
          text_sha256: string
          user_label: string | null
        }
        Insert: {
          created_at?: string
          helpful?: string | null
          id?: string
          length_bucket: number
          retention_purge_after?: string
          score_run_id?: string | null
          scores?: Json
          source?: string
          text_sha256: string
          user_label?: string | null
        }
        Update: {
          created_at?: string
          helpful?: string | null
          id?: string
          length_bucket?: number
          retention_purge_after?: string
          score_run_id?: string | null
          scores?: Json
          source?: string
          text_sha256?: string
          user_label?: string | null
        }
        Relationships: []
      }
      text_origin_reference_profiles: {
        Row: {
          family: string
          id: string
          stats: Json
          updated_at: string
          version: number
        }
        Insert: {
          family: string
          id?: string
          stats?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          family?: string
          id?: string
          stats?: Json
          updated_at?: string
          version?: number
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
      validation_batches: {
        Row: {
          created_at: string
          id: string
          interviews_completed: number
          interviews_target: number
          payment_status: string
          researcher_id: string | null
          sla_deadline: string
          status: string
          stripe_checkout_session_id: string | null
          submission_id: string
        }
        Insert: {
          created_at?: string
          id: string
          interviews_completed?: number
          interviews_target?: number
          payment_status?: string
          researcher_id?: string | null
          sla_deadline: string
          status?: string
          stripe_checkout_session_id?: string | null
          submission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interviews_completed?: number
          interviews_target?: number
          payment_status?: string
          researcher_id?: string | null
          sla_deadline?: string
          status?: string
          stripe_checkout_session_id?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_batches_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_batches_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "idea_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_reports: {
        Row: {
          agent_run_id: string | null
          batch_id: string
          completed_at: string
          confidence: number
          created_at: string
          evidence_count: number
          id: string
          interviews: Json
          is_synthetic: boolean
          model_agreement_pct: number | null
          published_at: string | null
          recommendations: string[]
          researcher_name: string | null
          researcher_title: string | null
          review_status: string
          reviewer_id: string | null
          score: number
          summary: string
          supported_claim_pct: number | null
          themes: Json
          tier: string | null
          verdict: string
        }
        Insert: {
          agent_run_id?: string | null
          batch_id: string
          completed_at?: string
          confidence?: number
          created_at?: string
          evidence_count?: number
          id?: string
          interviews?: Json
          is_synthetic?: boolean
          model_agreement_pct?: number | null
          published_at?: string | null
          recommendations?: string[]
          researcher_name?: string | null
          researcher_title?: string | null
          review_status?: string
          reviewer_id?: string | null
          score?: number
          summary?: string
          supported_claim_pct?: number | null
          themes?: Json
          tier?: string | null
          verdict?: string
        }
        Update: {
          agent_run_id?: string | null
          batch_id?: string
          completed_at?: string
          confidence?: number
          created_at?: string
          evidence_count?: number
          id?: string
          interviews?: Json
          is_synthetic?: boolean
          model_agreement_pct?: number | null
          published_at?: string | null
          recommendations?: string[]
          researcher_name?: string | null
          researcher_title?: string | null
          review_status?: string
          reviewer_id?: string | null
          score?: number
          summary?: string
          supported_claim_pct?: number | null
          themes?: Json
          tier?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_reports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "validation_batches"
            referencedColumns: ["id"]
          },
        ]
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
      eigen_policy_rule_history_read_model: {
        Row: {
          action: string | null
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          correlation_id: string | null
          current_capability_tag_pattern: string | null
          current_effect: string | null
          current_is_active: boolean | null
          current_policy_tag: string | null
          current_required_role:
            | Database["public"]["Enums"]["charter_role"]
            | null
          current_superseded_by: string | null
          current_version: number | null
          event_id: string | null
          event_metadata: Json | null
          event_rationale: string | null
          occurred_at: string | null
          rule_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eigen_policy_rule_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eigen_policy_rule_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules_active_read_model"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eigen_policy_rules_superseded_by_fkey"
            columns: ["current_superseded_by"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eigen_policy_rules_superseded_by_fkey"
            columns: ["current_superseded_by"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules_active_read_model"
            referencedColumns: ["id"]
          },
        ]
      }
      eigen_policy_rules_active_read_model: {
        Row: {
          capability_tag_pattern: string | null
          created_at: string | null
          effect: string | null
          id: string | null
          metadata: Json | null
          policy_tag: string | null
          rationale: string | null
          required_role: Database["public"]["Enums"]["charter_role"] | null
          superseded_by: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          capability_tag_pattern?: string | null
          created_at?: string | null
          effect?: string | null
          id?: string | null
          metadata?: Json | null
          policy_tag?: string | null
          rationale?: string | null
          required_role?: Database["public"]["Enums"]["charter_role"] | null
          superseded_by?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          capability_tag_pattern?: string | null
          created_at?: string | null
          effect?: string | null
          id?: string | null
          metadata?: Json | null
          policy_tag?: string | null
          rationale?: string | null
          required_role?: Database["public"]["Enums"]["charter_role"] | null
          superseded_by?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eigen_policy_rules_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eigen_policy_rules_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "eigen_policy_rules_active_read_model"
            referencedColumns: ["id"]
          },
        ]
      }
      generational_brand_index: {
        Row: {
          atlas_page_count: number | null
          atlas_pages_portfolio_total: number | null
          canonical_entity_id: string | null
          charter_entity_id: string | null
          charter_entity_name: string | null
          charter_entity_type: string | null
          charter_metadata: Json | null
          document_counts_by_source_system: Json | null
          documents_active_total: number | null
          persona_chunk_count_placeholder: number | null
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
        Insert: {
          confidence?: number | null
          evidence_strength?: number | null
          published_at?: string | null
          published_by?: string | null
          thesis_id?: string | null
          thesis_statement?: string | null
          title?: string | null
          topic_tags?: never
        }
        Update: {
          confidence?: number | null
          evidence_strength?: number | null
          published_at?: string | null
          published_by?: string | null
          thesis_id?: string | null
          thesis_statement?: string | null
          title?: string | null
          topic_tags?: never
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
      v_agent_authority_surface: {
        Row: {
          agent_name: string | null
          agent_type: string | null
          allowed_actions: Json | null
          authority_level: string | null
          created_at: string | null
          display_code: string | null
          id: string | null
          is_revoked: boolean | null
          prohibited_actions: Json | null
          requires_human_approval: boolean | null
          revoked_at: string | null
          scope_summary: string | null
          status:
            | Database["public"]["Enums"]["continuity_agent_charter_status"]
            | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_name?: string | null
          agent_type?: string | null
          allowed_actions?: Json | null
          authority_level?: never
          created_at?: string | null
          display_code?: string | null
          id?: string | null
          is_revoked?: never
          prohibited_actions?: Json | null
          requires_human_approval?: boolean | null
          revoked_at?: string | null
          scope_summary?: never
          status?:
            | Database["public"]["Enums"]["continuity_agent_charter_status"]
            | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_name?: string | null
          agent_type?: string | null
          allowed_actions?: Json | null
          authority_level?: never
          created_at?: string | null
          display_code?: string | null
          id?: string | null
          is_revoked?: never
          prohibited_actions?: Json | null
          requires_human_approval?: boolean | null
          revoked_at?: string | null
          scope_summary?: never
          status?:
            | Database["public"]["Enums"]["continuity_agent_charter_status"]
            | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_agent_charters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_agent_charters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      v_context_assets_registry: {
        Row: {
          ai_access_policy:
            | Database["public"]["Enums"]["continuity_ai_access_policy"]
            | null
          claim_count: number | null
          confidence_band:
            | Database["public"]["Enums"]["continuity_confidence_band"]
            | null
          confidence_score: number | null
          context_type: string | null
          continuity_risk_level: string | null
          contradiction_link_count: number | null
          contradiction_open_count: number | null
          created_at: string | null
          created_by: string | null
          custodian_external_ref: string | null
          custodian_label: string | null
          description: string | null
          display_code: string | null
          economic_relevance_score: number | null
          evidence_link_count: number | null
          freshness_score: number | null
          governance_status:
            | Database["public"]["Enums"]["continuity_governance_status"]
            | null
          id: string | null
          metadata: Json | null
          owner_external_ref: string | null
          owner_label: string | null
          sensitivity_level: string | null
          source_record_id: string | null
          source_system: string | null
          title: string | null
          uniqueness_score: number | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_context_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_context_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      v_continuity_claims_surface: {
        Row: {
          asset_display_code: string | null
          claim_type: string | null
          confidence: number | null
          context_asset_id: string | null
          created_at: string | null
          evidence_link_count: number | null
          id: string | null
          metadata: Json | null
          sensitivity_level: string | null
          signal_idempotency_key: string | null
          signal_item_id: string | null
          signal_summary: string | null
          statement: string | null
          status: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_claims_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "continuity_context_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "v_context_assets_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_signal_item_id_fkey"
            columns: ["signal_item_id"]
            isOneToOne: false
            referencedRelation: "continuity_signal_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_signal_item_id_fkey"
            columns: ["signal_item_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_signal_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_claims_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      v_continuity_dashboard_summary: {
        Row: {
          active_charter_count: number | null
          agent_action_count: number | null
          claim_count: number | null
          context_asset_count: number | null
          evidence_link_count: number | null
          evidence_source_count: number | null
          friction_surface_count: number | null
          governance_event_count: number | null
          last_signal_item_at: string | null
          live_channel_count: number | null
          signal_item_count: number | null
          workspace_id: string | null
        }
        Insert: {
          active_charter_count?: never
          agent_action_count?: never
          claim_count?: never
          context_asset_count?: never
          evidence_link_count?: never
          evidence_source_count?: never
          friction_surface_count?: never
          governance_event_count?: never
          last_signal_item_at?: never
          live_channel_count?: never
          signal_item_count?: never
          workspace_id?: string | null
        }
        Update: {
          active_charter_count?: never
          agent_action_count?: never
          claim_count?: never
          context_asset_count?: never
          evidence_link_count?: never
          evidence_source_count?: never
          friction_surface_count?: never
          governance_event_count?: never
          last_signal_item_at?: never
          live_channel_count?: never
          signal_item_count?: never
          workspace_id?: string | null
        }
        Relationships: []
      }
      v_continuity_signal_feed: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string | null
          ingest_run_id: string | null
          ingest_run_status:
            | Database["public"]["Enums"]["continuity_ingest_run_status"]
            | null
          ingest_started_at: string | null
          processed_at: string | null
          processing_status:
            | Database["public"]["Enums"]["continuity_signal_processing_status"]
            | null
          sensitivity_level: string | null
          signal_type: string | null
          source_event_type: string | null
          source_record_id: string | null
          source_system: string | null
          summary: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_signal_items_ingest_run_id_fkey"
            columns: ["ingest_run_id"]
            isOneToOne: false
            referencedRelation: "continuity_ingest_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_signal_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_signal_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      v_evidence_integrity_rail: {
        Row: {
          asset_display_code: string | null
          claim_id: string | null
          context_asset_id: string | null
          contradiction_state: string | null
          created_at: string | null
          evidence_source_id: string | null
          evidence_source_label: string | null
          evidence_summary: string | null
          freshness_band: string | null
          governed_claim_statement: string | null
          governed_claim_status: string | null
          id: string | null
          missing_proof_item: string | null
          provenance_status: string | null
          review_posture: string | null
          source_authority: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_evidence_links_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "continuity_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_claims_surface"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "continuity_context_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_context_asset_id_fkey"
            columns: ["context_asset_id"]
            isOneToOne: false
            referencedRelation: "v_context_assets_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_evidence_source_id_fkey"
            columns: ["evidence_source_id"]
            isOneToOne: false
            referencedRelation: "continuity_evidence_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_evidence_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      v_friction_collapse_watchlist: {
        Row: {
          agent_capability_required: string | null
          agent_vector: string | null
          compression_probability: number | null
          created_at: string | null
          created_by: string | null
          current_agent_readiness: string | null
          defensible_context_assets: Json | null
          exposure_score: number | null
          friction_dependency_score: number | null
          human_friction_type: string | null
          id: string | null
          industry: string | null
          metadata: Json | null
          recommended_actions: Json | null
          regulatory_brakes: string | null
          revenue_pool: string | null
          status: string | null
          target_external_ref: string | null
          target_label: string | null
          time_horizon: string | null
          trend: string | null
          updated_at: string | null
          workflow: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_capability_required?: string | null
          agent_vector?: string | null
          compression_probability?: number | null
          created_at?: string | null
          created_by?: string | null
          current_agent_readiness?: string | null
          defensible_context_assets?: Json | null
          exposure_score?: number | null
          friction_dependency_score?: number | null
          human_friction_type?: string | null
          id?: string | null
          industry?: string | null
          metadata?: Json | null
          recommended_actions?: Json | null
          regulatory_brakes?: string | null
          revenue_pool?: string | null
          status?: string | null
          target_external_ref?: string | null
          target_label?: string | null
          time_horizon?: string | null
          trend?: string | null
          updated_at?: string | null
          workflow?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_capability_required?: string | null
          agent_vector?: string | null
          compression_probability?: number | null
          created_at?: string | null
          created_by?: string | null
          current_agent_readiness?: string | null
          defensible_context_assets?: Json | null
          exposure_score?: number | null
          friction_dependency_score?: number | null
          human_friction_type?: string | null
          id?: string | null
          industry?: string | null
          metadata?: Json | null
          recommended_actions?: Json | null
          regulatory_brakes?: string | null
          revenue_pool?: string | null
          status?: string | null
          target_external_ref?: string | null
          target_label?: string | null
          time_horizon?: string | null
          trend?: string | null
          updated_at?: string | null
          workflow?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_friction_surfaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_friction_surfaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      v_governance_timeline: {
        Row: {
          actor: string | null
          audit_hash: string | null
          band: string | null
          detail: string | null
          event_type: string | null
          headline: string | null
          id: string | null
          previous_hash: string | null
          severity: string | null
          ts: string | null
          workspace_id: string | null
        }
        Insert: {
          actor?: never
          audit_hash?: string | null
          band?: never
          detail?: never
          event_type?: string | null
          headline?: never
          id?: string | null
          previous_hash?: string | null
          severity?: string | null
          ts?: string | null
          workspace_id?: string | null
        }
        Update: {
          actor?: never
          audit_hash?: string | null
          band?: never
          detail?: never
          event_type?: string | null
          headline?: never
          id?: string | null
          previous_hash?: string | null
          severity?: string | null
          ts?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_governance_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_governance_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      v_signal_channel_map: {
        Row: {
          channel_label: string | null
          created_at: string | null
          created_by: string | null
          destination_system: string | null
          from_custodian: string | null
          id: string | null
          integrity_band:
            | Database["public"]["Enums"]["continuity_confidence_band"]
            | null
          integrity_score: number | null
          last_handshake_at: string | null
          last_ingest_completed_at: string | null
          last_ingest_rows_accepted: number | null
          last_ingest_rows_rejected: number | null
          last_ingest_run_id: string | null
          last_ingest_status:
            | Database["public"]["Enums"]["continuity_ingest_run_status"]
            | null
          metadata: Json | null
          policy_scope: Json | null
          signal_type: string | null
          source_system: string | null
          state:
            | Database["public"]["Enums"]["continuity_signal_channel_state"]
            | null
          throughput_score: number | null
          to_custodian: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_signal_channels_last_ingest_run_id_fkey"
            columns: ["last_ingest_run_id"]
            isOneToOne: false
            referencedRelation: "continuity_ingest_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_signal_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_signal_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      v_underwriting_history: {
        Row: {
          agent_authority_risks: Json | null
          completed_at: string | null
          component_scores: Json | null
          context_asset_recommendations: Json | null
          created_at: string | null
          created_by: string | null
          evidence_gaps: Json | null
          friction_risks: Json | null
          id: string | null
          oracle_opportunity_candidates: Json | null
          recommended_actions: Json | null
          risk_level: string | null
          score: number | null
          score_band: string | null
          status: string | null
          summary: string | null
          target_external_ref: string | null
          target_label: string | null
          target_type: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_authority_risks?: Json | null
          completed_at?: string | null
          component_scores?: Json | null
          context_asset_recommendations?: Json | null
          created_at?: string | null
          created_by?: string | null
          evidence_gaps?: Json | null
          friction_risks?: Json | null
          id?: string | null
          oracle_opportunity_candidates?: Json | null
          recommended_actions?: Json | null
          risk_level?: string | null
          score?: number | null
          score_band?: string | null
          status?: string | null
          summary?: string | null
          target_external_ref?: string | null
          target_label?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_authority_risks?: Json | null
          completed_at?: string | null
          component_scores?: Json | null
          context_asset_recommendations?: Json | null
          created_at?: string | null
          created_by?: string | null
          evidence_gaps?: Json | null
          friction_risks?: Json | null
          id?: string | null
          oracle_opportunity_candidates?: Json | null
          recommended_actions?: Json | null
          risk_level?: string | null
          score?: number | null
          score_band?: string | null
          status?: string | null
          summary?: string | null
          target_external_ref?: string | null
          target_label?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_underwriting_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "continuity_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuity_underwriting_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_continuity_dashboard_summary"
            referencedColumns: ["workspace_id"]
          },
        ]
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
      botos_assert_capability: {
        Args: {
          p_action: string
          p_agent_id: string
          p_capability_id: string
          p_policy_scope: string
        }
        Returns: boolean
      }
      botos_claim_next_bot_task: {
        Args: { p_worker_id: string }
        Returns: {
          action: string
          agent_id: string
          attempts: number
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          policy_scope: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "botos_bot_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      bump_agent_run_totals: {
        Args: { p_cost_usd?: number; p_run_id: string; p_tokens?: number }
        Returns: undefined
      }
      bump_eigen_public_rate: {
        Args: { p_bucket_key: string; p_window_start?: string }
        Returns: number
      }
      can_access_area: {
        Args: { _area: string; _user_id: string }
        Returns: boolean
      }
      can_edit_publication: {
        Args: { _publication_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_centralr2: { Args: { _user_id: string }; Returns: boolean }
      can_read_publication: {
        Args: { _publication_id: string; _user_id: string }
        Returns: boolean
      }
      claim_operator_proposals_for_review: {
        Args: { p_limit?: number }
        Returns: {
          actor_meg_entity_id: string | null
          alternatives: Json
          confidence: number | null
          cross_brand_count: number
          downstream_run_id: string | null
          drafted_at: string
          drafter: string
          drafter_run_id: string | null
          estimated_reversal_cost: string | null
          evidence_chunk_ids: string[]
          evidence_item_ids: string[]
          executed_at: string | null
          execution_error: string | null
          execution_started_at: string | null
          expires_at: string | null
          id: string
          modified_actions: Json | null
          privacy_level: string
          proposal_kind: string
          proposed_actions: Json
          rationale: string
          related_entity_ids: string[]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_systems: string[]
          status: string
          title: string
          triggering_signal_ids: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "operator_proposals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_platform_feed_items: {
        Args: { p_limit?: number }
        Returns: {
          actor_meg_entity_id: string | null
          attempt_count: number
          confidence: number | null
          contract_version: string
          error: string | null
          event_time: string
          evidence_item_id: string | null
          id: string
          ingest_run_id: string | null
          ingested_at: string
          next_retry_at: string | null
          payload: Json
          privacy_level: string
          processed_at: string | null
          processing_status: string
          provenance: Json
          related_entity_ids: string[]
          routing_targets: string[]
          source_event_type: string
          source_repo: string
          source_signal_key: string
          source_system: string
          summary: string
          thesis_ids: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_feed_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      continuity_is_admin: { Args: never; Returns: boolean }
      decide_operator_proposal: {
        Args: {
          p_decision: string
          p_modified_actions?: Json
          p_notes?: string
          p_proposal_id: string
          p_reviewer_id: string
        }
        Returns: {
          actor_meg_entity_id: string | null
          alternatives: Json
          confidence: number | null
          cross_brand_count: number
          downstream_run_id: string | null
          drafted_at: string
          drafter: string
          drafter_run_id: string | null
          estimated_reversal_cost: string | null
          evidence_chunk_ids: string[]
          evidence_item_ids: string[]
          executed_at: string | null
          execution_error: string | null
          execution_started_at: string | null
          expires_at: string | null
          id: string
          modified_actions: Json | null
          privacy_level: string
          proposal_kind: string
          proposed_actions: Json
          rationale: string
          related_entity_ids: string[]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_systems: string[]
          status: string
          title: string
          triggering_signal_ids: string[]
        }
        SetofOptions: {
          from: "*"
          to: "operator_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dispatch_embedding_jobs: { Args: never; Returns: undefined }
      enqueue_platform_feed_processing: {
        Args: { signal_id: string }
        Returns: undefined
      }
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
      expire_stale_operator_proposals: { Args: never; Returns: number }
      get_public_batch_view: { Args: { p_batch_id: string }; Returns: Json }
      has_charter_access: { Args: { _user_id: string }; Returns: boolean }
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
      is_active_operator: { Args: { _uid: string }; Returns: boolean }
      is_assigned_to_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      is_publications_editor: { Args: { _user_id: string }; Returns: boolean }
      is_publications_staff: { Args: { _user_id: string }; Returns: boolean }
      is_works_admin: { Args: { _uid: string }; Returns: boolean }
      match_knowledge_chunks: {
        Args: {
          ann_limit: number
          filter_document_tag_match?: string
          filter_document_tags?: string[]
          filter_entity_ids?: string[]
          filter_policy_tags?: string[]
          query_embedding: number[]
          valid_at?: string
        }
        Returns: Json
      }
      meg_catalog_to_meg_entity_type: {
        Args: { p_catalog: string }
        Returns: Database["public"]["Enums"]["meg_entity_type"]
      }
      meg_entity_full_context: {
        Args: { p_meg_entity_id: string }
        Returns: Json
      }
      meg_link_entities: {
        Args: {
          p_edge_type: Database["public"]["Enums"]["meg_edge_type"]
          p_metadata?: Json
          p_source_entity_id: string
          p_target_entity_id: string
        }
        Returns: undefined
      }
      meg_resolve_or_create: {
        Args: {
          p_canonical_email?: string
          p_canonical_external_id?: string
          p_canonical_name: string
          p_entity_type: string
          p_payload?: Json
          p_source_row_id?: string
          p_source_system?: string
          p_source_table?: string
        }
        Returns: string
      }
      meg_upsert_person_attendee_sidecar: {
        Args: { p_entity_id: string; p_payload: Json; p_source_system: string }
        Returns: undefined
      }
      meg_upsert_thesis_sidecar: {
        Args: { p_entity_id: string; p_payload: Json; p_source_system: string }
        Returns: undefined
      }
      pgmq_delete: {
        Args: { msg_id: number; queue_name: string }
        Returns: boolean
      }
      provenance_chain: {
        Args: {
          p_max_depth?: number
          p_max_nodes?: number
          p_target_id: string
          p_target_kind: string
        }
        Returns: Json
      }
      replay_platform_feed_item: {
        Args: { p_feed_item_id: string }
        Returns: undefined
      }
      schedule_generate_thought_piece_cron: { Args: never; Returns: string }
      sign: {
        Args: { algorithm?: string; payload: Json; secret: string }
        Returns: string
      }
      toggle_session_request_upvote: {
        Args: { p_request_id: string; p_user_id: string }
        Returns: undefined
      }
      truth_market_promote: {
        Args: {
          p_affected_domains?: string[]
          p_contradiction_summary?: Json
          p_description?: string
          p_governance_requirements?: Json
          p_institution_gap_summary: string
          p_metadata?: Json
          p_oracle_evidence_item_ids?: string[]
          p_owner_user_id?: string
          p_platform_feed_item_ids?: string[]
          p_primary_thesis_id?: string
          p_proof_plan?: Json
          p_source_system?: string
          p_title: string
        }
        Returns: Json
      }
      truth_market_promote_feed_cluster: {
        Args: {
          p_limit?: number
          p_owner_user_id?: string
          p_source_system: string
          p_title?: string
        }
        Returns: Json
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
      app_role:
        | "admin"
        | "analyst"
        | "viewer"
        | "reviewer"
        | "reader"
        | "contributor"
        | "editor"
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
      atlas_crawl_source: "sitemap" | "html"
      atlas_crawl_status: "running" | "completed" | "failed"
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
      continuity_agent_charter_status:
        | "draft"
        | "active"
        | "suspended"
        | "revoked"
        | "expired"
        | "archived"
      continuity_ai_access_policy:
        | "no_ai_access"
        | "summaries_only"
        | "retrieval_allowed"
        | "agent_action_allowed"
        | "public_safe"
        | "sealed"
      continuity_confidence_band: "high" | "mid" | "low"
      continuity_governance_status:
        | "draft"
        | "active"
        | "under_review"
        | "sealed"
        | "revoked"
        | "archived"
      continuity_ingest_run_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      continuity_signal_channel_state:
        | "planned"
        | "live"
        | "degraded"
        | "sealed"
        | "disabled"
      continuity_signal_processing_status:
        | "received"
        | "normalized"
        | "promoted"
        | "rejected"
        | "sealed"
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
        | "coffee_pairing"
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
      missing_institution_brief_status:
        | "draft"
        | "review"
        | "published"
        | "archived"
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
      oracle_opportunity_status:
        | "draft"
        | "active"
        | "validate"
        | "won"
        | "lost"
        | "archived"
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
        | "superseded"
        | "successor_of"
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
      publication_author_role: "lead" | "contributor" | "reviewer" | "editor"
      publication_domain: "ip_patent" | "public_health" | "real_estate"
      publication_status: "draft" | "in_review" | "published" | "retracted"
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
      app_role: [
        "admin",
        "analyst",
        "viewer",
        "reviewer",
        "reader",
        "contributor",
        "editor",
      ],
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
      atlas_crawl_source: ["sitemap", "html"],
      atlas_crawl_status: ["running", "completed", "failed"],
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
      continuity_agent_charter_status: [
        "draft",
        "active",
        "suspended",
        "revoked",
        "expired",
        "archived",
      ],
      continuity_ai_access_policy: [
        "no_ai_access",
        "summaries_only",
        "retrieval_allowed",
        "agent_action_allowed",
        "public_safe",
        "sealed",
      ],
      continuity_confidence_band: ["high", "mid", "low"],
      continuity_governance_status: [
        "draft",
        "active",
        "under_review",
        "sealed",
        "revoked",
        "archived",
      ],
      continuity_ingest_run_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      continuity_signal_channel_state: [
        "planned",
        "live",
        "degraded",
        "sealed",
        "disabled",
      ],
      continuity_signal_processing_status: [
        "received",
        "normalized",
        "promoted",
        "rejected",
        "sealed",
      ],
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
        "coffee_pairing",
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
      missing_institution_brief_status: [
        "draft",
        "review",
        "published",
        "archived",
      ],
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
      oracle_opportunity_status: [
        "draft",
        "active",
        "validate",
        "won",
        "lost",
        "archived",
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
        "superseded",
        "successor_of",
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
      publication_author_role: ["lead", "contributor", "reviewer", "editor"],
      publication_domain: ["ip_patent", "public_health", "real_estate"],
      publication_status: ["draft", "in_review", "published", "retracted"],
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
