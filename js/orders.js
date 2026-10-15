/* Right Hand Man v1.4 - Send (Email / Text / Share), Convert to Order (Sales Order with locked lines + revision trail + signature),
   Order Confirmation PDF, customer address book with auto-fill. Nothing is ever sent by the app: each button opens the phone's own app pre-filled. */
'use strict';
const ORD_STATUS = ['Quoted', 'Accepted', 'Ordered', 'Scheduled', 'Delivered', 'Invoiced'];
const book = async () => (await DB.kv('addrBook')) || [];
const saveBook = b => DB.kv('addrBook', b);
const openLink = h => (APP.openLink || (x => { location.href = x; }))(h);
const smsHref = (phone, body) => `sms:${String(phone || '').replace(/[^\d+]/g, '')}?body=${encodeURIComponent(body)}`;
const coLabel = C => C.type === 'rebar' ? 'Rebar-Fab Quote' : C.type === 'tm' ? 'T&M Ticket' : 'Change Order';
function sumText(C, T) { const P = APP.project || {}; if (C.type === 'rebar') return `${coLabel(C)} ${C.no} - ${P.name || ''}\nMaterial ${M(T.material)} | Trucking ${M(T.trucking)} | Shop Drawings ${M(T.shop)}\nTotal ${M(T.total)} (${RHM.fmt(T.totLb)} lb). Concrete by others.`;
  return `${coLabel(C)} ${C.no} - ${P.name || ''}${C.title ? ' - ' + C.title : ''}\nTotal ${M(T.total)}`; }

/* ---------- signature pad (finger / stylus / mouse) ---------- */
function sigPadHTML(id, sig) { return `<div class="sigw"><canvas id="${id}" class="sigpad" width="600" height="180" role="img" aria-label="Signature box - sign with your finger"></canvas>${sig && sig.img ? `<img class="sigimg" src="${sig.img}" alt="Saved signature">` : ''}<div class="row"><button class="btn sm" id="${id}Clr">Clear</button></div></div>`; }
function bindSigPad(id, onDone) { const c = document.getElementById(id); if (!c) return; const g = c.getContext('2d'); g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = '#111'; let down = false, inked = false;
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { down = true; c.setPointerCapture(e.pointerId); const [x, y] = pt(e); g.beginPath(); g.moveTo(x, y); e.preventDefault(); });
  c.addEventListener('pointermove', e => { if (!down) return; const [x, y] = pt(e); g.lineTo(x, y); g.stroke(); inked = true; e.preventDefault(); });
  const up = () => { if (!down) return; down = false; if (inked) onDone(c.toDataURL('image/png')); }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  const clr = document.getElementById(id + 'Clr'); if (clr) clr.onclick = () => { g.clearRect(0, 0, c.width, c.height); inked = false; onDone(null); }; }

/* ---------- send panel (CO / quote / order) ---------- */
function sendHTML(pre) { return `<div class="card send" id="${pre}Send"><h3>Send <small class="muted">(opens your app pre-filled - you press Send)</small></h3><div class="row">
  <button class="btn p" id="${pre}Email">✉ Email</button><button class="btn" id="${pre}Text">💬 Text</button><button class="btn" id="${pre}Share">📤 Share…</button></div><p class="small muted">Email and Text attach the PDF through the Share sheet when your phone supports it; otherwise the PDF downloads and the message opens with a summary.</p></div>`; }
function bindSend(pre, o) { /* o: {pdf:async()=>blob|throws, name, subject, body, email, phone, after} */
  const share = async (how) => { let b; try { b = await o.pdf(); } catch (e) { if (e.held) return toast('Not sent - fix the items in the check'); throw e; }
    const f = new File([b], o.name, {type:'application/pdf'}); const canFiles = navigator.canShare && navigator.canShare({files:[f]});
    if (how === 'share' || (canFiles && how !== 'link')) { try { if (canFiles) { await navigator.share({title:o.subject, text:o.body, files:[f]}); o.after && o.after(how); return; } } catch (e) { if (e.name === 'AbortError') return; } }
    download(o.name, b); return 'downloaded'; };
  $('#' + pre + 'Email').onclick = async () => { const r = await share('email'); if (r === 'downloaded') { openLink(mailto(o.email, o.subject, o.body + '\n\n(PDF attached: ' + o.name + ')')); o.after && o.after('email'); } };
  $('#' + pre + 'Text').onclick = async () => { const r = await share('text'); if (r === 'downloaded') { openLink(smsHref(o.phone, o.body)); o.after && o.after('text'); } };
  $('#' + pre + 'Share').onclick = async () => { const r = await share('share'); if (r === 'downloaded') toast('PDF downloaded - attach it from your files'); }; }

/* CO / quote form: add the send panel, Convert to Order, and address-book auto-fill on "Send to" */
const coFormOrders = coForm;
coForm = async function (C) { await coFormOrders(C); const m = main(), T = coTotals(C), contacts = await book();
  const to = m.querySelector('[data-k=to]'); if (to) { to.setAttribute('list', 'abList'); to.insertAdjacentHTML('afterend', `<datalist id="abList">${contacts.filter(c => c.email).map(c => `<option value="${esc(c.email)}">${esc(c.company || '')} - ${esc(c.contact || '')}</option>`).join('')}</datalist>`); }
  const anchor = m.querySelector('#status') && m.querySelector('#status').closest('.row'); const html = sendHTML('co') + (C.type !== 'tm' ? `<div class="card" id="toOrder"><h3>Accepted?</h3><p class="small">Turn this ${C.type === 'rebar' ? 'quote' : 'CO'} into a Sales Order with an order number. Lines and prices stay locked.</p><button class="btn p" id="cvOrder">✅ Convert to Order</button></div>` : '');
  if (anchor) anchor.insertAdjacentHTML('beforebegin', html); else m.insertAdjacentHTML('beforeend', html);
  const ab = contacts.find(c => c.email && c.email === C.to) || {};
  bindSend('co', {pdf:() => coPDF(C, coTotals(C)), name:`${C.no}_${safe(APP.project.name)}.pdf`, subject:`${coLabel(C)} ${C.no} - ${APP.project.name}${C.title ? ' - ' + C.title : ''}`, body:sumText(C, T), email:C.to, phone:ab.phone || C.phone || '', after:async () => { if (C.status === 'draft') { C.status = 'sent'; await DB.put('cos', C); } }});
  const cv = $('#cvOrder'); if (cv) cv.onclick = () => convertToOrder(C); };

async function convertToOrder(C) { const ex = (await DB.all('orders')).find(o => o.quoteId === C.id); if (ex) return go('order', ex.id);
  const T = coTotals(C), n = ((await DB.kv('orderSeq')) || 0) + 1; await DB.kv('orderSeq', n); const contacts = await book(), ab = contacts.find(c => c.email && c.email === C.to) || {};
  const O = {id:uid(), no:'SO-' + String(n).padStart(4, '0'), projectId:APP.pid, quoteId:C.id, quoteNo:C.no, type:C.type, status:'Accepted', created:Date.now(), statusLog:[{s:'Quoted', at:C.created || Date.now()}, {s:'Accepted', at:Date.now()}],
    lines:structuredClone(C.lines || []), est:C.est ? structuredClone(C.est) : null, allow:C.allow ? structuredClone(C.allow) : null, rtax:C.rtax ? structuredClone(C.rtax) : null, totals:snapTotals(C, T), rev:[{rev:0, at:Date.now(), what:`Created from ${C.no}`}],
    cust:{company:ab.company || (APP.client && APP.client.name) || '', contact:ab.contact || '', phone:ab.phone || '', email:C.to || ab.email || '', bill:ab.bill || '', ship:ab.ship || APP.project.location || '', taxCert:ab.taxCert || '', terms:ab.terms || '', pay:ab.pay || ''}, po:'', del:{date:'', window:'', contact:'', instr:'', reqBy:''}, notes:'', sig:null};
  C.status = 'approved'; C.orderId = O.id; await DB.put('cos', C); await DB.put('orders', O); buzz(20); toast(`Order ${O.no} created ✔`); go('order', O.id); }
function snapTotals(C, T) { return C.type === 'rebar' ? {material:T.material, trucking:T.trucking, shop:T.shop, subtotal:T.subtotal ?? T.total, allowTotal:T.allowTotal || 0, tax:T.tax ? T.tax.amt || 0 : 0, total:T.total, totLb:T.totLb, tons:T.tons, math:T.math} : {total:T.total}; }

/* ---------- orders ---------- */
TITLES.orders = 'Orders'; TITLES.order = 'Sales Order'; TITLES.contacts = 'Address Book';
ROUTES.orders = async () => { const os = (await DB.all('orders')).sort((a, b) => b.created - a.created);
  main().innerHTML = `<h2>Orders</h2>${os.length ? `<div class="list">${os.map(o => `<button class="li big" data-ord="${o.id}"><b>${esc(o.no)}</b> <span class="tag ${o.status === 'Delivered' || o.status === 'Invoiced' ? 'ok' : ''}">${esc(o.status)}</span><small>${esc(o.cust.company || '—')} · ${M(o.totals.total)} · from ${esc(o.quoteNo)}</small></button>`).join('')}</div>` : emptyState('🧾', 'No orders yet', 'Open an accepted quote and tap "Convert to Order".')}`;
  $$('[data-ord]').forEach(b => b.onclick = () => go('order', b.dataset.ord)); setPrimary(null); };
const oF = (k, l, v, type = 'text', extra = '') => `<label class="fld"><span>${l}</span><input data-o="${k}" type="${type}" value="${esc(v ?? '')}" ${extra}></label>`;
ROUTES.order = async id => { const O = await DB.get('orders', id); if (!O) return go('orders'); const contacts = await book(); const save = () => DB.put('orders', O); const t = O.totals;
  const lines = O.type === 'rebar' ? `<table class="t money"><thead><tr><th scope="col">Description</th><th scope="col">Type</th><th scope="col">Weight (lb)</th></tr></thead><tbody>${O.lines.filter(l => n0(l.lb) > 0).map(l => `<tr><td>${esc(l.desc || '')}</td><td>${l.coat === 'epoxy' ? 'Epoxy' : l.cls === 'straight' ? 'Straight' : 'Fabricated'}</td><td>${RHM.fmt(n0(l.lb))}</td></tr>`).join('')}</tbody></table>
    <table class="t money" id="ordTot"><thead><tr><th scope="col">Material</th><th scope="col">Trucking</th><th scope="col">Shop Drawings</th><th scope="col">Total</th></tr></thead><tbody><tr><td>${M(t.material)}</td><td>${M(t.trucking)}</td><td>${M(t.shop)}</td><td><b>${M(t.total)}</b></td></tr></tbody></table><p class="small muted">${RHM.fmt(t.totLb)} lb = ${t.tons} T. Trucking: ${esc(t.math.trucking)}. Shop drawings: ${esc(t.math.shop)}. Concrete by others.</p>`
    : `<table class="t money"><tbody>${O.lines.map(l => `<tr><td>${esc(l.desc || '')}</td><td>${RHM.fmt(n0(l.qty))} ${esc(l.unit || '')}</td><td>${M(n0(l.price))}</td></tr>`).join('')}<tr><th scope="row">Total</th><td></td><td><b>${M(t.total)}</b></td></tr></tbody></table>`;
  const c = O.cust, d = O.del;
  main().innerHTML = `<h2>${esc(O.no)} <span class="tag">${esc(O.status)}</span></h2><p class="small muted">From ${esc(O.quoteNo)} · rev ${O.rev.length - 1}</p>
  <div class="card"><h3>Status</h3><div class="seg wrap" role="radiogroup" aria-label="Order status">${ORD_STATUS.map(s => `<button role="radio" aria-checked="${O.status === s}" class="${O.status === s ? 'on' : ''}" data-ost="${s}">${s}</button>`).join('')}</div>
    <ol class="small muted">${O.statusLog.map(x => `<li>${esc(x.s)} - ${new Date(x.at).toLocaleString('en-US', {timeZone:'America/Chicago'})} CT</li>`).join('')}</ol></div>
  <div class="card"><h3>Customer</h3><label class="fld"><span>Fill from address book</span><select id="abPick"><option value="">Pick a saved customer…</option>${contacts.map(x => `<option value="${x.id}">${esc(x.company || x.email || '(no company)')}${x.contact ? ' - ' + esc(x.contact) : ''}</option>`).join('')}</select></label>
    <div class="grid2">${oF('cust.company', 'Company', c.company)}${oF('cust.contact', 'Contact', c.contact)}${oF('cust.phone', 'Phone', c.phone, 'tel', 'inputmode="tel" autocomplete="tel"')}${oF('cust.email', 'Email', c.email, 'email', 'autocomplete="email"')}</div>
    ${oF('cust.bill', 'Billing address', c.bill)}${oF('cust.ship', 'Ship-to / jobsite address', c.ship)}
    <div class="grid2">${oF('po', 'Customer PO number', O.po)}${oF('cust.taxCert', 'Tax-exempt certificate (number / date, blank = taxable)', c.taxCert)}${oF('cust.terms', 'Credit terms (e.g. Net 30)', c.terms)}${oF('cust.pay', 'Payment method', c.pay)}</div>
    <button class="btn sm" id="abSave">💾 Save customer to address book</button></div>
  <div class="card"><h3>Delivery</h3><div class="grid2">${oF('del.date', 'Delivery date', d.date, 'date')}${oF('del.window', 'Delivery window (e.g. 7-9 AM)', d.window)}${oF('del.reqBy', 'Required-by date', d.reqBy, 'date')}${oF('del.contact', 'Site contact (name + phone)', d.contact)}</div>
    <label class="fld"><span>Delivery instructions (forklift, offload, access)</span><textarea data-o="del.instr" rows="3">${esc(d.instr)}</textarea></label><label class="fld"><span>Notes</span><textarea data-o="notes" rows="2">${esc(O.notes)}</textarea></label></div>
  <div class="card"><h3>Lines and pricing <small class="muted">🔒 locked from ${esc(O.quoteNo)}</small></h3>${lines}<button class="btn sm" id="ordRev">↻ Re-sync from quote (new revision)</button>
    <h4>Revision trail</h4><ol class="small">${O.rev.map(r => `<li>Rev ${r.rev} - ${new Date(r.at).toLocaleDateString('en-US', {timeZone:'America/Chicago'})}: ${esc(r.what)}</li>`).join('')}</ol></div>
  <div class="card"><h3>Customer acceptance</h3>${sigPadHTML('ordSig', O.sig)}<div class="grid2">${oF('sigName', 'Printed name', O.sig && O.sig.name)}${oF('sigDate', 'Date', (O.sig && O.sig.date) || today(), 'date')}</div></div>
  ${sendHTML('ord')}<button class="btn wide" id="ordPrev">👁 Order Confirmation PDF</button>`;
  $$('[data-o]').forEach(i => i.oninput = () => { const [a, b] = i.dataset.o.split('.'); if (b) O[a][b] = i.value; else if (a === 'sigName' || a === 'sigDate') { O.sig ||= {}; O.sig[a === 'sigName' ? 'name' : 'date'] = i.value; } else O[a] = i.value; clearTimeout(O._t); O._t = setTimeout(save, 400); });
  $$('[data-ost]').forEach(b => b.onclick = async () => { if (O.status === b.dataset.ost) return; O.status = b.dataset.ost; O.statusLog.push({s:O.status, at:Date.now()}); await save(); buzz(15); go('order', O.id); });
  $('#abPick').onchange = e => { const x = contacts.find(k => k.id === e.target.value); if (!x) return; Object.assign(O.cust, {company:x.company || '', contact:x.contact || '', phone:x.phone || '', email:x.email || '', bill:x.bill || '', ship:x.ship || O.cust.ship, taxCert:x.taxCert || '', terms:x.terms || '', pay:x.pay || ''}); save().then(() => go('order', O.id)); };
  $('#abSave').onclick = async () => { const b = await book(); if (!O.cust.company) return toast('Enter the company first'); const i = b.findIndex(k => String(k.company || '').toLowerCase() === O.cust.company.toLowerCase()); const rec = {...(i >= 0 ? b[i] : {id:uid()}), ...O.cust}; i >= 0 ? b[i] = rec : b.push(rec); await saveBook(b); toast('Saved to address book ✔'); };
  bindSigPad('ordSig', img => { O.sig ||= {}; O.sig.img = img; O.sig.date ||= today(); save(); });
  $('#ordRev').onclick = async () => { const C = await DB.get('cos', O.quoteId); if (!C) return toast('Quote not found'); const why = prompt('Reason for the revision (shows on the trail):', ''); if (!why) return;
    O.lines = structuredClone(C.lines || []); O.est = C.est ? structuredClone(C.est) : null; O.allow = C.allow ? structuredClone(C.allow) : null; O.rtax = C.rtax ? structuredClone(C.rtax) : null; const before = O.totals.total; O.totals = snapTotals(C, coTotals(C));
    O.rev.push({rev:O.rev.length, at:Date.now(), what:`${why} (total ${M(before)} → ${M(O.totals.total)})`}); await save(); go('order', O.id); };
  const pdf = () => orderPDF(O), name = `${O.no}_Order_Confirmation.pdf`;
  $('#ordPrev').onclick = async () => { const b = await pdf(); window.open(URL.createObjectURL(b), '_blank') || download(name, b); };
  bindSend('ord', {pdf, name, subject:`Order Confirmation ${O.no} - ${(APP.project || {}).name || ''}`, body:`Order Confirmation ${O.no} (from ${O.quoteNo})${O.po ? ' - PO ' + O.po : ''}\n${O.type === 'rebar' ? `Material ${M(t.material)} | Trucking ${M(t.trucking)} | Shop Drawings ${M(t.shop)}\n` : ''}Total ${M(t.total)}${d.date ? '\nDelivery ' + d.date + (d.window ? ' ' + d.window : '') : ''}`, email:c.email, phone:c.phone});
  setPrimary(O.status === 'Accepted' ? '📦 Mark Ordered' : null, async () => { O.status = 'Ordered'; O.statusLog.push({s:'Ordered', at:Date.now()}); await save(); go('order', O.id); }); };

async function orderPDF(O) { const d = await newPDF(), P = APP.project || {}, c = O.cust, dl = O.del, t = O.totals; let y = await letterhead(d, `Order Confirmation ${O.no}`, `${P.name || ''} · from ${O.quoteNo} · rev ${O.rev.length - 1} · status ${O.status}`);
  y = AT(d, {startY:y, body:[['Customer', `${c.company || '—'}${c.contact ? ' · ' + c.contact : ''}`], ['Phone / email', `${c.phone || '—'} · ${c.email || '—'}`], ['Bill to', c.bill || '—'], ['Ship to / jobsite', c.ship || '—'], ['Customer PO', O.po || '—'], ['Tax', c.taxCert ? 'Exempt - certificate ' + c.taxCert : 'Taxable'], ['Terms / payment', `${c.terms || '—'} · ${c.pay || '—'}`],
    ['Delivery', `${dl.date || '—'}${dl.window ? ' ' + dl.window : ''} · required by ${dl.reqBy || '—'}`], ['Site contact', dl.contact || '—'], ['Instructions', dl.instr || '—']], styles:{fontSize:9}, columnStyles:{0:{fontStyle:'bold', cellWidth:120}}});
  if (O.type === 'rebar') { y = AT(d, {startY:y + 8, head:[['Description', 'Type', 'Weight (lb)']], body:O.lines.filter(l => n0(l.lb) > 0).map(l => [l.desc || '', l.coat === 'epoxy' ? 'Epoxy' : l.cls === 'straight' ? 'Straight' : 'Fabricated', RHM.fmt(n0(l.lb))]), columnStyles:{2:{halign:'right'}}});
    y = AT(d, {startY:y + 8, head:[['Material', 'Trucking', 'Shop Drawings', 'Total']], body:[[M(t.material), M(t.trucking), M(t.shop), M(t.total)]], styles:{fontSize:11, halign:'right'}, headStyles:{fillColor:[11, 31, 58], halign:'right'}});
    d.setFontSize(8.5); d.text([`${RHM.fmt(t.totLb)} lb = ${t.tons} tons. Trucking: ${t.math.trucking}. Shop drawings: ${t.math.shop}.`, 'Concrete by others.'], 36, y + 14, {maxWidth:540}); y += 34; }
  else y = AT(d, {startY:y + 8, head:[['Description', 'Qty', 'Unit', 'Unit price']], body:O.lines.map(l => [l.desc || '', RHM.fmt(n0(l.qty)), l.unit || '', M(n0(l.price))]).concat([['TOTAL', '', '', M(t.total)]])});
  y = AT(d, {startY:y + 6, head:[['Rev', 'Date', 'Change']], body:O.rev.map(r => [r.rev, new Date(r.at).toLocaleDateString('en-US', {timeZone:'America/Chicago'}), r.what]), styles:{fontSize:8}});
  if (O.notes) { d.setFontSize(9); d.text('Notes: ' + O.notes, 36, y + 14, {maxWidth:540}); y += 28; }
  d.setFontSize(10); d.text('Customer acceptance', 36, y + 20); if (O.sig && O.sig.img) d.addImage(O.sig.img, 'PNG', 36, y + 26, 200, 60); d.setFontSize(9); d.text(`Printed name: ${(O.sig && O.sig.name) || '______________________'}    Date: ${(O.sig && O.sig.date) || '__________'}`, 250, y + 70);
  footer(d, `Order ${O.no}`); return d.output('blob'); }

/* ---------- address book ---------- */
ROUTES.contacts = async () => { const b = await book(); main().innerHTML = `<h2>Address Book</h2><p class="hint">Saved customers fill in order forms and the CO / quote "Send to" field.</p>${b.length ? `<div class="list">${b.map(x => `<details class="card ab"><summary><b>${esc(x.company || x.email || '(no company)')}</b> <small>${esc(x.contact || '')} · ${esc(x.phone || '')}</small></summary>
  <div class="grid2">${['company:Company', 'contact:Contact', 'phone:Phone', 'email:Email', 'bill:Billing address', 'ship:Ship-to / jobsite', 'taxCert:Tax-exempt certificate', 'terms:Credit terms', 'pay:Payment method'].map(s => { const [k, l] = s.split(':'); return `<label class="fld"><span>${l}</span><input data-ab="${x.id}:${k}" value="${esc(x[k] || '')}" ${k === 'phone' ? 'type="tel" inputmode="tel"' : k === 'email' ? 'type="email"' : ''}></label>`; }).join('')}</div><button class="btn sm danger" data-abdel="${x.id}">Delete</button></details>`).join('')}</div>` : emptyState('📇', 'No customers saved', 'Add one now, or save from an order form.')}`;
  $$('[data-ab]').forEach(i => i.onchange = async () => { const [id, k] = i.dataset.ab.split(':'), bb = await book(), r = bb.find(x => x.id === id); if (r) { r[k] = i.value; await saveBook(bb); } });
  $$('[data-abdel]').forEach(x => x.onclick = async () => { if (!confirm('Delete this customer?')) return; await saveBook((await book()).filter(r => r.id !== x.dataset.abdel)); go('contacts'); });
  setPrimary('➕ Add a customer', async () => { const n = prompt('Company name'); if (!n) return; const bb = await book(); bb.push({id:uid(), company:n}); await saveBook(bb); go('contacts'); }); };
