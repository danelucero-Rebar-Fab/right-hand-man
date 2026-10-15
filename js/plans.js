/* Right Hand Man - Plans: multi-sheet photos/PDF pages, calibrate, takeoff (length/area/count/volume),
   markup (pen, cloud, text, arrow, highlight, color layers), % complete progress markup per SOV line, OCR, export PDF. Pointer Events. */
'use strict';
const MAXPX = 4096;
const LAYERS0 = () => [{name:'Redline', color:'#e11d2e', on:true}, {name:'Takeoff', color:'#1d4ed8', on:true}, {name:'Progress', color:'#15803d', on:true}, {name:'Notes', color:'#c2410c', on:true}];
const TOOLS = [
  ['pan','✋','Move'], ['cal','📏','Set scale'], ['len','↔','Length'], ['area','▱','Area'], ['cnt','#','Count'], ['vol','⬛','Volume'],
  ['prog','✅','% Done'], ['pen','✏️','Pen'], ['cloud','☁️','Cloud'], ['arrow','➜','Arrow'], ['text','T','Text'], ['rect','▭','Box'], ['ocr','🔍','Read text'], ['erase','⌫','Erase']];
const POINT_TOOLS = ['cal','len','area','cnt','vol','prog'], DRAG_TOOLS = ['pen','cloud','arrow','rect','ocr'];
const PL = { sheets:[], cur:null, src:null, tool:'pan', pts:[], view:{s:1, x:0, y:0}, fitS:1, layer:'Redline', sovId:'', progMode:'area', drag:null, undo:[], busy:'', worker:null, ocrBox:null };
const ptrs = new Map(); let pinch = null, cv = null, g = null, raf = 0, downAt = null;
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const canvasBlob = (c, type = 'image/jpeg', q = 0.88) => new Promise(r => c.toBlob(r, type, q));
function fitTo(img, w, h, max = MAXPX) { const k = Math.min(1, max / Math.max(w, h)); const c = mkCanvas(Math.round(w * k), Math.round(h * k)); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height); return c; }
// Read JPEG size + EXIF orientation from the header only (no decode) so huge phone photos (48 MP+) can be decoded straight to a small size
async function jpegInfo(file) { try { const b = new DataView(await file.slice(0, 262144).arrayBuffer()); if (b.getUint16(0) !== 0xFFD8) return null; let o = 2, ori = 1, w = 0, h = 0;
  while (o + 4 < b.byteLength) { const m = b.getUint16(o), len = b.getUint16(o + 2); if ((m & 0xFF00) !== 0xFF00) break;
    if (m === 0xFFE1 && b.getUint32(o + 4) === 0x45786966) { const t = o + 10, le = b.getUint16(t) === 0x4949, g16 = x => b.getUint16(x, le), ifd = t + b.getUint32(t + 4, le), n = g16(ifd); for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (g16(e) === 0x0112) ori = g16(e + 8); } }
    if (m >= 0xFFC0 && m <= 0xFFCF && ![0xFFC4, 0xFFC8, 0xFFCC].includes(m)) { h = b.getUint16(o + 5); w = b.getUint16(o + 7); break; } o += 2 + len; }
  if (!w) return null; return ori >= 5 && ori <= 8 ? {w:h, h:w, ori} : {w, h, ori}; } catch (e) { return null; } }
async function decodeImage(file, max = MAXPX) { const info = await jpegInfo(file);
  try { const o = {imageOrientation:'from-image'}; if (info && Math.max(info.w, info.h) > max) { const k = max / Math.max(info.w, info.h); o.resizeWidth = Math.round(info.w * k); o.resizeHeight = Math.round(info.h * k); o.resizeQuality = 'high'; }
    const bm = await createImageBitmap(file, o); const c = fitTo(bm, bm.width, bm.height, max); bm.close && bm.close(); return c; } catch (e) {}
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { res(fitTo(img, img.naturalWidth, img.naturalHeight, max)); URL.revokeObjectURL(img.src); };
    img.onerror = () => rej(new Error('This picture could not be read (HEIC?). On iPhone pick "Most Compatible" in Settings > Camera > Formats.')); img.src = URL.createObjectURL(file); }); }
async function pdfPages(file, onPage, maxPages = 60) { await loadScript('lib/pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise; let list = RHM.parseRange('1-' + pdf.numPages, pdf.numPages, maxPages);
  if (pdf.numPages > 20) { const a = prompt(`${file.name} has ${pdf.numPages} pages. Which pages do you need? (e.g. 1-20 or 3, 7, 12-15; up to ${maxPages} at a time - fewer pages = faster and less phone memory)`, `1-${Math.min(pdf.numPages, 20)}`);
    if (a === null) { pdf.destroy && pdf.destroy(); return {pages:pdf.numPages, loaded:0, cancelled:true}; } list = RHM.parseRange(a, pdf.numPages, maxPages); if (!list.length) list = RHM.parseRange('1-20', pdf.numPages, maxPages); }
  const N = list.length;
  for (const i of list) { const pg = await pdf.getPage(i), v1 = pg.getViewport({scale:1}), k = MAXPX / Math.max(v1.width, v1.height), vp = pg.getViewport({scale:k});
    const c = mkCanvas(Math.round(vp.width), Math.round(vp.height)), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await pg.render({canvasContext:x, viewport:vp}).promise; let txt = '', all = ''; try { const tc = await pg.getTextContent(); txt = sheetNoFromItems(tc.items, v1.width, v1.height, v1.transform) || ''; all = tc.items.map(t => t.str).join(' ').slice(0, 20000); } catch (e) {}
    await onPage(c, i, pdf.numPages, k * 72, txt, RHM.paperInfo(v1.width, v1.height, all)); pg.cleanup && pg.cleanup(); c.width = c.height = 0; /* free canvas memory now (iOS Safari keeps it until GC) */ }
  pdf.destroy && pdf.destroy();
  return {pages:pdf.numPages, loaded:N}; }
// Sheet number (S-101, LS-S-102, S2.300, S-01-103, M-01-901P) = the largest text matching a sheet-number pattern in the bottom-right title block (x > 70%, y < 25% in PDF coords)
/* vt = viewport transform (handles /Rotate pages) */ function sheetNoFromItems(items, W, H, vt) { const re = /^[A-Z]{1,3}(?:-[A-Z]{1,3})?[-.]?\d{1,4}(?:[-.]\d{1,4}){0,2}[A-Z]?$/; let best = null;
  items.forEach(t => { const s = String(t.str || '').trim(), m = vt && window.pdfjsLib ? pdfjsLib.Util.transform(vt, t.transform) : null, x = m ? m[4] : t.transform[4], y = m ? H - m[5] : t.transform[5], size = Math.hypot(t.transform[0], t.transform[1]); if (!re.test(s) || x < W * 0.7 || y > H * 0.25) return; if (!best || size > best.size) best = {s, size}; });
  return best ? best.s : ''; }
function guessSheetNo(txt) { if (/^[A-Z]{1,3}(?:-[A-Z]{1,3})?-?\d/.test(txt) && txt.length < 20) return txt; const m = String(txt || '').match(/\b([A-Z]{1,2}-?\d{1,3}(?:\.\d{1,2})?[A-Z]?)\b(?!.*\b[A-Z]{1,2}-?\d{1,3}(?:\.\d{1,2})?\b)/); return m ? m[1] : ''; }
async function addSheet(canvas, o) { const blob = await canvasBlob(canvas), k = 160 / Math.max(canvas.width, canvas.height), t = mkCanvas(Math.round(canvas.width * k), Math.round(canvas.height * k));
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  const rec = Object.assign({ id:uid(), projectId:APP.pid, name:'Sheet', sheetNo:'', page:1, srcName:'', blob, w:canvas.width, h:canvas.height, thumb:t.toDataURL('image/jpeg', 0.7), ppf:null, pxPerIn:null, scaleTxt:'', meas:[], marks:[], layers:LAYERS0(), created:Date.now() + Math.random() }, o);
  await DB.put('sheets', rec); return rec; }
async function addPlanFiles(files) { const list = [...files]; let last = null, i = 0, i2 = 0;
  for (const f of list) { i++; PL.busy = `Adding ${i} of ${list.length}: ${f.name}`; plStatus();
    try { if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) { const r = await pdfPages(f, async (c, p, n, pxIn, txt, paper) => { PL.busy = `${f.name}: page ${p} of ${n} (${++i2} loaded)`; plStatus();
          last = await addSheet(c, {name:`${f.name.replace(/\.pdf$/i, '')} p.${p}`, srcName:f.name, page:p, pxPerIn:pxIn, sheetNo:guessSheetNo(txt), kind:'pdf', paper}); });
        if (last && last.paper && last.paper.reduced) toast(`⚠ ${f.name} looks like a reduced set (${last.paper.reason}). Calibrate with two taps on a known dimension.`, 6000);
        if (r.loaded < r.pages && !r.cancelled) toast(`Loaded ${r.loaded} of ${r.pages} pages. Add the file again to load other pages.`); }
      else last = await addSheet(await decodeImage(f), {name:f.name.replace(/\.[^.]+$/, '') || 'Photo', srcName:f.name, page:1, kind:'photo'}); }
    catch (e) { alert(e.message || String(e)); } }
  PL.busy = ''; if (last) PL.curId = last.id; return last; }
async function loadSheets() { PL.sheets = (await DB.where('sheets', s => s.projectId === APP.pid)).sort((a, b) => a.created - b.created); return PL.sheets; }
async function openSheet(id) { const r = PL.sheets.find(x => x.id === id) || await DB.get('sheets', id); if (!r) return; (r.layers || []).forEach(l => { if (l.color === '#ea580c') l.color = '#c2410c'; }); PL.cur = r; PL.curId = id; PL.pts = []; PL.undo = []; PL.ocrBox = null;
  const bm = await createImageBitmap(r.blob); PL.src = mkCanvas(bm.width, bm.height); PL.src.getContext('2d').drawImage(bm, 0, 0); bm.close && bm.close(); }
const saveSheet = () => { const r = PL.cur; const i = PL.sheets.findIndex(x => x.id === r.id); if (i >= 0) PL.sheets[i] = r; return DB.put('sheets', r); };
function pushUndo() { PL.undo.push(JSON.stringify({meas:PL.cur.meas, marks:PL.cur.marks, ppf:PL.cur.ppf})); if (PL.undo.length > 40) PL.undo.shift(); }
async function undo() { if (PL.pts.length) { PL.pts.pop(); return redraw(); } const s = PL.undo.pop(); if (!s) return toast('Nothing to undo'); Object.assign(PL.cur, JSON.parse(s)); await saveSheet(); redraw(); toast('Undone'); }

/* ---------- step text: plain-language prompts ---------- */
function stepText() { const r = PL.cur, n = PL.pts.length; if (!r) return 'Add plan sheets to start.'; const sc = r.ppf ? '' : ' (Set scale first.)';
  return ({ pan:'Drag to move. Pinch or use + / − to zoom. Pick a tool below.',
    cal: n === 0 ? 'Tap the START of a dimension you can read on the sheet.' : n === 1 ? 'Now tap the END of that dimension.' : 'Type the real length (example 20\'-0") and press Set scale.',
    len: !r.ppf ? 'Set scale first: tap 📏 Set scale.' : n === 0 ? 'Tap where the run starts.' : `Keep tapping corners. Total ${fmtLen(RHM.polyLen(PL.pts) / r.ppf)}. Press ✔ Save.`,
    area: !r.ppf ? 'Set scale first.' : n < 3 ? `Tap the corners of the area (${n} so far, need 3).` : `Area ${RHM.fmt(RHM.polyArea(PL.pts) / r.ppf ** 2, 1)} SF. Tap more corners or press ✔ Save.`,
    vol: !r.ppf ? 'Set scale first.' : n < 3 ? `Tap the corners of the footprint (${n} so far). You will enter the depth next.` : 'Enter the depth and press ✔ Save.',
    cnt: n === 0 ? 'Tap each item to count it.' : `${n} counted. Press ✔ Save.`,
    prog: !PL.sovId ? 'Choose the pay item (SOV line) this work belongs to.' : (PL.progMode === 'count' ? 'Tap each installed item.' : `Tap around the INSTALLED work (${PL.progMode}). Press ✔ Save.`) + sc,
    pen:'Draw with your finger.', cloud:'Drag a box; it becomes a revision cloud.', arrow:'Drag from the tail to the tip.', text:'Tap where the note goes.', rect:'Drag a box to highlight.', ocr:'Drag a box around the text to read.', erase:'Tap a mark or measurement to remove it.' })[PL.tool] || ''; }
const fmtLen = ft => `${RHM.fmt(ft, 2)} LF (${RHM.fmtFtIn(ft)})`;
function plStatus() { const s = document.getElementById('step'); if (s) s.textContent = PL.busy || stepText();
  const cf = document.getElementById('calForm'); if (cf) cf.hidden = !(PL.tool === 'cal' && PL.pts.length === 2);
  const sv = document.getElementById('saveM'); if (sv) sv.hidden = !(['len','area','cnt','vol','prog'].includes(PL.tool) && PL.pts.length);
  const vd = document.getElementById('volForm'); if (vd) vd.hidden = PL.tool !== 'vol';
  const pf = document.getElementById('progForm'); if (pf) pf.hidden = PL.tool !== 'prog';
  const ob = document.getElementById('ocrRun'); if (ob) ob.hidden = !(PL.tool === 'ocr' && PL.ocrBox); }

/* ---------- view ---------- */
function setupCanvas() { cv = document.getElementById('cv'); if (!cv) return; g = cv.getContext('2d'); const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); fit(); 
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onCancel);
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(toCv(e), e.deltaY < 0 ? 1.15 : 1 / 1.15); redraw(); }, {passive:false}); redraw(); }
function fit() { if (!PL.src || !cv) return; PL.fitS = Math.min(cv.width / PL.src.width, cv.height / PL.src.height); PL.view = {s:PL.fitS, x:(cv.width - PL.src.width * PL.fitS) / 2, y:(cv.height - PL.src.height * PL.fitS) / 2}; }
function zoomAt(c, f) { const s0 = PL.view.s, s1 = Math.max(PL.fitS * 0.5, Math.min(PL.fitS * 16, s0 * f)), k = s1 / s0; PL.view.x = c.x - (c.x - PL.view.x) * k; PL.view.y = c.y - (c.y - PL.view.y) * k; PL.view.s = s1; }
function toCv(e) { const r = cv.getBoundingClientRect(); return {x:(e.clientX - r.left) * cv.width / r.width, y:(e.clientY - r.top) * cv.height / r.height}; }
const toImg = c => ({x:(c.x - PL.view.x) / PL.view.s, y:(c.y - PL.view.y) / PL.view.s});
const cssPx = () => cv.width / cv.getBoundingClientRect().width;
function onDown(e) { e.preventDefault(); cv.setPointerCapture(e.pointerId); const c = toCv(e); ptrs.set(e.pointerId, c);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d:RHM.dist(a, b), m:{x:(a.x + b.x) / 2, y:(a.y + b.y) / 2}}; PL.drag = null; downAt = null; return; }
  downAt = {c, t:Date.now(), moved:0, v:{...PL.view}};
  if (DRAG_TOOLS.includes(PL.tool)) PL.drag = {tool:PL.tool, a:toImg(c), b:toImg(c), pts:[toImg(c)]}; }
function onMove(e) { if (!ptrs.has(e.pointerId)) return; const c = toCv(e), prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, c);
  if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = RHM.dist(a, b), m = {x:(a.x + b.x) / 2, y:(a.y + b.y) / 2};
    PL.view.x += m.x - pinch.m.x; PL.view.y += m.y - pinch.m.y; zoomAt(m, d / pinch.d); pinch = {d, m}; return redraw(); }
  if (!downAt) return; downAt.moved = Math.max(downAt.moved, RHM.dist(c, downAt.c) / cssPx());
  if (PL.drag) { const p = toImg(c); PL.drag.b = p; if (PL.tool === 'pen') PL.drag.pts.push(p); return redraw(); }
  if (downAt.moved > 6) { PL.view.x += c.x - prev.x; PL.view.y += c.y - prev.y; redraw(); } }
async function onUp(e) { const wasPinch = !!pinch; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (wasPinch || !downAt) { if (!ptrs.size) downAt = null; return; }
  const c = toCv(e), tap = downAt.moved <= 8, p = toImg(c); downAt = null;
  if (PL.drag) { const d = PL.drag; PL.drag = null; if (d.tool === 'ocr') { PL.ocrBox = box(d.a, d.b); plStatus(); return redraw(); }
    if (RHM.dist(d.a, d.b) * PL.view.s / cssPx() < 6 && d.tool !== 'pen') return redraw();
    pushUndo(); const L = PL.cur.layers.find(l => l.name === PL.layer) || PL.cur.layers[0];
    PL.cur.marks.push({id:uid(), type:d.tool, layer:L.name, color:L.color, pts:d.tool === 'pen' ? simplify(d.pts, 1.5 / PL.view.s) : [d.a, d.b], w:Math.max(3, 4 / PL.view.s * cssPx())});
    await saveSheet(); return redraw(); }
  if (!tap) return;
  if (POINT_TOOLS.includes(PL.tool)) { if (PL.tool === 'cal' && PL.pts.length >= 2) PL.pts = []; PL.pts.push(p); plStatus(); return redraw(); }
  if (PL.tool === 'text') { const t = prompt('Note text:'); if (!t) return; pushUndo(); const L = PL.cur.layers.find(l => l.name === PL.layer);
    PL.cur.marks.push({id:uid(), type:'text', layer:L.name, color:L.color, pts:[p], text:t, size:Math.max(14, 22 / PL.view.s * cssPx())}); await saveSheet(); return redraw(); }
  if (PL.tool === 'erase') { const hit = nearest(p, 24 * cssPx() / PL.view.s); if (!hit) return toast('Nothing there to erase'); pushUndo(); PL.cur[hit.list] = PL.cur[hit.list].filter(x => x.id !== hit.id); await saveSheet(); redraw(); toast('Removed (Undo to restore)'); } }
function onCancel(e) { ptrs.delete(e.pointerId); pinch = null; PL.drag = null; downAt = null; redraw(); }
const box = (a, b) => ({x:Math.min(a.x, b.x), y:Math.min(a.y, b.y), w:Math.abs(b.x - a.x), h:Math.abs(b.y - a.y)});
function simplify(pts, tol) { const out = [pts[0]]; for (const q of pts) if (RHM.dist(q, out[out.length - 1]) > tol) out.push(q); return out; }
function segDist(p, a, b) { const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2; let t = l2 ? ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2 : 0; t = Math.max(0, Math.min(1, t)); return RHM.dist(p, {x:a.x + t * (b.x - a.x), y:a.y + t * (b.y - a.y)}); }
function nearest(p, tol) { let best = null; const test = (list, x, pts, closed) => { let d = Infinity; if (pts.length === 1) d = RHM.dist(p, pts[0]); for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1], pts[i]));
    if (closed && pts.length > 2) d = Math.min(d, segDist(p, pts[pts.length - 1], pts[0])); if (x.type === 'cnt') d = Math.min(...pts.map(q => RHM.dist(p, q))); if (d < tol && (!best || d < best.d)) best = {list, id:x.id, d}; };
  PL.cur.marks.forEach(m => { const pts = ['cloud','rect'].includes(m.type) ? rectPts(m.pts[0], m.pts[1]) : m.pts; test('marks', m, pts, ['cloud','rect'].includes(m.type)); });
  PL.cur.meas.forEach(m => test('meas', m, m.pts, ['area','vol'].includes(m.type) || (m.type === 'prog' && m.mode === 'area'))); return best; }
const rectPts = (a, b) => [{x:a.x, y:a.y}, {x:b.x, y:a.y}, {x:b.x, y:b.y}, {x:a.x, y:b.y}];

/* ---------- paint ---------- */
function redraw() { plStatus(); if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (cv && g) paintTo(g, PL.view, cv.width, cv.height, true); }); }
function paintTo(x, view, W, H, live) { const r = PL.cur; x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#d6dbe3'; x.fillRect(0, 0, W, H); if (!PL.src) return;
  x.setTransform(view.s, 0, 0, view.s, view.x, view.y); x.drawImage(PL.src, 0, 0); const u = 1 / view.s * (live ? cssPx() : 1.6), vis = n => (r.layers.find(l => l.name === n) || {on:true}).on;
  r.meas.forEach(m => { if (!vis(m.layer || 'Takeoff')) return; drawMeas(x, m, m.color || layerColor(m.layer || 'Takeoff'), u); });
  r.marks.forEach(m => { if (vis(m.layer)) drawMark(x, m, u); });
  if (live) { const col = PL.tool === 'cal' ? '#9333ea' : layerColor(PL.tool === 'prog' ? 'Progress' : 'Takeoff');
    if (PL.pts.length) drawMeas(x, {type:PL.tool === 'prog' ? 'prog' : PL.tool, mode:PL.progMode, pts:PL.pts, pending:true}, col, u);
    if (PL.drag) drawMark(x, {type:PL.drag.tool === 'ocr' ? 'rect' : PL.drag.tool, color:PL.drag.tool === 'ocr' ? '#9333ea' : layerColor(PL.layer), pts:PL.drag.tool === 'pen' ? PL.drag.pts : [PL.drag.a, PL.drag.b], w:4 * u}, u);
    if (PL.ocrBox) { x.strokeStyle = '#9333ea'; x.lineWidth = 3 * u; x.setLineDash([10 * u, 6 * u]); x.strokeRect(PL.ocrBox.x, PL.ocrBox.y, PL.ocrBox.w, PL.ocrBox.h); x.setLineDash([]); } } }
const layerColor = n => ((PL.cur && PL.cur.layers.find(l => l.name === n)) || {color:'#1d4ed8'}).color;
function label(x, t, p, col, u) { x.font = `bold ${15 * u}px system-ui,sans-serif`; const w = x.measureText(t).width; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(p.x - 3 * u, p.y - 16 * u, w + 6 * u, 20 * u); x.fillStyle = col; x.fillText(t, p.x, p.y); }
function drawMeas(x, m, col, u) { const P = m.pts; x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 3 * u; x.lineJoin = 'round';
  const closed = ['area','vol'].includes(m.type) || (m.type === 'prog' && m.mode === 'area');
  if (m.type === 'cnt' || (m.type === 'prog' && m.mode === 'count')) P.forEach((q, i) => { x.beginPath(); x.arc(q.x, q.y, 9 * u, 0, 7); x.globalAlpha = .35; x.fill(); x.globalAlpha = 1; x.stroke(); label(x, String(i + 1), {x:q.x + 10 * u, y:q.y - 8 * u}, col, u); });
  else { x.beginPath(); P.forEach((q, i) => i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y)); if (closed && !m.pending) x.closePath(); if (closed) { x.globalAlpha = m.type === 'prog' ? .3 : .15; x.fill(); x.globalAlpha = 1; }
    if (m.type === 'prog' && m.mode !== 'area') { x.globalAlpha = .45; x.lineWidth = 14 * u; x.stroke(); x.globalAlpha = 1; x.lineWidth = 3 * u; } x.stroke();
    P.forEach(q => { x.beginPath(); x.arc(q.x, q.y, 5 * u, 0, 7); x.fill(); }); }
  if (!m.pending && m.label) label(x, m.label, {x:P[0].x + 8 * u, y:P[0].y - 10 * u}, col, u); }
function drawMark(x, m, u) { const [a, b] = m.pts; x.strokeStyle = m.color; x.fillStyle = m.color; x.lineWidth = m.w || 4 * u; x.lineCap = 'round'; x.lineJoin = 'round';
  if (m.type === 'pen') { x.beginPath(); m.pts.forEach((q, i) => i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y)); x.stroke(); }
  else if (m.type === 'rect') { x.globalAlpha = .18; x.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); x.globalAlpha = 1; x.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); }
  else if (m.type === 'arrow') { const ang = Math.atan2(b.y - a.y, b.x - a.x), h = Math.max(18 * u, x.lineWidth * 4); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
    x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(b.x - h * Math.cos(ang - .45), b.y - h * Math.sin(ang - .45)); x.lineTo(b.x - h * Math.cos(ang + .45), b.y - h * Math.sin(ang + .45)); x.closePath(); x.fill(); }
  else if (m.type === 'cloud') { const pts = rectPts(a, b), per = Math.max(24 * u, (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 24); x.beginPath();
    for (let i = 0; i < 4; i++) { const p = pts[i], q = pts[(i + 1) % 4], L = RHM.dist(p, q), n = Math.max(1, Math.round(L / per)), ang = Math.atan2(q.y - p.y, q.x - p.x);
      for (let k = 0; k < n; k++) { const cx = p.x + (q.x - p.x) * (k + .5) / n, cy = p.y + (q.y - p.y) * (k + .5) / n, rr = L / n / 2; x.moveTo(cx - rr * Math.cos(ang), cy - rr * Math.sin(ang)); x.arc(cx, cy, rr, ang + Math.PI, ang + 2 * Math.PI); } }
    x.stroke(); }
  else if (m.type === 'text') { x.font = `bold ${m.size || 20}px system-ui,sans-serif`; const w = x.measureText(m.text).width, s = m.size || 20; x.fillStyle = 'rgba(255,255,255,.88)'; x.fillRect(a.x - 4, a.y - s, w + 8, s * 1.3); x.fillStyle = m.color; x.fillText(m.text, a.x, a.y); } }

/* ---------- actions ---------- */
async function setScale(realFt) { const r = PL.cur; if (PL.pts.length !== 2) return toast('Tap two points first'); if (!(realFt > 0)) return toast('Type a length like 20\'-0" or 12.5');
  pushUndo(); r.ppf = RHM.dist(PL.pts[0], PL.pts[1]) / realFt; r.cal = {pts:PL.pts.slice(), ft:realFt}; r.scaleTxt = `calibrated ${RHM.fmtFtIn(realFt)}`; PL.pts = []; await saveSheet(); toast('Scale set ✔ - Length tool is ready'); typeof buzz === 'function' && buzz(25); PL.tool = 'len'; document.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === 'len')); const cf = document.getElementById('calForm'); if (cf) cf.hidden = true; redraw(); plStatus(); }
async function setScaleText(s) { const r = PL.cur, fpi = RHM.scaleFtPerIn(s); if (!(fpi > 0)) return toast('Scale must look like 1/4"=1\'-0" or 1"=20\''); if (!r.pxPerIn) return toast('Typed scales only work on PDF pages (photos need two taps on a known dimension)');
  let f = 1; if (r.paper && r.paper.reduced) { const fx = r.paper.factor; const ans = prompt(`⚠ Reduced set? ${r.paper.reason}.\n\nA printed scale only works on a full-size sheet. Best: cancel and calibrate with two taps on a known dimension.\n\nTo use the printed scale anyway, type how many times smaller this print is (1 = full size${fx ? ', ' + fx + ' = from the sheet note' : ', 2 = half-size'}):`, fx || 2);
    if (ans === null) return toast('Scale not set. Use "Calibrate" with two taps.'); f = parseFloat(ans); if (!(f >= 1 && f <= 10)) return toast('Type a number from 1 to 10'); }
  pushUndo(); r.ppf = r.pxPerIn * f / fpi; r.scaleTxt = f !== 1 ? `${s} (print reduced 1:${f})` : s; await saveSheet(); toast(`Scale ${s} set ✔ (check one known dimension)`); redraw(); }
async function saveMeas() { const r = PL.cur, t = PL.tool, P = PL.pts.slice(); if (!P.length) return; let value, unit, lbl, mode;
  if ((t === 'len' || t === 'area' || t === 'vol') && !r.ppf) return toast('Set scale first');
  if (t === 'len') { if (P.length < 2) return toast('Tap at least 2 points'); value = RHM.polyLen(P) / r.ppf; unit = 'LF'; lbl = `${RHM.fmt(value)} LF`; }
  else if (t === 'area') { if (P.length < 3) return toast('Tap at least 3 corners'); value = RHM.polyArea(P) / r.ppf ** 2; unit = 'SF'; lbl = `${RHM.fmt(value, 1)} SF`; }
  else if (t === 'vol') { if (P.length < 3) return toast('Tap at least 3 corners'); const d = RHM.parseLen(document.getElementById('volDepth').value); if (!(d > 0)) return toast('Enter the depth (example 1\'-6" or 18")');
    const sf = RHM.polyArea(P) / r.ppf ** 2; value = sf * d / 27; unit = 'CY'; lbl = `${RHM.fmt(value)} CY`; mode = {sf, depth:d}; }
  else if (t === 'cnt') { value = P.length; unit = 'EA'; lbl = `${value} EA`; }
  else if (t === 'prog') { if (!PL.sovId) return toast('Pick the pay item first'); mode = PL.progMode;
    if (mode !== 'count' && !r.ppf) return toast('Set scale first (or use Count mode)');
    value = mode === 'count' ? P.length : mode === 'length' ? RHM.polyLen(P) / r.ppf : RHM.polyArea(P) / r.ppf ** 2; unit = mode === 'count' ? 'EA' : mode === 'length' ? 'LF' : 'SF'; lbl = `done ${RHM.fmt(value, 1)} ${unit}`; }
  const name = t === 'prog' ? '' : (prompt('What is this? (example: Grade beam GB-1, #5 top)', '') || '');
  pushUndo(); r.meas.push({id:uid(), type:t, mode:t === 'prog' ? mode : undefined, vol:t === 'vol' ? mode : undefined, pts:P, value:RHM.r3(value), unit, label:(name ? name + ': ' : '') + lbl, name, layer:t === 'prog' ? 'Progress' : 'Takeoff', sovId:t === 'prog' ? PL.sovId : (document.getElementById('measSov') || {}).value || '', created:Date.now()});
  PL.pts = []; await saveSheet(); toast('Saved ✔'); return 'saved'; }
// Plan quantity per SOV line = sum of takeoff measurements linked to it; done = sum of progress markups
async function progressBySov(pid) { const sheets = await DB.where('sheets', s => s.projectId === pid), out = {};
  sheets.forEach(s => s.meas.forEach(m => { if (!m.sovId) return; const o = out[m.sovId] ||= {plan:0, done:0, unitPlan:'', unitDone:'', sheets:new Set()};
    if (m.type === 'prog') { o.done += m.value; o.unitDone = m.unit; } else { o.plan += m.value; o.unitPlan = m.unit; } o.sheets.add(s.sheetNo || s.name); }));
  Object.values(out).forEach(o => { o.pct = o.plan && o.unitPlan === o.unitDone ? Math.min(100, o.done / o.plan * 100) : null; o.sheets = [...o.sheets].join(', '); }); return out; }

/* ---------- OCR ---------- */
async function ocrWorker() { if (PL.worker) return PL.worker; await loadScript('ocr/tesseract.min.js'); const base = new URL('ocr/', location.href).href;
  PL.worker = await Tesseract.createWorker('eng', 1, {workerPath:base + 'worker.min.js', corePath:base, langPath:base.replace(/\/$/, ''), workerBlobURL:false, gzip:true}); return PL.worker; }
async function runOCR() { const b = PL.ocrBox; if (!b) return; PL.busy = 'Reading text… (first time loads the offline reader)'; plStatus();
  try { const k = Math.min(4, 1400 / Math.max(b.w, b.h)), c = mkCanvas(Math.max(1, Math.round(b.w * k)), Math.max(1, Math.round(b.h * k))); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(PL.src, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
    const {data} = await (await ocrWorker()).recognize(c); PL.busy = ''; plStatus(); return (data.text || '').trim(); } catch (e) { PL.busy = ''; plStatus(); alert('Text reader failed: ' + e.message); return ''; } }

/* ---------- export marked sheets ---------- */
async function renderMarked(sheet, maxPx = 3000) { const keep = {cur:PL.cur, src:PL.src}; PL.cur = sheet; const bm = await createImageBitmap(sheet.blob); PL.src = mkCanvas(bm.width, bm.height); PL.src.getContext('2d').drawImage(bm, 0, 0);
  const k = Math.min(1, maxPx / Math.max(bm.width, bm.height)), c = mkCanvas(Math.round(bm.width * k), Math.round(bm.height * k)); paintTo(c.getContext('2d'), {s:k, x:0, y:0}, c.width, c.height, false);
  PL.cur = keep.cur; PL.src = keep.src; return c; }
