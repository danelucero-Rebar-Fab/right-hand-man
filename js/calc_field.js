/* Right Hand Man v1.9.1 - field + bid math (pure, unit tested). Nothing here holds a price or rate. */
(function (root, f) { const m = f(); if (typeof module === 'object' && module.exports) module.exports = m; else root.RHMF = m; })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const has = v => v !== null && v !== undefined && typeof v !== 'boolean' && String(v).trim() !== '' && isFinite(+v); // v1.9.1: whitespace-only = blank (RFI), never a real $0
  const num = v => has(v) ? +v : 0;
  const r2 = x => { const s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 100 + 1e-9) / 100; };
  const $ = x => (x < 0 ? '-$' : '$') + Math.abs(r2(x)).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const f2 = x => (+r2(x)).toLocaleString('en-US', {maximumFractionDigits:2});

  /* earned value per SOV line: installed from daily logs, actual cost from timecards (hrs x entered rate) + receiving $ */
  function earnedValue(sov, logs, times, recv) {
    const rfi = [], lines = (sov || []).map(s => {
      const qty = num(s.qty), bac = has(s.budget) ? num(s.budget) : r2(qty * num(s.price) || num(s.sched)), basis = has(s.budget) ? 'cost budget' : 'contract value (no cost budget entered)';
      const inst = r2((logs || []).reduce((a, L) => a + (L.qty || []).filter(q => q.sovId === s.id).reduce((b, q) => b + num(q.qty), 0), 0));
      const pct = qty > 0 ? Math.min(inst / qty, 1) : 0, ev = r2(bac * pct);
      let ac = 0; const tl = (times || []).filter(t => t.sovId === s.id);
      tl.forEach(t => { if (!has(t.rate)) rfi.push(`Timecard ${t.date || ''} ${t.who || ''} (${s.item || ''} ${s.desc || ''}): $/hr blank - counted $0`); ac += num(t.hrs) * num(t.rate); });
      const rc = (recv || []).filter(r => r.sovId === s.id); rc.forEach(r => { if (!has(r.amt)) rfi.push(`Receiving ${r.date || ''} ${r.desc || ''}: $ blank - counted $0`); ac += num(r.amt); }); ac = r2(ac);
      const cpi = ac > 0 ? ev / ac : null, eac = cpi ? r2(bac / cpi) : (ac > 0 ? null : bac), etc = eac === null ? null : r2(eac - ac);
      const math = `Installed ${f2(inst)} of ${f2(qty)} ${s.unit || ''} = ${f2(pct * 100)}%; EV = ${$(bac)} (${basis}) x ${f2(pct * 100)}% = ${$(ev)}; AC = ${tl.length} timecard(s) + ${rc.length} receipt(s) = ${$(ac)}` +
        (cpi ? `; CPI = EV / AC = ${$(ev)} / ${$(ac)} = ${cpi.toFixed(2)}; EAC = BAC / CPI = ${$(bac)} / ${cpi.toFixed(2)} = ${$(eac)}; cost to complete = EAC - AC = ${$(etc)}` : ac > 0 ? '; no earned value yet - forecast needs installed quantities' : '; no cost yet - forecast = budget');
      return {id:s.id, item:s.item, desc:s.desc, unit:s.unit, qty, inst, pct:r2(pct * 100), bac, ev, ac, cpi:cpi && +cpi.toFixed(2), eac, etc, math};
    });
    const T = k => r2(lines.reduce((a, l) => a + (l[k] || 0), 0)), BAC = T('bac'), EV = T('ev'), AC = T('ac'), CPI = AC > 0 && EV > 0 ? EV / AC : null, EAC = CPI ? r2(BAC / CPI) : null;
    return {lines, rfi, BAC, EV, AC, pct:BAC ? r2(EV / BAC * 100) : 0, CPI:CPI && +CPI.toFixed(2), EAC, ETC:EAC === null ? null : r2(EAC - AC),
      math:`Project: EV ${$(EV)} of BAC ${$(BAC)} = ${BAC ? f2(EV / BAC * 100) : 0}% complete; AC ${$(AC)}` + (CPI ? `; CPI ${$(EV)} / ${$(AC)} = ${CPI.toFixed(2)}; EAC ${$(BAC)} / ${CPI.toFixed(2)} = ${$(EAC)}; cost to complete ${$(EAC - AC)}` : '; CPI needs both EV and AC')};
  }

  /* bid-day leveling: each bidder's base + plugs for scopes they excluded */
  function level(scopes, bidders) {
    const rfi = [], rows = (bidders || []).map(b => {
      if (!has(b.base)) rfi.push(`${b.name || 'Bidder'}: base quote blank`);
      let adds = 0; const parts = [];
      (scopes || []).forEach(s => { const inc = (b.incl || {})[s.id]; if (inc === false) { if (!has(s.plug)) rfi.push(`Plug for "${s.name}" (excluded by ${b.name || 'bidder'}) is blank - enter your own number`); adds += num(s.plug); parts.push(`+ ${s.name} plug ${$(num(s.plug))}`); } });
      const lev = r2(num(b.base) + adds);
      return {name:b.name || 'Bidder', base:num(b.base), adds:r2(adds), leveled:lev, ok:has(b.base), math:`${$(num(b.base))} base ${parts.join(' ')} = ${$(lev)} leveled`};
    });
    const valid = rows.filter(r => r.ok), low = valid.length ? valid.reduce((a, r) => r.leveled < a.leveled ? r : a) : null;
    rows.forEach(r => { r.low = r === low; r.over = low ? r2(r.leveled - low.leveled) : 0; });
    return {rows, low, rfi};
  }

  function waste(qty, pct) { const q = num(qty), p = num(pct), out = r2(q * (1 + p / 100)); return {qty:out, math:`${f2(q)} x (1 + ${f2(p)}% waste) = ${f2(out)}`}; }

  function alternates(base, alts) { let t = num(base); const lines = (alts || []).map(a => { const amt = num(a.amt) * (a.kind === 'deduct' ? -1 : 1); if (a.accepted) t += amt; return {...a, signed:r2(amt)}; });
    const acc = lines.filter(a => a.accepted); return {lines, total:r2(t), math:`Base ${$(num(base))}${acc.map(a => ` ${a.signed < 0 ? '-' : '+'} ${a.name || 'Alt'} ${$(Math.abs(a.signed))}`).join('')} = ${$(t)}`}; }

  /* escalation on unshipped tons: tons x 20 cwt/ton x $/cwt x quarters past the firm date */
  function quartersAfter(firm, asOf) { if (!firm || !asOf) return 0; const a = new Date(firm + 'T00:00:00'), b = new Date(asOf + 'T00:00:00'); if (!(b > a)) return 0;
    const m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() > a.getDate() ? 1 : 0); return Math.max(1, Math.ceil(m / 3)); }
  const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(new Date(v + 'T00:00:00'));
  function escalation(o) { o = Object.assign({}, o || {}); const rfi = []; if (!o.firm) rfi.push('Firm-through date blank'); else if (!isDate(o.firm)) { rfi.push(`Firm-through date "${String(o.firm).slice(0, 20)}" is not a date - counted 0 quarters`); o.firm = ''; }
    if (o.asOf && !isDate(o.asOf)) o.asOf = ''; if (!has(o.cwt)) rfi.push('$/cwt per quarter blank - escalation counted $0');
    const q = quartersAfter(o.firm, o.asOf), tons = num(o.tons), amt = r2(tons * 20 * num(o.cwt) * q);
    const clause = `Prices are firm for material shipped through ${o.firm || '__________'}. Material shipped after that date will be adjusted by ${has(o.cwt) ? $(num(o.cwt)) : '$____'} per cwt (100 lb) for each calendar quarter or part of a quarter after that date, applied to unshipped tons only. Tariffs, duties and mill surcharges enacted after the quote date are passed through at cost with documentation.`;
    return {quarters:q, amt, rfi, clause, math:`${f2(tons)} unshipped tons x 20 cwt/ton x ${$(num(o.cwt))}/cwt x ${q} quarter(s) after ${o.firm || '(blank)'} = ${$(amt)}`}; }

  const BIDQ = [['fit', 'Is the work in our trade and capacity (crew, shop, equipment) in the bid window?'], ['ga', 'Do we know the GC/owner and are they good payers?'], ['bond', 'Can we meet bond / insurance requirements?'], ['docs', 'Are plans and specs complete enough to price (or can we RFI in time)?'], ['time', 'Is there time to get supplier and sub quotes before bid day?'], ['sched', 'Does the schedule fit our backlog?'], ['terms', 'Are the contract terms acceptable (retainage, pay-when-paid, LDs, escalation)?'], ['margin', 'Is the competition such that we can make our margin?'], ['loc', 'Is the location within our trucking / travel range?'], ['risk', 'Are site and safety risks known and manageable?']];
  function bidScore(ans) { ans = ans || {}; const yes = BIDQ.filter(([k]) => ans[k] === 'y').length, no = BIDQ.filter(([k]) => ans[k] === 'n').length, open = BIDQ.length - yes - no;
    const rec = open ? 'Answer all questions' : no >= 3 ? 'NO-BID (3 or more "no")' : no ? 'BID with caution - price the "no" items as risk or clarify them' : 'BID';
    return {yes, no, open, rec, math:`${yes} yes / ${no} no / ${open} open of ${BIDQ.length}; rule: 0 no = bid, 1-2 no = bid with caution, 3+ no = no-bid`}; }

  function daysOpen(opened, closed, today) { if (!opened) return null; const a = new Date(opened + 'T00:00:00'), b = new Date((closed || today) + 'T00:00:00'); if (isNaN(a) || isNaN(b)) return null; return Math.max(0, Math.round((b - a) / 864e5)); }

  const csvCell = v => { v = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(v) || /^[=+\-@]/.test(v) ? '"' + (/^[=+\-@]/.test(v) ? "'" : '') + v.replace(/"/g, '""') + '"' : v; };
  const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  function parseCSV(t) { const rows = []; let row = [], c = '', q = false; t = String(t || '').replace(/^\ufeff/, '');
    for (let i = 0; i < t.length; i++) { const ch = t[i]; if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(c); c = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(c); rows.push(row); row = []; c = ''; } else c += ch; }
    if (c !== '' || row.length) { row.push(c); rows.push(row); } return rows.filter(r => r.some(x => String(x).trim() !== '')); }

  /* unit price bid form: item no, description, unit, qty, unit price (blank = RFI) */
  /* v1.9.1: TxDOT forms often print "1,250" or "$1,200.50" - strip $ , and spaces so the number is kept (junk stays as typed -> RFI) */
  const numCell = v => { const t = String(v == null ? '' : v).trim(), c = t.replace(/[$,\s]/g, ''); return c !== '' && /^-?(\d+\.?\d*|\.\d+)$/.test(c) ? c : t; };
  function bidForm(rows) { const h = (rows[0] || []).map(x => String(x).toLowerCase().trim()), ix = (...k) => h.findIndex(x => k.some(n => x.includes(n)));
    const iD = ix('desc'), iQ = ix('qty', 'quant'), iP = ix('price', 'rate'), iW = ix('waste');
    let iU = h.findIndex(x => x === 'unit' || x === 'units' || x === 'uom' || x === 'u/m'); if (iU < 0) iU = h.findIndex((x, i) => i !== iP && /\bunit|uom/.test(x) && !/price|cost|rate|\$/.test(x));
    let iI = h.findIndex(x => /^(bid )?item( no\.?| #| number)?$/.test(x)); if (iI < 0) iI = h.findIndex((x, i) => ![iD, iU, iQ, iP, iW].includes(i) && /item|^no\.?$|^#$/.test(x));
    if (iD < 0 || iQ < 0) throw new Error('Need at least a Description and a Quantity column');
    const cell = (r, i) => i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : '';
    const items = rows.slice(1).map(r => ({item:cell(r, iI), desc:cell(r, iD), unit:cell(r, iU), qty:numCell(cell(r, iQ)), price:numCell(cell(r, iP)), waste:numCell(cell(r, iW).replace(/%$/, ''))})).filter(x => x.desc);
    return items; }
  function bidTotals(items) { const rfi = []; let t = 0; const lines = (items || []).map(x => { const w = waste(x.qty, x.waste), amt = r2(w.qty * num(x.price)); if (!has(x.price)) rfi.push(`Item ${x.item || ''} ${x.desc}: unit price blank`); if (!has(x.qty)) rfi.push(`Item ${x.item || ''} ${x.desc}: quantity blank`); t += amt;
    return {...x, bidQty:w.qty, amt, math:`${has(x.waste) && num(x.waste) ? w.math + '; ' : ''}${f2(w.qty)} ${x.unit} x ${$(num(x.price))} = ${$(amt)}`}; }); return {lines, total:r2(t), rfi}; }

  /* past-jobs unit costs from SOV unit prices Joe entered on his own projects */
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9#/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function pastUnitCosts(projects) { const g = {};
    (projects || []).forEach(p => (p.sov || []).forEach(s => { if (!has(s.price) || num(s.price) <= 0 || !s.unit || /^ls$/i.test(s.unit)) return; const k = norm(s.desc) + '|' + s.unit.toUpperCase(); (g[k] ||= {desc:s.desc, unit:s.unit.toUpperCase(), pts:[]}).pts.push({p:num(s.price), job:p.name, qty:num(s.qty), done:!!p.complete}); }));
    return Object.values(g).map(x => { const ps = x.pts.map(a => a.p), avg = r2(ps.reduce((a, b) => a + b, 0) / ps.length); return {...x, n:ps.length, min:Math.min(...ps), max:Math.max(...ps), avg, math:`(${ps.map(f2).join(' + ')}) / ${ps.length} = ${$(avg)} per ${x.unit}`}; }).sort((a, b) => a.desc.localeCompare(b.desc)); }

  /* 3-week lookahead: hours per day + week totals with formula text */
  function weekStartMonday(iso) {
    const d = new Date((iso || '') + 'T00:00:00');
    if (isNaN(d)) return iso || '';
    const day = d.getDay(); // 0=Sun … 6=Sat
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d.toLocaleDateString('en-CA');
  }
  function lookaheadDays(startMon, n) {
    n = n || 21; const out = [], d = new Date((startMon || '') + 'T00:00:00');
    if (isNaN(d)) return out;
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < n; i++) {
      const iso = d.toLocaleDateString('en-CA');
      out.push({date: iso, dow: names[d.getDay()], label: names[d.getDay()], week: Math.floor(i / 7) + 1});
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function lookaheadWeekHours(days) {
    const byDay = {}, parts = []; let total = 0, neg = 0;
    (days || []).forEach(d => {
      let h = num(d.hrs); if (h < 0) { neg++; h = 0; } // v1.9.1: negative hours are ignored so the formula text and total agree
      const lab = d.label || d.dow || d.date || '?';
      byDay[lab] = r2((byDay[lab] || 0) + h); total = r2(total + h);
      if (h > 0) parts.push(lab + ' ' + f2(h)); // only days with hours in the formula text
    });
    const math = (parts.length ? parts.join(' + ') + ' = ' + f2(total) + ' hr' : '0 hr') + (neg ? ` (${neg} negative entr${neg > 1 ? 'ies' : 'y'} ignored)` : '');
    return {total: r2(total), byDay, math, neg};
  }

  /* bid tab history: spread and win rate — blanks = RFI, never invent */
  function bidTabSpread(our, low) {
    if (!has(our) || !has(low)) return {spread: null, pct: null, math: 'blank Our bid or Low bid = RFI', rfi: true};
    const o = num(our), l = num(low), spread = r2(o - l);
    const pct = l !== 0 ? r2(spread / l * 100) : null;
    return {spread, pct, rfi: false,
      math: 'Our ' + $(o) + ' − Low ' + $(l) + ' = ' + $(spread) + (pct === null ? '' : ' (' + f2(pct) + '%)')};
  }
  function bidTabWinRate(rows) {
    const filled = (rows || []).filter(r => String(r.winner || '').trim());
    const winRe = /^(us|we|ours?|rebar[-\s]?fab|rhm)$/i;
    // Win when Winner is Us / Rebar-Fab (or weWon flag). Rank alone never invents a win.
    const w = filled.filter(r => r.weWon === true || winRe.test(String(r.winner).trim())).length;
    const n = filled.length;
    if (!n) return {wins: 0, n: 0, pct: null, math: 'no rows with Winner filled'};
    const pct = r2(w / n * 100);
    return {wins: w, n, pct, math: w + ' / ' + n + ' = ' + f2(pct) + '%'};
  }

  return {earnedValue, level, waste, alternates, escalation, quartersAfter, BIDQ, bidScore, daysOpen, toCSV, parseCSV, bidForm, bidTotals, pastUnitCosts, csvCell, weekStartMonday, lookaheadDays, lookaheadWeekHours, bidTabSpread, bidTabWinRate};
});
