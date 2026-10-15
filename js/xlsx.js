/* Right Hand Man — dependency-free XLSX (zip STORE + minimal OOXML).
   Numbers → numeric cells; text uses sharedStrings; formula-injection guard
   matches RHMF.csvCell (leading = + - @ get a leading apostrophe). Header row bold. */
'use strict';
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.RHMX = m;
})(typeof self !== 'undefined' ? self : this, function () {

  /* ---------- CRC32 (needed for STORE zip) ---------- */
  const CRC_TAB = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TAB[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function u8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const a = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xff;
    return a;
  }
  function concat(parts) {
    let n = 0; for (const p of parts) n += p.length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  function u16(n) { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]); }
  function u32(n) { return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]); }

  /* ZIP STORE: local headers + central directory + EOCD */
  function zipStore(files) {
    // files: [{name, data:Uint8Array}]
    const locals = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = u8(f.name), data = f.data, crc = crc32(data);
      const local = concat([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
        name, data
      ]);
      locals.push(local);
      const cen = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), name
      ]);
      central.push(cen);
      offset += local.length;
    }
    const cenBuf = concat(central), locBuf = concat(locals);
    const eocd = concat([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(cenBuf.length), u32(locBuf.length), u16(0)
    ]);
    return concat([locBuf, cenBuf, eocd]);
  }

  const XML_ESC = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* Same guard as RHMF.csvCell: leading = + - @ → prefix ' so Excel won't treat as formula if pasted/re-opened oddly */
  // v1.9.1: strip characters XML 1.0 forbids (a stray control char made Excel call the file corrupt); Excel cell max 32,767 chars
  const XML_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
  function guardText(v) {
    v = v === null || v === undefined ? '' : String(v).replace(XML_BAD, '');
    if (v.length > 32767) v = v.slice(0, 32760) + '…';
    if (/^[=+\-@]/.test(v)) return "'" + v;
    return v;
  }

  function isNumber(v) {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v === 'boolean') return false;
    const s = String(v).trim();
    // plain number (optional leading -, digits, optional decimal) — no commas/currency. A strict number like "-5" is
    // safe as a numeric cell (v1.9.1: was forced to text "'-5"). Leading-zero codes ("00123" tickets) and 16+ digit ids
    // stay text so Excel doesn't strip zeros or round them; 1e309 (Infinity) stays text.
    if (!/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return false;
    if (/^-?0\d/.test(s) || s.replace(/[^\d]/g, '').length > 15) return false;
    return Number.isFinite(parseFloat(s));
  }

  /**
   * Build an .xlsx ArrayBuffer / Uint8Array from a 2D rows array.
   * First row is the header (bold). Numbers become numeric cells; everything else text.
   * @param {any[][]} rows
   * @param {{sheetName?: string}} [opts]
   * @returns {Uint8Array}
   */
  function toXLSX(rows, opts) {
    opts = opts || {};
    const sheetName = (String(opts.sheetName || 'Sheet1').replace(/[\[\]:*?\/\\]/g, '-').replace(/^'+|'+$/g, '').slice(0, 31)) || 'Sheet1';
    rows = rows || [];
    const shared = [];
    const sIdx = (t) => { const s = guardText(t); let i = shared.indexOf(s); if (i < 0) { i = shared.length; shared.push(s); } return i; };

    let sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData>';
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      sheetXml += `<row r="${r + 1}">`;
      for (let c = 0; c < row.length; c++) {
        const ref = colName(c) + (r + 1);
        const v = row[c];
        const style = r === 0 ? ' s="1"' : ''; // header bold
        if (isNumber(v)) {
          const n = typeof v === 'number' ? v : parseFloat(String(v).trim());
          sheetXml += `<c r="${ref}"${style} t="n"><v>${n}</v></c>`;
        } else {
          const i = sIdx(v);
          sheetXml += `<c r="${ref}"${style} t="s"><v>${i}</v></c>`;
        }
      }
      sheetXml += '</row>';
    }
    sheetXml += '</sheetData></worksheet>';

    const sst = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">` +
      shared.map(s => `<si><t${/^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : ''}>${XML_ESC(s)}</t></si>`).join('') + '</sst>';

    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
      '<borders count="1"><border/></borders>' +
      '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
      '<cellXfs count="2">' +
      '<xf fontId="0" xfId="0"/>' +
      '<xf fontId="1" xfId="0" applyFont="1"/>' +
      '</cellXfs></styleSheet>';

    const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${XML_ESC(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

    const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
      '</Relationships>';

    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      '</Types>';

    const files = [
      { name: '[Content_Types].xml', data: u8(contentTypes) },
      { name: '_rels/.rels', data: u8(rootRels) },
      { name: 'xl/workbook.xml', data: u8(workbook) },
      { name: 'xl/_rels/workbook.xml.rels', data: u8(wbRels) },
      { name: 'xl/worksheets/sheet1.xml', data: u8(sheetXml) },
      { name: 'xl/styles.xml', data: u8(styles) },
      { name: 'xl/sharedStrings.xml', data: u8(sst) }
    ];
    return zipStore(files);
  }

  function colName(i) {
    let s = '';
    i += 1;
    while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  /** Browser helper: Blob ready for download() */
  function toBlob(rows, opts) {
    const u = toXLSX(rows, opts);
    return new Blob([u], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  return { toXLSX, toBlob, guardText, isNumber, colName, crc32, zipStore };
});
