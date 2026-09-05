/* 炉石记牌器 PWA Service Worker
 * 策略：应用壳缓存优先，白名单 CDN（图标 / 卡牌库 / iOS 设备框 SDK）网络优先 + 缓存兜底。
 */
const VERSION = 'hs-tracker-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

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
