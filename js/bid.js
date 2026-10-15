/* Right Hand Man v1.9.1 - Bid tools: leveling, alternates, escalation, clauses, bid/no-bid, unit-price bid form CSV, past-jobs unit costs.
   All $ are the user's entries; blanks are flagged, never filled in. Math in js/calc_field.js (RHMF). */
'use strict';
const CLAUSE0 = {inc:['Fabricated and straight reinforcing steel per the bar list, tagged by mark', 'Shop drawings (placing drawings + bar list) for approval', 'Delivery to the jobsite (trucking shown as its own line)'],
  exc:['Concrete by others', 'Placing, tying and accessories unless listed', 'Bonds, permits and testing unless listed', 'Sales tax unless shown', 'Engineering / delegated design (PE) unless listed', 'Changes after shop drawing approval (priced as a CO)'],
  cla:['Quantities are from the drawings and specs cited on each line; revisions or addenda after the quote date will be re-priced', 'Prices firm for the period stated in the escalation clause', 'Fabrication lead time starts at approved shop drawings - no 1-week fab promise', 'Offload by others unless listed; site must allow truck access']};
const bidGet = async () => { const B = (await DB.kv('bid:' + APP.pid)) || {}; return Object.assign({scopes:[], bidders:[], base:'', alts:[], esc:{}, pick:{inc:[], exc:[], cla:[]}, bidq:{}, form:[], tabs:[]}, B); };
const libGet = () => SET.clauseLib || structuredClone(CLAUSE0);
TITLES.bid = 'Bid tools';
ROUTES.bid = async tab => { if (needProj()) return; tab = tab || APP.bidTab || 'level'; APP.bidTab = tab; const B = await bidGet(), save = () => DB.kv('bid:' + APP.pid, B);
  const tabs = [['level', 'Leveling'], ['alts', 'Alternates'], ['esc', 'Escalation'], ['clauses', 'Incl / Excl'], ['bidq', 'Bid / no-bid'], ['form', 'Bid form'], ['past', 'Past costs'], ['tab', 'Bid tabs']];
  B.pick = Object.assign({inc:[], exc:[], cla:[]}, B.pick || {}); B.form = B.form || []; B.esc = B.esc || {}; B.bidq = B.bidq || {};
  let body = '';
  if (tab === 'level') { const L = RHMF.level(B.scopes, B.bidders);
    body = `<div class="card"><h3>Scopes to compare</h3><p class="small muted">The "plug" is YOUR number added to a bidder who excludes that scope. Blank plug = flagged.</p>${B.scopes.map((s, i) => `<div class="grid3 lv"><input aria-label="Scope name" data-sc="${i}:name" value="${esc(s.name || '')}" placeholder="Scope (e.g. Trucking)"><input aria-label="Plug $" data-sc="${i}:plug" type="number" inputmode="decimal" value="${s.plug ?? ''}" placeholder="Plug $"><button class="btn sm danger" data-scdel="${i}" aria-label="Remove scope">✕</button></div>`).join('')}<button class="btn sm" id="scAdd">➕ Scope</button></div>
    <div class="card"><h3>Sub / supplier quotes</h3>${B.bidders.map((b, i) => `<div class="card bidder"><div class="grid2"><label class="fld"><span>Bidder</span><input data-bd="${i}:name" value="${esc(b.name || '')}"></label><label class="fld"><span>Base quote $</span><input data-bd="${i}:base" type="number" inputmode="decimal" value="${b.base ?? ''}"></label></div>
      <div class="chips">${B.scopes.map(s => `<label class="switch"><input type="checkbox" data-inc="${i}:${s.id}" ${(b.incl || {})[s.id] === false ? '' : 'checked'}><span>${esc(s.name || 'scope')} included</span></label>`).join('')}</div><button class="btn sm danger" data-bddel="${i}">Remove bidder</button></div>`).join('')}<button class="btn sm" id="bdAdd">➕ Bidder</button></div>
    ${B.bidders.length ? `<div class="card" id="levRes"><h3>Leveled</h3><table class="t money"><thead><tr><th scope="col">Bidder</th><th scope="col">Base</th><th scope="col">Plugs</th><th scope="col">Leveled</th><th scope="col">Over low</th></tr></thead><tbody>${L.rows.map(r => `<tr class="${r.low ? 'low' : ''}"><td>${esc(r.name)}${r.low ? ' ✔ low' : ''}</td><td>${M(r.base)}</td><td>${M(r.adds)}</td><td><b>${M(r.leveled)}</b></td><td>${r.low ? '—' : M(r.over)}</td></tr>`).join('')}</tbody></table><details class="math"><summary>Show the math</summary><ul class="small">${L.rows.map(r => `<li>${esc(r.name)}: ${esc(r.math)}</li>`).join('')}</ul></details>${L.rfi.length ? `<p class="small bad">${L.rfi.map(esc).join('<br>')}</p>` : ''}</div>` : ''}`; }
  if (tab === 'alts') { const A = RHMF.alternates(B.base, B.alts);
    body = `<div class="card"><label class="fld"><span>Base bid $</span><input id="altBase" type="number" inputmode="decimal" value="${B.base ?? ''}"></label>${B.alts.map((a, i) => `<div class="grid4 alt"><input aria-label="Alternate name" data-al="${i}:name" value="${esc(a.name || '')}" placeholder="Alt ${i + 1}"><select aria-label="Add or deduct" data-al="${i}:kind"><option value="add" ${a.kind !== 'deduct' ? 'selected' : ''}>Add</option><option value="deduct" ${a.kind === 'deduct' ? 'selected' : ''}>Deduct</option></select><input aria-label="Amount $" data-al="${i}:amt" type="number" inputmode="decimal" value="${a.amt ?? ''}" placeholder="$"><label class="switch"><input type="checkbox" data-alacc="${i}" ${a.accepted ? 'checked' : ''}><span>Accepted</span></label></div>`).join('')}
      <button class="btn sm" id="alAdd">➕ Alternate</button></div><div class="card" id="altRes"><h3>Total with accepted alternates: ${M(A.total)}</h3><p class="small mono">${esc(A.math)}</p></div>`; }
  if (tab === 'esc') { const E = RHMF.escalation(Object.assign({asOf:today()}, B.esc));
    body = `<div class="card"><div class="grid2"><label class="fld"><span>Prices firm through</span><input type="date" data-es="firm" value="${B.esc.firm || ''}"></label><label class="fld"><span>$ per cwt per quarter after that</span><input data-es="cwt" type="number" inputmode="decimal" value="${B.esc.cwt ?? ''}"></label><label class="fld"><span>Unshipped tons</span><input data-es="tons" type="number" inputmode="decimal" value="${B.esc.tons ?? ''}"></label><label class="fld"><span>Ship date to check</span><input type="date" data-es="asOf" value="${B.esc.asOf || today()}"></label></div></div>
      <div class="card" id="escRes"><h3>Escalation due: ${M(E.amt)}</h3><p class="small mono">${esc(E.math)}</p>${E.rfi.length ? `<p class="small bad">${E.rfi.map(esc).join('<br>')}</p>` : ''}<h4>Clause for the quote</h4><p class="small" id="escClause">${esc(E.clause)}</p><button class="btn sm" id="escCopy">📋 Copy clause</button></div>`; }
  if (tab === 'clauses') { const lib = libGet(), nm = {inc:'Inclusions', exc:'Exclusions', cla:'Clarifications'};
    body = Object.keys(nm).map(k => `<div class="card"><h3>${nm[k]}</h3>${lib[k].map((t, i) => `<label class="switch"><input type="checkbox" data-cl="${k}:${i}" ${B.pick[k].includes(t) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}<div class="row"><input aria-label="New ${nm[k]} item" id="new-${k}" placeholder="Add your own…"><button class="btn sm" data-cladd="${k}">Add</button></div></div>`).join('')
      + `<div class="card"><p class="small muted">Starter list - edit it to match how you quote. It never changes prices.</p><div class="row"><button class="btn p" id="clIns">⤵ Put picked items in a quote / CO</button><button class="btn" id="clCopy">📋 Copy</button></div></div>`; }
  if (tab === 'bidq') { const S = RHMF.bidScore(B.bidq);
    body = `<div class="card">${RHMF.BIDQ.map(([k, q]) => `<fieldset class="bq"><legend>${esc(q)}</legend><div class="seg" role="radiogroup">${[['y', 'Yes'], ['n', 'No'], ['', 'Not sure']].map(([v, l]) => `<button role="radio" aria-checked="${(B.bidq[k] || '') === v}" class="${(B.bidq[k] || '') === v ? 'on' : ''}" data-bq="${k}:${v}">${l}</button>`).join('')}</div></fieldset>`).join('')}</div>
      <div class="card" id="bqRes"><h3>${esc(S.rec)}</h3><p class="small mono">${esc(S.math)}</p></div>`; }
  if (tab === 'form') { B.form = B.form || []; const T = RHMF.bidTotals(B.form);
    body = `<div class="card"><h3>Unit-price bid form (TxDOT-style)</h3><p class="small muted">Import a CSV with Item No, Description, Unit, Quantity, Unit Price, Waste %. Blank price or qty = $0 + RFI — never invent a number.</p>
      <div class="row"><label class="btn p">⬆ Import CSV<input type="file" accept=".csv,text/csv" id="bfImp" hidden></label><button class="btn" id="bfExp" ${B.form.length ? '' : 'disabled'}>⬇ Export CSV</button><button class="btn" id="bfXLS" ${B.form.length ? '' : 'disabled'}>⬇ Excel</button><button class="btn" id="bfAdd">➕ Line</button><button class="btn danger sm" id="bfClr" ${B.form.length ? '' : 'disabled'}>Clear</button></div></div>
      ${B.form.length ? `<div class="tscroll" tabindex="0" role="region" aria-label="Bid form"><table class="t money"><thead><tr><th scope="col">Item</th><th scope="col">Description</th><th scope="col">Unit</th><th scope="col">Qty</th><th scope="col">Waste %</th><th scope="col">Unit $</th><th scope="col">Bid qty</th><th scope="col">Amount</th><th scope="col"><span class="sr-only">Remove</span></th></tr></thead><tbody>
      ${T.lines.map((l, i) => `<tr><td><input aria-label="Item" data-bf="${i}:item" value="${esc(l.item || '')}" style="width:5.5em"></td><td><input aria-label="Description" data-bf="${i}:desc" value="${esc(l.desc || '')}"></td><td><input aria-label="Unit" data-bf="${i}:unit" value="${esc(l.unit || '')}" style="width:3.5em"></td>
        <td><input aria-label="Qty" data-bf="${i}:qty" type="number" inputmode="decimal" value="${l.qty ?? ''}" style="width:5em"></td><td><input aria-label="Waste %" data-bf="${i}:waste" type="number" inputmode="decimal" value="${l.waste ?? ''}" style="width:4em"></td>
        <td><input aria-label="Unit price" data-bf="${i}:price" type="number" inputmode="decimal" step="any" value="${l.price ?? ''}" style="width:5.5em"></td><td>${RHM.fmt(l.bidQty)}</td><td><b>${M(l.amt)}</b></td><td><button class="btn sm danger" data-bfdel="${i}" aria-label="Remove line">✕</button></td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="7"><b>Total</b></td><td><b>${M(T.total)}</b></td><td></td></tr></tfoot></table></div>
      <details class="math open"><summary>Show the math</summary><ul class="small">${T.lines.map(l => `<li>${esc(l.item || '')} ${esc(l.desc)}: ${esc(l.math)}</li>`).join('')}<li><b>Total = ${M(T.total)}</b></li></ul></details>
      ${T.rfi.length ? `<p class="small bad">Needs a number: ${T.rfi.map(esc).join('; ')}</p>` : ''}` : emptyState('📄', 'No bid-form lines yet', 'Import a TxDOT-style CSV or add a line. Unit prices stay blank until you type them.')}`; }
  if (tab === 'past') { const ps = await DB.all('projects'), pool = B.pastDoneOnly ? ps.filter(x => x.complete) : ps, U = RHMF.pastUnitCosts(pool);
    body = `<div class="card"><h3>Past-jobs unit costs</h3><p class="small muted">Averages from SOV unit prices you entered on your own projects. LS and blank prices are skipped. Nothing is invented — blank when there is no data.</p>
      <label class="switch"><input type="checkbox" id="pastDone" ${B.pastDoneOnly ? 'checked' : ''}><span>Only projects marked complete</span></label></div>
      ${U.length ? `<div class="tscroll" tabindex="0" role="region" aria-label="Past unit costs"><table class="t money"><thead><tr><th scope="col">Description</th><th scope="col">Unit</th><th scope="col">n</th><th scope="col">Min</th><th scope="col">Avg</th><th scope="col">Max</th><th scope="col">Sources</th></tr></thead><tbody>
      ${U.map(u => `<tr><td>${esc(u.desc)}</td><td>${esc(u.unit)}</td><td>${u.n}</td><td>${M(u.min)}</td><td><b>${M(u.avg)}</b></td><td>${M(u.max)}</td><td class="small">${u.pts.map(pt => esc(pt.job) + ' @ ' + M(pt.p)).join('; ')}</td></tr>`).join('')}
      </tbody></table></div><details class="math"><summary>Show the math</summary><ul class="small">${U.map(u => `<li>${esc(u.desc)} (${esc(u.unit)}): ${esc(u.math)}</li>`).join('')}</ul></details>` : emptyState('📊', 'No unit prices yet', 'Enter unit prices on project SOV lines (not LS). Mark a project complete when it finishes so the average draws from finished work.')}`; }

  if (tab === 'tab') { B.tabs = (B.tabs || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const WR = RHMF.bidTabWinRate(B.tabs);
    body = `<div class="card"><h3>Bid tab history</h3><p class="small muted">Who won and by how much. Blank Our bid or Low bid = RFI — never invent a number. Winner "Us" / "Rebar-Fab" counts as a win.</p>
      ${B.tabs.map((r, i) => { const S = RHMF.bidTabSpread(r.our, r.low); return `<div class="card bidder" data-btab="${i}"><div class="grid2">
        <label class="fld"><span>Job name</span><input data-btf="${i}:job" value="${esc(r.job || '')}"></label>
        <label class="fld"><span>Bid date</span><input data-btf="${i}:date" type="date" value="${esc(r.date || '')}"></label>
        <label class="fld"><span>Our bid $</span><input data-btf="${i}:our" type="number" inputmode="decimal" value="${r.our ?? ''}"></label>
        <label class="fld"><span>Low bid $</span><input data-btf="${i}:low" type="number" inputmode="decimal" value="${r.low ?? ''}"></label>
        <label class="fld"><span>Winner (Us = we won)</span><input data-btf="${i}:winner" value="${esc(r.winner || '')}"></label>
        <label class="fld"><span>Our rank</span><input data-btf="${i}:rank" value="${esc(r.rank || '')}"></label></div>
        <label class="fld"><span>Notes</span><input data-btf="${i}:notes" value="${esc(r.notes || '')}"></label>
        <p class="small mono">${esc(S.math)}${S.rfi ? ' <span class="bad">RFI</span>' : ''}</p>
        <button class="btn sm danger" data-btdel="${i}">Remove</button></div>`; }).join('') || emptyState('📑', 'No bid tabs yet', 'Add a tab after each bid day. Spread math shows once both bids are entered.')}
      <button class="btn sm" id="btAdd">➕ Bid tab</button>
      ${WR.n ? `<div class="card"><h3>Win rate</h3><p class="small mono">${esc(WR.math)}</p><p class="small muted">Only rows with Winner filled. Type "Us" or "Rebar-Fab" when you won.</p></div>` : ''}
      ${B.tabs.length ? '<div class="row"><button class="btn wide" id="btCSV">⬇ Export CSV</button><button class="btn wide" id="btXLS">⬇ Export Excel</button></div>' : ''}</div>`; }


  main().innerHTML = `<h2>Bid tools</h2><div class="seg wrap" role="tablist" aria-label="Bid tools">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-bt="${k}">${l}</button>`).join('')}</div>${body}`;
  $$('[data-bt]').forEach(b => b.onclick = () => ROUTES.bid(b.dataset.bt)); const re = async () => { await save(); ROUTES.bid(tab); };
  const live = (sel, fn) => $$(sel).forEach(i => i.onchange = async () => { fn(i); await re(); });
  live('[data-sc]', i => { const [n, k] = i.dataset.sc.split(':'); B.scopes[+n][k] = i.value; }); live('[data-bd]', i => { const [n, k] = i.dataset.bd.split(':'); B.bidders[+n][k] = i.value; });
  live('[data-inc]', i => { const [n, s] = i.dataset.inc.split(':'); const b = B.bidders[+n]; b.incl ||= {}; b.incl[s] = i.checked; });
  $$('[data-scdel]').forEach(b => b.onclick = () => { B.scopes.splice(+b.dataset.scdel, 1); re(); }); $$('[data-bddel]').forEach(b => b.onclick = () => { B.bidders.splice(+b.dataset.bddel, 1); re(); });
  const add = (id, fn) => { const b = $('#' + id); if (b) b.onclick = () => { fn(); re(); }; };
  add('scAdd', () => B.scopes.push({id:uid(), name:'', plug:''})); add('bdAdd', () => B.bidders.push({id:uid(), name:'', base:'', incl:{}})); add('alAdd', () => B.alts.push({name:'', kind:'add', amt:'', accepted:false}));
  live('#altBase', i => { B.base = i.value; }); live('[data-al]', i => { const [n, k] = i.dataset.al.split(':'); B.alts[+n][k] = i.value; }); live('[data-alacc]', i => { B.alts[+i.dataset.alacc].accepted = i.checked; });
  live('[data-es]', i => { B.esc[i.dataset.es] = i.value; });
  const ec = $('#escCopy'); if (ec) ec.onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('#escClause').textContent); toast('Clause copied'); };
  live('[data-cl]', i => { const [k, n] = i.dataset.cl.split(':'), t = libGet()[k][+n]; B.pick[k] = i.checked ? [...new Set(B.pick[k].concat(t))] : B.pick[k].filter(x => x !== t); });
  $$('[data-cladd]').forEach(b => b.onclick = () => { const k = b.dataset.cladd, v = $('#new-' + k).value.trim(); if (!v) return; const lib = libGet(); lib[k].push(v); SET.clauseLib = lib; saveSet(); B.pick[k].push(v); re(); });
  const txt = () => [['INCLUSIONS', B.pick.inc], ['EXCLUSIONS', B.pick.exc], ['CLARIFICATIONS', B.pick.cla]].filter(([, l]) => l.length).map(([h, l]) => h + ':\n' + l.map(x => '- ' + x).join('\n')).join('\n\n');
  const cc = $('#clCopy'); if (cc) cc.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(txt()); toast('Copied'); };
  const ci = $('#clIns'); if (ci) ci.onclick = async () => { const cos = (await DB.where('cos', c => c.projectId === APP.pid)).sort((a, b) => b.created - a.created); if (!cos.length) return toast('No quote or CO in this project yet'); const C = cos[0]; if (!confirm(`Add the picked items to ${C.no}${C.title ? ' - ' + C.title : ''} notes?`)) return; C.notes = [C.notes, txt()].filter(Boolean).join('\n\n'); await DB.put('cos', C); toast(`Added to ${C.no}`); };
  $$('[data-bq]').forEach(b => b.onclick = async () => { const [k, v] = b.dataset.bq.split(':'); if (v) B.bidq[k] = v; else delete B.bidq[k]; await re(); });
  // bid form CSV
  const bfImp = $('#bfImp'); if (bfImp) bfImp.onchange = async () => { const f = bfImp.files[0]; if (!f) return; try { const rows = RHMF.parseCSV(await f.text()), items = RHMF.bidForm(rows); B.form = (B.form || []).concat(items); await re(); toast(`${items.length} line(s) imported`); } catch (e) { toast(e.message || 'CSV import failed'); } };
  const bfExp = $('#bfExp'); if (bfExp) bfExp.onclick = () => { const T = RHMF.bidTotals(B.form || []); download(`BidForm_${safe(APP.project.name)}.csv`, new Blob([RHMF.toCSV([['Item No', 'Description', 'Unit', 'Quantity', 'Unit Price', 'Waste %', 'Bid qty', 'Amount', 'Math']].concat(T.lines.map(l => [l.item, l.desc, l.unit, l.qty, l.price, l.waste, l.bidQty, l.amt, l.math])))], {type:'text/csv'})); };
  const bfXLS = $('#bfXLS'); if (bfXLS) bfXLS.onclick = () => { const T = RHMF.bidTotals(B.form || []); downloadXlsx(`BidForm_${safe(APP.project.name)}.xlsx`, [['Item No', 'Description', 'Unit', 'Quantity', 'Unit Price', 'Waste %', 'Bid qty', 'Amount', 'Math']].concat(T.lines.map(l => [l.item, l.desc, l.unit, l.qty, l.price, l.waste, l.bidQty, l.amt, l.math]))); };
  const bfAdd = $('#bfAdd'); if (bfAdd) bfAdd.onclick = () => { (B.form ||= []).push({item:'', desc:'', unit:'', qty:'', price:'', waste:''}); re(); };
  const bfClr = $('#bfClr'); if (bfClr) bfClr.onclick = () => { if (!confirm('Clear all bid-form lines?')) return; B.form = []; re(); };
  live('[data-bf]', i => { const [n, k] = i.dataset.bf.split(':'); B.form[+n][k] = i.value; });
  $$('[data-bfdel]').forEach(b => b.onclick = () => { B.form.splice(+b.dataset.bfdel, 1); re(); });
  const pd = $('#pastDone'); if (pd) pd.onchange = async () => { B.pastDoneOnly = pd.checked; await save(); ROUTES.bid('past'); };

  // bid tab history
  live('[data-btf]', i => { const [n, k] = i.dataset.btf.split(':'); B.tabs[+n][k] = i.value; });
  $$('[data-btdel]').forEach(b => b.onclick = () => { B.tabs.splice(+b.dataset.btdel, 1); re(); });
  add('btAdd', () => (B.tabs ||= []).push({job:'', date:today(), our:'', low:'', winner:'', rank:'', notes:''}));
  const btCSV = $('#btCSV'); if (btCSV) btCSV.onclick = () => { const rows = (B.tabs || []).map(r => { const S = RHMF.bidTabSpread(r.our, r.low); return [r.job||'', r.date||'', r.our??'', r.low??'', r.winner||'', r.rank||'', r.notes||'', S.math]; });
    download(`BidTabs_${safe(APP.project.name)}.csv`, new Blob([RHMF.toCSV([['Job', 'Bid date', 'Our bid $', 'Low bid $', 'Winner', 'Our rank', 'Notes', 'Spread math']].concat(rows))], {type:'text/csv'})); };
  const btXLS = $('#btXLS'); if (btXLS) btXLS.onclick = () => { const rows = (B.tabs || []).map(r => { const S = RHMF.bidTabSpread(r.our, r.low); return [r.job||'', r.date||'', r.our??'', r.low??'', r.winner||'', r.rank||'', r.notes||'', S.math]; });
    downloadXlsx(`BidTabs_${safe(APP.project.name)}.xlsx`, [['Job', 'Bid date', 'Our bid $', 'Low bid $', 'Winner', 'Our rank', 'Notes', 'Spread math']].concat(rows)); };
  setPrimary(null); };
