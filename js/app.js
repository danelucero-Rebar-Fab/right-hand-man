/* Right Hand Man - app shell, router and modules */
'use strict';
const VERSION = '2.0.0', CREDIT = 'Designed by Joe Dane Lucero P.E.';
const CO_INFO = { name:'Rebar-Fab', person:'Joe Dane Lucero P.E.', addr1:'207 Sentry Dr', addr2:'Mansfield, TX 76063', main:'(817) 908-0069', direct:'817.798.2483', email:'d.lucero@rebar-fab.com' };
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], main = () => $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M = x => RHM.money(x), today = () => new Date().toLocaleDateString('en-CA');
const APP = { pid:null, project:null, client:null, route:'home', arg:null, undo:[] };
function toast(t, ms = 2200) { let el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms); }
function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s); }); }
function download(name, data, type) { const b = data instanceof Blob ? data : new Blob([data], {type}); const a = document.createElement("a"); a.hidden = true; a.href = URL.createObjectURL(b); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function downloadXlsx(name, rows, opts) { if (!window.RHMX) return toast('Excel export not loaded'); const n = name.endsWith('.xlsx') ? name : name + '.xlsx'; download(n, RHMX.toBlob(rows, opts)); }
async function sharePDF(blob, name, title) { const f = new File([blob], name, {type:'application/pdf'});
  try { if (navigator.canShare && navigator.canShare({files:[f]})) { await navigator.share({title, text:title, files:[f]}); return 'shared'; } } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  download(name, blob); return 'downloaded'; }
const mailto = (to, subject, body) => 'mailto:' + encodeURIComponent(to || '').replace(/%40/g, '@').replace(/%2C/g, ',') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
const fileToDataURL = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
const n0 = v => { const x = RHM.num(v); return isFinite(x) ? x : 0; };

/* ---------- settings ---------- */
const SET = Object.assign({ outdoor:false, glove:false, burdenPct:45, cci:{mat:100, inst:100, city:'National average (100)'}, rates:{...RHM.RATES}, emailCC:'', foreman:'', textSize:'m', theme:'auto', haptics:true }, JSON.parse(localStorage.getItem('rhm_settings') || '{}'));
const saveSet = () => { localStorage.setItem('rhm_settings', JSON.stringify(SET)); applyModes(); };
const TEXT_SIZES = {m:18, l:20, xl:23};
function applyModes() { document.documentElement.style.setProperty('--fs', (TEXT_SIZES[SET.textSize] || 18) + 'px'); document.documentElement.dataset.ts = SET.textSize || 'm';
  const dark = !SET.outdoor && (SET.theme === 'dark' || (SET.theme === 'auto' && matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)); document.body.classList.toggle('dark', dark);
  document.body.classList.toggle('outdoor', !!SET.outdoor); document.body.classList.toggle('glove', !!SET.glove); const m = $('meta[name=theme-color]'); if (m) m.content = SET.outdoor ? '#000000' : dark ? '#020617' : '#0b1f3a'; }

/* ---------- data helpers ---------- */
const DEFAULT_CLIENT = () => ({ id:uid(), name:'New client', contact:'', email:'', phone:'', addr:'', payFormat:'G702', retainPct:10, retainStoredPct:10, taxPct:0, taxNote:'', approver:'', letterhead:'', logo:'',
  sov:[{item:'1', desc:'Mobilization', unit:'LS', qty:1, price:0}, {item:'2', desc:'Reinforcing steel - furnish (fabricated)', unit:'LB', qty:0, price:0.72}, {item:'3', desc:'Reinforcing steel - install', unit:'LB', qty:0, price:0}], checklist:'', created:Date.now() });
const sovSched = l => RHM.r2(n0(l.qty) * n0(l.price)) || n0(l.sched);
async function setProject(pid) { APP.pid = pid; localStorage.setItem('rhm_pid', pid || ''); APP.project = pid ? await DB.get('projects', pid) : null; APP.client = APP.project ? await DB.get('clients', APP.project.clientId) : null;
  $('#pname').textContent = APP.project ? (APP.project.type && APP.project.type !== 'general' ? ptype(APP.project).icon + ' ' : '') + APP.project.name : 'No project picked'; }
async function saveProject() { APP.project.updated = Date.now(); await DB.put('projects', APP.project); }
function needProject() { if (APP.project) return false; main().innerHTML = `<div class="empty"><h2>Pick a project first</h2><p>Everything (plans, takeoff, pay apps, logs) is filed under a project.</p><button class="btn xl p" onclick="go('projects')">📁 Pick or start a project</button></div>`; setPrimary(null); return true; }

/* ---------- accessibility: every field gets an accessible name (placeholder / data key) even when it sits in a compact grid row ---------- */
const A11Y_NAMES = {desc:'Description', lb:'Weight (lb)', cls:'Fabricated or straight', coat:'Coating', qty:'Quantity', unit:'Unit', price:'Price per unit', hrs:'Hours', rate:'Rate', ot:'Overtime hours', n:'Number of workers', name:'Name', role:'Trade', item:'Item number', sched:'Scheduled value'};
function a11yLabel(root) { (root || document).querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => { if (el.getAttribute('aria-label') || el.labels && el.labels.length || el.getAttribute('aria-labelledby') || el.title) return;
  const k = el.dataset.l || el.dataset.k || el.dataset.f || el.name || el.id || '', row = el.closest('[data-i]'); el.setAttribute('aria-label', (el.placeholder || A11Y_NAMES[k] || k.replace(/([A-Z])/g, ' $1') || el.type) + (row ? ` (line ${+row.dataset.i + 1})` : '')); }); }
new MutationObserver(() => { clearTimeout(a11yLabel.t); a11yLabel.t = setTimeout(() => a11yLabel(main()), 30); }).observe(document.getElementById('app') || document.body, {childList:true, subtree:true});

/* ---------- router ---------- */
const ROUTES = {};
const TITLES = {home:'Home', projects:'Projects', project:'Project setup', client:'Client setup', plans:'Plans', takeoff:'Takeoff', shop:'Shop Drawings', payapp:'Pay App', daily:'Daily Log', co:'Change Order / Quote', costs:'Cost Data', standards:'Standards', settings:'Settings', about:'About', search:'Search', trench:'Trench Safety'};
async function go(route, arg) { APP.route = route; APP.arg = arg; history.replaceState(null, '', '#' + route); document.body.dataset.route = route; $('#title').textContent = TITLES[route] || ''; $('#homeBtn').hidden = true;
  setPrimary(null); typeof navSync === 'function' && navSync(route); const m = main(); m.setAttribute('aria-busy', 'true'); const snap = m.firstElementChild, sk = setTimeout(() => { if (m.firstElementChild === snap) m.innerHTML = typeof SKELETON === 'string' ? SKELETON : ''; }, 120);
  try { await (ROUTES[route] || ROUTES.home)(arg); } catch (e) { console.error(e); m.innerHTML = `<div class="card bad"><b>Something went wrong:</b> ${esc(e.message)}</div>`; } finally { clearTimeout(sk); m.removeAttribute('aria-busy'); }
  typeof rememberPlace === 'function' && rememberPlace(route, arg); window.scrollTo(0, 0); }
// One main action per screen: a big sticky button at the bottom (thumb zone)
function setPrimary(label, fn) { const b = $('#primary'); if (!label) { b.hidden = true; return; } b.hidden = false; b.textContent = label; b.onclick = fn; }

/* ---------- HOME ---------- */
const TILES = [['plans','📐','Plans','Sheets, scale, measure, markup'], ['takeoff','🧮','Takeoff','Quantities with the math shown'], ['payapp','💵','Pay App','G702/G703 with backup'], ['daily','📋','Daily Log','Crew, hours, installed'],
  ['co','📝','Change Order / Quote','From takeoff + rates, T&M'], ['shop','🔩','Shop Drawings','Bar list and placing sheet'], ['standards','📚','Standards','TxDOT, NCTCOG, federal'], ['costs','💲','Cost Data','Your CSV + known rates']];
ROUTES.home = async () => { const ps = (await DB.all('projects')).sort((a, b) => (b.updated || 0) - (a.updated || 0)), rec = await recoverCheck(), age = backupAge();
  main().innerHTML = `${rec || ''}${ps.length && age > 7 ? `<div class="card warnc" id="bkRemind"><b>💾 ${age === Infinity ? 'No backup yet' : `Last backup ${Math.floor(age)} days ago`}</b><small>Phones can clear app storage. One tap saves everything to a file.</small><button class="btn p" id="bkNow">Back up now</button></div>` : ''}${typeof homeTop === 'function' ? await homeTop(ps) : ''}<div class="projbar card"><div><small>Current project</small><b>${esc(APP.project ? APP.project.name : 'None yet')}</b>${APP.client ? `<small>${esc(APP.client.name)} · retainage ${APP.client.retainPct}%</small>` : ''}</div><button class="btn" onclick="go('projects')">${APP.project ? 'Change' : 'Pick'}</button></div>
  <div class="tiles">${TILES.map(([r, i, t, s]) => `<button class="tile" data-go="${r}"><span class="ti">${i}</span><b>${t}</b><small>${s}</small></button>`).join('')}</div>
  <div class="row center"><button class="btn ghost" data-go="settings">⚙️ Settings</button><button class="btn ghost" data-go="about">ℹ️ About</button><button class="btn ghost" id="modeBtn">${SET.outdoor ? '🌙 Normal' : '☀️ Outdoor'} mode</button><button class="btn ghost" id="tutBtn">🎓 Tutorial</button></div>`;
  $('#tutBtn').onclick = () => tutorial(true); if ($('#bkNow')) $('#bkNow').onclick = async () => { await exportBackup(); go('home'); };
  if (rec) { $('#recoverNo').onclick = () => { localStorage.removeItem('rhm_hadData'); localStorage.removeItem('rhm_lastBackup'); go('home'); }; }
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go)); $('#modeBtn').onclick = () => { SET.outdoor = !SET.outdoor; saveSet(); go('home'); };
  if (typeof homeBind === 'function') homeBind();
  if (rec) setPrimary('⬆ Restore from backup file', pickRestore); else if (!ps.length) setPrimary('➕ Start your first project', () => go('project', 'quick')); else if (lastPlace() && lastPlace().pid) setPrimary(`▶ Continue: ${PLACE_LABEL[lastPlace().route] || 'last screen'}`, continuePlace); else setPrimary(null); };

/* ---------- PROJECTS & CLIENTS ---------- */
ROUTES.projects = async () => { const [ps, cs] = [await DB.all('projects'), await DB.all('clients')], cn = id => (cs.find(c => c.id === id) || {}).name || '?';
  main().innerHTML = `<h2>Projects</h2><div class="list">${ps.sort((a, b) => (b.updated || 0) - (a.updated || 0)).map(p => `<div class="li ${p.id === APP.pid ? 'on' : ''}"><button class="grow" data-pick="${p.id}"><b>${esc(p.name)}</b><small>${esc(cn(p.clientId))} · ${esc(p.no || '')} · ${esc(p.location || '')}</small></button><button class="btn sm" data-edit="${p.id}">Edit</button><button class="btn sm" data-dupp="${p.id}" title="Duplicate ${esc(p.name)}">⧉ Copy</button></div>`).join('') || '<p class="muted">No projects yet.</p>'}</div>
  <h2>Clients <small class="muted">(pay-app format, retainage, tax, SOV template, logo)</small></h2><div class="list">${cs.map(c => `<div class="li"><div class="grow"><b>${esc(c.name)}</b><small>${c.payFormat} · ret ${c.retainPct}% · tax ${c.taxPct}%</small></div><button class="btn sm" data-cl="${c.id}">Edit</button></div>`).join('')}</div>
  <div class="row"><button class="btn" id="newCl">➕ New client</button><button class="btn" id="backup">💾 Back up now</button><button class="btn" id="restore">⬆ Restore backup</button></div>`;
  $$('[data-pick]').forEach(b => b.onclick = async () => { await setProject(b.dataset.pick); toast('Project picked'); go('home'); });
  $$('[data-edit]').forEach(b => b.onclick = () => go('project', b.dataset.edit)); $$('[data-dupp]').forEach(b => b.onclick = () => duplicateProject(b.dataset.dupp)); $$('[data-cl]').forEach(b => b.onclick = () => go('client', b.dataset.cl));
  $('#newCl').onclick = async () => { const c = DEFAULT_CLIENT(); await DB.put('clients', c); go('client', c.id); };
  $('#backup').onclick = exportBackup; $('#restore').onclick = pickRestore;
  setPrimary('➕ New project (step by step)', () => go('project', 'new')); };

// Wizard: new project in 3 steps
ROUTES.project = async (id) => { const cs = await DB.all('clients'); if (!cs.length) { const c = DEFAULT_CLIENT(); c.name = 'Default client (edit me)'; await DB.put('clients', c); cs.push(c); }
  const quick = id === 'quick'; if (quick) id = 'new';
  let P = id && id !== 'new' ? await DB.get('projects', id) : { id:uid(), name:'', no:'', location:'', owner:'', gc:'', clientId:cs[0].id, contractDate:today(), sov:null, created:Date.now(), coNo:0 };
  let step = id && id !== 'new' ? 3 : quick && cs.length === 1 ? 2 : 1; const tpls = (await DB.kv('projTemplates')) || [];
  const draw = () => { const cl = cs.find(c => c.id === P.clientId) || cs[0];
    if (step === 1) { main().innerHTML = `${wizHead(1, 3, 'Who is the client?')}<p class="hint">The client decides the pay-app format, retainage, tax and starting schedule of values.</p>
      <div class="list">${cs.map(c => `<label class="li pick"><input type="radio" name="cl" value="${c.id}" ${c.id === P.clientId ? 'checked' : ''}><div class="grow"><b>${esc(c.name)}</b><small>${c.payFormat} · retainage ${c.retainPct}% · tax ${c.taxPct}%</small></div></label>`).join('')}</div>
      <button class="btn" id="addCl">➕ Add a new client</button>`;
      $$('[name=cl]').forEach(r => r.onchange = () => P.clientId = r.value); $('#addCl').onclick = async () => { const c = DEFAULT_CLIENT(); c.name = prompt('Client name?', '') || 'New client'; await DB.put('clients', c); cs.push(c); P.clientId = c.id; draw(); };
      setPrimary('Next: project name →', () => { step = 2; draw(); }); }
    else if (step === 2) { main().innerHTML = `${wizHead(2, 3, 'Name the project')}<div class="row"><span class="grow">Client: <b>${esc(cl.name)}</b></span><button class="btn sm" id="chgCl">Change client</button></div>
      ${tpls.length && !P.sov ? `<div class="card"><b>Start from a saved template</b><div class="list">${tpls.map(t => `<button class="li big" data-tpl="${t.id}">📑 ${esc(t.name)}<small>${t.sov.length} SOV lines${t.type && t.type !== 'general' ? ' · ' + esc(PTYPES[t.type].name) : ''}</small></button>`).join('')}</div></div>` : ''}
      <fieldset class="ptype"><legend>What kind of project?</legend><div class="list">${Object.entries(PTYPES).map(([k, t]) => `<label class="li pick"><input type="radio" name="ptype" value="${k}" ${(P.type || 'general') === k ? 'checked' : ''}><div class="grow"><b>${t.icon} ${t.name}</b>${t.blurb ? `<small>${t.blurb}</small>` : ''}</div></label>`).join('')}</div></fieldset>
      ${fld('name', 'Project name', P.name, 'example: MUS1A Lift Station')}${fld('no', 'Job / contract number', P.no)}${fld('location', 'Location', P.location)}${fld('owner', 'Owner', P.owner)}${fld('gc', 'General contractor (who you bill)', P.gc)}${fld('contractDate', 'Contract date', P.contractDate, '', 'date')}
      <button class="btn ghost" id="back">← Back</button>`; bindFields(P); $$('[name=ptype]').forEach(r => r.onchange = () => { P.type = r.value; }); $('#chgCl').onclick = () => { step = 1; draw(); };
      $$('[data-tpl]').forEach(b => b.onclick = () => { const t = tpls.find(x => x.id === b.dataset.tpl); P.type = t.type || 'general'; if (cs.find(c => c.id === t.clientId)) P.clientId = t.clientId; P.sov = t.sov.map(x => ({...x, id:uid(), sched:sovSched(x)})); P.fromTpl = t.name; toast(`Template "${t.name}" loaded - name the job and tap Next`); draw(); }); $('#back').onclick = () => { step = 1; draw(); };
      setPrimary('Next: schedule of values →', () => { if (!P.name.trim()) return toast('Give the project a name'); if (!P.sov) P.sov = (P.type && P.type !== 'general' ? ptypeSOV(P.type) : cl.sov).map(s => ({...s, id:uid(), sched:sovSched(s)})); step = 3; draw(); }); }
    else { main().innerHTML = `${wizHead(3, 3, 'Schedule of values (SOV)')}<p class="hint">${P.type && P.type !== 'general' ? `${ptype(P).icon} ${ptype(P).name} project.` : ''} Change quantities and prices; the scheduled value is qty × price (or type a lump sum).</p>
      <div class="card"><div class="row"><b class="grow">${esc(P.name || 'Project')}</b><button class="btn sm" id="editInfo">Edit info</button></div></div>${sovEditor(P.sov)}
      <div class="row"><button class="btn" id="addSov">➕ Add line</button>${P.type && P.type !== 'general' ? `<button class="btn" id="useTypeSov">${ptype(P).icon} Use ${ptype(P).name} SOV template</button>` : ''}<button class="btn" id="useClSov">Use ${esc(cl.name)} template</button><button class="btn" id="saveTpl">💾 Save as template</button>${id && id !== 'new' ? '<button class="btn" id="dupP">⧉ Duplicate project</button>' : ''}<label class="btn">⬆ Import SOV CSV<input type="file" id="sovCsv" accept=".csv,text/csv" hidden></label></div>
      <p class="muted">Contract sum: <b id="csum">${M(P.sov.filter(s => !s.co).reduce((a, s) => a + sovSched(s), 0))}</b></p>
      ${id && id !== 'new' ? '<button class="btn danger" id="delP">Delete project</button>' : ''}`;
      bindSov(P.sov, () => $('#csum').textContent = M(P.sov.filter(s => !s.co).reduce((a, s) => a + sovSched(s), 0)));
      $('#addSov').onclick = () => { P.sov.push({id:uid(), item:String(P.sov.length + 1), desc:'', unit:'LS', qty:1, price:0}); draw(); };
      $('#editInfo').onclick = () => { step = 2; draw(); };
      const swapSov = src => { if (P.sov.some(s => sovSched(s)) && !confirm('Replace the current SOV lines? Amounts you typed will be lost.')) return; P.sov = src.map(s => ({...s, id:uid(), sched:sovSched(s)})); draw(); };
      $('#saveTpl').onclick = async () => { const nm = prompt('Template name (for repeat jobs)?', P.name || 'My template'); if (!nm) return; const t = {id:uid(), name:nm, type:P.type || 'general', clientId:P.clientId, sov:P.sov.filter(s => !s.co).map(({id, sched, ...s}) => s), created:Date.now()}; await DB.kv('projTemplates', [...tpls.filter(x => x.name !== nm), t]); tpls.push(t); toast('Template saved ✔'); };
      const dpb = $('#dupP'); if (dpb) dpb.onclick = () => duplicateProject(P.id);
      const uts = $('#useTypeSov'); if (uts) uts.onclick = () => swapSov(ptypeSOV(P.type)); $('#useClSov').onclick = () => swapSov(cl.sov);
      $('#sovCsv').onchange = async e => { const rows = RHM.parseCSV(await e.target.files[0].text()); const h = rows[0].map(x => x.toLowerCase()); const ix = k => h.findIndex(x => x.includes(k));
        rows.slice(1).forEach(r => P.sov.push({id:uid(), item:r[ix('item')] || '', desc:r[ix('desc')] || '', unit:r[ix('unit')] || 'LS', qty:n0(r[ix('qty')]) || 1, price:n0(r[ix('price')] >= 0 ? r[ix('price')] : r[ix('value')])})); draw(); };
      const dp = $('#delP'); if (dp) dp.onclick = async () => { if (!confirm('Delete this project and its sheets, logs and pay apps? This cannot be undone.')) return; for (const s of ['sheets','takeoff','payapps','logs','cos']) for (const r of await DB.where(s, x => x.projectId === P.id)) await DB.del(s, r.id); await DB.del('projects', P.id); if (APP.pid === P.id) await setProject(null); go('projects'); };
      setPrimary('✔ Save project', async () => { P.sov = P.sov.filter(s => String(s.desc || '').trim() || sovSched(s)); P.sov.forEach(s => s.sched = sovSched(s)); await DB.put('projects', P); await setProject(P.id); toast('Project saved'); go('home'); }); } };
  draw(); };
const wizHead = (i, n, t) => `<div class="wiz"><div class="dots">${Array.from({length:n}, (_, k) => `<i class="${k < i ? 'on' : ''}"></i>`).join('')}</div><small>Step ${i} of ${n}</small><h2>${t}</h2></div>`;
const fld = (k, l, v, ph = '', type = 'text', extra = '') => `<label class="fld"><span>${l}</span><input data-k="${k}" type="${type}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} ${extra}></label>`;
function bindFields(obj, after) { $$('[data-k]').forEach(i => i.oninput = () => { obj[i.dataset.k] = i.type === 'number' ? (i.value === '' ? '' : +i.value) : i.value; after && after(i.dataset.k); }); }
const sovEditor = sov => `<div class="sov">${sov.map((s, i) => `<div class="sovl" data-i="${i}"><label class="mini it"><span>Item</span><input data-f="item" value="${esc(s.item)}"></label><label class="mini ds"><span>Description</span><input data-f="desc" value="${esc(s.desc)}" placeholder="Description"></label>
  <label class="mini"><span>Unit</span><input data-f="unit" value="${esc(s.unit)}"></label><label class="mini"><span>Qty</span><input data-f="qty" type="number" inputmode="decimal" step="any" value="${s.qty ?? ''}"></label><label class="mini"><span>Unit price $</span><input data-f="price" type="number" inputmode="decimal" step="any" value="${s.price ?? ''}"></label>
  <span class="sv">${M(sovSched(s))}</span><button class="x" data-del="${i}" aria-label="Remove line">✕</button></div>`).join('')}</div>`;
function bindSov(sov, after) { $$('.sovl input').forEach(inp => inp.oninput = () => { const s = sov[+inp.closest('.sovl').dataset.i]; s[inp.dataset.f] = inp.type === 'number' ? n0(inp.value) : inp.value; s.sched = sovSched(s); inp.closest('.sovl').querySelector('.sv').textContent = M(s.sched); after && after(); });
  $$('.sovl [data-del]').forEach(b => b.onclick = () => { const i = +b.dataset.del, gone = sov.splice(i, 1)[0]; b.closest('.sovl').remove(); $$('.sovl').forEach((el, k) => el.dataset.i = k); after && after(); toast(`Removed "${gone.desc || gone.item}"`); }); }

ROUTES.client = async (id) => { const C = await DB.get('clients', id); if (!C) return go('projects');
  main().innerHTML = `<h2>Client setup</h2>${fld('name', 'Client name', C.name)}${fld('contact', 'Contact', C.contact)}${fld('email', 'Pay app email(s), comma separated', C.email, '', 'email')}${fld('phone', 'Phone', C.phone, '', 'tel')}${fld('addr', 'Address', C.addr)}
  <label class="fld"><span>Pay app format</span><select data-k="payFormat"><option value="G702" ${C.payFormat === 'G702' ? 'selected' : ''}>AIA G702/G703 style (summary + continuation sheet)</option><option value="simple" ${C.payFormat === 'simple' ? 'selected' : ''}>Simple invoice (SOV table + totals)</option></select></label>
  <div class="grid2">${fld('retainPct', 'Retainage on work %', C.retainPct, '', 'number')}${fld('retainStoredPct', 'Retainage on stored material %', C.retainStoredPct, '', 'number')}${fld('taxPct', 'Sales tax %', C.taxPct, '0 if exempt', 'number')}${fld('approver', 'Architect / engineer certifying', C.approver)}</div>
  ${fld('taxNote', 'Tax note on pay app', C.taxNote, 'example: Tax-exempt per certificate on file')}
  <label class="fld"><span>Letterhead line (top of PDFs)</span><textarea data-k="letterhead" rows="2">${esc(C.letterhead)}</textarea></label>
  <label class="fld"><span>Extra checklist items for this client (one per line)</span><textarea data-k="checklist" rows="3" placeholder="example: Lien waiver (conditional) attached">${esc(C.checklist)}</textarea></label>
  <div class="row"><label class="btn">🖼 Client logo<input type="file" id="logo" accept="image/*" hidden></label>${C.logo ? `<img src="${C.logo}" class="logo-prev" alt="logo">` : ''}</div>
  <h3>SOV template</h3>${sovEditor(C.sov)}<button class="btn" id="addSov">➕ Add line</button> <button class="btn danger" id="delC">Delete client</button>`;
  bindFields(C); bindSov(C.sov); $('#logo').onchange = async e => { C.logo = await shrinkImg(e.target.files[0], 400); await DB.put('clients', C); go('client', id); };
  $('#addSov').onclick = async () => { C.sov.push({item:String(C.sov.length + 1), desc:'', unit:'LS', qty:1, price:0}); await DB.put('clients', C); go('client', id); };
  $('#delC').onclick = async () => { if ((await DB.where('projects', p => p.clientId === id)).length) return alert('Projects still use this client.'); if (confirm('Delete client?')) { await DB.del('clients', id); go('projects'); } };
  setPrimary('✔ Save client', async () => { ['retainPct','retainStoredPct','taxPct'].forEach(k => C[k] = n0(C[k])); await DB.put('clients', C); if (APP.project && APP.project.clientId === id) APP.client = C; toast('Client saved'); go('projects'); }); };
async function shrinkImg(file, max) { const c = await decodeImage(file, max), k = Math.min(1, max / Math.max(c.width, c.height)), o = mkCanvas(Math.round(c.width * k), Math.round(c.height * k)); o.getContext('2d').drawImage(c, 0, 0, o.width, o.height); return o.toDataURL('image/png'); }

/* ---------- backup / restore (one file, one tap) ---------- */
async function backupBlob() { const out = {app:'Right Hand Man', version:VERSION, at:new Date().toISOString(), settings:SET, counts:{}};
  for (const s of STORES) { out[s] = await DB.all(s); out.counts[s] = out[s].length; for (const r of out[s]) for (const k of Object.keys(r)) if (r[k] instanceof Blob) r[k] = {__blob:await fileToDataURL(r[k])}; }
  return new Blob([JSON.stringify(out)], {type:'application/json'}); }
async function exportBackup() { toast('Making backup file…', 8000); const b = await backupBlob(), name = `RightHandMan-backup-${today()}.json`, f = new File([b], name, {type:'application/json'});
  let how = 'downloaded'; try { if (navigator.canShare && navigator.canShare({files:[f]})) { await navigator.share({title:'Right Hand Man backup', files:[f]}); how = 'shared'; } else download(name, b); } catch (e) { if (e.name === 'AbortError') return toast('Backup cancelled'); download(name, b); }
  localStorage.setItem('rhm_lastBackup', JSON.stringify({at:Date.now(), name, size:b.size})); toast(`Backup ${how} ✔ (${(b.size / 1048576).toFixed(1)} MB). Save it to Files / Drive.`, 4000); return b; }
async function readBackup(f) { let d; try { d = JSON.parse(await f.text()); } catch (e) { throw new Error('That file is not a Right Hand Man backup (it could not be read).'); }
  if (!d || d.app !== 'Right Hand Man') throw new Error('That file is not a Right Hand Man backup.'); return d; }
async function importBackup(f, quiet) { if (!f) return; let d; try { d = await readBackup(f); } catch (e) { return alert(e.message); }
  const c = STORES.filter(s => Array.isArray(d[s]) && d[s].length && s !== 'kv').map(s => `${d[s].length} ${s}`).join(', ') || 'no records';
  if (!quiet && !confirm(`Restore backup from ${new Date(d.at).toLocaleString()}?\n\nIt has ${c}.\nRecords with the same id are replaced; nothing else is deleted.`)) return;
  for (const s of STORES) if (Array.isArray(d[s])) { for (const r of d[s]) for (const k of Object.keys(r)) if (r[k] && r[k].__blob) r[k] = await (await fetch(r[k].__blob)).blob(); await DB.bulk(s, d[s]); }
  if (d.settings) { Object.assign(SET, d.settings); saveSet(); } localStorage.setItem('rhm_hadData', '1');
  const ps = await DB.all('projects'); if (!APP.project && ps.length) await setProject(ps.sort((a, b) => (b.updated || 0) - (a.updated || 0))[0].id); toast(`Restored ✔ ${c}`, 3500); go('home'); }
const pickRestore = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => importBackup(i.files[0]); i.click(); };
// Recover prompt: data existed on this device before but the database is now empty (iOS can evict site data after weeks unused) -> offer restore
async function recoverCheck() { const n = (await DB.all('projects')).length; if (n) { localStorage.setItem('rhm_hadData', '1'); return null; }
  if (!localStorage.getItem('rhm_hadData') && !localStorage.getItem('rhm_lastBackup')) return null; const lb = JSON.parse(localStorage.getItem('rhm_lastBackup') || 'null');
  return `<div class="card bad" id="recover" role="alert"><b>Your projects are not on this device anymore.</b><p>The phone may have cleared the app's storage${lb ? `. Your last backup was <b>${esc(lb.name)}</b> (${new Date(lb.at).toLocaleDateString()})` : ''}. Tap <b>Restore from backup file</b> below and pick your backup to get everything back.</p>
    <button class="btn ghost" id="recoverNo">Start fresh instead</button></div>`; }
function backupAge() { const lb = JSON.parse(localStorage.getItem('rhm_lastBackup') || 'null'); return lb ? (Date.now() - lb.at) / 864e5 : Infinity; }

/* ---------- first-run tutorial ---------- */
const TUT = [['👋','Welcome to Right Hand Man','Your field partner for plans, takeoff, pay apps, daily logs, change orders and shop drawings. Works offline.'],
  ['📁','1. Start a project','Pick the client (retainage, tax, pay-app format) and name the job. The schedule of values comes from the client template.'],
  ['📐','2. Add plans','Upload the plan PDF. Set the scale with two taps on a known dimension, then measure, count and mark progress.'],
  ['🟦','3. One big button','The main action for every screen is the big button at the bottom, in reach of your thumb. Mistake? Tap UNDO.'],
  ['☀️','4. Outdoors or in gloves','Turn on Outdoor mode for sun and Glove mode for bigger buttons (Settings).'],
  ['💾','5. Back it up','Everything lives on this phone. Tap 💾 Back up now once a week to save one file you can restore anywhere.']];
function tutorial(force) { if (!force && localStorage.getItem('rhm_tut')) return; let i = 0; const el = document.createElement('div'); el.id = 'tut'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tutH');
  const done = () => { localStorage.setItem('rhm_tut', '1'); el.remove(); $('#primary').focus && 0; };
  const draw = () => { const [ic, h, t] = TUT[i]; el.innerHTML = `<div class="tutc"><div class="tuti" aria-hidden="true">${ic}</div><h2 id="tutH">${h}</h2><p>${t}</p><div class="dots" role="img" aria-label="Step ${i + 1} of ${TUT.length}">${TUT.map((_, j) => `<span class="${j === i ? 'on' : ''}"></span>`).join('')}</div>
    <div class="row"><button class="btn ghost" id="tutSkip">Skip</button>${i ? '<button class="btn" id="tutBack">◀ Back</button>' : ''}<button class="btn p" id="tutNext">${i === TUT.length - 1 ? '✔ Get started' : 'Next ▶'}</button></div></div>`;
    $('#tutSkip').onclick = done; if ($('#tutBack')) $('#tutBack').onclick = () => { i--; draw(); }; $('#tutNext').onclick = () => { if (i === TUT.length - 1) return done(); i++; draw(); }; $('#tutNext').focus(); };
  document.body.append(el); draw(); }

/* ---------- SETTINGS & ABOUT ---------- */
ROUTES.settings = async () => { const R = SET.rates;
  main().innerHTML = `<h2>Settings</h2><div class="card"><label class="switch"><input type="checkbox" id="od" ${SET.outdoor ? 'checked' : ''}><span>☀️ Outdoor mode (high contrast, black on white, bold)</span></label>
  <label class="switch"><input type="checkbox" id="gl" ${SET.glove ? 'checked' : ''}><span>🧤 Glove mode (extra-large buttons, bigger text)</span></label>
  <fieldset class="segf"><legend>Text size</legend><div class="seg" role="radiogroup">${[['m','Large (default)'],['l','Larger'],['xl','Largest']].map(([k, t]) => `<button role="radio" aria-checked="${(SET.textSize || 'm') === k}" data-ts="${k}" class="${(SET.textSize || 'm') === k ? 'on' : ''}">${t}</button>`).join('')}</div></fieldset>
  <fieldset class="segf"><legend>Theme</legend><div class="seg" role="radiogroup">${[['auto','Match phone'],['light','Light'],['dark','Dark']].map(([k, t]) => `<button role="radio" aria-checked="${SET.theme === k}" data-th="${k}" class="${SET.theme === k ? 'on' : ''}">${t}</button>`).join('')}</div></fieldset>
  <label class="switch"><input type="checkbox" id="hap" ${SET.haptics ? 'checked' : ''}><span>📳 Vibrate on taps (where the phone supports it)</span></label></div>
  <h3>Rebar-Fab rates</h3><div class="grid2">${[['fab','Fabricated $/lb'],['straight','Straight $/lb'],['epoxy','Epoxy $/lb'],['truckPerLoad','Trucking $/load'],['tonsPerLoad','Tons per load'],['shopPerTon','Shop drawings $/fab ton']].map(([k, l]) => `<label class="fld"><span>${l}</span><input type="number" step="any" inputmode="decimal" data-r="${k}" value="${R[k]}"></label>`).join('')}
  <label class="fld"><span>Labor burden %</span><input type="number" id="burden" value="${SET.burdenPct}" inputmode="decimal"></label><label class="fld"><span>Foreman name (daily log default)</span><input id="fore" value="${esc(SET.foreman)}"></label></div>
  <button class="btn ghost" id="reset">Reset rates to Joe's standard</button>
  <h3>Estimating</h3><div class="list"><button class="li big" data-go2="equip">🚜 Equipment library <small>your machines and rates (hour / day / week / month)</small></button><button class="li big" data-go2="crew">👷 Labor rates & burden <small>trades, burden %, Davis-Bacon wage determinations</small></button><button class="li big" data-go2="taxset">🧾 Sales tax defaults <small>Texas 6.25% + local, taxable basis, exemptions</small></button></div>`; $$('[data-go2]').forEach(b => b.onclick = () => go(b.dataset.go2));
  $('#od').onchange = e => { SET.outdoor = e.target.checked; saveSet(); }; $$('button[data-ts]').forEach(b => b.onclick = () => { SET.textSize = b.dataset.ts; saveSet(); go('settings'); }); $$('[data-th]').forEach(b => b.onclick = () => { SET.theme = b.dataset.th; saveSet(); go('settings'); }); $('#hap').onchange = e => { SET.haptics = e.target.checked; saveSet(); buzz(20); }; $('#gl').onchange = e => { SET.glove = e.target.checked; saveSet(); };
  $$('[data-r]').forEach(i => i.oninput = () => { R[i.dataset.r] = n0(i.value); saveSet(); }); $('#burden').oninput = e => { SET.burdenPct = n0(e.target.value); saveSet(); }; $('#fore').oninput = e => { SET.foreman = e.target.value; saveSet(); };
  $('#reset').onclick = () => { SET.rates = {...RHM.RATES}; SET.burdenPct = 45; saveSet(); go('settings'); }; setPrimary('✔ Done', () => go('home')); };
ROUTES.about = async () => { main().innerHTML = `<div class="about"><img src="icons/logo.svg" alt="Right Hand Man logo" class="biglogo"><h2>Right Hand Man</h2><p>Version ${VERSION}</p><p class="credit-big">${CREDIT}</p>
  <div class="card left"><b>${CO_INFO.name}</b><br>${CO_INFO.addr1}<br>${CO_INFO.addr2}<br>Main <a href="tel:+18179080069">${CO_INFO.main}</a><br>Direct <a href="tel:+18177982483">${CO_INFO.direct}</a><br><a href="mailto:${CO_INFO.email}">${CO_INFO.email}</a></div>
  <div class="card left small"><b>How it keeps data:</b> everything stays on this device (IndexedDB) and works offline. Tap 💾 Back up now (Projects) to save one file you can restore on any phone.<br><b>Cost data:</b> ships with EXAMPLE rows only; RSMeans data is licensed and must be imported from your own licensed export.<br><b>Pay app forms:</b> G702/G703-<i>style</i> output; the official AIA documents are licensed forms.<br><b>Standards:</b> summaries with links to official sources; read the governing edition.</div></div>`; setPrimary('🏠 Home', () => go('home')); };

async function duplicateProject(pid) { const P = await DB.get('projects', pid); if (!P) return; const withTk = confirm(`Copy "${P.name}"?\n\nOK = copy info, SOV and takeoff lines. Cancel = info and SOV only.`);
  const N = {...structuredClone(P), id:uid(), name:P.name + ' (copy)', created:Date.now(), updated:Date.now(), coNo:0, shop:undefined, sov:P.sov.filter(s => !s.co).map(s => ({...s, id:uid()}))};
  const map = Object.fromEntries(P.sov.map((s, i) => [s.id, N.sov[i] && N.sov[i].id])); await DB.put('projects', N);
  if (withTk) for (const t of await DB.where('takeoff', x => x.projectId === pid)) await DB.put('takeoff', {...t, id:uid(), projectId:N.id, created:Date.now()});
  await setProject(N.id); toast('Project copied ✔ - rename it'); go('project', N.id); }
