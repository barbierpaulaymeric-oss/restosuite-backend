#!/usr/bin/env node
// One-off codemod: add data-ui="custom" to every <select>, <textarea>,
// and eligible <input> in client/js/views/*.js. Idempotent — re-running
// is a no-op (skips tags that already have data-ui).
//
// Skips:
//  - Inputs with type in SKIP_TYPES (date pickers, file, hidden, etc.)
//  - Checkboxes/radios whose nearest preceding `<label class="...">`
//    contains one of the existing toggle-wrapper classes
//    (toggle, supplier-toggle, perm-toggle). These have their own
//    custom slider DOM and would conflict with our enhancer.
//
// After the sweep, run `npm run build` to rebuild the bundle.

const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, '..', 'client', 'js', 'views');

const SKIP_TYPES = new Set([
  'date', 'datetime-local', 'time', 'month', 'week',
  'file', 'hidden', 'range', 'color', 'image',
  'button', 'submit', 'reset',
]);

const TOGGLE_WRAPPER_RE = /class\s*=\s*"[^"]*\b(?:toggle|supplier-toggle|perm-toggle)\b[^"]*"/;

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let src = original;
  let count = 0;

  // <select> ... — match opening tag only
  src = src.replace(/<select(\s[^>]*?)?>/g, (match, attrs) => {
    if (/\bdata-ui\s*=/.test(match)) return match;
    count++;
    return '<select' + (attrs || '') + ' data-ui="custom">';
  });

  // <textarea ...>
  src = src.replace(/<textarea(\s[^>]*?)?>/g, (match, attrs) => {
    if (/\bdata-ui\s*=/.test(match)) return match;
    count++;
    return '<textarea' + (attrs || '') + ' data-ui="custom">';
  });

  // <input ...> (handles both <input ...> and <input ... />)
  src = src.replace(/<input(\s[^>]*?)?(\s*\/)?>/g, (match, attrs, selfClose, offset) => {
    if (/\bdata-ui\s*=/.test(match)) return match;
    const a = attrs || '';
    const typeMatch = a.match(/\btype\s*=\s*["']([^"']+)["']/);
    const t = typeMatch ? typeMatch[1].toLowerCase() : 'text';
    if (SKIP_TYPES.has(t)) return match;

    // Skip checkboxes/radios that live inside a toggle-style wrapper.
    // Heuristic: look back ~250 chars in the SAME source string for a
    // <label class="…toggle…"> (or .supplier-toggle / .perm-toggle).
    if (t === 'checkbox' || t === 'radio') {
      const before = src.slice(Math.max(0, offset - 350), offset);
      const lastLabelOpen = before.lastIndexOf('<label');
      const lastLabelClose = before.lastIndexOf('</label>');
      if (lastLabelOpen > lastLabelClose) {
        const labelTag = before.slice(lastLabelOpen);
        if (TOGGLE_WRAPPER_RE.test(labelTag)) return match;
      }
    }

    count++;
    return '<input' + a + ' data-ui="custom"' + (selfClose || '') + '>';
  });

  if (count > 0 && src !== original) {
    fs.writeFileSync(filePath, src);
  }
  return count;
}

let total = 0;
let touchedFiles = 0;
const files = fs.readdirSync(VIEWS_DIR).filter(f => f.endsWith('.js')).sort();
for (const f of files) {
  const n = processFile(path.join(VIEWS_DIR, f));
  if (n > 0) {
    touchedFiles++;
    console.log(`  + ${f}: ${n}`);
  }
  total += n;
}
console.log(`\nTotal: ${total} attributes added across ${touchedFiles} file(s).`);
