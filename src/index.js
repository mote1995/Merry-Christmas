import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

// Immediate Cleanup for Standalone Export
const loader = document.getElementById('export-loading');
if (loader) {
  console.log("[Index] JS Engine started, preparing to remove loader.");
  // We give it a tiny delay to ensure React has at least started trying to paint
  setTimeout(() => {
    if (document.getElementById('export-loading')) {
        document.getElementById('export-loading').remove();
    }
  }, 1000);
}
