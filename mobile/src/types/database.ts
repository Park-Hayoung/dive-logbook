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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          payload: Json | null
          target_id: string
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          payload?: Json | null
          target_id: string
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          payload?: Json | null
          target_id?: string
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          password_hash: string
          role: Database["public"]["Enums"]["admin_role"]
          totp_secret: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash: string
          role?: Database["public"]["Enums"]["admin_role"]
          totp_secret: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash?: string
          role?: Database["public"]["Enums"]["admin_role"]
          totp_secret?: string
          updated_at?: string
        }
        Relationships: []
      }
      board_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "board_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          detail: string | null
          id: string
          reason: Database["public"]["Enums"]["board_report_reason"]
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          resolver_note: string | null
          status: Database["public"]["Enums"]["board_report_status"]
        }
        Insert: {
          comment_id: string
          created_at?: string
          detail?: string | null
          id?: string
          reason: Database["public"]["Enums"]["board_report_reason"]
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_note?: string | null
          status?: Database["public"]["Enums"]["board_report_status"]
        }
        Update: {
          comment_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["board_report_reason"]
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_note?: string | null
          status?: Database["public"]["Enums"]["board_report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "board_comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "board_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comment_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comment_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      board_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "board_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_post_media: {
        Row: {
          duration_seconds: number | null
          file_size_bytes: number | null
          height: number | null
          id: string
          kind: string
          original_filename: string | null
          post_id: string
          provider: string | null
          storage_url: string
          thumbnail_url: string | null
          uploaded_at: string
          width: number | null
        }
        Insert: {
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          kind: string
          original_filename?: string | null
          post_id: string
          provider?: string | null
          storage_url: string
          thumbnail_url?: string | null
          uploaded_at?: string
          width?: number | null
        }
        Update: {
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          kind?: string
          original_filename?: string | null
          post_id?: string
          provider?: string | null
          storage_url?: string
          thumbnail_url?: string | null
          uploaded_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "board_post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_post_reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          post_id: string
          reason: Database["public"]["Enums"]["board_report_reason"]
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          resolver_note: string | null
          status: Database["public"]["Enums"]["board_report_status"]
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          post_id: string
          reason: Database["public"]["Enums"]["board_report_reason"]
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_note?: string | null
          status?: Database["public"]["Enums"]["board_report_status"]
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          post_id?: string
          reason?: Database["public"]["Enums"]["board_report_reason"]
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_note?: string | null
          status?: Database["public"]["Enums"]["board_report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "board_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_post_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_post_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      board_posts: {
        Row: {
          author_id: string
          category: Database["public"]["Enums"]["board_category"]
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          category: Database["public"]["Enums"]["board_category"]
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          category?: Database["public"]["Enums"]["board_category"]
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dive_buddies: {
        Row: {
          dive_id: string
          user_id: string
        }
        Insert: {
          dive_id: string
          user_id: string
        }
        Update: {
          dive_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dive_buddies_dive_id_fkey"
            columns: ["dive_id"]
            isOneToOne: false
            referencedRelation: "dives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dive_buddies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dive_equipment: {
        Row: {
          dive_id: string
          equipment_id: string
        }
        Insert: {
          dive_id: string
          equipment_id: string
        }
        Update: {
          dive_id?: string
          equipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dive_equipment_dive_id_fkey"
            columns: ["dive_id"]
            isOneToOne: false
            referencedRelation: "dives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dive_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      dive_gas_mixes: {
        Row: {
          dive_id: string
          he_pct: number
          id: string
          is_diluent: boolean | null
          mix_index: number
          o2_pct: number
        }
        Insert: {
          dive_id: string
          he_pct?: number
          id?: string
          is_diluent?: boolean | null
          mix_index: number
          o2_pct: number
        }
        Update: {
          dive_id?: string
          he_pct?: number
          id?: string
          is_diluent?: boolean | null
          mix_index?: number
          o2_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "dive_gas_mixes_dive_id_fkey"
            columns: ["dive_id"]
            isOneToOne: false
            referencedRelation: "dives"
            referencedColumns: ["id"]
          },
        ]
      }
      dive_media: {
        Row: {
          dive_id: string
          duration_seconds: number | null
          file_size_bytes: number | null
          height: number | null
          id: string
          kind: string
          original_filename: string | null
          provider: string
          storage_url: string
          thumbnail_url: string | null
          uploaded_at: string | null
          width: number | null
        }
        Insert: {
          dive_id: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          kind: string
          original_filename?: string | null
          provider?: string
          storage_url: string
          thumbnail_url?: string | null
          uploaded_at?: string | null
          width?: number | null
        }
        Update: {
          dive_id?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          kind?: string
          original_filename?: string | null
          provider?: string
          storage_url?: string
          thumbnail_url?: string | null
          uploaded_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dive_media_dive_id_fkey"
            columns: ["dive_id"]
            isOneToOne: false
            referencedRelation: "dives"
            referencedColumns: ["id"]
          },
        ]
      }
      dive_samples: {
        Row: {
          cns: number | null
          deco_stop_m: number | null
          depth_m: number
          dive_id: string
          id: string
          ndl_deco_min: number | null
          tank0_bar: number | null
          tank1_bar: number | null
          temp_c: number | null
          time_s: number
          tts_min: number | null
        }
        Insert: {
          cns?: number | null
          deco_stop_m?: number | null
          depth_m: number
          dive_id: string
          id?: string
          ndl_deco_min?: number | null
          tank0_bar?: number | null
          tank1_bar?: number | null
          temp_c?: number | null
          time_s: number
          tts_min?: number | null
        }
        Update: {
          cns?: number | null
          deco_stop_m?: number | null
          depth_m?: number
          dive_id?: string
          id?: string
          ndl_deco_min?: number | null
          tank0_bar?: number | null
          tank1_bar?: number | null
          temp_c?: number | null
          time_s?: number
          tts_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dive_samples_dive_id_fkey"
            columns: ["dive_id"]
            isOneToOne: false
            referencedRelation: "dives"
            referencedColumns: ["id"]
          },
        ]
      }
      dive_schedules: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          point: string | null
          shop_id: string | null
          start_date: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          point?: string | null
          shop_id?: string | null
          start_date: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          point?: string | null
          shop_id?: string | null
          start_date?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dive_schedules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dive_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dive_user_equipment: {
        Row: {
          created_at: string | null
          dive_id: string
          user_equipment_id: string
        }
        Insert: {
          created_at?: string | null
          dive_id: string
          user_equipment_id: string
        }
        Update: {
          created_at?: string | null
          dive_id?: string
          user_equipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dive_user_equipment_dive_id_fkey"
            columns: ["dive_id"]
            isOneToOne: false
            referencedRelation: "dives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dive_user_equipment_user_equipment_id_fkey"
            columns: ["user_equipment_id"]
            isOneToOne: false
            referencedRelation: "user_equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      dives: {
        Row: {
          atmospheric_mbar: number | null
          avg_depth: number | null
          consumption_bar_per_min: number | null
          country: string
          created_at: string | null
          current_strength: string | null
          deco_model: string | null
          device_serial: string | null
          dive_mode: string | null
          dive_number: number
          dive_style: string[] | null
          duration_minutes: number | null
          ended_at: string
          entry_type: string | null
          gf_high: number | null
          gf_low: number | null
          id: string
          is_verified: boolean | null
          lat: number | null
          lng: number | null
          location: string
          max_depth: number
          memo: string | null
          place_id: string | null
          point: string | null
          raw_binary_url: string | null
          sac_l_per_min: number | null
          started_at: string
          surface_interval_min: number | null
          tank_end_bar: number | null
          tank_serial: string | null
          tank_start_bar: number | null
          tank_volume_l: number | null
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
          visibility: number | null
          water_temp: number | null
          water_type: string | null
          weather: Database["public"]["Enums"]["dive_weather"] | null
        }
        Insert: {
          atmospheric_mbar?: number | null
          avg_depth?: number | null
          consumption_bar_per_min?: number | null
          country: string
          created_at?: string | null
          current_strength?: string | null
          deco_model?: string | null
          device_serial?: string | null
          dive_mode?: string | null
          dive_number: number
          dive_style?: string[] | null
          duration_minutes?: number | null
          ended_at: string
          entry_type?: string | null
          gf_high?: number | null
          gf_low?: number | null
          id?: string
          is_verified?: boolean | null
          lat?: number | null
          lng?: number | null
          location: string
          max_depth: number
          memo?: string | null
          place_id?: string | null
          point?: string | null
          raw_binary_url?: string | null
          sac_l_per_min?: number | null
          started_at: string
          surface_interval_min?: number | null
          tank_end_bar?: number | null
          tank_serial?: string | null
          tank_start_bar?: number | null
          tank_volume_l?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: number | null
          water_temp?: number | null
          water_type?: string | null
          weather?: Database["public"]["Enums"]["dive_weather"] | null
        }
        Update: {
          atmospheric_mbar?: number | null
          avg_depth?: number | null
          consumption_bar_per_min?: number | null
          country?: string
          created_at?: string | null
          current_strength?: string | null
          deco_model?: string | null
          device_serial?: string | null
          dive_mode?: string | null
          dive_number?: number
          dive_style?: string[] | null
          duration_minutes?: number | null
          ended_at?: string
          entry_type?: string | null
          gf_high?: number | null
          gf_low?: number | null
          id?: string
          is_verified?: boolean | null
          lat?: number | null
          lng?: number | null
          location?: string
          max_depth?: number
          memo?: string | null
          place_id?: string | null
          point?: string | null
          raw_binary_url?: string | null
          sac_l_per_min?: number | null
          started_at?: string
          surface_interval_min?: number | null
          tank_end_bar?: number | null
          tank_serial?: string | null
          tank_start_bar?: number | null
          tank_volume_l?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: number | null
          water_temp?: number | null
          water_type?: string | null
          weather?: Database["public"]["Enums"]["dive_weather"] | null
        }
        Relationships: [
          {
            foreignKeyName: "dives_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          brand: string
          brand_en: string | null
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          model: string
          source: string | null
        }
        Insert: {
          brand: string
          brand_en?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          model: string
          source?: string | null
        }
        Update: {
          brand?: string
          brand_en?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          model?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_brands: {
        Row: {
          category: string
          created_at: string | null
          id: string
          name: string
          name_en: string | null
          source: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          name: string
          name_en?: string | null
          source?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          name?: string
          name_en?: string | null
          source?: string | null
        }
        Relationships: []
      }
      feed_comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "feed_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          feed_id: string
          id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          feed_id: string
          id?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          feed_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comments_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_likes: {
        Row: {
          created_at: string | null
          feed_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feed_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          feed_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_media: {
        Row: {
          duration_seconds: number | null
          feed_id: string
          file_size_bytes: number | null
          height: number | null
          id: string
          kind: string
          original_filename: string | null
          provider: string | null
          storage_url: string
          thumbnail_url: string | null
          uploaded_at: string | null
          width: number | null
        }
        Insert: {
          duration_seconds?: number | null
          feed_id: string
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          kind: string
          original_filename?: string | null
          provider?: string | null
          storage_url: string
          thumbnail_url?: string | null
          uploaded_at?: string | null
          width?: number | null
        }
        Update: {
          duration_seconds?: number | null
          feed_id?: string
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          kind?: string
          original_filename?: string | null
          provider?: string | null
          storage_url?: string
          thumbnail_url?: string | null
          uploaded_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_media_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reports: {
        Row: {
          created_at: string
          detail: string | null
          feed_id: string
          id: string
          reason: Database["public"]["Enums"]["feed_report_reason"]
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          resolver_note: string | null
          status: Database["public"]["Enums"]["feed_report_status"]
        }
        Insert: {
          created_at?: string
          detail?: string | null
          feed_id: string
          id?: string
          reason: Database["public"]["Enums"]["feed_report_reason"]
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_note?: string | null
          status?: Database["public"]["Enums"]["feed_report_status"]
        }
        Update: {
          created_at?: string
          detail?: string | null
          feed_id?: string
          id?: string
          reason?: Database["public"]["Enums"]["feed_report_reason"]
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_note?: string | null
          status?: Database["public"]["Enums"]["feed_report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "feed_reports_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      feeds: {
        Row: {
          author_id: string
          content: string | null
          created_at: string | null
          id: string
          image_url: string | null
          linked_dive_id: string | null
          location: string | null
          type: Database["public"]["Enums"]["feed_type"]
        }
        Insert: {
          author_id: string
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          linked_dive_id?: string | null
          location?: string | null
          type: Database["public"]["Enums"]["feed_type"]
        }
        Update: {
          author_id?: string
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          linked_dive_id?: string | null
          location?: string | null
          type?: Database["public"]["Enums"]["feed_type"]
        }
        Relationships: [
          {
            foreignKeyName: "feeds_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeds_linked_dive_id_fkey"
            columns: ["linked_dive_id"]
            isOneToOne: false
            referencedRelation: "dives"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places_api_usage: {
        Row: {
          count: number
          day: string
          updated_at: string
        }
        Insert: {
          count?: number
          day: string
          updated_at?: string
        }
        Update: {
          count?: number
          day?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_push_tokens: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          banned_at: string | null
          banned_by: string | null
          banned_reason: string | null
          bio: string | null
          certification: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          diving_org: string | null
          id: string
          is_banned: boolean
          nickname: string
          profile_image_url: string | null
          team_id: string | null
          total_dives_at_signup: number | null
          updated_at: string | null
        }
        Insert: {
          banned_at?: string | null
          banned_by?: string | null
          banned_reason?: string | null
          bio?: string | null
          certification?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diving_org?: string | null
          id: string
          is_banned?: boolean
          nickname: string
          profile_image_url?: string | null
          team_id?: string | null
          total_dives_at_signup?: number | null
          updated_at?: string | null
        }
        Update: {
          banned_at?: string | null
          banned_by?: string | null
          banned_reason?: string | null
          bio?: string | null
          certification?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diving_org?: string | null
          id?: string
          is_banned?: boolean
          nickname?: string
          profile_image_url?: string | null
          team_id?: string | null
          total_dives_at_signup?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_buddies: {
        Row: {
          schedule_id: string
          status: string
          user_id: string
        }
        Insert: {
          schedule_id: string
          status?: string
          user_id: string
        }
        Update: {
          schedule_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_buddies_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "dive_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_buddies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_bookings: {
        Row: {
          created_at: string | null
          dive_kind: string | null
          end_date: string
          id: string
          message: string | null
          people_count: number
          shop_id: string
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dive_kind?: string | null
          end_date: string
          id?: string
          message?: string | null
          people_count: number
          shop_id: string
          start_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          dive_kind?: string | null
          end_date?: string
          id?: string
          message?: string | null
          people_count?: number
          shop_id?: string
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_bookings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          city: string
          coordinates: unknown
          country: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_premium: boolean | null
          name: string
          rating: number | null
          region: string
          review_count: number | null
        }
        Insert: {
          city: string
          coordinates?: unknown
          country: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_premium?: boolean | null
          name: string
          rating?: number | null
          region: string
          review_count?: number | null
        }
        Update: {
          city?: string
          coordinates?: unknown
          country?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_premium?: boolean | null
          name?: string
          rating?: number | null
          region?: string
          review_count?: number | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          joined_at: string | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string | null
          role: string
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          leader_id: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          leader_id?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          leader_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_buddies: {
        Row: {
          buddy_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          buddy_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          buddy_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_buddies_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_buddies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_certifications: {
        Row: {
          card_filename: string
          card_image_url: string
          card_type: string
          cert_number: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          issued_on: string | null
          level: string
          organization: string
          provider: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_filename: string
          card_image_url: string
          card_type?: string
          cert_number?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          issued_on?: string | null
          level: string
          organization: string
          provider?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_filename?: string
          card_image_url?: string
          card_type?: string
          cert_number?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          issued_on?: string | null
          level?: string
          organization?: string
          provider?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_certifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_equipment: {
        Row: {
          category: string
          created_at: string | null
          custom_brand: string | null
          custom_model: string | null
          equipment_id: string | null
          id: string
          notes: string | null
          photo_url: string | null
          purchased_at: string | null
          serial_no: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          custom_brand?: string | null
          custom_model?: string | null
          equipment_id?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          purchased_at?: string | null
          serial_no?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          custom_brand?: string | null
          custom_model?: string | null
          equipment_id?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          purchased_at?: string | null
          serial_no?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_equipment_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      board_posts_increment_view: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      bump_places_usage: {
        Args: { p_cap?: number }
        Returns: {
          allowed: boolean
          cap: number
          used_today: number
        }[]
      }
      get_places_usage_today: {
        Args: never
        Returns: {
          day: string
          used_today: number
        }[]
      }
      is_schedule_invitee: { Args: { schedule_uuid: string }; Returns: boolean }
      is_schedule_owner: { Args: { schedule_uuid: string }; Returns: boolean }
      register_push_token: {
        Args: { p_device_label: string; p_platform: string; p_token: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_role: "viewer" | "operator" | "superadmin"
      board_category:
        | "free"
        | "question"
        | "review"
        | "gear"
        | "meetup"
        | "notice"
      board_report_reason:
        | "spam"
        | "sexual"
        | "violence"
        | "harassment"
        | "misinformation"
        | "copyright"
        | "other"
      board_report_status: "pending" | "resolved" | "dismissed"
      dive_weather: "sunny" | "cloudy" | "rainy" | "night"
      feed_report_reason:
        | "spam"
        | "sexual"
        | "violence"
        | "harassment"
        | "misinformation"
        | "copyright"
        | "other"
      feed_report_status: "pending" | "resolved" | "dismissed"
      feed_type: "log" | "normal" | "ad"
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
      admin_role: ["viewer", "operator", "superadmin"],
      board_category: [
        "free",
        "question",
        "review",
        "gear",
        "meetup",
        "notice",
      ],
      board_report_reason: [
        "spam",
        "sexual",
        "violence",
        "harassment",
        "misinformation",
        "copyright",
        "other",
      ],
      board_report_status: ["pending", "resolved", "dismissed"],
      dive_weather: ["sunny", "cloudy", "rainy", "night"],
      feed_report_reason: [
        "spam",
        "sexual",
        "violence",
        "harassment",
        "misinformation",
        "copyright",
        "other",
      ],
      feed_report_status: ["pending", "resolved", "dismissed"],
      feed_type: ["log", "normal", "ad"],
    },
  },
} as const
