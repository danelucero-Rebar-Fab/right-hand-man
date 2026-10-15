/* Right Hand Man v1.3 - usability layer: nav (bottom bar on phones, sidebar on tablets), quick-add, continue where you left off,
   global search, inline help + friendly validation on every field, number keypads, feet-inch helper, swipe-to-delete with undo,
   autosave indicator, haptics, voice notes, skeleton screens, empty states. No prices or quantities are created here. */
'use strict';
// a tap that removes its own overlay must not let the browser's synthesized click land on the screen underneath
function noGhost(el, fn) { let t = 0; el.addEventListener('touchend', e => { e.preventDefault(); t = Date.now(); fn(e); }); el.addEventListener('click', e => { if (Date.now() - t > 600) fn(e); }); }
const buzz = (ms = 10) => { try { if (SET.haptics !== false && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
const SKELETON = `<div class="skel" aria-hidden="true"><i class="s1"></i><i></i><i></i><i class="s2"></i><i></i></div><span class="sr">Loading…</span>`;
const emptyState = (icon, title, text) => `<div class="empty"><div class="ei" aria-hidden="true">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;

/* ---------- nav ---------- */
const NAV_MORE = ['co', 'shop', 'standards', 'projects', 'settings', 'costs', 'about', 'search', 'trench', 'project', 'client'];
function navSync(route) { const nav = $('#nav'); if (!nav) return; if (nav.classList.contains('open')) setTimeout(() => nav.classList.remove('open'), 350); const mb = $('[data-nav=more]'); mb && mb.setAttribute('aria-expanded', 'false');
  $$('#nav [data-nav]').forEach(b => { const on = b.dataset.nav === route; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
  if (mb) mb.classList.toggle('on', NAV_MORE.includes(route) && innerWidth < 768); }
$$('#nav [data-nav]').forEach(b => noGhost(b, () => { buzz(); const r = b.dataset.nav;
  if (r === 'more') { const o = $('#nav').classList.toggle('open'); b.setAttribute('aria-expanded', String(o)); if (o) $('.navx button').focus(); return; } go(r); }));
addEventListener('keydown', e => { if (e.key === 'Escape') { $('#nav').classList.remove('open'); closeQuick(); } });

/* ---------- quick add (+) ---------- */
const QUICK = [['📁', 'New project', () => go('project', 'quick')], ['📐', 'Add a plan sheet', async () => { await go('plans'); const g = $('#gal'); g && g.click(); }],
  ['📏', 'Measure a length', () => { PL.tool = 'len'; PL.pts = []; go('plans'); }], ['🧮', 'Takeoff line', () => go('takeoff', {wizard:true})], ['📋', "Today's daily log", () => openToday()],
  ['💵', 'Pay app', () => go('payapp')], ['🔩', 'Rebar quote', () => { if (!needProject()) newCO('rebar'); }], ['📝', 'Change order', () => { if (!needProject()) newCO('co'); }],
  ['⏱', 'T&M ticket', () => { if (!needProject()) newCO('tm'); }], ['🖨', 'Shop drawings', () => go('shop')], ['🔎', 'Search everything', () => go('search')]];
function openQuick() { closeQuick(); buzz(); const d = document.createElement('div'); d.id = 'qa'; d.innerHTML = `<div class="qbg" data-qx></div><div class="qsheet" role="dialog" aria-modal="true" aria-labelledby="qaT"><h2 id="qaT">Quick add</h2>
  <div class="qgrid">${QUICK.map(([i, t], k) => `<button data-q="${k}"><span aria-hidden="true">${i}</span>${t}</button>`).join('')}</div><button class="btn wide" data-qx>Close</button></div>`;
  document.body.append(d); d.querySelectorAll('[data-qx]').forEach(b => noGhost(b, closeQuick)); d.querySelectorAll('[data-q]').forEach(b => noGhost(b, () => { d.classList.add('closing'); QUICK[+b.dataset.q][2](); setTimeout(closeQuick, 350); }));
  d.querySelector('[data-q]').focus(); $('#fab').setAttribute('aria-expanded', 'true'); }
function closeQuick() { const d = $('#qa'); if (d) { d.remove(); $('#fab').setAttribute('aria-expanded', 'false'); } }
$('#fab').onclick = openQuick;

/* ---------- continue where you left off + recent projects ---------- */
const PLACE_LABEL = {plans:'Plans', takeoff:'Takeoff', daily:'Daily log', payapp:'Pay app', co:'Change order / quote', shop:'Shop drawings', trench:'Trench safety'};
function rememberPlace(route, arg) { if (!PLACE_LABEL[route] || !APP.pid) return; const a = arg && arg.id ? {id:arg.id, step:arg.step} : null;
  localStorage.setItem('rhm_last', JSON.stringify({pid:APP.pid, route, arg:a, t:Date.now()})); }
const lastPlace = () => { try { return JSON.parse(localStorage.getItem('rhm_last') || 'null'); } catch (e) { return null; } };
async function continuePlace() { const L = lastPlace(); if (!L) return; if (L.pid !== APP.pid) { if (!(await DB.get('projects', L.pid))) return toast('That project was deleted'); await setProject(L.pid); } go(L.route, L.arg || undefined); }
async function homeTop(ps) { const L = lastPlace(), lp = L && ps.find(p => p.id === L.pid), rec = ps.slice(0, 3);
  return `${lp ? `<button class="card cont" id="contBtn"><span class="ci" aria-hidden="true">▶</span><span class="grow"><small>Continue where you left off</small><b>${esc(PLACE_LABEL[L.route])} · ${esc(lp.name)}</b><small>${new Date(L.t).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}</small></span></button>` : ''}
  ${rec.length > 1 ? `<h3>Recent projects</h3><div class="recent">${rec.map(p => `<button class="li ${p.id === APP.pid ? 'on' : ''}" data-recent="${p.id}" ${p.id === APP.pid ? 'aria-current="true"' : ''}><b>${p.type && p.type !== 'general' ? ptype(p).icon + ' ' : ''}${esc(p.name)}</b><small>${esc(p.no || '')} ${esc(p.location || '')}</small></button>`).join('')}<button class="li" data-go="project" id="newProjHome"><b>➕ New project</b><small>Step by step</small></button></div>` : ''}`; }
function homeBind() { const c = $('#contBtn'); if (c) c.onclick = continuePlace; $$('[data-recent]').forEach(b => b.onclick = async () => { buzz(); await setProject(b.dataset.recent); toast('Switched project'); go('home'); });
  const n = $('#newProjHome'); if (n) n.onclick = e => { e.stopImmediatePropagation(); go('project', 'quick'); }; }

/* ---------- recent takeoff templates ---------- */
const recentTpls = () => { try { return JSON.parse(localStorage.getItem('rhm_rtpl') || '[]'); } catch (e) { return []; } };
const pushRecentTpl = k => localStorage.setItem('rhm_rtpl', JSON.stringify([k, ...recentTpls().filter(x => x !== k)].slice(0, 4)));

/* ---------- global search ---------- */
ROUTES.search = async () => { main().innerHTML = `<h2>Search everything</h2><input id="gq" type="search" class="search" enterkeyhint="search" aria-label="Search projects, sheets, takeoff lines, logs, change orders and standards" placeholder="🔎 Job, sheet no., line, CO, standard…" value="${esc(APP.gq || '')}"><div id="gres" aria-live="polite"></div>`;
  const run = async () => { const q = (APP.gq || '').trim().toLowerCase(), out = $('#gres'); if (q.length < 2) { out.innerHTML = emptyState('🔎', 'Type at least 2 letters', 'Searches every project: names, sheet numbers, takeoff lines, daily logs, quotes / COs, pay apps and standards.'); return; }
    const has = (...v) => v.some(x => String(x ?? '').toLowerCase().includes(q)), [ps, sh, tk, lg, cs, pa, sd] = await Promise.all(['projects', 'sheets', 'takeoff', 'logs', 'cos', 'payapps'].map(s => DB.all(s)).concat([loadStd()]));
    const pn = id => (ps.find(p => p.id === id) || {}).name || '';
    const G = [['Projects', ps.filter(p => has(p.name, p.no, p.location, p.owner, p.gc)).map(p => [p.name, [p.no, p.location].filter(Boolean).join(' · '), `p:${p.id}`])],
      ['Plan sheets', sh.filter(s => has(s.sheetNo, s.name, s.srcName)).map(s => [`${s.sheetNo || s.name} (PDF p.${s.page})`, pn(s.projectId), `s:${s.id}`])],
      ['Takeoff lines', tk.filter(t => has(t.desc, t.sheet, t.spec, (RHM.T[t.tpl] || {}).name)).map(t => [t.desc || (RHM.T[t.tpl] || {}).name, `${pn(t.projectId)} · Sheet ${t.sheet || '—'}`, `t:${t.id}`])],
      ['Daily logs', lg.filter(l => has(l.date, l.notes, l.delays, l.foreman)).map(l => [`Log ${l.date}`, `${pn(l.projectId)} · ${(l.notes || '').slice(0, 60)}`, `l:${l.id}`])],
      ['Quotes / COs', cs.filter(c => has(c.no, c.title, c.reason)).map(c => [`${c.no} ${c.title || ''}`, pn(c.projectId), `c:${c.id}`])],
      ['Pay apps', pa.filter(a => has('pay app ' + a.no, a.periodTo)).map(a => [`Pay App #${a.no}`, `${pn(a.projectId)} · to ${a.periodTo}`, `a:${a.id}`])],
      ['Standards', sd.items.filter(i => has(i.code, i.title, i.summary, i.agency)).slice(0, 12).map(i => [`${i.agency} ${i.code} - ${i.title}`, i.summary.slice(0, 80) + '…', `d:${i.id}`])]].filter(g => g[1].length);
    out.innerHTML = G.length ? G.map(([h, xs]) => `<h3>${h} <small class="muted">(${xs.length})</small></h3><div class="list">${xs.slice(0, 25).map(([t, s, k]) => `<button class="li big" data-hit="${k}"><b>${esc(t)}</b><small>${esc(s)}</small></button>`).join('')}</div>`).join('') : emptyState('🤷', `Nothing matches "${APP.gq}"`, 'Try a sheet number like S-201, a job name, or a word from a log.');
    $$('[data-hit]').forEach(b => b.onclick = async () => { const [k, id] = b.dataset.hit.split(':'), rec = {p:ps, s:sh, t:tk, l:lg, c:cs, a:pa}[k], r = rec && rec.find(x => x.id === id);
      if (k === 'd') { APP.stdQ = (sd.items.find(i => i.id === id) || {}).code || APP.gq; APP.stdTy = 'all'; APP.stdAg = 'All'; return go('standards'); }
      const pid = k === 'p' ? id : r.projectId; if (pid !== APP.pid) await setProject(pid);
      if (k === 'p') return go('home'); if (k === 's') { PL.cur = null; PL.curId = id; return go('plans'); } if (k === 't') return go('takeoff', {wizard:true, line:r});
      if (k === 'l') return go('daily', {id}); if (k === 'c') return go('co', {id}); if (k === 'a') return go('payapp', {id}); }); };
  const i = $('#gq'); i.oninput = () => { APP.gq = i.value; clearTimeout(APP.gqT); APP.gqT = setTimeout(run, 180); }; run(); i.focus(); };

/* ---------- autosave indicator ---------- */
{ const put = DB.put; let t; DB.put = async (s, v) => { const el = $('#saved'); if (s !== 'kv' && el) { el.textContent = 'Saving…'; el.className = 'saved on'; }
  const r = await put(s, v); if (s !== 'kv' && el) { el.textContent = '✓ Saved'; clearTimeout(t); t = setTimeout(() => { el.className = 'saved'; }, 1600); } return r; }; }

/* ---------- haptics on main actions ---------- */
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#primary, .tile, .qgrid button, [data-tool], .li.big')) buzz(8); }, true);

/* ---------- inline help, validation, keypads, feet-inch, voice ---------- */
const HELP = { name:'What you and the GC call this job. Shows on every PDF.', no:'Contract, job or PO number from the contract. Optional.', location:'City, street or site. Optional.', owner:'The project owner (city, operator, developer).', gc:'Who you send pay apps to.',
  contractDate:'Date on the signed contract or subcontract.', desc:'A short name for this line, e.g. "Wet well wall, east face". Shows on the takeoff PDF.', sheet:'Sheet number from the title block, e.g. S-201. Required for every line.',
  page:'Page number inside the PDF file (not the sheet number).', spec:'Spec section or standard, e.g. 03 20 00 or TxDOT Item 440.', schedQty:'If the plans list a quantity, type it. The app carries the higher of plan and calculated.',
  date:'The work day this log covers.', foreman:'Who ran the crew today.', notes:'What got built, where. Tap 🎤 to talk instead of typing.', delays:'Weather, waiting on others, extra work, visitors, safety. Write it the same day - it backs up change orders.',
  no_pa:'Pay application number. Goes up by one each period.', periodTo:'Last day of the billing period.', title:'A short title the GC will recognize.', to:'Email for the GC/owner contact. Nothing is sent until you tap Email or Share.', attn:'Person to address.',
  depth:'Grade to trench bottom, in feet.', width:'Trench bottom width from the detail, in feet.', lf:'Length of trench at this depth, for the pay quantity.', boxRated:"From the box maker's tabulated data for this soil type.", boxHeight:'Total stacked box height.', boxLen:'Box length.', pipeLen:'Pipe stick length - the box must be at least this long.',
  sheetNo:'Sheet number from the title block, used for citations.', fore:'Fills the foreman box on new daily logs.', burden:'Payroll taxes, insurance and benefits added to labor on T&M.' };
function helpFor(inp, label) { const k = inp.dataset.k || inp.dataset.r || inp.dataset.tf || inp.id || '', ft = inp.hasAttribute('data-ftin');
  if (inp.dataset.p !== undefined) return `From the plans: ${label.replace(/\s*\(.*\)$/, '')}. Leave it blank if the plans don't show it - it becomes an RFI, never a guess.${ft ? ` Feet-inches like 12'-6" or decimals like 12.5 both work.` : ''}`;
  if (HELP[k]) return HELP[k] + (ft ? ` Feet-inches like 12'-6" work.` : '');
  if (inp.dataset.r) return 'Your own rate. It is used only where you see it in the math.';
  if (inp.type === 'date') return 'Pick a date.'; if (inp.tagName === 'SELECT') return `Pick one: ${label}.`;
  if (inp.type === 'number' || inp.inputMode === 'decimal' || inp.inputMode === 'numeric') return `Numbers only. ${/\$/.test(label) ? 'Dollars, no $ sign needed.' : ''} Leave blank if you don't know - nothing is guessed.`;
  return `Type the ${label.toLowerCase()} the way it reads on the plans or contract.`; }
function validate(inp) { const w = inp.closest('.fldw'), m = w && w.querySelector('.vmsg'); if (!m) return; const v = inp.value.trim(); let msg = '', okTxt = '';
  if (v) { if (inp.hasAttribute('data-ftin')) { const x = RHM.parseLen(v); if (!isFinite(x) || x < 0 || !/^[\d\s.'"\-\/]+$/.test(v) || !/\d/.test(v)) msg = `Couldn't read "${v}". Try 12'-6" or 12.5`; else if (/['"]/.test(v) || /\d\s+\d/.test(v)) okTxt = `= ${RHM.fmt(x)} ft`; }
    else if (inp.type === 'number' || /decimal|numeric/.test(inp.inputMode)) { const x = Number(v.replace(/,/g, '')); if (!isFinite(x)) msg = 'Numbers only, like 1250 or 12.5'; else if (x < 0 && !inp.hasAttribute('data-neg') && inp.dataset.work === undefined) msg = 'This should not be negative. Use a change order for credits.'; else if (inp.dataset.pct !== undefined && x > 100) msg = 'More than 100% - is that right?'; }
    else if (inp.type === 'email' && !v.split(/[,;]\s*/).every(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) msg = 'That email looks incomplete, e.g. name@company.com'; }
  m.textContent = msg || okTxt; m.hidden = !(msg || okTxt); m.className = 'vmsg' + (msg ? ' bad' : ' okv'); msg ? inp.setAttribute('aria-invalid', 'true') : inp.removeAttribute('aria-invalid'); }
function ftKeys(inp) { const d = document.createElement('div'); d.className = 'ftk'; d.setAttribute('role', 'group'); d.setAttribute('aria-label', 'Feet and inch marks');
  [["'", 'Insert feet mark'], ['"', 'Insert inch mark'], ['-', 'Insert dash'], [' ', 'Insert space']].forEach(([c, l]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c === ' ' ? '␣' : c; b.setAttribute('aria-label', l);
    b.onpointerdown = e => e.preventDefault(); b.onclick = () => { inp.value += c; inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true})); inp.focus(); }; d.append(b); }); return d; }
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function voiceBtn(ta) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm mic'; b.textContent = SR ? '🎤 Talk' : '⌨️ Type'; b.title = SR ? 'Dictate with your voice' : 'Voice typing not available here - use the keyboard';
  let rec = null; b.onclick = () => { if (!SR) { ta.focus(); return toast("Voice typing isn't available in this browser - use the 🎤 on your keyboard", 3500); }
    if (rec) { rec.stop(); return; } rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false; rec.continuous = true; b.textContent = '⏹ Stop'; b.classList.add('rec'); buzz(20);
    rec.onresult = e => { const t = [...e.results].slice(e.resultIndex).filter(r => r.isFinal).map(r => r[0].transcript).join(' ').trim(); if (t) { ta.value = (ta.value ? ta.value.replace(/\s*$/, ' ') : '') + t[0].toUpperCase() + t.slice(1) + '.'; ta.dispatchEvent(new Event('input', {bubbles:true})); ta.dispatchEvent(new Event('change', {bubbles:true})); } };
    rec.onerror = e => toast(e.error === 'not-allowed' ? 'Microphone permission was denied - type instead' : 'Voice stopped: ' + e.error); rec.onend = () => { rec = null; b.textContent = '🎤 Talk'; b.classList.remove('rec'); }; try { rec.start(); } catch (e) { rec = null; } }; return b; }
function enhance(root) { root = root || main();
  root.querySelectorAll('input[type=number]:not([inputmode])').forEach(i => i.setAttribute('inputmode', 'decimal'));
  root.querySelectorAll('label.fld:not([data-ux])').forEach(l => { l.dataset.ux = 1; const sp = l.querySelector(':scope > span'), inp = l.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea'); if (!sp || !inp) return;
    const label = (inp.dataset.help || sp.textContent).trim(), w = document.createElement('div'); w.className = 'fldw'; l.replaceWith(w); w.append(l);
    const hid = 'h' + uid(), b = document.createElement('button'); b.type = 'button'; b.className = 'help'; b.textContent = '?'; b.setAttribute('aria-label', 'Help: ' + label); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', hid);
    const h = document.createElement('p'); h.id = hid; h.className = 'helpTxt'; h.hidden = true; h.textContent = helpFor(inp, label); b.onclick = () => { h.hidden = !h.hidden; b.setAttribute('aria-expanded', String(!h.hidden)); };
    const v = document.createElement('p'); v.className = 'vmsg'; v.id = 'v' + uid(); v.hidden = true; v.setAttribute('aria-live', 'polite'); inp.setAttribute('aria-describedby', v.id + ' ' + hid);
    w.append(b, h, v); if (inp.hasAttribute('data-ftin')) w.append(ftKeys(inp)); if (inp.hasAttribute('data-voice')) sp.after(voiceBtn(inp));
    inp.addEventListener('input', () => validate(inp)); inp.addEventListener('blur', () => validate(inp)); if (inp.value) validate(inp); });
  root.querySelectorAll('input[data-ftin]:not([data-ux])').forEach(i => { if (i.closest('.fldw')) return; i.dataset.ux = 1; const host = i.closest('.inline'); host ? host.append(ftKeys(i)) : i.after(ftKeys(i)); });
  root.querySelectorAll('[data-swipe]:not([data-sw])').forEach(el => { el.dataset.sw = 1; swipeable(el); }); }
new MutationObserver(() => { clearTimeout(enhance.t); enhance.t = setTimeout(() => enhance(main()), 25); }).observe(document.getElementById('app'), {childList:true, subtree:true});

/* ---------- swipe left to delete, with undo ---------- */
function swipeable(el) { let x0 = null, y0 = 0, dx = 0, id0 = null;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.target.closest('input,select,textarea')) return; x0 = e.clientX; y0 = e.clientY; dx = 0; id0 = e.pointerId; });
  el.addEventListener('pointermove', e => { if (x0 === null || e.pointerId !== id0) return; dx = e.clientX - x0; if (Math.abs(e.clientY - y0) > 40 && Math.abs(dx) < 30) { x0 = null; el.style.transform = ''; return; }
    if (dx < -12) { el.classList.add('swiping'); el.style.transform = `translateX(${Math.max(dx, -180)}px)`; el.classList.toggle('armed', dx < -110); } });
  const end = async () => { if (x0 === null) return; x0 = null; el.style.transform = ''; el.classList.remove('swiping', 'armed'); if (dx < -110) { dx = 0; const [store, id, ...lbl] = el.dataset.swipe.split(':'); await swipeDelete(store, id, lbl.join(':')); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', () => { x0 = null; el.style.transform = ''; el.classList.remove('swiping', 'armed'); });
  el.addEventListener('click', e => { if (el.classList.contains('swiping')) e.stopPropagation(); }, true); }
async function swipeDelete(store, id, label) { const r = await DB.get(store, id); if (!r) return; if (store === 'payapps' && r.status === 'submitted') return toast("Submitted pay apps can't be deleted");
  buzz([20, 40, 20]); await DB.del(store, id); APP.undo.push([store, r]); await go(APP.route, APP.arg); toastUndo(`Deleted ${label}`); }
