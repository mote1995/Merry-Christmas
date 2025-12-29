// import { createClient } from '@supabase/supabase-js'; // Use global from CDN
import useStore from '../store';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://tkahjrcvmawogghkswdi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_d4Scvt92j5e_r75-wDGTEA_Al2e48nb';

let supabaseInstance;

function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  
  try {
    const createClient = window.supabase?.createClient;
    if (typeof createClient === 'function') {
      supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("[Supabase] Initialized via getSupabase helper");
      return supabaseInstance;
    }
  } catch (e) {
    console.error("[Supabase] Lazy init fail:", e);
  }
  return null;
}

const IMGBB_API_KEY = '6d207e02197a3d40d4094d1a2932a97f';

/**
 * Uploads a file or data URL 
 */
export async function uploadImage(target) {
  if (useStore.getState().isReadOnly) throw new Error('Action restricted: Read-only mode active');

  console.log("[uploadImage] Starting upload...");

  // 1. Try Supabase Storage
  const supabase = getSupabase();
  if (supabase && supabase.storage) {
    try {
      let blob;
      if (typeof target === 'string' && (target.startsWith('data:') || target.startsWith('blob:'))) {
        const response = await fetch(target);
        blob = await response.blob();
      } else {
        blob = target;
      }

      const fileName = `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      console.log(`[uploadImage] Attempting Supabase upload: ${fileName}`);
      
      const { data, error } = await supabase.storage
        .from('memories')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (error) {
        console.error("[uploadImage] Supabase error:", error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('memories')
        .getPublicUrl(data.path);

      console.log("[uploadImage] Supabase upload success:", publicUrl);
      return publicUrl;
    } catch (err) {
      console.warn("[uploadImage] Supabase failed, falling back:", err);
    }
  } else {
    console.warn("[uploadImage] Supabase storage not available, using fallback");
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
    console.error("[uploadImage] ImgBB fallback failed:", err);
    throw err;
  }
}

/**
 * Saves state 
 */
export async function saveToCloud(state) {
  if (useStore.getState().isReadOnly) throw new Error('Action restricted: Read-only mode active');

  console.log("[saveToCloud] Attempting save...");

  // 1. Try Supabase
  const supabase = getSupabase();
  if (supabase && supabase.from) {
    try {
      console.log("[saveToCloud] Inserting into records table...");
      const { data, error } = await supabase
        .from('records')
        .insert([{
          photos: state.photos,
          bgm_url: state.bgmUrl,
          bgm_name: state.bgmName,
          config: state.config
        }])
        .select();

      if (error) {
        console.error("[saveToCloud] Supabase error:", error);
        throw error;
      }
      if (data && data[0]) {
        console.log("[saveToCloud] Supabase save success:", data[0].id);
        return data[0].id;
      }
    } catch (err) {
      console.warn("[saveToCloud] Supabase failed, falling back:", err);
    }
  }

  // 2. Fallback -> Use JsonBlob
  console.log("[saveToCloud] Using JsonBlob fallback...");
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
  const supabase = getSupabase();
  if (supabase && supabase.from) {
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
  }
  
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
  const supabase = getSupabase();
  if (supabase && supabase.from) {
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
  }

  const response = await fetch(`https://jsonblob.com/api/jsonBlob/${id}`);
  if (response.ok) return await response.json();
  
  throw new Error('Record not found');
}

// --- DEBUG EXPORT ---
if (typeof window !== 'undefined') {
  window.__sharing = { 
    uploadImage, 
    saveToCloud, 
    getFromCloud, 
    getSupabase,
    get supabase() { return getSupabase(); }
  };
}
