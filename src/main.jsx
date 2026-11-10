import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(async () => {
      // Hand the worker every same-origin asset this page already loaded, so the app
      // shell is complete in Cache Storage after the very first online visit.
      const reg = await navigator.serviceWorker.ready;
      const urls = performance.getEntriesByType("resource")
        .map(e => e.name)
        .filter(u => u.startsWith(window.location.origin));
      (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: "CACHE_URLS", urls: [window.location.href, ...urls] });
    }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
