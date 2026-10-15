const VER = 'rhm-v2.0.0';
const CORE = ['./','./index.html','./styles.css','./manifest.json','./js/calc.js','./js/calc_trades.js','./js/types.js','./js/db.js','./js/plans.js','./js/app.js','./js/app2.js','./js/app3.js','./js/pdfx.js','./js/est.js','./js/ux.js','./js/calc_est.js','./js/rules.js','./js/rulesui.js','./js/orders.js','./js/baseline.js','./js/weld.js','./js/consum.js','./js/term.js','./js/weldui.js','./data/accessories_pricelist.json','./js/field.js','./js/bid.js','./js/xlsx.js','./js/revcmp.js','./data/baseline/index.json','./js/calc_field.js',
  './lib/pdf.min.js','./lib/pdf.worker.min.js','./lib/jspdf.umd.min.js','./lib/jspdf.plugin.autotable.min.js','./data/standards.json','./data/costs_example.csv','./data/joe_rates.csv',
  './icons/logo.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-192.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./icons/favicon-32.png','./icons/rebarfab-logo.png'];
const OCR = ['./ocr/tesseract.min.js','./ocr/worker.min.js','./ocr/tesseract-core-lstm.wasm.js','./ocr/tesseract-core-simd-lstm.wasm.js','./ocr/eng.traineddata.gz'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(CORE)).then(() => { caches.open(VER + '-ocr').then(c => c.addAll(OCR)).catch(() => {}); return self.skipWaiting(); })); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(VER)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; const u = new URL(e.request.url); if (u.origin !== location.origin) return; // weather API etc. go straight to network
  if (u.searchParams.has('probe')) return; // connectivity probe: always network
  e.respondWith(caches.match(e.request, {ignoreSearch:true}).then(hit => hit || fetch(e.request).then(res => { if (res.ok) { const cp = res.clone(); caches.open(VER).then(c => c.put(e.request, cp)); } return res; })
    .catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))); });
