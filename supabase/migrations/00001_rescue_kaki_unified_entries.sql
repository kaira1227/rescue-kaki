
-- Unified entries table for all modules
CREATE TABLE entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  module_type text NOT NULL CHECK (module_type IN ('voice', 'photo', 'gps', 'manual')),
  timestamp timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL DEFAULT '',
  -- Voice fields
  transcription text,
  -- Photo fields
  photo_url text,
  photo_caption text,
  -- GPS / zone fields
  latitude double precision,
  longitude double precision,
  altitude double precision,
  zone_label text,
  -- Manual log fields
  template_type text,
  form_data jsonb,
  -- Shared
  location_tag text,
  is_edited boolean NOT NULL DEFAULT false
);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select_entries" ON entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_entries" ON entries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_entries" ON entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_entries" ON entries FOR DELETE TO anon, authenticated USING (true);
