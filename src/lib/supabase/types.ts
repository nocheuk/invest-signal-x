import type { Json } from "./utility-types";

export type Database = {
  public: {
    Tables: {
      deals: {
        Row: {
          id: string;
          title: string;
          location: string;
          region: string;
          asset_type: string;
          source: string;
          guide_price: number;
          passing_rent: number;
          sqft: number;
          gross_yield: number;
          net_initial_yield: number;
          reversionary_yield: number;
          wault: number;
          lease_length: number;
          tenant: string;
          covenant_strength: string;
          tenant_health_score: number;
          rent_sustainability: string;
          rent_review: string;
          price_per_sqft: number;
          planning_upside_score: number;
          void_risk_score: number;
          exit_yield_sensitivity: string;
          cashflow_after_debt: number;
          return_on_equity: number;
          auction_guide_risk: string | null;
          red_flags: string[];
          main_risk_flag: string;
          score: number;
          rating: string;
          score_breakdown: Json;
          insights: Json;
          thumbnail: string;
          posted_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["deals"]["Row"]> & { id: string; title: string };
        Update: Partial<Database["public"]["Tables"]["deals"]["Row"]>;
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          company: string | null;
          preferences: Json;
          alert_preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; full_name?: string | null; company?: string | null; preferences?: Json; alert_preferences?: Json };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      strategies: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          preset: string;
          weights: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; user_id: string; name: string; preset: string; weights: Json; is_active?: boolean };
        Update: Partial<Omit<Database["public"]["Tables"]["strategies"]["Insert"], "user_id">>;
      };
      watchlists: {
        Row: { id: string; user_id: string; name: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name?: string };
        Update: Partial<Database["public"]["Tables"]["watchlists"]["Insert"]>;
      };
      watchlist_items: {
        Row: { id: string; watchlist_id: string; user_id: string; deal_id: string; status: string; notes: string; next_action_date: string | null; assigned_owner: string; created_at: string; updated_at: string };
        Insert: { id?: string; watchlist_id: string; user_id: string; deal_id: string; status?: string; notes?: string; next_action_date?: string | null; assigned_owner?: string };
        Update: Partial<Database["public"]["Tables"]["watchlist_items"]["Insert"]>;
      };
      watchlist_stage_history: {
        Row: { id: string; user_id: string; deal_id: string; old_stage: string | null; new_stage: string; changed_at: string };
        Insert: { id?: string; user_id: string; deal_id: string; old_stage?: string | null; new_stage: string; changed_at?: string };
        Update: Partial<Database["public"]["Tables"]["watchlist_stage_history"]["Insert"]>;
      };
      watchlist_notes: {
        Row: { id: string; watchlist_id: string; deal_id: string; note: string; created_at: string; updated_at: string };
        Insert: { id?: string; watchlist_id: string; deal_id: string; note: string };
        Update: Partial<Database["public"]["Tables"]["watchlist_notes"]["Insert"]>;
      };
      saved_searches: {
        Row: { id: string; user_id: string; name: string; filters: Json; alert_enabled: boolean; alert_frequency: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name: string; filters?: Json; alert_enabled?: boolean; alert_frequency?: string };
        Update: Partial<Database["public"]["Tables"]["saved_searches"]["Insert"]>;
      };
      acquisition_briefs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          strategy_mode: string;
          regions: string[];
          budget_min: number;
          budget_max: number;
          asset_types: string[];
          yield_min: number;
          floor_area_min: number;
          floor_area_max: number;
          keywords_preferred: string[];
          keywords_excluded: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          strategy_mode?: string;
          regions?: string[];
          budget_min?: number;
          budget_max?: number;
          asset_types?: string[];
          yield_min?: number;
          floor_area_min?: number;
          floor_area_max?: number;
          keywords_preferred?: string[];
          keywords_excluded?: string[];
          is_active?: boolean;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["acquisition_briefs"]["Insert"], "user_id">>;
      };
      saved_alerts: {
        Row: { id: string; user_id: string; name: string; location_query: string; min_yield: number; max_price: number; asset_type: string; min_score: number; enabled: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name: string; location_query?: string; min_yield?: number; max_price?: number; asset_type?: string; min_score?: number; enabled?: boolean };
        Update: Partial<Omit<Database["public"]["Tables"]["saved_alerts"]["Insert"], "user_id">>;
      };
      alert_runs: {
        Row: { id: string; run_date: string; status: string; deals_matched: number; emails_sent: number; metadata: Json; error_message: string | null; started_at: string; finished_at: string | null };
        Insert: { id?: string; run_date?: string; status?: string; deals_matched?: number; emails_sent?: number; metadata?: Json; error_message?: string | null; started_at?: string; finished_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["alert_runs"]["Insert"]>;
      };
      alert_matches: {
        Row: { id: string; alert_run_id: string; alert_id: string; user_id: string; deal_id: string; matched_at: string; email_sent: boolean; email_sent_at: string | null; email_status: string; match_reasons: string[]; payload: Json };
        Insert: { id?: string; alert_run_id: string; alert_id: string; user_id: string; deal_id: string; matched_at?: string; email_sent?: boolean; email_sent_at?: string | null; email_status?: string; match_reasons?: string[]; payload?: Json };
        Update: Partial<Database["public"]["Tables"]["alert_matches"]["Insert"]>;
      };
      import_sources: {
        Row: { id: string; name: string; source_type: string; base_url: string | null; config: Json; is_active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; source_type: string; base_url?: string | null; config?: Json; is_active?: boolean };
        Update: Partial<Database["public"]["Tables"]["import_sources"]["Insert"]>;
      };
      import_runs: {
        Row: { id: string; import_source_id: string | null; status: string; started_at: string; finished_at: string | null; stats: Json; error_message: string | null; created_by: string | null };
        Insert: { id?: string; import_source_id?: string | null; status?: string; started_at?: string; finished_at?: string | null; stats?: Json; error_message?: string | null; created_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["import_runs"]["Insert"]>;
      };
      raw_imports: {
        Row: { id: string; import_run_id: string; external_id: string | null; source_url: string | null; payload: Json; normalized_payload: Json; status: string; error_message: string | null; created_at: string; row_number: number | null; deal_id: string | null; validation_errors: Json; dedupe_key: string | null };
        Insert: { id?: string; import_run_id: string; external_id?: string | null; source_url?: string | null; payload?: Json; normalized_payload?: Json; status?: string; error_message?: string | null; row_number?: number | null; deal_id?: string | null; validation_errors?: Json; dedupe_key?: string | null };
        Update: Partial<Database["public"]["Tables"]["raw_imports"]["Insert"]>;
      };
      deal_source_links: {
        Row: { id: string; deal_id: string; raw_import_id: string | null; import_source_id: string | null; source_url: string | null; confidence: number; created_at: string };
        Insert: { id?: string; deal_id: string; raw_import_id?: string | null; import_source_id?: string | null; source_url?: string | null; confidence?: number };
        Update: Partial<Database["public"]["Tables"]["deal_source_links"]["Insert"]>;
      };
      deal_enrichments: {
        Row: { id: string; deal_id: string; source_url: string | null; status: string; attempt_count: number; last_attempted_at: string | null; next_attempt_at: string | null; last_error: string | null; tenant_name: string | null; passing_rent: number | null; lease_length: number | null; wault: number | null; epc_rating: string | null; sqft: number | null; guide_price: number | null; auction_info: Json; vat_info: string | null; investment_summary: string | null; extracted_payload: Json; created_at: string; updated_at: string };
        Insert: { id?: string; deal_id: string; source_url?: string | null; status?: string; attempt_count?: number; last_attempted_at?: string | null; next_attempt_at?: string | null; last_error?: string | null; tenant_name?: string | null; passing_rent?: number | null; lease_length?: number | null; wault?: number | null; epc_rating?: string | null; sqft?: number | null; guide_price?: number | null; auction_info?: Json; vat_info?: string | null; investment_summary?: string | null; extracted_payload?: Json };
        Update: Partial<Database["public"]["Tables"]["deal_enrichments"]["Insert"]>;
      };
      comparable_transactions: {
        Row: { id: string; deal_id: string | null; title: string; location: string | null; asset_type: string | null; price: number | null; yield_percent: number | null; transaction_date: string | null; evidence_url: string | null; metadata: Json; created_at: string; updated_at: string };
        Insert: { id?: string; deal_id?: string | null; title: string; location?: string | null; asset_type?: string | null; price?: number | null; yield_percent?: number | null; transaction_date?: string | null; evidence_url?: string | null; metadata?: Json };
        Update: Partial<Database["public"]["Tables"]["comparable_transactions"]["Insert"]>;
      };
      national_scan_runs: {
        Row: {
          id: string;
          scan_type: string;
          location_query: string;
          normalized_location: string;
          source_name: string;
          status: string;
          inserted: number;
          existing: number;
          failed: number;
          skipped_duplicate: number;
          skipped_rent_only: number;
          skipped_poa: number;
          result: Json;
          metadata: Json;
          error_message: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: { id?: string; scan_type?: string; location_query: string; normalized_location: string; source_name: string; status?: string; inserted?: number; existing?: number; failed?: number; skipped_duplicate?: number; skipped_rent_only?: number; skipped_poa?: number; result?: Json; metadata?: Json; error_message?: string | null; started_at?: string; finished_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["national_scan_runs"]["Insert"]>;
      };
      user_feedback: {
        Row: { id: string; user_id: string; type: string; message: string; deal_id: string | null; source_url: string | null; current_page: string; metadata: Json; created_at: string };
        Insert: { id?: string; user_id: string; type: string; message: string; deal_id?: string | null; source_url?: string | null; current_page: string; metadata?: Json; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["user_feedback"]["Insert"]>;
      };
      user_events: {
        Row: { id: string; user_id: string; event_type: string; deal_id: string | null; source_url: string | null; current_page: string; metadata: Json; created_at: string };
        Insert: { id?: string; user_id: string; event_type: string; deal_id?: string | null; source_url?: string | null; current_page: string; metadata?: Json; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["user_events"]["Insert"]>;
      };
    };
  };
};
