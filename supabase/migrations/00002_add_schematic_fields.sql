
-- Add schematic coordinate columns to entries
ALTER TABLE entries
  ADD COLUMN schematic_x DOUBLE PRECISION,
  ADD COLUMN schematic_y DOUBLE PRECISION;

-- Schematic settings (one row per session/project)
CREATE TABLE schematic_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url   text NOT NULL,
  calibration_data jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Geofence zones drawn on the schematic
CREATE TABLE geofences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL,
  zone_type  text NOT NULL DEFAULT 'general',
  center_x   DOUBLE PRECISION NOT NULL,
  center_y   DOUBLE PRECISION NOT NULL,
  radius     DOUBLE PRECISION NOT NULL DEFAULT 0.05,
  color      text NOT NULL DEFAULT '#f97316',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (public read/write for POC)
ALTER TABLE schematic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_schematic_settings" ON schematic_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_geofences" ON geofences FOR ALL USING (true) WITH CHECK (true);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE geofences;
