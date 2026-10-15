/* Right Hand Man - estimate rollup (pure math, Node-testable). Material + Labor (burdened) + Equipment + Subs -> Allowances -> Markup -> Tax -> Total.
   No rates are built in: every $ comes from the user's entries (or their Cost Data import). A missing rate is an RFI and costs $0 until entered. */
(function (root, factory) { const R = typeof module === 'object' && module.exports ? require('./calc.js') : root.RHM; const x = factory(R); if (typeof module === 'object' && module.exports) module.exports = x; else root.RHME = x; })(this, function (R) {
  'use strict';
  const num = v => { const x = parseFloat(String(v ?? '').replace(/[$,]/g, '')); return isFinite(x) ? x : NaN; }, has = v => isFinite(num(v)), r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const $ = x => '$' + r2(x).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}), f = x => (+r2(x)).toLocaleString('en-US', {maximumFractionDigits:2});
  const TX_STATE = 6.25; // Texas state sales and use tax rate, % (Tex. Tax Code 151.051). Local rate (up to 2%) is entered by the user.
  const BURDEN_ITEMS = [['fica', 'FICA (Social Security + Medicare)'], ['futa', 'FUTA'], ['suta', 'SUTA (Texas unemployment)'], ['wc', "Workers' comp"], ['gl', 'General liability'], ['health', 'Health insurance'], ['fringe', 'Other fringe / benefits']];
  const EQUIP_KINDS = ['Mini excavator (under 6 t)', 'Excavator 6-15 t', 'Excavator 15-25 t', 'Excavator 25-40 t', 'Excavator 40 t +', 'Skid steer', 'Compact track loader', 'Backhoe loader', 'Dozer (small, D3-D4 class)', 'Dozer (medium, D5-D6 class)', 'Dozer (large, D8 class +)',
    'Wheel loader', 'Roller - smooth drum', 'Roller - padfoot', 'Plate / rammer compactor', 'Crane - rough terrain', 'Crane - all terrain', 'Crane - boom truck', 'Telehandler', 'Trencher', 'HDD rig', 'Welding rig (truck)', 'Fusion machine (HDPE)', 'Trench box / shield', 'Pump - dewatering', 'Pump - bypass', 'Light tower', 'Generator', 'Air compressor', 'Water truck', 'Dump truck', 'Pickup / crew truck', 'Lowboy / hauling'];
  const UNIT_HRS = {hr:1, day:null, wk:null, mo:null};
  function burdenPct(b) { b = b || {}; if (b.itemized) { const it = BURDEN_ITEMS.map(([k, l]) => [l, num((b.items || {})[k])]).filter(([, v]) => isFinite(v)); const s = it.reduce((a, [, v]) => a + v, 0); return {pct:s, math:it.length ? it.map(([l, v]) => `${l} ${f(v)}%`).join(' + ') + ` = ${f(s)}%` : 'no burden items entered = 0%'}; }
    const p = has(b.pct) ? num(b.pct) : 45; return {pct:p, math:`${f(p)}% burden${has(b.pct) && num(b.pct) !== 45 ? '' : " (Joe's standard, editable)"}`}; }
  function laborLine(l, burden) { const B = burdenPct(burden), out = {rfi:[]}, db = !!l.db, base = db ? num(l.dbBase) : num(l.base), fringe = db ? (num(l.dbFringe) || 0) : 0, n = has(l.n) ? num(l.n) : 1;
    if (!isFinite(base)) { out.rfi.push(`${l.trade || 'labor'}: ${db ? 'wage determination base rate' : 'base $/hr'} not entered`); out.cost = 0; out.math = 'rate needed'; return out; }
    const rate = base * (1 + B.pct / 100) + fringe; let hrs = num(l.hrs), hrsMath;
    if (!isFinite(hrs) && has(l.prodQty) && has(l.prodRate) && num(l.prodRate) > 0) { hrs = num(l.prodQty) / num(l.prodRate); hrsMath = `${f(num(l.prodQty))} ${l.prodUnit || 'units'} / ${f(num(l.prodRate))} per crew-hr = ${f(hrs)} hr`; }
    if (!isFinite(hrs)) { out.rfi.push(`${l.trade || 'labor'}: hours (or quantity + production rate) not entered`); hrs = 0; }
    const ot = num(l.ot) || 0, otm = has(l.otMult) ? num(l.otMult) : 1.5, otRate = base * otm * (1 + B.pct / 100) + fringe, cost = n * (hrs * rate + ot * otRate);
    out.rate = r2(rate); out.cost = r2(cost); out.hrs = hrs;
    out.math = `${db ? 'Prevailing wage ' : ''}base ${$(base)}/hr x (1 + ${B.math}) ${fringe ? `+ fringe ${$(fringe)} ` : ''}= ${$(rate)}/hr burdened; ${hrsMath ? hrsMath + '; ' : ''}${f(n)} worker(s) x (${f(hrs)} hr x ${$(rate)}${ot ? ` + ${f(ot)} OT hr x ${$(base)} x ${f(otm)} x (1 + ${f(B.pct)}%)${fringe ? ' + fringe' : ''} = ${$(otRate)}` : ''}) = ${$(cost)}`; return out; }
  function equipLine(e, lib) { const m = (lib || []).find(x => x.id === e.eqId) || {}, out = {rfi:[]}, name = m.name || e.name || 'equipment', u = e.durUnit || 'hr', qty = has(e.units) ? num(e.units) : 1;
    let dur = num(e.dur), durMath = ''; if (!isFinite(dur) && has(e.prodQty) && has(e.prodRate) && num(e.prodRate) > 0) { dur = num(e.prodQty) / num(e.prodRate); durMath = `${f(num(e.prodQty))} ${e.prodUnit || 'units'} / ${f(num(e.prodRate))} per ${u} = ${f(dur)} ${u}; `; }
    if (!isFinite(dur)) { out.rfi.push(`${name}: duration (or quantity + production rate) not entered`); dur = 0; }
    const rate = num((m.rate || {})[u] ?? e.rate); if (!isFinite(rate)) out.rfi.push(`${name}: ${u === 'hr' ? 'hourly' : u === 'day' ? 'daily' : u === 'wk' ? 'weekly' : 'monthly'} rate not entered in the equipment library`);
    const rent = (isFinite(rate) ? rate : 0) * dur * qty, mob = num(m.mob) || 0, del = num(m.delivery) || 0; let fuel = 0, fuelMath = '';
    if (has(m.fuelGph) && has(m.fuelPrice)) { const hpd = num(e.hrsPerDay), opHrs = u === 'hr' ? dur : isFinite(hpd) ? dur * hpd * (u === 'wk' ? (num(e.daysPerWk) || NaN) : u === 'mo' ? (num(e.daysPerMo) || NaN) : 1) : NaN;
      if (isFinite(opHrs)) { fuel = qty * opHrs * num(m.fuelGph) * num(m.fuelPrice); fuelMath = ` + fuel ${f(qty)} x ${f(opHrs)} op-hr x ${f(num(m.fuelGph))} gal/hr x ${$(num(m.fuelPrice))}/gal = ${$(fuel)}`; } else out.rfi.push(`${name}: operating hours per ${u} not entered (needed for fuel)`); }
    const cost = rent + mob + del + fuel; out.cost = r2(cost); out.fuel = r2(fuel);
    out.math = `${durMath}${m.mode === 'operated' ? 'Operated' : 'Bare'} ${name}: ${f(qty)} x ${f(dur)} ${u} x ${isFinite(rate) ? $(rate) : '[rate needed]'}/${u}${m.example ? ' (EXAMPLE rate)' : ''} = ${$(rent)}${mob ? ` + mobilization ${$(mob)}` : ''}${del ? ` + delivery ${$(del)}` : ''}${fuelMath} = ${$(cost)}`; out.operated = m.mode === 'operated'; return out; }
  function taxCalc(t, base) { t = t || {}; const mode = t.mode || 'materials', rate = (has(t.state) ? num(t.state) : TX_STATE) + (num(t.local) || 0);
    if (mode === 'exempt') return {amt:0, rate:0, math:`Exempt${t.cert ? ' - certificate on file: ' + t.cert : ' - get a resale/exemption certificate (Texas Form 01-339) before billing tax-free'}`};
    const b = mode === 'all' ? base.all : base.mat, lab = mode === 'all' ? 'all charges' : 'materials';
    const amt = b * rate / 100; return {amt:r2(amt), rate, math:`${f(rate)}% (${f(has(t.state) ? num(t.state) : TX_STATE)}% state + ${f(num(t.local) || 0)}% local) x ${lab} ${$(b)} = ${$(amt)}${t.contract === 'lump' ? ' - lump-sum contract: tax on materials is your cost as consumer, not separately stated to the customer' : ' - separated contract: stated on its own line'}`}; }
  function estRollup(est, cfg) { est = est || {}; cfg = cfg || {}; const rfi = [], S = [];
    const mat = (est.mat || []).map(l => { const q = num(l.qty), p = num(l.price), ok = isFinite(q) && isFinite(p); if (!ok && (l.desc || has(l.qty))) rfi.push(`${l.desc || 'material'}: ${!isFinite(q) ? 'quantity' : 'unit price'} not entered`); const a = ok ? r2(q * p) : 0; return {...l, amt:a, math:ok ? `${f(q)} ${l.unit || ''} x ${$(p)} = ${$(a)}` : 'needs qty + price'}; });
    const lab = (est.labor || []).map(l => { const x = laborLine(l, cfg.burden); rfi.push(...x.rfi); return {...l, ...x, amt:x.cost}; });
    const eq = (est.equip || []).map(e => { const x = equipLine(e, cfg.equipLib); rfi.push(...x.rfi); return {...e, ...x, amt:x.cost}; });
    const sub = (est.subs || []).map(s => { const a = num(s.amt); if (!isFinite(a) && s.desc) rfi.push(`${s.desc}: sub quote amount not entered`); return {...s, amt:isFinite(a) ? r2(a) : 0}; });
    const fc = !!est.fuelCons, fuel = fc ? r2(eq.reduce((a, x) => a + (x.fuel || 0), 0)) : 0; if (fc) eq.forEach(x => { x.amt = r2(x.amt - (x.fuel || 0)); if (x.fuel) x.math += ` (fuel ${$(x.fuel)} moved to Consumables)`; });
    const sum = xs => r2(xs.reduce((a, x) => a + (x.amt || 0), 0)), M = sum(mat), L = sum(lab), E = sum(eq), SB = sum(sub);
    const cons = (est.cons || []).map(c => { const a = num(c.amt), sl = num(c.sell); if (c.need && c.need.length) rfi.push(`Consumable ${c.name || ''}: ${c.need.join(', ')}`); return {...c, amt:isFinite(a) ? r2(a) : 0, sell:isFinite(sl) ? r2(sl) : null}; });
    const ppe = has(est.ppePct) ? r2(L * num(est.ppePct) / 100) : 0, own = r2(cons.filter(c => c.sell !== null).reduce((a, c) => a + c.sell, 0)), inMk = r2(cons.filter(c => c.sell === null).reduce((a, c) => a + c.amt, 0) + fuel + ppe), CN = r2(own + inMk), hasC = cons.length || fuel || ppe;
    const base = r2(M + L + E + SB + (hasC ? CN : 0));
    S.push({k:'mat', label:'Material', amt:M, math:mat.length ? mat.map(x => x.math).join(' + ') + ` = ${$(M)}` : '$0.00'}, {k:'lab', label:'Labor (burdened)', amt:L, math:lab.length ? `${lab.map(x => $(x.amt)).join(' + ')} = ${$(L)}` : '$0.00'},
      {k:'eq', label:'Equipment', amt:E, math:eq.length ? `${eq.map(x => $(x.amt)).join(' + ')} = ${$(E)}` : '$0.00'}, {k:'sub', label:'Subcontractors', amt:SB, math:sub.length ? `${sub.map(x => $(x.amt)).join(' + ')} = ${$(SB)}` : '$0.00'},
      ...(hasC ? [{k:'cons', label:'Consumables', amt:CN, math:[cons.length && cons.map(c => c.sell !== null ? `${c.name || 'item'} ${$(c.sell)} (own markup, not marked up again)` : `${c.name || 'item'} ${$(c.amt)}`).join(' + '), fuel && `machine fuel ${$(fuel)}`, ppe && `PPE / small tools ${f(num(est.ppePct))}% x labor ${$(L)} = ${$(ppe)}`].filter(Boolean).join(' + ') + ` = ${$(CN)}`}] : []),
      {k:'base', label:hasC ? 'Subtotal (Material + Labor + Equipment + Subs + Consumables)' : 'Subtotal (Material + Labor + Equipment + Subs)', amt:base, math:`${$(M)} + ${$(L)} + ${$(E)} + ${$(SB)}${hasC ? ` + ${$(CN)}` : ''} = ${$(base)}`, sub:true});
    const al = (est.allow || []).map(a => ({...a, amt:has(a.amt) ? r2(num(a.amt)) : 0})), A = sum(al), Amk = sum(al.filter(a => a.markup));
    S.push({k:'allow', label:'Allowances', amt:A, math:al.length ? al.map(a => `${a.name || 'Allowance'} ${$(a.amt)}${a.markup ? ' (marked up)' : ' (no markup)'}`).join(' + ') + ` = ${$(A)}` : '$0.00'});
    const mp = has(est.markupPct) ? num(est.markupPct) : 0, mkBase = base - (hasC ? own : 0) + Amk, MK = r2(mkBase * mp / 100);
    S.push({k:'mk', label:`Markup ${f(mp)}%`, amt:MK, math:`${f(mp)}% x (subtotal ${$(base)}${hasC && own ? ` - own-markup consumables ${$(own)}` : ''}${Amk ? ` + marked-up allowances ${$(Amk)}` : ''}) = ${$(MK)}`});
    const consMat = hasC ? r2(cons.reduce((a, c) => a + c.amt, 0)) : 0, T = taxCalc(est.tax || cfg.tax, {mat:r2(M + consMat), all:base + A + MK}); if (consMat && T.amt) T.math += ` (materials include consumables at cost ${$(consMat)})`; S.push({k:'tax', label:'Sales tax', amt:T.amt, math:T.math});
    const total = r2(base + A + MK + T.amt); S.push({k:'total', label:'Total', amt:total, math:`${$(base)} + ${$(A)} + ${$(MK)} + ${$(T.amt)} = ${$(total)}`, sub:true});
    return {mat, lab, eq, sub, cons, fuel, ppe, consTotal:hasC ? CN : 0, allow:al, steps:S, total, rfi, tax:T}; }
  function allowRecon(allow, usedMap) { return (allow || []).map(a => { const amt = num(a.amt) || 0, used = num((usedMap || {})[a.id] ?? a.used) || 0; return {...a, amt, used, remaining:r2(amt - used), over:used > amt, math:`${$(amt)} - used ${$(used)} = ${$(amt - used)} remaining`}; }); }
  return {estRollup, laborLine, equipLine, burdenPct, taxCalc, allowRecon, BURDEN_ITEMS, EQUIP_KINDS, TX_STATE};
});
