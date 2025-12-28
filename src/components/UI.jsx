import React from 'react';
import useStore from '../store';

import { Music, Camera, Image as ImageIcon, Heart, Play, Pause, Snowflake, Share2, Loader } from 'lucide-react';
import { uploadImage, saveToCloud, updateOnCloud } from '../utils/sharing';

const SERVICES = [
  { url: 'https://jsonblob.com/api/jsonBlob', method: 'POST' },
  { url: 'https://api.myjson.online/v1/records', method: 'POST' } // Fallback
];

export default function UI() {
  const { phase, gesture, addPhotos, setPhotos, bgmUrl, bgmName, setBgm, isPlaying, togglePlay, setGesture, hasStarted, setHasStarted, isCameraOpen, toggleCamera, photos, sharedId, setSharedId, config, setConfig } = useStore();
  const audioRef = React.useRef(null);

  const [isSharing, setIsSharing] = React.useState(false);
  const [shareMsg, setShareMsg] = React.useState('');
  const [showPersonalize, setShowPersonalize] = React.useState(false);

  // Draggable Panel State
  const [panelPos, setPanelPos] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStart = React.useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    // Only drag from the panel backdrop, not buttons or inputs
    if (e.target.closest('button') || e.target.closest('input')) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y
    };
  };

  React.useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging) return;
      setPanelPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };

    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

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
      if (key === 'p') setGesture('point_up');
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
    setIsSharing(true);
    setShareMsg('Uploading...');
    try {
      // 1. Prepare photos (upload local blobs)
      const currentPhotos = [...useStore.getState().photos];
      const updatedPhotos = await Promise.all(currentPhotos.map(async (photo) => {
        if (photo.url.startsWith('blob:') || photo.url.startsWith('data:')) {
          try {
            const cloudUrl = await uploadImage(photo.url);
            return { ...photo, url: cloudUrl };
          } catch (e) {
            console.warn("Failed to upload a photo, keeping local:", e);
            return photo;
          }
        }
        return photo;
      }));
      
      // 2. Filter out any photos that failed to upload (no blob/data URLs allowed in cloud save)
      const cloudOnlyPhotos = updatedPhotos.filter(p => !p.url.startsWith('blob:') && !p.url.startsWith('data:'));

      // Update store with final cloud URLs
      setPhotos(cloudOnlyPhotos);

      // 3. Save state
      const stateToSave = {
        photos: cloudOnlyPhotos,
        bgmUrl: bgmUrl.startsWith('blob:') ? '' : bgmUrl,
        bgmName,
        config
      };

      setShareMsg('Saving...');
      let id = sharedId;
      if (id) {
        await updateOnCloud(id, stateToSave);
      } else {
        id = await saveToCloud(stateToSave);
        setSharedId(id);
      }

      // 3. Generate link
      const shareUrl = `${window.location.origin}${window.location.pathname}?id=${id}`;
      await navigator.clipboard.writeText(shareUrl);
      
      setShareMsg('Copied!');
      setTimeout(() => setShareMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setShareMsg('Error');
      setTimeout(() => setShareMsg(''), 3000);
    } finally {
      setIsSharing(false);
    }
  };



  return (
    <>
      {/* Start Overlay */}
      {/* Start Overlay with Envelope Effect */}
      <div className={`fixed inset-0 z-[100] transition-all duration-1000 pointer-events-none ${hasStarted ? 'opacity-0 delay-500' : 'opacity-100'}`}>
        {/* Top Half */}
        <div className={`absolute top-0 left-0 w-full h-1/2 bg-black/80 backdrop-blur-xl border-b border-white/10 transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-end justify-center pb-6 z-20 ${hasStarted ? '-translate-y-full' : 'translate-y-0'}`}>
          <div className={`pointer-events-auto transition-opacity duration-500 flex flex-col items-center gap-8 ${hasStarted ? 'opacity-0' : 'opacity-100 delay-300'}`}>
            <button
              onClick={handleStart}
              className="group relative px-6 py-2 sm:px-10 sm:py-3 bg-gradient-to-r from-vintage-gold to-yellow-500 rounded-full text-black font-bold transition-all hover:scale-110 active:scale-95 shadow-[0_0_50px_rgba(212,175,55,0.5)]"
            >
              <div className="flex items-center gap-4">
                <div className="bg-black/10 p-2 sm:p-2.5 rounded-full group-hover:bg-black/20 transition-colors">
                  <Play className="w-5 h-5 sm:w-7 sm:h-7" fill="currentColor" />
                </div>
                <span className="font-cursive text-3xl sm:text-4xl leading-tight">
                  {config.recipientName ? `Merry Christmas, ${config.recipientName}` : 'Merry Christmas'}
                </span>
              </div>
            </button>
          </div>
        </div>
        
        {/* Bottom Half */}
        <div className={`absolute bottom-0 left-0 w-full h-1/2 bg-black/80 backdrop-blur-xl border-t border-white/10 transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-start justify-center pt-16 z-20 ${hasStarted ? 'translate-y-full' : 'translate-y-0'}`}>
          <div className={`transition-opacity duration-500 ${hasStarted ? 'opacity-0' : 'opacity-100 delay-300'}`}>
            <p className="text-white/60 text-[10px] sm:text-xs tracking-[0.4em] uppercase animate-pulse">
              {config.greeting || 'Tap to open'}
            </p>
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
          Phase: {phase} | Sync: 05:52:00
        </div>
        {/* Hidden on very small screens or made smaller */}
        <div className="hidden sm:block mt-4 p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-[10px] max-w-[240px]">
           <p className="font-bold mb-2 text-vintage-gold tracking-widest text-xs">INTERACTION GUIDE:</p>
           <ul className="space-y-1.5 opacity-90">
             <li>• ✋ <span className="text-white font-semibold">Open Palm / O</span>: Bloom</li>
             <li>• ✊ <span className="text-white font-semibold">Closed Fist / F</span>: Reset</li>
             <li>• ↔️ <span className="text-white font-semibold">Swipe / A-D</span>: Spin View</li>
             <li>• ☝️ <span className="text-white font-semibold">Point Up / P</span>: Magnetic Focus</li>
           </ul>
        </div>
      </div>

      {/* Control Panel - Positioned Under Camera (Draggable Stack) */}
      <div 
        className="w-full max-w-md pointer-events-auto mb-4 sm:fixed sm:top-[200px] sm:right-12 sm:w-auto sm:mb-0 cursor-move"
        style={{ transform: `translate(${panelPos.x}px, ${panelPos.y}px)` }}
        onPointerDown={handlePointerDown}
      >
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
              onClick={toggleCamera}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 hover:bg-white/10 rounded-xl transition-colors group ${isCameraOpen ? 'bg-white/10' : ''}`}
            >
              <div className={`p-1.5 rounded-full transition-colors ${isCameraOpen ? 'bg-red-500/20' : 'bg-white/5 group-hover:bg-vintage-gold/20'}`}>
                <Camera size={14} className={isCameraOpen ? "text-red-400" : "text-vintage-gold"} />
              </div>
              <span className="text-[9px] font-bold text-vintage-gold uppercase tracking-widest">{isCameraOpen ? 'Close' : 'Camera'}</span>
            </button>

            <button 
              onClick={handleShare}
              disabled={isSharing}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 hover:bg-white/10 rounded-xl transition-colors group relative ${isSharing ? 'opacity-50' : ''}`}
            >
              <div className="p-1.5 bg-white/5 rounded-full group-hover:bg-vintage-gold/20 transition-colors">
                {isSharing ? (
                  <Loader size={14} className="text-vintage-gold animate-spin" />
                ) : (
                  <Share2 size={14} className="text-vintage-gold" />
                )}
              </div>
              <span className="text-[9px] font-bold text-vintage-gold uppercase tracking-widest">
                {shareMsg || (sharedId ? 'Update' : 'Share')}
              </span>
            </button>
          </div>

          {/* Personalization Panel */}
          <div className="mt-4 flex flex-col gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowPersonalize(!showPersonalize); }}
              className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-vintage-gold text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              {showPersonalize ? 'Close Personalization' : 'Personalize Gift'}
            </button>

            {showPersonalize && (
              <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-1">
                  <label className="text-[9px] text-white/50 uppercase tracking-widest ml-1">Recipient Name</label>
                  <input 
                    type="text" 
                    value={config.recipientName}
                    onChange={(e) => setConfig({ recipientName: e.target.value })}
                    placeholder="Enter name..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-vintage-gold/50"
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-white/50 uppercase tracking-widest ml-1">Theme Color</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { 
                        name: 'Pink Gold', 
                        tree: '#FFB6C1', 
                        ornaments: ['#D4AF37', '#FFF5EE', '#FFD700', '#E0BFB8'],
                        preview: 'linear-gradient(135deg, #FFB6C1, #D4AF37)'
                      },
                      { 
                        name: 'Emerald Gold', 
                        tree: '#2d5a27', 
                        ornaments: ['#D4AF37', '#FF0000', '#F7E7CE', '#C0C0C0'],
                        preview: 'linear-gradient(135deg, #2d5a27, #D4AF37)'
                      },
                      { 
                        name: 'Winter Frost', 
                        tree: '#0047AB', 
                        ornaments: ['#FFFFFF', '#DC143C', '#C0C0C0', '#87CEFA'],
                        preview: 'linear-gradient(135deg, #0047AB, #FFFFFF)'
                      },
                      { 
                        name: 'Midnight', 
                        tree: '#191970', 
                        ornaments: ['#C0C0C0', '#E6E6FA', '#D4AF37', '#B0C4DE'],
                        preview: 'linear-gradient(135deg, #191970, #C0C0C0)'
                      }
                    ].map((t) => (
                      <button
                        key={t.name}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setConfig({ palette: { name: t.name, tree: t.tree, ornaments: t.ornaments } })}
                        className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all hover:scale-105 ${config.palette.name === t.name ? 'border-vintage-gold bg-white/10' : 'border-transparent bg-white/5 opacity-60'}`}
                      >
                        <div className="w-4 h-4 rounded-full" style={{ background: t.preview }} />
                        <span className="text-[9px] text-white font-bold uppercase tracking-tighter">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-white/50 uppercase tracking-widest ml-1">Custom Message</label>
                  <textarea 
                    value={config.greeting}
                    onChange={(e) => setConfig({ greeting: e.target.value })}
                    placeholder="Happy Holidays..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-vintage-gold/50 h-16 resize-none"
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
