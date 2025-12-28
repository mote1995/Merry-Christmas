/**
 * Utility for photo sharing and cloud persistence
 */

const IMGBB_API_KEY = '6d207e02197a3d40d4094d1a2932a97f'; // Public test key

/**
 * Uploads a file or data URL to ImgBB
 * @param {File|string} target - File object or Base64 string
 */
export async function uploadImage(target) {
  const formData = new FormData();
  
  if (typeof target === 'string' && target.startsWith('data:')) {
    // Convert base64 to blob if needed, but ImgBB accepts base64 (without prefix)
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
    if (data.success) {
      return data.data.url;
    }
    throw new Error(data.error?.message || 'Upload failed');
  } catch (err) {
    console.error("ImgBB Upload Error:", err);
    throw err;
  }
}

/**
 * Saves state to JsonBlob
 */
export async function saveToCloud(state) {
  try {
    const response = await fetch('https://jsonblob.com/api/jsonBlob', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(state)
    });
    
    // JsonBlob returns the URL in the Location header
    const location = response.headers.get('Location');
    if (location) {
      return location.split('/').pop();
    }
    throw new Error('Location header missing');
  } catch (err) {
    console.error("JsonBlob Save Error:", err);
    throw err;
  }
}

/**
 * Updates existing JsonBlob
 */
export async function updateOnCloud(id, state) {
  try {
    const response = await fetch(`https://jsonblob.com/api/jsonBlob/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(state)
    });
    
    if (response.ok) return id;
    throw new Error(`Update failed with status: ${response.status}`);
  } catch (err) {
    console.error("JsonBlob Update Error:", err);
    throw err;
  }
}
