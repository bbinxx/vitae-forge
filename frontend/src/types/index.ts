export interface User {
  id: string;
  username: string;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  status: string;
  priority: string;
  date_applied: string;
  resume_template?: any;
  created_at?: string;
}

export interface Bookmark {
  id: string;
  name: string;
  data: any;
  source_app_id?: string;
  created_at?: string;
  target_role?: string;
  template?: string;
  version?: string;
  status?: string;
}

export interface Setting {
  export_folder: string;
  file_name_prefix: string;
  default_resume_name?: string;
  default_template?: string;
  default_status?: string;
  default_priority?: string;
  date_format?: string;
  theme?: 'dark' | 'light' | 'system';
  density?: 'compact' | 'comfortable';
  editor_font_size?: number;
  editor_tab_size?: number;
  editor_word_wrap?: boolean;
  editor_minimap?: boolean;
  editor_theme?: string;
  photo_r2_key?: string;
}

export interface SystemStatus {
  server_ok: boolean;
  latex_ok: boolean;
  pdf_engine_ok: boolean;
  version?: string;
  last_successful_generation?: string;
}

export interface Recipe {
  short_name?: string;
  role_title: string;
  professional_summary: string;
  sections?: Record<string, boolean>;
  skills?: string[];
  keywords?: string[];
  projects?: string[];
}
