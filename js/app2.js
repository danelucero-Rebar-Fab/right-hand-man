/* Right Hand Man - Plans, Takeoff, Shop Drawings screens */
'use strict';
/* ---------- PLANS ---------- */
ROUTES.plans = async () => { if (needProject()) return; const sheets = await loadSheets();
  if (PL.cur && PL.cur.projectId !== APP.pid) { PL.cur = null; PL.src = null; }
  if (!PL.cur && sheets.length) await openSheet(PL.curId && sheets.find(s => s.id === PL.curId) ? PL.curId : sheets[0].id);
  const r = PL.cur, sov = APP.project.sov || []; if (r && PL.tool === 'pan' && !PL.userTool) PL.tool = r.ppf ? 'len' : 'cal';
  if (!sheets.length) { main().innerHTML = `<div class="empty"><h2>Add your plan sheets</h2><p>Pick a PDF plan set or take photos of the sheets. Each page becomes a sheet you can scale, measure and mark up.</p>
    <label class="btn xl p">📄 Choose PDF or photos<input type="file" id="gal" accept="image/*,application/pdf,.pdf" multiple hidden></label><label class="btn xl">📷 Take a photo<input type="file" id="cam" accept="image/*" capture="environment" hidden></label><p id="step" class="step"></p></div>`;
    const h = async e => { const f = e.target.files; if (!f.length) return; await addPlanFiles(f); PL.tool = 'cal'; PL.pts = []; go('plans'); }; $('#gal').onchange = h; $('#cam').onchange = h; return; }
  main().innerHTML = `<div class="plans">
  <div class="pl-left"><div class="strip">${sheets.map(s => `<button class="sheet ${r && r.id === s.id ? 'on' : ''}" data-sheet="${s.id}"><img src="${s.thumb}" alt=""><span>${esc(s.sheetNo || s.name)}</span><small>${s.ppf ? '✔ scaled' : 'no scale'} · ${s.meas.length + s.marks.length}</small></button>`).join('')}
    <label class="sheet add">➕<span>Add</span><input type="file" id="gal" accept="image/*,application/pdf,.pdf" multiple hidden></label></div>
  <div class="cvwrap"><canvas id="cv" aria-label="Plan sheet"></canvas><div class="zoom"><button id="zin" aria-label="Zoom in">＋</button><button id="zout" aria-label="Zoom out">−</button><button id="zfit" aria-label="Fit">⤢</button><button id="undo" aria-label="Undo">↶</button></div></div>
  <p id="step" class="step" aria-live="polite"></p>
  <div id="calForm" class="inline" hidden><input id="calLen" placeholder="Real length, e.g. 20'-0&quot;" inputmode="decimal" data-ftin aria-label="Real length between the two taps (feet-inches like 20'-0&quot; or decimal feet)" enterkeyhint="done"><button class="btn p" id="calSet">Set scale</button></div>
  <div id="volForm" class="inline" hidden><input id="volDepth" placeholder="Depth, e.g. 1'-6&quot; or 18&quot;"></div>
  <div id="progForm" class="inline" hidden><select id="progSov" aria-label="Pay item (SOV line)"><option value="">Pay item (SOV line)…</option>${sov.map(s => `<option value="${s.id}" ${PL.sovId === s.id ? 'selected' : ''}>${esc(s.item)} ${esc(s.desc)}</option>`).join('')}</select>
    <div class="seg">${['area','length','count'].map(m => `<button data-pm="${m}" class="${PL.progMode === m ? 'on' : ''}">${m}</button>`).join('')}</div></div>
  <button id="saveM" class="btn p wide" hidden>✔ Save measurement</button><button id="ocrRun" class="btn p wide" hidden>🔍 Read this text</button>
  <div class="tools" role="toolbar">${TOOLS.map(([k, i, l]) => `<button data-tool="${k}" class="${PL.tool === k ? 'on' : ''}"><span>${i}</span>${l}</button>`).join('')}</div>
  </div><div class="pl-right">
  <div class="card"><b>Layer for markup</b><div class="layers">${r.layers.map(l => `<span class="chip ${PL.layer === l.name ? 'on' : ''}" style="--c:${l.color}"><button data-layer="${l.name}">${l.name}</button><button data-vis="${l.name}" aria-label="show/hide">${l.on ? '👁' : '🚫'}</button><input type="color" data-col="${l.name}" value="${l.color}" aria-label="color"></span>`).join('')}<button class="chip" id="addLayer">＋ layer</button></div></div>
  ${r.paper && r.paper.reduced ? `<p class="warn" id="reducedWarn">⚠ Reduced set: ${esc(r.paper.reason)}. Printed scales will be off - calibrate with two taps on a known dimension.</p>` : ''}<details class="card"><summary><b>Sheet info</b> ${esc(r.sheetNo || '')} · PDF p.${r.page} · ${esc(r.scaleTxt || 'no scale')}${r.paper ? ' · ' + esc(r.paper.name) : ''}</summary>
    <div class="grid2">${fld('sheetNo', 'Sheet number (for citations)', r.sheetNo, 'S-101')}${fld('name', 'Sheet name', r.name)}${fld('page', 'PDF page', r.page, '', 'number')}</div>
    <div class="inline"><input id="scaleTxt" placeholder='Printed scale, e.g. 1/4"=1&#39;-0"'><button class="btn" id="scaleSet">Use printed scale</button></div>
    <p class="muted small">Printed scale works on PDF pages printed full size. On photos, use 📏 Set scale with two taps. Always check one known dimension.</p><button class="btn danger sm" id="delSheet">Delete this sheet</button></details>
  <div class="card"><b>Measurements on this sheet</b> <label class="small">Link new measurements to: <select id="measSov"><option value="">(no pay item)</option>${sov.map(s => `<option value="${s.id}">${esc(s.item)} ${esc(s.desc)}</option>`).join('')}</select></label>
    <div class="mlist">${r.meas.map(m => `<div class="mrow"><span class="grow">${m.type === 'prog' ? '✅ ' : ''}${esc(m.label)} ${m.sovId ? `<small>→ ${esc((sov.find(s => s.id === m.sovId) || {}).item || '')}</small>` : ''}</span>${m.type !== 'prog' ? `<button class="btn sm" data-tk="${m.id}">→ Takeoff</button>` : ''}</div>`).join('') || '<p class="muted small">None yet.</p>'}</div></div>
  <div class="card" id="progCard"></div></div></div>`;
  setupCanvas(); plStatus();
  $$('[data-sheet]').forEach(b => b.onclick = async () => { await openSheet(b.dataset.sheet); go('plans'); });
  $('#gal').onchange = async e => { if (!e.target.files.length) return; await addPlanFiles(e.target.files); PL.cur = null; PL.tool = 'cal'; PL.pts = []; go('plans'); };
  // tools also respond on pointerup: a gloved finger that slides a little cancels the click, but should still pick the tool
  $$('[data-tool]').forEach(b => b.onclick = b.onpointerup = () => { if (PL.tool === b.dataset.tool && b.classList.contains('on')) return; PL.tool = b.dataset.tool; PL.userTool = true; PL.pts = []; PL.ocrBox = null; $$('[data-tool]').forEach(x => x.classList.toggle('on', x === b)); if (['pen','cloud','arrow','text','rect'].includes(PL.tool) && PL.layer === 'Progress') PL.layer = 'Redline'; redraw(); });
  $('#zin').onclick = () => { zoomAt({x:cv.width / 2, y:cv.height / 2}, 1.4); redraw(); }; $('#zout').onclick = () => { zoomAt({x:cv.width / 2, y:cv.height / 2}, 1 / 1.4); redraw(); }; $('#zfit').onclick = () => { fit(); redraw(); }; $('#undo').onclick = undo;
  $('#calSet').onclick = () => setScale(RHM.parseLen($('#calLen').value)); $('#calLen').onkeydown = e => { if (e.key === 'Enter') $('#calSet').click(); }; $('#scaleSet').onclick = () => setScaleText($('#scaleTxt').value);
  $('#saveM').onclick = async () => { if (await saveMeas()) go('plans'); }; $('#ocrRun').onclick = async () => { const t = await runOCR(); if (!t) return toast('No text found - zoom in and try a tighter box');
    const len = RHM.parseLen((t.match(/\d+\s*'\s*-?\s*\d*\s*"?/) || [''])[0]); if (len > 0 && PL.pts.length === 2 && confirm(`Read "${t}". Use ${RHM.fmtFtIn(len)} as the scale length?`)) return setScale(len);
    if (confirm(`Read:\n\n${t}\n\nAdd it as a note on the sheet?`)) { const L = PL.cur.layers.find(l => l.name === 'Notes'); pushUndo(); PL.cur.marks.push({id:uid(), type:'text', layer:'Notes', color:L.color, pts:[{x:PL.ocrBox.x, y:PL.ocrBox.y + PL.ocrBox.h + 30}], text:t.replace(/\s+/g, ' ').slice(0, 80), size:Math.max(18, PL.ocrBox.h / 3)}); await saveSheet(); redraw(); } };
  $('#progSov').onchange = e => { PL.sovId = e.target.value; plStatus(); }; $$('[data-pm]').forEach(b => b.onclick = () => { PL.progMode = b.dataset.pm; PL.pts = []; $$('[data-pm]').forEach(x => x.classList.toggle('on', x === b)); redraw(); });
  $$('[data-layer]').forEach(b => b.onclick = () => { PL.layer = b.dataset.layer; $$('.layers .chip').forEach(c => c.classList.toggle('on', c.contains(b))); });
  $$('[data-vis]').forEach(b => b.onclick = async () => { const l = r.layers.find(x => x.name === b.dataset.vis); l.on = !l.on; b.textContent = l.on ? '👁' : '🚫'; await saveSheet(); redraw(); });
  $$('[data-col]').forEach(i => i.onchange = async () => { const l = r.layers.find(x => x.name === i.dataset.col); l.color = i.value; r.marks.forEach(m => { if (m.layer === l.name) m.color = i.value; }); await saveSheet(); redraw(); });
  $('#addLayer').onclick = async () => { const n = prompt('Layer name?'); if (!n) return; r.layers.push({name:n, color:'#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'), on:true}); PL.layer = n; await saveSheet(); go('plans'); };
  $$('.pl-right [data-k]').forEach(i => i.onchange = async () => { r[i.dataset.k] = i.type === 'number' ? n0(i.value) : i.value; await saveSheet(); });
  $('#delSheet').onclick = async () => { if (!confirm('Delete this sheet and its markups?')) return; await DB.del('sheets', r.id); PL.cur = null; PL.curId = null; go('plans'); };
  $$('[data-tk]').forEach(b => b.onclick = () => measToTakeoff(r, r.meas.find(m => m.id === b.dataset.tk)));
  const pg = await progressBySov(APP.pid); $('#progCard').innerHTML = `<b>% complete from markups</b>${Object.keys(pg).length ? `<table class="t"><tr><th>Pay item</th><th>Plan</th><th>Done</th><th>%</th></tr>${Object.entries(pg).map(([id, o]) => { const s = sov.find(x => x.id === id) || {}; return `<tr><td>${esc(s.item || '?')} ${esc(s.desc || '')}</td><td>${RHM.fmt(o.plan, 1)} ${o.unitPlan}</td><td>${RHM.fmt(o.done, 1)} ${o.unitDone}</td><td>${o.pct === null ? '<small>link a plan qty</small>' : RHM.fmt(o.pct, 1) + '%'}</td></tr>`; }).join('')}</table>` : '<p class="muted small">Measure the plan quantity with "Link to pay item", then use ✅ % Done to mark what is installed.</p>'}`;
  setPrimary('📄 Export marked sheets (PDF)', () => exportSheetsPDF());
  // Revision compare entry (rank 22)
  if (!$('#rcGo') && sheets.length >= 1) {
    const bar = document.createElement('div'); bar.className = 'row'; bar.style.marginTop = '8px';
    bar.innerHTML = `<button class="btn wide" id="rcGo">🔀 Compare revisions</button>`;
    const host = main().querySelector('.pl-right') || main().querySelector('.plans');
    if (host) host.appendChild(bar);
    $('#rcGo').onclick = () => go('revcmp', PL.cur ? { oldId: PL.cur.id } : null);
  }
};
window.addEventListener('resize', () => { if (APP.route === 'plans' && cv) { const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); fit(); redraw(); } });
async function measToTakeoff(sheet, m) { const spec = prompt('Spec section for this item (leave blank if not known - it will be listed as an RFI):', '') ?? null; if (spec === null) return;
  const unit = m.unit, q = m.value, math = m.type === 'vol' ? `plan area ${RHM.fmt(m.vol.sf, 1)} SF x depth ${RHM.fmtFtIn(m.vol.depth)} / 27 = ${RHM.fmt(q)} CY (scaled from sheet, ${sheet.scaleTxt})` : m.type === 'cnt' ? `${q} EA counted on sheet` : `scaled from sheet at ${sheet.scaleTxt}: ${RHM.fmt(q)} ${unit}`;
  await DB.put('takeoff', {id:uid(), projectId:APP.pid, trade:'General', tpl:'measured', p:{qty:q, unit, desc:m.name || m.label, math}, desc:m.name || m.label, sheet:sheet.sheetNo || sheet.name, page:sheet.page, spec, fromMeas:m.id, created:Date.now()});
  toast('Added to Takeoff ✔'); }

/* ---------- TAKEOFF ---------- */
const TRADES = ['Rebar','Concrete','Excavation','Masonry','Steel','Piping','Electrical','Coatings','Roofing','Welding','Oilfield','Mech piping','Underground','General'];
const tradesFor = P => { const f = ptype(P).trades; return f ? [...f, ...TRADES.filter(t => !f.includes(t))] : TRADES; };
ROUTES.takeoff = async (arg) => { if (needProject()) return; const lines = (await DB.where('takeoff', t => t.projectId === APP.pid)).sort((a, b) => a.created - b.created);
  if (arg && arg.wizard) return takeoffWizard(arg.line);
  const ev = lines.map(l => { const e = RHM.evalLine(l); if (l.waste !== '' && l.waste != null && isFinite(+l.waste) && +l.waste !== 0) { e.rows = e.rows.map(r => { const w = RHMF.waste(r.qty, l.waste); return {...r, qty:w.qty, math:r.math + '; ' + w.math}; }); } return {l, e}; }), rfis = ev.flatMap(x => x.e.rfi.map(r => ({l:x.l, r}))), cites = ev.filter(x => x.e.citeMissing && x.e.citeMissing.length);
  const byTrade = {}; ev.forEach(x => (byTrade[x.l.trade] ||= []).push(x));
  main().innerHTML = `<h2>Takeoff</h2><p class="hint">Every line shows its math and cites sheet + PDF page + spec. Blanks are never guessed: they become RFIs. Laps are on their own rows. The higher defensible quantity is carried.</p>
  ${Object.entries(byTrade).map(([t, xs]) => `<div class="card"><h3>${t}</h3>${xs.map(({l, e}) => `<div class="tk" data-swipe="takeoff:${l.id}:${esc(l.desc || 'line')}"><div class="row"><b class="grow">${esc(l.desc || RHM.T[l.tpl].name)}</b><button class="btn sm" data-ed="${l.id}">Edit</button><button class="btn sm" data-dup="${l.id}">Copy</button><button class="x" data-del="${l.id}" aria-label="Delete">✕</button></div>
    <small class="cite">Sheet ${esc(l.sheet || '—')} · PDF p.${esc(l.page || '—')} · Spec ${esc(l.spec || '—')}${e.citeMissing && e.citeMissing.length ? ` <span class="warn">missing: ${e.citeMissing.join(', ')}</span>` : ''}</small>
    ${e.rows.map(r => `<div class="calc ${r.lap ? 'lap' : ''}"><b>${esc(r.desc)}: ${RHM.fmt(r.qty)} ${r.unit}</b>${r.carried ? ' <span class="tag">carried higher</span>' : ''}<br><code>${esc(r.math)}</code></div>`).join('')}
    ${e.rfi.map(x => `<div class="rfi">${esc(x)}</div>`).join('')}</div>`).join('')}</div>`).join('') || emptyState('🧮', 'No takeoff lines yet', 'Tap the button below. Or measure on Plans and press → Takeoff.')}${lines.length ? '<p class="muted small swipehint">Tip: swipe a line left to delete it (you can undo).</p>' : ''}
  ${rfis.length || cites.length ? `<div class="card warnbox"><h3>RFI list (${rfis.length + cites.length})</h3><ol>${rfis.map(x => `<li>${esc(x.l.desc || x.l.tpl)}: ${esc(x.r)}</li>`).join('')}${cites.map(x => `<li>${esc(x.l.desc || x.l.tpl)}: confirm ${x.e.citeMissing.join(', ')}</li>`).join('')}</ol></div>` : ''}
  <div class="row"><button class="btn" id="tkPdf">📄 Takeoff PDF</button><button class="btn" id="tkCsv">⬇ CSV</button><button class="btn" id="tkXls">⬇ Excel</button><button class="btn" id="toShop">🔩 Make shop drawings</button><button class="btn" id="toCO">📝 Price as quote / CO</button><button class="btn" id="toTrench">🦺 Trench safety selector</button></div>`;
  $$('[data-ed]').forEach(b => b.onclick = () => go('takeoff', {wizard:true, line:lines.find(l => l.id === b.dataset.ed)}));
  $$('[data-dup]').forEach(b => b.onclick = async () => { const l = structuredClone(lines.find(x => x.id === b.dataset.dup)); l.id = uid(); l.created = Date.now(); l.desc = (l.desc || '') + ' (copy)'; await DB.put('takeoff', l); go('takeoff'); });
  $$('[data-del]').forEach(b => b.onclick = async () => { const l = lines.find(x => x.id === b.dataset.del); await DB.del('takeoff', l.id); APP.undo.push(['takeoff', l]); go('takeoff'); toastUndo('Line deleted'); });
  $('#tkPdf').onclick = async () => { const b = await takeoffPDF(ev, rfis, cites); await sharePDF(b, `Takeoff_${safe(APP.project.name)}.pdf`, 'Takeoff ' + APP.project.name); };
  $('#toTrench').onclick = () => go('trench');
  $('#tkCsv').onclick = () => { const rows = [['Trade','Line','Row','Qty','Unit','Math','Sheet','PDF page','Spec','RFI']]; ev.forEach(({l, e}) => { e.rows.forEach(r => rows.push([l.trade, l.desc, r.desc, r.qty, r.unit, r.math, l.sheet, l.page, l.spec, ''])); e.rfi.forEach(x => rows.push([l.trade, l.desc, '', '', '', '', l.sheet, l.page, l.spec, x])); });
    download(`Takeoff_${safe(APP.project.name)}.csv`, rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv'); };
  $('#tkXls').onclick = () => { const rows = [['Trade','Line','Row','Qty','Unit','Math','Sheet','PDF page','Spec','RFI']]; ev.forEach(({l, e}) => { e.rows.forEach(r => rows.push([l.trade, l.desc, r.desc, r.qty, r.unit, r.math, l.sheet, l.page, l.spec, ''])); e.rfi.forEach(x => rows.push([l.trade, l.desc, '', '', '', '', l.sheet, l.page, l.spec, x])); });
    downloadXlsx(`Takeoff_${safe(APP.project.name)}.xlsx`, rows); };
  $('#toShop').onclick = () => go('shop'); $('#toCO').onclick = () => go('co', {fromTakeoff:true});
  setPrimary('➕ Add a takeoff line', () => go('takeoff', {wizard:true})); };
const safe = s => String(s || 'job').replace(/[^\w\-]+/g, '_').slice(0, 40);
function toastUndo(msg) { const el = $('#toast'); el.innerHTML = `${esc(msg)} <button id="tUndo">UNDO</button>`; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 5000);
  $('#tUndo').onclick = async () => { const u = APP.undo.pop(); if (u) { await DB.put(u[0], u[1]); el.classList.remove('on'); go(APP.route); } }; }

async function takeoffWizard(line) { const L = line ? structuredClone(line) : {id:uid(), projectId:APP.pid, trade:'', tpl:'', p:{}, desc:'', sheet:'', page:'', spec:'', schedQty:'', created:Date.now()}; APP.tkLine = L;
  let step = line ? 3 : 1; const sheets = await loadSheets();
  const draw = () => {
    if (step === 1) { const rec = recentTpls().filter(k => RHM.T[k]); main().innerHTML = `${wizHead(1, 4, 'Which trade?')}${rec.length ? `<h3>Use again</h3><div class="list">${rec.map(k => `<button class="li big" data-rtp="${k}">↻ <b>${esc(RHM.T[k].name)}</b> <small>${esc(RHM.T[k].trade)}</small></button>`).join('')}</div><h3>Or pick a trade</h3>` : ''}<div class="tiles small">${tradesFor(APP.project).map(t => `<button class="tile" data-t="${t}"><b>${t}</b></button>`).join('')}</div>`;
      $$('[data-t]').forEach(b => b.onclick = () => { L.trade = b.dataset.t; step = 2; draw(); }); $$('[data-rtp]').forEach(b => b.onclick = () => { L.tpl = b.dataset.rtp; L.trade = RHM.T[L.tpl].trade; step = 3; draw(); }); setPrimary(null); }
    else if (step === 2) { const ts = Object.entries(RHM.T).filter(([k, t]) => t.trade === L.trade || (L.trade === 'General' && k === 'measured'));
      main().innerHTML = `${wizHead(2, 4, `What are you taking off? (${L.trade})`)}<div class="list">${ts.map(([k, t]) => `<button class="li big" data-tp="${k}"><b>${t.name}</b></button>`).join('') || '<p>No template for this trade yet. Use General → Measured.</p>'}</div><button class="btn ghost" id="back">← Back</button>`;
      $$('[data-tp]').forEach(b => b.onclick = () => { L.tpl = b.dataset.tp; step = 3; draw(); }); $('#back').onclick = () => { step = 1; draw(); }; setPrimary(null); }
    else if (step === 3) { const t = RHM.T[L.tpl]; if (!line && PL.cur && PL.cur.projectId === APP.pid && !L.sheet && !L.page && !L.citeAuto) { L.sheet = PL.cur.sheetNo || ''; L.page = PL.cur.page || ''; L.citeAuto = true; }
      main().innerHTML = `${wizHead(3, 4, t.name)}<p class="hint">Type only what the plans show. Leave a box blank if it is not shown — it becomes an RFI, never a guess.</p>
      ${fld('desc', 'Name this line (element / location)', L.desc, 'example: Wet well wall, east face')}
      ${t.fields.map(f => `<label class="fld"><span>${f.l}${f.u ? ` <small>(${f.u})</small>` : ''}${f.req ? '' : ' <small>optional' + (f.def !== undefined && f.def !== '' ? ', default ' + f.def : '') + '</small>'}</span>${f.opts ? `<select data-p="${f.k}" data-help="${esc(f.l)}">${f.opts.map(o => `<option value="${esc(o)}" ${String(L.p[f.k] ?? f.def ?? '') === String(o) ? 'selected' : ''}>${esc(t.optLabel ? t.optLabel(f.k, o) : (o === '' ? '- none -' : o))}</option>`).join('')}</select>` : `<input data-p="${f.k}" value="${esc(L.p[f.k] ?? '')}" ${f.u && !['','ft-in'].includes(f.u) ? 'inputmode="decimal"' : ''} ${f.u === 'FT' || f.u === 'ft-in' ? 'data-ftin' : ''} data-help="${esc(f.l)}" placeholder="${f.req ? 'from plans' : esc(String(f.def ?? ''))}">`}</label>`).join('')}
      ${fld('schedQty', 'Plan schedule quantity, if the plans list one (the higher is carried)', L.schedQty, 'optional')}
      <label class="fld"><span>Waste % <small>optional — blank = no waste added</small></span><input data-waste type="number" inputmode="decimal" step="any" value="${esc(L.waste ?? '')}" placeholder="e.g. 5"></label>
      <div id="preview" class="card"></div>${L.sheet && L.page ? `<button class="btn p wide" id="saveNow">✔ Save now · cites Sheet ${esc(L.sheet)} · PDF p.${esc(L.page)}${L.spec ? ' · ' + esc(L.spec) : ''}</button>` : ''}<button class="btn ghost" id="back">← Back</button>`;
      bindFields(L, pv); $$('[data-p]').forEach(i => i.oninput = () => { L.p[i.dataset.p] = i.value; pv(); }); const wi = document.querySelector('[data-waste]'); if (wi) wi.oninput = () => { L.waste = wi.value; pv(); }; pv(); $('#back').onclick = () => { step = 2; draw(); };
      const sn = $('#saveNow'); if (sn) sn.onclick = async () => { delete L.citeAuto; await DB.put('takeoff', L); pushRecentTpl(L.tpl); buzz(15); toast('Saved ✔'); go('takeoff'); };
      setPrimary('Next: cite the source →', () => { step = 4; draw(); }); }
    else { main().innerHTML = `${wizHead(4, 4, 'Where does it come from?')}<p class="hint">Every line cites sheet + PDF page + spec section.</p>
      <label class="fld"><span>Sheet</span><select id="pickSheet"><option value="">Pick a loaded sheet…</option>${sheets.map(s => `<option value="${s.id}">${esc(s.sheetNo || s.name)} (PDF p.${s.page})</option>`).join('')}</select></label>
      ${fld('sheet', 'Sheet number', L.sheet, 'S-201')}${fld('page', 'PDF page', L.page, '', 'number')}${fld('spec', 'Spec section / standard', L.spec, 'example: 03 20 00 or TxDOT Item 440')}
      <div id="preview" class="card"></div><button class="btn ghost" id="back">← Back</button>`;
      bindFields(L, pv); pv(); $('#pickSheet').onchange = e => { const s = sheets.find(x => x.id === e.target.value); if (!s) return; L.sheet = s.sheetNo || s.name; L.page = s.page; draw(); };
      $('#back').onclick = () => { step = 3; draw(); };
      setPrimary('✔ Save takeoff line', async () => { delete L.citeAuto; await DB.put('takeoff', L); pushRecentTpl(L.tpl); buzz(15); toast('Saved ✔'); go('takeoff'); }); } };
  const pv = () => { const e = RHM.evalLine(L), el = $('#preview'); if (!el) return; const rows = (L.waste !== '' && L.waste != null && isFinite(+L.waste) && +L.waste !== 0) ? e.rows.map(r => { const w = RHMF.waste(r.qty, L.waste); return {...r, qty:w.qty, math:r.math + '; ' + w.math}; }) : e.rows;
    el.innerHTML = `<b>Result</b>${rows.map(r => `<div class="calc ${r.lap ? 'lap' : ''}"><b>${esc(r.desc)}: ${RHM.fmt(r.qty)} ${r.unit}</b><br><code>${esc(r.math)}</code></div>`).join('')}${e.rfi.map(x => `<div class="rfi">${esc(x)}</div>`).join('')}${L.waste !== '' && L.waste != null && +L.waste ? `<p class="small muted">Waste ${esc(L.waste)}% applied via RHMF.waste — blank waste leaves the plan qty as-is.</p>` : ''}`; };
  draw(); }

/* ---------- SHOP DRAWINGS ---------- */
ROUTES.shop = async () => { if (needProject()) return; const P = APP.project; P.shop ||= {marks:[], rev:[{no:'0', date:today(), desc:'Issued for review', by:'JDL'}], status:'For Review', title:'', sheetNo:'SD-1'};
  const SD = P.shop, tk = (await DB.where('takeoff', t => t.projectId === APP.pid && t.tpl.startsWith('rebar'))).map(l => ({l, e:RHM.evalLine(l)}));
  const res = RHM.barList(SD.marks, SET.rates);
  main().innerHTML = `<h2>Shop Drawings <span class="stamp ${SD.status === 'Approved' ? 'ok' : ''}">${esc(SD.status)}</span></h2>
  <p class="hint">Bar list / bending schedule by mark. Legs are out-to-out per CRSI/ACI 315 diagrams. A leg the plans don't print stays blank and is listed as an RFI — it is never made up.</p>
  ${tk.length ? `<div class="card"><div class="row"><b class="grow">Start from takeoff</b>${tk.length > 1 ? `<button class="btn p sm" id="impAll">⬇ Import all ${tk.length} lines</button>` : ''}</div><div class="list">${tk.map(({l, e}) => `<div class="li"><div class="grow">${esc(l.desc || 'Rebar')}<small>#${esc(l.p.bar)} · ${esc(l.p.count || '?')} EA · Sheet ${esc(l.sheet || '—')} p.${esc(l.page || '—')}</small></div><button class="btn sm" data-imp="${l.id}">Add marks</button></div>`).join('')}</div></div>` : '<p class="muted">Tip: rebar takeoff lines can be pulled in here as marks.</p>'}
  <div class="marks">${SD.marks.map((m, i) => { const r = res.rows[i], sh = RHM.SHAPES[m.shape] || RHM.SHAPES.STR; return `<div class="card mark ${r.ok ? '' : 'rfiC'}" data-i="${i}">
    <div class="grid4"><label class="fld"><span>Mark</span><input data-m="mark" value="${esc(m.mark)}"></label><label class="fld"><span>Bar #</span><input data-m="bar" value="${esc(m.bar)}" inputmode="numeric"></label><label class="fld"><span>Count</span><input data-m="count" value="${esc(m.count)}" inputmode="numeric"></label>
    <label class="fld"><span>Shape</span><select data-m="shape">${Object.entries(RHM.SHAPES).map(([k, s]) => `<option value="${k}" ${m.shape === k ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label></div>
    <div class="grid4">${sh.legs.map(k => `<label class="fld"><span>Leg ${k}${k === 'D' ? ' (dia.)' : k === 'C' && sh.hoop ? ' (lap)' : ''}</span><input data-leg="${k}" value="${esc((m.legs || {})[k] || '')}" placeholder="from plans"></label>`).join('')}<label class="fld"><span>CRSI fig. code</span><input data-m="crsi" value="${esc(m.crsi || '')}" placeholder="optional"></label></div>
    <div class="grid4"><label class="fld"><span>Element / location</span><input data-m="where" value="${esc(m.where || '')}"></label><label class="fld"><span>Sheet</span><input data-m="sheet" value="${esc(m.sheet || '')}"></label><label class="fld"><span>PDF page</span><input data-m="page" value="${esc(m.page || '')}"></label><button class="x" data-rm="${i}" aria-label="Remove mark">✕</button></div>
    <div class="calc">${r.ok ? `<b>${r.lenTxt} cut · ${RHM.fmt(r.lb)} LB · ${r.fab ? 'fabricated' : 'straight'}</b><br><code>${esc(r.math)}</code>${r.warn ? `<div class="rfi">${esc(r.warn)}</div>` : ''}` : `<div class="rfi">${esc(r.rfi)}</div>`}</div></div>`; }).join('')}</div>
  <button class="btn" id="addMark">➕ Add a mark</button>
  <div class="card"><b>Totals</b><br>Fabricated ${RHM.fmt(res.fabLb)} LB (${res.fabTons} T) · Straight ${RHM.fmt(res.strLb)} LB · Total ${RHM.fmt(res.totLb)} LB<br>Shop drawing charge: <b>${M(res.shop)}</b> <small>${esc(res.shopMath)}</small>
   ${res.rfis.length ? `<div class="warnbox"><b>${res.rfis.length} RFI(s)</b><ol>${res.rfis.map(r => `<li>${esc(r)}</li>`).join('')}</ol></div>` : ''}</div>
  <details class="card"><summary><b>Title block & revisions</b></summary>${fld('title', 'Drawing title', SD.title || P.name + ' - Reinforcing Placing Drawing')}${fld('sheetNo', 'Shop sheet no.', SD.sheetNo)}${fld('planRef', 'Plan reference (sheet + PDF page)', SD.planRef || '', 'S-201 / PDF p.14')}
    <table class="t">${SD.rev.map(r => `<tr><td>${esc(r.no)}</td><td>${esc(r.date)}</td><td>${esc(r.desc)}</td><td>${esc(r.by)}</td></tr>`).join('')}</table><button class="btn sm" id="addRev">➕ Revision</button>
    <label class="switch"><input type="checkbox" id="appr" ${SD.status === 'Approved' ? 'checked' : ''}><span>Approved by the engineer/GC (removes the FOR REVIEW stamp)</span></label></details>`;
  const save = async () => { await saveProject(); };
  const impAll = $('#impAll'); if (impAll) impAll.onclick = async () => { for (const x of tk) await importTk(x); await save(); buzz(20); toast(`${tk.length} takeoff lines imported as marks`); go('shop'); };
  $$('[data-imp]').forEach(b => b.onclick = async () => { await importTk(tk.find(t => t.l.id === b.dataset.imp)); await save(); go('shop'); });
  async function importTk(x) { const l = x.l; const base = (l.desc || 'M').replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || 'M';
    const len = RHM.parseLen(l.p.len), shape = n0(l.p.hooks) > 0 ? 'HK90' : 'STR';
    if (l.tpl === 'rebar_bars') SD.marks.push({mark:base + (SD.marks.length + 1), bar:l.p.bar, count:l.p.count, shape, legs:{A:isFinite(len) ? RHM.fmtFtIn(len) : ''}, where:l.desc, sheet:l.sheet, page:l.page});
    else x.e.rows.filter(r => !r.lap).forEach(r => { const m = r.math.match(/= (\d+);.*?x ([\d.]+) FT/); SD.marks.push({mark:base + (SD.marks.length + 1), bar:r.bar, count:m ? m[1] : '', shape:'STR', legs:{A:m ? RHM.fmtFtIn(+m[2]) : ''}, where:`${l.desc} ${r.desc}`, sheet:l.sheet, page:l.page}); });
    x.e.rows.filter(r => r.lap).forEach(r => toast('Lap splices stay on their own takeoff rows; detail lap bars as separate marks if the plans show them.')); }
  $$('.mark [data-m]').forEach(i => i.onchange = async () => { SD.marks[+i.closest('.mark').dataset.i][i.dataset.m] = i.value; await save(); go('shop'); });
  $$('.mark [data-leg]').forEach(i => i.onchange = async () => { const m = SD.marks[+i.closest('.mark').dataset.i]; (m.legs ||= {})[i.dataset.leg] = i.value; await save(); go('shop'); });
  $$('[data-rm]').forEach(b => b.onclick = async () => { const gone = SD.marks.splice(+b.dataset.rm, 1)[0]; await save(); go('shop'); toast(`Removed mark ${gone.mark}`); });
  $('#addMark').onclick = async () => { SD.marks.push({mark:'M' + (SD.marks.length + 1), bar:'', count:'', shape:'STR', legs:{}}); await save(); go('shop'); };
  $$('details [data-k]').forEach(i => i.onchange = async () => { SD[i.dataset.k] = i.value; await save(); });
  $('#addRev').onclick = async () => { const d = prompt('Revision description?', 'Revised per review comments'); if (!d) return; SD.rev.push({no:String(SD.rev.length), date:today(), desc:d, by:'JDL'}); SD.status = 'For Review'; await save(); go('shop'); };
  $('#appr').onchange = async e => { SD.status = e.target.checked ? 'Approved' : 'For Review'; await save(); go('shop'); };
  setPrimary('📄 Shop drawing PDF', async () => { const b = await shopPDF(P, res); await sharePDF(b, `ShopDwg_${safe(P.name)}_${SD.sheetNo}.pdf`, 'Shop drawings ' + P.name); }); };

// Trench safety selector (OSHA 29 CFR 1926 Subpart P + Tex. H&S Code 756). Checks only what you enter; the competent person decides in the field.
ROUTES.trench = async () => { if (needProject()) return; const o = APP.trenchIn || (APP.trenchIn = {depth:'', soil:'', width:'', boxRated:'', boxHeight:'', boxLen:'', pipeLen:'', lf:''});
  main().innerHTML = `<h2>🦺 Trench safety selector</h2><p class="hint">OSHA 1926 Subpart P. Soil type comes from the geotech report and the competent person (App. A). Box data comes from the manufacturer's tabulated data. Blank = RFI, never a guess.</p>
    ${fld('depth', 'Trench depth (grade to bottom)', o.depth, 'FT', 'number')}
    <fieldset class="seg"><legend>Soil type</legend><div class="row">${[['rock', 'Stable rock'], ['A', 'Type A'], ['B', 'Type B'], ['C', 'Type C']].map(([v, t]) => `<label class="btn chip ${o.soil === v ? 'on' : ''}"><input type="radio" name="soil" value="${v}" ${o.soil === v ? 'checked' : ''}> ${t}</label>`).join('')}</div></fieldset>
    ${fld('width', 'Trench bottom width', o.width, 'FT', 'number')}${fld('lf', 'Trench length (for the pay quantity)', o.lf, 'LF, optional', 'number')}
    <details class="card" ${o.boxRated ? 'open' : ''}><summary><b>Trench box (shield) check</b></summary>${fld('boxRated', 'Box rated depth for this soil (tabulated data)', o.boxRated, 'FT', 'number')}${fld('boxHeight', 'Box height (stacked)', o.boxHeight, 'FT', 'number')}${fld('boxLen', 'Box length', o.boxLen, 'FT', 'number')}${fld('pipeLen', 'Pipe stick length', o.pipeLen, 'FT', 'number')}</details>
    <div id="tsOut" aria-live="polite"></div><p class="muted small">Summary of OSHA rules, not a substitute for the competent person or a PE design. Over 20 ft needs a PE.</p>`;
  const out = () => { const r = RHMT.trenchSafety(o), D = +o.depth, lf = +o.lf;
    $('#tsOut').innerHTML = r.rfi.length ? `<div class="card warn"><b>RFI / need:</b> ${r.rfi.map(esc).join('; ')}</div>` : `<div class="card"><b>${r.required ? '⚠ Protective system REQUIRED' : 'Protective system not required by depth'}</b><p class="small">${esc(r.ruleTxt || '')}</p>${r.egress ? `<p class="small">🪜 ${esc(r.egress)}</p>` : ''}</div>
      ${r.checks.length ? `<div class="card"><b>Checks</b><ul class="checks">${r.checks.map(c => `<li class="${c.ok ? 'ok' : 'bad'}">${c.ok ? '✔' : '✖'} ${esc(c.t)}</li>`).join('')}</ul></div>` : ''}
      <div class="card"><b>Options</b><ul>${r.options.map(x => `<li>${x.ok === false ? '✖ ' : x.ok ? '✔ ' : ''}${esc(x.t)}</li>`).join('')}</ul>${D > 5 && lf > 0 ? `<p><b>Pay item:</b> Trench safety ${RHM.fmt(lf)} LF (depth ${D} FT &gt; 5 FT; Tex. H&S Code 756.023, TxDOT Item 402)</p>` : ''}</div>`; };
  bindFields(o, out); $$('[name=soil]').forEach(r => r.onchange = () => { o.soil = r.value; $$('.seg .chip').forEach(c => c.classList.toggle('on', c.contains(r))); out(); }); out();
  setPrimary('➕ Add trench line to takeoff', () => go('takeoff', {wizard:true, line:{id:uid(), projectId:APP.pid, trade:'Underground', tpl:'ug_trench', p:{lf:o.lf, d:o.depth, w:o.width, soil:o.soil, prot:o.boxRated ? 'box' : ''}, desc:'', sheet:'', page:'', spec:'OSHA 1926.652 / Tex. H&S 756', schedQty:'', created:Date.now()}})); };
