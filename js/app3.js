/* Right Hand Man - Pay App, Daily Log, Change Orders/Quotes, Cost Data, Standards */
'use strict';
/* ---------- PAY APP ---------- */
async function payApps() { return (await DB.where('payapps', a => a.projectId === APP.pid)).sort((a, b) => a.no - b.no); }
function calcApp(A) { const C = APP.client || {}; return RHM.payApp({sov:APP.project.sov.map(s => ({...s, sched:sovSched(s)})), prev:A.prev, cur:A.cur, prevCert:A.prevCert, retainPct:C.retainPct, retainStoredPct:C.retainStoredPct, taxPct:C.taxPct}); }
ROUTES.payapp = async (arg) => { if (needProject()) return; const apps = await payApps();
  if (arg && arg.id) return payWizard(apps.find(a => a.id === arg.id), arg.step || 1);
  main().innerHTML = `<h2>Pay Applications</h2><p class="hint">${esc(APP.client ? APP.client.name : '')} · ${APP.client ? (APP.client.payFormat === 'G702' ? 'G702/G703 style' : 'simple invoice') : ''} · retainage ${APP.client ? APP.client.retainPct : 0}% · tax ${APP.client ? APP.client.taxPct : 0}%</p>
  <div class="list">${apps.map(a => { const c = calcApp(a); return `<div class="li" ${a.status !== 'submitted' ? `data-swipe="payapps:${a.id}:Pay App #${a.no}"` : ''}><button class="grow" data-open="${a.id}"><b>Pay App #${a.no}</b> <span class="tag ${a.status === 'submitted' ? 'ok' : ''}">${a.status}</span><small>Period to ${esc(a.periodTo)} · due ${M(c.g702.l8)}</small></button></div>`; }).join('') || emptyState('💵', 'No pay apps yet', 'Start one below. Billing period defaults to today; you can change it on step 1.')}</div>
  ${apps.length ? `<button class="btn" id="dupPA">⧉ Start #${apps.length + 1} with the same amounts as #${apps[apps.length - 1].no}</button><p class="muted small swipehint">Tip: swipe a draft left to delete it (you can undo).</p>` : ''}`;
  if ($('#dupPA')) $('#dupPA').onclick = () => startPayApp(true);
  setPrimary(`➕ Start Pay App #${apps.length + 1}`, () => startPayApp(false));
  $$('[data-open]').forEach(b => b.onclick = () => go('payapp', {id:b.dataset.open})); };
async function startPayApp(dup) { if (needProject()) return; const apps = await payApps(), last = apps[apps.length - 1]; let prev = {}, prevCert = 0;
  if (last) { if (last.status !== 'submitted' && !confirm(`Pay App #${last.no} is still a draft. Start the next one from its numbers anyway?`)) return; ({prev, prevCert} = RHM.rollForward(calcApp(last))); }
  const A = {id:uid(), projectId:APP.pid, no:apps.length + 1, periodTo:today(), date:today(), prev, prevCert, cur:dup && last ? structuredClone(last.cur) : {}, attach:{sheets:[], photos:[]}, checks:{}, status:'draft', created:Date.now(), dupOf:dup && last ? last.no : undefined};
  await DB.put('payapps', A); buzz(15); if (dup && last) toast(`Copied this-period amounts from #${last.no}. Check every line before sending.`, 4000); go('payapp', {id:A.id, step:2}); }
async function payWizard(A, step) { const save = () => DB.put('payapps', A), sov = APP.project.sov, N = 5, locked = A.status === 'submitted';
  const steps = ['Billing period', 'Work done this period', 'Materials stored on site', 'Backup: photos & marked sheets', 'Quality check & send'];
  const head = () => `${wizHead(step, N, steps[step - 1])}<div class="seg steps">${steps.map((s, i) => `<button data-st="${i + 1}" class="${step === i + 1 ? 'on' : ''}">${i + 1}</button>`).join('')}</div>${locked ? '<div class="note">This pay app was submitted. It is read-only; start the next one from the list.</div>' : ''}`;
  const nav = () => $$('[data-st]').forEach(b => b.onclick = () => payWizard(A, +b.dataset.st));
  const c = calcApp(A);
  if (step === 1) { main().innerHTML = `${head()}${fld('no', 'Application number', A.no, '', 'number')}${fld('periodTo', 'Period to', A.periodTo, '', 'date')}${fld('date', 'Application date', A.date, '', 'date')}
    <div class="card"><b>From previous applications</b><br>Previous certificates for payment: <b>${M(A.prevCert)}</b><br>Work in place billed before: <b>${M(Object.values(A.prev || {}).reduce((s, p) => s + (p.work || 0), 0))}</b></div>`;
    bindFields(A, save); nav(); setPrimary('Next: work this period →', () => payWizard(A, 2)); }
  else if (step === 2) { const pg = await progressBySov(APP.pid), logs = await DB.where('logs', l => l.projectId === APP.pid && l.date <= A.periodTo), logQty = {};
    logs.forEach(l => (l.qty || []).forEach(q => { logQty[q.sovId] = (logQty[q.sovId] || 0) + n0(q.qty); }));
    main().innerHTML = `${head()}${A.dupOf ? `<div class="note">Amounts were copied from Pay App #${A.dupOf}. Check every line.</div>` : ''}<p class="hint">For each pay item, type the <b>% complete to date</b> (the app works out this period's $), or type this period's $ directly.</p>
    <div class="row"><button class="btn" id="fromMk">✅ Use % from plan markups</button><button class="btn" id="fromLog">📋 Use daily-log quantities</button><button class="btn" id="skipRev">⏭ Skip to review & send</button></div>
    ${c.lines.map(l => { const s = sov.find(x => x.id === l.id), cur = A.cur[l.id] || {}, pctTo = l.C ? (l.D + l.E) / l.C * 100 : 0, p = pg[l.id];
      return `<div class="card pl ${l.over ? 'bad' : ''}" data-id="${l.id}"><div class="row"><b class="grow">${esc(l.item)}. ${esc(l.desc)}</b><span>${M(l.C)}</span></div>
      <small>Before: ${M(l.D)} (${RHM.fmt(l.C ? l.D / l.C * 100 : 0, 1)}%)${p && p.pct !== null ? ` · markups say ${RHM.fmt(p.pct, 1)}%` : ''}${logQty[l.id] ? ` · daily logs ${RHM.fmt(logQty[l.id])} ${esc(s.unit)} of ${RHM.fmt(n0(s.qty))}` : ''}</small>
      <div class="grid2"><label class="fld"><span>% complete to date</span><input data-pct type="number" inputmode="decimal" step="any" value="${RHM.r2(pctTo) || ''}" ${locked ? 'disabled' : ''}></label><label class="fld"><span>This period $</span><input data-work type="number" inputmode="decimal" step="any" value="${cur.work || ''}" ${locked ? 'disabled' : ''}></label></div>
      ${l.over ? '<div class="rfi">Billed more than the scheduled value. Fix this or add a change order.</div>' : ''}</div>`; }).join('')}
    <div class="card sum">This period: <b>${M(c.totals.E)}</b> · Completed to date: <b>${M(c.totals.D + c.totals.E)}</b></div>${allowReconHTML(A, c)}`; bindAllow(A, () => payWizard(A, 2));
    const set = (id, work) => { (A.cur[id] ||= {}).work = RHM.r2(work); };
    $$('.pl').forEach(el => { const id = el.dataset.id, l = c.lines.find(x => x.id === id);
      el.querySelector('[data-pct]').onchange = async e => { set(id, n0(e.target.value) / 100 * l.C - l.D); await save(); payWizard(A, 2); };
      el.querySelector('[data-work]').onchange = async e => { set(id, n0(e.target.value)); await save(); payWizard(A, 2); }; });
    $('#fromMk').onclick = async () => { let k = 0; c.lines.forEach(l => { const p = pg[l.id]; if (p && p.pct !== null) { set(l.id, p.pct / 100 * l.C - l.D); k++; } }); await save(); toast(k ? `${k} line(s) filled from markups` : 'No linked markups yet (Plans → ✅ % Done)'); payWizard(A, 2); };
    $('#fromLog').onclick = async () => { let k = 0; c.lines.forEach(l => { const s = sov.find(x => x.id === l.id); if (logQty[l.id] && n0(s.qty)) { set(l.id, Math.min(1, logQty[l.id] / n0(s.qty)) * l.C - l.D); k++; } }); await save(); toast(k ? `${k} line(s) filled from daily logs` : 'No daily-log quantities for SOV lines with a quantity'); payWizard(A, 2); };
    $('#skipRev').onclick = () => payWizard(A, 5); nav(); setPrimary('Next: stored materials →', () => payWizard(A, 3)); }
  else if (step === 3) { main().innerHTML = `${head()}<p class="hint">Materials delivered and stored but <b>not yet installed</b>. Type the current stored balance per item (invoices/insurance usually required).</p>
    ${c.lines.map(l => `<div class="card pl" data-id="${l.id}"><b>${esc(l.item)}. ${esc(l.desc)}</b><label class="fld"><span>Stored now $</span><input data-st2 type="number" inputmode="decimal" step="any" value="${(A.cur[l.id] || {}).stored || ''}" ${locked ? 'disabled' : ''}></label></div>`).join('')}
    <div class="card sum">Stored: <b>${M(c.totals.F)}</b> · Retainage on stored ${APP.client.retainStoredPct}%</div>`;
    $$('[data-st2]').forEach(i => i.onchange = async () => { (A.cur[i.closest('.pl').dataset.id] ||= {}).stored = n0(i.value); await save(); payWizard(A, 3); });
    nav(); setPrimary('Next: backup →', () => payWizard(A, 4)); }
  else if (step === 4) { const sheets = (await loadSheets()).filter(s => s.marks.length || s.meas.length), photos = await DB.where('photos', p => p.projectId === APP.pid && (!p.payId || p.payId === A.id));
    main().innerHTML = `${head()}<h3>Marked sheets</h3><div class="list">${sheets.map(s => `<label class="li pick"><input type="checkbox" data-sh="${s.id}" ${A.attach.sheets.includes(s.id) ? 'checked' : ''}><img src="${s.thumb}" class="th" alt=""><div class="grow">${esc(s.sheetNo || s.name)}<small>${s.marks.length} marks · ${s.meas.length} measurements</small></div></label>`).join('') || '<p class="muted">No marked sheets yet.</p>'}</div>
    <h3>Photos</h3><div class="photos">${photos.map(p => `<label class="ph"><input type="checkbox" data-ph="${p.id}" ${A.attach.photos.includes(p.id) ? 'checked' : ''}><img src="${p.thumb}" alt=""><small>${esc(p.caption || p.date || '')}</small></label>`).join('')}</div>
    <label class="btn">📷 Add backup photos<input type="file" id="addPh" accept="image/*" multiple hidden></label>`;
    $$('[data-sh]').forEach(i => i.onchange = async () => { A.attach.sheets = $$('[data-sh]').filter(x => x.checked).map(x => x.dataset.sh); await save(); });
    $$('[data-ph]').forEach(i => i.onchange = async () => { A.attach.photos = $$('[data-ph]').filter(x => x.checked).map(x => x.dataset.ph); await save(); });
    $('#addPh').onchange = async e => { for (const f of e.target.files) { const p = await savePhoto(f, {payId:A.id, caption:prompt('Caption for ' + f.name + '?', '') || f.name}); A.attach.photos.push(p.id); } await save(); payWizard(A, 4); };
    nav(); setPrimary('Next: quality check →', () => payWizard(A, 5)); }
  else { const res = payChecks(A, c); const allOk = res.every(r => r.ok);
    main().innerHTML = `${head()}<div class="g702 card"><h3>Summary (G702 style)</h3>${g702Rows(c).map(([k, v, b]) => `<div class="row ${b ? 'b' : ''}"><span class="grow">${k}</span><span>${M(v)}</span></div>`).join('')}</div>
    ${allowReconHTML(A, c)}<h3>Before you send</h3><div class="list">${res.map(r => `<label class="li pick ${r.ok ? 'okC' : 'badC'}">${r.auto ? `<span class="ck">${r.ok ? '✅' : '❌'}</span>` : `<input type="checkbox" data-ck="${esc(r.k)}" ${r.ok ? 'checked' : ''} ${locked ? 'disabled' : ''}>`}<div class="grow">${esc(r.t)}${r.why ? `<small>${esc(r.why)}</small>` : ''}</div></label>`).join('')}</div>
    <div class="row"><button class="btn" id="pdfPrev">👁 Preview PDF</button>${allOk ? `<a class="btn" id="mail" href="#">✉ Email (opens your mail app)</a>` : ''}</div>`;
    bindAllow(A, () => payWizard(A, 5)); $$('[data-ck]').forEach(i => i.onchange = async () => { A.checks[i.dataset.ck] = i.checked; await save(); payWizard(A, 5); });
    const mk = async () => payPDF(A, c);
    $('#pdfPrev').onclick = async () => { const b = await mk(); window.open(URL.createObjectURL(b), '_blank') || download(`PayApp${A.no}.pdf`, b); };
    if (allOk) { const subj = `Pay Application #${A.no} - ${APP.project.name} - period to ${A.periodTo}`, body = `Hello${APP.client.contact ? ' ' + APP.client.contact : ''},\n\nAttached is Pay Application #${A.no} for ${APP.project.name}${APP.project.no ? ' (' + APP.project.no + ')' : ''}, period to ${A.periodTo}.\n\nCurrent payment due: ${M(c.g702.l8)}\nCompleted & stored to date: ${M(c.g702.l4)}\nRetainage held: ${M(c.g702.l5)}\n\nThe PDF with the continuation sheet and backup will be attached (use Share PDF if it did not attach).\n\nThank you,\n${CO_INFO.person}\n${CO_INFO.name}\n${CO_INFO.direct} direct · ${CO_INFO.main} main\n${CO_INFO.email}`;
      $('#mail').href = mailto(APP.client.email, subj, body); $('#mail').onclick = async () => { const b = await mk(); download(`PayApp${A.no}_${safe(APP.project.name)}.pdf`, b); A.status = 'submitted'; A.sentAt = Date.now(); await save(); };
      setPrimary('📤 Share PDF & mark submitted', async () => { const b = await mk(); const r = await sharePDF(b, `PayApp${A.no}_${safe(APP.project.name)}.pdf`, subj); if (r !== 'cancel') { A.status = 'submitted'; A.sentAt = Date.now(); await save(); toast('Marked as submitted'); payWizard(A, 5); } }); }
    else setPrimary(`Fix ${res.filter(r => !r.ok).length} item(s) before sending`, () => { const el = $('.badC'); el && el.scrollIntoView({block:'center'}); });
    nav(); }
}
function g702Rows(c) { const g = c.g702; return [['1. Original contract sum', g.l1], ['2. Net change by change orders', g.l2], ['3. Contract sum to date', g.l3, 1], ['4. Total completed & stored to date' + (g.tax ? ' (incl. tax)' : ''), g.l4], ['5a. Retainage on completed work', g.l5a], ['5b. Retainage on stored material', g.l5b], ['5. Total retainage', g.l5], ['6. Total earned less retainage', g.l6], ['7. Less previous certificates for payment', g.l7], ['8. CURRENT PAYMENT DUE', g.l8, 1], ['9. Balance to finish, including retainage', g.l9]]; }
function payChecks(A, c) { const C = APP.client, man = k => !!A.checks[k], extra = String(C.checklist || '').split('\n').map(s => s.trim()).filter(Boolean);
  const auto = [
    {k:'a1', t:'No line billed over its scheduled value', ok:!c.lines.some(l => l.over), why:c.lines.filter(l => l.over).map(l => l.item).join(', ')},
    {k:'a2', t:'Something is billed this period', ok:c.totals.E + c.totals.F > 0},
    {k:'a3', t:'Retainage matches the client setup (' + C.retainPct + '% work / ' + C.retainStoredPct + '% stored)', ok:Math.abs(c.g702.l5a - (c.totals.D + c.totals.E) * C.retainPct / 100) < 0.02},
    {k:'a4', t:'Math ties: line 6 - line 7 = line 8, G703 totals = G702', ok:Math.abs(c.g702.l6 - c.g702.l7 - c.g702.l8) < 0.01 && Math.abs(c.totals.G + c.g702.tax - c.g702.l4) < 0.01},
    {k:'a5', t:'Period end date is set and not in the future', ok:!!A.periodTo && A.periodTo <= today()},
    {k:'a6', t:'Backup attached (at least one photo or marked sheet)', ok:A.attach.sheets.length + A.attach.photos.length > 0},
    {k:'a7', t:'Client email on file for sending', ok:!!C.email, why:C.email ? '' : 'Projects → client → Pay app email'},
    {k:'a8', t:'Stored materials have backup', ok:c.totals.F === 0 || man('storedDocs'), why:'Check "Stored material invoices" below'}].map(x => ({...x, auto:true}));
  const manual = [['storedDocs', 'Stored material invoices / insurance attached (if any stored)'], ['waiver', 'Lien waiver (conditional) prepared'], ['payroll', 'Certified payroll attached if Davis-Bacon/prevailing wage applies'], ['cos', 'Only APPROVED change orders are in the SOV'], ['review', 'I reviewed quantities against the field log']].concat(extra.map((t, i) => ['x' + i, t]));
  return auto.concat(manual.map(([k, t]) => ({k, t, ok:man(k)}))); }
/* v1.9.1: every field photo (punch, daily, receiving, safety, pay-app backup, photo log) goes through the same
   stamp path: project + America/Chicago time + GPS-or-"GPS denied"/"no GPS" burned into the JPEG before IndexedDB.
   Pass {stamp:false} only for a non-field image (none today). GPS is optional and never invented. */
async function savePhoto(file, o) { o = Object.assign({}, o || {}); if (o.stamp === false) { delete o.stamp; return savePhotoRaw(file, o); } delete o.stamp; return saveStampedPhoto(file, o); }
async function savePhotoRaw(file, o) { const c = await decodeImage(file, 1600), k = Math.min(1, 1600 / Math.max(c.width, c.height)), o2 = mkCanvas(Math.round(c.width * k), Math.round(c.height * k)); o2.getContext('2d').drawImage(c, 0, 0, o2.width, o2.height);
  const t = mkCanvas(Math.max(1, Math.round(o2.width * 0.12)), Math.max(1, Math.round(o2.height * 0.12))); t.getContext('2d').drawImage(o2, 0, 0, t.width, t.height);
  const p = Object.assign({id:uid(), projectId:APP.pid, blob:await canvasBlob(o2, 'image/jpeg', 0.82), w:o2.width, h:o2.height, thumb:t.toDataURL('image/jpeg', 0.6), date:today(), created:Date.now()}, o); await DB.put('photos', p); return p; }

async function getGeoOptional() {
  if (!navigator.geolocation) return {ok:false, reason:'unavailable'};
  return new Promise(res => {
    navigator.geolocation.getCurrentPosition(
      p => res({ok:true, lat:p.coords.latitude, lon:p.coords.longitude, acc:p.coords.accuracy}),
      e => res({ok:false, reason:e && e.code === 1 ? 'denied' : 'unavailable'}),
      {enableHighAccuracy:true, timeout:8000, maximumAge:60000});
  });
}
function burnPhotoStamp(canvas, lines) {
  const g = canvas.getContext('2d'), barH = Math.max(48, Math.round(canvas.height * 0.11));
  g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(0, canvas.height - barH, canvas.width, barH);
  g.fillStyle = '#fff'; g.textBaseline = 'top';
  const fs = Math.max(12, Math.min(22, Math.round(barH / (lines.length + 1.2))));
  g.font = `600 ${fs}px system-ui,sans-serif`;
  let y = canvas.height - barH + Math.round(fs * 0.35);
  lines.forEach(ln => { g.fillText(ln, 10, y, canvas.width - 20); y += fs + 2; });
}
async function saveStampedPhoto(file, o) {
  o = o || {};
  const geo = await getGeoOptional();
  const c = await decodeImage(file, 1600), k = Math.min(1, 1600 / Math.max(c.width, c.height));
  const o2 = mkCanvas(Math.round(c.width * k), Math.round(c.height * k));
  o2.getContext('2d').drawImage(c, 0, 0, o2.width, o2.height);
  const now = new Date();
  const ct = now.toLocaleString('en-US', {timeZone:'America/Chicago', dateStyle:'short', timeStyle:'medium'}) + ' CT';
  const proj = (APP.project && APP.project.name) || 'No project';
  const gpsLine = geo.ok ? `${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}` : (geo.reason === 'denied' ? 'GPS denied' : 'no GPS');
  const lines = [proj, ct, gpsLine].concat(o.caption ? [o.caption] : []);
  burnPhotoStamp(o2, lines);
  const stampText = lines.join(' · ');
  const th = mkCanvas(Math.max(1, Math.round(o2.width * 0.12)), Math.max(1, Math.round(o2.height * 0.12))); th.getContext('2d').drawImage(o2, 0, 0, th.width, th.height);
  const p = Object.assign({
    id:uid(), projectId:APP.pid, blob:await canvasBlob(o2, 'image/jpeg', 0.82), w:o2.width, h:o2.height,
    thumb:th.toDataURL('image/jpeg', 0.6), date:today(), created:Date.now(),
    stampedAt:now.toISOString(), stampText, caption:o.caption || '',
    lat:geo.ok ? geo.lat : null, lon:geo.ok ? geo.lon : null, acc:geo.ok ? geo.acc : null, gpsOk:!!geo.ok, gpsNote:geo.ok ? '' : gpsLine, sheet:o.sheet || ''
  }, o);
  await DB.put('photos', p); return p;
}


/* ---------- DAILY LOG ---------- */
ROUTES.daily = async (arg) => { if (needProject()) return; const logs = (await DB.where('logs', l => l.projectId === APP.pid)).sort((a, b) => b.date.localeCompare(a.date));
  if (arg && arg.id) return dailyForm(logs.find(l => l.id === arg.id) || arg.log);
  main().innerHTML = `<h2>Daily Logs</h2><div class="list">${logs.map(l => { const t = RHM.logTotals(l); return `<div class="li" data-swipe="logs:${l.id}:Log ${esc(l.date)}"><button class="grow" data-open="${l.id}"><b>${esc(l.date)}</b><small>${(l.crew || []).length} crew rows · ${t.hrs} man-hrs · ${esc(l.weather && l.weather.cond || '')}</small></button></div>`; }).join('') || emptyState('📋', 'No daily logs yet', "Tap the button below to start today's log. Crew carries over from the last log.")}</div>${logs.length ? '<p class="muted small swipehint">Tip: swipe a log left to delete it (you can undo).</p>' : ''}`;
  $$('[data-open]').forEach(b => b.onclick = () => go('daily', {id:b.dataset.open}));
  setPrimary(logs.some(l => l.date === today()) ? "📋 Open today's log" : "➕ Today's log", openToday); };
async function openToday() { if (needProject()) return; const logs = (await DB.where('logs', l => l.projectId === APP.pid)).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created), t = logs.find(l => l.date === today());
  if (t) return go('daily', {id:t.id}); const prev = logs[0];
  const L = {id:uid(), projectId:APP.pid, date:today(), foreman:SET.foreman, weather:{}, crew:prev ? structuredClone(prev.crew) : [{name:'Rebar crew', trade:'Ironworker', n:4, hrs:8}], qty:prev ? (prev.qty || []).filter(q => APP.project.sov.some(s => s.id === q.sovId)).map(q => ({sovId:q.sovId, qty:''})) : [], notes:'', delays:'', photos:[], created:Date.now()};
  await DB.put('logs', L); buzz(15); if (L.qty.length) toast(`Same pay items as ${prev.date} - type today's quantities`, 3000); go('daily', {id:L.id}); }
async function dailyForm(L) { const sov = APP.project.sov, pg = await progressBySov(APP.pid), save = () => DB.put('logs', L), t = RHM.logTotals(L, Object.fromEntries(sov.map(s => [s.id, (pg[s.id] && pg[s.id].plan) || n0(s.qty)])));
  const photos = await DB.where('photos', p => (L.photos || []).includes(p.id)), allLogs = await DB.where('logs', x => x.projectId === APP.pid && x.date <= L.date), toDate = {};
  allLogs.forEach(x => (x.qty || []).forEach(q => toDate[q.sovId] = (toDate[q.sovId] || 0) + n0(q.qty)));
  main().innerHTML = `<h2>Daily Log</h2><div class="grid2">${fld('date', 'Date', L.date, '', 'date')}${fld('foreman', 'Foreman', L.foreman)}</div>
  <div class="card"><b>Weather</b> <button class="btn sm" id="wx">🌤 Fill from my location</button><div class="grid4">${['cond','hi','lo','precip','wind'].map(k => `<label class="fld"><span>${({cond:'Conditions', hi:'High °F', lo:'Low °F', precip:'Rain (in)', wind:'Wind (mph)'})[k]}</span><input data-w="${k}" value="${esc((L.weather || {})[k] ?? '')}"></label>`).join('')}</div></div>
  <div class="card"><b>Crew</b>${(L.crew || []).map((c, i) => `<div class="grid4 crew" data-i="${i}"><input data-c="name" value="${esc(c.name)}" placeholder="Crew/person"><input data-c="trade" value="${esc(c.trade)}" placeholder="Trade"><input data-c="n" type="number" inputmode="numeric" value="${c.n ?? 1}" aria-label="Count"><input data-c="hrs" type="number" inputmode="decimal" value="${c.hrs ?? 8}" aria-label="Hours each"><button class="x" data-rmc="${i}" aria-label="Remove">✕</button></div>`).join('')}<button class="btn sm" id="addC">➕ Crew row</button><p>Total: <b>${t.hrs} man-hours</b></p></div>
  <div class="card"><b>Installed today vs. plan</b>${(L.qty || []).map((q, i) => { const s = sov.find(x => x.id === q.sovId) || {}, tq = t.qty[i]; return `<div class="grid4 qrow" data-i="${i}"><select data-q="sovId">${sov.map(x => `<option value="${x.id}" ${x.id === q.sovId ? 'selected' : ''}>${esc(x.item)} ${esc(x.desc)}</option>`).join('')}</select><input data-q="qty" type="number" inputmode="decimal" value="${q.qty ?? ''}" placeholder="qty today"><span>${esc(s.unit || '')} · to date ${RHM.fmt(toDate[q.sovId] || 0)} of ${RHM.fmt(tq.plan)}${tq.plan ? ` (${RHM.fmt((toDate[q.sovId] || 0) / tq.plan * 100, 1)}%)` : ''}${tq.rate ? ` · ${RHM.fmt(tq.rate)} ${esc(s.unit || '')}/man-hr` : ''}</span><button class="x" data-rmq="${i}">✕</button></div>`; }).join('')}<button class="btn sm" id="addQ">➕ Quantity</button></div>
  ${ptype(APP.project).daily.length ? `<div class="card typef"><b>${ptype(APP.project).icon} ${ptype(APP.project).name}</b><div class="grid2">${ptype(APP.project).daily.map(([k, l, ty]) => ty === 'yn' ? `<label class="fld"><span>${l}</span><select data-tf="${k}"><option value=""></option>${['Yes', 'No', 'N/A'].map(v => `<option ${(L.typeFields || {})[k] === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : `<label class="fld"><span>${l}</span><input data-tf="${k}" ${ty === 'num' ? 'inputmode="decimal"' : ''} value="${esc((L.typeFields || {})[k] ?? '')}"></label>`).join('')}</div></div>` : ''}
  <label class="fld"><span>Work performed / notes</span><textarea data-k="notes" data-voice rows="3">${esc(L.notes)}</textarea></label><label class="fld"><span>Delays, extra work, visitors, safety</span><textarea data-k="delays" data-voice rows="2">${esc(L.delays)}</textarea></label>
  <div class="photos">${photos.map(p => `<div class="ph"><img src="${p.thumb}" alt=""><small>${esc(p.caption || '')}</small></div>`).join('')}</div><div class="row"><label class="btn p">📷 Take a photo<input type="file" id="camP" accept="image/*" capture="environment" hidden></label><label class="btn">🖼 Add from gallery<input type="file" id="addP" accept="image/*" multiple hidden></label></div>
  <div class="row"><button class="btn" id="pdf">📄 Daily log PDF</button><button class="btn danger" id="del">Delete log</button></div>`;
  const re = async () => { await save(); if (APP.route === 'daily') dailyForm(L); };
  bindFields(L, save); $$('[data-tf]').forEach(i => i.onchange = async () => { (L.typeFields ||= {})[i.dataset.tf] = i.value; await save(); }); $$('[data-w]').forEach(i => i.onchange = async () => { (L.weather ||= {})[i.dataset.w] = i.value; await save(); });
  $$('.crew [data-c]').forEach(i => i.onchange = async () => { L.crew[+i.closest('.crew').dataset.i][i.dataset.c] = i.type === 'number' ? n0(i.value) : i.value; re(); });
  $$('[data-rmc]').forEach(b => b.onclick = () => { L.crew.splice(+b.dataset.rmc, 1); re(); }); $('#addC').onclick = () => { L.crew.push({name:'', trade:'', n:1, hrs:8}); re(); };
  $$('.qrow [data-q]').forEach(i => i.onchange = () => { L.qty[+i.closest('.qrow').dataset.i][i.dataset.q] = i.dataset.q === 'qty' ? n0(i.value) : i.value; re(); });
  $$('[data-rmq]').forEach(b => b.onclick = () => { L.qty.splice(+b.dataset.rmq, 1); re(); }); $('#addQ').onclick = () => { if (!sov.length) return toast('Add SOV lines to the project first'); L.qty.push({sovId:sov[0].id, qty:''}); re(); };
  $('#camP').onchange = e => $('#addP').onchange(e);
  $('#addP').onchange = async e => { for (const f of e.target.files) { const p = await savePhoto(f, {logId:L.id, date:L.date, caption:f.name.replace(/\.[^.]+$/, '')}); (L.photos ||= []).push(p.id); } re(); };
  $('#wx').onclick = () => { if (!navigator.onLine) return toast('Offline - type the weather'); navigator.geolocation.getCurrentPosition(async pos => { try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude.toFixed(3)}&longitude=${pos.coords.longitude.toFixed(3)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&start_date=${L.date}&end_date=${L.date}`;
      const d = (await (await fetch(u)).json()).daily; const code = d.weather_code[0]; L.weather = {cond:code < 3 ? 'Clear/partly cloudy' : code < 50 ? 'Cloudy/fog' : code < 70 ? 'Rain' : code < 80 ? 'Snow/ice' : 'Showers/storms', hi:Math.round(d.temperature_2m_max[0]), lo:Math.round(d.temperature_2m_min[0]), precip:d.precipitation_sum[0], wind:Math.round(d.wind_speed_10m_max[0]), src:'Open-Meteo'}; re(); } catch (e) { toast('Weather lookup failed - type it in'); } }, () => toast('Location not allowed - type the weather')); };
  $('#pdf').onclick = async () => { const b = await dailyPDF(L, t, photos, toDate); await sharePDF(b, `DailyLog_${L.date}_${safe(APP.project.name)}.pdf`, 'Daily log ' + L.date); };
  $('#del').onclick = async () => { if (!confirm('Delete this log?')) return; await DB.del('logs', L.id); APP.undo.push(['logs', L]); go('daily'); toastUndo('Log deleted'); };
  setPrimary('✔ Save log', async () => { await save(); toast('Saved ✔'); go('daily'); }); }

/* ---------- CHANGE ORDERS / QUOTES / T&M ---------- */
ROUTES.co = async (arg) => { if (needProject()) return; const cos = (await DB.where('cos', c => c.projectId === APP.pid)).sort((a, b) => a.created - b.created);
  if (arg && arg.id) return coForm(cos.find(c => c.id === arg.id));
  if (arg && arg.fromTakeoff) return newCO('rebar', true);
  main().innerHTML = `<h2>Change Orders, Quotes & T&M</h2><div class="list">${cos.map(c => `<div class="li" data-swipe="cos:${c.id}:${esc(c.no)}"><button class="grow" data-open="${c.id}"><b>${esc(c.no)} ${esc(c.title)}</b> <span class="tag ${c.status === 'approved' ? 'ok' : ''}">${c.status}</span><small>${({rebar:'Rebar quote', co:'Change order', tm:'T&M ticket'})[c.type]} · ${M(coTotals(c).total)}</small></button></div>`).join('') || emptyState('📝', 'No quotes or change orders yet', 'Pick one to start. Lines come from your takeoff; prices come from your rates or Cost Data.')}</div>${cos.length ? '<p class="muted small swipehint">Tip: swipe one left to delete it (you can undo).</p>' : ''}
  <div class="tiles small"><button class="tile" data-new="rebar"><b>🔩 Rebar quote</b><small>Material / Trucking / Shop Drawings</small></button><button class="tile" data-new="co"><b>📝 Change order</b><small>From takeoff + rates</small></button><button class="tile" data-new="tm"><b>⏱ T&M ticket</b><small>Labor + burden, materials, equipment</small></button></div>`;
  $$('[data-open]').forEach(b => b.onclick = () => go('co', {id:b.dataset.open})); $$('[data-new]').forEach(b => b.onclick = () => newCO(b.dataset.new)); setPrimary(null); };
async function newCO(type, fromTk) { APP.project.coNo = (APP.project.coNo || 0) + 1; await saveProject(); const pre = {rebar:'Q', co:'CO', tm:'TM'}[type];
  const C = {id:uid(), projectId:APP.pid, type, no:`${pre}-${String(APP.project.coNo).padStart(3, '0')}`, title:'', date:today(), status:'draft', to:APP.client ? APP.client.email : '', attn:APP.client ? APP.client.contact : '', reason:'', standard:'', lines:[], tm:{labor:[], mat:[], eq:[], markupPct:0}, notes:type === 'rebar' ? 'Concrete by others.' : '', created:Date.now()};
  if (fromTk || type !== 'tm') { const tk = await DB.where('takeoff', t => t.projectId === APP.pid); const rows = tk.flatMap(l => RHM.evalLine(l).rows.map(r => ({l, r})));
    if (type === 'rebar') C.lines = rows.filter(x => x.r.unit === 'LB').map(x => ({desc:`${x.l.desc || ''} ${x.r.desc}`.trim(), lb:x.r.qty, cls:x.r.cls || (x.l.p.cls === 'straight' ? 'straight' : 'fab'), coat:x.r.coat || 'black', cite:`Sheet ${x.l.sheet || '—'} p.${x.l.page || '—'}`}));
    else C.lines = rows.map(x => ({desc:`${x.l.desc || ''} ${x.r.desc}`.trim(), qty:x.r.qty, unit:x.r.unit, price:'', cite:`Sheet ${x.l.sheet || '—'} p.${x.l.page || '—'} · ${x.l.spec || ''}`})); }
  if (type === 'tm') C.tm.labor = [{who:'Ironworker foreman', hrs:8, ot:0, rate:''}, {who:'Ironworker', hrs:8, ot:0, rate:''}];
  await DB.put('cos', C); go('co', {id:C.id}); }
function coTotals(c) { if (c.type === 'rebar') return RHM.rebarQuote(c.lines, SET.rates); if (c.type === 'tm') return RHM.tmTicket(c.tm, SET.burdenPct);
  const rows = c.lines.map(l => ({...l, amt:RHM.r2(n0(l.qty) * n0(l.price))})); return {rows, total:RHM.r2(rows.reduce((s, r) => s + r.amt, 0))}; }
async function coForm(C) { if (C.type === 'co' && !C.est && typeof blankEst === 'function') C.est = blankEst(); const save = () => DB.put('cos', C), T = coTotals(C), re = async () => { await save(); coForm(C); };
  let body = '';
  if (C.type === 'rebar') body = `<div class="card"><b>Rebar lines</b>${C.lines.map((l, i) => `<div class="grid4 ln" data-i="${i}"><input data-l="desc" value="${esc(l.desc)}" placeholder="Description"><input data-l="lb" type="number" inputmode="decimal" value="${l.lb ?? ''}" placeholder="LB"><select data-l="cls"><option value="fab" ${l.cls !== 'straight' ? 'selected' : ''}>Fabricated</option><option value="straight" ${l.cls === 'straight' ? 'selected' : ''}>Straight</option></select><select data-l="coat"><option value="black">Black</option><option value="epoxy" ${l.coat === 'epoxy' ? 'selected' : ''}>Epoxy</option></select><button class="x" data-rm="${i}">✕</button></div>`).join('')}<button class="btn sm" id="addL">➕ Line</button></div>
    <table class="t money"><tr><th>Material</th><th>Trucking</th><th>Shop Drawings</th><th>Total</th></tr><tr><td>${M(T.material)}</td><td>${M(T.trucking)}</td><td>${M(T.shop)}</td><td><b>${M(T.total)}</b></td></tr></table>
    ${T.skipped.length ? `<p class="warn" id="qskip">⚠ ${T.skipped.map(esc).join('<br>')}<br>Use a separate credit change order for deducts.</p>` : ''}<p class="small"><code>${RHM.fmt(T.totLb)} LB = ${T.tons} T · ${esc(T.math.trucking)} · ${esc(T.math.shop)}</code></p>`;
  else if (C.type === 'co') body = `<div class="card"><b>Lines</b> <button class="btn sm" id="pickCost">💲 From cost data</button>${C.lines.map((l, i) => `<div class="grid4 ln" data-i="${i}"><input data-l="desc" value="${esc(l.desc)}"><input data-l="qty" type="number" inputmode="decimal" value="${l.qty ?? ''}" placeholder="Qty"><input data-l="unit" value="${esc(l.unit || '')}" placeholder="Unit"><input data-l="price" type="number" inputmode="decimal" value="${l.price ?? ''}" placeholder="$/unit"><span>${M(n0(l.qty) * n0(l.price))}</span><button class="x" data-rm="${i}">✕</button></div>${l.cite ? `<small class="cite">${esc(l.cite)}</small>` : ''}`).join('')}<button class="btn sm" id="addL">➕ Line</button></div><div class="card sum">${T.est ? 'Material' : 'Total'} <b>${M(T.est ? T.matTotal : T.total)}</b>${C.lines.some(l => !RHM.has(l.price)) ? ' <span class="warn">some lines have no price</span>' : ''}</div>`;
  if (C.type === 'co' && T.est) body += estEditorHTML(C, T); if (C.type === 'rebar' && typeof rebarExtrasHTML === 'function') body += rebarExtrasHTML(C, T);
  if (C.type === 'tm') body = `<div class="card"><b>Labor</b> <small>(base rate × (1 + ${SET.burdenPct}% burden); OT at 1.5×)</small>${C.tm.labor.map((l, i) => `<div class="grid4 tl" data-g="labor" data-i="${i}"><input data-l="who" value="${esc(l.who)}"><input data-l="hrs" type="number" inputmode="decimal" value="${l.hrs ?? ''}" placeholder="ST hrs"><input data-l="ot" type="number" inputmode="decimal" value="${l.ot ?? ''}" placeholder="OT hrs"><input data-l="rate" type="number" inputmode="decimal" value="${l.rate ?? ''}" placeholder="$/hr base"><span>${M(T.lab[i].amt)}</span><button class="x" data-rmg="labor:${i}">✕</button></div>`).join('')}<button class="btn sm" data-addg="labor">➕ Labor</button></div>
    <div class="card"><b>Materials</b>${C.tm.mat.map((l, i) => `<div class="grid4 tl" data-g="mat" data-i="${i}"><input data-l="desc" value="${esc(l.desc || '')}" placeholder="Material"><input data-l="qty" type="number" inputmode="decimal" value="${l.qty ?? ''}" placeholder="Qty"><input data-l="price" type="number" inputmode="decimal" value="${l.price ?? ''}" placeholder="$/unit"><span>${M(T.mat[i].amt)}</span><button class="x" data-rmg="mat:${i}">✕</button></div>`).join('')}<button class="btn sm" data-addg="mat">➕ Material</button></div>
    <div class="card"><b>Equipment</b>${C.tm.eq.map((l, i) => `<div class="grid4 tl" data-g="eq" data-i="${i}"><input data-l="desc" value="${esc(l.desc || '')}" placeholder="Equipment"><input data-l="hrs" type="number" inputmode="decimal" value="${l.hrs ?? ''}" placeholder="Hrs"><input data-l="rate" type="number" inputmode="decimal" value="${l.rate ?? ''}" placeholder="$/hr"><span>${M(T.eq[i].amt)}</span><button class="x" data-rmg="eq:${i}">✕</button></div>`).join('')}<button class="btn sm" data-addg="eq">➕ Equipment</button></div>
    ${fld('tmMk', 'Markup %', C.tm.markupPct, '', 'number')}<div class="card sum">Labor ${M(T.L)} · Materials ${M(T.M)} · Equipment ${M(T.E)} · Markup ${M(T.markup)} · <b>Total ${M(T.total)}</b></div>
    <label class="fld"><span>Signature of owner's rep (name, typed on site)</span><input data-k="signer" value="${esc(C.signer || '')}"></label>`;
  main().innerHTML = `<h2>${esc(C.no)} <span class="tag ${C.status === 'approved' ? 'ok' : ''}">${C.status}</span></h2>${fld('title', 'Title', C.title, 'example: Added #5 dowels at wet well')}<div class="grid2">${fld('to', 'Send to (email)', C.to, '', 'email')}${fld('attn', 'Attention', C.attn)}</div>
  ${C.type !== 'rebar' ? `<label class="fld"><span>Reason / justification</span><textarea data-k="reason" rows="3">${esc(C.reason)}</textarea></label><div class="row"><input data-k="standard" value="${esc(C.standard)}" placeholder="Standard cited (use the helper)" class="grow"><button class="btn sm" id="helper">📚 Justification helper</button></div>` : ''}
  ${body}<label class="fld"><span>Notes / exclusions</span><textarea data-k="notes" rows="2">${esc(C.notes)}</textarea></label>
  <div class="row"><select id="status">${['draft','sent','approved','rejected'].map(s => `<option ${C.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select><a class="btn" id="mail" href="#">✉ Email (opens mail app)</a><button class="btn" id="share">📤 Share PDF</button><button class="btn danger" id="del">Delete</button></div>
  <p class="muted small">Nothing is sent automatically. Email opens your mail app with the text filled in; attach the PDF from Share/Download.</p>`;
  bindFields(C, save); $$('[data-k=tmMk]').forEach(i => i.onchange = () => { C.tm.markupPct = n0(i.value); re(); });
  $$('.ln [data-l]').forEach(i => i.onchange = () => { const l = C.lines[+i.closest('.ln').dataset.i]; l[i.dataset.l] = i.type === 'number' ? (i.value === '' ? '' : n0(i.value)) : i.value; re(); });
  $$('.ln + .x, .ln .x').forEach(b => b.onclick = () => { C.lines.splice(+b.dataset.rm, 1); re(); });
  const al = $('#addL'); if (al) al.onclick = () => { C.lines.push(C.type === 'rebar' ? {desc:'', lb:'', cls:'fab', coat:'black'} : {desc:'', qty:'', unit:'', price:''}); re(); };
  $$('.tl [data-l]').forEach(i => i.onchange = () => { const el = i.closest('.tl'); C.tm[el.dataset.g][+el.dataset.i][i.dataset.l] = i.type === 'number' ? n0(i.value) : i.value; re(); });
  $$('[data-rmg]').forEach(b => b.onclick = () => { const [g, i] = b.dataset.rmg.split(':'); C.tm[g].splice(+i, 1); re(); }); $$('[data-addg]').forEach(b => b.onclick = () => { C.tm[b.dataset.addg].push({}); re(); });
  if (typeof bindEst === 'function' && C.type !== 'tm') bindEst(C, re);
  const pc = $('#pickCost'); if (pc) pc.onclick = () => go('costs', {pickFor:C.id});
  const hp = $('#helper'); if (hp) hp.onclick = () => go('standards', {helperFor:C.id});
  $('#status').onchange = async e => { const was = C.status; C.status = e.target.value; await save();
    if (C.status === 'approved' && was !== 'approved' && C.type !== 'rebar' && confirm('Add this approved change order to the schedule of values (net change line on the pay app)?')) { APP.project.sov.push({id:uid(), item:C.no, desc:C.title || C.no, unit:'LS', qty:1, price:T.total, sched:T.total, co:true, coId:C.id}); await saveProject(); toast('Added to SOV ✔'); } coForm(C); };
  const text = coText(C, T), lint = RHM.lintQuoteText(text); if (lint.length) toast('Check wording: ' + lint.join('; '), 5000);
  $('#mail').href = mailto(C.to, `${C.type === 'rebar' ? 'Rebar-Fab Quote' : C.type === 'tm' ? 'T&M Ticket' : 'Change Order'} ${C.no} - ${APP.project.name}${C.title ? ' - ' + C.title : ''}`, text);
  $('#mail').onclick = () => { if (C.status === 'draft') { C.status = 'sent'; save(); } };
  $('#share').onclick = async () => { const b = await coPDF(C, T); await sharePDF(b, `${C.no}_${safe(APP.project.name)}.pdf`, `${C.no} ${APP.project.name}`); };
  $('#del').onclick = async () => { if (!confirm('Delete?')) return; await DB.del('cos', C.id); APP.undo.push(['cos', C]); go('co'); toastUndo('Deleted'); };
  setPrimary('📄 Preview PDF', async () => { const b = await coPDF(C, T); window.open(URL.createObjectURL(b), '_blank') || download(`${C.no}.pdf`, b); }); }
function coText(C, T) { const L = [`${C.type === 'rebar' ? 'Quote' : C.type === 'tm' ? 'T&M Ticket' : 'Change Order'} ${C.no} - ${APP.project.name}`, C.title, ''];
  if (C.attn) L.unshift(`Attn: ${C.attn}`, '');
  if (C.type === 'rebar') { T.rows.forEach(r => L.push(`- ${r.desc}: ${RHM.fmt(r.lb)} lb ${r.coat === 'epoxy' ? 'epoxy' : r.cls === 'straight' ? 'straight' : 'fabricated'} @ ${M(r.rate)}/lb = ${M(r.material)}`));
    L.push('', `Material: ${M(T.material)}`, `Trucking: ${M(T.trucking)} (${T.loads} load(s))`, `Shop Drawings: ${M(T.shop)} (fabricated tons only)`, `Total: ${M(T.total)}`); }
  else if (C.type === 'tm') { T.lab.forEach(l => L.push(`- ${l.who}: ${l.hrs || 0} ST + ${l.ot || 0} OT hrs = ${M(l.amt)} incl. burden`)); T.mat.forEach(m => L.push(`- ${m.desc}: ${m.qty} @ ${M(m.price)} = ${M(m.amt)}`)); T.eq.forEach(m => L.push(`- ${m.desc}: ${m.hrs} hrs @ ${M(m.rate)} = ${M(m.amt)}`)); L.push('', `Total: ${M(T.total)}`); }
  else { T.rows.forEach(r => L.push(`- ${r.desc}: ${RHM.fmt(n0(r.qty))} ${r.unit || ''} @ ${M(n0(r.price))} = ${M(r.amt)}`)); L.push('', `Total: ${M(T.total)}`); }
  if (C.reason) L.push('', 'Justification: ' + C.reason); if (C.standard) L.push('Reference: ' + C.standard); if (C.notes) L.push('', C.notes);
  L.push('', 'Thank you,', CO_INFO.person, CO_INFO.name, `${CO_INFO.addr1}, ${CO_INFO.addr2}`, `Main ${CO_INFO.main} · Direct ${CO_INFO.direct}`, CO_INFO.email); return L.filter(x => x !== undefined).join('\n'); }

/* ---------- COST DATA ---------- */
async function ensureCosts() { const all = await DB.all('costs'); if (all.length) return all;
  const items = []; for (const [f, src] of [['data/joe_rates.csv', 'Joe'], ['data/costs_example.csv', 'EXAMPLE']]) { const t = await (await fetch(f)).text(); RHM.mapCostCSV(t, src).items.forEach(i => items.push({...i, id:uid()})); }
  await DB.bulk('costs', items); return items; }
ROUTES.costs = async (arg) => { const all = await ensureCosts(), q = (APP.costQ || '').toLowerCase(), list = all.filter(i => !q || (i.desc + ' ' + i.line).toLowerCase().includes(q)).slice(0, 200);
  main().innerHTML = `<h2>Cost Data</h2><div class="note"><b>RSMeans data is licensed.</b> This app does not include it. Import your own licensed export as CSV. Rows marked <span class="tag ex">EXAMPLE</span> are made-up placeholders for testing only; <span class="tag ok">Joe</span> rows are your known rates.</div>
  <div class="card"><b>City cost index</b><div class="grid4"><label class="fld"><span>City</span><input id="cciCity" value="${esc(SET.cci.city)}"></label><label class="fld"><span>Material index</span><input id="cciM" type="number" inputmode="decimal" value="${SET.cci.mat}"></label><label class="fld"><span>Installation index</span><input id="cciI" type="number" inputmode="decimal" value="${SET.cci.inst}"></label></div><small>Adjusted = material × (mat index/100) + (labor + equipment) × (install index/100). Labor burden for T&M: ${SET.burdenPct}%.</small></div>
  <input id="cq" class="search" placeholder="🔎 Search description or line number" value="${esc(APP.costQ || '')}">
  <div class="list">${list.map(i => { const a = RHM.costAdj(i, SET.cci); return `<div class="li"><div class="grow"><b>${esc(i.desc)}</b> <span class="tag ${i.src === 'EXAMPLE' ? 'ex' : i.src === 'Joe' ? 'ok' : ''}">${esc(i.src)}</span><small>${esc(i.line)} · ${esc(i.unit)} · mat ${M(i.mat || 0)} · lab ${M(i.lab || 0)} · eq ${M(i.eq || 0)}${i.crew ? ' · crew ' + esc(i.crew) : ''}${isFinite(i.out) && i.out ? ' · output ' + i.out + '/day' : ''}${isFinite(i.lh) && i.lh ? ' · ' + i.lh + ' LH' : ''} → <b>${M(a.total)}</b>/${esc(i.unit)}</small></div>${arg && arg.pickFor ? `<button class="btn sm" data-pick="${i.id}">Use</button>` : ''}</div>`; }).join('')}</div>
  <div class="row"><button class="btn" id="tmpl">⬇ CSV template</button><button class="btn danger" id="clr">Remove imported rows</button></div>`;
  $('#cq').oninput = e => { APP.costQ = e.target.value; clearTimeout(APP.cqT); APP.cqT = setTimeout(() => { go('costs', arg).then(() => { const i = $('#cq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 350); };
  [['cciCity', 'city'], ['cciM', 'mat'], ['cciI', 'inst']].forEach(([id, k]) => $('#' + id).onchange = e => { SET.cci[k] = k === 'city' ? e.target.value : n0(e.target.value); saveSet(); go('costs', arg); });
  $('#tmpl').onclick = () => download('cost_import_template.csv', 'line,description,unit,material,labor,equipment,crew,daily_output,labor_hours,source\n', 'text/csv');
  $('#clr').onclick = async () => { if (!confirm('Remove all imported cost rows (keeps Joe and EXAMPLE rows)?')) return; for (const i of all.filter(i => !['Joe','EXAMPLE'].includes(i.src))) await DB.del('costs', i.id); go('costs', arg); };
  $$('[data-pick]').forEach(b => b.onclick = async () => { const C = await DB.get('cos', arg.pickFor), i = all.find(x => x.id === b.dataset.pick), a = RHM.costAdj(i, SET.cci);
    C.lines.push({desc:i.desc, qty:'', unit:i.unit, price:a.total, cite:`Cost data ${i.src} ${i.line} (CCI ${SET.cci.city})`}); await DB.put('cos', C); go('co', {id:C.id}); });
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,text/csv'; inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const r = RHM.mapCostCSV(await f.text(), prompt('Label for this data (e.g., "RSMeans 2026 licensed")', 'Imported') || 'Imported');
    if (!r.items.length) return alert('No rows found. The file needs a header row with at least a description column.');
    if (!confirm(`Found ${r.items.length} rows (${r.skipped} skipped). Columns matched: ${Object.keys(r.map).join(', ')}. Import?`)) return; await DB.bulk('costs', r.items.map(i => ({...i, id:uid()}))); toast(`Imported ${r.items.length} rows`); go('costs', arg); };
  setPrimary('⬆ Import my cost CSV', () => inp.click()); };

/* ---------- STANDARDS ---------- */
let STD = null; async function loadStd() { return STD ||= await (await fetch('data/standards.json')).json(); }
ROUTES.standards = async (arg) => { const d = await loadStd(); if (arg && arg.helperFor !== undefined) return decisionHelper(d, arg.helperFor);
  const pt = APP.project && APP.project.type && APP.project.type !== 'general' ? APP.project.type : 'all', ty = APP.stdTy || pt;
  const q = (APP.stdQ || '').toLowerCase(), ag = APP.stdAg || 'All', items = d.items.filter(i => (ty === 'all' || (i.types || []).includes(ty)) && (ag === 'All' || i.agency === ag || (ag === 'Federal' && ['Federal','USACE/UFGS','FHWA'].includes(i.agency))) && (!q || JSON.stringify(i).toLowerCase().includes(q)));
  main().innerHTML = `<h2>Standards</h2><p class="hint">Summaries in plain words with links to the official source (checked ${d.verified}). Read the governing edition and the project's special provisions before relying on them.</p>
  <input id="sq" class="search" placeholder="🔎 Search: rebar, change, stored, retainage, 440…" value="${esc(APP.stdQ || '')}"><div class="seg wrap">${['All','TxDOT','NCTCOG','Federal','Industry'].map(a => `<button data-ag="${a}" class="${ag === a ? 'on' : ''}" aria-pressed="${ag === a}">${a}</button>`).join('')}</div>
  <div class="seg wrap" role="group" aria-label="Project type">${[['all', 'All types'], ...['oilfield', 'mechanical', 'underground'].map(k => [k, PTYPES[k].icon + ' ' + PTYPES[k].name.split(' ')[0]])].map(([k, t]) => `<button data-ty="${k}" class="${ty === k ? 'on' : ''}" aria-pressed="${ty === k}">${t}</button>`).join('')}</div>
  <div class="list">${items.map(i => { const s = d.sources[i.src]; return `<div class="card std"><b>${esc(i.agency)} ${esc(i.code)} — ${esc(i.title)}</b><p>${esc(i.summary)}</p><p class="small"><b>Use it for:</b> ${esc(i.use)}</p><a href="${esc(i.url || s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a></div>`; }).join('') || '<p>No match.</p>'}</div>`;
  $('#sq').oninput = e => { APP.stdQ = e.target.value; clearTimeout(APP.sqT); APP.sqT = setTimeout(() => go('standards').then(() => { const i = $('#sq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 300); };
  $$('[data-ag]').forEach(b => b.onclick = () => { APP.stdAg = b.dataset.ag; go('standards'); }); $$('[data-ty]').forEach(b => b.onclick = () => { APP.stdTy = b.dataset.ty; go('standards'); });
  setPrimary('🧭 Extra-work / CO justification helper', () => go('standards', {helperFor:null})); };
const SITUATIONS = { directed:'Owner/GC told us to do something not in the plans', dsc:'Field conditions differ from the plans (rock, water, utilities, existing work)', qty:'Quantity is more than the plans/bid quantity', conflict:'Plans conflict or are missing information', tm:'We were told to proceed on time & materials', stored:'We want to bill materials stored on site' };
const CONTRACTS = { txdot:'TxDOT', city:'City / county (NCTCOG)', fed:'Federal (FAR / USACE / FHWA)', private:'Private (AIA-style subcontract)', msa:'Operator MSA / work order (oilfield)', industrial:'Plant owner / EPC contract (industrial)' };
const sitText = k => SITUATIONS[k] || Object.values(PTYPES).map(t => t.sits[k]).find(Boolean)?.[0] || k;
const typeSit = k => Object.values(PTYPES).map(t => t.sits[k]).find(Boolean);
function adviseCO(sit, con) { const A = {
    txdot:{directed:['tx-4', 'Item 4, Art. 4 "Changes in the Work"'], dsc:['tx-4', 'Item 4, Art. 5 "Differing Site Conditions"'], qty:['tx-9', 'Item 9, Art. 3 "Adjustment of Quantities"'], conflict:['tx-4', 'Item 4, Art. 4 and Art. 6 "Requests for Additional Compensation"'], tm:['tx-9', 'Item 9, Art. 7 "Payment for Extra Work and Force Account Method"'], stored:['tx-9', 'Item 9, Art. 6 "Payment for Material on Hand"']},
    city:{directed:['nct-100', 'NCTCOG Div. 100 General Provisions (changes)'], dsc:['nct-100', 'NCTCOG Div. 100 General Provisions (differing conditions)'], qty:['nct-100', 'NCTCOG Div. 100 (measurement and payment)'], conflict:['nct-100', 'NCTCOG Div. 100 (plans/specs coordination)'], tm:['nct-100', 'NCTCOG Div. 100 (extra work / force account)'], stored:['nct-100', 'NCTCOG Div. 100 (payment)']},
    fed:{directed:['far-52.243-4', 'FAR 52.243-4 Changes'], dsc:['far-52.236-2', 'FAR 52.236-2 Differing Site Conditions'], qty:['far-52.243-4', 'FAR 52.243-4 Changes (variation in quantity per contract clause)'], conflict:['far-52.243-4', 'FAR 52.243-4 Changes (constructive change)'], tm:['far-22.4', 'FAR 52.243-4 + Subpart 22.4 labor standards for T&M labor rates'], stored:['ufgs-01-20-00', 'UFGS 01 20 00 Price and Payment Procedures (as edited for the project)']},
    private:{directed:['aia-g702', 'Subcontract changes clause (AIA A201 Art. 7 style) - check your subcontract'], dsc:['aia-g702', 'Subcontract concealed/unknown conditions clause - check your subcontract'], qty:['aia-g702', 'Subcontract unit-price / changes clause'], conflict:['aia-g702', 'Subcontract RFI and changes clauses'], tm:['aia-g702', 'Subcontract changes clause - written T&M directive'], stored:['aia-g702', 'Subcontract payment clause - stored materials']} };
  const ts = typeSit(sit); const [id, cite] = ts ? (ts[1][con] || ts[1].private) : A[con][sit]; const steps = ['Give WRITTEN notice before doing (or disturbing) the work - same day if possible.', 'Photograph the condition and mark the sheet (Plans → Redline / Cloud).', 'Track labor, equipment and material daily (T&M ticket signed by the owner\'s rep).', 'Price it from takeoff + rates; show all math.', 'Do not bill it on a pay app until the change order is approved.'];
  if (sit === 'dsc') steps[0] = 'STOP and notify in writing BEFORE the condition is disturbed.'; if (sit === 'stored') steps.splice(0, 5, 'Get supplier invoices and proof of insurance/storage.', 'Photograph and tag the stored material.', 'Bill under Stored Materials (pay app step 3); retainage on stored applies.');
  if (ts && ['utility', 'rock', 'deeper'].includes(sit)) steps[0] = 'STOP and notify in writing BEFORE the condition is disturbed. Keep the trench protected per OSHA 1926.652 while you wait.';
  if (sit === 'utility') steps.splice(1, 0, 'Record the 811 ticket number and photograph the marks vs. what was found.');
  if (con === 'fed') steps.push('Pay labor at or above the Davis-Bacon wage determination; keep certified payroll.');
  return {id, cite, steps}; }
async function decisionHelper(d, coId) { let sit = APP.hSit || '', con = APP.hCon || '';
  const draw = () => { const adv = sit && con ? adviseCO(sit, con) : null, it = adv && d.items.find(i => i.id === adv.id), src = it && d.sources[it.src];
    const text = adv ? `${sitText(sit)}. Under ${adv.cite}, this work is outside the base contract scope and an adjustment is requested. Written notice was given on ${today()}. Backup: marked sheets, photos and the daily log/T&M records for this date.` : '';
    main().innerHTML = `<h2>Extra-work justification</h2>${wizHead(adv ? 3 : sit ? 2 : 1, 3, adv ? 'Your justification' : sit ? 'What kind of contract?' : 'What happened?')}
    ${!sit ? `<div class="list">${Object.entries(ptype(APP.project).sits).map(([k, t]) => `<button class="li big" data-s="${k}">${ptype(APP.project).icon} ${t[0]}</button>`).join('')}${Object.entries(SITUATIONS).map(([k, t]) => `<button class="li big" data-s="${k}">${t}</button>`).join('')}</div>` : !con ? `<div class="list">${Object.entries(CONTRACTS).filter(([k]) => typeSit(sit) ? k in typeSit(sit)[1] : !['msa', 'industrial'].includes(k)).map(([k, t]) => `<button class="li big" data-c="${k}">${t}</button>`).join('')}</div><button class="btn ghost" id="b1">← Back</button>`
      : `<div class="card"><b>Cite:</b> ${esc(adv.cite)}<br><a href="${esc((it && it.url) || src.url)}" target="_blank" rel="noopener">${esc(src.name)} ↗</a><p class="small">${esc(it.summary)}</p></div><div class="card"><b>Do this:</b><ol>${adv.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
        <label class="fld"><span>Draft justification (edit before using)</span><textarea id="just" rows="5">${esc(text)}</textarea></label><p class="muted small">This is a guide, not legal advice. Check the notice deadlines in your contract.</p><button class="btn ghost" id="b2">← Start over</button>`}`;
    $$('[data-s]').forEach(b => b.onclick = () => { sit = APP.hSit = b.dataset.s; draw(); }); $$('[data-c]').forEach(b => b.onclick = () => { con = APP.hCon = b.dataset.c; draw(); });
    const b1 = $('#b1'); if (b1) b1.onclick = () => { sit = APP.hSit = ''; draw(); }; const b2 = $('#b2'); if (b2) b2.onclick = () => { sit = con = APP.hSit = APP.hCon = ''; draw(); };
    if (adv && coId) setPrimary('✔ Put this on the change order', async () => { const C = await DB.get('cos', coId); C.reason = $('#just').value; C.standard = adv.cite; await DB.put('cos', C); go('co', {id:coId}); });
    else if (adv) setPrimary('📋 Copy justification', async () => { try { await navigator.clipboard.writeText($('#just').value); toast('Copied'); } catch (e) { $('#just').select(); toast('Select-all done: copy it'); } });
    else setPrimary(null); };
  draw(); }
