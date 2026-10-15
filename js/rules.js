/* Right Hand Man v1.4 - construction logic imported from Joe's expert bots (bot_logic/*.md) + the fabricated-rebar-takeoff skill.
   Every rule / formula carries src = the bot file and section it came from. Values a bot wrote from memory carry verify:true and
   show a "VERIFY" tag until Joe (or a fetched public source, cited by URL) confirms them. NO PRICES are taken from these files. */
(function (root, f) { const R = typeof module === 'object' && module.exports ? require('./calc.js') : root.RHM; const m = f(R); if (typeof module === 'object' && module.exports) module.exports = m; else root.RHMR = m; })(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  const {num, has, r2, r3, fmt, T} = R; const F = (k, l, u, req = true, def) => ({k, l, u, req, def}); const PI = Math.PI;
  const S = {skill:'fabricated-rebar-takeoff SKILL.md', sd:'bot_logic/rebar_shopdrawings.md', cad:'bot_logic/autocad_checks.md', coat:'bot_logic/coatings.md', exc:'bot_logic/excavation.md', roof:'bot_logic/roofing.md', weld:'bot_logic/welding.md', mar:'bot_logic/margin.md', conc:'bot_logic/concrete.md', mas:'bot_logic/masonry.md', stl:'bot_logic/steel.md', pipe:'bot_logic/piping.md', elec:'bot_logic/electrical.md', cq:'bot_logic/competitive_quote.md', core:"Joe's standing rules"};
  const ceil = x => Math.ceil(x - 1e-9), r1 = x => Math.round(x * 10 + 1e-9) / 10, r4 = x => Math.round(x * 1e4) / 1e4;

  /* ---------- registry of from-memory values and estimator defaults (Settings -> "Assumptions for Joe to confirm") ---------- */
  const ASSUME = [
    {id:'sd-crsi-hooks', src:S.sd + ' §2-3', text:'CRSI bend-type numbering, segment geometry and hook-allowance tables (the app\'s hook extensions come from the NCDOT/irebar reproduction of CRSI)', tag:'VERIFY vs CRSI manual'},
    {id:'sd-aci-ld', src:S.sd + ' §4.2', text:'ACI 318-19 simplified development lengths and l_dh', tag:'VERIFY'},
    {id:'sd-spiral', src:S.sd + ' §3.1', text:'Spiral values: 1.5 end turns each end, 1-3 in clear, splice max(48 db, 12 in)', tag:'VERIFY'},
    {id:'sd-txdot440', src:S.sd + ' §4.3', text:'TxDOT Item 440 splice table values - load from the job\'s spec book', tag:'VERIFY'},
    {id:'sd-tms', src:S.sd + ' §4.4', text:'TMS 402 masonry lap formula and gamma factors; 48 db masonry lap placeholder', tag:'VERIFY'},
    {id:'sd-gfrp', src:S.sd + ' §4.5', text:'GFRP (ACI 440.11) lap = 1.3 l_d and bend values', tag:'VERIFY'},
    {id:'sd-round', src:S.sd + ' §3', text:'Cut length rounds up to the next 1 in (shop rule)', tag:'VERIFY'},
    {id:'sd-close', src:S.sd + ' §7', text:'Dimension strings close within 1/8 in', tag:'VERIFY'},
    {id:'cad-tol', src:S.cad + ' §4', text:'Fab / shop weight vs takeoff: 0% to +5% over, never under (under = HOLD fab)', tag:'STANDARD'},
    {id:'weld-groove', src:S.weld + ' §2.7', text:'Groove-weld labor formula 0.20 + 0.65 x A x 12 MH/LF is a PLACEHOLDER - uncalibrated. The app uses YOUR production rate (MH/LF).', tag:'UNCALIBRATED'},
    {id:'weld-code', src:S.weld + ' §3.3, §6', text:'AWS / ASME clause and table numbers and NDE percentages', tag:'VERIFY against the project spec edition'},
    {id:'weld-rates', src:S.weld + ' §2.7-2.9', text:'Fillet MH/LF table, pipe MH/DI table and adjustment factors (field 1.5, vertical 1.3 ...)', tag:'DEFAULT - CONFIRM'},
    {id:'weld-eff', src:S.weld + ' §2.6', text:'Deposition efficiency by process (SMAW 0.62 in the worked example) + 5% filler waste', tag:'DEFAULT - CONFIRM'},
    {id:'roof-waste', src:S.roof + ' §2.5', text:'Roofing waste factors (10% simple single slope ...)', tag:'DEFAULT - CONFIRM'},
    {id:'roof-mh', src:S.roof + ' §10', text:'Roofing MH/SQ production table. MUS1A: the takeoff file total 44.9 MH (lift_station_2026-10-13/work/bots/roofing_takeoff.md) governs over the doc example 17.08 MH', tag:'DEFAULT - CONFIRM'},
    {id:'roof-code', src:S.roof + ' §5', text:'IBC / IRC / IECC items (R806.2 ventilation 1/150 - 1/300, slope minimums, R-values)', tag:'VERIFY'},
    {id:'exc-swell', src:S.exc + ' §4.6', text:'Swell / shrink percentages by soil', tag:'DEFAULT - CONFIRM (geotech governs)'},
    {id:'exc-unitwt', src:S.exc + ' §2.9', text:'Unit weight TON/CY (crushed stone ~1.4-1.5)', tag:'DEFAULT - CONFIRM'},
    {id:'exc-osha', src:S.exc + ' §4.1, §5', text:'OSHA 29 CFR 1926 Subpart P slopes A 3/4:1, B 1:1, C 1.5:1; protective system at 5 ft; ladder within 25 ft at 4 ft; PE over 20 ft', tag:'VERIFIED', url:'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1926/subpart-P'},
    {id:'coat-loss', src:S.coat + ' §2.4, §2.7', text:'Coating loss factor and SF/MH production rates', tag:'ESTIMATOR ASSUMPTION'},
    {id:'mar-bands', src:S.mar + ' §5', text:'Markup bands: materials 8-12%, equipment 10-15%, OH&P 8-15%, contingency 5-15% (no markup on contingency)', tag:'DEFAULT - CONFIRM'},
    {id:'mar-esc', src:S.mar + ' §4', text:'Escalate past rates older than 90 days at 4%/yr (3-5%)', tag:'DEFAULT - CONFIRM'},
    {id:'steel-mem', src:'bot_logic/steel.md §2.3, §2.5, §2.7, §5', text:'Steel: deck psf, AISC / IBC / OSHA references, connection 7.5%, galvanizing 4.5%', tag:'VERIFY'},
    {id:'mas-mem', src:'bot_logic/masonry.md §2.5-2.7, §4A', text:'Masonry: TMS 402 sections, 48 db / 60 db lap placeholder, NCMA grout CF per cell (8" = 0.172), units/SF, mortar rates', tag:'VERIFY'},
    {id:'conc-cover', src:'bot_logic/concrete.md §6 / ' + S.cad + ' §3', text:'ACI 318 cover: 3 in cast against earth, 2 in #6+ exposed, 1.5 in #5 and smaller exposed (plan notes govern)', tag:'VERIFY'},
  ];

  /* ---------- rebar shop drawings (src: rebar_shopdrawings.md) ---------- */
  const SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 18], DB = {3:0.375, 4:0.5, 5:0.625, 6:0.75, 7:0.875, 8:1, 9:1.128, 10:1.27, 11:1.41, 14:1.693, 18:2.257};
  function parseMark(m) { const x = String(m || '').trim().toUpperCase().match(/^([A-Z]{1,2})(\d{1,2})(\d{2})$/); if (!x) return {rfi:`Undefined mark "${m}" (format letter + size + 2-digit seq, e.g. A501)`, src:S.sd + ' §1'};
    const d = x[2] + x[3]; if (d.length === 4 && SIZES.includes(+d.slice(0, 2))) return {prefix:x[1], size:+d.slice(0, 2), seq:d.slice(2), src:S.sd + ' §1'};
    const s = +d.slice(0, d.length - 2); return SIZES.includes(s) ? {prefix:x[1], size:s, seq:d.slice(-2), src:S.sd + ' §1'} : {rfi:`Undefined mark "${m}": size ${s} not a standard bar`, src:S.sd + ' §1'}; }
  function hookExt(size, deg, tie) { const d = DB[size]; if (!d) return null; let ext;
    if (!tie) ext = deg === 90 ? 12 * d : deg === 180 ? Math.max(4 * d, 2.5) : null; else ext = deg === 90 ? (size <= 5 ? 6 * d : 12 * d) : deg === 135 ? Math.max(6 * d, 3) : deg === 180 ? Math.max(4 * d, 2.5) : null;
    return ext === null ? null : {in:r3(ext), src:S.sd + ' §2.3 (ACI 318-19 Table 25.3.' + (tie ? '2' : '1') + ')', verify:'VERIFY vs CRSI manual'}; }
  function spiral(od, db, pitch, height, endTurns = 1.5) { const Dc = od - db, turn = Math.sqrt((PI * Dc) ** 2 + pitch ** 2), n = height / pitch + 2 * endTurns, L = n * turn;
    return {turnIn:r3(turn), turns:r3(n), lenIn:r3(L), lenFt:r3(L / 12), math:`turn = sqrt((pi x (${od} - ${db}))^2 + ${pitch}^2) = ${r3(turn)} in; turns = ${height} / ${pitch} + 2 x ${endTurns} = ${r3(n)}; L = ${r3(n)} x ${r3(turn)} = ${r3(L)} in = ${r3(L / 12)} ft`, src:S.sd + ' §3.1', verify:'VERIFY'}; }
  function lapsPerBar(L, stock = 20, lap) { if (!(stock > lap)) return {rfi:'Stock length must be longer than the lap', src:S.sd + ' §4.6'}; const laps = L <= stock ? 0 : ceil((L - stock) / (stock - lap));
    return {laps, pieces:laps + 1, overStock:L > stock, math:L <= stock ? `${r3(L)} ft <= ${stock} ft stock: 0 laps` : `laps = ROUNDUP((${r3(L)} - ${stock}) / (${stock} - ${r3(lap)})) = ${laps}; pieces = ${laps + 1}`, src:S.sd + ' §4.6'}; }
  function cover(cond, size) { const c = cond === 'earth' ? 3 : cond === 'exposed' ? (size >= 6 ? 2 : 1.5) : cond === 'interior' ? (size <= 11 ? 0.75 : 1.5) : cond === 'beamcol' ? 1.5 : null; return {in:c, src:S.sd + ' §6 / ' + S.cad + ' §3 (ACI 318-19 Table 20.5.1.3.1)', verify:'VERIFY', note:'Plan notes govern'}; }
  function countBars(run, s, elements = 1) { const n = Math.floor(run / s + 1e-9) + 1; return {n:n * elements, math:`INT(${r3(run)} / ${r3(s)}) + 1 = ${n}${elements !== 1 ? ` x ${elements} elements = ${n * elements}` : ''}`, src:S.cad + ' §1'}; }
  function fabTolerance(listed, takeoff) { const d = takeoff ? (listed - takeoff) / takeoff * 100 : 0, st = listed < takeoff - 0.5 ? 'HOLD' : d > 5 ? 'OVER' : 'PASS';
    return {status:st, pct:r2(d), math:`(${fmt(listed)} - ${fmt(takeoff)}) / ${fmt(takeoff)} = ${r2(d)}%; allowed 0% to +5%`, msg:st === 'HOLD' ? 'Shop weight is UNDER the takeoff - HOLD fab until resolved (never under)' : st === 'OVER' ? 'Shop weight is more than 5% over the takeoff - explain or fix' : 'Within 0 to +5%', src:S.cad + ' §4'}; }

  /* ---------- coatings (src: coatings.md) ---------- */
  const coat = {
    cyl:(D, H) => r1(PI * D * H), circ:D => r2(PI * (D / 2) ** 2), pipe:(odIn, L) => r1(odIn / 12 * PI * L),
    wft:(dft, vs) => r1(dft / vs), theo:(vs, dft) => r1(1604 * vs / dft), prac:(theo, loss) => r1(theo * (1 - loss)), gal:(sf, coats, prac) => r1(sf * coats / prac), mh:(sf, rate, coats = 1) => r1(sf / rate * coats),
  };
  /* ---------- excavation (src: excavation.md) ---------- */
  const exc = {
    aea:(a1, a2, L) => r2((a1 + a2) / 2 * L / 27), grid:(cell, ds) => r2(cell * ds.reduce((a, b) => a + b, 0) / ds.length / 27),
    pitRound:(Dp, D) => r2(PI / 4 * Dp * Dp * D / 27), pitRect:(a, b, D) => r2(a * b * D / 27), trench:(L, W, D) => r2(L * W * D / 27),
    trenchW:odFt => r2(Math.max(odFt + 1.33, 1.25 * odFt + 1.0)),
    slopeTrenchPerLF:(W, D, s) => r2(D * (W + W + 2 * s * D) / 2 / 27), slopePit:(a, b, D, s) => r2(D / 6 * (a * b + 4 * (a + s * D) * (b + s * D) + (a + 2 * s * D) * (b + 2 * s * D)) / 27),
    slopeRound:(Dp, D, s) => { const R1 = Dp / 2, R2 = R1 + s * D; return r2(PI * D / 3 * (R1 * R1 + R1 * R2 + R2 * R2) / 27); },
    lcy:(bcy, sw) => r2(bcy * (1 + sw)), borrow:(ccy, sh) => r2(ccy / (1 - sh)), tons:(cy, uw) => r2(cy * uw), sy:sf => r2(sf / 9), loads:(lcy, cap) => ceil(lcy / cap),
    ladders:(L, D) => D >= 4 ? Math.max(1, ceil(L / 50)) : 0, OSHA:{A:0.75, B:1, C:1.5},
  };
  /* ---------- roofing (src: roofing.md) ---------- */
  const roof = {
    pf:rise => Math.sqrt(1 + (rise / 12) ** 2), hvf:rise => Math.sqrt(2 + (rise / 12) ** 2), sq:sf => r2(sf / 100), waste:(sq, w) => r2(sq * (1 + w)),
    panels:(widthIn, cov) => ceil(widthIn / cov), clips:(panels, len, sp) => panels * (ceil(len / sp) + 1), stepFlash:(lf, exp) => ceil(lf * 12 / exp) + 1,
    dripPcs:lf => ceil(lf * 1.05 / 10), brackets:(lf, sp) => ceil(lf / sp) + 1, nfaRidgeLF:(attic, ratio, perLF) => ceil(attic / ratio * 144 / 2 / perLF), insulIn:(rq, rpi) => r2(rq / rpi),
    taper:(base, slope, run) => ({high:r2(base + slope * run), avg:r2(base + slope * run / 2)}),
  };
  /* ---------- welding (src: welding.md) ---------- */
  const weld = {
    lf:(count, lenIn, sides = 1) => r2(count * lenIn * sides / 12), inter:(seg, len, pitch) => Math.floor((seg - len) / pitch + 1e-9) + 1,
    circ:od => r3(PI * od / 12), fillet:(leg, reinf = 0) => leg * leg / 2 * (1 + reinf),
    vGroove:(t, R, th, reinf = 0) => (t * R + t * t * Math.tan(th * PI / 180)) * (1 + reinf), bevel:(t, R, th, reinf = 0) => (t * R + t * t * Math.tan(th * PI / 180) / 2) * (1 + reinf),
    lbPerLF:(A, dens = 0.283) => r3(A * 12 * dens), purchased:(dep, eff, waste = 0.05) => r1(dep / eff * (1 + waste)), nde:(n, pct) => ceil(n * pct / 100),
  };
  /* ---------- margin (src: margin.md) - NO prices, just the math + checks ---------- */
  const mar = { margin:(sell, cost) => sell ? (sell - cost) / sell : 0, markup:(sell, cost) => cost ? (sell - cost) / cost : 0, toMargin:mu => mu / (1 + mu), toMarkup:mg => mg / (1 - mg),
    check(sell, cost) { if (!has(sell) || !has(cost)) return {level:'MISSING', msg:'Cost or sell blank - never auto-filled', src:S.mar + ' §7'}; if (+sell < +cost) return {level:'BELOW COST', block:true, msg:`Sell ${fmt(sell)} < cost ${fmt(cost)} - BELOW COST, send is blocked`, src:S.mar + ' §7'};
      const mg = (sell - cost) / sell, mu = cost ? (sell - cost) / cost : 0; return {level:'OK', msg:`markup ${r2(mu * 100)}% / margin ${r2(mg * 100)}%`, src:S.mar + ' §1'}; } };

  /* ---------- trade templates built from the bot formulas (quantities only; production rates are the user's) ---------- */
  const add = (k, o) => { o.bot = true; T[k] = o; };
  add('coat_lining', {trade:'Coatings', name:'Coatings - wet well / tank lining (cylinder walls + floor)', unit:'SF', src:S.coat + ' §2', fields:[F('D', 'Diameter (state ID for linings)', 'FT'), F('H', 'Height or EL top - EL bottom', 'FT'), F('floor', 'Coat the floor too? (1 = yes)', 'EA', false, 1), F('open', 'Openings to deduct', 'SF', false, 0), F('coats', 'Coats (from spec)', 'EA'), F('dft', 'DFT per coat (mils, from spec/data sheet)', 'mils', false, ''), F('vs', 'Volume solids % (data sheet)', '%', false, ''), F('loss', 'Loss factor % (ESTIMATOR ASSUMPTION)', '%', false, ''), F('rate', 'Your production SF/MH per coat', 'SF/MH', false, '')],
    calc(p) { const D = num(p.D), H = num(p.H), wall = PI * D * H, fl = num(p.floor) ? PI * (D / 2) ** 2 : 0, op = num(p.open), sf = r1(wall + fl - op), c = num(p.coats);
      const rows = [{desc:'Lining SF (net)', qty:sf, unit:'SF', math:`walls pi x ${r3(D)} x ${r3(H)} = ${r1(wall)} SF${fl ? ` + floor pi x (${r3(D)}/2)^2 = ${r2(fl)} SF` : ''}${op ? ` - openings ${op} SF` : ''} = ${sf} SF (${S.coat} §2.1)`}];
      if (has(p.dft) && has(p.vs) && num(p.vs) > 0) { const vs = num(p.vs) / 100, th = 1604 * vs / num(p.dft), wft = num(p.dft) / vs; let m = `WFT = ${p.dft} / ${vs} = ${r1(wft)} mils; theoretical = 1604 x ${vs} / ${p.dft} = ${r1(th)} SF/gal`;
        if (has(p.loss)) { const pr = th * (1 - num(p.loss) / 100), g = sf * c / pr; m += `; practical = ${r1(th)} x (1 - ${p.loss}%) = ${r1(pr)} SF/gal [ESTIMATOR ASSUMPTION]; gallons = ${sf} x ${c} coats / ${r1(pr)} = ${r1(g)} gal`; rows.push({desc:'Coating gallons', qty:r1(g), unit:'GAL', math:m}); } else rows.push({desc:'Coverage', qty:r1(th), unit:'SF/GAL', math:m + ' (loss factor blank - gallons not computed)'}); }
      if (has(p.rate)) { const mh = sf / num(p.rate) * c; rows.push({desc:'Coating MH', qty:r1(mh), unit:'MH', math:`${sf} SF / ${p.rate} SF/MH x ${c} coats = ${r1(mh)} MH [your rate - ESTIMATOR ASSUMPTION]`}); }
      return {rows}; } });
  add('exc_pit', {trade:'Excavation', name:'Excavation - structure pit (round or rectangular, vertical or sloped)', unit:'BCY', src:S.exc + ' §2.3, §2.5', fields:[F('shape', 'Shape (round / rect)', '', false, 'round'), F('a', 'Pit bottom diameter Dp, or length a (incl. working room)', 'FT'), F('b', 'Width b (rect only)', 'FT', false, ''), F('grade', 'Grade EL', 'FT'), F('floor', 'Floor EL', 'FT'), F('slab', 'Slab thickness', 'FT', false, 0), F('base', 'Base thickness', 'FT', false, 0), F('soil', 'Sloping: OSHA soil type A/B/C, or blank = vertical/shored', '', false, '')],
    calc(p) { const D = num(p.grade) - num(p.floor) + num(p.slab) + num(p.base); if (!(D > 0)) return {err:'Grade must be above the floor'}; const s = exc.OSHA[String(p.soil || '').toUpperCase()], a = num(p.a), b = num(p.b), round = String(p.shape || 'round').startsWith('r') && !String(p.shape).startsWith('rect');
      const dm = `D = (${p.grade} - ${p.floor}) + ${num(p.slab)} + ${num(p.base)} = ${r2(D)} ft`; let v, m;
      if (round) { v = s ? exc.slopeRound(a, D, s) : exc.pitRound(a, D); m = s ? `frustum pi x ${r2(D)}/3 x (R1^2 + R1R2 + R2^2), R1 = ${a / 2}, R2 = ${a / 2} + ${s} x ${r2(D)} -> ${v} BCY` : `0.7854 x ${a}^2 x ${r2(D)} = ${r1(0.7854 * a * a * D)} CF / 27 = ${v} BCY`; }
      else { if (!(b > 0)) return {err:'Width b needed for a rectangular pit'}; v = s ? exc.slopePit(a, b, D, s) : exc.pitRect(a, b, D); m = s ? `prismoidal ${r2(D)}/6 x (A_bot + 4 A_mid + A_top) / 27 at ${s}H:1V = ${v} BCY` : `${a} x ${b} x ${r2(D)} / 27 = ${v} BCY`; }
      return {rows:[{desc:'Pit excavation', qty:v, unit:'BCY', math:`${dm}; ${m}${s ? ` (OSHA Type ${String(p.soil).toUpperCase()} ${s}:1, 29 CFR 1926 Subpart P App. B)` : ' (vertical - needs shoring / box: PE design over 20 ft)'}`}]}; } });
  add('exc_swell', {trade:'Excavation', name:'Excavation - swell / shrink / tons / truck loads', unit:'LCY', src:S.exc + ' §2.7-2.11', fields:[F('bcy', 'Bank CY', 'BCY'), F('swell', 'Swell % (geotech, else ASSUMPTION)', '%'), F('cap', 'Truck capacity (your trucks)', 'LCY', false, ''), F('uw', 'Unit weight TON/CY (spec/supplier)', 'TON/CY', false, '')],
    calc(p) { const l = exc.lcy(num(p.bcy), num(p.swell) / 100), rows = [{desc:'Loose CY', qty:l, unit:'LCY', math:`${p.bcy} BCY x (1 + ${p.swell}%) = ${l} LCY`}];
      if (has(p.cap)) rows.push({desc:'Truck loads', qty:exc.loads(l, num(p.cap)), unit:'LOADS', math:`ROUNDUP(${l} / ${p.cap}) = ${exc.loads(l, num(p.cap))}`}); if (has(p.uw)) rows.push({desc:'Tons', qty:exc.tons(num(p.bcy), num(p.uw)), unit:'TON', math:`${p.bcy} x ${p.uw} = ${exc.tons(num(p.bcy), num(p.uw))} TON`}); return {rows}; } });
  add('roof_area', {trade:'Roofing', name:'Roofing - plan area -> sloped area -> squares with waste', unit:'SQ', src:S.roof + ' §2.1-2.5', fields:[F('L', 'Plan length incl. overhang', 'FT'), F('W', 'Plan width incl. overhang', 'FT'), F('rise', 'Slope rise per 12', 'IN'), F('waste', 'Waste % (DEFAULT - CONFIRM)', '%', false, 10)],
    calc(p) { const A = num(p.L) * num(p.W), pf = roof.pf(num(p.rise)), sl = A * pf, sq = sl / 100, w = sq * (1 + num(p.waste) / 100);
      return {rows:[{desc:'Squares with waste', qty:r2(w), unit:'SQ', math:`${r3(num(p.L))} x ${r3(num(p.W))} = ${r2(A)} SF plan; PF = sqrt(1 + (${p.rise}/12)^2) = ${r4(pf)}; ${r2(A)} x ${r4(pf)} = ${r2(sl)} SF sloped; / 100 = ${r2(sq)} SQ; x (1 + ${num(p.waste)}% waste) = ${r2(w)} SQ`}]}; } });
  add('roof_ss', {trade:'Roofing', name:'Roofing - standing seam panels + clips', unit:'EA', src:S.roof + ' §2.10-2.11', fields:[F('width', 'Width across panel run', 'FT'), F('cov', 'Panel net coverage (mfr)', 'IN'), F('run', 'Slope run', 'FT'), F('rise', 'Slope rise per 12', 'IN'), F('clip', 'Clip spacing (mfr load table)', 'FT', false, '')],
    calc(p) { const n = roof.panels(num(p.width) * 12, num(p.cov)), len = num(p.run) * roof.pf(num(p.rise)), rows = [{desc:'Panels', qty:n, unit:'EA', math:`${r3(num(p.width) * 12)} in / ${p.cov} in = ${r2(num(p.width) * 12 / num(p.cov))} -> ${n} EA; length ${r3(num(p.run))} x ${r4(roof.pf(num(p.rise)))} = ${r2(len)} LF each (+ overhang/hem per detail)`}];
      if (has(p.clip)) rows.push({desc:'Clips', qty:roof.clips(n, len, num(p.clip)), unit:'EA', math:`${n} x (ROUNDUP(${r2(len)} / ${p.clip}) + 1) = ${roof.clips(n, len, num(p.clip))}`}); return {rows}; } });
  add('weld_fillet', {trade:'Welding', name:'Welding - fillet LF, deposited / purchased filler, MH (your rate)', unit:'LF', src:S.weld + ' §2.1-2.7', fields:[F('count', 'Count of welds (members x 2 ends if typical each end)', 'EA'), F('len', 'Length per weld (perimeter if all-around)', 'IN'), F('sides', 'Sides', 'EA', false, 1), F('leg', 'Fillet leg', 'IN'), F('reinf', 'Reinforcement %', '%', false, 15), F('eff', 'Deposition efficiency % (process)', '%', false, ''), F('rate', 'Your production MH/LF', 'MH/LF', false, ''), F('fac', 'Factors multiplied (e.g. field 1.5 x vertical 1.3 = 1.95)', 'x', false, 1)],
    calc(p) { const lf = weld.lf(num(p.count), num(p.len), num(p.sides) || 1), A = weld.fillet(num(p.leg), num(p.reinf) / 100), lb = weld.lbPerLF(A), dep = r2(lf * lb);
      const rows = [{desc:'Fillet weld', qty:lf, unit:'LF', math:`${p.count} x ${p.len} in x ${num(p.sides) || 1} side / 12 = ${lf} LF`}, {desc:'Deposited filler', qty:dep, unit:'LB', math:`A = ${p.leg}^2 / 2 x (1 + ${num(p.reinf)}%) = ${r4(A)} in2; x 12 x 0.283 = ${lb} lb/LF; ${lf} x ${lb} = ${dep} lb`}];
      if (has(p.eff)) rows.push({desc:'Filler to buy', qty:weld.purchased(dep, num(p.eff) / 100), unit:'LB', math:`${dep} / ${num(p.eff) / 100} x 1.05 = ${weld.purchased(dep, num(p.eff) / 100)} lb (round up to package)`});
      if (has(p.rate)) { const mh = r2(lf * num(p.rate) * (num(p.fac) || 1)); rows.push({desc:'Weld MH', qty:mh, unit:'MH', math:`${lf} x ${p.rate} MH/LF x ${num(p.fac) || 1} = ${mh} MH [your rate]`}); } return {rows}; } });
  add('weld_groove', {trade:'Welding', name:'Welding - groove (V / bevel) LF, weld metal; MH from YOUR rate (formula uncalibrated)', unit:'LF', src:S.weld + ' §2.4-2.7', fields:[F('lf', 'Groove length', 'LF'), F('type', 'Type (v / bevel)', '', false, 'v'), F('t', 'Thickness / groove depth', 'IN'), F('R', 'Root opening', 'IN'), F('ang', 'Bevel angle per side', 'deg'), F('reinf', 'Reinforcement %', '%', false, 10), F('rate', 'Your production MH/LF (required - formula is uncalibrated)', 'MH/LF', false, '')],
    calc(p) { const v = String(p.type || 'v').toLowerCase().startsWith('v'), A = (v ? weld.vGroove : weld.bevel)(num(p.t), num(p.R), num(p.ang), num(p.reinf) / 100), lb = weld.lbPerLF(A), lf = num(p.lf);
      const rows = [{desc:'Groove weld metal', qty:r2(lf * lb), unit:'LB', math:`A = ${p.t} x ${p.R} + ${p.t}^2 x tan ${p.ang}${v ? '' : ' / 2'} = ${r4(A / (1 + num(p.reinf) / 100))} in2 x (1 + ${num(p.reinf)}%) = ${r4(A)} in2; ${r4(A)} x 12 x 0.283 = ${lb} lb/LF; x ${lf} LF = ${r2(lf * lb)} lb`}];
      if (has(p.rate)) rows.push({desc:'Groove MH', qty:r2(lf * num(p.rate)), unit:'MH', math:`${lf} LF x ${p.rate} MH/LF = ${r2(lf * num(p.rate))} MH [your rate; the bot formula is UNCALIBRATED and not used]`}); return {rows}; } });

  /* ---------- takeoff check: rules run before a line is saved ---------- */
  const RULES = [
    {id:'cite', trade:'*', src:S.core + ' / ' + S.cad + ' §1', test:L => { const m = [!L.sheet && 'sheet', !L.page && 'PDF page', !L.spec && 'spec section'].filter(Boolean); return m.length ? {lvl:'warn', msg:`Missing cite: ${m.join(', ')}. A line without sheet + page + spec is EXCLUDED from checked totals.`} : null; }},
    {id:'blank0', trade:'*', src:S.skill + ' rule 11', test:L => Object.entries(L.p || {}).some(([k, v]) => ['count', 'n', 'qty'].includes(k) && String(v).trim() === '0') ? {lvl:'warn', msg:'A count of 0 was typed. A blank is not zero - if the plans do not show it, leave it blank so it becomes an RFI.'} : null},
    {id:'rb-straight-hook', tpl:['rebar_bars'], src:S.skill + ' rule 5 / ' + S.cad + ' §5', test:L => /^s/i.test(L.p.cls || '') && num(L.p.hooks) > 0 ? {lvl:'stop', msg:'Marked STRAIGHT but has hooks. Any bend or hook is FABRICATED.'} : null},
    {id:'rb-class', tpl:['rebar_bars'], src:S.skill + ' rule 5', test:L => !L.p.cls ? {lvl:'info', msg:'Fab/straight class not entered - defaults to fabricated. Confirm from the sheet bend or your example bend list; if neither closes it, leave it blank and say why.'} : null},
    {id:'rb-20', tpl:['rebar_bars'], src:S.skill + ' rule 4', test:L => num(R.parseLen(String(L.p.len || ''))) === 20 ? {lvl:'warn', msg:'Length is exactly 20 ft. 20 ft is the ordering stick, not a cut length - confirm the sheet prints this as the bar length (not a slab dimension).'} : null},
    {id:'rb-coat', tpl:['rebar_bars'], src:S.skill + ' rule 8 / ' + S.sd + ' §7', test:L => /epox|galv/i.test(L.p.coat || '') ? {lvl:'rfi', msg:'Coated bar: coating is a NOTE on the amount only (no coating pounds). RFI: confirm coating spec (ASTM A775/A934/A767), lap factor (psi_e) and pricing.'} : null},
    {id:'rb-lap', tpl:['rebar_bars', 'rebar_grid'], src:S.skill + ' rule 9 / ' + S.sd + ' §4.1', test:(L, E) => E.rows.some(r => r.lap) ? {lvl:'warn', msg:'Laps are carried on their own rows. Use the PRINTED lap (lap schedule > spec > code). Include the lap only if the sheet requires it.'} : null},
    {id:'rb-1418', tpl:['rebar_bars', 'rebar_grid'], src:S.sd + ' §4.2 (ACI 318-19 §25.5.1.1)', verify:true, test:(L, E) => [14, 18].includes(num(L.p.bar)) && E.rows.some(r => r.lap) ? {lvl:'stop', msg:'No lap splices of #14 / #18 bars - use mechanical splices (RFI).'} : null},
    {id:'rb-plan', tpl:['rebar_bars', 'rebar_grid'], src:S.skill + ' rule 10', test:(L, E) => { if (!has(L.schedQty) || !E.rows.length) return null; const c = E.rows[0].calcQty, s = num(L.schedQty); return c > s ? {lvl:'info', msg:`Computed ${fmt(c)} LB > plan note ${fmt(s)} LB: keep the higher pounds; discrepancy ${fmt(c - s)} LB. Never shorten a bar or widen spacing to match the note.`} : null; }},
    {id:'rb-size', tpl:['rebar_bars', 'rebar_grid'], src:S.cad + ' §1 / ' + S.sd + ' §6', test:() => ({lvl:'info', msg:'Never change a bar size from what the plans show. Plan / schedule size conflict = RFI.'})},
    {id:'rb-grid-max', tpl:['rebar_grid'], src:S.skill + ' rule 11 / ' + S.cad + ' §6', test:L => /max/i.test(L.desc || '') ? {lvl:'warn', msg:'A spacing printed as a MAXIMUM is not a count by itself - confirm the count basis.'} : {lvl:'info', msg:'Check: +1 on spacing counts; each-way / top-and-bottom counted once per mat; cover deducted both ends.'}},
    {id:'ex-osha', trade:'Excavation', src:S.exc + ' §5 (29 CFR 1926.652, .651(c)(2))', test:(L, E) => { const D = num(L.p.D) || (num(L.p.grade) - num(L.p.floor)); return D >= 5 && !L.p.soil ? {lvl:'warn', msg:`Depth about ${r2(D)} ft >= 5 ft: a protective system is required (slope by soil type, or shoring/box). Over 20 ft needs a PE design. Ladder within 25 ft at 4 ft+.`} : null; }},
    {id:'ex-double', trade:'Excavation', src:S.exc + ' §6.6', test:() => ({lvl:'info', msg:'Common miss: do not double count pipe trench inside a structure pit (trench L = CL-to-CL minus pit radius at each end).'})},
    {id:'ex-swell', tpl:['exc_swell'], src:S.exc + ' §2.7, §4.6', test:() => ({lvl:'info', msg:'Swell / shrink % come from the geotech report; otherwise label ASSUMPTION and send an RFI.'})},
    {id:'co-miss', trade:'Coatings', src:S.coat + ' §6', test:() => ({lvl:'info', msg:'Common misses: top slab underside, benching/inverts, hatch frames & ladders, stripe coats, field touch-up, galv repair (ASTM A780), holiday/DFT testing MH, second "typical" structure.'})},
    {id:'co-id', tpl:['coat_lining'], src:S.coat + ' §5', test:L => ({lvl:'warn', msg:'Linings use the INSIDE diameter; exterior coatings use OD. Wet wells / manholes are confined space (permit, ventilation, attendant, slower production).'})},
    {id:'co-dft', tpl:['coat_lining'], src:S.coat + ' rule 6', test:L => !has(L.p.dft) || !has(L.p.vs) ? {lvl:'rfi', msg:'DFT and volume solids not entered: write NOT SPECIFIED and RFI - never invent DFT / VS / product names.'} : null},
    {id:'rf-slope', trade:'Roofing', src:S.roof + ' §6.2', verify:true, test:L => { const r = num(L.p.rise); return has(L.p.rise) && r < 2 && /shingle/i.test(L.desc || '') ? {lvl:'stop', msg:'Shingles below 2:12 slope - not allowed (IRC/mfr). RFI.'} : null; }},
    {id:'rf-waste', trade:'Roofing', src:S.roof + ' §2.5', test:L => ({lvl:'info', msg:'Waste % is a DEFAULT - CONFIRM value; adjust for cut-up roofs. MH comes from your production rate (MUS1A takeoff file: 44.9 MH governs).'})},
    {id:'wd-ends', trade:'Welding', src:S.weld + ' §7.8', test:() => ({lvl:'info', msg:'A typical connection applies to EACH END: count = members x 2 unless the detail says otherwise.'})},
    {id:'wd-groove', tpl:['weld_groove'], src:S.weld + ' §2.7', test:L => !has(L.p.rate) ? {lvl:'rfi', msg:'Groove labor: the bot formula is UNCALIBRATED. Enter your own MH/LF production rate.'} : null},
    {id:'wd-nde', trade:'Welding', src:S.weld + ' §3.3', verify:true, test:() => ({lvl:'info', msg:'NDE percentages and code clause numbers: VERIFY against the project spec edition.'})},
  ];
  function takeoffCheck(L, E) { E = E || R.evalLine(L); const t = T[L.tpl] || {}, out = [];
    RULES.forEach(r => { if (r.tpl ? !r.tpl.includes(L.tpl) : !(r.trade === '*' || r.trade === t.trade)) return; const x = r.test(L, E); if (x) out.push({...x, id:r.id, src:r.src, verify:!!r.verify}); });
    E.rfi.forEach(m => out.push({lvl:'rfi', msg:m, id:'blank', src:S.core + ' (blank = RFI)'}));
    return {items:out, stop:out.filter(x => x.lvl === 'stop').length, warn:out.filter(x => x.lvl === 'warn' || x.lvl === 'rfi').length}; }

  /* ---------- quote check: runs before a quote / CO goes out ---------- */
  let quoteCheck = function (C, Tt, text) { const out = [], s = String(text || '') + ' ' + JSON.stringify(C.lines || []);
    if (/all[\s-]*in\b/i.test(s)) out.push({lvl:'stop', msg:'The words "all-in" appear - not allowed on Rebar-Fab quotes.', src:S.mar + ' §2'});
    if (C.type === 'rebar' && /\bconcrete\b/i.test(JSON.stringify((C.lines || []).map(l => l.desc)))) out.push({lvl:'warn', msg:'A line mentions concrete. Concrete is never quoted - "by others".', src:S.mar + ' §2 / ' + S.cad + ' §6'});
    const R2 = Tt && Tt.est; if (R2 && has(C.est && C.est.markupPct) && num(C.est.markupPct) < 0) out.push({lvl:'stop', block:true, msg:'Markup is negative: sell < cost = BELOW COST. Send is blocked.', src:S.mar + ' §7'});
    if (Tt && Tt.total < 0) out.push({lvl:'stop', block:true, msg:'Total is below zero - BELOW COST. Send is blocked (use a credit CO).', src:S.mar + ' §7'});
    if (R2 && R2.rfi && R2.rfi.length) out.push({lvl:'warn', msg:`${R2.rfi.length} rate(s) blank - counted as zero dollars (MISSING).`, src:S.mar + ' §7'});
    return {items:out, block:out.some(x => x.block), stop:out.filter(x => x.lvl === 'stop').length}; }


  ASSUME.push({id:'conc-waste', src:S.conc + ' §4', text:'Concrete waste % by element (footings 10%, SOG 5%, walls 5%, wet well 7%, ductbank 10% ...) - house practice, not code', tag:'DEFAULT - CONFIRM'},
    {id:'pipe-rates', src:S.pipe + ' §7', text:'Piping MH per dia-inch / per LF production and 10% scaled-run allowance', tag:'DEFAULT - CONFIRM'},
    {id:'pipe-code', src:S.pipe + ' §4', text:'ASME B31.3 345.4.2 test pressure 1.5 x P x ST/S and AWWA C600 leakage L = S x D x sqrt(P) / 148,000', tag:'VERIFY against the project spec edition'},
    {id:'elec-assume', src:S.elec + ' §4, §11', text:'Electrical makeup 3 ft per conductor end, stub-up 3 ft, cable drop slack 10 ft, MH production units', tag:'DEFAULT - CONFIRM'},
    {id:'elec-code', src:S.elec + ' §5', text:'NEC burial depths, fill and bend limits (360° between pull points)', tag:'VERIFY'},
    {id:'stl-aisc', src:S.stl + ' §2.1', text:'AISC Manual table numbers for shape weights (W-shape lb/ft = the number after X is verified by designation)', tag:'VERIFY IN AISC TABLE'},
    {id:'stl-deck', src:S.stl + ' §2.3', text:'Metal deck psf by profile and gauge (1.5B 18 ga ~2.84 psf in the example)', tag:'VERIFY IN MFR CATALOG'},
    {id:'stl-osha', src:S.stl + ' §1G-1H', text:'OSHA 1910.23 ladders / 1910.29 guards and handrails (42 in top rail, 200 lb)', tag:'VERIFY'});
  /* ---------- concrete (src: concrete.md) ---------- */
  const conc = { cy:(L, W, D) => r2(L * W * D / 27), cyl:(r, h, n = 1) => r3(n * PI * r * r * h / 27), annulus:(Ro, Ri, h) => r2(PI * (Ro * Ro - Ri * Ri) * h / 27),
    ductPerLF:(W, H, nC, odFt) => r3((W * H - nC * PI * (odFt / 2) ** 2) / 27), order:(cy, w) => Math.ceil(cy * (1 + w) * 2 - 1e-9) / 2, sogPerSF:t => r4(t / 12 / 27) };
  /* ---------- masonry (src: masonry.md) ---------- */
  const mas = { clPerim:(L, W, t) => r2(2 * (L + W) - 4 * t), courses:hIn => r3(hIn / 8), units:(sf, per = 1.125) => r1(sf * per), cells:(run, sp, extra = 0) => ceil(run / sp) + extra, grout:(cells, h, cf = 0.172) => r1(cells * h * cf), vertLF:(cells, h, hookFt) => r1(cells * (h + hookFt)), jrLF:(lf, courses, lap = 0.05) => r1(lf * courses * (1 + lap)) };
  /* ---------- steel (src: steel.md) ---------- */
  const stl = { shape:(n, L, w) => r1(n * L * w), plate:(t, w, l) => r2(t * w * l * 0.2836), plateLF:(t, w) => r2(t * w * 12 * 0.2836), deck:(sf, psf) => r1(sf * psf), conn:(lb, pct = 7.5) => r1(lb * pct / 100), galv:(lb, pct = 4.5) => r1(lb * pct / 100), tons:lb => r2(lb / 2000),
    wNominal:d => { const m = String(d || '').toUpperCase().match(/^W\d+X(\d+(\.\d+)?)$/); return m ? +m[1] : null; } };
  /* ---------- piping (src: piping.md) ---------- */
  const pipe = { joints:(lf, lay) => Math.max(0, ceil(lf / lay) - 1), welds:(ells, tees, red, caps, wn) => ells * 2 + tees * 3 + red * 2 + caps + wn, supports:(lf, span) => ceil(lf / span) + 1,
    hydroGal:(id, L) => r1(0.0408 * id * id * L), testP:(P, ratio) => r1(1.5 * P * ratio), leak:(S1, D, P) => r2(S1 * D * Math.sqrt(P) / 148000), insulEq:(lf, ells, tees, valves) => lf + ells * 2 + tees * 3 + valves * 4 };
  /* ---------- electrical (src: electrical.md) ---------- */
  const elec = { pxPerFt:(dpi, inPerFt) => r2(dpi * inPerFt), riser:(n, ends, coverFt, clFt) => r2(n * ends * (coverFt + clFt)), ductCY:(Win, Hin, lf) => r2(Win * Hin / 144 * lf / 27), wire:(cond, route, makeup = 3, ends = 2) => cond * (route + makeup * ends), drop:(top, bot, slack) => r2(top - bot + slack), laps20:run => Math.max(0, ceil(run / 20) - 1) };
  /* ---------- competitive quote leveling (src: competitive_quote.md) - math only, competitor prices never copied ---------- */
  const cq = { perLb:(total, lb) => r4(total / lb), perCwt:(total, lb) => r2(total / lb * 100), perTon:(total, lb) => r2(total / lb * 2000), escal:(lbUnshipped, perCwt, q) => r2(lbUnshipped / 100 * perCwt * q), shopFabOnly:(fabLb, perT) => r2(fabLb / 2000 * perT) };

  add('conc_elem', {trade:'Concrete', name:'Concrete - element CY with waste + order (round up 0.5 CY)', unit:'CY', src:S.conc + ' §2-4', fields:[F('L', 'Length', 'FT'), F('W', 'Width (or thickness for walls)', 'FT'), F('D', 'Depth / height', 'FT'), F('n', 'Count', 'EA', false, 1), F('ded', 'Deductions >= 1 CF (printed openings)', 'CF', false, 0), F('waste', 'Waste % (house DEFAULT - CONFIRM)', '%', false, '')],
    calc(p) { const cf = num(p.L) * num(p.W) * num(p.D) * (num(p.n) || 1) - num(p.ded), cy = r2(cf / 27), rows = [{desc:'Net concrete', qty:cy, unit:'CY', math:`${p.n || 1} x ${r3(num(p.L))} x ${r3(num(p.W))} x ${r3(num(p.D))} = ${r3(cf + num(p.ded))} CF${num(p.ded) ? ` - ${p.ded} CF openings` : ''} / 27 = ${cy} CY`}];
      if (has(p.waste)) { const o = conc.order(cy, num(p.waste) / 100); rows.push({desc:'Order', qty:o, unit:'CY', math:`${cy} x (1 + ${p.waste}% DEFAULT - CONFIRM) = ${r2(cy * (1 + num(p.waste) / 100))} -> round up to 0.5 CY = ${o} CY`}); } return {rows}; } });
  add('conc_duct', {trade:'Concrete', name:'Concrete - ductbank encasement (conduit voids optional)', unit:'CY', src:S.conc + ' §2.3 / ' + S.elec + ' §4', fields:[F('lf', 'Route length carrying this detail', 'FT'), F('Win', 'Encasement width', 'IN'), F('Hin', 'Encasement height', 'IN'), F('nC', 'Conduits (deduct only if printed)', 'EA', false, 0), F('od', 'Conduit OD', 'IN', false, '')],
    calc(p) { const W = num(p.Win) / 12, H = num(p.Hin) / 12, vo = num(p.nC) && has(p.od) ? num(p.nC) * PI * (num(p.od) / 24) ** 2 : 0, per = (W * H - vo) / 27, cy = r2(per * num(p.lf));
      return {rows:[{desc:'Ductbank concrete', qty:cy, unit:'CY', math:`(${p.Win} x ${p.Hin} / 144 = ${r3(W * H)} SF${vo ? ` - ${p.nC} x pi x (${p.od}/24)^2 = ${r3(vo)} SF voids` : ' (voids not deducted - conservative)'}) / 27 = ${r3(per)} CY/LF x ${p.lf} LF = ${cy} CY`}]}; } });
  add('mas_wall', {trade:'Masonry', name:'Masonry - CMU wall: CL perimeter, net SF, units, grout cells, verts', unit:'EA', src:S.mas + ' §2', fields:[F('L', 'Building length out-to-out', 'FT'), F('W', 'Building width out-to-out', 'FT'), F('t', 'Wall thickness (actual)', 'FT'), F('h', 'Wall height', 'FT'), F('open', 'Openings (masonry opening SF)', 'SF', false, 0), F('sp', 'Vertical grout / bar spacing', 'FT', false, ''), F('extraCells', 'Corner + jamb cells - shared', 'EA', false, 0), F('cf', 'Grout CF per cell-ft (ASSUMPTION - confirm)', 'CF', false, ''), F('bar', 'Vertical bar size #', '', false, '')],
    calc(p) { const cl = mas.clPerim(num(p.L), num(p.W), num(p.t)), h = num(p.h), g = r1(cl * h), net = r1(g - num(p.open)), u = mas.units(net);
      const rows = [{desc:'CMU units', qty:u, unit:'EA', math:`CL = 2 x (${p.L} + ${p.W}) - 4 x ${p.t} = ${cl} LF; gross ${cl} x ${r3(h)} = ${g} SF - ${num(p.open)} SF openings = ${net} SF x 1.125 units/SF = ${u} EA`}];
      if (has(p.sp)) { const c = mas.cells(cl, num(p.sp), num(p.extraCells)); rows.push({desc:'Grouted cells', qty:c, unit:'EA', math:`ROUNDUP(${cl} / ${p.sp}) = ${ceil(cl / num(p.sp))} + ${num(p.extraCells)} corners/jambs (net) = ${c}`});
        if (has(p.cf)) rows.push({desc:'Vertical grout', qty:mas.grout(c, h, num(p.cf)), unit:'CF', math:`${c} x ${r3(h)} x ${p.cf} CF/cell-ft [ASSUMPTION - confirm] = ${mas.grout(c, h, num(p.cf))} CF`});
        const bar = num(p.bar), w = R.A615[bar]; if (w) { const hk = 12 * DB[bar] / 12, lf = mas.vertLF(c, h, hk); rows.push({desc:`#${bar} verts`, qty:r1(lf * w), unit:'LB', math:`${c} x (${r3(h)} + 12db hook ${r3(hk)}) = ${lf} LF x ${w} = ${r1(lf * w)} LB`}); } }
      return {rows}; } });
  add('stl_member', {trade:'Steel', name:'Steel - members / plate by weight (+ connection %, galv %)', unit:'LB', src:S.stl + ' §2', fields:[F('desig', 'Designation (W6X20, PL1/4x12 ...)', ''), F('n', 'Count', 'EA'), F('L', 'Length each', 'FT'), F('w', 'Unit weight lb/ft (blank: W-shape nominal; plate: t x w x 3.403)', 'LB/FT', false, ''), F('conn', 'Connection allowance % (DEFAULT 7.5 - CONFIRM)', '%', false, ''), F('galv', 'Galvanizing % (DEFAULT 4.5 - CONFIRM)', '%', false, '')],
    calc(p) { let w = has(p.w) ? num(p.w) : stl.wNominal(p.desig), src = has(p.w) ? 'entered' : 'W-shape nominal from designation [VERIFY IN AISC TABLE]'; const pm = String(p.desig || '').toUpperCase().match(/^PL\s*(\d+(?:\/\d+)?|\d*\.\d+)\s*X\s*(\d+(?:\.\d+)?)/);
      if (!w && pm) { const t = pm[1].includes('/') ? pm[1].split('/')[0] / pm[1].split('/')[1] : +pm[1]; w = stl.plateLF(t, +pm[2]); src = `plate ${t} x ${pm[2]} x 12 x 0.2836 = ${w} lb/LF`; }
      if (!w) return {err:'Unit weight not found - enter lb/ft from the AISC Manual (VERIFY IN AISC TABLE)'}; const lb = stl.shape(num(p.n), num(p.L), w), rows = [{desc:p.desig || 'Steel', qty:lb, unit:'LB', math:`${p.n} EA x ${r3(num(p.L))} ft x ${w} lb/ft (${src}) = ${lb} lb; / 2000 = ${stl.tons(lb)} T`}];
      if (has(p.conn)) rows.push({desc:'Connection allowance', qty:stl.conn(lb, num(p.conn)), unit:'LB', math:`${lb} x ${p.conn}% (DEFAULT - CONFIRM; industry practice, not code) = ${stl.conn(lb, num(p.conn))} lb`});
      if (has(p.galv)) rows.push({desc:'Galvanizing add', qty:stl.galv(lb, num(p.galv)), unit:'LB', math:`${lb} x ${p.galv}% (DEFAULT - CONFIRM) = ${stl.galv(lb, num(p.galv))} lb (separate line)`}); return {rows}; } });
  add('pipe_di', {trade:'Piping', name:'Piping - welds + diameter-inches + joints + supports', unit:'DI', src:S.pipe + ' §3.1-3.6', fields:[F('nps', 'Nominal size', 'IN'), F('lf', 'Straight LF', 'FT'), F('lay', 'Laying / random length', 'FT'), F('ells', '90/45 ells', 'EA', false, 0), F('tees', 'Tees', 'EA', false, 0), F('red', 'Reducers', 'EA', false, 0), F('caps', 'Caps', 'EA', false, 0), F('wn', 'WN flanges', 'EA', false, 0), F('span', 'Support span (spec / MSS SP-58)', 'FT', false, '')],
    calc(p) { const fw = pipe.welds(num(p.ells), num(p.tees), num(p.red), num(p.caps), num(p.wn)), j = pipe.joints(num(p.lf), num(p.lay)), W = fw + j, di = r1(W * num(p.nps));
      const rows = [{desc:'Diameter-inches', qty:di, unit:'DI', math:`fittings ${p.ells || 0}x2 + ${p.tees || 0}x3 + ${p.red || 0}x2 + ${p.caps || 0}x1 + ${p.wn || 0}x1 = ${fw}; joints ROUNDUP(${p.lf} / ${p.lay}) - 1 = ${j}; welds ${W} x ${p.nps}" = ${di} DI`}];
      if (has(p.span)) rows.push({desc:'Supports', qty:pipe.supports(num(p.lf), num(p.span)), unit:'EA', math:`ROUNDUP(${p.lf} / ${p.span}) + 1 = ${pipe.supports(num(p.lf), num(p.span))}`}); return {rows}; } });
  add('pipe_test', {trade:'Piping', name:'Piping - hydrotest water volume, test pressure, allowable leakage', unit:'GAL', src:S.pipe + ' §3.7', fields:[F('id', 'Inside diameter', 'IN'), F('L', 'Length tested', 'FT'), F('P', 'Design / avg test pressure', 'PSI', false, ''), F('ratio', 'S_T / S ratio (B31.3)', '', false, ''), F('D', 'Nominal dia for leakage (AWWA C600)', 'IN', false, '')],
    calc(p) { const rows = [{desc:'Fill volume', qty:pipe.hydroGal(num(p.id), num(p.L)), unit:'GAL', math:`0.0408 x ${p.id}^2 x ${p.L} = ${pipe.hydroGal(num(p.id), num(p.L))} gal`}];
      if (has(p.P) && has(p.ratio)) rows.push({desc:'Test pressure (B31.3 VERIFY)', qty:pipe.testP(num(p.P), num(p.ratio)), unit:'PSIG', math:`1.5 x ${p.P} x ${p.ratio} = ${pipe.testP(num(p.P), num(p.ratio))} psig`});
      if (has(p.P) && has(p.D)) rows.push({desc:'Allowable leakage (C600 VERIFY)', qty:pipe.leak(num(p.L), num(p.D), num(p.P)), unit:'GAL/HR', math:`${p.L} x ${p.D} x sqrt(${p.P}) / 148,000 = ${pipe.leak(num(p.L), num(p.D), num(p.P))} gal/hr`}); return {rows}; } });
  add('elec_duct', {trade:'Electrical', name:'Electrical - conduit LF with risers, stub-ups, wire with makeup', unit:'LF', src:S.elec + ' §4', fields:[F('run', 'Scaled run (one conduit)', 'FT'), F('n', 'Parallel conduits', 'EA'), F('ends', 'Riser ends', 'EA', false, 2), F('cover', 'Cover depth', 'FT', false, ''), F('cl', 'Depth to conduit CL', 'FT', false, 0), F('stub', 'Stub-up per end (printed, else ASSUMPTION)', 'FT', false, ''), F('cond', 'Conductors per conduit', 'EA', false, ''), F('makeup', 'Makeup per end (DEFAULT 3 - CONFIRM)', 'FT', false, 3)],
    calc(p) { const n = num(p.n), ends = num(p.ends), rs = has(p.cover) ? elec.riser(n, ends, num(p.cover), num(p.cl)) : 0, st = has(p.stub) ? n * ends * num(p.stub) : 0, lf = r2(num(p.run) * n + rs + st);
      const rows = [{desc:'Conduit', qty:lf, unit:'LF', math:`${p.run} x ${n} = ${r2(num(p.run) * n)}${rs ? ` + risers ${n} x ${ends} x (${p.cover} + ${num(p.cl)}) = ${rs}` : ''}${st ? ` + stub-ups ${n} x ${ends} x ${p.stub} = ${st}` : ''} = ${lf} LF`}];
      if (has(p.cond)) { const route = lf / n, wl = r2(num(p.cond) * n * (route + num(p.makeup) * ends)); rows.push({desc:'Wire', qty:wl, unit:'LF', math:`${p.cond} cond x ${n} conduits x (${r2(route)} + ${num(p.makeup)} x ${ends} makeup) = ${wl} LF`}); } return {rows}; } });

  RULES.push(
    {id:'cc-thick', trade:'Concrete', src:S.conc + ' §7.1-7.2', test:() => ({lvl:'info', msg:'Plan vs section thickness / count conflict: carry the LARGER value and open an RFI. Never average.'})},
    {id:'cc-precast', trade:'Concrete', src:S.conc + ' §7.3', test:L => /precast|by mfr|delegated/i.test(L.desc || '') ? {lvl:'stop', msg:'Precast / by MFR / delegated design is not CIP - do not quantify; list it and RFI any CIP base/collar.'} : null},
    {id:'cc-miss', trade:'Concrete', src:S.conc + ' §8', test:() => ({lvl:'info', msg:'Common misses: thickened edges/turndowns, slab steps, MEP equipment pads, pole/bollard foundations, thrust blocks at every bend/tee/plug, wet well fillets & benching, mud mats, base plate grout.'})},
    {id:'cc-scale', trade:'Concrete', src:S.conc + ' §7.9', test:() => ({lvl:'info', msg:'Never scale a detail without printed dimensions - leave the line blank and RFI.'})},
    {id:'ms-miss', trade:'Masonry', src:S.mas + ' §6', verify:true, test:() => ({lvl:'info', msg:'Check: bond beams at every course listed, lintel units, jamb/corner cells, dowels = verticals at foundation, joint reinforcement laps (TMS 602 6 in), control joints, flashing + weeps. TMS section numbers VERIFY.'})},
    {id:'ms-open', trade:'Masonry', src:S.mas + ' §2.1', test:() => ({lvl:'info', msg:'Deduct MASONRY OPENING sizes (not door/frame size) when printed; note it if only the frame size is printed.'})},
    {id:'st-conn', trade:'Steel', src:S.stl + ' §2.5', test:L => has(L.p && L.p.conn) ? {lvl:'warn', msg:'Connection allowance is industry practice (DEFAULT 7.5% - CONFIRM), not code. Do not apply it to detailed plates / gussets / misc metals.'} : null},
    {id:'st-verify', trade:'Steel', src:S.stl + ' §2.1-2.3', verify:true, test:() => ({lvl:'info', msg:'Shape weights from the AISC Manual and deck psf from the MFR catalog - VERIFY until confirmed. W-shape nominal (number after X) is lb/ft.'})},
    {id:'st-miss', trade:'Steel', src:S.stl + ' §7', test:() => ({lvl:'info', msg:'Common misses: lintels at all openings, embeds, ladders/guards (OSHA), base plates, bracing, deck edge angles/pour stops, galvanizing as its own line.'})},
    {id:'pp-typ', trade:'Piping', src:S.pipe + ' §3.2', test:() => ({lvl:'info', msg:'A "TYP" callout applies to every like condition - multiply by the number of identical conditions and show it.'})},
    {id:'pp-scale', trade:'Piping', src:S.pipe + ' §5.3', test:() => ({lvl:'info', msg:'Scale check: measure a labeled object first; if it does not match, factor = labeled / measured. Scaled runs are ASSUMPTIONS until confirmed.'})},
    {id:'pp-test', tpl:['pipe_test'], src:S.pipe + ' §3.7, §4', verify:true, test:() => ({lvl:'warn', msg:'Test pressure / leakage formulas: VERIFY against the project spec edition (B31.3 345.4.2, AWWA C600).'})},
    {id:'el-plug', trade:'Electrical', src:S.elec + ' §8', test:() => ({lvl:'info', msg:'Printed vs PLUG: anything not printed is an orange "ASSUMPTION - plug qty, not printed" line plus an RFI. +10% waste on plug lines only.'})},
    {id:'el-360', trade:'Electrical', src:S.elec + ' §4, §5', verify:true, test:() => ({lvl:'info', msg:'Check total bends between pull points (max 360°, NEC - VERIFY) and that ductbank conduit counts match the one-line.'})},
    {id:'el-scale', trade:'Electrical', src:S.elec + ' §7', test:() => ({lvl:'info', msg:'Verify scale against a printed dimension before measuring anything (px/ft = DPI x scale in/ft).'})}
  );
  const quoteCheckBase = quoteCheck;
  quoteCheck = function (C, Tt, text) { const r = quoteCheckBase(C, Tt, text), s = String(text || '') + ' ' + JSON.stringify(C.lines || []);
    if (C.type === 'rebar' && /\b(1|one)[\s-]*week\b/i.test(s)) r.items.push({lvl:'stop', msg:'Never promise a 1-week fabrication - capacity claims stay blank.', src:S.cq + ' H7'});
    if (C.type === 'rebar' && /\b(placing|tying|install)/i.test(s) && !/exclud/i.test(s)) r.items.push({lvl:'warn', msg:'Placing, tying and installation are EXCLUDED (supply only) - say so.', src:S.cq + ' H6'});
    if (/\b(cost|markup|margin)\b/i.test(String(C.notes || ''))) r.items.push({lvl:'warn', msg:'Customer copy shows sell only - remove cost / markup / margin wording from the notes.', src:S.cq + ' H4 / ' + S.mar + ' §7'});
    r.stop = r.items.filter(x => x.lvl === 'stop').length; r.block = r.items.some(x => x.block); return r; };

  return {S, ASSUME, RULES, takeoffCheck, quoteCheck:(...a) => quoteCheck(...a), conc, mas, stl, pipe, elec, cq, parseMark, hookExt, spiral, lapsPerBar, cover, countBars, fabTolerance, coat, exc, roof, weld, mar, DB, SIZES};
});
