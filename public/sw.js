/* Service Worker — يخزّن واجهة التطبيق فقط (HTML / JS / CSS / الخطوط / الأيقونات).
 *
 * مهم: بيانات الأجهزة والصور محفوظة في IndexedDB، وهذا الملف لا يقرؤها ولا يكتبها ولا يخزّنها.
 * يُستبدل __BUILD_ID__ تلقائيًا عند `npm run build`، فيتغيّر اسم الكاش مع كل نسخة
 * ويُحذف الكاش القديم عند التفعيل. تحديث الواجهة لا يمسّ قاعدة البيانات إطلاقًا.
 */
const BUILD = '__BUILD_ID__';
const SHELL_CACHE = `am-shell-${BUILD}`;
const RUNTIME_CACHE = `am-runtime-${BUILD}`;
const SCOPE = self.registration.scope;
const INDEX_URL = new URL('./index.html', SCOPE).href;

const STATIC_SHELL = ['./manifest.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

// خطوط Cairo العربية واللاتينية فقط (تجنّب تنزيل كل الأحرف الأخرى)
const WANTED_FONT = /-(arabic|latin)-\d{3}-normal.*\.woff2$/;

async function precache() {
  const cache = await caches.open(SHELL_CACHE);

  // 1) صفحة التطبيق
  const res = await fetch(INDEX_URL, { cache: 'reload' });
  if (!res.ok) throw new Error('index.html unavailable');
  const html = await res.clone().text();
  await cache.put(INDEX_URL, res.clone());
  await cache.put(new URL('./', SCOPE).href, res);

  // 2) ملفات JS/CSS المذكورة في الصفحة (أسماؤها تحتوي بصمة النسخة)
  const urls = new Set(STATIC_SHELL.map((p) => new URL(p, SCOPE).href));
  for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    try {
      const u = new URL(m[1], INDEX_URL);
      if (u.origin === self.location.origin && /\.(js|css)$/.test(u.pathname)) urls.add(u.href);
    } catch (_) {
      /* تجاهل */
    }
  }

  // 3) الخطوط المرجوعة من ملفات CSS
  for (const u of [...urls].filter((x) => x.endsWith('.css'))) {
    try {
      const css = await (await fetch(u)).text();
      for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        if (m[1].startsWith('data:')) continue;
        const f = new URL(m[1], u).href;
        if (WANTED_FONT.test(f)) urls.add(f);
      }
    } catch (_) {
      /* تجاهل */
    }
  }

  await Promise.all(
    [...urls].map(async (u) => {
      try {
        const r = await fetch(u);
        if (r.ok) await cache.put(u, r);
      } catch (_) {
        /* يُخزَّن لاحقًا عند أول استخدام */
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
      for (const k of await caches.keys()) {
        if (k.startsWith('am-') && !keep.has(k)) await caches.delete(k);
      }
      await self.clients.claim();
    })(),
  );
});

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

// الصفحة: الشبكة أولًا (لتصل التحديثات)، ثم النسخة المخزّنة عند انقطاع الإنترنت أو بطئه.
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await withTimeout(fetch(request), 4000);
    if (res.ok) cache.put(INDEX_URL, res.clone());
    return res;
  } catch (_) {
    return (await cache.match(INDEX_URL)) || (await cache.match(new URL('./', SCOPE).href)) || Response.error();
  }
}

// بقية الملفات: الكاش أولًا (أسماء ملفات Vite تحتوي بصمة فلا تتقادم).
async function handleAsset(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // لا نتدخل في الطلبات الخارجية
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(req));
    return;
  }
  event.respondWith(handleAsset(req));
});
