// 听雨楼 · 离线缓存
// 代码类文件走网络优先（拿到新版就更新缓存，联网时永远是最新）；
// 图片/字体类走缓存优先 + 后台悄悄更新（stale-while-revalidate），秒开省流量。
const VER = 'tingyu-v2';   // 换版号会清掉旧缓存——2026-09-15 图片全部缩过，旧的大图必须淘汰
const SHELL = [
  './',
  './index.html',
  './site.webmanifest',
  './favicon.ico',
  './icon/icon-192.png',
  './icon/icon-512.png',
];

// 界面上到处都在用的小图标（缩到 96px 之后每张约 4KB），装的时候一次性塞进缓存，
// 之后切页不用再等网络。单张失败不影响安装。
const ICONS = [
  './assets/新图/图标_临水歌台.webp',
  './assets/新图/图标_人.webp',
  './assets/新图/图标_前朝诗稿.webp',
  './assets/新图/图标_口才.webp',
  './assets/新图/图标_古琴.webp',
  './assets/新图/图标_名声.webp',
  './assets/新图/图标_名帖.webp',
  './assets/新图/图标_周到.webp',
  './assets/新图/图标_商贾.webp',
  './assets/新图/图标_夜雨小园.webp',
  './assets/新图/图标_女儿红.webp',
  './assets/新图/图标_好听.webp',
  './assets/新图/图标_好看.webp',
  './assets/新图/图标_客人.webp',
  './assets/新图/图标_宫灯.webp',
  './assets/新图/图标_屏风.webp',
  './assets/新图/图标_待客.webp',
  './assets/新图/图标_排场子.webp',
  './assets/新图/图标_撩人.webp',
  './assets/新图/图标_文士.webp',
  './assets/新图/图标_权贵.webp',
  './assets/新图/图标_格调.webp',
  './assets/新图/图标_楼里.webp',
  './assets/新图/图标_沉水香.webp',
  './assets/新图/图标_添东西.webp',
  './assets/新图/图标_游侠.webp',
  './assets/新图/图标_玉佩.webp',
  './assets/新图/图标_玉箫.webp',
  './assets/新图/图标_琴艺.webp',
  './assets/新图/图标_精膳房.webp',
  './assets/新图/图标_绣鞋.webp',
  './assets/新图/图标_胭脂.webp',
  './assets/新图/图标_舞艺.webp',
  './assets/新图/图标_藏谱阁.webp',
  './assets/新图/图标_车马院.webp',
  './assets/新图/图标_银子.webp',
  './assets/新图/图标_门路.webp',
  './assets/新图/图标_霓裳.webp',
  './assets/新图/图标_风情.webp',
  './assets/新图/图标_风月谱.webp',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => c.addAll(SHELL).then(() => Promise.all(ICONS.map(u => c.add(u).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
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
