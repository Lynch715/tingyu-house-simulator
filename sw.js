// 听雨楼 · 离线缓存
// 代码类文件走网络优先（拿到新版就更新缓存，联网时永远是最新）；
// 图片/字体类走缓存优先 + 后台悄悄更新（stale-while-revalidate），秒开省流量。
const VER = 'tingyu-v1';
const SHELL = [
  './',
  './index.html',
  './site.webmanifest',
  './favicon.ico',
  './icon/icon-192.png',
  './icon/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isCode(url) {
  return /\.(html|js|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
}

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (isCode(url)) {
    // 网络优先
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VER).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
  } else {
    // 图片等静态资源：缓存优先 + 后台更新
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.ok) caches.open(VER).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
