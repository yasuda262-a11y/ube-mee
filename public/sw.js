// UBE Smart Sheets — オフライン学習用 Service Worker
//
// 扱うのは「GET かつ同一オリジン」のリクエストのみ。
// Supabase への API 通信（クロスオリジン）や POST には一切関与しないため、
// 学習データ（伏字調整・ハイライト・メモ等）の保存・同期には影響しない。
// localStorage にもアクセスしない（Service Worker からはそもそも参照不可）。

const CACHE_NAME = "ube-cache-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(["/"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ハッシュ付きビルドアセットは不変なのでキャッシュ優先
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // ページ遷移はネットワーク優先（常に最新版）、オフライン時のみキャッシュへフォールバック
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached ?? caches.match("/")))
    );
    return;
  }

  // その他（アイコン・フォント等）: キャッシュ優先、裏で更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? fetched;
    })
  );
});
