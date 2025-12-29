import React from 'react';
import Scene from './components/Scene';
import HandTracker from './components/HandTracker';
import UI from './components/UI';
import useStore from './store';
import { getFromCloud } from './utils/sharing';

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
    const isAdmin = params.get('admin') === 'true';

    if (isAdmin) {
      useStore.getState().setIsAuthorized(true);
      console.log("Admin session detected - NAS access enabled 🛠️");
    }

    if (id) {
      // Security Check
      const ownedIds = JSON.parse(localStorage.getItem('festive_owned_ids') || '[]');
      const isOwner = ownedIds.includes(id);
      if (!isOwner && !isAdmin) useStore.getState().setIsReadOnly(true);
      if (isOwner) useStore.getState().setIsAuthorized(true);

      getFromCloud(id)
        .then(data => {
          useStore.getState().setSharedId(id);
          // Crucial: When loading a shared link, we MUST replace the local state 
          useStore.getState().setPhotos(data.photos || []); 
          if (data.bgmName && data.bgmUrl) useStore.getState().setBgm(data.bgmUrl, data.bgmName);
          if (data.config) useStore.getState().setConfig(data.config);
        })
        .catch(err => {
          console.error("Failed to load state from cloud:", err);
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
