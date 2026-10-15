/* Right Hand Man v2.0 - terminology. ONE helper for every label, help text, PDF and export header:
   'Activities' (default) or 'Evolutions', per user (Settings) and optionally per client (client.term overrides). */
'use strict';
const TERMS = {Activities:{one:'activity', many:'activities'}, Evolutions:{one:'evolution', many:'evolutions'}};
function termMode() { const c = (typeof APP !== 'undefined' && APP.client) || {}; const s = (typeof SET !== 'undefined' && SET) || {}; return TERMS[c.term] ? c.term : TERMS[s.term] ? s.term : 'Activities'; }
function term(form = 'one') { const t = TERMS[termMode()], cap = w => w.charAt(0).toUpperCase() + w.slice(1); return form === 'one' ? t.one : form === 'many' ? t.many : form === 'One' ? cap(t.one) : form === 'Many' ? cap(t.many) : t.one; }
