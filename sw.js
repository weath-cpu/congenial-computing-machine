importScripts("https://unpkg.com/@mercuryworkshop/scramjet@1.1.0/dist/scramjet.all.js");

let s=new($scramjetLoadWorker().ScramjetServiceWorker);
s.loadConfig();
self.addEventListener("fetch",e=>e.respondWith(s.route(e)?s.fetch(e):fetch(e.request)));
