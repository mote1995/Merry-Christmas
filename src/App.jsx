import React from 'react';
import Scene from './components/Scene';
import HandTracker from './components/HandTracker';
import UI from './components/UI';
import useStore from './store';

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  React.useEffect(() => {
    // 0. Cleanup Export Loading Guard if exists (React-side confirmation)
    const loader = document.getElementById('export-loading');
    if (loader) {
      console.log("[App] React mounted, removing loading guard.");
      loader.remove();
    }

    // 1. Check for Standalone Inline Data
    if (window.__FESTIVE_MEMORY__) {
      const data = window.__FESTIVE_MEMORY__;
      if (data.photos) useStore.getState().setPhotos(data.photos);
      if (data.bgmName && data.bgmUrl) useStore.getState().setBgm(data.bgmUrl, data.bgmName);
      console.log("Standalone Memory Hydrated! 🎄");
      return;
    }

    // 2. Check for Cloud ID
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      fetch(`https://jsonblob.com/api/jsonBlob/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.photos) useStore.getState().setPhotos(data.photos);
          if (data.bgmName && data.bgmUrl) useStore.getState().setBgm(data.bgmUrl, data.bgmName);
        })
        .catch(err => console.error("Failed to load shared state:", err));
    }
  }, []);

  return (
    <div className="w-full h-screen bg-black">
      <ErrorBoundary>
        <Scene />
        <HandTracker />
        <UI />
      </ErrorBoundary>
    </div>
  );
}
