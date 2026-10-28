#!/usr/bin/env node
// Counts the team's repeated corrections in Claude Code history, so you can see whether
// the A-Eweb skill is reducing them. Reads only the messages people typed, not tool output.
//
// Usage:
//   node correction-stats.mjs [--since 2026-10-28] [--dir ~/.claude/projects]
// With --since, counts are split into before / after that date (per 100 typed messages).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const root = opt('--dir') || path.join(os.homedir(), '.claude', 'projects');
const since = opt('--since');

// Same categories as the analysis the skill was built from (Oct 2026).
const CATEGORIES = {
  'Sections overlap': /overla|over lay|ovrlay|overlsy|overylay/i,
  'Gaps / white space': /\bgap|white ?space|empty space|ehite space|white empty/i,
  'Last section + footer fit': /(footer.{0,60}(match|fit|single frame|aligned|land|blend))|((match|fit|land).{0,40}footer)|scrolls? (down|dow) to (the )?(last|footer)/i,
  'Footer too tall': /(height|size) of (the )?f+o+ter|footer height|reduce the (whole )?footer|bottom height of the footer/i,
  'Remove small headings': /(type|kind)s? of heading|eyebrow|these type of txt|these kind of text|heading.{0,20}remove|remove.{0,30}heading/i,
  'Remove number labels': /numer|number|\b0[1-4] ?\/ ?0[1-4]|01 ?, ?02|01 02/i,
  'Menu landing': /navig|naviag|redirect.{0,30}(section|overla|smooth)|only that section|only the respected section|single frame/i,
  'Fill gaps with elements': /element/i,
  'Image quality': /quality|blur|screenshot/i,
  'Side margins': /margin|maregin|marigin/i,
  'Logo font only': /logo.{0,6}font|font used in the logo|logo.s font/i,
  'Header menu font size': /(header|menu).{0,25}font|font.{0,20}(header|menu)/i,
  'Scroll animations / pointer': /scroll (trigger|effect)|scrolll trigger|pointer effect|circle while/i,
  'Looks AI-generated': /ai gen|ai genearted|ai touch|ai built/i,
  'Repeated designs': /repeat|same design|diff(erent)? design|differnet/i,
  'Video controls': /pause|play\/pa/i,
  'Still / again (repeat complaint)': /\b(still|again|i said|nothing has chang|not fixed)\b/i,
};
const BOILER = /^(i need to redesign this site|using the vercel agent|now create a repo|# |act as|redesign the existing|<pasted_content)/i;

function typedText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content) || content.some(b => b && b.type === 'tool_result')) return '';
  return content.filter(b => b && b.type === 'text').map(b => b.text).join('\n');
}

async function readSession(file, onMessage) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.includes('"type":"user"')) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type !== 'user' || o.isSidechain || o.isMeta || o.isCompactSummary || o.message?.role !== 'user') continue;
    let t = typedText(o.message.content)
      .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
      .replace(/<ide_[a-z_]+>[\s\S]*?<\/ide_[a-z_]+>/g, '')
      .replace(/<task-notification>[\s\S]*?<\/task-notification>/g, '')
      .trim();
    if (!t || /^(<command-|<local-command|Caveat:|This session is being continued|\[Request interrupted)/.test(t)) continue;
    onMessage(t, (o.timestamp || '').slice(0, 10));
  }
}

const buckets = { before: { msgs: 0, counts: {} }, after: { msgs: 0, counts: {} } };
const projects = new Set();
for (const p of fs.readdirSync(root)) {
  const pd = path.join(root, p);
  if (!fs.statSync(pd).isDirectory()) continue;
  for (const f of fs.readdirSync(pd).filter(f => f.endsWith('.jsonl'))) {
    await readSession(path.join(pd, f), (text, date) => {
      const b = since && date >= since ? buckets.after : buckets.before;
      b.msgs++;
      if (BOILER.test(text)) return;
      projects.add(p);
      for (const [name, re] of Object.entries(CATEGORIES)) if (re.test(text)) b.counts[name] = (b.counts[name] || 0) + 1;
    });
  }
}

const rate = (b, k) => (b.msgs ? ((b.counts[k] || 0) / b.msgs) * 100 : 0).toFixed(1);
console.log(`Projects: ${projects.size} · typed messages: ${buckets.before.msgs + buckets.after.msgs}`);
if (since) {
  console.log(`Before ${since}: ${buckets.before.msgs} messages · from ${since}: ${buckets.after.msgs} messages\n`);
  console.log('Correction'.padEnd(34) + 'before (per 100 msgs)'.padEnd(26) + 'after (per 100 msgs)');
  for (const k of Object.keys(CATEGORIES)) {
    console.log(k.padEnd(34) + `${buckets.before.counts[k] || 0} (${rate(buckets.before, k)})`.padEnd(26) + `${buckets.after.counts[k] || 0} (${rate(buckets.after, k)})`);
  }
} else {
  console.log('');
  const rows = Object.keys(CATEGORIES).map(k => [k, buckets.before.counts[k] || 0]).sort((a, b) => b[1] - a[1]);
  rows.forEach(([k, n]) => console.log(`${String(n).padStart(5)}  ${k}`));
}
