import { create } from 'zustand';

const useStore = create((set) => ({
  // Phase: 'tree' | 'blooming'
  phase: 'tree',
  setPhase: (phase) => set({ phase }),

  // Gesture: 'none' | 'open' | 'fist' | 'pinch'
  gesture: 'none',
  setGesture: (gesture) => set({ gesture }),

  // Hand data: results from MediaPipe
  handResults: null,
  setHandResults: (results) => set({ handResults: results }),
  handVelocityX: 0,
  setHandVelocityX: (v) => set({ handVelocityX: v }),

  // Camera state
  isCameraOpen: false,
  toggleCamera: () => set((state) => ({ isCameraOpen: !state.isCameraOpen })),

  // Photos
  photos: [],
  addPhoto: (url) => set((state) => ({ 
    photos: [...state.photos, { url, id: Date.now() + Math.random(), aspect: 1 }] 
  })),
  addPhotos: (urls) => set((state) => ({
    photos: [...state.photos, ...urls.map(url => ({ url, id: Date.now() + Math.random(), aspect: 1 }))]
  })),
  setPhotos: (photos) => set({ photos }),
  setPhotoAspect: (id, aspect) => set((state) => ({
    photos: state.photos.map(p => p.id === id ? { ...p, aspect } : p)
  })),

  // Music state
  bgmUrl: 'audio/default_bgm.mp3',
  bgmName: 'Christmas List - Anson Seabra', // Default
  isPlaying: true,
  setBgm: (url, name) => set({ bgmUrl: url, bgmName: name, isPlaying: true }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  // Carousel/Nebula state
  rotation: 0,
  setRotation: (val) => set({ rotation: val }),
  
  // Experience Start State
  hasStarted: false,
  setHasStarted: (val) => set({ hasStarted: val }),

  // Focused photo ID
  focusedId: null,
  setFocusedId: (id) => set({ focusedId: id }),

  // Keyboard Override
  isKeyboardPinch: false,
  setKeyboardPinch: (val) => set({ isKeyboardPinch: val }),
}));

export default useStore;
