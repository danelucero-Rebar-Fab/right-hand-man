/* Right Hand Man v1.9.1 - Field + PM: RFI, submittals, punch pins, signatures, timecards, EV dashboard,
   receiving, safety, weather, 3-wk lookahead, docs, stamped photo log, revision compare entry, XLSX export. Every $ from the user's own entries. */
'use strict';
const ITEMS = async kind => (await DB.where('items', x => x.projectId === APP.pid && x.kind === kind)).sort((a, b) => (a.no || 0) - (b.no || 0) || a.created - b.created);
const nextNo = async kind => (await ITEMS(kind)).reduce((m, x) => Math.max(m, x.no || 0), 0) + 1;
const needProj = () => { if (APP.pid) return false; main().innerHTML = emptyState('📁', 'Open a project first', 'Pick a project on Home, then come back.'); setPrimary(null); return true; };
const dOpen = x => RHMF.daysOpen(x.sent || x.opened, x.closedOn, today());
const ffld = (k, l, v, type = 'text', extra = '') => `<label class="fld"><span>${l}</span>${type === 'area' ? `<textarea data-f="${k}" rows="3" ${extra}>${esc(v ?? '')}</textarea>` : `<input data-f="${k}" type="${type}" value="${esc(v ?? '')}" ${extra}>`}</label>`;
const sel = (k, l, v, opts) => `<label class="fld"><span>${l}</span><select data-f="${k}">${opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
function bindF(o, save) { $$('[data-f]').forEach(i => { const ev = i.tagName === 'SELECT' ? 'onchange' : 'oninput'; i[ev] = () => { o[i.dataset.f] = i.value; clearTimeout(o._t); o._t = setTimeout(() => { delete o._t; save(); }, 350); }; }); }
const BIC = ['Us', 'GC', 'Engineer / Architect', 'Owner', 'Supplier'];

/* ---------- RFI log ---------- */
const RFI_ST = ['Draft', 'Open', 'Answered', 'Closed'];
TITLES.rfis = 'RFI log'; TITLES.rfi = 'RFI';
ROUTES.rfis = async () => { if (needProj()) return; const L = await ITEMS('rfi'); const open = L.filter(x => x.status !== 'Closed');
  main().innerHTML = `<h2>RFI log <small class="muted">${open.length} open</small></h2>${L.length ? `<div class="list">${L.map(x => { const d = dOpen(x), late = x.due && x.status === 'Open' && x.due < today(); return `<button class="li big" data-rfi="${x.id}"><b>RFI ${x.no} - ${esc(x.subject || '(no subject)')}</b> <span class="tag ${x.status === 'Closed' ? 'ok' : late ? 'bad' : ''}">${esc(x.status)}${late ? ' · OVERDUE' : ''}</span><small>Ball in court: ${esc(x.bic || '—')} · ${d === null ? 'not sent' : d + ' day(s) open'}${x.sheet ? ' · ' + esc(x.sheet) : ''}</small></button>`; }).join('')}</div>` : emptyState('❓', 'No RFIs yet', 'Tap "New RFI", or pull the RFIs your takeoff check already found.')}
  <button class="btn wide" id="rfiPull">⤵ Pull RFIs from the takeoff (blanks / checks)</button>`;
  $$('[data-rfi]').forEach(b => b.onclick = () => go('rfi', b.dataset.rfi));
  $('#rfiPull').onclick = async () => { const tk = await DB.where('takeoff', l => l.projectId === APP.pid), have = new Set(L.map(x => x.question)); let n = 0, no = await nextNo('rfi');
    for (const l of tk) { const e = RHM.evalLine(l), q = (e.rfi || []).concat(RHMR.takeoffCheck(l).items.filter(i => i.lvl === 'rfi').map(i => i.msg)); for (const m of q) { const qq = `${l.desc || (RHM.T[l.tpl] || {}).name || 'Takeoff line'}: ${m.replace(/^RFI:\s*/, '')}`; if (have.has(qq)) continue; have.add(qq);
      await DB.put('items', {id:uid(), projectId:APP.pid, kind:'rfi', no:no++, subject:(l.desc || 'Takeoff').slice(0, 60), question:qq, sheet:l.sheet || '', page:l.page || '', spec:l.spec || '', status:'Draft', bic:'Us', created:Date.now(), from:'takeoff'}); n++; } }
    toast(n ? `${n} RFI draft(s) added` : 'No new RFIs found'); go('rfis'); };
  setPrimary('➕ New RFI', async () => { const x = {id:uid(), projectId:APP.pid, kind:'rfi', no:await nextNo('rfi'), subject:'', question:'', status:'Draft', bic:'Us', created:Date.now()}; await DB.put('items', x); go('rfi', x.id); }); };
ROUTES.rfi = async id => { const x = await DB.get('items', id); if (!x) return go('rfis'); const save = () => DB.put('items', x), d = dOpen(x);
  main().innerHTML = `<h2>RFI ${x.no}</h2><p class="small muted">${d === null ? 'Not sent yet' : `${d} day(s) open = ${x.closedOn || today()} − ${x.sent}`}</p>
  <div class="card">${ffld('subject', 'Subject', x.subject)}${ffld('question', 'Question (what you need answered)', x.question, 'area')}${ffld('suggest', 'Suggested answer (optional - speeds it up)', x.suggest, 'area')}
   <div class="grid3">${ffld('sheet', 'Sheet', x.sheet)}${ffld('page', 'PDF page', x.page, 'number', 'inputmode="numeric"')}${ffld('spec', 'Spec section', x.spec)}</div>
   <div class="grid2">${ffld('to', 'Send to (email)', x.to, 'email')}${sel('bic', 'Ball in court', x.bic, BIC)}${sel('status', 'Status', x.status, RFI_ST)}${sel('impact', 'Cost / schedule impact?', x.impact || 'Unknown', ['Unknown', 'None', 'Cost', 'Schedule', 'Cost + schedule'])}${ffld('sent', 'Date sent', x.sent, 'date')}${ffld('due', 'Answer needed by', x.due, 'date')}</div>
   ${ffld('answer', 'Answer', x.answer, 'area')}${ffld('closedOn', 'Date answered / closed', x.closedOn, 'date')}</div>
  <div class="row"><button class="btn p" id="rfiMail">✉ Email RFI (opens mail app)</button><button class="btn danger" id="rfiDel">Delete</button></div>`;
  bindF(x, save);
  $('#rfiMail').onclick = async () => { await save(); const P = APP.project; const body = `RFI ${x.no} - ${P.name}\nSubject: ${x.subject}\n${x.sheet ? 'Sheet ' + x.sheet + (x.page ? ', PDF page ' + x.page : '') + '\n' : ''}${x.spec ? 'Spec ' + x.spec + '\n' : ''}\nQuestion:\n${x.question}\n${x.suggest ? '\nSuggested answer:\n' + x.suggest + '\n' : ''}${x.due ? '\nAnswer needed by ' + x.due + '\n' : ''}\n${CO_INFO.person} · ${CO_INFO.name} · ${CO_INFO.direct}`;
    openLink(mailto(x.to, `RFI ${x.no} - ${P.name} - ${x.subject}`, body)); if (x.status === 'Draft') { x.status = 'Open'; x.bic = x.bic === 'Us' ? 'GC' : x.bic; x.sent ||= today(); await save(); go('rfi', x.id); } };
  $('#rfiDel').onclick = async () => { if (!confirm('Delete this RFI?')) return; await DB.del('items', x.id); go('rfis'); }; setPrimary(null); };

/* ---------- Submittal log ---------- */
const SUB_ST = ['Not sent', 'Submitted', 'Approved', 'Approved as noted', 'Revise & resubmit', 'Rejected'];
const SUB_TYPE = ['Shop drawings', 'Product data', 'Mix design', 'Mill certs', 'Samples', 'Calcs (PE)', 'Other'];
TITLES.subs = 'Submittal log'; TITLES.sub = 'Submittal';
ROUTES.subs = async () => { if (needProj()) return; const L = await ITEMS('sub');
  main().innerHTML = `<h2>Submittal log <small class="muted">${L.filter(x => !/^Approved/.test(x.status)).length} not approved</small></h2>${L.length ? `<div class="list">${L.map(x => { const late = x.due && x.status === 'Submitted' && x.due < today(); return `<button class="li big" data-sub="${x.id}"><b>${x.no}${x.rev ? '.' + x.rev : ''} ${esc(x.spec || '')} - ${esc(x.desc || '(no description)')}</b> <span class="tag ${/^Approved/.test(x.status) ? 'ok' : /Revise|Reject/.test(x.status) || late ? 'bad' : ''}">${esc(x.status)}${late ? ' · OVERDUE' : ''}</span><small>${esc(x.type || '')} · Ball in court: ${esc(x.bic || '—')}${x.sent && dOpen(x) !== null ? ' · ' + dOpen(x) + ' day(s) out' : ''}</small></button>`; }).join('')}</div>` : emptyState('📑', 'No submittals yet', 'Add the shop drawings, mix design and mill certs the spec asks for.')}`;
  $$('[data-sub]').forEach(b => b.onclick = () => go('sub', b.dataset.sub));
  setPrimary('➕ New submittal', async () => { const x = {id:uid(), projectId:APP.pid, kind:'sub', no:await nextNo('sub'), rev:0, type:'Shop drawings', status:'Not sent', bic:'Us', created:Date.now()}; await DB.put('items', x); go('sub', x.id); }); };
ROUTES.sub = async id => { const x = await DB.get('items', id); if (!x) return go('subs'); const save = () => DB.put('items', x);
  main().innerHTML = `<h2>Submittal ${x.no}${x.rev ? ' rev ' + x.rev : ''}</h2><div class="card"><div class="grid2">${ffld('spec', 'Spec section', x.spec)}${sel('type', 'Type', x.type, SUB_TYPE)}</div>${ffld('desc', 'Description', x.desc)}
   <div class="grid2">${sel('status', 'Status', x.status, SUB_ST)}${sel('bic', 'Ball in court', x.bic, BIC)}${ffld('sent', 'Date submitted', x.sent, 'date')}${ffld('due', 'Review due', x.due, 'date')}${ffld('closedOn', 'Date returned', x.closedOn, 'date')}${ffld('to', 'Reviewer email', x.to, 'email')}</div>${ffld('notes', 'Reviewer comments', x.notes, 'area')}</div>
   <div class="row"><button class="btn" id="subRev">↻ Resubmit as rev ${(x.rev || 0) + 1}</button><button class="btn danger" id="subDel">Delete</button></div>`;
  bindF(x, save);
  $('#subRev').onclick = async () => { x.hist = (x.hist || []).concat({rev:x.rev || 0, status:x.status, closedOn:x.closedOn, notes:x.notes}); x.rev = (x.rev || 0) + 1; x.status = 'Not sent'; x.bic = 'Us'; x.sent = ''; x.closedOn = ''; x.notes = ''; await save(); go('sub', x.id); };
  $('#subDel').onclick = async () => { if (!confirm('Delete this submittal?')) return; await DB.del('items', x.id); go('subs'); }; setPrimary(null); };

/* ---------- Punch list on plan pins ---------- */
const PUNCH_ST = ['Open', 'Ready for review', 'Closed'];
TITLES.punch = 'Punch list';
ROUTES.punch = async (sheetId) => { if (needProj()) return; const sheets = (await DB.where('sheets', s => s.projectId === APP.pid)).sort((a, b) => a.created - b.created), all = await ITEMS('punch');
  const S = sheets.find(s => s.id === sheetId) || sheets.find(s => s.id === APP.punchSheet) || sheets[0]; if (S) APP.punchSheet = S.id;
  const pins = S ? all.filter(p => p.sheetId === S.id) : [], url = S && S.blob ? URL.createObjectURL(S.blob) : S && S.thumb, photos = await DB.where('photos', p => p.punchId);
  main().innerHTML = `<h2>Punch list <small class="muted">${all.filter(p => p.status !== 'Closed').length} open</small></h2>
  ${S ? `<label class="fld"><span>Sheet</span><select id="pSheet">${sheets.map(s => `<option value="${s.id}" ${s.id === S.id ? 'selected' : ''}>${esc(s.sheetNo || s.name)}</option>`).join('')}</select></label>
   <p class="hint">Tap the plan to drop a pin.</p><div class="pinwrap" id="pinW"><img src="${url}" alt="Plan sheet ${esc(S.sheetNo || S.name)}" id="pImg">${pins.map(p => `<button class="pin ${p.status === 'Closed' ? 'done' : ''}" style="left:${p.x * 100}%;top:${p.y * 100}%" data-pin="${p.id}" aria-label="Punch ${p.no}: ${esc(p.desc || '')}">${p.no}</button>`).join('')}</div>` : emptyState('📐', 'No plan sheets yet', 'Add a plan sheet in Plans - then drop punch pins on it.')}
  <div class="list" id="pList">${all.map(p => { const ph = photos.filter(f => f.punchId === p.id); return `<details class="card punch" id="pi-${p.id}" ${APP.openPunch === p.id ? 'open' : ''}><summary><b>#${p.no}</b> ${esc(p.desc || '(describe it)')} <span class="tag ${p.status === 'Closed' ? 'ok' : ''}">${esc(p.status)}</span> <small>${esc((sheets.find(s => s.id === p.sheetId) || {}).sheetNo || '')}</small></summary>
    <label class="fld"><span>What needs fixing</span><input data-pf="${p.id}:desc" value="${esc(p.desc || '')}"></label><div class="grid2"><label class="fld"><span>Assigned to</span><input data-pf="${p.id}:who" value="${esc(p.who || '')}"></label><label class="fld"><span>Status</span><select data-pf="${p.id}:status">${PUNCH_ST.map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
    <div class="photos">${ph.map(f => `<div class="ph"><img src="${f.thumb}" alt="Punch ${p.no} photo"></div>`).join('')}</div><div class="row"><label class="btn">📷 Add photo<input type="file" accept="image/*" capture="environment" data-pph="${p.id}" hidden></label><button class="btn danger sm" data-pdel="${p.id}">Delete</button></div></details>`; }).join('')}</div>`;
  if (S) { $('#pSheet').onchange = e => go('punch', e.target.value);
    $('#pImg').onclick = async e => { const r = e.target.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; const p = {id:uid(), projectId:APP.pid, kind:'punch', no:await nextNo('punch'), sheetId:S.id, x:+x.toFixed(4), y:+y.toFixed(4), desc:'', status:'Open', created:Date.now()}; await DB.put('items', p); APP.openPunch = p.id; buzz(15); await ROUTES.punch(S.id); const i = document.querySelector(`[data-pf="${p.id}:desc"]`); i && i.focus(); };
    $$('[data-pin]').forEach(b => b.onclick = e => { e.stopPropagation(); APP.openPunch = b.dataset.pin; const d = document.getElementById('pi-' + b.dataset.pin); d.open = true; d.scrollIntoView({block:'center'}); }); }
  $$('[data-pf]').forEach(i => i[i.tagName === 'SELECT' ? 'onchange' : 'oninput'] = async () => { const [id, k] = i.dataset.pf.split(':'), p = all.find(z => z.id === id); p[k] = i.value; await DB.put('items', p); if (k === 'status') ROUTES.punch(S && S.id); });
  $$('[data-pph]').forEach(i => i.onchange = async () => { if (!i.files[0]) return; await savePhoto(i.files[0], {punchId:i.dataset.pph, caption:'Punch'}); APP.openPunch = i.dataset.pph; ROUTES.punch(S && S.id); });
  $$('[data-pdel]').forEach(b => b.onclick = async () => { if (!confirm('Delete this punch item?')) return; await DB.del('items', b.dataset.pdel); ROUTES.punch(S && S.id); });
  setPrimary(null); };

/* ---------- signatures on T&M tickets and COs ---------- */
const coFormSig = coForm;
coForm = async function (C) { await coFormSig(C); if (C.type === 'rebar') return; const at = document.getElementById('coSend'); if (!at) return;
  at.insertAdjacentHTML('beforebegin', `<div class="card" id="coSigCard"><h3>${C.type === 'tm' ? 'Customer signature on the T&M ticket' : 'Customer signature on the CO'}</h3>${sigPadHTML('coSig', C.sig)}<div class="grid2"><label class="fld"><span>Printed name</span><input id="coSigName" value="${esc((C.sig && C.sig.name) || '')}"></label><label class="fld"><span>Date</span><input id="coSigDate" type="date" value="${esc((C.sig && C.sig.date) || today())}"></label></div><p class="small muted">Prints on the PDF in place of the blank "Accepted by" line.</p></div>`);
  const sv = () => DB.put('cos', C); bindSigPad('coSig', img => { C.sig ||= {}; C.sig.img = img; C.sig.date ||= today(); if (!img) C.sig = null; sv(); });
  $('#coSigName').oninput = e => { C.sig ||= {}; C.sig.name = e.target.value; sv(); }; $('#coSigDate').onchange = e => { C.sig ||= {}; C.sig.date = e.target.value; sv(); }; };

/* ---------- Timecards by cost code ---------- */
TITLES.time = 'Timecards';
ROUTES.time = async (date) => { if (needProj()) return; date = date || APP.tcDate || today(); APP.tcDate = date; const sov = APP.project.sov || [], all = await ITEMS('tc'), day = all.filter(t => t.date === date);
  const wk = (() => { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() - d.getDay()); return d.toLocaleDateString('en-CA'); })(), week = all.filter(t => t.date >= wk && t.date <= date);
  const byCode = {}; week.forEach(t => { const k = t.sovId || '—'; const h = (+t.hrs || 0) + (+t.ot || 0); byCode[k] = (byCode[k] || 0) + h; });
  const code = id => { const s = sov.find(x => x.id === id); return s ? `${s.item}. ${s.desc}` : 'No cost code'; };
  main().innerHTML = `<h2>Timecards</h2><label class="fld"><span>Day</span><input type="date" id="tcDate" value="${date}"></label>
  ${sov.length ? '' : '<p class="hint">⚠ This project has no SOV lines yet - cost codes come from the SOV.</p>'}
  <div class="list">${day.map(t => `<div class="card tc" data-tc="${t.id}"><div class="grid2"><label class="fld"><span>Worker</span><input data-t="who" value="${esc(t.who || '')}"></label><label class="fld"><span>Cost code (SOV line)</span><select data-t="sovId"><option value="">— pick —</option>${sov.map(s => `<option value="${s.id}" ${s.id === t.sovId ? 'selected' : ''}>${esc(s.item)}. ${esc(s.desc)}</option>`).join('')}</select></label>
     <label class="fld"><span>Regular hours</span><input data-t="hrs" type="number" inputmode="decimal" step="0.25" value="${t.hrs ?? ''}"></label><label class="fld"><span>OT hours (1.5×)</span><input data-t="ot" type="number" inputmode="decimal" step="0.25" value="${t.ot ?? ''}"></label><label class="fld"><span>Base $/hr (blank = $0, flagged)</span><input data-t="rate" type="number" inputmode="decimal" step="any" value="${t.rate ?? ''}"></label><label class="fld"><span>Note</span><input data-t="note" value="${esc(t.note || '')}"></label></div>
     <p class="small muted">${t.geo ? `📍 ${t.geo.lat.toFixed(5)}, ${t.geo.lon.toFixed(5)} ±${Math.round(t.geo.acc)} m at ${esc(t.geo.at)}` : 'No location'} · cost = (${+t.hrs || 0} + ${+t.ot || 0} × 1.5) × ${t.rate ? M(+t.rate) : '$0 (blank)'} = ${M(((+t.hrs || 0) + (+t.ot || 0) * 1.5) * (+t.rate || 0))}</p>
     <div class="row"><button class="btn sm" data-geo="${t.id}">📍 Stamp location</button><button class="btn sm danger" data-tdel="${t.id}">Delete</button></div></div>`).join('') || emptyState('⏱', 'No time for this day', 'Tap "Add a worker".')}</div>
  <div class="card"><h3>Week of ${wk} - hours by cost code</h3><table class="t money"><tbody>${Object.entries(byCode).map(([k, h]) => `<tr><td>${esc(code(k))}</td><td>${RHM.fmt(h)} hr</td></tr>`).join('') || '<tr><td colspan="2">No hours yet</td></tr>'}</tbody></table>
   <button class="btn sm" id="tcCSV">⬇ CSV</button><button class="btn sm" id="tcXLS">⬇ Excel</button></div>`;
  $('#tcDate').onchange = e => go('time', e.target.value);
  $$('[data-tc]').forEach(card => { const t = day.find(z => z.id === card.dataset.tc); card.querySelectorAll('[data-t]').forEach(i => i[i.tagName === 'SELECT' ? 'onchange' : 'oninput'] = () => { t[i.dataset.t] = i.value; clearTimeout(t._t); t._t = setTimeout(() => { delete t._t; DB.put('items', t); }, 350); }); });
  $$('[data-geo]').forEach(b => b.onclick = () => { if (!navigator.geolocation) return toast('Location not available on this device'); navigator.geolocation.getCurrentPosition(async p => { const t = day.find(z => z.id === b.dataset.geo); t.geo = {lat:p.coords.latitude, lon:p.coords.longitude, acc:p.coords.accuracy, at:new Date().toLocaleTimeString('en-US', {timeZone:'America/Chicago'}) + ' CT'}; await DB.put('items', t); go('time', date); }, () => toast('Location permission denied - time is still saved'), {enableHighAccuracy:true, timeout:10000}); });
  $$('[data-tdel]').forEach(b => b.onclick = async () => { await DB.del('items', b.dataset.tdel); go('time', date); });
  const tcRows = () => [['Date', 'Worker', 'Cost code', 'Reg hr', 'OT hr', 'Base $/hr', 'Cost', 'Location']].concat(week.map(t => [t.date, t.who || '', code(t.sovId), +t.hrs || 0, +t.ot || 0, t.rate ?? '', ((+t.hrs || 0) + (+t.ot || 0) * 1.5) * (+t.rate || 0), t.geo ? `${t.geo.lat},${t.geo.lon}` : '']));
  $('#tcCSV').onclick = () => download(`Timecards_week_${wk}_${safe(APP.project.name)}.csv`, new Blob([RHMF.toCSV(tcRows())], {type:'text/csv'}));
  $('#tcXLS').onclick = () => downloadXlsx(`Timecards_week_${wk}_${safe(APP.project.name)}.xlsx`, tcRows());
  setPrimary('➕ Add a worker', async () => { const last = all[all.length - 1] || {}; await DB.put('items', {id:uid(), projectId:APP.pid, kind:'tc', date, who:'', sovId:last.sovId || '', hrs:'', ot:'', rate:'', created:Date.now()}); go('time', date); }); };

/* ---------- Earned value dashboard ---------- */
TITLES.dash = 'Project dashboard';
ROUTES.dash = async () => { if (needProj()) return; const P = APP.project, logs = await DB.where('logs', l => l.projectId === APP.pid), tcs = await ITEMS('tc'), rfis = await ITEMS('rfi'), subs = await ITEMS('sub'), punch = await ITEMS('punch'), cos = await DB.where('cos', c => c.projectId === APP.pid), recvs = await ITEMS('recv'), wx = await ITEMS('weather'), safe = await ITEMS('safety');
  const times = tcs.map(t => ({sovId:t.sovId, date:t.date, who:t.who, hrs:(+t.hrs || 0) + (+t.ot || 0) * 1.5, rate:t.rate})), recv = recvs.map(r => ({sovId:r.sovId, date:r.date, desc:r.vendor || r.ticket || 'receipt', amt:r.amt})), ev = RHMF.earnedValue(P.sov || [], logs, times, recv);
  const k = (l, v, cls = '') => `<div class="kpi ${cls}"><small>${l}</small><b>${v}</b></div>`;
  main().innerHTML = `<h2>${esc(P.name)} - dashboard</h2><div class="kpis">${k('% complete (EV / BAC)', ev.pct + '%')}${k('Earned value', M(ev.EV))}${k('Actual cost', M(ev.AC))}${k('CPI', ev.CPI ?? '—', ev.CPI && ev.CPI < 1 ? 'bad' : ev.CPI ? 'ok' : '')}${k('Forecast at completion', ev.EAC === null ? '—' : M(ev.EAC))}${k('Cost to complete', ev.ETC === null ? '—' : M(ev.ETC))}</div>
  <div class="kpis">${k('Open RFIs', rfis.filter(x => x.status !== 'Closed').length, rfis.some(x => x.status === 'Open' && x.due && x.due < today()) ? 'bad' : '')}${k('Submittals not approved', subs.filter(x => !/^Approved/.test(x.status)).length)}${k('Open punch', punch.filter(x => x.status !== 'Closed').length)}${k('Pending COs', cos.filter(c => c.status === 'sent' || c.status === 'draft').length)}${k('Receipts', recvs.length)}${k('Weather delay hr', RHM.fmt(wx.reduce((a, x) => a + Math.max(0, +x.hrs || 0), 0)))}${k('Safety records', safe.length)}</div>
  <div class="card"><h3>Installed vs budget by SOV line</h3>${(P.sov || []).length ? `<div class="tscroll" tabindex="0" role="region" aria-label="Installed vs budget table"><table class="t money"><thead><tr><th scope="col">Line</th><th scope="col">Installed</th><th scope="col">%</th><th scope="col">EV</th><th scope="col">AC</th><th scope="col">CPI</th></tr></thead><tbody>${ev.lines.map(l => `<tr><td>${esc(l.item)}. ${esc(l.desc)}</td><td>${RHM.fmt(l.inst)} / ${RHM.fmt(l.qty)} ${esc(l.unit || '')}</td><td><div class="bar" role="img" aria-label="${l.pct}% installed"><i style="width:${Math.min(100, l.pct)}%"></i></div>${l.pct}%</td><td>${M(l.ev)}</td><td>${M(l.ac)}</td><td class="${l.cpi && l.cpi < 1 ? 'neg' : ''}">${l.cpi ?? '—'}</td></tr>`).join('')}</tbody></table></div>
    <details class="math"><summary>Show the math</summary><ul class="small">${ev.lines.map(l => `<li>${esc(l.item)}: ${esc(l.math)}</li>`).join('')}<li><b>${esc(ev.math)}</b></li></ul></details>` : emptyState('📋', 'No SOV yet', 'Add SOV lines to the project to track installed vs budget.')}
    ${ev.rfi.length ? `<p class="small bad">Needs a number: ${ev.rfi.slice(0, 5).map(esc).join('; ')}${ev.rfi.length > 5 ? ` … (+${ev.rfi.length - 5})` : ''}</p>` : ''}<p class="small muted">Installed qty from daily logs; actual cost from timecards (OT at 1.5×) + material receipts. Budget = SOV cost budget if entered, else contract value.</p></div>
  <div class="tiles">${[['rfis', '❓', 'RFI log'], ['subs', '📑', 'Submittals'], ['punch', '📌', 'Punch list'], ['time', '⏱', 'Timecards'], ['recv', '🚚', 'Receiving'], ['safety', '🦺', 'Safety'], ['weather', '🌧', 'Weather delays'], ['lookahead', '📅', '3-wk lookahead'], ['docs', '📂', 'Documents'], ['photos', '📷', 'Photo log'], ['revcmp', '🔀', 'Rev compare'], ['bid', '🧮', 'Bid tools'], ['orders', '🧾', 'Orders']].map(([r, i, t]) => `<button class="tile" data-go3="${r}"><span aria-hidden="true">${i}</span>${t}</button>`).join('')}</div>`;
  $$('[data-go3]').forEach(b => b.onclick = () => go(b.dataset.go3)); setPrimary(null); };

/* ---------- Delivery / material receiving log (rank 12) ---------- */
TITLES.recv = 'Receiving log'; TITLES.recv1 = 'Receipt';
ROUTES.recv = async () => { if (needProj()) return; const L = await ITEMS('recv'), sov = APP.project.sov || [], photos = await DB.where('photos', p => p.recvId);
  const code = id => { const s = sov.find(x => x.id === id); return s ? `${s.item}. ${s.desc}` : '— no SOV —'; };
  const tot = L.reduce((a, x) => a + (+x.amt || 0), 0), blank$ = L.filter(x => x.amt === '' || x.amt === null || x.amt === undefined).length;
  main().innerHTML = `<h2>Receiving log <small class="muted">${L.length} ticket(s) · ${M(tot)}</small></h2>
  ${blank$ ? `<p class="hint bad">${blank$} receipt(s) with blank $ — counted $0 and flagged for RFI. Never invent a price.</p>` : ''}
  ${L.length ? `<div class="list">${L.map(x => { const ph = photos.filter(f => f.recvId === x.id); return `<button class="li big" data-recv="${x.id}"><b>#${esc(x.ticket || x.no)} · ${esc(x.date || 'no date')}</b> <span class="tag">${esc(x.vendor || 'vendor?')}</span><small>${esc(code(x.sovId))} · qty ${esc(x.qty ?? '—')} · ${x.amt === '' || x.amt == null ? '$0 (blank → RFI)' : M(+x.amt)}${ph.length ? ' · 📷' : ''}</small></button>`; }).join('')}</div>
  <div class="row"><button class="btn wide" id="recvCSV">⬇ Export CSV</button><button class="btn wide" id="recvXLS">⬇ Export Excel</button></div>` : emptyState('🚚', 'No deliveries yet', 'Log ticket #, vendor, SOV cost code, qty and amount. Blank $ = $0 + RFI.')}`;
  $$('[data-recv]').forEach(b => b.onclick = () => go('recv1', b.dataset.recv));
  const recvRows = () => [['Ticket #', 'Date', 'Vendor', 'SOV / cost code', 'Qty', 'Unit', 'Amount $', 'Note', 'Photo?']].concat(L.map(x => [x.ticket || x.no, x.date || '', x.vendor || '', code(x.sovId), x.qty ?? '', x.unit || '', x.amt ?? '', x.note || '', photos.some(f => f.recvId === x.id) ? 'Y' : '']));
  const csvBtn = $('#recvCSV'); if (csvBtn) csvBtn.onclick = () => download(`Receiving_${safe(APP.project.name)}.csv`, new Blob([RHMF.toCSV(recvRows())], {type:'text/csv'}));
  const xlsBtn = $('#recvXLS'); if (xlsBtn) xlsBtn.onclick = () => downloadXlsx(`Receiving_${safe(APP.project.name)}.xlsx`, recvRows());
  setPrimary('➕ New receipt', async () => { const x = {id:uid(), projectId:APP.pid, kind:'recv', no:await nextNo('recv'), ticket:'', date:today(), vendor:'', sovId:'', qty:'', unit:'', amt:'', note:'', created:Date.now()}; await DB.put('items', x); go('recv1', x.id); }); };
ROUTES.recv1 = async id => { const x = await DB.get('items', id); if (!x) return go('recv'); const sov = APP.project.sov || [], save = () => DB.put('items', x), photos = await DB.where('photos', p => p.recvId === x.id);
  const blank = x.amt === '' || x.amt === null || x.amt === undefined;
  main().innerHTML = `<h2>Receipt ${esc(x.ticket || '#' + x.no)}</h2>
  <div class="card"><div class="grid2">${ffld('ticket', 'Ticket #', x.ticket)}${ffld('date', 'Date', x.date, 'date')}${ffld('vendor', 'Vendor', x.vendor)}
   <label class="fld"><span>SOV / cost code</span><select data-f="sovId"><option value="">— pick —</option>${sov.map(s => `<option value="${s.id}" ${s.id === x.sovId ? 'selected' : ''}>${esc(s.item)}. ${esc(s.desc)}</option>`).join('')}</select></label>
   ${ffld('qty', 'Qty received', x.qty, 'number', 'inputmode="decimal"')}${ffld('unit', 'Unit', x.unit)}${ffld('amt', 'Amount $ (blank = $0 + RFI)', x.amt, 'number', 'inputmode="decimal" step="any"')}</div>
   ${ffld('note', 'Note', x.note, 'area')}
   <p class="small mono">${blank ? 'Amount blank → counted $0 and flagged on the dashboard EV (AC).' : `AC contribution = ${M(+x.amt || 0)} on the linked SOV line.`}</p>
   <div class="photos">${photos.map(f => `<div class="ph"><img src="${f.thumb}" alt="Ticket photo"></div>`).join('')}</div>
   <div class="row"><label class="btn">📷 Ticket photo<input type="file" accept="image/*" capture="environment" id="recvPh" hidden></label><button class="btn danger" id="recvDel">Delete</button></div></div>`;
  bindF(x, save);
  $('#recvPh').onchange = async () => { const f = $('#recvPh').files[0]; if (!f) return; await savePhoto(f, {recvId:x.id, caption:'Ticket ' + (x.ticket || x.no)}); go('recv1', x.id); };
  $('#recvDel').onclick = async () => { if (!confirm('Delete this receipt?')) return; await DB.del('items', x.id); go('recv'); }; setPrimary(null); };

/* ---------- Safety: JHA / toolbox talk + incident (rank 14) ---------- */
TITLES.safety = 'Safety'; TITLES.safe1 = 'Safety record';
ROUTES.safety = async () => { if (needProj()) return; const L = await ITEMS('safety');
  const talks = L.filter(x => x.stype === 'talk'), incs = L.filter(x => x.stype === 'incident');
  main().innerHTML = `<h2>Safety</h2>
  <div class="card"><h3>Toolbox / JHA sign-in <small class="muted">${talks.length}</small></h3>
   ${talks.length ? `<div class="list">${talks.map(x => `<button class="li big" data-sf="${x.id}"><b>${esc(x.date || '—')} · ${esc(x.topic || '(no topic)')}</b><small>${(x.crew || []).length} signed in · ${esc(x.leader || '')}</small></button>`).join('')}</div>` : emptyState('🦺', 'No toolbox talks yet', 'Tap "New toolbox / JHA" — crew signs in with name + company.')}
   <button class="btn wide" id="sfTalk">➕ New toolbox / JHA</button></div>
  <div class="card"><h3>Incident reports <small class="muted">${incs.length}</small></h3>
   ${incs.length ? `<div class="list">${incs.map(x => `<button class="li big" data-sf="${x.id}"><b>${esc(x.date || '—')} · ${esc(x.who || '(who)')}</b> <span class="tag ${x.injury === 'Y' ? 'bad' : ''}">${x.injury === 'Y' ? 'Injury' : 'No injury'}</span><small>${esc((x.what || '').slice(0, 80))}</small></button>`).join('')}</div>` : emptyState('📋', 'No incidents logged', 'Document date, who, what, injury Y/N. Share / PDF / mailto only — never auto-send.')}
   <button class="btn wide" id="sfInc">➕ New incident</button></div>`;
  $$('[data-sf]').forEach(b => b.onclick = () => go('safe1', b.dataset.sf));
  $('#sfTalk').onclick = async () => { const x = {id:uid(), projectId:APP.pid, kind:'safety', stype:'talk', no:await nextNo('safety'), date:today(), topic:'', leader:'', crew:[], created:Date.now()}; await DB.put('items', x); go('safe1', x.id); };
  $('#sfInc').onclick = async () => { const x = {id:uid(), projectId:APP.pid, kind:'safety', stype:'incident', no:await nextNo('safety'), date:today(), who:'', what:'', injury:'N', created:Date.now()}; await DB.put('items', x); go('safe1', x.id); };
  setPrimary(null); };
ROUTES.safe1 = async id => { const x = await DB.get('items', id); if (!x) return go('safety'); const save = () => DB.put('items', x), photos = await DB.where('photos', p => p.safetyId === x.id);
  if (x.stype === 'talk') {
    main().innerHTML = `<h2>Toolbox / JHA</h2><div class="card"><div class="grid2">${ffld('date', 'Date', x.date, 'date')}${ffld('topic', 'Topic / JHA title', x.topic)}${ffld('leader', 'Led by', x.leader)}</div>
     ${ffld('notes', 'Talk notes (optional)', x.notes, 'area')}
     <h3>Crew sign-in</h3><div class="list" id="crewList">${(x.crew || []).map((c, i) => `<div class="grid3 lv"><input aria-label="Name" data-cr="${i}:name" value="${esc(c.name || '')}" placeholder="Name"><input aria-label="Company" data-cr="${i}:co" value="${esc(c.co || '')}" placeholder="Company"><button class="btn sm danger" data-crdel="${i}" aria-label="Remove">✕</button></div>`).join('') || '<p class="muted small">No one signed in yet.</p>'}</div>
     <button class="btn sm" id="crAdd">➕ Sign-in row</button>
     <div class="row" style="margin-top:12px"><button class="btn p" id="sfShare">✉ Email / share summary</button><button class="btn danger" id="sfDel">Delete</button></div></div>`;
    bindF(x, save);
    $$('[data-cr]').forEach(i => i.oninput = () => { const [n, k] = i.dataset.cr.split(':'); x.crew[+n][k === 'co' ? 'co' : 'name'] = i.value; clearTimeout(x._t); x._t = setTimeout(() => { delete x._t; save(); }, 350); });
    $$('[data-crdel]').forEach(b => b.onclick = async () => { x.crew.splice(+b.dataset.crdel, 1); await save(); go('safe1', x.id); });
    $('#crAdd').onclick = async () => { (x.crew ||= []).push({name:'', co:''}); await save(); go('safe1', x.id); };
    $('#sfShare').onclick = async () => { await save(); const body = `Toolbox / JHA — ${APP.project.name}\nDate: ${x.date}\nTopic: ${x.topic}\nLed by: ${x.leader}\n\nSign-in:\n${(x.crew || []).map(c => `- ${c.name || '?'} (${c.co || '—'})`).join('\n')}\n\n${x.notes || ''}\n\n${CO_INFO.person} · ${CO_INFO.name}`;
      openLink(mailto('', `Toolbox / JHA ${x.date} — ${APP.project.name}`, body)); };
  } else {
    main().innerHTML = `<h2>Incident report</h2><div class="card"><div class="grid2">${ffld('date', 'Date', x.date, 'date')}${ffld('who', 'Who was involved', x.who)}
     ${sel('injury', 'Injury?', x.injury || 'N', ['N', 'Y'])}${ffld('where', 'Where on site', x.where)}</div>
     ${ffld('what', 'What happened', x.what, 'area')}${ffld('action', 'Immediate action taken', x.action, 'area')}
     <div class="photos">${photos.map(f => `<div class="ph"><img src="${f.thumb}" alt="Incident photo"></div>`).join('')}</div>
     <div class="row"><label class="btn">📷 Photo<input type="file" accept="image/*" capture="environment" id="sfPh" hidden></label>
     <button class="btn p" id="sfShare">✉ Email / share</button><button class="btn danger" id="sfDel">Delete</button></div></div>`;
    bindF(x, save);
    $('#sfPh').onchange = async () => { const f = $('#sfPh').files[0]; if (!f) return; await savePhoto(f, {safetyId:x.id, caption:'Incident'}); go('safe1', x.id); };
    $('#sfShare').onclick = async () => { await save(); const body = `INCIDENT — ${APP.project.name}\nDate: ${x.date}\nWho: ${x.who}\nInjury: ${x.injury}\nWhere: ${x.where || '—'}\n\nWhat happened:\n${x.what}\n\nAction taken:\n${x.action || '—'}\n\n${CO_INFO.person} · ${CO_INFO.name}`;
      openLink(mailto('', `Incident ${x.date} — ${APP.project.name}`, body)); };
  }
  $('#sfDel').onclick = async () => { if (!confirm('Delete this safety record?')) return; await DB.del('items', x.id); go('safety'); }; setPrimary(null); };

/* ---------- Weather delay documentation (rank 15) ---------- */
TITLES.weather = 'Weather delays';
ROUTES.weather = async () => { if (needProj()) return; const L = await ITEMS('weather'), logs = await DB.where('logs', l => l.projectId === APP.pid);
  const hrs = L.reduce((a, x) => a + Math.max(0, +x.hrs || 0), 0); // v1.9.1: negative hours never reduce the documented total
  main().innerHTML = `<h2>Weather delays <small class="muted">${RHM.fmt(hrs)} hr documented</small></h2>
  ${L.length ? `<div class="list">${L.map(x => `<div class="card wx" data-wx="${x.id}"><div class="grid2"><label class="fld"><span>Date</span><input data-w="date" type="date" value="${esc(x.date || '')}"></label>
     <label class="fld"><span>Hours delayed</span><input data-w="hrs" type="number" inputmode="decimal" step="0.25" value="${x.hrs ?? ''}"></label></div>
     <label class="fld"><span>Weather note</span><textarea data-w="note" rows="2">${esc(x.note || '')}</textarea></label>
     <label class="fld"><span>Impact (crew / schedule / cost)</span><textarea data-w="impact" rows="2">${esc(x.impact || '')}</textarea></label>
     <p class="small muted">${x.fromLog ? 'Prefill from daily log Open-Meteo / typed weather.' : ''}</p>
     <div class="row"><button class="btn sm" data-wpre="${x.id}">🌤 Prefill from daily log</button><button class="btn sm danger" data-wdel="${x.id}">Delete</button></div></div>`).join('')}</div>
  <div class="row"><button class="btn wide" id="wxCSV">⬇ Export CSV</button><button class="btn wide" id="wxXLS">⬇ Export Excel</button></div>` : emptyState('🌧', 'No weather delays yet', 'Log date, hours delayed, weather note and impact. Prefill from a daily log when you have one.')}`;
  $$('[data-wx]').forEach(card => { const x = L.find(z => z.id === card.dataset.wx); card.querySelectorAll('[data-w]').forEach(i => i.oninput = () => { x[i.dataset.w] = i.value; clearTimeout(x._t); x._t = setTimeout(() => { delete x._t; DB.put('items', x); }, 350); }); });
  $$('[data-wpre]').forEach(b => b.onclick = async () => { const x = L.find(z => z.id === b.dataset.wpre); const hasWx = l => l && l.weather && (l.weather.cond || l.weather.hi != null || l.weather.note);
    const log = logs.find(l => l.date === x.date && hasWx(l)) || logs.find(l => l.date === today() && hasWx(l)) || logs.find(hasWx);
    if (!log) return toast('No daily log weather for that date — type the note');
    const w = log.weather; x.note = [w.cond, w.hi != null ? `Hi ${w.hi}°F` : '', w.lo != null ? `Lo ${w.lo}°F` : '', w.precip != null ? `Rain ${w.precip}"` : '', w.wind != null ? `Wind ${w.wind} mph` : '', w.src ? `(${w.src})` : ''].filter(Boolean).join(' · ');
    x.fromLog = true; if (!x.date) x.date = log.date; await DB.put('items', x); toast('Prefill from daily log'); go('weather'); });
  $$('[data-wdel]').forEach(b => b.onclick = async () => { await DB.del('items', b.dataset.wdel); go('weather'); });
  const wxRows = () => [['Date', 'Hours delayed', 'Weather note', 'Impact']].concat(L.map(x => [x.date || '', x.hrs ?? '', x.note || '', x.impact || '']));
  const csv = $('#wxCSV'); if (csv) csv.onclick = () => download(`WeatherDelays_${safe(APP.project.name)}.csv`, new Blob([RHMF.toCSV(wxRows())], {type:'text/csv'}));
  const wxX = $('#wxXLS'); if (wxX) wxX.onclick = () => downloadXlsx(`WeatherDelays_${safe(APP.project.name)}.xlsx`, wxRows());
  setPrimary('➕ Add delay day', async () => { await DB.put('items', {id:uid(), projectId:APP.pid, kind:'weather', no:await nextNo('weather'), date:today(), hrs:'', note:'', impact:'', created:Date.now()}); go('weather'); }); };

/* ---------- 3-week lookahead schedule (rank 18) ---------- */
TITLES.lookahead = '3-week lookahead'; Object.defineProperty(TITLES, 'look1', {get:() => term('One'), configurable:true});
ROUTES.lookahead = async (start) => { if (needProj()) return;
  const startMon = RHMF.weekStartMonday(start || APP.lookStart || today()); APP.lookStart = startMon;
  const L = await ITEMS('look'), sov = APP.project.sov || [];
  const cal = RHMF.lookaheadDays(startMon, 21);
  const end = cal[20] && cal[20].date;
  const code = id => { const s = sov.find(x => x.id === id); return s ? `${s.item}. ${s.desc}` : ''; };
  const hrsFor = d => L.filter(x => x.date === d).reduce((a, x) => a + Math.max(0, +x.hrs || 0), 0);
  const dayParts = cal.map(d => ({label:d.dow, date:d.date, hrs:hrsFor(d.date)}));
  const weekMath = [1, 2, 3].map(w => {
    const slice = dayParts.filter((_, i) => Math.floor(i / 7) + 1 === w);
    const h = RHMF.lookaheadWeekHours(slice);
    return {w, ...h};
  });
  const allH = RHMF.lookaheadWeekHours(dayParts);
  main().innerHTML = `<h2>3-week lookahead <small class="muted">${startMon} → ${end || ''}</small></h2>
  <div class="row"><label class="fld grow"><span>Week starts Monday</span><input type="date" id="lookStart" value="${startMon}"></label>
   <button class="btn" id="lookPrev" aria-label="Previous 3 weeks">◀</button><button class="btn" id="lookNext" aria-label="Next 3 weeks">▶</button></div>
  ${L.length ? `<div class="tscroll" tabindex="0" role="region" aria-label="Lookahead schedule"><table class="t money"><thead><tr><th scope="col">Day</th><th scope="col">${term('One')}</th><th scope="col">Crew</th><th scope="col">Location</th><th scope="col">Duration hrs</th><th scope="col">Done?</th><th scope="col"><span class="sr-only">Delete</span></th></tr></thead><tbody>
  ${cal.map(d => { const acts = L.filter(x => x.date === d.date); if (!acts.length) return `<tr class="muted"><td><b>${esc(d.dow)}</b><br><small>${esc(d.date)}</small></td><td colspan="6"><button class="btn sm" data-lookadd="${d.date}">➕ Add ${term('one')}</button></td></tr>`;
    return acts.map((x, i) => `<tr data-look="${x.id}"><td>${i ? '' : `<b>${esc(d.dow)}</b><br><small>${esc(d.date)}</small>`}</td>
      <td><button class="btn ghost sm" data-lookopen="${x.id}">${esc(x.activity || '(' + term('one') + ')')}</button></td>
      <td>${esc(x.crew || '—')}</td><td>${esc(x.loc || '—')}</td><td>${+x.hrs < 0 ? 'ignored (negative)' : RHM.fmt(+x.hrs || 0)}</td>
      <td>${x.done === 'Y' ? '✔' : '—'}</td><td><button class="btn sm danger" data-lookdel="${x.id}" aria-label="Delete ${esc(x.activity || term('one'))}">✕</button></td></tr>`).join('');
  }).join('')}
  </tbody></table></div>
  <div class="card"><h3>Hours summary</h3>
   ${weekMath.map(w => `<p class="small mono"><b>Week ${w.w}:</b> ${esc(w.math)}</p>`).join('')}
   <p class="small mono"><b>21 days:</b> ${esc(allH.math)}</p>
   <button class="btn wide" id="lookCSV">⬇ Export CSV</button><button class="btn wide" id="lookXLS">⬇ Export Excel</button></div>` : emptyState('📅', `No ${term('many')} yet`, `Tap "Add ${term('one')}" for a day in the next 3 weeks. Nothing is prefilled — add real work only.`)}`;
  $('#lookStart').onchange = e => go('lookahead', RHMF.weekStartMonday(e.target.value));
  $('#lookPrev').onclick = () => { const d = new Date(startMon + 'T00:00:00'); d.setDate(d.getDate() - 21); go('lookahead', d.toLocaleDateString('en-CA')); };
  $('#lookNext').onclick = () => { const d = new Date(startMon + 'T00:00:00'); d.setDate(d.getDate() + 21); go('lookahead', d.toLocaleDateString('en-CA')); };
  $$('[data-lookadd]').forEach(b => b.onclick = async () => { const x = {id:uid(), projectId:APP.pid, kind:'look', no:await nextNo('look'), date:b.dataset.lookadd, activity:'', crew:'', loc:'', hrs:'', done:'N', sovId:'', created:Date.now()}; await DB.put('items', x); go('look1', x.id); });
  $$('[data-lookopen]').forEach(b => b.onclick = () => go('look1', b.dataset.lookopen));
  $$('[data-lookdel]').forEach(b => b.onclick = async () => { if (!confirm(`Delete this ${term('one')}?`)) return; await DB.del('items', b.dataset.lookdel); go('lookahead', startMon); });
  const lookRows = () => [['Date', 'Day', term('One'), 'Crew', 'Location', 'Duration hrs', 'Done', 'SOV / cost code', 'Notes']].concat(L.map(x => { const d = cal.find(c => c.date === x.date); return [x.date || '', (d && d.dow) || '', x.activity || '', x.crew || '', x.loc || '', x.hrs ?? '', x.done || 'N', code(x.sovId), x.notes || '']; }));
  const csv = $('#lookCSV'); if (csv) csv.onclick = () => download(`Lookahead_${startMon}_${safe(APP.project.name)}.csv`, new Blob([RHMF.toCSV(lookRows())], {type:'text/csv'}));
  const lookX = $('#lookXLS'); if (lookX) lookX.onclick = () => downloadXlsx(`Lookahead_${startMon}_${safe(APP.project.name)}.xlsx`, lookRows());
  setPrimary(`➕ Add ${term('one')}`, async () => { const x = {id:uid(), projectId:APP.pid, kind:'look', no:await nextNo('look'), date:startMon, activity:'', crew:'', loc:'', hrs:'', done:'N', sovId:'', created:Date.now()}; await DB.put('items', x); go('look1', x.id); }); };
ROUTES.look1 = async id => { const x = await DB.get('items', id); if (!x) return go('lookahead'); const sov = APP.project.sov || [], save = () => DB.put('items', x);
  main().innerHTML = `<h2>${term('One')}</h2><div class="card">
   ${ffld('date', 'Day', x.date, 'date')}${ffld('activity', term('One'), x.activity)}
   <div class="grid2">${ffld('crew', 'Crew', x.crew)}${ffld('loc', 'Location', x.loc)}
    ${ffld('hrs', 'Duration hrs', x.hrs, 'number', 'inputmode="decimal" step="0.25"')}${sel('done', 'Done?', x.done || 'N', ['N', 'Y'])}</div>
   <label class="fld"><span>SOV / cost code (optional)</span><select data-f="sovId"><option value="">— none —</option>${sov.map(s => `<option value="${s.id}" ${s.id === x.sovId ? 'selected' : ''}>${esc(s.item)}. ${esc(s.desc)}</option>`).join('')}</select></label>
   ${ffld('notes', 'Notes', x.notes, 'area')}</div>
  <div class="row"><button class="btn" id="lookBack">← Schedule</button><button class="btn danger" id="lookDel">Delete</button></div>`;
  bindF(x, save); $('#lookBack').onclick = () => go('lookahead', RHMF.weekStartMonday(x.date || APP.lookStart || today()));
  $('#lookDel').onclick = async () => { if (!confirm(`Delete this ${term('one')}?`)) return; await DB.del('items', x.id); go('lookahead'); }; setPrimary(null); };

/* ---------- Document control + addenda (rank 19) ---------- */
const DOC_ST = ['Current', 'Superseded', 'Void'];
const DOC_TYPE = ['Drawing', 'Spec', 'Addendum', 'Transmittal', 'Other'];
TITLES.docs = 'Document control'; TITLES.doc1 = 'Document';
ROUTES.docs = async (filter) => { if (needProj()) return; filter = filter || APP.docFilter || 'all'; APP.docFilter = filter;
  const all = await ITEMS('doc');
  const L = filter === 'current' ? all.filter(x => x.status === 'Current') : filter === 'addenda' ? all.filter(x => x.type === 'Addendum') : filter === 'xmit' ? all.filter(x => x.type === 'Transmittal') : all;
  const curN = all.filter(x => x.status === 'Current').length;
  main().innerHTML = `<h2>Document control <small class="muted">${curN} current</small></h2>
  <div class="seg wrap" role="tablist" aria-label="Doc filters">${[['all','All'],['current','Current set'],['addenda','Addenda'],['xmit','Transmittals']].map(([k,l]) => `<button role="tab" aria-selected="${k===filter}" class="${k===filter?'on':''}" data-df="${k}">${l}</button>`).join('')}</div>
  ${L.length ? `<div class="list">${L.map(x => `<button class="li big" data-doc="${x.id}"><b>${esc(x.docNo || '#'+x.no)} · ${esc(x.title || '(no title)')}</b> <span class="tag ${x.status==='Current'?'ok':x.status==='Void'?'bad':''}">${esc(x.status||'')}</span><small>${esc(x.type||'')} rev ${esc(x.rev||'—')}${x.cite?' · '+esc(x.cite):''}${x.issued?' · '+esc(x.issued):''}${x.type==='Addendum'&&x.bic?' · ball: '+esc(x.bic):''}</small></button>`).join('')}</div>
  <div class="row"><button class="btn wide" id="docCSV">⬇ Export CSV</button><button class="btn wide" id="docXLS">⬇ Export Excel</button></div>` : emptyState('📂', 'No documents yet', 'Log drawings, specs, addenda and transmittals. Mark Current when a rev replaces an older one.')}`;
  $$('[data-df]').forEach(b => b.onclick = () => go('docs', b.dataset.df));
  $$('[data-doc]').forEach(b => b.onclick = () => go('doc1', b.dataset.doc));
  const docRows = () => [['Doc #', 'Title', 'Rev', 'Status', 'Type', 'Sheet/Spec cite', 'Issued', 'Supersedes', 'Ball in court', 'To', 'Notes']].concat(all.map(x => [x.docNo||x.no, x.title||'', x.rev||'', x.status||'', x.type||'', x.cite||'', x.issued||'', x.supersedes||'', x.bic||'', x.to||'', x.notes||'']));
  const csv = $('#docCSV'); if (csv) csv.onclick = () => download(`Docs_${safe(APP.project.name)}.csv`, new Blob([RHMF.toCSV(docRows())], {type:'text/csv'}));
  const docX = $('#docXLS'); if (docX) docX.onclick = () => downloadXlsx(`Docs_${safe(APP.project.name)}.xlsx`, docRows());
  setPrimary('➕ New document', async () => { const typ = filter === 'addenda' ? 'Addendum' : filter === 'xmit' ? 'Transmittal' : 'Drawing';
    const x = {id:uid(), projectId:APP.pid, kind:'doc', no:await nextNo('doc'), docNo:'', title:'', rev:'', status:'Current', type:typ, cite:'', issued:today(), supersedes:'', bic: typ === 'Addendum' || typ === 'Transmittal' ? 'Us' : '', to:'', notes:'', sentDocs:'', created:Date.now()}; await DB.put('items', x); go('doc1', x.id); }); };
ROUTES.doc1 = async id => { const x = await DB.get('items', id); if (!x) return go('docs'); const save = () => DB.put('items', x), all = await ITEMS('doc');
  const isXmit = x.type === 'Transmittal', isAdd = x.type === 'Addendum';
  main().innerHTML = `<h2>${esc(x.docNo || 'Doc '+x.no)}</h2><div class="card">
   <div class="grid2">${ffld('docNo', 'Doc #', x.docNo)}${ffld('title', isAdd ? 'Summary' : 'Title', x.title)}
    ${ffld('rev', 'Rev', x.rev)}${sel('status', 'Status', x.status || 'Current', DOC_ST)}
    ${sel('type', 'Type', x.type || 'Drawing', DOC_TYPE)}${ffld('cite', 'Sheet / Spec cite', x.cite)}
    ${ffld('issued', 'Issued date', x.issued, 'date')}${ffld('supersedes', 'Supersedes (doc #)', x.supersedes)}
    ${isAdd || isXmit ? sel('bic', 'Ball in court', x.bic || 'Us', BIC) : ''}${isXmit ? ffld('to', 'Sent to', x.to) : ''}</div>
   ${isXmit ? ffld('sentDocs', 'Docs sent (list Doc #s)', x.sentDocs, 'area') : ''}
   ${ffld('notes', 'Notes', x.notes, 'area')}</div>
  <div class="row">${isXmit ? '<button class="btn p" id="docMail">✉ Email transmittal summary</button>' : ''}<button class="btn" id="docBack">← Log</button><button class="btn danger" id="docDel">Delete</button></div>`;
  const maybeSupersede = async () => {
    if (x.status !== 'Current' || !String(x.docNo || '').trim()) return;
    const priors = (await ITEMS('doc')).filter(z => z.id !== x.id && (z.docNo || '') === x.docNo && z.status === 'Current');
    if (!priors.length) return;
    if (!confirm(`Mark ${priors.length} prior Current rev(s) of Doc # ${x.docNo} as Superseded?`)) return;
    for (const z of priors) { z.status = 'Superseded'; await DB.put('items', z); }
    x.supersedes = x.supersedes || priors.map(z => z.rev ? `${z.docNo} rev ${z.rev}` : z.docNo).join(', ');
    await save();
  };
  $$('[data-f]').forEach(i => { const ev = i.tagName === 'SELECT' ? 'onchange' : 'oninput'; i[ev] = async () => {
    const k = i.dataset.f, prev = x[k]; x[k] = i.value;
    if (k === 'type') { await save(); return go('doc1', x.id); }
    if (k === 'status' && x.status === 'Current' && prev !== 'Current') { await save(); await maybeSupersede(); return; }
    clearTimeout(x._t); x._t = setTimeout(() => { delete x._t; save(); }, 350);
  }; });
  // v1.9.1: Doc # supersede check runs when the field is committed (blur / Enter), not on each keystroke -
  // typing "S-201" used to ask to supersede Doc "S" after the first letter.
  const dn = $('[data-f=docNo]'); if (dn) dn.onchange = async () => { x.docNo = dn.value; clearTimeout(x._t); delete x._t; await save(); await maybeSupersede(); };
  const mail = $('#docMail'); if (mail) mail.onclick = async () => { await save(); const body = `TRANSMITTAL — ${APP.project.name}\nDate: ${x.issued || today()}\nTo: ${x.to || ''}\nDoc #: ${x.docNo || x.no}\n\nDocuments sent:\n${x.sentDocs || x.title || '(list docs)'}\n\nNotes:\n${x.notes || '—'}\n\n${CO_INFO.person} · ${CO_INFO.name} · ${CO_INFO.direct}`;
    openLink(mailto(x.to, `Transmittal ${x.docNo || x.no} — ${APP.project.name}`, body)); };
  $('#docBack').onclick = () => go('docs', APP.docFilter); $('#docDel').onclick = async () => { if (!confirm('Delete this document?')) return; await DB.del('items', x.id); go('docs'); }; setPrimary(null); };

/* ---------- Photo log with GPS/time stamp (rank 20) ---------- */
TITLES.photos = 'Photo log';
const phSrc = p => p.logKind === 'plog' ? 'Photo log' : p.punchId ? 'Punch' : p.logId ? 'Daily log' : p.recvId ? 'Receiving' : p.safetyId ? 'Safety' : p.payId ? 'Pay app' : 'Other';
ROUTES.photos = async (view) => { if (needProj()) return; view = view || APP.phView || 'log'; APP.phView = view;
  const photos = (await DB.where('photos', p => p.projectId === APP.pid && (view === 'all' || p.logKind === 'plog'))).sort((a, b) => (b.created || 0) - (a.created || 0));
  main().innerHTML = `<h2>Photo log <small class="muted">${photos.length}</small></h2>
  <div class="seg wrap" role="tablist" aria-label="Photo filter">${[['log', 'Photo log'], ['all', 'All field photos']].map(([k, l]) => `<button role="tab" aria-selected="${k === view}" class="${k === view ? 'on' : ''}" data-phv="${k}">${l}</button>`).join('')}</div>
  <p class="small muted">Every field photo (photo log, punch, daily log, receiving, safety, pay-app backup) gets the same stamp burned onto the image before it is saved: project, CT time and GPS if allowed — otherwise "GPS denied" / "no GPS". Coordinates are never made up.</p>
  ${photos.length ? `<div class="photos plog">${photos.map(p => { const lab = (view === 'all' ? phSrc(p) + ': ' : '') + (p.stampText || p.caption || p.date || 'Photo'); return `<button class="ph big" data-ph="${p.id}" aria-label="${esc(lab)}"><img src="${p.thumb}" alt=""><small>${esc(lab)}</small></button>`; }).join('')}</div>
  <div class="row"><button class="btn wide" id="phCSV">⬇ Export meta CSV</button><button class="btn wide" id="phXLS">⬇ Export meta Excel</button></div>` : emptyState('📷', 'No stamped photos yet', 'Take or upload a photo. GPS is optional — if denied, the stamp still shows time and "GPS denied".')}
  <div class="row" style="margin-top:12px"><label class="btn p xl">📷 Take photo<input type="file" accept="image/*" capture="environment" id="phCam" hidden></label>
   <label class="btn xl">🖼 Gallery<input type="file" accept="image/*" multiple id="phGal" hidden></label></div>
  <div id="phView" class="phview" hidden></div>`;
  $$('[data-phv]').forEach(b => b.onclick = () => go('photos', b.dataset.phv));
  const add = async files => { for (const f of files) { const cap = prompt('Caption (optional)?', '') || ''; await saveStampedPhoto(f, {caption:cap, logKind:'plog'}); } go('photos', 'log'); };
  $('#phCam').onchange = e => e.target.files[0] && add(e.target.files);
  $('#phGal').onchange = e => e.target.files.length && add(e.target.files);
  $$('[data-ph]').forEach(b => b.onclick = async () => {
    const ph = photos.find(x => x.id === b.dataset.ph); if (!ph) return;
    const url = ph.blob ? URL.createObjectURL(ph.blob) : ph.thumb;
    const v = $('#phView'); v.hidden = false; v.innerHTML = `<div class="card"><img src="${url}" alt="Full photo" style="max-width:100%"><p class="small">${esc(ph.stampText || '')}</p>
      <div class="row"><button class="btn danger" id="phDel">Delete</button><button class="btn" id="phClose">Close</button></div></div>`;
    $('#phClose').onclick = () => { v.hidden = true; v.innerHTML = ''; };
    $('#phDel').onclick = async () => { if (!confirm('Delete this photo?')) return; await DB.del('photos', ph.id); go('photos', view); };
  });
  const phRows = () => [['Date', 'Stamped at (ISO)', 'Source', 'Caption', 'Lat', 'Lon', 'GPS', 'Sheet', 'Stamp text']].concat(photos.map(p => [p.date||'', p.stampedAt||'', phSrc(p), p.caption||'', p.lat ?? '', p.lon ?? '', p.lat != null ? 'ok' : p.gpsNote || (p.gpsOk === false ? 'GPS denied' : p.stampText ? '' : 'not stamped (pre-v1.9.1)'), p.sheet||'', p.stampText||'']));
  const csv = $('#phCSV'); if (csv) csv.onclick = () => download(`PhotoLog_${safe(APP.project.name)}.csv`, new Blob([RHMF.toCSV(phRows())], {type:'text/csv'}));
  const phX = $('#phXLS'); if (phX) phX.onclick = () => downloadXlsx(`PhotoLog_${safe(APP.project.name)}.xlsx`, phRows());
  setPrimary(null); };
