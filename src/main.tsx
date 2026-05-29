import * as React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Удаляем ранее зарегистрированный service worker и его кэш —
// он вызывал циклические перезагрузки и ошибки сети на домене.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    let hadSw = false;
    regs.forEach((r) => {
      hadSw = true;
      r.unregister();
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
    // Если у пользователя был активный SW — один раз перезагружаем,
    // чтобы получить чистую рабочую версию без кэша.
    if (hadSw && !sessionStorage.getItem("sw_cleaned")) {
      sessionStorage.setItem("sw_cleaned", "1");
      window.location.reload();
    }
  }).catch(() => {});
}