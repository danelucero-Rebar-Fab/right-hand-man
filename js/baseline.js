/* Right Hand Man v1.5 - Baseline costs. Real published sources only (data/baseline/*.json, built by tests/build_baseline.py):
   TxDOT bid item averages (statewide, Fort Worth, Dallas), BLS OEWS wages (DFW + Midland/Odessa oilfield metros), EIA Gulf Coast diesel.
   Nothing here sets a price: the baseline sits NEXT TO the user's price with a variance % and an out-of-band warning. Internal only - never printed on customer PDFs. */
'use strict';
(function (G) {
  const U = u => String(u || '').toUpperCase().replace(/[^A-Z]/g, '').replace(/^(LINFT|LNFT|FT)$/, 'LF').replace(/^(CUYD|YD3)$/, 'CY').replace(/^(SQYD)$/, 'SY').replace(/^(SQFT)$/, 'SF').replace(/^(LBS|POUND|POUNDS)$/, 'LB').replace(/^(EACH)$/, 'EA').replace(/^(TONS|TN)$/, 'TON').replace(/^(HOUR|HOURS|HRS)$/, 'HR');
  function variance(price, avg, band = 25) { const p = +price, a = +avg; if (!(p > 0) || !(a > 0)) return null; const v = (p - a) / a * 100; return {pct:Math.round(v * 10) / 10, out:Math.abs(v) > band, dir:v > 0 ? 'above' : 'below', band, math:`(${p.toFixed(2)} - ${a.toFixed(2)}) / ${a.toFixed(2)} = ${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}; }
  const STOP = new Set(['THE', 'AND', 'FOR', 'WITH', 'IN', 'OF', 'TO', 'A']);
  const toks = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  const ALIAS = {CONCRETE:'CONC', CLASS:'CL', REINFORCED:'REINF', EXCAVATION:'EXCAV', MANHOLE:'MH', CONDUIT:'CONDT', PIPE:'PIPE', CULVERT:'CULV', DRILLED:'DRILL', SIDEWALK:'SIDEWALK', RETAINING:'RETAINING', HEADWALL:'HDWL', INLET:'INLET', ELECTRICAL:'ELEC', CONDUCTOR:'ELEC', EMBANKMENT:'EMBANK', BACKFILL:'BACKFILL', FOOTING:'FTG', FOUNDATION:'FDN', SLAB:'SLAB', WALL:'WALL', BOX:'BOX', PAINT:'PAINT', COATING:'COAT', RIPRAP:'RIPRAP'};
  function suggest(rows, desc, unit, n = 8) { const want = new Set(toks(desc).map(w => ALIAS[w] || w)), u = U(unit);
    return rows.map(r => { const t = toks(r[1]); let s = 0; t.forEach(w => { if (want.has(w)) s += 2; else if ([...want].some(x => Math.min(x.length, w.length) >= 3 && (x.startsWith(w) || w.startsWith(x)))) s += 1.5; }); s -= t.length * 0.05; if (u && U(r[2]) === u) s += 3; else if (u) s -= 2; return {r, s}; }).filter(x => x.s > 1).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.r); }
  function pick(row, region) { const i = {'TX-S':3, 'TX-FW':4, 'TX-DAL':5}[region] || 3; const v = row[i] || row[4] || row[3] || row[5]; const used = row[i] ? region : row[4] ? 'TX-FW' : row[3] ? 'TX-S' : 'TX-DAL'; return v ? {avg:v[0], low:v[1], high:v[2], n:v[3], src:used} : null; }
  G.RHMB = {U, variance, suggest, pick, toks};
  if (typeof module !== 'undefined') module.exports = G.RHMB;
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof window !== 'undefined') (function () {
  const B = RHMB, cache = {}; let IDX = null;
  const idx = async () => IDX || (IDX = await (await fetch('data/baseline/index.json')).json());
  const trade = async t => { t = String(t || '').toLowerCase(); if (!IDX) await idx(); if (!IDX.trades[cap(t)]) return null; return cache[t] || (cache[t] = await (await fetch(`data/baseline/${t}.json`)).json()); };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const band = () => (SET.blBand ?? (IDX ? IDX.band.warn : 25));
  B.idx = idx; B.trade = trade; B.cache = cache;
  const region = () => SET.blRegion || 'TX-FW';
  function lookup(bl) { if (!bl) return null; if (bl.occ) { const L = (IDX && IDX.labor || []).find(x => x.occ === bl.occ && x.area === bl.area); return L ? {avg:L.wage, unit:'HR', desc:L.title + ' - ' + L.area, src:'OEWS', n:null, year:L.year} : null; }
    const T = cache[String(bl.trade).toLowerCase()]; if (!T) return null; const r = T.rows.find(x => x[0] === bl.item); if (!r) return null; const p = B.pick(r, bl.region || region()); return p ? Object.assign(p, {unit:r[2], desc:r[1], item:r[0]}) : null; }
  B.lookup = lookup;
  const srcLine = (b) => { const S = IDX.sources[b.src]; return `${esc(S.label)}, ${esc(S.date)}${b.n ? ` · ${b.n} project${b.n > 1 ? 's' : ''}` : ''}${b.low != null ? ` · range ${M(b.low)}-${M(b.high)}` : ''}`; };
  function chipHTML(price, unit, bl, key) { const b = lookup(bl);
    if (!b) return `<div class="blchip none"><button class="btn sm" data-blpick="${key}" aria-label="Link a baseline cost">📊 Baseline</button> <small class="muted">${bl ? 'baseline not loaded' : 'no baseline linked - tap to pick one'}</small></div>`;
    const umatch = !unit || B.U(unit) === B.U(b.unit), v = umatch ? B.variance(price, b.avg, band()) : null, S = IDX.sources[b.src];
    return `<div class="blchip ${v && v.out ? 'out' : v ? 'in' : ''}"><button class="btn sm" data-blpick="${key}" aria-label="Change baseline">📊</button> <span><b>Baseline avg ${M(b.avg)}/${esc(b.unit)}</b>${v ? ` · yours ${M(+price)} · <b>${v.pct >= 0 ? '+' : ''}${v.pct}%</b> ${v.out ? `⚠ outside ±${v.band}% - check scope, quantity and unit` : '✓ in band'}` : !umatch ? ` · ⚠ unit mismatch (yours ${esc(unit)}, baseline ${esc(b.unit)}) - not compared` : !(+price > 0) ? ' · enter your unit price to compare' : ''}
      <details class="rsrc"><summary>Source</summary><small>${b.item ? esc(b.item) + ' ' : ''}${esc(b.desc)}<br>${srcLine(b)}${v ? `<br>Variance: ${esc(v.math)}` : ''}<br><i>${esc(S.caveat)}</i></small></details></span></div>`; }
  B.chipHTML = chipHTML;

  /* picker dialog */
  async function picker(opt) { await idx(); const d = document.createElement('dialog'); d.className = 'blpick'; d.setAttribute('aria-label', 'Pick a baseline cost');
    const trades = Object.keys(IDX.trades), isLab = opt.labor;
    d.innerHTML = `<h3>${isLab ? 'Baseline wage (BLS OEWS)' : 'Pick a baseline cost'}</h3>${isLab ? '' : `<div class="grid2"><label class="fld"><span>Trade</span><select id="blT">${trades.map(t => `<option ${t.toLowerCase() === String(opt.trade || '').toLowerCase() ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="fld"><span>Region</span><select id="blR">${['TX-FW', 'TX-DAL', 'TX-S'].map(r => `<option value="${r}" ${r === region() ? 'selected' : ''}>${IDX.sources[r].label}</option>`).join('')}</select></label></div>`}
      <label class="fld"><span>Search</span><input id="blQ" value="${esc(opt.desc || '')}" autocomplete="off"></label><div id="blL" class="list"></div><p class="small muted">No match? Leave it unlinked - the app never makes up a baseline.${isLab ? '' : ' Rebar, roofing and welding have no TxDOT bid item.'}</p>
      <div class="row"><button class="btn" id="blNone">Unlink</button><button class="btn" id="blX">Cancel</button></div>`;
    document.body.appendChild(d); d.showModal(); const fin = v => { d.close(); d.remove(); res(v); }; let res; const pr = new Promise(r => res = r);
    const draw = async () => { const q = d.querySelector('#blQ').value; let html = '';
      if (isLab) { const L = IDX.labor.filter(x => !q || B.toks(q).some(w => (x.title + ' ' + x.area).toUpperCase().includes(w))).slice(0, 40); html = L.map(x => `<button class="li" data-occ="${x.occ}" data-area="${esc(x.area)}"><b>${M(x.wage)}/hr</b> ${esc(x.title)}<small>${esc(x.area)} · OEWS ${x.year}</small></button>`).join(''); }
      else { const t = d.querySelector('#blT').value, T = await trade(t), rg = d.querySelector('#blR').value; let rows = B.suggest(T.rows, q, opt.unit, 12); if (!rows.length) rows = T.rows.filter(r => !q || B.toks(q).every(w => r[1].toUpperCase().includes(w))).slice(0, 40);
        html = rows.map(r => { const p = B.pick(r, rg); return `<button class="li" data-item="${r[0]}"><b>${p ? M(p.avg) : '—'}/${esc(r[2])}</b> ${esc(r[1])}<small>${r[0]} · ${p ? IDX.sources[p.src].label + (p.n ? ' · ' + p.n + ' proj.' : '') : ''}</small></button>`; }).join(''); }
      d.querySelector('#blL').innerHTML = html || '<p class="muted">Nothing matches.</p>';
      d.querySelectorAll('[data-item]').forEach(b => b.onclick = () => fin({trade:d.querySelector('#blT').value, item:b.dataset.item, region:d.querySelector('#blR').value}));
      d.querySelectorAll('[data-occ]').forEach(b => b.onclick = () => fin({occ:b.dataset.occ, area:b.dataset.area})); };
    d.querySelector('#blQ').oninput = draw; d.querySelectorAll('select').forEach(s => s.onchange = draw); d.querySelector('#blX').onclick = () => fin(undefined); d.querySelector('#blNone').onclick = () => fin(null); d.addEventListener('cancel', () => fin(undefined)); await draw(); return pr; }
  B.picker = picker;
  const ensure = async list => { await idx(); await Promise.all([...new Set(list.filter(b => b && b.trade).map(b => b.trade))].map(trade)); };
  B.ensure = ensure;

  /* CO lines + T&M labor */
  const coFormBL = coForm;
  coForm = async function (C) { await ensure([...(C.lines || []).map(l => l.bl), ...((C.tm && C.tm.labor) || []).map(l => l.bl)]); await coFormBL(C); const m = main();
    if (C.type === 'co') m.querySelectorAll('.ln[data-i]').forEach(row => { const l = C.lines[+row.dataset.i]; if (l) row.insertAdjacentHTML('afterend', chipHTML(l.price, l.unit, l.bl, 'co:' + row.dataset.i)); });
    if (C.type === 'tm') m.querySelectorAll('.tl[data-g=labor]').forEach(row => { const l = C.tm.labor[+row.dataset.i]; if (l) row.insertAdjacentHTML('afterend', chipHTML(l.rate, 'HR', l.bl, 'tm:' + row.dataset.i)); });
    if (C.type === 'rebar') { const at = m.querySelector('#coSend'); at && at.insertAdjacentHTML('beforebegin', `<div class="card small muted" id="blRebar">📊 Baseline: no public bid-item average exists for fabricated rebar (TxDOT pays reinforcing steel inside the concrete items). Compare against your past quotes in Bid tools.</div>`); }
    m.querySelectorAll('[data-blpick]').forEach(b => b.onclick = async () => { const [k, i] = b.dataset.blpick.split(':'), l = k === 'co' ? C.lines[+i] : C.tm.labor[+i];
      const r = await picker(k === 'tm' ? {labor:true, desc:l.who} : {trade:(l.bl && l.bl.trade) || APP.project && APP.project.trade || 'Concrete', desc:l.desc, unit:l.unit}); if (r === undefined) return; if (r) l.bl = r; else delete l.bl; await DB.put('cos', C); coForm(C); }); };
  /* quote check: out-of-band lines warn before send */
  const qcBL = RHMR.quoteCheck;
  RHMR.quoteCheck = function (C, T, text) { const r = qcBL(C, T, text); if (!IDX) return r; const add = [];
    (C.type === 'co' ? C.lines || [] : []).forEach((l, i) => { const b = lookup(l.bl); if (!b || B.U(l.unit) !== B.U(b.unit)) return; const v = B.variance(l.price, b.avg, band()); if (v && v.out) add.push({id:'bl-band', lvl:'warn', src:'Baseline costs - ' + IDX.sources[b.src].label + ' ' + IDX.sources[b.src].date, msg:`Line ${i + 1} "${l.desc || ''}" is ${v.pct > 0 ? '+' : ''}${v.pct}% vs baseline avg ${M(b.avg)}/${b.unit} (band ±${v.band}%). Check scope, quantity and unit.`}); });
    ((C.tm && C.tm.labor) || []).forEach((l, i) => { const b = lookup(l.bl); const v = b && B.variance(l.rate, b.avg, band()); if (v && v.out) add.push({id:'bl-band', lvl:'info', src:'Baseline costs - BLS OEWS', msg:`Labor ${i + 1} base rate ${M(+l.rate)} is ${v.pct > 0 ? '+' : ''}${v.pct}% vs OEWS mean ${M(b.avg)}/hr (base wage, no burden).`}); });
    if (add.length) { r.items = (r.items || []).concat(add); } return r; };
  idx().catch(() => {});

  /* takeoff lines: baseline card under the Takeoff check */
  const tkObs = new MutationObserver(async () => { if (APP.route !== 'takeoff') return; const L = APP.tkLine, ck = document.getElementById('tkCheck'); if (!L || !ck) return; const sig = JSON.stringify([L.bl, L.price, L.p, L.tpl]); const ex = document.getElementById('blCard'); if (ex && ex.dataset.sig === sig) return;
    if (ex) ex.dataset.sig = sig; await ensure([L.bl]); const r = RHM.evalLine(L), b = lookup(L.bl), row = (r.rows || []).find(x => b && B.U(x.unit) === B.U(b.unit)) || (r.rows || [])[0];
    const ext = b && row && B.U(row.unit) === B.U(b.unit) ? `<p class="small">Baseline extended: ${RHM.fmt(row.qty)} ${esc(row.unit)} × ${M(b.avg)} = <b>${M(row.qty * b.avg)}</b></p>` : '';
    const html = `<div class="card bl" id="blCard" data-sig="${esc(sig)}"><h3>Baseline cost <small class="muted">(internal - not on customer PDFs)</small></h3><label class="fld"><span>Your unit price ($ per ${esc(b ? b.unit : row ? row.unit : 'unit')}) - optional</span><input id="tkPrice" type="number" inputmode="decimal" step="any" value="${L.price ?? ''}"></label>${chipHTML(L.price, b ? b.unit : '', L.bl, 'tk')}${ext}</div>`;
    const cur = document.getElementById('blCard'); if (cur) cur.outerHTML = html; else ck.insertAdjacentHTML('afterend', html);
    const pi = document.getElementById('tkPrice'); pi.onchange = () => { L.price = pi.value === '' ? undefined : +pi.value; document.getElementById('blCard').dataset.sig = ''; tkObs.takeRecords(); document.getElementById('tkCheck').dataset.x = Date.now(); };
    document.querySelector('[data-blpick=tk]').onclick = async () => { const p = await picker({trade:L.trade, desc:L.desc || (RHM.T[L.tpl] || {}).name, unit:row && row.unit}); if (p === undefined) return; if (p) L.bl = p; else delete L.bl; document.getElementById('blCard').dataset.sig = ''; document.getElementById('tkCheck').dataset.x = Date.now(); }; });
  document.addEventListener('DOMContentLoaded', () => tkObs.observe(document.getElementById('app') || document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['data-x']}));

  /* Baseline costs screen: sources with dates + caveats, browse per trade, labor wages, diesel */
  TITLES.baseline = 'Baseline costs';
  ROUTES.baseline = async () => { await idx(); const I = IDX;
    main().innerHTML = `<h2>Baseline costs</h2><p class="hint">Real published averages to sanity-check YOUR prices. The app never fills in a price from these.</p>
    <div class="card"><h3>Sources</h3><ul class="small">${Object.values(I.sources).map(s => `<li><b>${esc(s.label)}</b> - ${esc(s.date)}<br><i>${esc(s.caveat)}</i><br><span class="muted">${esc(s.url)}</span></li>`).join('')}</ul><p class="small muted">No public baseline for: ${I.none.map(esc).join('; ')}.</p>
      <div class="grid2"><label class="fld"><span>Default region</span><select id="blReg">${['TX-FW', 'TX-DAL', 'TX-S'].map(r => `<option value="${r}" ${r === region() ? 'selected' : ''}>${I.sources[r].label}</option>`).join('')}</select></label><label class="fld"><span>Warn when outside ± % <b class="vtag">DEFAULT - CONFIRM</b></span><input id="blBand" type="number" inputmode="decimal" value="${band()}"></label></div></div>
    <div class="card"><h3>Browse by trade</h3><div class="seg wrap" role="tablist">${Object.entries(I.trades).map(([t, n]) => `<button role="tab" data-blt="${t}">${t} <small>(${n})</small></button>`).join('')}</div><label class="fld"><span>Filter</span><input id="blF"></label><div id="blRows"></div></div>
    <div class="card"><h3>Labor - BLS OEWS hourly mean (base wage, no burden)</h3><table class="t money"><thead><tr><th scope="col">Trade</th><th scope="col">Metro</th><th scope="col">$/hr</th></tr></thead><tbody>${I.labor.sort((a, b) => a.title.localeCompare(b.title)).map(x => `<tr><td>${esc(x.title)}</td><td>${esc(x.area.replace(/ MSA$/, ''))}</td><td>${M(x.wage)}</td></tr>`).join('')}</tbody></table><p class="small muted">${esc(I.sources.OEWS.label)}, ${esc(I.sources.OEWS.date)}. Midland / Odessa = oilfield metros.</p></div>
    <div class="card"><h3>Diesel - EIA Gulf Coast retail ($/gal)</h3><table class="t money"><tbody>${I.fuel.slice().reverse().map(f => `<tr><td>${f.week}</td><td>${f.usd_gal.toFixed(3)}</td></tr>`).join('')}</tbody></table><p class="small muted">${esc(I.sources.EIA.caveat)} Use it to sanity-check the fuel $/gal in the equipment picker.</p></div>`;
    $('#blReg').onchange = e => { SET.blRegion = e.target.value; saveSet(); }; $('#blBand').onchange = e => { const v = +e.target.value; if (v > 0) { SET.blBand = v; saveSet(); } };
    let cur = null; const draw = async () => { if (!cur) return; const T = await trade(cur), q = $('#blF').value, rows = T.rows.filter(r => !q || B.toks(q).every(w => (r[0] + ' ' + r[1]).toUpperCase().includes(w))).slice(0, 80);
      $('#blRows').innerHTML = `<table class="t money"><thead><tr><th scope="col">Item</th><th scope="col">Unit</th><th scope="col">Fort Worth</th><th scope="col">Dallas</th><th scope="col">Statewide</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]} ${esc(r[1])}</td><td>${esc(r[2])}</td>${[4, 5, 3].map(i => `<td>${r[i] ? M(r[i][0]) + `<small> (${r[i][3]})</small>` : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="small muted">Weighted avg $ (projects). ${T.rows.length > rows.length ? `Showing ${rows.length} of ${T.rows.length} - filter to narrow.` : ''}</p>`; };
    $$('[data-blt]').forEach(b => b.onclick = () => { cur = b.dataset.blt; $$('[data-blt]').forEach(x => x.setAttribute('aria-selected', x === b)); draw(); }); $('#blF').oninput = draw; setPrimary(null); };
})();
