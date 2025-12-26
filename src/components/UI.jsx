import React from 'react';
import useStore from '../store';

const SERVICES = [
  { url: 'https://jsonblob.com/api/jsonBlob', method: 'POST' },
  { url: 'https://api.myjson.online/v1/records', method: 'POST' } // Fallback
];
import { Music, Camera, Image as ImageIcon, Heart, Play, Pause, Share2, Upload } from 'lucide-react';

export default function UI() {
  const { phase, gesture, addPhotos, setPhotos, bgmUrl, bgmName, setBgm, isPlaying, togglePlay, setGesture } = useStore();
  const [isSharing, setIsSharing] = React.useState(false);
  const audioRef = React.useRef(null);

  const handleMusicUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgm(url, file.name.replace(/\.[^/.]+$/, "")); // Set URL and name (without extension)
    }
  };

  React.useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.log("Audio play blocked:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  React.useEffect(() => {
    if (bgmUrl && audioRef.current) {
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(e => console.log("Audio play blocked:", e));
      }
    }
  }, [bgmUrl]);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'p') setGesture('pinch');
      if (key === 'o') setGesture('open');
      if (key === 'f') setGesture('fist');
      if (key === 'a') {
        setGesture('wave');
        useStore.getState().setHandVelocityX(-0.1);
      }
      if (key === 'd') {
        setGesture('wave');
        useStore.getState().setHandVelocityX(0.1);
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['p', 'o', 'f', 'a', 'd'].includes(key)) {
        setGesture('none');
        if (key === 'a' || key === 'd') {
          useStore.getState().setHandVelocityX(0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setGesture]);

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const urls = files.map(file => URL.createObjectURL(file));
      addPhotos(urls);
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    let payload = "";
    try {
      const photos = useStore.getState().photos;
      const compressedPhotos = await Promise.all(photos.map(async (p) => {
        const base64 = await compressImage(p.url);
        return { ...p, url: base64 };
      }));

      const stateToSave = {
        photos: compressedPhotos,
        bgmName: bgmName,
        bgmUrl: bgmUrl?.startsWith('blob:') ? null : bgmUrl
      };

      payload = JSON.stringify(stateToSave);
      const sizeInKb = (payload.length * 2) / 1024;
      
      if (sizeInKb > 600) {
        throw new Error(`Data too large (${sizeInKb.toFixed(0)}KB). Please remove 1-2 photos.`);
      }

      // Try multiple services
      let blobId = null;
      let serviceType = 'jsonblob';

      try {
        const res = await fetch('https://jsonblob.com/api/jsonBlob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });
        if (res.ok) blobId = res.headers.get('Location').split('/').pop();
      } catch (e) {
        console.warn("JsonBlob failed, trying fallback...");
      }

      if (!blobId) {
        // Fallback to myjson.online or similar if needed, or just fail to backup
        throw new Error("Cloud save failed (Network/CORS). Use 'Export' instead.");
      }

      const shareUrl = `${window.location.origin}${window.location.pathname}?id=${blobId}`;
      prompt("Your link is ready! Copy and share:", shareUrl);
    } catch (err) {
      console.error(err);
      if (payload && confirm(`${err.message}\n\nWould you like to download your festive memory as a backup file instead? (You can send this file to your friend)`)) {
        downloadConfig(payload);
      } else {
        alert(`Share failed: ${err.message}`);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const downloadConfig = (data) => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Christmas_Memory_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.photos) setPhotos(data.photos);
          if (data.bgmUrl && !data.bgmUrl.startsWith('blob:')) setBgm(data.bgmUrl, data.bgmName);
          alert("Festive Memory Imported! 🎄");
        } catch (err) {
          alert("Invalid file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const compressImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 300; // Reduced from 400
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // Use JPEG 0.5 for aggressive compression
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.src = url;
    });
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40 select-none">
      {/* Header Title */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 text-center">
        <h1 className="text-6xl font-cursive text-transparent bg-clip-text bg-gradient-to-b from-vintage-gold to-yellow-200 drop-shadow-[0_0_15px_rgba(212,175,55,0.8)]">
          Merry Christmas
        </h1>
      </div>

      {/* Top Left Status */}
      <div className="absolute top-8 left-8 text-white/70 space-y-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${gesture !== 'none' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-xs font-medium tracking-widest uppercase">Gesture: {gesture}</span>
        </div>
        <div className="text-[10px] opacity-50 uppercase tracking-tighter">
          Phase: {phase}
        </div>
        <div className="mt-4 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-[9px] max-w-[180px]">
           <p className="font-bold mb-1">GUIDE:</p>
           <p>• Open Palm (O): Bloom / Slow</p>
           <p>• Wave (A/D): Faster Rotate</p>
           <p>• Closed Fist (F): Reset Tree</p>
           <p>• Pinch (P): Focus Photo</p>
        </div>
      </div>

      {/* Bottom Right Player */}
      <div className="absolute bottom-8 right-8 pointer-events-auto">
        {/* Hidden Audio Element */}
        <audio ref={audioRef} src={bgmUrl} loop />
        
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-3xl flex items-center gap-4 shadow-2xl">
          <div className="relative">
            <div className={`w-12 h-12 bg-gradient-to-tr from-vintage-gold to-yellow-200 rounded-full flex items-center justify-center ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`}>
              <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                <Music size={16} className="text-vintage-gold" />
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-vintage-gold font-bold tracking-[0.2em]">NOW PLAYING</span>
            <span className="text-sm font-semibold truncate w-40">{bgmName}</span>
          </div>
          <div className="flex gap-2 items-center">
            {/* Play/Pause Toggle */}
            <button 
              onClick={togglePlay}
              className="p-2 hover:bg-white/10 rounded-full transition-colors group"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={20} className="text-vintage-gold group-active:scale-95 transition-transform" />
              ) : (
                <Play size={20} className="text-white group-active:scale-95 transition-transform" />
              )}
            </button>
            
            <label className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-colors">
              <input type="file" className="hidden" onChange={handleMusicUpload} accept="audio/*" />
              <span className="text-xs font-bold text-vintage-gold">Music</span>
            </label>
            <label className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition-colors">
              <input type="file" className="hidden" onChange={handlePhotoUpload} accept="image/*" multiple />
              <span className="text-xs font-bold text-vintage-gold">Memory</span>
            </label>
            <div className="flex gap-1 items-center">
              <button 
                onClick={handleShare}
                disabled={isSharing}
                className={`p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-1 ${isSharing ? 'opacity-50' : ''}`}
              >
                <Share2 size={16} className="text-vintage-gold" />
                <span className="text-xs font-bold text-vintage-gold">{isSharing ? 'Saving...' : 'Share'}</span>
              </button>
              <button 
                onClick={handleImport}
                title="Import Memory File"
                className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center opacity-60 hover:opacity-100"
              >
                <Upload size={16} className="text-vintage-gold" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
