export type ShareMode = "build" | "on_show" | "takedown" | "filed";

export type ShareV2Project = {
  id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  event_type: string | null;
  event_location: string | null;
  event_date: string | null;
  color: string | null;
  overall_status: string | null;
  build_start_date: string | null;
  build_end_date: string | null;
};

export type ShareV2Phase = {
  id: string;
  kind: string;
  label: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type ShareV2AreaMeta = {
  id: string;
  name: string;
  sort_order: number;
  color: string | null;
  photo_count: number;
  latest_status: string | null;
};

export type ShareV2GridCell = {
  area_id: string;
  date: string;
  status: string | null;
  photo_count: number | null;
};

export type ShareV2DayMeta = {
  date: string;
  day_status: string | null;
  worst_status: string | null;
  photo_count: number;
  has_notes: boolean;
};

export type ShareV2Meta = {
  ok: boolean;
  error?: string;
  share_link_id?: string;
  show_photo_pins?: boolean;
  generated_at?: string;
  mode?: ShareMode;
  project?: ShareV2Project;
  team_plan?: string | null;
  team_name?: string | null;
  team_logo_path?: string | null;
  brand_colour?: string | null;
  hide_buildslides_branding?: boolean | null;
  phases?: ShareV2Phase[];
  areas?: ShareV2AreaMeta[];
  grid?: ShareV2GridCell[];
  days?: ShareV2DayMeta[];
  photo_count?: number;
  latest_export?: { id: string; created_at: string; photo_count: number | null } | null;
};

export type ShareV2Photo = {
  id: string;
  storage_path: string;
  file_name: string;
  caption: string | null;
  captured_at: string | null;
  created_at: string;
  area_id: string | null;
  width: number | null;
  height: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
};

export type ShareV2DayArea = {
  area_id: string;
  name: string;
  sort_order: number;
  status: string | null;
  /** Derived: explicit status, else in_progress when photos exist that day. */
  display_status?: string | null;
  photo_count?: number | null;
  notes: string | null;
};

export type ShareV2Day = {
  ok: boolean;
  error?: string;
  date?: string;
  day_status?: string | null;
  notes?: string | null;
  today_objectives?: string | null;
  today_achievements?: string | null;
  tomorrow_objectives?: string | null;
  open_issues?: string | null;
  last_updated_at?: string | null;
  worst_status?: string | null;
  areas?: ShareV2DayArea[];
  photos?: ShareV2Photo[];
};
