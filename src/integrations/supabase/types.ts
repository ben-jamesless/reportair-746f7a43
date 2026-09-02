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
      activity_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          project_id: string
          target_id: string | null
          target_type: string
          verb: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          project_id: string
          target_id?: string | null
          target_type: string
          verb: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          project_id?: string
          target_id?: string | null
          target_type?: string
          verb?: string
        }
        Relationships: []
      }
      albums: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          position: number
          project_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          position?: number
          project_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          position?: number
          project_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      area_day_notes: {
        Row: {
          area_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "area_day_notes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_day_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      area_day_status: {
        Row: {
          area_id: string
          created_at: string
          date: string
          id: string
          project_id: string
          status: Database["public"]["Enums"]["area_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_id: string
          created_at?: string
          date: string
          id?: string
          project_id: string
          status?: Database["public"]["Enums"]["area_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string
          date?: string
          id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["area_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      area_map_features: {
        Row: {
          area_id: string
          created_at: string
          created_by: string | null
          geometry: Json
          id: string
          is_primary: boolean
          kind: string
          label: string | null
          plan_color: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          area_id: string
          created_at?: string
          created_by?: string | null
          geometry: Json
          id?: string
          is_primary?: boolean
          kind: string
          label?: string | null
          plan_color?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          created_by?: string | null
          geometry?: Json
          id?: string
          is_primary?: boolean
          kind?: string
          label?: string | null
          plan_color?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_map_features_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_map_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          boundary_source: string
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          boundary_source?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          boundary_source?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          mentions: string[]
          photo_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          mentions?: string[]
          photo_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          mentions?: string[]
          photo_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      day_notes: {
        Row: {
          created_at: string
          date: string
          day_status: Database["public"]["Enums"]["area_status"]
          id: string
          notes: string | null
          objectives_seeded_at: string | null
          open_issues: string | null
          project_id: string
          today_achievements: string | null
          today_objectives: string | null
          tomorrow_objectives: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          date: string
          day_status?: Database["public"]["Enums"]["area_status"]
          id?: string
          notes?: string | null
          objectives_seeded_at?: string | null
          open_issues?: string | null
          project_id: string
          today_achievements?: string | null
          today_objectives?: string | null
          tomorrow_objectives?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          day_status?: Database["public"]["Enums"]["area_status"]
          id?: string
          notes?: string | null
          objectives_seeded_at?: string | null
          open_issues?: string | null
          project_id?: string
          today_achievements?: string | null
          today_objectives?: string | null
          tomorrow_objectives?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_phases: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          kind: string
          label: string
          project_id: string
          sort_order: number
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          kind: string
          label: string
          project_id: string
          sort_order?: number
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          kind?: string
          label?: string
          project_id?: string
          sort_order?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_moderation_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          guest_note_id: string
          id: string
          project_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          guest_note_id: string
          id?: string
          project_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          guest_note_id?: string
          id?: string
          project_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "folders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      free_email_domains: {
        Row: {
          added_at: string
          domain: string
        }
        Insert: {
          added_at?: string
          domain: string
        }
        Update: {
          added_at?: string
          domain?: string
        }
        Relationships: []
      }
      growth_events: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          metadata: Json
          verb: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          metadata?: Json
          verb: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          verb?: string
        }
        Relationships: []
      }
      guest_notes: {
        Row: {
          area_id: string | null
          author_email: string
          body: string
          created_at: string
          day: string | null
          guest_email: string | null
          guest_name: string
          hidden_by_owner_at: string | null
          id: string
          is_ops: boolean
          parent_id: string | null
          photo_id: string | null
          project_id: string
          resolved_at: string | null
          share_link_id: string
        }
        Insert: {
          area_id?: string | null
          author_email: string
          body: string
          created_at?: string
          day?: string | null
          guest_email?: string | null
          guest_name: string
          hidden_by_owner_at?: string | null
          id?: string
          is_ops?: boolean
          parent_id?: string | null
          photo_id?: string | null
          project_id: string
          resolved_at?: string | null
          share_link_id: string
        }
        Update: {
          area_id?: string | null
          author_email?: string
          body?: string
          created_at?: string
          day?: string | null
          guest_email?: string | null
          guest_name?: string
          hidden_by_owner_at?: string | null
          id?: string
          is_ops?: boolean
          parent_id?: string | null
          photo_id?: string | null
          project_id?: string
          resolved_at?: string | null
          share_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_notes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_notes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "guest_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_notes_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_magnet_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          pdf_slug: string
          resend_message_id: string | null
          resend_status: number | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          pdf_slug?: string
          resend_message_id?: string | null
          resend_status?: number | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          pdf_slug?: string
          resend_message_id?: string | null
          resend_status?: number | null
          source?: string | null
        }
        Relationships: []
      }
      newsletter_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          resend_contact_id: string | null
          source: string | null
          synced_to_resend: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          resend_contact_id?: string | null
          source?: string | null
          synced_to_resend?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          resend_contact_id?: string | null
          source?: string | null
          synced_to_resend?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          body: string | null
          comment_id: string | null
          created_at: string
          id: string
          photo_id: string | null
          project_id: string
          read_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          photo_id?: string | null
          project_id: string
          read_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          photo_id?: string | null
          project_id?: string
          read_at?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      photo_day_hidden: {
        Row: {
          date_key: string
          hidden_at: string
          hidden_by: string | null
          photo_id: string
          project_id: string
        }
        Insert: {
          date_key: string
          hidden_at?: string
          hidden_by?: string | null
          photo_id: string
          project_id: string
        }
        Update: {
          date_key?: string
          hidden_at?: string
          hidden_by?: string | null
          photo_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_day_hidden_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_day_hidden_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          album_id: string | null
          aperture: number | null
          area_id: string | null
          assignment_source: string | null
          camera_make: string | null
          camera_model: string | null
          caption: string | null
          captured_at: string | null
          created_at: string
          file_name: string
          focal_length: number | null
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          is_reference: boolean
          iso: number | null
          lens: string | null
          mime_type: string | null
          position: number
          project_id: string
          report_path: string | null
          shutter_speed: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          album_id?: string | null
          aperture?: number | null
          area_id?: string | null
          assignment_source?: string | null
          camera_make?: string | null
          camera_model?: string | null
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          file_name: string
          focal_length?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_reference?: boolean
          iso?: number | null
          lens?: string | null
          mime_type?: string | null
          position?: number
          project_id: string
          report_path?: string | null
          shutter_speed?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          album_id?: string | null
          aperture?: number | null
          area_id?: string | null
          assignment_source?: string | null
          camera_make?: string | null
          camera_model?: string | null
          caption?: string | null
          captured_at?: string | null
          created_at?: string
          file_name?: string
          focal_length?: number | null
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          is_reference?: boolean
          iso?: number | null
          lens?: string | null
          mime_type?: string | null
          position?: number
          project_id?: string
          report_path?: string | null
          shutter_speed?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_method: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_active_at: string | null
          onboarded_at: string | null
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          auth_method?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_active_at?: string | null
          onboarded_at?: string | null
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_method?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          onboarded_at?: string | null
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_exports: {
        Row: {
          accent_color: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          logo_path: string | null
          options: Json
          output_path: string | null
          photo_count: number | null
          project_id: string
          status: Database["public"]["Enums"]["export_status"]
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          logo_path?: string | null
          options?: Json
          output_path?: string | null
          photo_count?: number | null
          project_id: string
          status?: Database["public"]["Enums"]["export_status"]
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          logo_path?: string | null
          options?: Json
          output_path?: string | null
          photo_count?: number | null
          project_id?: string
          status?: Database["public"]["Enums"]["export_status"]
          updated_at?: string
        }
        Relationships: []
      }
      project_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          build_end_date: string | null
          build_start_date: string | null
          client_name: string | null
          color: string
          cover_asset_path: string | null
          cover_photo_id: string | null
          created_at: string
          created_by: string
          default_view: Database["public"]["Enums"]["project_default_view"]
          description: string | null
          event_date: string | null
          event_location: string | null
          event_summary_text: string | null
          event_type: string | null
          finalised_at: string | null
          folder_id: string | null
          geo_lat: number | null
          geo_lng: number | null
          geo_location_query: string | null
          geo_place_id: string | null
          hero_photo_id: string | null
          id: string
          last_activity_at: string | null
          location: string | null
          logo_path: string | null
          map_center: Json | null
          map_default_center_lat: number | null
          map_default_center_lng: number | null
          map_default_zoom: number | null
          map_type: string | null
          map_zoom: number | null
          name: string
          overall_status: Database["public"]["Enums"]["project_status"]
          phase: string | null
          project_type: string | null
          team_id: string
          template: Database["public"]["Enums"]["project_template"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          build_end_date?: string | null
          build_start_date?: string | null
          client_name?: string | null
          color?: string
          cover_asset_path?: string | null
          cover_photo_id?: string | null
          created_at?: string
          created_by: string
          default_view?: Database["public"]["Enums"]["project_default_view"]
          description?: string | null
          event_date?: string | null
          event_location?: string | null
          event_summary_text?: string | null
          event_type?: string | null
          finalised_at?: string | null
          folder_id?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_location_query?: string | null
          geo_place_id?: string | null
          hero_photo_id?: string | null
          id?: string
          last_activity_at?: string | null
          location?: string | null
          logo_path?: string | null
          map_center?: Json | null
          map_default_center_lat?: number | null
          map_default_center_lng?: number | null
          map_default_zoom?: number | null
          map_type?: string | null
          map_zoom?: number | null
          name: string
          overall_status?: Database["public"]["Enums"]["project_status"]
          phase?: string | null
          project_type?: string | null
          team_id: string
          template?: Database["public"]["Enums"]["project_template"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          build_end_date?: string | null
          build_start_date?: string | null
          client_name?: string | null
          color?: string
          cover_asset_path?: string | null
          cover_photo_id?: string | null
          created_at?: string
          created_by?: string
          default_view?: Database["public"]["Enums"]["project_default_view"]
          description?: string | null
          event_date?: string | null
          event_location?: string | null
          event_summary_text?: string | null
          event_type?: string | null
          finalised_at?: string | null
          folder_id?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_location_query?: string | null
          geo_place_id?: string | null
          hero_photo_id?: string | null
          id?: string
          last_activity_at?: string | null
          location?: string | null
          logo_path?: string | null
          map_center?: Json | null
          map_default_center_lat?: number | null
          map_default_center_lng?: number | null
          map_default_zoom?: number | null
          map_type?: string | null
          map_zoom?: number | null
          name?: string
          overall_status?: Database["public"]["Enums"]["project_status"]
          phase?: string | null
          project_type?: string | null
          team_id?: string
          template?: Database["public"]["Enums"]["project_template"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_cover_photo_id_fkey"
            columns: ["cover_photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_hero_photo_id_fkey"
            columns: ["hero_photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      share_comment_throttle: {
        Row: {
          created_at: string
          email_hash: string | null
          id: number
          ip_hash: string
          share_link_id: string | null
        }
        Insert: {
          created_at?: string
          email_hash?: string | null
          id?: never
          ip_hash: string
          share_link_id?: string | null
        }
        Update: {
          created_at?: string
          email_hash?: string | null
          id?: never
          ip_hash?: string
          share_link_id?: string | null
        }
        Relationships: []
      }
      share_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          has_password: boolean | null
          id: string
          label: string | null
          last_accessed_at: string | null
          password_hash: string | null
          project_id: string
          revoked_at: string | null
          show_photo_pins: boolean
          team_view_count: number
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          has_password?: boolean | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          password_hash?: string | null
          project_id: string
          revoked_at?: string | null
          show_photo_pins?: boolean
          team_view_count?: number
          token?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          has_password?: boolean | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          password_hash?: string | null
          project_id?: string
          revoked_at?: string | null
          show_photo_pins?: boolean
          team_view_count?: number
          token?: string
          view_count?: number
        }
        Relationships: []
      }
      share_preview_secret: {
        Row: {
          created_at: string
          id: number
          secret: string
        }
        Insert: {
          created_at?: string
          id?: number
          secret: string
        }
        Update: {
          created_at?: string
          id?: number
          secret?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_external_approvals: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          id: string
          invited_by_user_id: string | null
          invitee_email: string
          origin_project_id: string | null
          origin_project_role: string | null
          status: string
          team_id: string
          updated_at: string
          use_case_note: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          invitee_email: string
          origin_project_id?: string | null
          origin_project_role?: string | null
          status?: string
          team_id: string
          updated_at?: string
          use_case_note?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          invitee_email?: string
          origin_project_id?: string | null
          origin_project_role?: string | null
          status?: string
          team_id?: string
          updated_at?: string
          use_case_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_external_approvals_origin_project_id_fkey"
            columns: ["origin_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_external_approvals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          member_type: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_type?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_type?: string
          role?: Database["public"]["Enums"]["team_role"]
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
        ]
      }
      teams: {
        Row: {
          addon_seats: number
          billing_interval: string | null
          billing_owner_user_id: string
          brand_colour: string | null
          created_at: string
          created_by: string
          current_period_end: string | null
          domain_matching_override: boolean
          exports_reset_at: string
          exports_this_month: number
          id: string
          industry: string | null
          logo_path: string | null
          name: string
          payment_failed_at: string | null
          plan: string
          region: string | null
          slug: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          suspended_at: string | null
          trial_ends_at: string | null
          updated_at: string
          white_label_pdf: boolean
        }
        Insert: {
          addon_seats?: number
          billing_interval?: string | null
          billing_owner_user_id: string
          brand_colour?: string | null
          created_at?: string
          created_by: string
          current_period_end?: string | null
          domain_matching_override?: boolean
          exports_reset_at?: string
          exports_this_month?: number
          id?: string
          industry?: string | null
          logo_path?: string | null
          name: string
          payment_failed_at?: string | null
          plan?: string
          region?: string | null
          slug?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          suspended_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          white_label_pdf?: boolean
        }
        Update: {
          addon_seats?: number
          billing_interval?: string | null
          billing_owner_user_id?: string
          brand_colour?: string | null
          created_at?: string
          created_by?: string
          current_period_end?: string | null
          domain_matching_override?: boolean
          exports_reset_at?: string
          exports_this_month?: number
          id?: string
          industry?: string | null
          logo_path?: string | null
          name?: string
          payment_failed_at?: string | null
          plan?: string
          region?: string | null
          slug?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          suspended_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          white_label_pdf?: boolean
        }
        Relationships: []
      }
      user_project_folders: {
        Row: {
          created_at: string
          folder_id: string
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      accept_project_invite: { Args: { _token: string }; Returns: string }
      add_guest_note_project_public: {
        Args: { _body: string; _email: string; _name: string; _token: string }
        Returns: string
      }
      add_guest_note_public: {
        Args: {
          _body: string
          _email: string
          _name: string
          _photo_id: string
          _token: string
        }
        Returns: string
      }
      add_report_comment_ops: {
        Args: { _body: string; _parent_id: string; _token: string }
        Returns: string
      }
      admin_billing_summary: { Args: never; Returns: Json }
      admin_delete_team: { Args: { _team_id: string }; Returns: undefined }
      admin_list_projects: {
        Args: { _phase?: string; _project_type?: string; _team_id?: string }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          last_activity_at: string
          location: string
          name: string
          overall_status: Database["public"]["Enums"]["project_status"]
          owner_email: string
          owner_id: string
          phase: string
          project_type: string
          team_id: string
          team_name: string
        }[]
      }
      admin_list_team_members: {
        Args: { _team_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      admin_list_teams: {
        Args: never
        Returns: {
          billing_interval: string
          billing_owner_email: string
          billing_owner_user_id: string
          created_at: string
          current_period_end: string
          id: string
          industry: string
          member_count: number
          name: string
          plan: string
          plan_name: string
          project_count: number
          region: string
          status: string
          subscription_status: string
          suspended_at: string
          trial_end: string
          trial_ends_at: string
          unit_amount: number
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          auth_method: string
          created_at: string
          email: string
          full_name: string
          id: string
          last_active_at: string
          member_team_count: number
          owner_team_count: number
          project_count: number
          role_summary: string
          suspended_at: string
          team_count: number
        }[]
      }
      admin_list_users_with_accounts: {
        Args: never
        Returns: {
          auth_method: string
          email: string
          full_name: string
          has_payment_method: boolean
          last_active_at: string
          mrr_hkd: number
          owned_project_count: number
          plan: string
          subscription_status: string
          team_id: string
          team_name: string
          team_project_count: number
          team_role: string
          team_suspended_at: string
          trial_ends_at: string
          user_created_at: string
          user_id: string
          user_suspended_at: string
        }[]
      }
      admin_set_project_archived: {
        Args: { _archived: boolean; _project_id: string }
        Returns: undefined
      }
      admin_set_team_billing_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: undefined
      }
      admin_set_team_plan: {
        Args: { _plan: string; _team_id: string }
        Returns: undefined
      }
      admin_set_team_suspended: {
        Args: { _suspended: boolean; _team_id: string }
        Returns: undefined
      }
      admin_set_user_suspended: {
        Args: { _suspended: boolean; _user_id: string }
        Returns: undefined
      }
      admin_summary: { Args: never; Returns: Json }
      area_in_project: {
        Args: { _area_id: string; _project_id: string }
        Returns: boolean
      }
      area_status_rank: {
        Args: { _s: Database["public"]["Enums"]["area_status"] }
        Returns: number
      }
      can_read_export_asset: {
        Args: { _name: string; _user: string }
        Returns: boolean
      }
      can_read_photo_object: {
        Args: { _name: string; _user: string }
        Returns: boolean
      }
      can_write_export_asset: {
        Args: { _name: string; _user: string }
        Returns: boolean
      }
      classify_invitee: {
        Args: { _email: string; _team_id: string }
        Returns: string
      }
      classify_unclassified_member: {
        Args: { _member_type: string; _team_id: string; _user_id: string }
        Returns: undefined
      }
      copy_prior_day_statuses: {
        Args: { _date_key: string; _project_id: string }
        Returns: number
      }
      create_zone_with_geometry: {
        Args: {
          _color?: string
          _geometry: Json
          _kind: string
          _name: string
          _project_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_project: { Args: { _project_id: string }; Returns: undefined }
      derive_area_display_status: {
        Args: { _area_id: string; _day: string }
        Returns: string
      }
      email_domain: { Args: { _email: string }; Returns: string }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      event_lifecycle_mode: {
        Args: { _as_of?: string; _project_id: string }
        Returns: string
      }
      get_invite_context: {
        Args: { _token: string }
        Returns: {
          account_exists: boolean
          email: string
          project_name: string
        }[]
      }
      get_invite_email: { Args: { _token: string }; Returns: string }
      get_invite_token: { Args: { _invite_id: string }; Returns: string }
      get_my_pending_invite_token: {
        Args: { _project_id: string }
        Returns: string
      }
      get_project_update_day_count: {
        Args: { _project_id: string }
        Returns: number
      }
      get_share_brand_colour: { Args: { _token: string }; Returns: string }
      get_share_export_url: { Args: { _token: string }; Returns: string }
      get_share_logo_path: { Args: { _token: string }; Returns: string }
      get_share_photo_url: {
        Args: { _photo_id: string; _token: string }
        Returns: string
      }
      get_share_project_center: { Args: { _token: string }; Returns: Json }
      get_team_export_count: { Args: { _team_id: string }; Returns: number }
      get_team_pending_invites: {
        Args: never
        Returns: {
          created_at: string
          email: string
          invite_id: string
          project_id: string
          project_name: string
          role: string
          token: string
        }[]
      }
      get_team_roster: {
        Args: never
        Returns: {
          email: string
          full_name: string
          joined_at: string
          last_active_at: string
          projects: Json
          user_id: string
        }[]
      }
      has_project_role:
        | {
            Args: {
              _project_id: string
              _role: Database["public"]["Enums"]["project_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _project_id: string
              _roles: Database["public"]["Enums"]["project_role"][]
              _user_id: string
            }
            Returns: boolean
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_team_role: {
        Args: {
          _role: Database["public"]["Enums"]["team_role"]
          _team_id: string
          _user_id: string
        }
        Returns: boolean
      }
      hash_share_password: { Args: { _password: string }; Returns: string }
      increment_team_export_count: {
        Args: { _team_id: string }
        Returns: undefined
      }
      is_billing_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_project_crew: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_reader: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      leave_project: { Args: { _project_id: string }; Returns: undefined }
      list_guest_notes_project_public: {
        Args: { _token: string }
        Returns: {
          body: string
          created_at: string
          guest_name: string
          id: string
          photo_id: string
        }[]
      }
      list_guest_notes_public: {
        Args: { _photo_id: string; _token: string }
        Returns: {
          body: string
          created_at: string
          guest_name: string
          id: string
        }[]
      }
      list_report_comments_public: {
        Args: { _token: string }
        Returns: {
          area_id: string
          area_name: string
          body: string
          created_at: string
          day: string
          guest_name: string
          hidden: boolean
          id: string
          is_ops: boolean
          parent_id: string
          photo_id: string
          resolved_at: string
        }[]
      }
      list_share_hidden_photos: {
        Args: { _token: string }
        Returns: {
          date_key: string
          photo_id: string
        }[]
      }
      list_share_map_features: {
        Args: { _token: string }
        Returns: {
          area_id: string
          geometry: Json
          id: string
          is_primary: boolean
          kind: string
          label: string
          plan_color: string
        }[]
      }
      mark_notifications_read: { Args: { _ids?: string[] }; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_accessible_projects: {
        Args: never
        Returns: {
          archived_at: string
          client_name: string
          color: string
          created_at: string
          description: string
          event_date: string
          event_location: string
          event_type: string
          folder_id: string
          id: string
          name: string
          overall_status: Database["public"]["Enums"]["project_status"]
          template: Database["public"]["Enums"]["project_template"]
        }[]
      }
      my_latest_invited_project: { Args: never; Returns: string }
      my_owned_projects_count: { Args: never; Returns: number }
      my_pending_invites_count: { Args: never; Returns: number }
      notify_user_of_invite: {
        Args: { _invite_id: string }
        Returns: undefined
      }
      owner_leave_project: { Args: { _project_id: string }; Returns: undefined }
      plan_allows_externals: { Args: { _plan: string }; Returns: boolean }
      plan_core_cap: {
        Args: { _addon: number; _plan: string }
        Returns: number
      }
      plan_monthly_hkd: {
        Args: { _interval?: string; _plan: string }
        Returns: number
      }
      project_team_id: { Args: { _project_id: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      remove_team_member: { Args: { _user_id: string }; Returns: undefined }
      resolve_share_link: {
        Args: { _password?: string; _token: string }
        Returns: Json
      }
      seed_todays_objectives: {
        Args: { _date_key: string; _project_id: string }
        Returns: boolean
      }
      set_primary_map_feature: {
        Args: { _feature_id: string }
        Returns: undefined
      }
      set_report_comment_hidden: {
        Args: { _hidden: boolean; _id: string }
        Returns: undefined
      }
      set_report_comment_resolved: {
        Args: { _id: string; _resolved: boolean }
        Returns: undefined
      }
      share_area: {
        Args: { _area_id?: string; _password?: string; _token: string }
        Returns: Json
      }
      share_day: {
        Args: { _date?: string; _password?: string; _token: string }
        Returns: Json
      }
      share_link_check: {
        Args: { _password: string; _token: string }
        Returns: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          has_password: boolean | null
          id: string
          label: string | null
          last_accessed_at: string | null
          password_hash: string | null
          project_id: string
          revoked_at: string | null
          show_photo_pins: boolean
          team_view_count: number
          token: string
          view_count: number
        }
        SetofOptions: {
          from: "*"
          to: "share_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      share_meta: {
        Args: { _password?: string; _preview?: string; _token: string }
        Returns: Json
      }
      share_ops_contact: { Args: { _token: string }; Returns: Json }
      share_preview_is_team: {
        Args: { _link_id: string; _preview: string; _project_id: string }
        Returns: boolean
      }
      share_preview_sign: {
        Args: { _link_id: string; _user_id: string }
        Returns: string
      }
      share_preview_token: { Args: { _share_link_id: string }; Returns: string }
      share_viewer_is_ops: { Args: { _token: string }; Returns: boolean }
      share_viewer_role: { Args: { _token: string }; Returns: string }
      team_domain_matching_enabled: {
        Args: { _team_id: string }
        Returns: boolean
      }
      team_member_count: { Args: { _team_id: string }; Returns: number }
      team_seat_summary: { Args: { _team_id: string }; Returns: Json }
      visible_guest_notes: {
        Args: { _project_id: string }
        Returns: {
          area_id: string
          body: string
          created_at: string
          day: string
          guest_name: string
          id: string
          is_ops: boolean
          parent_id: string
          photo_id: string
          project_id: string
          resolved_at: string
        }[]
      }
      worst_status_for_event_day: {
        Args: { _date: string; _project_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user" | "platform_admin"
      area_status:
        | "not_started"
        | "in_progress"
        | "flagged"
        | "delayed"
        | "complete"
      export_status: "queued" | "processing" | "ready" | "failed"
      notification_type:
        | "mention"
        | "reply"
        | "guest_comment"
        | "project_invite"
      project_default_view: "report" | "gallery"
      project_role: "owner" | "editor" | "commenter" | "viewer" | "crew"
      project_status:
        | "not_started"
        | "in_progress"
        | "flagged"
        | "delayed"
        | "behind_schedule"
        | "complete"
      project_template:
        | "event_production"
        | "blank"
        | "pop_up"
        | "exhibition"
        | "brand_activation"
      team_role: "owner" | "admin" | "member"
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
      app_role: ["admin", "user", "platform_admin"],
      area_status: [
        "not_started",
        "in_progress",
        "flagged",
        "delayed",
        "complete",
      ],
      export_status: ["queued", "processing", "ready", "failed"],
      notification_type: [
        "mention",
        "reply",
        "guest_comment",
        "project_invite",
      ],
      project_default_view: ["report", "gallery"],
      project_role: ["owner", "editor", "commenter", "viewer", "crew"],
      project_status: [
        "not_started",
        "in_progress",
        "flagged",
        "delayed",
        "behind_schedule",
        "complete",
      ],
      project_template: [
        "event_production",
        "blank",
        "pop_up",
        "exhibition",
        "brand_activation",
      ],
      team_role: ["owner", "admin", "member"],
    },
  },
} as const
