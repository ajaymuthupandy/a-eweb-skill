#!/usr/bin/env node
// A-Eweb design registry: what past sites used, and whether a new design repeats one.
//
// Usage:
//   node registry.mjs list                    most-used fonts, styles, motifs and components
//   node registry.mjs check design-proposal.json   past sites sharing too many defining elements (exit 1 if any)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'registry');
const entries = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

const norm = s => String(s || '').toLowerCase().trim();
// styles compare by catalogue number when one is given ("#97 Biophilic" → "97")
const styleKey = s => (String(s || '').match(/#\s*(\d+)/) || [])[1] || norm(s);
const STOP = new Set(['with', 'from', 'over', 'under', 'left', 'right', 'image', 'images', 'photo', 'photos', 'section', 'text', 'full', 'into', 'that', 'only', 'site', 'page']);
const words = s => new Set(norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w)));
const jaccard = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let i = 0; A.forEach(w => B.has(w) && i++); return i / (A.size + B.size - i); };
const shared = (a = [], b = [], key = norm) => { const B = new Set(b.map(key)); return a.filter(x => B.has(key(x))); };
// components every site has; only distinctive ones say anything about repetition
const GENERIC = /^(footer|header|nav|hero|gallery|contact|contactform|contactfooter|pagehero|icons?|logo|whatsapp\w*|reveal\w*|section|button|lightbox|faq|about|intro|reviews?|reviewcard|testimonials|programs|stay|pricing|prices|enquiryform|inquiryform|enquiry|location|classes|instructors|story|team|services|book|bookbutton|subscribe|newsletter|mailinglist|schedule|retreats?|rooms?|motion|providers|mobilemenu|year|currentyear|ui|blocks)$/i;

function tally(pick) {
  const m = new Map();
  for (const e of entries) for (const v of pick(e) || []) { const k = String(v || '').trim(); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function list() {
  console.log(`${entries.length} sites in the registry\n`);
  const show = (title, rows, min = 1) => {
    const r = rows.filter(([, n]) => n >= min);
    console.log(`${title}:`);
    if (!r.length) console.log('  (none yet)');
    r.slice(0, 15).forEach(([k, n]) => console.log(`  ${String(n).padStart(2)}  ${k}`));
    console.log('');
  };
  show('Industries', tally(e => [e.industry]));
  show('Fonts used on 2+ sites (avoid as the main font unless it is the client\'s logo font)', tally(e => e.fonts), 2);
  show('Primary styles', tally(e => [e.style?.primary]));
  show('Layout patterns', tally(e => e.style?.layout));
  show('Interaction patterns', tally(e => e.style?.interaction));
  show('Distinctive components on 2+ sites', tally(e => e.components.filter(c => !GENERIC.test(c))), 2);
  show('Motifs', tally(e => e.motifs));
  const todo = entries.filter(e => !e.style?.primary && !e.hero);
  console.log(`${todo.length} entries still need style / hero / motifs filled in: ${todo.map(e => e.site).join(', ')}`);
}

function score(p, e) {
  const reasons = [];
  let s = 0;
  if (p.style?.primary && e.style?.primary && styleKey(p.style.primary) === styleKey(e.style.primary)) { s += 3; reasons.push(`same primary style (${e.style.primary})`); }
  for (const k of ['supporting', 'layout', 'interaction']) {
    const sh = shared(p.style?.[k], e.style?.[k], styleKey);
    if (sh.length) { s += sh.length; reasons.push(`same ${k}: ${sh.join(', ')}`); }
  }
  const hero = jaccard(p.hero, e.hero);
  if (hero >= 0.3) { s += 2; reasons.push(`similar hero ("${e.hero}")`); }
  const motifs = (p.motifs || []).filter(m => (e.motifs || []).some(x => norm(x) === norm(m) || jaccard(x, m) >= 0.4));
  if (motifs.length) { s += motifs.length; reasons.push(`shared motifs: ${motifs.join(', ')}`); }
  const comps = shared(p.components, e.components).filter(c => !GENERIC.test(c));
  if (comps.length) { s += Math.min(comps.length, 3); reasons.push(`shared components: ${comps.join(', ')}`); }
  if (p.fonts?.[0] && e.fonts?.[0] && norm(p.fonts[0]) === norm(e.fonts[0])) { s += 1; reasons.push(`same main font (${e.fonts[0]})`); }
  return { s, reasons };
}

function check(file) {
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = entries.filter(e => e.site !== p.site).map(e => {
    const { s, reasons } = score(p, e);
    const sameIndustry = norm(e.industry).split('-').some(w => norm(p.industry).includes(w));
    return { e, s, reasons, threshold: sameIndustry ? 5 : 7 };
  }).sort((a, b) => b.s - a.s);
  const close = rows.filter(r => r.s >= r.threshold);
  console.log(`Checked "${p.site}" against ${rows.length} past sites.\n`);
  for (const r of rows.slice(0, 5)) {
    console.log(`${r.s >= r.threshold ? 'TOO CLOSE' : 'ok       '}  ${r.e.site} (${r.e.industry}) score ${r.s}/${r.threshold}`);
    r.reasons.forEach(x => console.log(`             - ${x}`));
  }
  if (close.length) {
    console.log(`\nRevise the design: change the hero composition, layout pattern or motifs, then check again.`);
    process.exitCode = 1;
  } else {
    console.log('\nNo past site is too close. Add the final signature to the registry when the user accepts the design.');
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'list') list();
else if (cmd === 'check' && arg) check(arg);
else { console.log('Usage: node registry.mjs list | node registry.mjs check design-proposal.json'); process.exitCode = 2; }
