/* 炉石记牌器 PWA Service Worker
 * 策略：应用壳缓存优先，白名单 CDN（图标 / 卡牌库 / iOS 设备框 SDK）网络优先 + 缓存兜底。
 */
const VERSION = 'hs-tracker-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest'];
const SHARED_CACHE = 'hs-shared-shots';
const SHARED_KEY = location.origin + location.pathname + 'shared-shot';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  var origin = url.origin;
  var host = url.hostname;
  var isShell = origin === location.origin;

  /* Web Share Target：iOS 快捷指令截图分享到 PWA，SW 拦截 POST 缓存图片后 303 回页面 */
  if (isShell && event.request.method === 'POST' && url.searchParams.get('share') === '1') {
    event.respondWith(
      event.request.formData().then(function (fd) {
        var file = fd.get('screenshot');
        if (file && file.size > 0) {
          return caches.open(SHARED_CACHE).then(function (cache) {
            return cache.put(SHARED_KEY, new Response(file, { headers: { 'Content-Type': file.type || 'image/png' } }));
          }).then(function () {
            return Response.redirect('./?shared=1', 303);
          });
        }
        return Response.redirect('./?shared=0', 303);
      }).catch(function () {
        return Response.redirect('./?shared=0', 303);
      })
    );
    return;
  }

  /* 页面读取分享截图：返回 SW 缓存的图片 */
  if (isShell && url.pathname.endsWith('shared-shot')) {
    event.respondWith(
      caches.open(SHARED_CACHE).then(function (cache) {
        return cache.match(SHARED_KEY).then(function (hit) {
          return hit || new Response('not found', { status: 404 });
        });
      })
    );
    return;
  }

  var isWhiteCdn = host.indexOf('aka.doubaocdn.com') > -1 ||
                   host.indexOf('feishucdn.com') > -1 ||
                   host.indexOf('byteimg.com') > -1 ||
                   host.indexOf('hearthstonejson.com') > -1;
  if (!isShell && !isWhiteCdn) { return; }

  event.respondWith(
    caches.match(event.request).then(function (hit) {
      if (hit) { return hit; }
      return fetch(event.request).then(function (res) {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(VERSION).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
