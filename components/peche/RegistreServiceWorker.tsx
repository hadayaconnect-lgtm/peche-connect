"use client";

import { useEffect } from "react";

export default function RegistreServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Échec d'enregistrement du service worker :", err);
      });
    }
  }, []);
  return null;
}
