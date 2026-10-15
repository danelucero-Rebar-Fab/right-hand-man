/* Right Hand Man v1.4 - UI for the bot rules: Takeoff check card + save gate, Rule source tooltips, quote check before a PDF goes out,
   VERIFY tags, fab tolerance on shop drawings, Settings "Assumptions for Joe to confirm". */
'use strict';
SET.confirmed ||= {};
const isConfirmed = id => !!SET.confirmed[id];
function applyVerifyFlags() { RHM.FLAGS.crsi = isConfirmed('sd-crsi-hooks') ? '' : ' [VERIFY vs CRSI manual]'; }
applyVerifyFlags();
const LVL = {stop:['⛔', 'Stop'], rfi:['❓', 'RFI'], warn:['⚠️', 'Check'], info:['ℹ️', 'Tip']};
const srcHTML = (src, verify) => `<details class="rsrc"><summary>Rule source</summary><small>${esc(src)}${verify ? ' · <b class="vtag">VERIFY</b>' : ''}</small></details>`;
function checkHTML(chk, title = 'Takeoff check') { if (!chk.items.length) return `<div class="card chk ok" id="tkCheck"><b>✔ ${title}: nothing missed</b></div>`;
  return `<div class="card chk" id="tkCheck"><h3>${title} <small class="muted">(${chk.stop ? chk.stop + ' stop · ' : ''}${chk.items.length} note${chk.items.length > 1 ? 's' : ''})</small></h3><ul class="chkl">${chk.items.map(x => `<li class="lv-${x.lvl}"><span aria-hidden="true">${LVL[x.lvl][0]}</span> <b>${LVL[x.lvl][1]}:</b> ${esc(x.msg)}${x.verify && !isConfirmed(x.id) ? ' <b class="vtag">VERIFY</b>' : ''}${srcHTML(x.src)}</li>`).join('')}</ul></div>`; }
/* gate: returns true to go ahead */
function checkGate(chk, what = 'save this line') { const bad = chk.items.filter(x => x.lvl === 'stop' || x.lvl === 'warn' || x.lvl === 'rfi'); if (!bad.length) return true;
  if (chk.block) { alert(`Can't ${what}:\n\n` + chk.items.filter(x => x.block).map(x => '⛔ ' + x.msg).join('\n')); return false; }
  return confirm(`Takeoff check found ${bad.length} item(s) to look at before you ${what}:\n\n${bad.slice(0, 6).map(x => `${LVL[x.lvl][0]} ${x.msg}`).join('\n')}${bad.length > 6 ? `\n…and ${bad.length - 6} more` : ''}\n\nOK = ${what} anyway · Cancel = go back and fix`); }

/* takeoff wizard: preview gets the check card; DB.put('takeoff') from the wizard goes through the gate */
const pvHook = new MutationObserver(() => { const pv = document.getElementById('preview'); if (!pv || APP.route !== 'takeoff') return; const L = APP.tkLine; if (!L) return; const sig = JSON.stringify([L.p, L.sheet, L.page, L.spec, L.schedQty, L.desc, L.tpl]); if (pv.dataset.chk === sig && document.getElementById('tkCheck')) return;
  const old = document.getElementById('tkCheck'); const html = checkHTML(RHMR.takeoffCheck(L)); if (old) old.outerHTML = html; else pv.insertAdjacentHTML('afterend', html); pv.dataset.chk = sig; });
document.addEventListener('DOMContentLoaded', () => pvHook.observe(document.getElementById('app') || document.body, {childList:true, subtree:true}));
const dbPutRules = DB.put;
DB.put = async function (s, v) { if (s === 'takeoff' && APP.route === 'takeoff' && APP.tkGate && v && v.tpl) { APP.tkGate = false; const chk = RHMR.takeoffCheck(v); if (!checkGate(chk)) { throw Object.assign(new Error('held by takeoff check'), {held:true}); } } return dbPutRules(s, v); };
window.addEventListener('unhandledrejection', e => { if (e.reason && e.reason.held) { e.preventDefault(); toast('Not saved - fix the items in Takeoff check'); } });
document.addEventListener('click', e => { const b = e.target.closest('#saveNow, #primary'); if (b && APP.route === 'takeoff' && document.getElementById('preview')) APP.tkGate = true; }, true);

/* quote / CO: check before the PDF goes out (all-in, concrete, BELOW COST blocks) */
const coPDFRules = coPDF;
coPDF = async function (Cx, T) { const chk = RHMR.quoteCheck(Cx, T, [Cx.title, Cx.notes, Cx.reason].join(' ')); if (!checkGate(chk, 'send this ' + (Cx.type === 'rebar' ? 'quote' : 'CO'))) throw Object.assign(new Error('held by quote check'), {held:true}); return coPDFRules(Cx, T); };
const coFormRules = coForm;
coForm = async function (C) { await coFormRules(C); const T = coTotals(C), chk = RHMR.quoteCheck(C, T, [C.title, C.notes, C.reason].join(' ')); const at = main().querySelector('h2'); if (at && !document.getElementById('tkCheck')) at.insertAdjacentHTML('afterend', checkHTML(chk, C.type === 'rebar' ? 'Quote check' : 'CO check')); };

/* shop drawings: VERIFY tag on CRSI hooks + fab tolerance vs takeoff (0 to +5%, never under) */
const shopRouteRules = ROUTES.shop;
ROUTES.shop = async arg => { await shopRouteRules(arg); const P = APP.project; if (!P || !P.shop) return; const m = main(), h = m.querySelector('.hint');
  if (h && !isConfirmed('sd-crsi-hooks')) h.insertAdjacentHTML('afterend', `<p class="vnote"><b class="vtag">VERIFY vs CRSI manual</b> Hook allowances come from the NCDOT/irebar reproduction of the CRSI tables. Not yet confirmed by Joe.${srcHTML(RHMR.S.sd + ' §2-3')}</p>`);
  try { const res = RHM.barList(P.shop.marks), tk = (await DB.where('takeoff', l => l.projectId === APP.pid)).filter(l => /^rebar/.test(l.tpl)); const tkLb = tk.reduce((a, l) => a + RHM.evalLine(l).rows.reduce((b, r) => b + (r.qty || 0), 0), 0);
    if (tkLb > 0 && res.totLb > 0) { const f = RHMR.fabTolerance(res.totLb, RHM.r2(tkLb)); m.insertAdjacentHTML('beforeend', `<div class="card chk ${f.status === 'PASS' ? 'ok' : ''}" id="fabTol"><b>${f.status === 'PASS' ? '✔' : f.status === 'HOLD' ? '⛔ HOLD FAB' : '⚠️'} Shop weight vs takeoff: ${esc(f.msg)}</b><br><code>${esc(f.math)}</code>${srcHTML(f.src)}</div>`); } } catch (e) { console.warn(e); } };

/* Settings: Assumptions for Joe to confirm */
const settingsRules = ROUTES.settings;
ROUTES.settings = async arg => { await settingsRules(arg); main().insertAdjacentHTML('beforeend', `<div class="card" id="assume"><h3>Assumptions for Joe to confirm</h3><p class="small muted">Values the expert bots wrote from memory or as estimator defaults. Each shows a VERIFY / DEFAULT tag in the app until you tick it.</p>
  ${RHMR.ASSUME.map(a => `<label class="switch asm"><input type="checkbox" data-asm="${a.id}" ${isConfirmed(a.id) || a.tag === 'VERIFIED' ? 'checked' : ''} ${a.tag === 'VERIFIED' ? 'disabled' : ''}><span><b class="vtag ${a.tag === 'VERIFIED' ? 'okt' : ''}">${esc(a.tag)}</b> ${esc(a.text)}<br><small class="muted">${esc(a.src)}${a.url ? ` · checked: ${esc(a.url)}` : ''}</small></span></label>`).join('')}</div>`);
  $$('[data-asm]').forEach(c => c.onchange = () => { SET.confirmed[c.dataset.asm] = c.checked; saveSet(); applyVerifyFlags(); toast(c.checked ? 'Confirmed ✔' : 'Back to VERIFY'); }); };
