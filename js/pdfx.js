/* Right Hand Man - PDF exports (jsPDF + autotable) */
'use strict';
async function newPDF(orient = 'p') { await loadScript('lib/jspdf.umd.min.js'); await loadScript('lib/jspdf.plugin.autotable.min.js'); return new window.jspdf.jsPDF({unit:'pt', format:'letter', orientation:orient}); }
let _rfLogo; async function rfLogo() { return _rfLogo ||= await fetch('icons/rebarfab-logo.png').then(r => r.blob()).then(fileToDataURL); }
const blobURL = b => fileToDataURL(b);
async function letterhead(d, title, sub) { const W = d.internal.pageSize.getWidth(), C = APP.client || {};
  try { d.addImage(await rfLogo(), 'PNG', 36, 28, 110, 36); } catch (e) {}
  if (C.logo) try { d.addImage(C.logo, 'PNG', W - 136, 26, 100, 40, undefined, 'FAST'); } catch (e) {}
  d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(60);
  d.text([`${CO_INFO.name} · ${CO_INFO.addr1}, ${CO_INFO.addr2}`, `Main ${CO_INFO.main} · Direct ${CO_INFO.direct} · ${CO_INFO.email}`], 156, 38);
  if (C.letterhead) d.text(String(C.letterhead).slice(0, 120), 156, 60);
  d.setTextColor(0); d.setFont('helvetica', 'bold'); d.setFontSize(15); d.text(title, 36, 88); d.setFont('helvetica', 'normal'); d.setFontSize(9.5);
  if (sub) d.text(sub, 36, 102); d.setDrawColor(11, 31, 58); d.setLineWidth(1.5); d.line(36, 108, W - 36, 108); return 120; }
function footer(d, label) { const n = d.getNumberOfPages(), W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) { d.setPage(i); d.setFontSize(7.5); d.setTextColor(110); d.text(`${label} · Right Hand Man · ${CREDIT}`, 36, H - 18); d.text(`Page ${i} of ${n}`, W - 36, H - 18, {align:'right'}); d.setTextColor(0); } }
const AT = (d, o) => { d.autoTable(Object.assign({theme:'grid', styles:{fontSize:8, cellPadding:3, overflow:'linebreak'}, headStyles:{fillColor:[11, 31, 58], textColor:255}, margin:{left:36, right:36}}, o)); return d.lastAutoTable.finalY; };
async function addImagePage(d, dataURL, w, h, caption) { d.addPage('letter', w > h ? 'l' : 'p'); const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), k = Math.min((W - 72) / w, (H - 100) / h);
  d.addImage(dataURL, 'JPEG', (W - w * k) / 2, 48, w * k, h * k, undefined, 'FAST'); d.setFontSize(9); d.text(caption, 36, 34); }
async function addSheetPages(d, sheets) { for (const s of sheets) { const c = await renderMarked(s, 2600); const g = progressRows(s);
  await addImagePage(d, c.toDataURL('image/jpeg', 0.82), c.width, c.height, `Sheet ${s.sheetNo || s.name} · PDF p.${s.page} · scale ${s.scaleTxt || 'not set'} · layers: ${s.layers.filter(l => l.on).map(l => l.name).join(', ')}${g ? ' · ' + g : ''}`); } }
function progressRows(s) { const by = {}; s.meas.filter(m => m.type === 'prog').forEach(m => by[m.sovId] = (by[m.sovId] || 0) + m.value); const sov = (APP.project && APP.project.sov) || [];
  return Object.entries(by).map(([id, v]) => `${(sov.find(x => x.id === id) || {}).item || '?'} done ${RHM.fmt(v, 1)}`).join('; '); }

async function payPDF(A, c) { const simple = APP.client.payFormat === 'simple', d = await newPDF(simple ? 'p' : 'l'), P = APP.project, C = APP.client;
  if (simple) return simplePayPDF(A, c, d, P, C);
  let y = await letterhead(d, simple ? `Invoice / Pay Application #${A.no}` : `Application and Certificate for Payment #${A.no} (G702 style)`, `${P.name}${P.no ? ' · ' + P.no : ''} · Period to ${A.periodTo} · Application date ${A.date}`);
  d.setFontSize(9); d.text([`To: ${P.gc || C.name}`, `Owner: ${P.owner || '—'}`, `Contract date: ${P.contractDate || '—'}`, `Via: ${C.approver || '—'}`], 36, y + 4); d.text([`From: ${CO_INFO.name}`, CO_INFO.addr1 + ', ' + CO_INFO.addr2, `Project: ${P.location || ''}`], 360, y + 4);
  y = AT(d, {startY:y + 46, head:[['G702 summary', 'Amount']], body:g702Rows(c).map(([k, v]) => [k, M(v)]), columnStyles:{1:{halign:'right', cellWidth:130}}, tableWidth:430,
    didParseCell:h => { if (h.section === 'body' && /CURRENT|Contract sum to date/.test(h.row.raw[0])) h.cell.styles.fontStyle = 'bold'; }});
  d.setFontSize(8.5); d.text([`Retainage: ${C.retainPct}% of completed work, ${C.retainStoredPct}% of stored materials.${c.g702.tax ? ` Sales tax ${C.taxPct}% included in line 4.` : ''} ${C.taxNote || ''}`,
    'The undersigned certifies that, to the best of their knowledge, the work covered by this application has been completed in accordance with the contract documents.', '', 'Contractor: ______________________________   Date: ____________        Certified by: ______________________________   Date: ____________'], 36, y + 16, {maxWidth:d.internal.pageSize.getWidth() - 72});
  d.addPage('letter', 'l'); y = await letterhead(d, `Continuation Sheet (G703 style) - Application #${A.no}`, `${P.name} · Period to ${A.periodTo}`);
  const t = c.totals; AT(d, {startY:y, head:[['A Item', 'B Description', 'C Scheduled value', 'D From previous', 'E This period', 'F Stored now', 'G Completed & stored', '% (G/C)', 'H Balance to finish', 'I Retainage']],
    body:c.lines.map(l => [l.item, l.desc + (l.co ? ' (CO)' : ''), M(l.C), M(l.D), M(l.E), M(l.F), M(l.G), RHM.fmt(l.pct, 1) + '%', M(l.H), M(l.I)]).concat([['', 'TOTALS', M(t.C), M(t.D), M(t.E), M(t.F), M(t.G), RHM.fmt(t.C ? t.G / t.C * 100 : 0, 1) + '%', M(t.H), M(t.I)]]),
    columnStyles:Object.fromEntries([2,3,4,5,6,7,8,9].map(i => [i, {halign:'right'}])), didParseCell:h => { if (h.section === 'body' && h.row.index === c.lines.length) h.cell.styles.fontStyle = 'bold'; }});
  { const ids = P.allowIds || [], al = c.lines.filter(l => ids.includes(l.id)); if (al.length) { const rr = RHME.allowRecon(al.map(l => ({id:l.id, name:`${l.item}. ${l.desc}`, amt:l.C})), Object.fromEntries(al.map(l => [l.id, l.G]))); d.addPage('letter', 'l'); let ya = await letterhead(d, `Allowance reconciliation - Application #${A.no}`, 'Allowances are shown separately: amount, used to date, remaining');
    AT(d, {startY:ya, head:[['Allowance', 'Amount', 'Used to date', 'Remaining', 'Math']], body:rr.map(r => [r.name, M(r.amt), M(r.used), M(r.remaining), r.math]), columnStyles:{1:{halign:'right'}, 2:{halign:'right'}, 3:{halign:'right'}}}); } }
  const chk = payChecks(A, c); d.addPage('letter', 'p'); y = await letterhead(d, 'Submission checklist & backup index', `Application #${A.no}`);
  y = AT(d, {startY:y, head:[['Check', 'Status']], body:chk.map(r => [r.t, r.ok ? 'Yes' : 'NO'])});
  const sheets = await Promise.all(A.attach.sheets.map(id => DB.get('sheets', id))), photos = (await Promise.all(A.attach.photos.map(id => DB.get('photos', id)))).filter(Boolean);
  AT(d, {startY:y + 12, head:[['Backup attached']], body:sheets.filter(Boolean).map(s => [`Marked sheet ${s.sheetNo || s.name} (PDF p.${s.page})`]).concat(photos.map(p => [`Photo: ${p.caption || ''} ${p.date || ''}`]))});
  await addSheetPages(d, sheets.filter(Boolean)); for (const p of photos) await addImagePage(d, await blobURL(p.blob), p.w, p.h, `Photo · ${p.caption || ''} · ${p.date || ''}`);
  footer(d, `${P.name} Pay App #${A.no}`); return d.output('blob'); }

// Simple invoice format: one portrait page - SOV table (scheduled, previous, this period, to date, %) + plain totals block. No AIA layout.
async function simplePayPDF(A, c, d, P, C) { const W = d.internal.pageSize.getWidth(), g = c.g702, t = c.totals;
  let y = await letterhead(d, `Invoice #${A.invoiceNo || A.no}`, `${P.name}${P.no ? ' · Job ' + P.no : ''}${P.po ? ' · PO ' + P.po : ''} · Period ending ${A.periodTo}`);
  d.setFontSize(9.5); d.text([`Bill to: ${P.gc || C.name}`, P.gcAddr || C.addr || '', `Attn: ${C.approver || '—'}`].filter(Boolean), 36, y + 4);
  d.text([`Invoice date: ${A.date}`, `Pay application: #${A.no}`, `Terms: ${C.terms || 'Net 30'}`], W - 220, y + 4);
  const ps = id => ((A.prev || {})[id] || {}).stored || 0, rowsL = c.lines.filter(l => l.C || l.G || l.E).map(l => ({l, pb:RHM.r2(l.D + ps(l.id)), th:RHM.r2(l.G - l.D - ps(l.id))}));
  y = AT(d, {startY:y + 46, head:[['Item', 'Description', 'Contract', 'Previously billed', 'This invoice', 'Billed to date', '%']],
    body:rowsL.map(({l, pb, th}) => [l.item, l.desc + (l.co ? ' (CO)' : ''), M(l.C), M(pb), M(th), M(l.G), RHM.fmt(l.pct, 0) + '%']),
    foot:[['', 'Totals', M(t.C), M(rowsL.reduce((a, x) => a + x.pb, 0)), M(rowsL.reduce((a, x) => a + x.th, 0)), M(t.G), RHM.fmt(t.C ? t.G / t.C * 100 : 0, 0) + '%']],
    columnStyles:Object.fromEntries([2,3,4,5,6].map(i => [i, {halign:'right'}])), footStyles:{fillColor:[230, 234, 240], textColor:0, halign:'right'}});
  const rows = [['Billed to date (work + stored)', g.l4 - g.tax], g.tax ? [`Sales tax ${C.taxPct}%`, g.tax] : null, [`Less retainage (${C.retainPct}%${C.retainStoredPct != C.retainPct ? ' / stored ' + C.retainStoredPct + '%' : ''})`, -g.l5], ['Less previous payments requested', -g.l7], ['AMOUNT DUE THIS INVOICE', g.l8]].filter(Boolean);
  y = AT(d, {startY:y + 12, body:rows.map(([k, v]) => [k, M(v)]), margin:{left:W - 36 - 300}, tableWidth:300, columnStyles:{1:{halign:'right', cellWidth:110}}, theme:'plain', styles:{fontSize:10},
    didParseCell:h => { if (h.row.index === rows.length - 1) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.fillColor = [255, 243, 205]; } }});
  d.setFontSize(8.5); d.text([`Retainage held to date: ${M(g.l5)}. Balance to finish incl. retainage: ${M(g.l9)}.`, C.taxNote || '', 'Remit to: ' + CO_INFO.name + ', ' + CO_INFO.addr1 + ', ' + CO_INFO.addr2, '', 'Signed: ______________________________   Date: ____________'].filter((x, i) => x || i > 1), 36, y + 18, {maxWidth:W - 72});
  const sheets = (await Promise.all(A.attach.sheets.map(id => DB.get('sheets', id)))).filter(Boolean), photos = (await Promise.all(A.attach.photos.map(id => DB.get('photos', id)))).filter(Boolean);
  if (sheets.length || photos.length) { d.addPage('letter', 'p'); y = await letterhead(d, 'Backup index', `Invoice #${A.invoiceNo || A.no}`); AT(d, {startY:y, head:[['Backup attached']], body:sheets.map(s => [`Marked sheet ${s.sheetNo || s.name} (PDF p.${s.page})`]).concat(photos.map(p => [`Photo: ${p.caption || ''} ${p.date || ''}`]))}); }
  await addSheetPages(d, sheets); for (const p of photos) await addImagePage(d, await blobURL(p.blob), p.w, p.h, `Photo · ${p.caption || ''} · ${p.date || ''}`);
  footer(d, `${P.name} Invoice #${A.invoiceNo || A.no}`); return d.output('blob'); }

async function coPDF(Cx, T) { const d = await newPDF(), P = APP.project, kind = Cx.type === 'rebar' ? 'Quote' : Cx.type === 'tm' ? 'Time & Materials Ticket' : 'Change Order';
  let y = await letterhead(d, `${kind} ${Cx.no}`, `${P.name}${P.no ? ' · ' + P.no : ''} · ${Cx.date}${Cx.attn ? ' · Attn: ' + Cx.attn : ''}`); d.setFontSize(10); if (Cx.title) { d.setFont('helvetica', 'bold'); d.text(Cx.title, 36, y + 4); d.setFont('helvetica', 'normal'); y += 14; }
  if (Cx.type === 'rebar') { y = AT(d, {startY:y + 6, head:[['Description', 'Type', 'Weight (lb)', 'Rate ($/lb)', 'Material']], body:T.rows.map(r => [r.desc, r.coat === 'epoxy' ? 'Epoxy' : r.cls === 'straight' ? 'Straight' : 'Fabricated', RHM.fmt(r.lb), M(r.rate), M(r.material)]), columnStyles:{2:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'right'}}});
    y = AT(d, {startY:y + 10, head:[['Material', 'Trucking', 'Shop Drawings', 'Total']], body:[[M(T.material), M(T.trucking), M(T.shop), M(T.total)]], styles:{fontSize:11, halign:'right'}, headStyles:{fillColor:[11, 31, 58], halign:'right'}});
    if (T.allow || T.tax) y = AT(d, {startY:y + 6, body:[['Material + Trucking + Shop Drawings', M(T.subtotal)]].concat((T.allow || []).map(a => [`Allowance: ${a.name || ''}${a.desc ? ' - ' + a.desc : ''}`, M(a.amt)]), T.tax && T.tax.amt ? [['Sales tax (' + T.tax.math + ')', M(T.tax.amt)]] : [], [['TOTAL', M(T.total)]]), columnStyles:{1:{halign:'right'}}, styles:{fontSize:9}});
    d.setFontSize(8.5); d.text([`Total weight ${RHM.fmt(T.totLb)} lb = ${T.tons} tons. Trucking: ${T.math.trucking}. Shop drawings: ${T.math.shop}.`, 'Concrete by others.'], 36, y + 16, {maxWidth:540}); y += 40; }
  else if (Cx.type === 'tm') { y = AT(d, {startY:y + 6, head:[['Labor', 'ST hrs', 'OT hrs', 'Base $/hr', `Burden ${SET.burdenPct}%`, 'Amount']], body:T.lab.map(l => [l.who, l.hrs || 0, l.ot || 0, M(n0(l.rate)), M(l.burden), M(l.amt)])});
    y = AT(d, {startY:y + 6, head:[['Material', 'Qty', '$/unit', 'Amount']], body:T.mat.map(m => [m.desc, m.qty, M(n0(m.price)), M(m.amt)])}); y = AT(d, {startY:y + 6, head:[['Equipment', 'Hrs', '$/hr', 'Amount']], body:T.eq.map(m => [m.desc, m.hrs, M(n0(m.rate)), M(m.amt)])});
    y = AT(d, {startY:y + 8, body:[['Labor', M(T.L)], ['Materials', M(T.M)], ['Equipment', M(T.E)], [`Markup ${Cx.tm.markupPct || 0}%`, M(T.markup)], ['TOTAL', M(T.total)]], columnStyles:{1:{halign:'right'}}, tableWidth:260});
    d.setFontSize(9); d.text(`Owner's representative: ${Cx.signer || '____________________________'}    Signature: ____________________   Date: __________`, 36, y + 22); y += 30; }
  else if (T.est) { const R = T.est; y = AT(d, {startY:y + 6, head:[['Material', 'Qty', 'Unit', 'Unit price', 'Amount']], body:T.rows.map(r => [r.desc, RHM.fmt(n0(r.qty)), r.unit || '', M(n0(r.price)), M(r.amt)]), columnStyles:{1:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'right'}}, styles:{fontSize:8.5}});
    if (R.lab.length) y = AT(d, {startY:y + 6, head:[['Labor (burdened)', 'Math', 'Amount']], body:R.lab.map(l => [l.trade || '', l.math, M(l.amt)]), columnStyles:{1:{cellWidth:340}, 2:{halign:'right'}}, styles:{fontSize:8}});
    if (R.eq.length) y = AT(d, {startY:y + 6, head:[['Equipment', 'Math', 'Amount']], body:R.eq.map(l => [(SET.equipLib.find(m => m.id === l.eqId) || {}).name || '', l.math, M(l.amt)]), columnStyles:{1:{cellWidth:340}, 2:{halign:'right'}}, styles:{fontSize:8}});
    if (R.sub.length) y = AT(d, {startY:y + 6, head:[['Subcontractor', 'Amount']], body:R.sub.map(x => [x.desc || '', M(x.amt)]), columnStyles:{1:{halign:'right'}}, styles:{fontSize:8.5}});
    if (R.allow.length) y = AT(d, {startY:y + 6, head:[['Allowance', 'Description', 'Markup', 'Amount']], body:R.allow.map(a => [a.name || '', a.desc || '', a.markup ? 'yes' : 'no', M(a.amt)]), columnStyles:{3:{halign:'right'}}, styles:{fontSize:8.5}});
    y = AT(d, {startY:y + 8, head:[['Rollup', 'Math', 'Amount']], body:R.steps.map(s => [s.label, s.math, M(s.amt)]), columnStyles:{1:{cellWidth:330}, 2:{halign:'right'}}, styles:{fontSize:8}, didParseCell:h => { if (h.section === 'body' && /Total|Subtotal/.test(h.row.raw[0])) h.cell.styles.fontStyle = 'bold'; }});
    if (R.rfi.length) { d.setFontSize(8); d.setTextColor(180, 0, 0); d.text(['Needs a number (counted as $0): ' + R.rfi.join('; ')], 36, y + 12, {maxWidth:540}); d.setTextColor(0); y += 24; } }
  else { y = AT(d, {startY:y + 6, head:[['Description', 'Qty', 'Unit', 'Unit price', 'Amount', 'Source']], body:T.rows.map(r => [r.desc, RHM.fmt(n0(r.qty)), r.unit || '', M(n0(r.price)), M(r.amt), r.cite || '']).concat([['TOTAL', '', '', '', M(T.total), '']]), columnStyles:{1:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'right'}}}); }
  d.setFontSize(9); const ex = [Cx.reason && 'Justification: ' + Cx.reason, Cx.standard && 'Reference: ' + Cx.standard, Cx.notes].filter(Boolean); if (ex.length) d.text(ex, 36, y + 18, {maxWidth:540});
  const sy = Math.min(y + 60 + ex.length * 24, 690); if (Cx.sig && Cx.sig.img) { try { d.addImage(Cx.sig.img, 'PNG', 36, sy - 46, 170, 51); } catch (e) {} }
  d.text(['', Cx.sig && Cx.sig.img ? `Accepted by: ${Cx.sig.name || '(signed - name not printed)'}   Date: ${Cx.sig.date || ''}   (signed on device)` : 'Accepted by: ______________________________   Date: ____________', '', `${CO_INFO.person} · ${CO_INFO.name} · ${CO_INFO.direct} · ${CO_INFO.email}`], 36, sy + 10);
  footer(d, `${kind} ${Cx.no}`); return d.output('blob'); }

async function takeoffPDF(ev, rfis, cites) { const d = await newPDF('l'), P = APP.project; let y = await letterhead(d, 'Quantity Takeoff', `${P.name} · ${today()} · all math shown; blanks listed as RFIs; laps on their own rows; higher defensible quantity carried`);
  const body = []; ev.forEach(({l, e}) => { e.rows.forEach(r => body.push([l.trade, l.desc || '', r.desc, RHM.fmt(r.qty), r.unit, r.math, l.sheet || '—', l.page || '—', l.spec || '—'])); e.rfi.forEach(x => body.push([l.trade, l.desc || '', '', '', '', x, l.sheet || '—', l.page || '—', l.spec || '—'])); });
  y = AT(d, {startY:y, head:[['Trade', 'Line', 'Row', 'Qty', 'Unit', 'Math', 'Sheet', 'PDF p.', 'Spec']], body, columnStyles:{3:{halign:'right'}, 5:{cellWidth:300}}, didParseCell:h => { if (h.section === 'body' && /^RFI/.test(h.row.raw[5])) h.cell.styles.textColor = [180, 0, 0]; }});
  if (rfis.length || cites.length) AT(d, {startY:y + 12, head:[['#', 'RFI / confirmation needed']], body:rfis.map(x => `${x.l.desc || ''}: ${x.r}`).concat(cites.map(x => `${x.l.desc || ''}: confirm ${x.e.citeMissing.join(', ')}`)).map((t, i) => [i + 1, t])});
  footer(d, 'Takeoff ' + P.name); return d.output('blob'); }

async function dailyPDF(L, t, photos, toDate) { const d = await newPDF(), P = APP.project, sov = P.sov, w = L.weather || {};
  let y = await letterhead(d, `Daily Production Log - ${L.date}`, `${P.name} · Foreman ${L.foreman || '—'} · Weather: ${[w.cond, w.hi && 'High ' + w.hi + '°F', w.lo && 'Low ' + w.lo + '°F', w.precip !== undefined && w.precip !== '' && 'Rain ' + w.precip + ' in', w.wind && 'Wind ' + w.wind + ' mph'].filter(Boolean).join(', ') || '—'}`);
  y = AT(d, {startY:y, head:[['Crew', 'Trade', 'Count', 'Hours each', 'Man-hours']], body:(L.crew || []).map(c => [c.name, c.trade, c.n, c.hrs, RHM.fmt(n0(c.n) * n0(c.hrs))]).concat([['TOTAL', '', '', '', RHM.fmt(t.hrs)]])});
  y = AT(d, {startY:y + 10, head:[['Pay item', 'Installed today', 'To date', 'Plan', '% to date', 'Rate/man-hr']], body:t.qty.map(q => { const s = sov.find(x => x.id === q.sovId) || {}; return [`${s.item || ''} ${s.desc || ''}`, `${RHM.fmt(n0(q.qty))} ${s.unit || ''}`, RHM.fmt(toDate[q.sovId] || 0), RHM.fmt(q.plan), q.plan ? RHM.fmt((toDate[q.sovId] || 0) / q.plan * 100, 1) + '%' : '—', q.rate ? RHM.fmt(q.rate) : '—']; })});
  const tf = ptype(P).daily.filter(([k]) => (L.typeFields || {})[k] !== undefined && (L.typeFields || {})[k] !== '');
  if (tf.length) y = AT(d, {startY:y + 10, head:[[`${ptype(P).name} field`, 'Entry']], body:tf.map(([k, l]) => [l, String(L.typeFields[k])])});
  d.setFontSize(9.5); d.text(['Work performed / notes:', L.notes || '—', '', 'Delays, extra work, visitors, safety:', L.delays || '—'], 36, y + 18, {maxWidth:540});
  for (const p of photos) await addImagePage(d, await blobURL(p.blob), p.w, p.h, `Photo · ${p.caption || ''} · ${L.date}`);
  footer(d, `Daily log ${L.date}`); return d.output('blob'); }

async function exportSheetsPDF() { const sheets = (await loadSheets()).filter(s => s.marks.length || s.meas.length); if (!sheets.length) return toast('Mark up or measure a sheet first');
  const d = await newPDF('l'); await letterhead(d, 'Marked plan sheets', `${APP.project.name} · ${today()} · ${sheets.length} sheet(s)`);
  AT(d, {startY:124, head:[['Sheet', 'PDF page', 'Scale', 'Measurements', 'Markups']], body:sheets.map(s => [s.sheetNo || s.name, s.page, s.scaleTxt || '—', s.meas.map(m => m.label).join('; ') || '—', s.marks.length])});
  await addSheetPages(d, sheets); footer(d, 'Marked sheets ' + APP.project.name); const b = d.output('blob'); await sharePDF(b, `MarkedSheets_${safe(APP.project.name)}.pdf`, 'Marked sheets ' + APP.project.name); return b; }

// Shop drawing: 11x17 placing sheet with Rebar-Fab title block, bar list/bending schedule, revision block, FOR REVIEW stamp
function shapeSketch(d, key, x, y, w, h) { d.setLineWidth(1.2); d.setDrawColor(0); const m = 4, X = x + m, Y = y + m, W = w - 2 * m, H = h - 2 * m;
  const L = (...p) => { for (let i = 2; i < p.length; i += 2) d.line(p[i - 2], p[i - 1], p[i], p[i + 1]); };
  ({ STR:() => L(X, Y + H / 2, X + W, Y + H / 2), L90:() => L(X, Y, X, Y + H, X + W, Y + H), U:() => L(X, Y, X, Y + H, X + W, Y + H, X + W, Y), Z:() => L(X, Y, X + W * .35, Y, X + W * .65, Y + H, X + W, Y + H),
    HK90:() => L(X, Y + H, X + W, Y + H, X + W, Y + H * .3), HK180:() => { L(X, Y + H, X + W - 6, Y + H); d.circle(X + W - 6, Y + H - 6, 6, 'S'); }, TIE:() => { d.rect(X + 4, Y + 2, W - 8, H - 4); L(X + 4, Y + 2, X + 12, Y + 10); },
    STIR:() => { L(X + 4, Y, X + 4, Y + H, X + W - 4, Y + H, X + W - 4, Y); L(X + 4, Y, X + 12, Y + 8); L(X + W - 4, Y, X + W - 12, Y + 8); }, HOOP:() => d.circle(x + w / 2, y + h / 2, Math.min(W, H) / 2, 'S') }[key] || (() => {}))(); }
async function shopPDF(P, res) { await loadScript('lib/jspdf.umd.min.js'); await loadScript('lib/jspdf.plugin.autotable.min.js'); const SD = P.shop, d = new window.jspdf.jsPDF({unit:'pt', format:'tabloid', orientation:'l'}), W = 1224, H = 792;
  const logo = await rfLogo(); const frame = () => { d.setLineWidth(2); d.rect(18, 18, W - 36, H - 36); const tbY = H - 130; d.setLineWidth(1); d.rect(18, tbY, W - 36, 112);
    try { d.addImage(logo, 'PNG', 28, tbY + 10, 150, 58); } catch (e) {}
    d.setFontSize(8); d.text([CO_INFO.name, CO_INFO.addr1, CO_INFO.addr2, `Main ${CO_INFO.main}`, `Direct ${CO_INFO.direct}`, CO_INFO.email], 190, tbY + 18);
    d.setFont('helvetica', 'bold'); d.setFontSize(9); d.text(CREDIT, 28, tbY + 80); d.setFont('helvetica', 'normal'); d.setFontSize(8); d.text('Detailer: JDL', 28, tbY + 94);
    d.line(330, tbY, 330, H - 18); d.setFontSize(13); d.setFont('helvetica', 'bold'); d.text(SD.title || P.name + ' - Reinforcing Placing Drawing', 340, tbY + 22, {maxWidth:420}); d.setFont('helvetica', 'normal'); d.setFontSize(9);
    d.text([`Project: ${P.name}${P.no ? ' (' + P.no + ')' : ''}`, `Location: ${P.location || '—'}`, `Plan reference: ${SD.planRef || [...new Set(res.rows.filter(r => r.sheet).map(r => `${r.sheet} / PDF p.${r.page}`))].join(', ') || '—'}`, `Client: ${(APP.client || {}).name || '—'}  ·  GC: ${P.gc || '—'}`], 340, tbY + 42);
    d.line(780, tbY, 780, H - 18); d.setFontSize(7.5); d.setFont('helvetica', 'bold'); d.text('REV   DATE         DESCRIPTION                                   BY', 786, tbY + 12); d.setFont('helvetica', 'normal'); SD.rev.slice(-6).forEach((r, i) => { const yy = tbY + 26 + i * 14; d.text(String(r.no), 788, yy); d.text(r.date, 810, yy); d.text(String(r.desc).slice(0, 44), 862, yy); d.text(r.by, 1066, yy); d.line(784, yy + 4, 1086, yy + 4); });
    d.line(1090, tbY, 1090, H - 18); d.setFontSize(9); d.text('SHEET', 1100, tbY + 20); d.setFontSize(22); d.setFont('helvetica', 'bold'); d.text(SD.sheetNo || 'SD-1', 1100, tbY + 48); d.setFont('helvetica', 'normal'); d.setFontSize(8); d.text(`Date ${today()}`, 1100, tbY + 70);
    d.text(`Shop dwg charge ${M(res.shop)}`, 1100, tbY + 84); d.text(`(${res.fabTons} fab T x ${M(SET.rates.shopPerTon)})`, 1100, tbY + 96);
    if (SD.status !== 'Approved') { d.setTextColor(200, 0, 0); d.setDrawColor(200, 0, 0); d.setLineWidth(3); d.rect(W - 330, 26, 300, 58); d.setFontSize(28); d.setFont('helvetica', 'bold'); d.text('FOR REVIEW', W - 180, 56, {align:'center'}); d.setFontSize(9); d.text('NOT FOR FABRICATION UNTIL APPROVED', W - 180, 76, {align:'center'}); d.setTextColor(0); d.setDrawColor(0); d.setFont('helvetica', 'normal'); } };
  frame(); d.setFontSize(14); d.setFont('helvetica', 'bold'); d.text('BAR LIST / BENDING SCHEDULE', 30, 46); d.setFont('helvetica', 'normal'); d.setFontSize(8);
  d.text('ASTM A615 Gr 60 unless noted (confirm with the plan general notes). Dimensions are out-to-out per CRSI/ACI 315 bending diagrams. Cut length = sum of legs + CRSI MSP standard hook detailing dimension (A or G)' + (RHM.FLAGS.crsi ? ' - HOOK VALUES: VERIFY vs CRSI manual (not yet confirmed)' : '') + '; fabricator bend deductions not applied. Laps per plans, detailed as separate marks.', 30, 60, {maxWidth:820});
  const ok = res.rows.filter(r => r.ok);
  AT(d, {startY:100, margin:{left:30, right:30, bottom:150, top:100}, styles:{fontSize:8, cellPadding:3, minCellHeight:30, valign:'middle'}, head:[['Mark', 'Size', 'No.', 'Shape', 'Sketch', 'CRSI fig.', 'A', 'B', 'C', 'D', 'Cut length', 'Weight (lb)', 'Type', 'Element / location', 'Sheet / PDF p.']],
    body:ok.map(r => [r.mark, '#' + r.bar, r.count, r.shape, '', r.crsi || '—', ...['A','B','C','D'].map(k => r.legs[k] !== undefined ? RHM.fmtFtIn(r.legs[k]) : ''), r.lenTxt, RHM.fmt(r.lb), r.fab ? 'Fab' : 'Straight', r.where, `${r.sheet || '—'} / ${r.page || '—'}`])
      .concat([['', '', '', 'TOTALS', '', '', '', '', '', '', '', RHM.fmt(res.totLb), `Fab ${RHM.fmt(res.fabLb)} / Str ${RHM.fmt(res.strLb)}`, '', '']]),
    columnStyles:{4:{cellWidth:56}, 11:{halign:'right'}}, didDrawCell:h => { if (h.section === 'body' && h.column.index === 4 && ok[h.row.index]) shapeSketch(d, ok[h.row.index].shapeKey, h.cell.x, h.cell.y, h.cell.width, h.cell.height); }, didDrawPage:h => { if (h.pageNumber > 1) frame(); } });
  let y = d.lastAutoTable.finalY + 14; if (res.rfis.length) { if (y > H - 220) { d.addPage(); frame(); y = 50; } d.setTextColor(180, 0, 0); d.setFont('helvetica', 'bold'); d.setFontSize(10); d.text(`RFIs - not detailed (${res.rfis.length})`, 30, y); d.setFont('helvetica', 'normal'); d.setFontSize(8.5); d.text(res.rfis.map((r, i) => `${i + 1}. ${r}`), 30, y + 14, {maxWidth:1100}); d.setTextColor(0); y += 20 + res.rfis.length * 12; }
  const warns = ok.filter(r => r.warn); if (warns.length) { d.setFontSize(8.5); d.setTextColor(150, 80, 0); d.text(warns.map(r => `Note: ${r.mark} - ${r.warn}`), 30, y + 10, {maxWidth:1100}); d.setTextColor(0); }
  footer(d, `${SD.sheetNo} ${SD.status}`); return d.output('blob'); }
