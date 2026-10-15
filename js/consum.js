/* Right Hand Man v2.0 - Activity-linked consumables. Every activity (takeoff line / template) carries a recipe driven by its own quantity.
   Ratios come ONLY from a cited source (shown on the row) or from the user; blank ratio = 0 qty + "ratio needed". Prices: rebar accessories from Joe's
   accessories_pricelist (cost + that item's markup); everything else is the user's price (blank = $0 + RFI). Auto rows recalc when the activity changes;
   the user can override qty / ratio / price or remove a row (kept on the line as L.cons[id]). */
'use strict';
(function (G, f) { const m = f(); if (typeof module === 'object' && module.exports) module.exports = m; else G.RHMC = m; })(typeof window !== 'undefined' ? window : globalThis, function () {
  const num = v => (v === '' || v === null || v === undefined) ? NaN : +v, has = v => isFinite(num(v)), r2 = x => Math.round((x + Number.EPSILON) * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;
  const $ = x => '$' + (isFinite(x) ? x : 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const row = (ev, test) => (ev.rows || []).find(test);
  const byUnit = u => ev => row(ev, x => String(x.unit).toUpperCase() === u), byDesc = re => ev => row(ev, x => re.test(x.desc));
  const W = 'bot_logic/welding.md', PL = 'accessories_pricelist.xlsx', CQ = 'bot_logic/competitive_quote.md S5';
  /* recipe items: driver picks the activity quantity; fixed ratio only when a source states it, else the user's ratio from the library */
  const RECIPES = {
    Welding:[
      {id:'weld-filler', name:'Filler metal (rod / wire)', unit:'LB', driver:byDesc(/^Filler to buy/), per:'LB filler', ratio:1, src:`${W} §2.6 (deposited / efficiency x 1.05)`},
      {id:'weld-flux', name:'SAW flux', unit:'LB', driver:byDesc(/^Filler to buy/), per:'LB wire', ratio:1, src:`${W} §2.6 ("flux is about 1:1 by weight with wire")`, when:L => (L.p || {}).proc === 'SAW'},
      {id:'weld-gas', name:'Shielding gas', unit:'CF', driver:byDesc(/^Arc time/), per:'arc-hr (your CFH)', src:'your ratio (CFH from your WPS)', when:L => !/SMAW|SAW/.test((L.p || {}).proc || 'SMAW')},
      {id:'weld-disc', name:'Grinding / flap discs', unit:'EA', driver:byDesc(/^Deposited/), per:'LB deposited', src:'your ratio'}],
    Rebar:[
      {id:'rb-tie', name:'Tie wire', unit:'Box', driver:byUnit('LB'), scale:1 / 2000, per:'ton', price:'Tie Wire', src:'your ratio (boxes per ton)'},
      {id:'rb-chair', name:'Chairs', unit:'Bag', driver:byUnit('LB'), scale:1 / 2000, per:'ton', price:'Plastic chairs - 2 1/4" (500pcs/bag)', pick:/chair/i, src:'your ratio (bags per ton)'},
      {id:'rb-dobie', name:'Dobie bricks', unit:'Each', driver:byUnit('LB'), scale:1 / 2000, per:'ton', price:'Dobie Bricks', src:'your ratio (each per ton)'}],
    Concrete:[
      {id:'cc-cure', name:'Curing compound', unit:'GAL', driver:byUnit('SF'), per:'SF', src:'your ratio (gal per SF = 1 / mfr coverage)'},
      {id:'cc-oil', name:'Form oil / release', unit:'GAL', driver:byUnit('SFCA'), per:'SFCA', src:'your ratio (gal per SFCA)'},
      {id:'cc-blade', name:'Saw blades', unit:'EA', driver:byDesc(/joint|saw/i), per:'LF of joint', src:'your ratio (blades per LF)'}]};
  RECIPES.Rebar.forEach(x => x.pl = true);
  const tradeOf = (L, T) => { const t = (T || {})[L.tpl] || {}; return /weld/i.test(t.trade || L.trade || '') ? 'Welding' : /rebar/i.test(t.trade || L.trade || '') ? 'Rebar' : /concrete/i.test(t.trade || L.trade || '') ? 'Concrete' : null; };
  const plFind = (pl, name) => ((pl && pl.items) || []).find(x => x.item === name);
  const packOf = it => { const m = /\((\d+)\s*pcs\/bag\)/i.exec(it && it.item || ''); return m ? +m[1] : null; };
  /* one activity -> consumable rows */
  function forLine(L, ev, o) { o = o || {}; const tr = tradeOf(L, o.T); if (!tr || !ev || !(ev.rows || []).length) return [];
    const lib = o.lib || {}, ov = L.cons || {}, out = [];
    RECIPES[tr].forEach(r => { if (r.when && !r.when(L)) return; const d = r.driver(ev); if (!d) return; const u = ov[r.id] || {}; if (u.removed) return;
      const lr = lib[r.id] || {}, basis = d.qty * (r.scale || 1), ratio = has(u.ratio) ? num(u.ratio) : has(r.ratio) ? r.ratio : has(lr.ratio) ? num(lr.ratio) : NaN;
      const ratioSrc = has(u.ratio) ? 'your override' : has(r.ratio) ? r.src : has(lr.ratio) ? 'your ratio (Consumables settings)' : '';
      const itemName = u.item || lr.item || r.price, it = r.pl ? plFind(o.pl, itemName) : null;
      let qty = has(u.qty) ? num(u.qty) : isFinite(ratio) ? basis * ratio : 0, packNote = '';
      const pack = packOf(it); if (it && !has(u.qty) && qty > 0 && /each/i.test(it.unit) && /bolster|wheel/i.test(it.item)) { const q2 = Math.ceil(qty / 50 - 1e-9) * 50; packNote = ` -> round up to 50-pc box = ${q2} (${PL} note)`; qty = q2; }
      else if (!has(u.qty)) { const q2 = Math.ceil(qty - 1e-9); if (q2 !== qty && /^(EA|Each|Box|Bag)$/i.test(it ? it.unit : r.unit)) { packNote = ` -> ROUNDUP ${q2}${pack ? ` (${pack} pcs/bag)` : ''}`; qty = q2; } }
      const cost = has(u.price) ? num(u.price) : it && has(it.cost) ? it.cost : has(lr.price) ? num(lr.price) : NaN, mk = has(u.markup) ? num(u.markup) : it && has(it.markupPct) ? it.markupPct : NaN;
      const priceSrc = has(u.price) ? 'your override' : it ? `${PL} row ${it.row} (${it.vendor})` : has(lr.price) ? 'your price' : '';
      const amt = isFinite(cost) ? r2(qty * cost) : 0, sell = isFinite(mk) ? r2(amt * (1 + mk / 100)) : null, need = [];
      if (!isFinite(ratio) && !has(u.qty)) need.push('ratio needed'); if (!isFinite(cost)) need.push('price needed');
      const qm = has(u.qty) ? `${r3(qty)} ${it ? it.unit : r.unit} (your override)` : isFinite(ratio) ? `${r3(d.qty)} ${d.unit}${r.scale ? ` / 2000 = ${r3(basis)} ${r.per}` : ''} x ${ratio} per ${r.per} (${ratioSrc}) = ${r3(basis * ratio)}${packNote}` : `ratio blank - enter yours (${r.src})`;
      out.push({id:r.id, name:it ? `${r.name}: ${it.item}` : r.name, unit:it ? it.unit : r.unit, qty:r3(qty), cost:isFinite(cost) ? cost : null, markupPct:isFinite(mk) ? mk : null, amt, sell, auto:!has(u.qty), need,
        math:`${qm}${isFinite(cost) ? ` x ${$(cost)} (${priceSrc}) = ${$(amt)}${sell !== null ? `; sell = ${$(amt)} x (1 + ${mk}% item markup) = ${$(sell)} (${CQ}: never the rebar markup)` : ''}` : ' x price blank = $0 -> RFI'}`, src:ratioSrc || r.src}); });
    Object.entries(ov).filter(([k, v]) => k.startsWith('x-') && !v.removed).forEach(([k, v]) => { const q = num(v.qty), c = num(v.price), a = isFinite(q) && isFinite(c) ? r2(q * c) : 0;
      out.push({id:k, name:v.name || 'Added item', unit:v.unit || 'EA', qty:isFinite(q) ? q : 0, cost:isFinite(c) ? c : null, markupPct:null, amt:a, sell:null, auto:false, need:isFinite(c) ? [] : ['price needed'], math:`${isFinite(q) ? q : 0} ${v.unit || 'EA'} x ${isFinite(c) ? $(c) : 'price blank'} = ${$(a)} (added by you)`, src:'you'}); });
    return out; }
  const sub = rows => ({cost:r2(rows.reduce((a, x) => a + x.amt, 0)), sell:r2(rows.reduce((a, x) => a + (x.sell ?? x.amt), 0))});
  /* job: per activity + total; PPE / small tools as % of labor (your %); machine fuel from equipment (moved here when shown as consumable) */
  function job(acts, o) { o = o || {}; const per = acts.map(a => ({...a, ...sub(a.rows)})), C = r2(per.reduce((s, a) => s + a.cost, 0)), S = r2(per.reduce((s, a) => s + a.sell, 0));
    const ppe = has(o.ppePct) && has(o.labor) ? r2(num(o.labor) * num(o.ppePct) / 100) : 0;
    return {per, cost:C, sell:S, ppe, total:r2(S + ppe), math:`${per.map(a => $(a.sell)).join(' + ') || '$0.00'}${ppe ? ` + PPE / small tools ${num(o.ppePct)}% x labor ${$(num(o.labor))} = ${$(ppe)}` : ''} = ${$(r2(S + ppe))}`}; }
  return {RECIPES, forLine, job, sub, tradeOf, plFind, packOf};
});
