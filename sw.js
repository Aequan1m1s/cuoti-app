/* 数学错题本 · Service Worker
 * 更新策略：index.html 网络优先（在线时始终拿最新页面），其余资源缓存优先。
 * 资源有变化时把 CACHE_NAME 升到 jie-v4、jie-v5…，激活阶段会自动清理旧缓存。
 */
const CACHE_NAME = 'jie-v6';
const KATEX_FONTS = [
  'KaTeX_AMS-Regular.woff2',
  'KaTeX_Caligraphic-Bold.woff2',
  'KaTeX_Caligraphic-Regular.woff2',
  'KaTeX_Fraktur-Bold.woff2',
  'KaTeX_Fraktur-Regular.woff2',
  'KaTeX_Main-Bold.woff2',
  'KaTeX_Main-BoldItalic.woff2',
  'KaTeX_Main-Italic.woff2',
  'KaTeX_Main-Regular.woff2',
  'KaTeX_Math-BoldItalic.woff2',
  'KaTeX_Math-Italic.woff2',
  'KaTeX_SansSerif-Bold.woff2',
  'KaTeX_SansSerif-Italic.woff2',
  'KaTeX_SansSerif-Regular.woff2',
  'KaTeX_Script-Regular.woff2',
  'KaTeX_Size1-Regular.woff2',
  'KaTeX_Size2-Regular.woff2',
  'KaTeX_Size3-Regular.woff2',
  'KaTeX_Size4-Regular.woff2',
  'KaTeX_Typewriter-Regular.woff2'
];
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './all_questions.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './vendor/katex/katex.min.css',
  './vendor/katex/katex.min.js',
  './vendor/katex/contrib/auto-render.min.js'
].concat(KATEX_FONTS.map((f) => './vendor/katex/fonts/' + f));

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(
        CORE_ASSETS.map((url) => new Request(url, { cache: 'reload' }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isShell = request.mode === 'navigate' ||
                 (url.origin === self.location.origin && url.pathname.endsWith('/index.html'));

  if (isShell) {
    event.respondWith(
      fetchWithTimeout(request, 4000)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put('./index.html', copy))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match('./index.html')
          .then((cached) => cached || caches.match('./'))
          .then((cached) => cached || offlinePage()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => undefined);
        }
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return caches.match('./');
      });
    })
  );
});

/* 网络请求加超时：弱网或域名被劫持时不至于一直转圈 */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

/* 首次安装且完全离线时，给一个能点重试的页面，而不是白屏 */
function offlinePage() {
  const html = '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>数学错题本</title>' +
    '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#F6F4EE;font-family:-apple-system,\'PingFang SC\',sans-serif;color:#3A3A34;text-align:center">' +
    '<div style="padding:32px"><div style="font-size:20px;font-weight:700;margin-bottom:8px">暂时连不上服务器</div>' +
    '<div style="font-size:14px;color:#7A7A70;margin-bottom:24px">请检查网络后再试</div>' +
    '<button onclick="location.reload()" style="border:0;border-radius:999px;padding:12px 28px;' +
    'background:#4d6658;color:#fff;font-size:15px">重新加载</button></div></body>';
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}





