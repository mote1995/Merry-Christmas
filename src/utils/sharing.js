import { createClient } from '@supabase/supabase-js';
import useStore from '../store';

// --- CONFIGURATION ---
// Replace these with your actual Supabase project details
const SUPABASE_URL = 'https://tkahjrcvmawogghkswdi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_d4Scvt92j5e_r75-wDGTEA_Al2e48nb';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const IMGBB_API_KEY = '6d207e02197a3d40d4094d1a2932a97f'; // Public test key

/**
 * Uploads a file or data URL 
 */
export async function uploadImage(target) {
  // Security check: Don't allow uploads if in read-only mode
  if (useStore.getState().isReadOnly) {
    throw new Error('Action restricted: Read-only mode active');
  }

  // 1. Try Supabase Storage first for all users
  try {
    let blob;
    if (typeof target === 'string' && (target.startsWith('data:') || target.startsWith('blob:'))) {
      const response = await fetch(target);
      blob = await response.blob();
    } else {
      blob = target;
    }

    const fileName = `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
    const { data, error } = await supabase.storage
      .from('memories')
      .upload(fileName, blob, { contentType: 'image/jpeg' });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('memories')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (err) {
    console.warn("Supabase Upload failed, falling back to ImgBB:", err);
  }

  // 2. Fallback -> Use ImgBB
  const formData = new FormData();
  if (typeof target === 'string' && (target.startsWith('data:') || target.startsWith('blob:'))) {
    const response = await fetch(target);
    const blob = await response.blob();
    formData.append('image', blob, 'memory.jpg');
  } else {
    formData.append('image', target);
  }

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (data.success) return data.data.url;
    throw new Error(data.error?.message || 'Upload failed');
  } catch (err) {
    console.error("Cloud Upload Error:", err);
    throw err;
  }
}

/**
 * Saves state 
 */
export async function saveToCloud(state) {
  // Security check: Don't allow saves if in read-only mode
  if (useStore.getState().isReadOnly) {
    throw new Error('Action restricted: Read-only mode active');
  }

  // 1. Try Supabase Database first for all users
  try {
    const { data, error } = await supabase
      .from('records')
      .insert([{
        photos: state.photos,
        bgm_url: state.bgmUrl,
        bgm_name: state.bgmName,
        config: state.config
      }])
      .select();

    if (error) throw error;
    return data[0].id;
  } catch (err) {
    console.warn("Supabase Save failed, falling back to JsonBlob:", err);
  }

  // 2. Fallback -> Use JsonBlob
  const response = await fetch('https://jsonblob.com/api/jsonBlob', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(state)
  });
  const location = response.headers.get('Location');
  if (location) return location.split('/').pop();
  throw new Error('Cloud save failed');
}

/**
 * Updates existing record
 */
export async function updateOnCloud(id, state) {
  // Try Supabase first
  try {
    const { error } = await supabase
      .from('records')
      .update({
        photos: state.photos,
        bgm_url: state.bgmUrl,
        bgm_name: state.bgmName,
        config: state.config
      })
      .eq('id', id);

    if (error) throw error;
    return id;
  } catch (err) {
    console.warn("Supabase Update failed, trying JsonBlob fallback:", err);
  }
  
  // Minimal fallback for JsonBlob update if needed
  try {
    const response = await fetch(`https://jsonblob.com/api/jsonBlob/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(state)
    });
    if (response.ok) return id;
  } catch(e) {}
  
  return id;
}

/**
 * Fetch record from Supabase or JsonBlob
 */
export async function getFromCloud(id) {
  // Try Supabase first (if ID looks like a UUID or just check both)
  try {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      return {
        photos: data.photos,
        bgmUrl: data.bgm_url,
        bgmName: data.bgm_name,
        config: data.config
      };
    }
  } catch (err) {
    console.warn("Supabase fetch failed, trying JsonBlob...");
  }

  // Fallback to JsonBlob
  const response = await fetch(`https://jsonblob.com/api/jsonBlob/${id}`);
  if (response.ok) return await response.json();
  
  throw new Error('Record not found');
}
