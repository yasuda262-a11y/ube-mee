"use client";

import { useEffect } from "react";

/** Service Worker の登録のみ行う（本番ビルド時のみ有効） */
export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
