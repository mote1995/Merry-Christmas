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
      const { NAS_URL } = require('./utils/sharing');
      const fetchUrl = NAS_URL 
        ? `${NAS_URL}/api/records/${id}`
        : `https://jsonblob.com/api/jsonBlob/${id}`;

      fetch(fetchUrl)
        .then(res => res.json())
        .then(data => {
          useStore.getState().setSharedId(id);
          if (data.photos) useStore.getState().setPhotos(data.photos);
          if (data.bgmName && data.bgmUrl) useStore.getState().setBgm(data.bgmUrl, data.bgmName);
          if (data.config) useStore.getState().setConfig(data.config);
        })
        .catch(err => {
          console.error("Failed to load state, trying fallback:", err);
          // Fallback if NAS failed but ID might be from JsonBlob
          if (NAS_URL) {
             fetch(`https://jsonblob.com/api/jsonBlob/${id}`)
               .then(res => res.json())
               .then(data => {
                 useStore.getState().setSharedId(id);
                 if (data.photos) useStore.getState().setPhotos(data.photos);
                 if (data.bgmName && data.bgmUrl) useStore.getState().setBgm(data.bgmUrl, data.bgmName);
               }).catch(e => console.error("All fallback failed:", e));
          }
        });
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
