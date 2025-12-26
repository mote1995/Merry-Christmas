import React from 'react';
import useStore from '../store';

import { Music, Camera, Image as ImageIcon, Heart, Play, Pause, Share2, Upload, Snowflake } from 'lucide-react';

const SERVICES = [
  { url: 'https://jsonblob.com/api/jsonBlob', method: 'POST' },
  { url: 'https://api.myjson.online/v1/records', method: 'POST' } // Fallback
];

export default function UI() {
  const { phase, gesture, addPhotos, setPhotos, bgmUrl, bgmName, setBgm, isPlaying, togglePlay, setGesture, hasStarted, setHasStarted, isCameraOpen, toggleCamera } = useStore();
  const [isSharing, setIsSharing] = React.useState(false);
  const audioRef = React.useRef(null);

  const handleMusicUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgm(url, file.name.replace(/\.[^/.]+$/, "")); // Set URL and name (without extension)
    }
  };

  const handleStart = () => {
    setHasStarted(true);
    if (audioRef.current && useStore.getState().isPlaying) {
      audioRef.current.play().catch(console.error);
    }
  };

  React.useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.log("Autoplay blocked, waiting for interaction...");
          // Handle autoplay block by adding a one-time interaction listener
          const startAudio = () => {
            if (useStore.getState().isPlaying) {
              audioRef.current.play().catch(console.error);
            }
            window.removeEventListener('click', startAudio);
            window.removeEventListener('touchstart', startAudio);
          };
          window.addEventListener('click', startAudio);
          window.addEventListener('touchstart', startAudio);
        });
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
    <>
      {/* Start Overlay */}
      {/* Start Overlay with Envelope Effect */}
      <div className={`fixed inset-0 z-[100] transition-all duration-1000 pointer-events-none ${hasStarted ? 'opacity-0 delay-500' : 'opacity-100'}`}>
        {/* Top Half */}
        <div className={`absolute top-0 left-0 w-full h-1/2 bg-black/80 backdrop-blur-xl border-b border-white/10 transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-end justify-center pb-12 z-20 ${hasStarted ? '-translate-y-full' : 'translate-y-0'}`}>
          <div className={`transition-opacity duration-500 ${hasStarted ? 'opacity-0' : 'opacity-100 delay-300'}`}>
             <h2 className="text-5xl sm:text-7xl font-cursive text-transparent bg-clip-text bg-gradient-to-b from-vintage-gold to-yellow-200 drop-shadow-[0_0_20px_rgba(212,175,55,0.6)]">
              Merry Christmas
            </h2>
          </div>
        </div>
        
        {/* Bottom Half */}
        <div className={`absolute bottom-0 left-0 w-full h-1/2 bg-black/80 backdrop-blur-xl border-t border-white/10 transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-start justify-center pt-12 z-20 ${hasStarted ? 'translate-y-full' : 'translate-y-0'}`}>
          <div className={`pointer-events-auto transition-opacity duration-500 flex flex-col items-center gap-6 ${hasStarted ? 'opacity-0' : 'opacity-100 delay-300'}`}>
            <button
              onClick={handleStart}
              className="group relative px-12 py-5 bg-gradient-to-r from-vintage-gold to-yellow-500 rounded-full text-black font-bold text-xl transition-all hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(212,175,55,0.4)]"
            >
              <div className="flex items-center gap-3">
                <div className="bg-black/10 p-2 rounded-full group-hover:bg-black/20 transition-colors">
                  <Play size={24} fill="currentColor" />
                </div>
                <span>Start Experience</span>
              </div>
            </button>
            <p className="text-white/40 text-xs tracking-widest uppercase">Tap to Open Your gift</p>
          </div>
        </div>
      </div>

      <div className={`absolute inset-x-0 inset-y-0 pointer-events-none z-40 select-none flex flex-col items-center justify-between p-4 sm:p-8 transition-opacity duration-1000 ${hasStarted ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header Title */}
      <div className="w-full text-center mt-4 sm:mt-12">
        <h1 className="text-4xl sm:text-6xl font-cursive text-transparent bg-clip-text bg-gradient-to-b from-vintage-gold to-yellow-200 drop-shadow-[0_0_15px_rgba(212,175,55,0.8)] px-4">
          Merry Christmas
        </h1>
      </div>

      {/* Top Left Status / Guide - Repositioned for mobile */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 text-white/70 space-y-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${gesture !== 'none' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-[10px] sm:text-xs font-medium tracking-widest uppercase">Gesture: {gesture}</span>
        </div>
        <div className="text-[9px] sm:text-[10px] opacity-50 uppercase tracking-tighter">
          Phase: {phase}
        </div>
        {/* Hidden on very small screens or made smaller */}
        <div className="hidden sm:block mt-4 p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-xs max-w-[220px]">
           <p className="font-bold mb-2 text-vintage-gold tracking-widest">INTERACTION GUIDE:</p>
           <ul className="space-y-1.5 opacity-90">
             <li>• <span className="text-white font-semibold">Open Palm (O)</span>: Bloom / Slow</li>
             <li>• <span className="text-white font-semibold">Wave (A/D)</span>: Faster Rotate</li>
             <li>• <span className="text-white font-semibold">Closed Fist (F)</span>: Reset Tree</li>
             <li>• <span className="text-white font-semibold">Pinch (P)</span>: Focus Photo</li>
           </ul>
        </div>
      </div>

      {/* Bottom Player - Centered and responsive on mobile */}
      <div className="w-full max-w-md pointer-events-auto mb-4 sm:absolute sm:bottom-8 sm:right-8 sm:w-auto sm:mb-0">
        <audio ref={audioRef} src={bgmUrl} loop />
        
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-3 sm:p-4 rounded-3xl flex flex-col sm:flex-row items-center gap-2 sm:gap-4 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(212,175,55,0.3)] transition-all duration-1000 animate-pulse-slow">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative shrink-0">
               {/* Rotating Snowflake Icon */}
              <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-tr from-cyan-100 to-blue-200 rounded-full flex items-center justify-center ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black/80 rounded-full flex items-center justify-center overflow-hidden">
                  <Snowflake size={16} className="text-cyan-200" />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
              <span className="text-[9px] text-vintage-gold font-bold tracking-[0.2em] uppercase">Now Playing</span>
              {/* Marquee Effect */}
              <div className="relative w-32 sm:w-40 h-5 overflow-hidden">
                 <div className="absolute whitespace-nowrap animate-marquee text-xs sm:text-sm font-semibold text-white">
                   {bgmName} &nbsp;&bull;&nbsp; {bgmName} &nbsp;&bull;&nbsp;
                 </div>
              </div>
            </div>
            
            <button 
              onClick={togglePlay}
              className="p-2 hover:bg-white/10 rounded-full transition-colors group shrink-0"
            >
              {isPlaying ? (
                <Pause size={18} className="text-vintage-gold" />
              ) : (
                <Play size={18} className="text-white" />
              )}
            </button>
          </div>

          </div>
          
          <div className="h-8 w-px bg-white/10 hidden sm:block"></div>

          <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t border-white/10 sm:border-t-0 justify-center">
            <label className="flex flex-col items-center gap-1 py-1.5 px-3 hover:bg-white/10 rounded-xl cursor-pointer transition-colors group">
              <input type="file" className="hidden" onChange={handlePhotoUpload} accept="image/*" multiple />
              <div className="p-1.5 bg-white/5 rounded-full group-hover:bg-vintage-gold/20 transition-colors">
                <ImageIcon size={14} className="text-vintage-gold" />
              </div>
              <span className="text-[9px] font-bold text-vintage-gold uppercase tracking-widest">Memory</span>
            </label>

            <button 
              onClick={handleShare}
              disabled={isSharing}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 hover:bg-white/10 rounded-xl transition-colors group ${isSharing ? 'opacity-50' : ''}`}
            >
              <div className="p-1.5 bg-white/5 rounded-full group-hover:bg-vintage-gold/20 transition-colors">
                <Share2 size={14} className="text-vintage-gold" />
              </div>
              <span className="text-[9px] font-bold text-vintage-gold uppercase tracking-widest">{isSharing ? '...' : 'Share'}</span>
            </button>
            <button 
                onClick={handleImport}
                className="flex flex-col items-center gap-1 py-1.5 px-3 hover:bg-white/10 rounded-xl transition-colors group"
              >
                <div className="p-1.5 bg-white/5 rounded-full group-hover:bg-vintage-gold/20 transition-colors">
                   <Upload size={14} className="text-vintage-gold rotate-180" />
                </div>
                <span className="text-[9px] font-bold text-vintage-gold uppercase tracking-widest">Import</span>
              </button>
              
            <button 
              onClick={toggleCamera}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 hover:bg-white/10 rounded-xl transition-colors group ${isCameraOpen ? 'bg-white/10' : ''}`}
            >
              <div className={`p-1.5 rounded-full transition-colors ${isCameraOpen ? 'bg-red-500/20' : 'bg-white/5 group-hover:bg-vintage-gold/20'}`}>
                <Camera size={14} className={isCameraOpen ? "text-red-400" : "text-vintage-gold"} />
              </div>
              <span className="text-[9px] font-bold text-vintage-gold uppercase tracking-widest">{isCameraOpen ? 'Close' : 'Camera'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
