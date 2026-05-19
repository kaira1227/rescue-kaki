import { supabase } from '@/db/supabase';
import { Entry, Geofence, ModuleType, SchematicSettings } from '@/types';

export async function fetchEntries(moduleType?: ModuleType): Promise<Entry[]> {
  let query = supabase
    .from('entries')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(500);

  if (moduleType) {
    query = query.eq('module_type', moduleType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function insertEntry(entry: Omit<Entry, 'id' | 'created_at' | 'is_edited'>): Promise<string> {
  const { data, error } = await supabase
    .from('entries')
    .insert({ ...entry, is_edited: false })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateEntry(
  id: string,
  updates: Partial<Omit<Entry, 'id' | 'created_at' | 'module_type' | 'timestamp'>>
): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ ...updates, is_edited: true })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadPhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `photos/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('rescue-kaki-photos')
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('rescue-kaki-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Schematic Settings ─────────────────────────────────────────────────────

export async function fetchSchematicSettings(): Promise<SchematicSettings | null> {
  const { data, error } = await supabase
    .from('schematic_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertSchematicSettings(
  updates: Partial<Omit<SchematicSettings, 'id' | 'created_at'>> & { id?: string }
): Promise<SchematicSettings> {
  if (updates.id) {
    const { data, error } = await supabase
      .from('schematic_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', updates.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data as SchematicSettings;
  }
  const { data, error } = await supabase
    .from('schematic_settings')
    .insert({ ...updates, updated_at: new Date().toISOString() })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as SchematicSettings;
}

export async function uploadSchematic(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const filePath = `schematics/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('rescue-kaki-photos')
    .upload(filePath, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('rescue-kaki-photos').getPublicUrl(filePath);
  return data.publicUrl;
}

// ─── Geofences ───────────────────────────────────────────────────────────────

export async function fetchGeofences(): Promise<Geofence[]> {
  const { data, error } = await supabase
    .from('geofences')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function insertGeofence(
  geofence: Omit<Geofence, 'id' | 'created_at'>
): Promise<Geofence> {
  const { data, error } = await supabase
    .from('geofences')
    .insert(geofence)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Geofence;
}

export async function deleteGeofence(id: string): Promise<void> {
  const { error } = await supabase.from('geofences').delete().eq('id', id);
  if (error) throw error;
}

// Pin a schematic coordinate to an existing entry
export async function pinEntryOnSchematic(
  id: string,
  schematic_x: number,
  schematic_y: number
): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ schematic_x, schematic_y })
    .eq('id', id);
  if (error) throw error;
}

// Attach a photo (url + optional caption) to any existing entry
export async function attachPhotoToEntry(
  id: string,
  photo_url: string,
  photo_caption?: string
): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ photo_url, photo_caption: photo_caption ?? null, is_edited: true })
    .eq('id', id);
  if (error) throw error;
}
