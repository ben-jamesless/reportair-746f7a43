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
      areas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      day_notes: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      guest_notes: {
        Row: {
          body: string
          created_at: string
          guest_email: string | null
          guest_name: string
          id: string
          photo_id: string
          project_id: string
          share_link_id: string
        }
        Insert: {
          body: string
          created_at?: string
          guest_email?: string | null
          guest_name: string
          id?: string
          photo_id: string
          project_id: string
          share_link_id: string
        }
        Update: {
          body?: string
          created_at?: string
          guest_email?: string | null
          guest_name?: string
          id?: string
          photo_id?: string
          project_id?: string
          share_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_notes_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          album_id: string | null
          aperture: number | null
          area_id: string | null
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
          iso: number | null
          lens: string | null
          mime_type: string | null
          position: number
          project_id: string
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
          iso?: number | null
          lens?: string | null
          mime_type?: string | null
          position?: number
          project_id: string
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
          iso?: number | null
          lens?: string | null
          mime_type?: string | null
          position?: number
          project_id?: string
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
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarded_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarded_at?: string | null
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
        Relationships: []
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
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          cover_photo_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          team_id: string
          template: Database["public"]["Enums"]["project_template"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          cover_photo_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          team_id: string
          template?: Database["public"]["Enums"]["project_template"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          cover_photo_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          team_id?: string
          template?: Database["public"]["Enums"]["project_template"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          last_accessed_at: string | null
          password_hash: string | null
          project_id: string
          revoked_at: string | null
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          password_hash?: string | null
          project_id: string
          revoked_at?: string | null
          token?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          password_hash?: string | null
          project_id?: string
          revoked_at?: string | null
          token?: string
          view_count?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
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
      get_share_photo_url: {
        Args: { _photo_id: string; _token: string }
        Returns: string
      }
      has_project_role: {
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
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
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
      project_team_id: { Args: { _project_id: string }; Returns: string }
      resolve_share_link: {
        Args: { _password?: string; _token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      area_status: "no_status" | "on_track" | "requires_discussion" | "concern"
      export_status: "queued" | "processing" | "ready" | "failed"
      project_role: "owner" | "editor" | "commenter" | "viewer"
      project_template: "event_production" | "blank"
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
      app_role: ["admin", "user"],
      area_status: ["no_status", "on_track", "requires_discussion", "concern"],
      export_status: ["queued", "processing", "ready", "failed"],
      project_role: ["owner", "editor", "commenter", "viewer"],
      project_template: ["event_production", "blank"],
      team_role: ["owner", "admin", "member"],
    },
  },
} as const
