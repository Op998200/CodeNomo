import { supabase } from './supabase.js';

const BUCKET = 'images';

export async function uploadImage(file, folder = 'transactions') {
  if (!file) return null;
  const ext = file.name.split('.').pop();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function deleteImage(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const path = decodeURIComponent(url.pathname.split('/object/public/')[1]);
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (_e) {
    // ignore
  }
}