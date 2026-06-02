// @ts-nocheck
/// <reference lib="webworker" />
// Custom service worker (injectManifest mode).
// - Precaches the app (offline + fast).
// - Handles "Share to Vault" from the Android Photos/Gallery app: it receives
//   the shared files, stashes them in the Cache, and redirects to the app,
//   which then uploads them.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Precache everything vite-plugin-pwa lists here.
precacheAndRoute(self.__WB_MANIFEST || []);

// SPA navigation fallback to index.html (but not for the API or share endpoint).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api/, /^\/share-target/],
  })
);

const SHARE_CACHE = 'vault-shared';

// Intercept the share POST. Other requests fall through to Workbox routes above.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShare(event.request));
  }
});

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files').filter((f) => f instanceof File);
    const cache = await caches.open(SHARE_CACHE);
    const ids = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = `${Date.now()}-${i}`;
      ids.push(id);
      await cache.put(
        `/__shared__/${id}`,
        new Response(f, {
          headers: {
            'content-type': f.type || 'application/octet-stream',
            'x-filename': encodeURIComponent(f.name || `shared-${id}`),
          },
        })
      );
    }
    await cache.put(
      '/__shared__/index',
      new Response(JSON.stringify(ids), { headers: { 'content-type': 'application/json' } })
    );
  } catch {
    // ignore — still redirect into the app
  }
  // Land in the app, which picks up the stashed files and uploads them.
  return Response.redirect('/?share-target=1', 303);
}
