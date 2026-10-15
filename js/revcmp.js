/* Right Hand Man v1.9 — Revision compare overlay (rank 22).
   Pick two stored plan sheets; old = red, new = blue, common linework dark.
   Opacity, nudge offset, two-point align, toggle layers, pinch/zoom, PNG/PDF share only. */
'use strict';

TITLES.revcmp = 'Revision compare';

const RC = {
  oldId: '', newId: '', oldBm: null, newBm: null,
  view: { s: 1, x: 0, y: 0 }, fitS: 1,
  opacity: 0.55, dx: 0, dy: 0, showOld: true, showNew: true,
  mode: 'pan', // pan | align1 | align2
  alignOld: [], alignNew: [], // up to 2 pts each (image space of that sheet)
  scale: 1, rot: 0, // from two-point align (new relative to old)
  busy: false
};

function rcLabel(s) { return (s.sheetNo || s.name || 'Sheet') + (s.page ? ` · p.${s.page}` : ''); }

ROUTES.revcmp = async (arg) => {
  if (needProject()) return;
  const sheets = await loadSheets();
  if (sheets.length < 2) {
    main().innerHTML = `<div class="empty"><h2>Need two plan sheets</h2><p>Upload at least two sheets (for example Rev A and Rev B of the same drawing) under Plans, then come back.</p>
      <button class="btn xl p" data-go="plans">📐 Go to Plans</button></div>`;
    setPrimary(null); return;
  }
  if (arg && arg.oldId) RC.oldId = arg.oldId;
  if (arg && arg.newId) RC.newId = arg.newId;
  if (!RC.oldId || !sheets.find(s => s.id === RC.oldId)) RC.oldId = sheets[0].id;
  if (!RC.newId || !sheets.find(s => s.id === RC.newId) || RC.newId === RC.oldId) RC.newId = (sheets.find(s => s.id !== RC.oldId) || sheets[1]).id;

  const oldS = sheets.find(s => s.id === RC.oldId), newS = sheets.find(s => s.id === RC.newId);
  main().innerHTML = `<div class="revcmp">
    <div class="card"><h3>Pick two sheets</h3>
      <div class="grid2">
        <label class="fld"><span>Old (red)</span><select id="rcOld" aria-label="Old sheet (shown in red)">${sheets.map(s => `<option value="${s.id}" ${s.id === RC.oldId ? 'selected' : ''}>${esc(rcLabel(s))}</option>`).join('')}</select></label>
        <label class="fld"><span>New (blue)</span><select id="rcNew" aria-label="New sheet (shown in blue)">${sheets.map(s => `<option value="${s.id}" ${s.id === RC.newId ? 'selected' : ''}>${esc(rcLabel(s))}</option>`).join('')}</select></label>
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn" id="rcSwap" aria-label="Swap old and new">⇄ Swap</button>
        <button class="btn p" id="rcLoad">Load overlay</button>
      </div>
      <p class="small muted">Old linework = red · New = blue · Matching lines go dark. Share / download only — nothing auto-sends.</p>
    </div>
    <div class="rc-stage">
      <div class="cvwrap rc-cv"><canvas id="rcCv" role="img" aria-label="Revision compare overlay"></canvas>
        <div class="zoom">
          <button id="rcZin" aria-label="Zoom in">＋</button>
          <button id="rcZout" aria-label="Zoom out">−</button>
          <button id="rcZfit" aria-label="Fit">⤢</button>
        </div>
      </div>
      <p id="rcStep" class="step" aria-live="polite">Pick sheets and tap Load overlay.</p>
      <div class="card rc-controls">
        <label class="fld"><span>New opacity <span id="rcOpLbl">${Math.round(RC.opacity * 100)}%</span></span>
          <input type="range" id="rcOp" min="0" max="100" value="${Math.round(RC.opacity * 100)}" aria-label="New sheet opacity"></label>
        <div class="row">
          <label class="switch"><input type="checkbox" id="rcShowOld" ${RC.showOld ? 'checked' : ''}><span>Show old (red)</span></label>
          <label class="switch"><input type="checkbox" id="rcShowNew" ${RC.showNew ? 'checked' : ''}><span>Show new (blue)</span></label>
        </div>
        <div class="row">
          <button class="btn" id="rcNudgeL" aria-label="Nudge new left">←</button>
          <button class="btn" id="rcNudgeR" aria-label="Nudge new right">→</button>
          <button class="btn" id="rcNudgeU" aria-label="Nudge new up">↑</button>
          <button class="btn" id="rcNudgeD" aria-label="Nudge new down">↓</button>
          <button class="btn" id="rcNudgeRst">Reset nudge</button>
        </div>
        <div class="row">
          <button class="btn ${RC.mode.startsWith('align') ? 'p' : ''}" id="rcAlign">⌖ Two-point align</button>
          <button class="btn" id="rcAlignClr">Clear align</button>
        </div>
        <div class="row">
          <button class="btn wide" id="rcPng">📷 Save PNG</button>
          <button class="btn wide" id="rcPdf">📄 Save PDF</button>
        </div>
      </div>
    </div>
  </div>`;

  const reload = async () => {
    RC.oldId = $('#rcOld').value; RC.newId = $('#rcNew').value;
    if (RC.oldId === RC.newId) { toast('Pick two different sheets'); return; }
    RC.busy = true; $('#rcStep').textContent = 'Loading sheets…';
    try {
      const o = sheets.find(s => s.id === RC.oldId), n = sheets.find(s => s.id === RC.newId);
      RC.oldBm = await createImageBitmap(o.blob);
      RC.newBm = await createImageBitmap(n.blob);
      RC._oldTint = null; RC._newTint = null; RC.loadedOld = RC.oldId; RC.loadedNew = RC.newId;
      RC.dx = 0; RC.dy = 0; RC.scale = 1; RC.rot = 0; RC.alignOld = []; RC.alignNew = []; RC.mode = 'pan';
      rcSetupCanvas(); rcFit(); rcRedraw();
      $('#rcStep').textContent = `Overlay ready: ${rcLabel(o)} (red) vs ${rcLabel(n)} (blue). Pinch or use +/− to zoom. Nudge or two-point align if sheets don't line up.`;
    } catch (e) { $('#rcStep').textContent = 'Could not load: ' + e.message; toast('Load failed'); }
    RC.busy = false;
  };

  $('#rcLoad').onclick = reload;
  $('#rcSwap').onclick = () => { const a = $('#rcOld').value; $('#rcOld').value = $('#rcNew').value; $('#rcNew').value = a; };
  $('#rcOld').onchange = () => {}; $('#rcNew').onchange = () => {};
  $('#rcOp').oninput = e => { RC.opacity = (+e.target.value) / 100; $('#rcOpLbl').textContent = Math.round(RC.opacity * 100) + '%'; rcRedraw(); };
  $('#rcShowOld').onchange = e => { RC.showOld = e.target.checked; rcRedraw(); };
  $('#rcShowNew').onchange = e => { RC.showNew = e.target.checked; rcRedraw(); };
  const nudge = (dx, dy) => { RC.dx += dx; RC.dy += dy; rcRedraw(); $('#rcStep').textContent = `Nudge offset: dx=${RC.dx}, dy=${RC.dy} px (new relative to old)`; };
  const step = () => Math.max(1, Math.round(4 / (RC.view.s || 1)));
  $('#rcNudgeL').onclick = () => nudge(-step(), 0);
  $('#rcNudgeR').onclick = () => nudge(step(), 0);
  $('#rcNudgeU').onclick = () => nudge(0, -step());
  $('#rcNudgeD').onclick = () => nudge(0, step());
  $('#rcNudgeRst').onclick = () => { RC.dx = 0; RC.dy = 0; rcRedraw(); toast('Nudge reset'); };
  $('#rcAlign').onclick = () => {
    RC.mode = 'align1'; RC.alignOld = []; RC.alignNew = [];
    $('#rcStep').textContent = 'Align step 1/4: tap a point on the OLD (red) sheet.';
    $('#rcAlign').classList.add('p');
  };
  $('#rcAlignClr').onclick = () => {
    RC.alignOld = []; RC.alignNew = []; RC.scale = 1; RC.rot = 0; RC.dx = 0; RC.dy = 0; RC.mode = 'pan';
    $('#rcAlign').classList.remove('p');
    $('#rcStep').textContent = 'Align cleared. Overlay uses 1:1 with no offset.';
    rcRedraw();
  };
  $('#rcZin').onclick = () => { rcZoomAt({ x: rcCv.width / 2, y: rcCv.height / 2 }, 1.4); rcRedraw(); };
  $('#rcZout').onclick = () => { rcZoomAt({ x: rcCv.width / 2, y: rcCv.height / 2 }, 1 / 1.4); rcRedraw(); };
  $('#rcZfit').onclick = () => { if (RC.mode === 'align3') { RC.mode = 'pan'; $('#rcAlign').classList.remove('p'); $('#rcStep').textContent = `One-point align set (translate only) · dx=${RC.dx.toFixed(1)} dy=${RC.dy.toFixed(1)}`; } rcFit(); rcRedraw(); };
  $('#rcPng').onclick = () => rcSnapshot('png');
  $('#rcPdf').onclick = () => rcSnapshot('pdf');

  // Auto-load when bitmaps are missing OR were loaded for different sheets (v1.9.1: switching projects / picks
  // used to keep showing the previous overlay under the new sheet labels)
  if (!RC.oldBm || !RC.newBm || RC.loadedOld !== RC.oldId || RC.loadedNew !== RC.newId) await reload();
  else { rcSetupCanvas(); rcFit(); rcRedraw(); $('#rcStep').textContent = `Overlay: ${rcLabel(oldS)} (red) vs ${rcLabel(newS)} (blue).`; }

  setPrimary('📐 Back to Plans', () => go('plans'));
};

let rcCv = null, rcG = null, rcPtrs = new Map(), rcPinch = null, rcDrag = null, rcRaf = 0;

function rcSetupCanvas() {
  rcCv = $('#rcCv'); if (!rcCv) return;
  rcG = rcCv.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2), r = rcCv.getBoundingClientRect();
  rcCv.width = Math.round(r.width * dpr); rcCv.height = Math.round(Math.max(300, r.height) * dpr);
  rcCv.onpointerdown = rcOnDown; rcCv.onpointermove = rcOnMove; rcCv.onpointerup = rcOnUp; rcCv.onpointercancel = rcOnCancel;
  // v1.9.1: property handler (not addEventListener) so a resize re-setup doesn't stack duplicate wheel-zoom handlers
  rcCv.onwheel = e => { e.preventDefault(); rcZoomAt(rcToCv(e), e.deltaY < 0 ? 1.15 : 1 / 1.15); rcRedraw(); };
}

function rcToCv(e) {
  const r = rcCv.getBoundingClientRect(), dpr = r.width ? rcCv.width / r.width : 1;
  return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
}
function rcToImg(c) {
  return { x: (c.x - RC.view.x) / RC.view.s, y: (c.y - RC.view.y) / RC.view.s };
}
function rcZoomAt(c, f) {
  const s0 = RC.view.s, s1 = Math.max(RC.fitS * 0.4, Math.min(RC.fitS * 16, s0 * f)), k = s1 / s0;
  RC.view.x = c.x - (c.x - RC.view.x) * k; RC.view.y = c.y - (c.y - RC.view.y) * k; RC.view.s = s1;
}
function rcFit() {
  if (!RC.oldBm || !rcCv) return;
  const W = RC.oldBm.width, H = RC.oldBm.height;
  const s = Math.min(rcCv.width / W, rcCv.height / H) * 0.96;
  RC.fitS = s; RC.view.s = s;
  RC.view.x = (rcCv.width - W * s) / 2; RC.view.y = (rcCv.height - H * s) / 2;
}

function rcColorize(bm, rgb) {
  const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
  const g = c.getContext('2d'); g.drawImage(bm, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  const [R, G, B] = rgb;
  for (let i = 0; i < d.length; i += 4) {
    // luminance: dark linework → strong tint, light paper → transparent-ish white kept light
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const ink = Math.max(0, Math.min(1, (220 - y) / 180)); // 0 paper, 1 ink
    if (ink < 0.05) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 0; continue; }
    // blend toward tint color by ink amount; paper stays transparent
    d[i] = Math.round(255 + (R - 255) * ink);
    d[i + 1] = Math.round(255 + (G - 255) * ink);
    d[i + 2] = Math.round(255 + (B - 255) * ink);
    d[i + 3] = Math.round(255 * Math.min(1, ink * 1.15));
  }
  g.putImageData(id, 0, 0);
  return c;
}

function rcApplyAlign() {
  // From 1 pair: translate only. From 2 pairs: translate + uniform scale + rotation of NEW onto OLD.
  if (RC.alignOld.length < 1 || RC.alignNew.length < 1) return;
  if (RC.alignOld.length === 1 || RC.alignNew.length === 1) {
    RC.dx = RC.alignOld[0].x - RC.alignNew[0].x;
    RC.dy = RC.alignOld[0].y - RC.alignNew[0].y;
    RC.scale = 1; RC.rot = 0;
    return;
  }
  const a0 = RC.alignOld[0], a1 = RC.alignOld[1], b0 = RC.alignNew[0], b1 = RC.alignNew[1];
  const dA = Math.hypot(a1.x - a0.x, a1.y - a0.y), dB = Math.hypot(b1.x - b0.x, b1.y - b0.y);
  if (!(dB > 1e-6)) return;
  RC.scale = dA / dB;
  RC.rot = Math.atan2(a1.y - a0.y, a1.x - a0.x) - Math.atan2(b1.y - b0.y, b1.x - b0.x);
  // Map b0 → a0 under scale+rot around origin then translate
  const cos = Math.cos(RC.rot), sin = Math.sin(RC.rot);
  const nx = RC.scale * (b0.x * cos - b0.y * sin);
  const ny = RC.scale * (b0.x * sin + b0.y * cos);
  RC.dx = a0.x - nx; RC.dy = a0.y - ny;
}

function rcRedraw() {
  if (rcRaf) return;
  rcRaf = requestAnimationFrame(() => {
    rcRaf = 0;
    if (!rcG || !rcCv) return;
    const g = rcG, W = rcCv.width, H = rcCv.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#d6dbe3'; g.fillRect(0, 0, W, H);
    if (!RC.oldBm && !RC.newBm) return;
    g.setTransform(RC.view.s, 0, 0, RC.view.s, RC.view.x, RC.view.y);

    // Base white paper size = old sheet
    if (RC.oldBm) {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, RC.oldBm.width, RC.oldBm.height);
    }

    if (RC.showOld && RC.oldBm) {
      if (!RC._oldTint || RC._oldTint._w !== RC.oldBm.width) {
        RC._oldTint = rcColorize(RC.oldBm, [220, 30, 30]);
        RC._oldTint._w = RC.oldBm.width;
      }
      g.drawImage(RC._oldTint, 0, 0);
    }
    if (RC.showNew && RC.newBm) {
      if (!RC._newTint || RC._newTint._w !== RC.newBm.width) {
        RC._newTint = rcColorize(RC.newBm, [30, 80, 220]);
        RC._newTint._w = RC.newBm.width;
      }
      g.save();
      g.globalAlpha = RC.opacity;
      // multiply makes overlapping ink go dark (common linework)
      g.globalCompositeOperation = 'multiply';
      g.translate(RC.dx, RC.dy);
      g.rotate(RC.rot);
      g.scale(RC.scale, RC.scale);
      g.drawImage(RC._newTint, 0, 0);
      g.restore();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }

    // Align crosshairs
    const u = 1 / RC.view.s;
    const drawPt = (p, col, lbl) => {
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2 * u;
      g.beginPath(); g.moveTo(p.x - 12 * u, p.y); g.lineTo(p.x + 12 * u, p.y); g.moveTo(p.x, p.y - 12 * u); g.lineTo(p.x, p.y + 12 * u); g.stroke();
      g.font = `bold ${14 * u}px system-ui,sans-serif`; g.fillText(lbl, p.x + 8 * u, p.y - 8 * u);
    };
    RC.alignOld.forEach((p, i) => drawPt(p, '#b91c1c', 'O' + (i + 1)));
    RC.alignNew.forEach((p, i) => {
      // new points are in new-image space; show where they land after transform
      const cos = Math.cos(RC.rot), sin = Math.sin(RC.rot);
      const x = RC.scale * (p.x * cos - p.y * sin) + RC.dx;
      const y = RC.scale * (p.x * sin + p.y * cos) + RC.dy;
      drawPt({ x, y }, '#1d4ed8', 'N' + (i + 1));
    });
  });
}

function rcOnDown(e) {
  rcCv.setPointerCapture(e.pointerId);
  const c = rcToCv(e); rcPtrs.set(e.pointerId, c);
  if (rcPtrs.size === 2) {
    const [a, b] = [...rcPtrs.values()];
    rcPinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    rcDrag = null; return;
  }
  if (RC.mode === 'align1' || RC.mode === 'align2' || RC.mode === 'align3' || RC.mode === 'align4') {
    const img = rcToImg(c);
    if (RC.mode === 'align1') {
      RC.alignOld = [img]; RC.mode = 'align2';
      $('#rcStep').textContent = 'Align step 2/4: tap the SAME point on the NEW (blue) sheet.';
    } else if (RC.mode === 'align2') {
      // tap is in old/view space; convert approximate new-space by inverse of current transform
      const inv = rcInvMap(img);
      RC.alignNew = [inv]; RC.mode = 'align3'; rcApplyAlign(); rcRedraw();
      $('#rcStep').textContent = 'Align step 3/4 (optional): tap a second point on OLD, or tap Fit when done with one pair.';
    } else if (RC.mode === 'align3') {
      RC.alignOld[1] = img; RC.mode = 'align4';
      $('#rcStep').textContent = 'Align step 4/4: tap the SAME second point on NEW.';
    } else if (RC.mode === 'align4') {
      RC.alignNew[1] = rcInvMap(img); RC.mode = 'pan'; rcApplyAlign();
      $('#rcAlign').classList.remove('p');
      $('#rcStep').textContent = `Two-point align set · scale=${RC.scale.toFixed(4)} · rot=${(RC.rot * 180 / Math.PI).toFixed(2)}° · dx=${RC.dx.toFixed(1)} dy=${RC.dy.toFixed(1)}`;
      // invalidate not needed; transform changed
      rcRedraw();
    }
    return;
  }
  rcDrag = { x: c.x, y: c.y, vx: RC.view.x, vy: RC.view.y };
}
function rcInvMap(p) {
  // Inverse of: translate(dx,dy) * rotate(rot) * scale(s) applied to new coords
  const x = p.x - RC.dx, y = p.y - RC.dy;
  const cos = Math.cos(-RC.rot), sin = Math.sin(-RC.rot);
  const rx = x * cos - y * sin, ry = x * sin + y * cos;
  const s = RC.scale || 1;
  return { x: rx / s, y: ry / s };
}
function rcOnMove(e) {
  if (!rcPtrs.has(e.pointerId)) return;
  const c = rcToCv(e); rcPtrs.set(e.pointerId, c);
  if (rcPinch && rcPtrs.size >= 2) {
    const [a, b] = [...rcPtrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    RC.view.x += m.x - rcPinch.m.x; RC.view.y += m.y - rcPinch.m.y;
    rcZoomAt(m, d / rcPinch.d); rcPinch = { d, m }; return rcRedraw();
  }
  if (rcDrag && RC.mode === 'pan') {
    RC.view.x = rcDrag.vx + (c.x - rcDrag.x); RC.view.y = rcDrag.vy + (c.y - rcDrag.y); rcRedraw();
  }
}
function rcOnUp(e) {
  const was = !!rcPinch; rcPtrs.delete(e.pointerId);
  if (rcPtrs.size < 2) rcPinch = null;
  if (was || !rcDrag) { if (!rcPtrs.size) rcDrag = null; return; }
  rcDrag = null;
}
function rcOnCancel(e) { rcPtrs.delete(e.pointerId); rcPinch = null; rcDrag = null; }

async function rcSnapshot(kind) {
  if (!RC.oldBm) return toast('Load an overlay first');
  // Render full-res overlay (old sheet size)
  const W = RC.oldBm.width, H = RC.oldBm.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const keep = { view: { ...RC.view }, s: RC.view.s };
  // paint in image space
  if (RC.showOld) {
    if (!RC._oldTint) RC._oldTint = rcColorize(RC.oldBm, [220, 30, 30]);
    g.drawImage(RC._oldTint, 0, 0);
  }
  if (RC.showNew && RC.newBm) {
    if (!RC._newTint) RC._newTint = rcColorize(RC.newBm, [30, 80, 220]);
    g.save(); g.globalAlpha = RC.opacity; g.globalCompositeOperation = 'multiply';
    g.translate(RC.dx, RC.dy); g.rotate(RC.rot); g.scale(RC.scale, RC.scale);
    g.drawImage(RC._newTint, 0, 0); g.restore();
  }
  // legend bar
  g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(0, H - 36, W, 36);
  g.fillStyle = '#fca5a5'; g.font = 'bold 18px system-ui,sans-serif'; g.fillText('OLD (red)', 12, H - 12);
  g.fillStyle = '#93c5fd'; g.fillText('NEW (blue)', 140, H - 12);
  g.fillStyle = '#e5e7eb'; g.fillText('common → dark · Right Hand Man', 300, H - 12);

  const nameBase = `RevCompare_${safe(APP.project && APP.project.name)}`;
  if (kind === 'png') {
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const f = new File([blob], nameBase + '.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ title: 'Revision compare', files: [f] }); toast('Shared ✔'); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    download(nameBase + '.png', blob); toast('PNG downloaded');
  } else {
    await loadScript('lib/jspdf.umd.min.js');
    const { jsPDF } = window.jspdf;
    const landscape = W >= H;
    const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'letter' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const margin = 24, maxW = pw - margin * 2, maxH = ph - margin * 2 - 20;
    const k = Math.min(maxW / W, maxH / H);
    const dw = W * k, dh = H * k;
    const data = c.toDataURL('image/jpeg', 0.92);
    pdf.addImage(data, 'JPEG', margin + (maxW - dw) / 2, margin, dw, dh);
    pdf.setFontSize(9); pdf.text('Revision compare · Designed by Joe Dane Lucero P.E. · share/download only', margin, ph - 12);
    const blob = pdf.output('blob');
    await sharePDF(blob, nameBase + '.pdf', 'Revision compare ' + (APP.project && APP.project.name || ''));
  }
}

// Invalidate tint caches when sheets reload
const _rcLoadHook = () => { RC._oldTint = null; RC._newTint = null; };
window.addEventListener('resize', () => {
  if (APP.route === 'revcmp' && rcCv) { rcSetupCanvas(); rcFit(); rcRedraw(); }
});
