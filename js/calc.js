/* Right Hand Man - pure math (shared by the app and the Node tests). No DOM. */
(function (root) {
  'use strict';
  // ASTM A615 nominal weights, lb/LF, and nominal diameters, in
  const A615 = {3:0.376,4:0.668,5:1.043,6:1.502,7:2.044,8:2.670,9:3.400,10:4.303,11:5.313,14:7.650,18:13.600};
  const DB = {3:0.375,4:0.5,5:0.625,6:0.75,7:0.875,8:1.0,9:1.128,10:1.27,11:1.41,14:1.693,18:2.257};
  const RATES = { fab:0.72, straight:0.64, epoxy:0.82, truckPerLoad:1200, tonsPerLoad:24, shopPerTon:35, burdenPct:45 };
  const r2 = x => { x = +x; const s = x < 0 ? -1 : 1; return s * Math.round((Math.abs(x) + Number.EPSILON) * 100) / 100 || 0; }; // symmetric half-up (credits round like debits)
  const r3 = x => { x = +x; const s = x < 0 ? -1 : 1; return s * Math.round((Math.abs(x) + Number.EPSILON) * 1000) / 1000 || 0; };
  const num = v => { if (v === '' || v === null || v === undefined) return NaN; const x = parseFloat(String(v).replace(/[$,]/g, '')); return isFinite(x) ? x : NaN; };
  const has = v => isFinite(num(v));
  const money = x => (x < 0 ? '-' : '') + '$' + Math.abs(r2(x || 0)).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const fmt = (x, d = 2) => (+x || 0).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
  const ceilE = x => Math.ceil(x - 1e-9);

  /* ---------- geometry ---------- */
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const polyLen = p => p.reduce((s, q, i) => i ? s + dist(p[i - 1], q) : 0, 0);
  const polyArea = p => Math.abs(p.reduce((s, q, i) => { const n = p[(i + 1) % p.length]; return s + q.x * n.y - n.x * q.y; }, 0)) / 2;
  function fmtFtIn(ft) { const neg = ft < 0; ft = Math.abs(ft); let f = Math.floor(ft + 1e-9), i = Math.round((ft - f) * 12 * 10) / 10; if (i >= 12) { f++; i = 0; } return `${neg ? '-' : ''}${f}'-${i}"`; }
  function parseLen(s) { s = String(s || '').trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
    let m = s.match(/^(\d+(?:\.\d+)?)\s*'\s*-?\s*(\d+(?:\.\d+)?)?\s*(?:(\d+)\/(\d+))?\s*"?$/); if (m) return +m[1] + ((+(m[2] || 0)) + (m[3] ? m[3] / m[4] : 0)) / 12;
    m = s.match(/^(\d+(?:\.\d+)?)\s*"$/); if (m) return +m[1] / 12; const x = parseFloat(s); return isFinite(x) ? x : NaN; }
  // Architectural/engineering scale strings -> real ft per paper inch. "1/4\"=1'-0\"" -> 4 ; "1\"=20'" -> 20
  function scaleFtPerIn(s) { s = String(s || '').replace(/\s/g, '').replace(/[”″]/g, '"').replace(/[’′]/g, "'"); const m = s.match(/^([\d./]+)"?=([\d.]+)'(?:-?(\d+)"?)?$/); if (!m) return NaN;
    const paper = m[1].includes('/') ? m[1].split('/').reduce((a, b) => a / b) : +m[1]; return (+m[2] + (+(m[3] || 0)) / 12) / paper; }

  /* ---------- takeoff library ----------
     Each template: fields [key,label,unit,required]; calc(p) -> {rows:[{desc,qty,unit,math,lap?}]}.
     A required blank never becomes a number: the line turns into an RFI. */
  const F = (k, l, u, req = true, def) => ({k, l, u, req, def});
  const T = {
    rebar_bars: { trade:'Rebar', name:'Rebar - bars (count x length)', unit:'LB', fields:[F('bar','Bar size #',''), F('count','Count','EA'), F('len','Length each','FT'), F('hooks','Hooks per bar','EA', false, 0), F('lapDb','Lap (bar dia.)','db', false, 40), F('stock','Stock length','FT', false, 40), F('coat','Coating (black/epoxy)','', false, 'black'), F('cls','fab/straight','', false, 'fab')],
      calc(p) { const bar = num(p.bar), w = A615[bar]; if (!w) return {err:'Bar size must be #3-#11, #14 or #18 (A615 table)'}; const n = num(p.count), hk = num(p.hooks) || 0, L = num(p.len) + hk * 12 * DB[bar] / 12;
        const lf = n * L, lb = lf * w, rows = [{desc:`#${bar} bars`, qty:r2(lb), unit:'LB', lf:r3(lf), bar, math:`${n} EA x ${r3(L)} FT${hk ? ` (incl. ${hk} hook x 12db = ${r3(hk * DB[bar])} FT)` : ''} = ${r3(lf)} LF x ${w} lb/LF (A615 #${bar}) = ${fmt(lb)} LB; 20-ft sticks = ROUNDUP(${r3(lf)} / 20) = ${Math.ceil(r3(lf) / 20 - 1e-9)} (ordering stick, not the cut length)`, sticks:Math.ceil(r3(lf) / 20 - 1e-9), cls:p.cls || 'fab', coat:p.coat || 'black'}];
        const stock = num(p.stock) || 40, lapFt = (num(p.lapDb) || 40) * DB[bar] / 12;
        if (L > stock) { const spl = ceilE((L - stock) / (stock - lapFt)), llf = n * spl * lapFt;
          rows.push({desc:`#${bar} laps`, lap:true, qty:r2(llf * w), unit:'LB', lf:r3(llf), bar, cls:p.cls || 'fab', coat:p.coat || 'black', math:`Bar ${r3(L)} FT > ${stock} FT stock: splices/bar = ROUNDUP((${r3(L)} - ${stock}) / (${stock} - ${r3(lapFt)})) = ${spl}; ${n} x ${spl} x ${num(p.lapDb) || 40}db (${r3(lapFt)} FT) = ${r3(llf)} LF x ${w} = ${fmt(llf * w)} LB`}); }
        return {rows}; } },
    rebar_grid: { trade:'Rebar', name:'Rebar - slab/mat grid', unit:'LB', fields:[F('bar','Bar size #',''), F('L','Length','FT'), F('W','Width','FT'), F('sp','Spacing','IN'), F('cover','Edge cover','IN', false, 3), F('mats','Mats (layers)','EA', false, 1), F('lapDb','Lap (bar dia.)','db', false, 40), F('stock','Stock length','FT', false, 40)],
      calc(p) { const bar = num(p.bar), w = A615[bar]; if (!w) return {err:'Bar size not in A615 table'}; const L = num(p.L), W = num(p.W), s = num(p.sp), c = has(p.cover) ? num(p.cover) : 3, m = num(p.mats) || 1;
        const nL = Math.floor((W * 12 - 2 * c) / s + 1e-9) + 1, nW = Math.floor((L * 12 - 2 * c) / s + 1e-9) + 1, lL = L - 2 * c / 12, lW = W - 2 * c / 12;
        const out = []; [[nL, lL, 'along L', W], [nW, lW, 'along W', L]].forEach(([n, len, tag, run]) => { const r = T.rebar_bars.calc({bar, count:n * m, len, lapDb:p.lapDb, stock:p.stock});
          r.rows[0].desc = `#${bar} ${tag}`; r.rows[0].math = `count = (FLOOR((${run} FT x 12 - 2 x ${c} IN) / ${s} IN) + 1) x ${m} mat = ${n * m}; ` + r.rows[0].math; if (r.rows[1]) r.rows[1].desc = `#${bar} laps ${tag}`; out.push(...r.rows); });
        return {rows:out}; } },
    conc_slab: { trade:'Concrete', name:'Concrete - slab/footing/wall volume', unit:'CY', fields:[F('L','Length','FT'), F('W','Width','FT'), F('D','Depth/thickness','IN'), F('n','Quantity','EA', false, 1)],
      calc(p) { const n = num(p.n) || 1, cf = num(p.L) * num(p.W) * num(p.D) / 12 * n; return {rows:[{desc:'Concrete', qty:r2(cf / 27), unit:'CY', math:`${n} x ${p.L} FT x ${p.W} FT x ${p.D} IN / 12 = ${fmt(cf)} CF / 27 = ${fmt(cf / 27)} CY (neat, no waste)`}]}; } },
    conc_pier: { trade:'Concrete', name:'Concrete - round pier/drilled shaft', unit:'CY', fields:[F('dia','Diameter','IN'), F('depth','Depth','FT'), F('n','Count','EA')],
      calc(p) { const a = Math.PI * (num(p.dia) / 12) ** 2 / 4, cf = a * num(p.depth) * num(p.n); return {rows:[{desc:'Pier concrete', qty:r2(cf / 27), unit:'CY', math:`${p.n} x pi x (${p.dia} IN / 12)^2 / 4 x ${p.depth} FT = ${fmt(cf)} CF / 27 = ${fmt(cf / 27)} CY (neat)`}]}; } },
    excav: { trade:'Excavation', name:'Excavation - bank & loose volume', unit:'CY', fields:[F('L','Length','FT'), F('W','Width (bottom)','FT'), F('D','Depth','FT'), F('slope','Side slope H:1V (0 = vertical)','', false, 0), F('swell','Swell','%', false, 0)],
      calc(p) { const L = num(p.L), W = num(p.W), D = num(p.D), z = num(p.slope) || 0, top = W + 2 * z * D, cf = L * (W + top) / 2 * D, bank = cf / 27, sw = num(p.swell) || 0;
        const rows = [{desc:'Excavation (bank)', qty:r2(bank), unit:'BCY', math:`avg end area: ${L} FT x (${W} + ${r3(top)}) / 2 FT x ${D} FT = ${fmt(cf)} CF / 27 = ${fmt(bank)} BCY`}];
        if (sw) rows.push({desc:'Haul (loose)', qty:r2(bank * (1 + sw / 100)), unit:'LCY', math:`${fmt(bank)} BCY x (1 + ${sw}%) = ${fmt(bank * (1 + sw / 100))} LCY`}); return {rows}; } },
    masonry: { trade:'Masonry', name:'Masonry - CMU wall', unit:'EA', fields:[F('L','Wall length','FT'), F('H','Wall height','FT'), F('open','Openings','SF', false, 0), F('per','Units per SF','EA/SF', false, 1.125)],
      calc(p) { const sf = num(p.L) * num(p.H) - (num(p.open) || 0), per = num(p.per) || 1.125; return {rows:[{desc:'CMU wall area', qty:r2(sf), unit:'SF', math:`${p.L} x ${p.H} - ${num(p.open) || 0} SF openings = ${fmt(sf)} SF`}, {desc:'CMU units', qty:Math.ceil(sf * per), unit:'EA', math:`${fmt(sf)} SF x ${per} units/SF (8x16 block) = ROUNDUP ${Math.ceil(sf * per)} EA (no waste)`}]}; } },
    steel: { trade:'Steel', name:'Structural steel - members', unit:'TON', fields:[F('shape','Shape (e.g., W12x26)',''), F('lbft','Weight per AISC table','LB/FT'), F('len','Length each','FT'), F('n','Count','EA')],
      calc(p) { const lb = num(p.lbft) * num(p.len) * num(p.n); return {rows:[{desc:`${p.shape}`, qty:r3(lb / 2000), unit:'TON', math:`${p.n} x ${p.len} FT x ${p.lbft} lb/FT (AISC, user-entered) = ${fmt(lb)} LB / 2000 = ${r3(lb / 2000)} TON`}]}; } },
    piping: { trade:'Piping', name:'Piping - run + fittings', unit:'LF', fields:[F('size','Size/material',''), F('lf','Measured run','LF'), F('fit','Fittings','EA', false, 0)],
      calc(p) { const rows = [{desc:`${p.size} pipe`, qty:r2(num(p.lf)), unit:'LF', math:`measured ${p.lf} LF (no waste added)`}]; if (num(p.fit)) rows.push({desc:`${p.size} fittings`, qty:num(p.fit), unit:'EA', math:`${p.fit} EA counted`}); return {rows}; } },
    electrical: { trade:'Electrical', name:'Electrical - conduit & wire', unit:'LF', fields:[F('size','Conduit size/type',''), F('lf','Conduit run','LF'), F('cond','Conductors per run','EA'), F('extra','Wire allowance (pull/makeup)','%', false, 10)],
      calc(p) { const lf = num(p.lf), w = lf * num(p.cond) * (1 + (num(p.extra) || 0) / 100); return {rows:[{desc:`${p.size} conduit`, qty:r2(lf), unit:'LF', math:`measured ${lf} LF`}, {desc:'Conductor', qty:r2(w), unit:'LF', math:`${lf} LF x ${p.cond} conductors x (1 + ${num(p.extra) || 0}%) = ${fmt(w)} LF`}]}; } },
    coatings: { trade:'Coatings', name:'Coatings - area to gallons', unit:'GAL', fields:[F('sf','Area','SF'), F('coats','Coats','EA'), F('cov','Coverage per product data','SF/GAL')],
      calc(p) { const g = num(p.sf) * num(p.coats) / num(p.cov); return {rows:[{desc:'Coating area', qty:r2(num(p.sf)), unit:'SF', math:`${p.sf} SF`}, {desc:'Coating', qty:r2(g), unit:'GAL', math:`${p.sf} SF x ${p.coats} coats / ${p.cov} SF/GAL (product data sheet) = ${fmt(g)} GAL`}]}; } },
    roofing: { trade:'Roofing', name:'Roofing - squares', unit:'SQ', fields:[F('sf','Plan area','SF'), F('pitch','Pitch (rise per 12)','IN', false, 0)],
      calc(p) { const k = Math.sqrt(144 + (num(p.pitch) || 0) ** 2) / 12, sf = num(p.sf) * k; return {rows:[{desc:'Roof area', qty:r2(sf), unit:'SF', math:`${p.sf} SF plan x slope factor sqrt(12^2 + ${num(p.pitch) || 0}^2)/12 = ${r3(k)} = ${fmt(sf)} SF`}, {desc:'Roofing', qty:r2(sf / 100), unit:'SQ', math:`${fmt(sf)} SF / 100 = ${fmt(sf / 100)} SQ`}]}; } },
    welding: { trade:'Welding', name:'Welding - fillet weld length', unit:'LF', fields:[F('size','Fillet size','IN'), F('lf','Weld length each','IN'), F('n','Count','EA')],
      calc(p) { const lf = num(p.lf) * num(p.n) / 12; return {rows:[{desc:`${p.size}" fillet weld`, qty:r2(lf), unit:'LF', math:`${p.n} EA x ${p.lf} IN / 12 = ${fmt(lf)} LF`}]}; } },
    measured: { trade:'General', name:'Measured from plan (length/area/count/volume)', unit:'', fields:[F('qty','Quantity',''), F('unit','Unit','')],
      calc(p) { return {rows:[{desc:p.desc || 'Measured', qty:r3(num(p.qty)), unit:p.unit || '', math:p.math || `measured ${p.qty} ${p.unit}`}]}; } },
  };
  // Evaluate one takeoff line. Rules: blanks -> RFI; carry the higher defensible quantity when a plan-scheduled qty is given.
  function evalLine(line) { const t = T[line.tpl]; if (!t) return {rfi:['Unknown template'], rows:[]};
    const p = Object.assign({}, line.p || {}); t.fields.forEach(f => { if (f.u === 'FT' && typeof p[f.k] === 'string' && /['"]/.test(p[f.k])) { const v = parseLen(p[f.k]); if (v > 0) p[f.k] = String(v); } if (f.u === 'IN' && typeof p[f.k] === 'string' && /"$/.test(p[f.k].trim())) p[f.k] = String(parseFloat(p[f.k])); if (!has(p[f.k]) && (p[f.k] === undefined || String(p[f.k]).trim() === '') && f.def !== undefined) p[f.k] = f.def; });
    const miss = t.fields.filter(f => f.req && (p[f.k] === undefined || String(p[f.k]).trim() === '' || (f.u && !has(p[f.k])))).map(f => f.l);
    const cite = []; if (!line.sheet) cite.push('sheet no.'); if (!line.page) cite.push('PDF page'); if (!line.spec) cite.push('spec section');
    const junk = t.fields.filter(f => f.u && !miss.includes(f.l) && p[f.k] !== undefined && String(p[f.k]).trim() !== '' && !has(p[f.k])).map(f => `${f.l} ("${String(p[f.k]).slice(0, 20)}")`);
    if (junk.length) return {rfi:junk.map(m => `RFI: ${m} is not a number - fix or clear it`), rows:[], citeMissing:cite};
    if (miss.length) return {rfi:miss.map(m => `RFI: "${m}" not shown/confirmed - quantity not carried`), rows:[], citeMissing:cite};
    const r = t.calc(p); if (r.err) return {rfi:[`RFI: ${r.err}`], rows:[], citeMissing:cite};
    const badRow = r.rows.find(x => !isFinite(x.qty) || /NaN|Infinity/.test(String(x.math).replace(/\b(NaN|Infinity)\b(?=[^;]*$)/, '')) && !Object.values(line.p || {}).some(v => /NaN|Infinity/i.test(String(v))));
    if (badRow) return {rfi:[`RFI: input out of range for "${badRow.desc}" (a divisor is 0, or a value is too large) - check the entries`], rows:[], citeMissing:cite};
    const neg = r.rows.find(x => x.qty < 0 && !x.credit); if (neg) return {rfi:[`RFI: "${neg.desc}" computes negative (${fmt(neg.qty)} ${neg.unit}) - check deductions vs. the gross`], rows:[], citeMissing:cite};
    r.rows.forEach(x => { x.calcQty = x.qty; });
    if (has(line.schedQty) && r.rows.length) { const x = r.rows[0], s = num(line.schedQty);
      if (s > x.qty) { x.math += `; plan schedule shows ${fmt(s)} ${x.unit} > computed ${fmt(x.qty)} -> carry higher ${fmt(s)}`; x.qty = s; x.carried = 'schedule'; }
      else x.math += `; plan schedule ${fmt(s)} ${x.unit} <= computed -> carry computed ${fmt(x.qty)}`; }
    return {rfi:[], rows:r.rows, citeMissing:cite}; }

  /* ---------- Rebar-Fab quote ---------- */
  // lines: [{desc, lb, cls:'fab'|'straight', coat:'black'|'epoxy'}]
  function rebarQuote(lines, rates) { const R = Object.assign({}, RATES, rates || {});
    let fabLb = 0, strLb = 0, epxLb = 0, mat = 0; const skipped = lines.map((l, i) => ({i, l})).filter(x => (x.l.desc || has(x.l.lb)) && !(num(x.l.lb) > 0)).map(x => `Line ${x.i + 1}${x.l.desc ? ' (' + x.l.desc + ')' : ''}: ${has(x.l.lb) ? 'LB must be more than 0' : 'LB is blank'} - not priced`); const rows = lines.filter(l => num(l.lb) > 0).map(l => { const lb = num(l.lb), epoxy = l.coat === 'epoxy', rate = epoxy ? R.epoxy : (l.cls === 'straight' ? R.straight : R.fab);
      if (l.cls === 'straight') strLb += lb; else fabLb += lb; if (epoxy) epxLb += lb; const m = r2(lb * rate); mat += m; return Object.assign({}, l, {lb, rate, material:m}); });
    const totLb = fabLb + strLb, tons = totLb / 2000, loads = totLb > 0 ? ceilE(tons / R.tonsPerLoad) : 0, trucking = loads * R.truckPerLoad, fabTons = fabLb / 2000, shop = r2(fabTons * R.shopPerTon);
    mat = r2(mat); return { rows, skipped, fabLb:r2(fabLb), strLb:r2(strLb), epxLb:r2(epxLb), totLb:r2(totLb), tons:r3(tons), loads, material:mat, trucking:r2(trucking), shop, total:r2(mat + trucking + shop),
      math:{ trucking:`ROUNDUP(${r3(tons)} T / ${R.tonsPerLoad}) = ${loads} load(s) x ${money(R.truckPerLoad)} = ${money(trucking)}`, shop:`${r3(fabTons)} fabricated T x ${money(R.shopPerTon)}/T = ${money(shop)} (straight bars excluded)` } }; }
  // T&M ticket: labor at base rate x (1 + burden); materials; equipment; optional markup
  function tmTicket(t, burdenPct = RATES.burdenPct) { const lab = (t.labor || []).map(l => { const base = num(l.hrs) * num(l.rate) || 0, ot = (num(l.ot) || 0) * num(l.rate) * 1.5 || 0, burd = (base + ot) * burdenPct / 100; return Object.assign({}, l, {base:r2(base), otAmt:r2(ot), burden:r2(burd), amt:r2(base + ot + burd)}); });
    const mat = (t.mat || []).map(m => Object.assign({}, m, {amt:r2((num(m.qty) || 0) * (num(m.price) || 0))})), eq = (t.eq || []).map(m => Object.assign({}, m, {amt:r2((num(m.hrs) || 0) * (num(m.rate) || 0))}));
    const L = r2(lab.reduce((s, x) => s + x.amt, 0)), M = r2(mat.reduce((s, x) => s + x.amt, 0)), E = r2(eq.reduce((s, x) => s + x.amt, 0)), mk = num(t.markupPct) || 0, markup = r2((L + M + E) * mk / 100);
    return {lab, mat, eq, L, M, E, markup, total:r2(L + M + E + markup)}; }

  /* ---------- Cost data (user CSV, e.g., licensed RSMeans export) ---------- */
  function parseCSV(text) { const rows = []; let row = [], f = '', q = false; text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
    if (f !== '' || row.length) { row.push(f); rows.push(row); } return rows.filter(r => r.some(x => x.trim() !== '')); }
  const COST_FIELDS = { line:/line|^id$|code|number/i, desc:/desc/i, unit:/^unit$|^uom$|unit of/i, mat:/^mat|material/i, lab:/^lab|labor(?!.*hour)/i, eq:/^equip|equipment|^eq$/i, crew:/crew/i, out:/daily|output/i, lh:/labor.?h|man.?h|hours/i, src:/source|^src$/i };
  function mapCostCSV(text, defaultSrc) { const rows = parseCSV(text); if (!rows.length) return {items:[], map:{}, skipped:0}; const hdr = rows[0].map(h => h.trim()), map = {};
    Object.entries(COST_FIELDS).forEach(([k, re]) => { const i = hdr.findIndex((h, j) => re.test(h) && !Object.values(map).includes(j) && !(k === 'lab' && /hour/i.test(h))); if (i >= 0) map[k] = i; });
    let skipped = 0; const items = rows.slice(1).map(r => { const g = k => map[k] === undefined ? '' : (r[map[k]] || '').trim(); if (!g('desc')) { skipped++; return null; }
      return { line:g('line'), desc:g('desc'), unit:g('unit'), mat:num(g('mat')), lab:num(g('lab')), eq:num(g('eq')), crew:g('crew'), out:num(g('out')), lh:num(g('lh')), src:g('src') || defaultSrc || 'Imported' }; }).filter(Boolean);
    return {items, map, skipped}; }
  // City cost index: national bare cost x (index/100); separate material and installation indices
  function costAdj(it, cci) { const mi = (num(cci && cci.mat) || 100) / 100, ii = (num(cci && cci.inst) || 100) / 100; const m = (it.mat || 0) * mi, l = (it.lab || 0) * ii, e = (it.eq || 0) * ii;
    return {mat:r2(m), lab:r2(l), eq:r2(e), total:r2(m + l + e)}; }

  /* ---------- Pay application (AIA G702/G703 style) ---------- */
  // sov: [{id,item,desc,sched}], prev: {id:{work,stored}} from the last app, cur: {id:{work (this period $), stored (balance stored now $), pct?}}
  function payApp(o) { const ret = num(o.retainPct) || 0, retS = has(o.retainStoredPct) ? num(o.retainStoredPct) : ret, tax = num(o.taxPct) || 0;
    const lines = (o.sov || []).map(s => { const p = (o.prev || {})[s.id] || {}, c = (o.cur || {})[s.id] || {}; const C = num(s.sched) || 0, D = r2((num(p.work) || 0)), E = r2(num(c.work) || 0), F = r2(num(c.stored) || 0), G = r2(D + E + F);
      const Iw = r2((D + E) * ret / 100), Is = r2(F * retS / 100), I = r2(Iw + Is); return {id:s.id, item:s.item, desc:s.desc, C, D, E, F, G, Iw, Is, pct:C ? G / C * 100 : 0, H:r2(C - G), I, over:G > C + 0.005, co:!!s.co}; });
    const S = k => r2(lines.reduce((a, l) => a + l[k], 0)); const orig = r2(lines.filter(l => !l.co).reduce((a, l) => a + l.C, 0)), coNet = r2(lines.filter(l => l.co).reduce((a, l) => a + l.C, 0));
    const G = S('G'), taxAmt = r2(G * tax / 100), retWork = S('Iw'), retStored = S('Is'); // G702 line 5 = sum of the rounded G703 column I lines (no penny drift)
    const l4 = r2(G + taxAmt), l5 = r2(retWork + retStored), l6 = r2(l4 - l5), l7 = r2(num(o.prevCert) || 0), l8 = r2(l6 - l7), l3 = r2(orig + coNet);
    return { lines, totals:{C:S('C'), D:S('D'), E:S('E'), F:S('F'), G, H:S('H'), I:S('I')}, g702:{l1:orig, l2:coNet, l3, l4, tax:taxAmt, l5a:retWork, l5b:retStored, l5:l5, l6, l7, l8, l9:r2(l3 + taxAmt - l6)} }; }
  // Roll an app forward: next "from previous" = previous D+E (work in place); stored carries as its own balance
  function rollForward(app) { const prev = {}; app.lines.forEach(l => { prev[l.id] = {work:r2(l.D + l.E), stored:l.F}; }); return {prev, prevCert:app.g702.l6}; }

  /* ---------- Daily log ---------- */
  function logTotals(log, planQty) { const hrs = (log.crew || []).reduce((s, c) => s + (num(c.hrs) || 0) * (num(c.n) || 1), 0);
    const qty = (log.qty || []).map(q => { const plan = num((planQty || {})[q.sovId]) || num(q.plan) || 0, done = num(q.qty) || 0; return Object.assign({}, q, {plan, pct:plan ? done / plan * 100 : null, rate:hrs ? done / hrs : null}); });
    return {hrs:r2(hrs), qty}; }

  /* ---------- text lint for outgoing documents ---------- */
  function lintQuoteText(s) { const issues = []; if (/\ball[\s\-]+in\b/i.test(s)) issues.push('Contains the words "all-in"'); if (/\$\d{4,}(?!,)/.test(s.replace(/\$\d{1,3}(,\d{3})+(\.\d{2})?/g, ''))) issues.push('Dollar amount without commas'); return issues; }


  /* ---------- Shop drawings: bar list / bending schedule ----------
     Shapes are described by out-to-out legs as on CRSI/ACI 315 bending diagrams. The CRSI figure code is user-entered (crsi) - never guessed.
     Cut length = sum of legs + hook detailing dimension A/G per CRSI MSP standard hook tables (CRSI_HOOK below); no bend deductions applied. */
  const SHAPES = {
    STR:{name:'Straight', legs:['A'], fab:false},
    L90:{name:'90° bend (L)', legs:['A','B'], fab:true},
    U:{name:'U-bar (two 90°)', legs:['A','B','C'], fab:true},
    Z:{name:'Offset / Z-bar', legs:['A','B','C'], fab:true},
    HK90:{name:'Straight + 90° std hook one end', legs:['A'], hooks:[['90',1]], fab:true},
    HK180:{name:'Straight + 180° std hook one end', legs:['A'], hooks:[['180',1]], fab:true},
    TIE:{name:'Closed tie / stirrup, 135° hooks', legs:['A','B'], perim:true, hooks:[['135',2]], fab:true},
    STIR:{name:'Open stirrup, 135° hooks', legs:['A','B','C'], hooks:[['135',2]], fab:true},
    HOOP:{name:'Circular hoop (lap = C)', legs:['D','C'], hoop:true, fab:true},
  };
  /* CRSI Manual of Standard Practice "Standard Hooks" detailing dimension A or G (inches), ACI 318 bend diameters. Added to the out-to-out straight length.
     End hooks: 90/180. Stirrup & tie hooks: 's90' / '135'. Sources: CRSI MSP Table (recommended end hooks; stirrup/tie hooks), reproduced e.g. NCDOT Structures Fig. 10-11, irebar.com Standard Bar Hooks. */
  const FLAGS = {crsi:' [VERIFY vs CRSI manual]'};
  const CRSI_HOOK = { '180':{3:5,4:6,5:7,6:8,7:10,8:11,9:15,10:17,11:19,14:27,18:36}, '90':{3:6,4:8,5:10,6:12,7:14,8:16,9:19,10:22,11:24,14:31,18:41},
    's90':{3:4,4:4.5,5:6,6:12,7:14,8:16}, '135':{3:4,4:4.5,5:5.5,6:8,7:9,8:10.5} };
  const hookExt = (type, bar) => { const v = (CRSI_HOOK[type] || {})[bar]; return v ? v / 12 : NaN; };
  function barMark(b) { const sh = SHAPES[b.shape] || SHAPES.STR, bar = num(b.bar), w = A615[bar], rfi = [];
    if (!w) rfi.push('bar size'); if (!(num(b.count) > 0)) rfi.push('count'); (sh.hooks || []).forEach(([t]) => { if (w && !(hookExt(t, bar) > 0)) rfi.push(`CRSI ${t}° hook size (not tabulated for #${bar})`); }); const L = {}; sh.legs.forEach(k => { const v = parseLen(b.legs && b.legs[k]); if (v > 0) L[k] = v; else rfi.push(`leg ${k}`); });
    if (rfi.length) return {mark:b.mark, ok:false, rfi:`RFI: ${rfi.join(', ')} not printed on plans for mark ${b.mark || '?'} (${b.where || 'location ?'}) - not detailed`, shape:sh.name};
    let len, parts = [];
    if (sh.hoop) { len = Math.PI * L.D + L.C; parts.push(`pi x ${fmtFtIn(L.D)} + lap ${fmtFtIn(L.C)}`); }
    else if (sh.perim) { len = 2 * (L.A + L.B); parts.push(`2 x (${fmtFtIn(L.A)} + ${fmtFtIn(L.B)})`); }
    else { len = sh.legs.reduce((s, k) => s + L[k], 0); parts.push(sh.legs.map(k => `${k} ${fmtFtIn(L[k])}`).join(' + ')); }
    (sh.hooks || []).forEach(([t, n]) => { const e = hookExt(t, bar); len += n * e; parts.push(`${n} x ${t}° hook CRSI A/G ${r3(e * 12)} in${FLAGS.crsi}`); });
    const n = num(b.count), lb = n * len * w, warn = len > 60 ? `cut length ${fmtFtIn(len)} exceeds 60 ft stock - detail splices per plan lap schedule (RFI if laps not shown)` : '';
    return {warn, mark:b.mark, ok:true, bar, count:n, shape:sh.name, shapeKey:b.shape, crsi:b.crsi || '', legs:L, len:r3(len), lenTxt:fmtFtIn(len), lb:r2(lb), fab:sh.fab, where:b.where || '', sheet:b.sheet || '', page:b.page || '',
      math:`${parts.join(' + ')} = ${fmtFtIn(len)}; ${n} x ${r3(len)} FT x ${w} lb/LF = ${fmt(lb)} LB`}; }
  function barList(marks, rates) { const R = Object.assign({}, RATES, rates || {}); const rows = marks.map(barMark), ok = rows.filter(r => r.ok);
    const fabLb = ok.filter(r => r.fab).reduce((s, r) => s + r.lb, 0), strLb = ok.filter(r => !r.fab).reduce((s, r) => s + r.lb, 0), shop = r2(fabLb / 2000 * R.shopPerTon);
    return {rows, rfis:rows.filter(r => !r.ok).map(r => r.rfi), fabLb:r2(fabLb), strLb:r2(strLb), totLb:r2(fabLb + strLb), fabTons:r3(fabLb / 2000), shop, shopMath:`${r3(fabLb / 2000)} fabricated T x ${money(R.shopPerTon)}/T = ${money(shop)} (straight bars excluded)`}; }

  /* ---------- Reduced-set detection ----------
     Full-size plan sheets are ARCH D 24x36 / ANSI D 22x34 / ARCH E 36x48 / ANSI E 34x44. An 11x17 or letter page carrying an architectural or engineering scale is
     usually a half-size (or smaller) print, so a typed printed scale would measure wrong. */
  const PAPERS = [[8.5,11,'Letter'],[11,17,'11x17 (ANSI B)'],[12,18,'12x18 (ARCH B)'],[18,24,'18x24 (ARCH C)'],[17,22,'17x22 (ANSI C)'],[22,34,'22x34 (ANSI D)'],[24,36,'24x36 (ARCH D)'],[30,42,'30x42'],[34,44,'34x44 (ANSI E)'],[36,48,'36x48 (ARCH E)']];
  function paperInfo(wPt, hPt, text) { const a = Math.min(wPt, hPt) / 72, b = Math.max(wPt, hPt) / 72, p = PAPERS.find(([x, y]) => Math.abs(x - a) < 0.35 && Math.abs(y - b) < 0.35), t = String(text || '');
    const half = /\b(half[\s-]*size|1\/2[\s-]*size|reduced (print|size|set|copy))\b/i.test(t), fullNote = t.match(/\b(22\s*["]?\s*x\s*34|24\s*["]?\s*x\s*36|34\s*["]?\s*x\s*22|36\s*["]?\s*x\s*24)\b/i), small = b <= 17.6;
    const reduced = half || small, factor = half ? 2 : fullNote && small ? r3(parseFloat(fullNote[1].match(/\d+$/)[0]) / b) : null;
    return { inW:r2(a), inH:r2(b), name:p ? p[2] : `${r2(a)}x${r2(b)} in`, reduced, factor, reason:half ? 'sheet text says half-size / reduced' : small ? `page is only ${p ? p[2] : r2(a) + 'x' + r2(b) + ' in'} - full-size plan sheets are 22x34 or 24x36` : '' }; }
  // "1-5, 8, 10-12" -> [1,2,3,4,5,8,10,11,12] within 1..n, max entries
  function parseRange(str, n, max = 60) { const out = new Set(); String(str || '').split(/[,;\s]+/).filter(Boolean).forEach(t => { const m = t.match(/^(\d+)(?:-(\d+))?$/); if (!m) return; let a = +m[1], b = m[2] ? +m[2] : a; if (a > b) [a, b] = [b, a]; for (let i = Math.max(1, a); i <= Math.min(n, b); i++) out.add(i); });
    return [...out].sort((a, b) => a - b).slice(0, max); }
  const api = {FLAGS, parseRange, paperInfo, CRSI_HOOK, hookExt, SHAPES, barMark, barList, A615, DB, RATES, T, r2, r3, num, has, money, fmt, ceilE, dist, polyLen, polyArea, fmtFtIn, parseLen, scaleFtPerIn, evalLine, rebarQuote, tmTicket, parseCSV, mapCostCSV, costAdj, payApp, rollForward, logTotals, lintQuoteText};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RHM = api;
})(typeof self !== 'undefined' ? self : this);
