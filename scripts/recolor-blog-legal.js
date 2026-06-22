'use strict';
// One-shot: aligne blog + pages légales sur le thème clair crème de landing.css.
// Remplacement PAR PROPRIÉTÉ (les anciennes valeurs navy se mappent différemment
// selon la propriété : #1B2A4A → ink pour --color-primary mais blanc pour --bg-elevated).
const fs = require('fs');
const path = require('path');

const PROP_MAP = {
  'color-primary':       '#2A2A28',
  'color-primary-light': '#45413A',
  'color-accent':        '#1F7A4D',
  'color-accent-hover':  '#19663F',
  'color-accent-light':  'rgba(31,122,77,0.12)',
  'color-success':       '#1F7A4D',
  'bg-base':             '#FAF8F5',
  'bg-elevated':         '#FFFFFF',
  'bg-sunken':           '#EFEAE0',
  'text-primary':        '#2A2A28',
  'text-secondary':      '#6E6A5E',
  'text-tertiary':       '#8A8578',
  'border-default':      '#E8E5DE',
  'border-light':        '#F0EDE6',
};
// anciennes valeurs reconnues (pour ne pas réécrire des tokens déjà corrects)
const OLD = /(#1B2A4A|#2A3F6B|#E8722A|#D4611F|rgba\(232,\s*114,\s*42,\s*0?\.12\)|#2D8B55|#0F1723|#0A1019|#F7F5F2|#9CA3AF|#6B7280|#1E3055)/i;

function recolor(src) {
  let out = src;
  for (const [prop, val] of Object.entries(PROP_MAP)) {
    const re = new RegExp('(--' + prop + ':\\s*)' + OLD.source, 'gi');
    out = out.replace(re, (m, pre) => pre + val);
  }
  // gradient résiduel (alternative-restosuite.html)
  out = out.replace(/rgba\(232,\s*114,\s*42,\s*0?\.08\)/gi, 'rgba(31,122,77,0.06)');
  out = out.replace(/rgba\(27,\s*42,\s*74,\s*0?\.6\)/gi, 'rgba(244,241,234,0.92)');
  return out;
}

const files = [];
const blogDir = path.join(__dirname, '..', 'client', 'blog');
for (const f of fs.readdirSync(blogDir)) if (f.endsWith('.html')) files.push(path.join(blogDir, f));
files.push(path.join(__dirname, '..', 'client', 'legal', 'legal.css'));

let changed = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const out = recolor(src);
  if (out !== src) { fs.writeFileSync(f, out); changed++; console.log('recolored', path.relative(path.join(__dirname, '..'), f)); }
}
console.log(`\n${changed}/${files.length} fichiers recolorés`);
