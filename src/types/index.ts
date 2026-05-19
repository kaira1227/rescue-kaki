export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

// Module types for Rescue Kaki
export type ModuleType = 'voice' | 'photo' | 'gps' | 'manual';

// Unified entry matching Supabase schema
export interface Entry {
  id: string;
  created_at: string;
  module_type: ModuleType;
  timestamp: string;
  summary: string;
  // Voice
  transcription?: string | null;
  // Photo
  photo_url?: string | null;
  photo_caption?: string | null;
  // GPS / zone
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  zone_label?: string | null;
  // Manual log
  template_type?: string | null;
  form_data?: Record<string, string | number | null> | null;
  // Shared
  location_tag?: string | null;
  is_edited: boolean;
  // Schematic coordinates (normalized 0.0–1.0 relative to schematic image)
  schematic_x?: number | null;
  schematic_y?: number | null;
}

// Schematic settings (one row per session)
export interface SchematicSettings {
  id: string;
  image_url: string;
  calibration_data?: CalibrationData | null;
  created_at: string;
  updated_at: string;
}

// GPS-to-schematic calibration: 2 reference points
export interface CalibrationPoint {
  schematic_x: number; // 0.0–1.0
  schematic_y: number; // 0.0–1.0
  gps_lat: number;
  gps_lng: number;
}

export interface CalibrationData {
  points: [CalibrationPoint, CalibrationPoint];
}

// Geofence zone drawn on schematic
export interface Geofence {
  id: string;
  label: string;
  zone_type: string;
  center_x: number; // normalized 0.0–1.0
  center_y: number; // normalized 0.0–1.0
  radius: number;   // normalized
  color: string;
  created_at: string;
}

// Recording states
export type RecordingState = 'idle' | 'recording' | 'processing';

// Export format options
export type ExportFormat = 'json' | 'csv';

// Manual log templates
export type TemplateType = 'victim_assessment' | 'equipment_check' | 'hazard_report' | 'general_note';

export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  required?: boolean;
}

export interface Template {
  id: TemplateType;
  label: string;
  icon: string;
  fields: TemplateField[];
}

// Module tab definition
export type TabId = 'voice' | 'map' | 'log' | 'timeline';
