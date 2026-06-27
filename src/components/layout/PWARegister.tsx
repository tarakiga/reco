"use client";
import { useEffect } from "react";

/** Registers the service worker (enables PWA install + web push). No UI. */
export function PWARegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
