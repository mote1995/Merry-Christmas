/**
 * Utility for photo sharing and cloud persistence
 */

const IMGBB_API_KEY = '6d207e02197a3d40d4094d1a2932a97f'; // Public test key

// Configure your NAS URL here. Example: 'http://192.168.1.100:3001'
// If empty, it will use cloud fallbacks (ImgBB/JsonBlob)
export const NAS_URL = 'https://remote-access-32769.zconnect.cn'; 

/**
 * Uploads a file or data URL 
 */
export async function uploadImage(target) {
  // Try NAS first if configured
  if (NAS_URL) {
    try {
      const formData = new FormData();
      if (typeof target === 'string' && target.startsWith('data:')) {
        const response = await fetch(target);
        const blob = await response.blob();
        formData.append('image', blob, 'memory.jpg');
      } else {
        formData.append('image', target);
      }

      const res = await fetch(`${NAS_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) return data.url;
    } catch (err) {
      console.warn("NAS Upload failed, falling back to ImgBB:", err);
    }
  }

  // Fallback to ImgBB
  const formData = new FormData();
  if (typeof target === 'string' && target.startsWith('data:')) {
    formData.append('image', target.split(',')[1]);
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
  if (NAS_URL) {
    try {
      const res = await fetch(`${NAS_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      const data = await res.json();
      if (data.success) return data.id;
    } catch (err) {
      console.warn("NAS Save failed, falling back to JsonBlob:", err);
    }
  }

  // Fallback to JsonBlob
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
  if (NAS_URL) {
    try {
      const res = await fetch(`${NAS_URL}/api/records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      const data = await res.json();
      if (data.success) return id;
    } catch (err) {
      console.warn("NAS Update failed, falling back to JsonBlob:", err);
    }
  }

  const response = await fetch(`https://jsonblob.com/api/jsonBlob/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(state)
  });
  if (response.ok) return id;
  throw new Error('Cloud update failed');
}
