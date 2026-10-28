#!/usr/bin/env node
// A-Eweb QA gate. Measures the defects behind the team's most repeated corrections
// (overlap, gaps, footer fit, menu landing, margins, fonts, labels, video controls…)
// and exits with code 1 when anything fails.
//
// Usage:
//   node check-site.mjs <url> [--profile a-eweb.profile.json] [--out qa]
//        [--pages /,/about] [--max-pages 20] [--viewports 1440x900,1280x720,390x844] [--no-full]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const DEFAULTS = {
  originalDomain: '',
  siteType: 'single-page',
  fonts: { maxFamilies: 1 },
  colours: { maxBrandColours: 2 },
  header: { behaviour: 'non-sticky', navMinPx: 16 },
  layout: {
    maxSideMarginPx: 64,
    maxSectionPaddingPx: 96,
    maxFooterVh: 0.4,
    footerFitsWithLastSection: true,
    sectionsFitOneScreen: 'single-page',
    exemptSelectors: [],
  },
  content: { allowEyebrows: false, allowNumberLabels: false },
  motion: { allowCursorEffects: false, allowPinnedSections: false, heroVideoControls: false },
};

// ---------- setup ----------

function parseArgs(argv) {
  const args = { url: null, profile: null, out: 'qa', pages: null, maxPages: 20,
    viewports: '1440x900,1280x720,390x844', full: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile') args.profile = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--pages') args.pages = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--max-pages') args.maxPages = Number(argv[++i]);
    else if (a === '--viewports') args.viewports = argv[++i];
    else if (a === '--no-full') args.full = false;
    else if (!a.startsWith('--')) args.url = a;
  }
  if (!args.url) {
    console.error('Usage: node check-site.mjs <url> [--profile a-eweb.profile.json] [--out qa] [--pages /,/about]');
    process.exit(2);
  }
  if (!args.profile && fs.existsSync('a-eweb.profile.json')) args.profile = 'a-eweb.profile.json';
  args.viewportList = args.viewports.split(',').map(v => {
    const [w, h] = v.toLowerCase().split('x').map(Number);
    return { w, h, name: `${w}x${h}` };
  });
  return args;
}

function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (k.startsWith('$')) continue;
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

function loadProfile(file) {
  if (!file) return DEFAULTS;
  try {
    return merge(DEFAULTS, JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (e) {
    console.error(`Could not read profile ${file}: ${e.message}`);
    process.exit(2);
  }
}

function loadPlaywright() {
  const candidates = [];
  try { candidates.push(createRequire(path.join(process.cwd(), 'noop.js')).resolve('playwright')); } catch {}
  try {
    const g = execSync('npm root -g', { encoding: 'utf8' }).trim();
    candidates.push(path.join(g, 'playwright'), path.join(g, '@playwright', 'cli', 'node_modules', 'playwright'));
  } catch {}
  const req = createRequire(import.meta.url);
  for (const c of candidates) {
    try { return req(c); } catch {}
  }
  console.error('Playwright not found. Install it once: npm i -g playwright && npx playwright install chromium');
  process.exit(2);
}

// The Playwright copy that was found may expect a browser build that isn't downloaded.
// Fall back to installed Chrome, then to any Chromium Playwright has downloaded before.
async function launchBrowser(chromium) {
  try { return await chromium.launch(); } catch {}
  try { return await chromium.launch({ channel: 'chrome' }); } catch {}
  const home = os.homedir();
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'win32'
    ? path.join(home, 'AppData', 'Local', 'ms-playwright')
    : process.platform === 'darwin' ? path.join(home, 'Library', 'Caches', 'ms-playwright') : path.join(home, '.cache', 'ms-playwright'));
  const builds = fs.existsSync(dir) ? fs.readdirSync(dir).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])) : [];
  for (const b of builds) {
    for (const exe of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const p = path.join(dir, b, exe);
      if (!fs.existsSync(p)) continue;
      try { return await chromium.launch({ executablePath: p }); } catch {}
    }
  }
  console.error('No browser found. Run once: npx playwright install chromium');
  process.exit(2);
}

// ---------- results ----------

const results = [];
function record(check, status, page, viewport, message, items = []) {
  results.push({ check, status, page, viewport, message, items: items.slice(0, 8), more: Math.max(0, items.length - 8) });
}

const slug = p => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()) || 'home';

// ---------- code that runs inside the page ----------

function installQa() {
  const qa = {};
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'BR', 'HEAD']);
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
  const tag = el => el.tagName.toUpperCase();

  qa.desc = el => {
    if (!el || !el.tagName) return '?';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    const t = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return t ? `${s} "${t}"` : s;
  };
  qa.shown = el => {
    if (!el || !el.getBoundingClientRect) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  qa.opacity = el => {
    let o = 1;
    for (let n = el, d = 0; n && n.nodeType === 1 && d < 30; n = n.parentElement, d++) {
      const s = getComputedStyle(n);
      if (s.visibility === 'hidden') return 0;
      o *= parseFloat(s.opacity);
    }
    return o;
  };
  qa.devOverlay = el => !!(el.closest && el.closest('nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button], #__next-build-watcher, [data-next-badge-root]'));
  qa.header = () => {
    const c = [...document.querySelectorAll('header, [role="banner"]')]
      .filter(h => qa.shown(h) && !h.closest('main section, main article, section section'));
    return c.find(h => !h.closest('main')) || c[0] || null;
  };
  qa.footer = () => {
    const c = [...document.querySelectorAll('footer, [role="contentinfo"]')].filter(f => qa.shown(f) && !f.closest('article, section'));
    if (!c.length) return null;
    const outside = c.filter(f => !f.closest('main'));
    const pool = outside.length ? outside : c;
    return pool.reduce((a, b) => (b.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? b : a));
  };
  qa.headerState = () => {
    const h = qa.header();
    if (!h) return { exists: false };
    const s = getComputedStyle(h);
    let pos = s.position;
    if (!/(fixed|sticky)/.test(pos) && h.parentElement && /(fixed|sticky)/.test(getComputedStyle(h.parentElement).position)) pos = getComputedStyle(h.parentElement).position;
    const r = h.getBoundingClientRect();
    return { exists: true, position: pos, visible: r.bottom > 1 && r.top > -2, bottom: Math.round(Math.max(0, r.bottom)), height: Math.round(r.height) };
  };
  qa.isBlock = el => {
    if (SKIP.has(tag(el)) || qa.devOverlay(el) || !qa.shown(el)) return false;
    const s = getComputedStyle(el);
    if (s.position === 'fixed' || s.position === 'absolute') return false;
    return el.getBoundingClientRect().height >= 40;
  };
  qa.sections = () => {
    const header = qa.header(), footer = qa.footer();
    const kids = el => [...el.children].filter(qa.isBlock);
    const clean = list => list.filter(el => el !== header && el !== footer);
    let list = clean(kids(document.querySelector('main') || document.body));
    for (let i = 0; i < 8; i++) {
      const containing = list.find(el => (header && el.contains(header)) || (footer && el.contains(footer)));
      if (containing) { list = list.flatMap(el => (el === containing ? clean(kids(el)) : [el])); continue; }
      if (list.length === 1 && !/^(SECTION|ARTICLE)$/.test(tag(list[0]))) {
        const w = list[0], inner = kids(w), ww = w.getBoundingClientRect().width;
        if (inner.length > 1 && inner.every(k => k.getBoundingClientRect().width >= ww * 0.9)) { list = clean(inner); continue; }
      }
      break;
    }
    return list;
  };
  // Some sites put a closing section ("See you on the mat") inside <footer>. Treat that part as the
  // last section and only the rest (logo, links, copyright) as the footer.
  qa.footerParts = () => {
    const f = qa.footer();
    if (!f) return { footer: null, closing: null };
    let kids = [...f.children].filter(qa.isBlock);
    while (kids.length === 1 && [...kids[0].children].filter(qa.isBlock).length > 1) kids = [...kids[0].children].filter(qa.isBlock);
    if (kids.length > 1) {
      const first = kids[0], fr = f.getBoundingClientRect(), r = first.getBoundingClientRect();
      const bigMedia = [...first.querySelectorAll('img, video, picture')].some(m => { const mr = m.getBoundingClientRect(); return mr.width * mr.height > fr.width * fr.height * 0.15; });
      if ((first.querySelector('h1, h2') || bigMedia) && r.height > fr.height * 0.4) return { footer: f, closing: first };
    }
    return { footer: f, closing: null };
  };
  qa.structure = () => {
    const parts = qa.footerParts();
    const sections = qa.sections().map(s => ({ el: s, name: qa.desc(s), rect: () => s.getBoundingClientRect() }));
    if (parts.closing) sections.push({ el: parts.closing, name: qa.desc(parts.closing) + ' (inside footer)', rect: () => parts.closing.getBoundingClientRect() });
    const footer = parts.footer ? {
      el: parts.footer, name: 'footer',
      rect: () => {
        const fr = parts.footer.getBoundingClientRect();
        if (!parts.closing) return fr;
        const top = parts.closing.getBoundingClientRect().bottom;
        return { top, bottom: fr.bottom, left: fr.left, right: fr.right, width: fr.width, height: fr.bottom - top };
      },
    } : null;
    return { sections, footer };
  };
  qa.contentRects = sec => {
    const out = [];
    const sel = 'img,video,svg,canvas,picture,iframe,h1,h2,h3,h4,h5,h6,p,li,a,button,blockquote,figcaption,label,input,textarea,select,dt,dd,td,th,span,strong,em,small,div';
    for (const el of sec.querySelectorAll(sel)) {
      if (out.length > 1500) break;
      const t = tag(el);
      if (t !== 'SVG' && el.closest('svg')) continue;
      const media = /^(IMG|VIDEO|SVG|CANVAS|PICTURE|IFRAME)$/.test(t);
      const control = /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t);
      const bg = !media && getComputedStyle(el).backgroundImage.includes('url(');
      if (!media && !control && !bg && !ownText(el)) continue;
      if (!qa.shown(el) || qa.opacity(el) < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, media: media || bg });
    }
    return out;
  };

  qa.layout = opts => {
    const sy = scrollY;
    const st = qa.structure();
    const secs = st.sections.map(b => b.el);
    const sections = st.sections.map((b, i) => {
      const s = b.el;
      const r = s.getBoundingClientRect();
      const cs = getComputedStyle(s);
      const rects = qa.contentRects(s);
      const bg = cs.backgroundImage.includes('url(');
      let minT = Infinity, maxB = -Infinity;
      const lefts = [];
      for (const c of rects) {
        const t = Math.max(c.t, r.top), b = Math.min(c.b, r.bottom);
        if (b <= t) continue;
        minT = Math.min(minT, t); maxB = Math.max(maxB, b);
        if (c.l > 1 && c.r < innerWidth - 1) lefts.push(c.l);
      }
      let coverage = 1;
      const big = rects.some(c => c.media && (c.r - c.l) * (c.b - c.t) >= r.width * r.height * 0.8);
      if (!bg && !big) {
        let hit = 0, total = 0;
        for (let x = 0; x < 24; x++) for (let y = 0; y < 16; y++) {
          const px = r.left + (x + 0.5) * r.width / 24, py = r.top + (y + 0.5) * r.height / 16;
          total++;
          if (rects.some(c => px >= c.l && px <= c.r && py >= c.t && py <= c.b)) hit++;
        }
        coverage = hit / total;
      }
      return {
        i, name: b.name, id: s.id || '',
        pinned: s.classList.contains('pin-spacer') || !!s.querySelector(':scope > .pin-spacer') || cs.position === 'sticky',
        top: r.top + sy, bottom: r.bottom + sy, height: r.height,
        padTop: isFinite(minT) ? minT - r.top : null,
        padBottom: isFinite(maxB) ? r.bottom - maxB : null,
        minLeft: lefts.length ? Math.min(...lefts) : null,
        coverage, bgImage: bg || big,
        clipsOverflow: /(hidden|clip)/.test(cs.overflowY) || /(hidden|clip)/.test(cs.overflow),
        overflowPx: s.scrollHeight - s.clientHeight,
        exempt: (opts.exempt || []).some(sel => { try { return s.matches(sel); } catch { return false; } }),
      };
    });
    const fr = st.footer ? st.footer.rect() : null;
    const escapes = [];
    secs.forEach(s => {
      const r = s.getBoundingClientRect();
      let n = 0;
      for (const el of s.querySelectorAll('img,video,svg,canvas,picture,iframe,div,span,figure')) {
        if (++n > 2500 || escapes.length > 30) break;
        const t = tag(el);
        if (t !== 'SVG' && el.closest('svg')) continue;
        const media = /^(IMG|VIDEO|SVG|CANVAS|PICTURE|IFRAME)$/.test(t);
        if (!media && getComputedStyle(el).position !== 'absolute') continue;
        if (!qa.shown(el) || qa.opacity(el) < 0.05) continue;
        const e = el.getBoundingClientRect();
        const over = Math.max(r.top - e.top, e.bottom - r.bottom);
        if (over <= 4) continue;
        let clipped = false;
        for (let a = el.parentElement; a; a = a.parentElement) {
          const ac = getComputedStyle(a);
          if (/(hidden|clip|auto|scroll)/.test(ac.overflowY) || /(hidden|clip)/.test(ac.overflow)) { clipped = true; break; }
          if (a === s) break;
        }
        if (!clipped) escapes.push(`${qa.desc(el)} reaches ${Math.round(over)}px outside ${qa.desc(s)}`);
      }
    });
    return {
      vw: innerWidth, vh: innerHeight, sections, escapes,
      footer: fr ? { top: fr.top + sy, bottom: fr.bottom + sy, height: fr.height } : null,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    };
  };

  // What is actually painted on top, at sample points, at the current scroll position.
  qa.cover = () => {
    const header = qa.header();
    const st = qa.structure();
    const blocks = st.footer ? [...st.sections, st.footer] : st.sections;
    const hs = qa.headerState();
    const headerBottom = hs.exists && /(fixed|sticky)/.test(hs.position) && hs.visible ? hs.bottom : 0;
    const closestFixed = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return n; return null; };
    const style = document.createElement('style');
    style.textContent = '*{pointer-events:auto!important}';
    document.head.appendChild(style);
    const issues = [];
    const rects = blocks.map(b => b.rect());
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
      const a = rects[i], b = rects[j];
      const ov = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const onScreen = Math.min(a.bottom, b.bottom) > 0 && Math.max(a.top, b.top) < innerHeight;
      if (ov > 2 && onScreen) issues.push({ kind: 'rect', where: blocks[i].name, by: blocks[j].name, px: Math.round(ov) });
    }
    blocks.forEach((blk, bi) => {
      const r = rects[bi];
      const top = Math.max(r.top, headerBottom) + 6, bottom = Math.min(r.bottom, innerHeight) - 6;
      if (bottom - top < 24) return;
      for (let cx = 1; cx <= 5; cx++) for (let cy = 1; cy <= 4; cy++) {
        const x = r.left + (cx / 6) * r.width, y = top + (cy / 5) * (bottom - top);
        const topEl = document.elementsFromPoint(x, y).find(el => qa.opacity(el) > 0.05);
        if (!topEl || blk.el.contains(topEl) || topEl.contains(blk.el) || qa.devOverlay(topEl)) continue;
        if (header && header.contains(topEl)) continue;
        const fx = closestFixed(topEl);
        if (fx) { const f = fx.getBoundingClientRect(); if (f.width * f.height < 200 * 200) continue; }
        const owner = blocks.find(b2 => b2.el.contains(topEl));
        issues.push({ kind: 'paint', where: blk.name, by: (owner ? owner.name + ' → ' : '') + qa.desc(topEl) });
        break;
      }
    });
    style.remove();
    return { scrollY: Math.round(scrollY), issues };
  };

  qa.bottom = () => {
    const st = qa.structure();
    const hs = qa.headerState();
    const offset = hs.exists && /(fixed|sticky)/.test(hs.position) && hs.visible ? hs.bottom : 0;
    const last = st.sections[st.sections.length - 1];
    const lr = last ? last.rect() : null;
    const fr = st.footer ? st.footer.rect() : null;
    return {
      vh: innerHeight, offset, header: hs,
      atBottom: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2,
      last: lr ? { name: last.name, top: Math.round(lr.top), bottom: Math.round(lr.bottom), height: Math.round(lr.height) } : null,
      footer: fr ? { top: Math.round(fr.top), bottom: Math.round(fr.bottom), height: Math.round(fr.height) } : null,
    };
  };

  // Called at every scroll step: remembers how visible each element was while fully on screen.
  qa.trackHidden = () => {
    const seen = window.__qaSeen || (window.__qaSeen = new Map());
    for (const el of document.body.querySelectorAll('h1,h2,h3,h4,p,li,img,a,button,blockquote,figure')) {
      if (el.closest('header, nav, [aria-hidden="true"], [inert], dialog:not([open]), [role="dialog"], [data-state="closed"]') || qa.devOverlay(el)) continue;
      if (tag(el) !== 'IMG' && !ownText(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 400 || r.right <= 0 || r.left >= innerWidth || r.top < 0 || r.bottom > innerHeight) continue;
      if (getComputedStyle(el).display === 'none') continue;
      const e = seen.get(el) || { steps: 0, max: 0 };
      e.steps++;
      e.max = Math.max(e.max, qa.opacity(el));
      seen.set(el, e);
    }
  };
  // Elements that stayed invisible every time they were on screen (a reveal that never fired).
  qa.hidden = () => {
    const out = [];
    for (const [el, e] of window.__qaSeen || new Map()) {
      if (out.length > 12) break;
      if (e.steps < 2 || e.max >= 0.05 || !el.isConnected) continue;
      // inactive slides of a crossfade sit on top of a visible sibling: not a defect
      let hider = el;
      while (hider && parseFloat(getComputedStyle(hider).opacity) >= 0.05) hider = hider.parentElement;
      const sibs = hider && hider.parentElement ? [...hider.parentElement.children] : [];
      if (sibs.some(s => s !== hider && parseFloat(getComputedStyle(s).opacity) > 0.5 && Math.abs(s.getBoundingClientRect().top - hider.getBoundingClientRect().top) < 4)) continue;
      out.push(qa.desc(el));
    }
    return out;
  };

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colourCache = new Map();
  const toRgba = str => {
    if (colourCache.has(str)) return colourCache.get(str);
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = str; ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const v = [d[0], d[1], d[2], d[3] / 255];
    colourCache.set(str, v);
    return v;
  };
  const hsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  };
  const hex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  const normFont = f => f.replace(/^_+/, '').replace(/_Fallback.*$/i, '').replace(/_[0-9a-f]{5,}$/i, '').replace(/\s*Fallback$/i, '').replace(/_/g, ' ').trim();

  qa.content = opts => {
    const header = qa.header(), footer = qa.footer();
    const all = [...document.body.querySelectorAll('*')].filter(el => !SKIP.has(tag(el)) && !qa.devOverlay(el)).slice(0, 8000);
    const textEls = all.filter(el => tag(el) !== 'SVG' && !el.closest('svg') && ownText(el) && qa.shown(el) && qa.opacity(el) > 0.05);

    // fonts
    const fam = new Map();
    for (const el of textEls) {
      const f = normFont(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, ''));
      if (/icon|awesome|material symbols|lucide/i.test(f)) continue;
      fam.set(f, (fam.get(f) || 0) + el.textContent.trim().length);
    }
    const totalChars = [...fam.values()].reduce((a, b) => a + b, 0) || 1;
    const fonts = [...fam.entries()].map(([name, chars]) => ({ name, share: chars / totalChars })).sort((a, b) => b.share - a.share);

    // colours (non-neutral hues, clustered)
    const samples = [];
    const consider = (str, w) => {
      if (!str || w <= 0) return;
      const [r, g, b, a] = toRgba(str);
      if (a < 0.5) return;
      const [h, s, l] = hsl(r, g, b);
      if (s < 0.18 || l < 0.12 || l > 0.92) return;
      samples.push({ h, w, hex: hex(r, g, b) });
    };
    for (const el of all) {
      if (!qa.shown(el)) continue;
      const s = getComputedStyle(el);
      if (ownText(el)) consider(s.color, el.textContent.trim().length);
      const r = el.getBoundingClientRect();
      if (r.width * r.height > 400) consider(s.backgroundColor, (r.width * r.height) / 1000);
    }
    samples.sort((a, b) => b.w - a.w);
    const clusters = [];
    for (const smp of samples) {
      const c = clusters.find(c => Math.min(Math.abs(c.h - smp.h), 360 - Math.abs(c.h - smp.h)) < 22);
      if (c) c.w += smp.w; else clusters.push({ h: smp.h, w: smp.w, hex: smp.hex });
    }
    const cw = clusters.reduce((a, c) => a + c.w, 0) || 1;
    const colours = clusters.filter(c => c.w / cw >= 0.02).map(c => c.hex);

    // header menu vs footer links
    const mode = list => { const m = new Map(); list.forEach(v => m.set(v, (m.get(v) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
    const linkSizes = root => root ? [...root.querySelectorAll('a, button')].filter(a => qa.shown(a) && (a.innerText || '').trim().length > 1 && !a.querySelector('img')).map(a => {
      const leaf = [...a.querySelectorAll('*')].find(ownText) || a;
      return parseFloat(getComputedStyle(leaf).fontSize);
    }) : [];
    const nav = { header: mode(linkSizes(header)), footer: mode(linkSizes(footer)) };

    // small headings above section titles, and "Place · Tagline" labels
    const eyebrows = [], taglines = [];
    for (const h of document.querySelectorAll('h1, h2, h3')) {
      if (!qa.shown(h) || (header && header.contains(h)) || (footer && footer.contains(h))) continue;
      let prev = h.previousElementSibling;
      while (prev && !qa.shown(prev)) prev = prev.previousElementSibling;
      if (!prev && h.parentElement && h.parentElement.firstElementChild === h) {
        prev = h.parentElement.previousElementSibling;
        while (prev && !qa.shown(prev)) prev = prev.previousElementSibling;
      }
      if (!prev || prev.querySelector('h1,h2,h3,h4,img,video,picture')) continue;
      const text = (prev.innerText || '').trim();
      if (text.length < 2 || text.length > 80) continue;
      const leaf = ownText(prev) ? prev : [...prev.querySelectorAll('*')].find(ownText);
      if (!leaf) continue;
      const ps = getComputedStyle(leaf), hsz = parseFloat(getComputedStyle(h).fontSize), fs = parseFloat(ps.fontSize);
      const spaced = parseFloat(ps.letterSpacing) >= fs * 0.06;
      const upper = ps.textTransform === 'uppercase' || (text === text.toUpperCase() && /[A-Z]/.test(text));
      const close = h.getBoundingClientRect().top - prev.getBoundingClientRect().bottom < 80;
      if (close && (fs <= Math.max(14, hsz * 0.5) || ((upper || spaced) && fs < hsz * 0.7))) eyebrows.push(`"${text.slice(0, 60)}" above "${h.innerText.trim().slice(0, 40)}"`);
    }
    const numbers = [];
    const numRe = [/^\(?0\d\)?\.?$/, /^0\d\s*[\/.\-–—]\s*\d{1,2}$/, /^\d{1,2}\s*\/\s*\d{1,2}$/, /^\d+\s*\+\s*\d+$/];
    for (const el of textEls) {
      if (el.children.length || (footer && footer.contains(el)) || el.closest('form, time, table')) continue;
      const t = el.textContent.trim();
      if (numRe.some(re => re.test(t))) numbers.push(`"${t}" in ${qa.desc(el.parentElement)}`);
      else if (t.length <= 90 && /\S\s+[·•|]\s+\S/.test(t) && parseFloat(getComputedStyle(el).fontSize) <= 16 && !el.closest('header, footer, nav')) taglines.push(`"${t}"`);
    }

    // video controls
    const videoControls = [];
    const videos = [...document.querySelectorAll('video')].filter(qa.shown);
    videos.filter(v => v.hasAttribute('controls')).forEach(v => videoControls.push(`<video controls> ${qa.desc(v)}`));
    for (const b of document.querySelectorAll('button, [role="button"], a')) {
      if (!qa.shown(b)) continue;
      const label = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''} ${(b.innerText || '').trim()}`.trim();
      if (label.length > 40 || !/\b(pause|play)\b/i.test(label)) continue;
      const br = b.getBoundingClientRect();
      if (videos.some(v => { const vr = v.getBoundingClientRect(); return br.left < vr.right && br.right > vr.left && br.top < vr.bottom && br.bottom > vr.top; })) videoControls.push(`"${label}" button over a video`);
    }

    // links to the client's original site
    const originalLinks = [];
    const d = (opts.originalDomain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
    if (d) for (const a of document.querySelectorAll('a[href]')) {
      try {
        const host = new URL(a.href, location.href).hostname.toLowerCase().replace(/^www\./, '');
        if (host === d || host.endsWith('.' + d)) originalLinks.push(`${(a.innerText || a.getAttribute('aria-label') || qa.desc(a)).trim().slice(0, 30)} → ${a.href}`);
      } catch {}
    }

    // images
    const broken = [], blurry = [];
    const fileName = img => { try { const u = new URL(img.currentSrc || img.src, location.href); return decodeURIComponent((u.searchParams.get('url') || u.pathname).split('/').pop()); } catch { return img.src; } };
    for (const img of document.images) {
      if (!qa.shown(img) || !img.complete) continue;
      const name = fileName(img);
      if (img.naturalWidth === 0) { if (!/\.svg/i.test(name)) broken.push(name); continue; }
      const r = img.getBoundingClientRect();
      if (r.width < 200 || /\.svg/i.test(name)) continue;
      const fit = getComputedStyle(img).objectFit;
      const scale = fit === 'cover' ? Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight)
        : fit === 'contain' ? Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight)
        : r.width / img.naturalWidth;
      if (scale > 1.25) blurry.push(`${name}: shown ${Math.round(r.width)}×${Math.round(r.height)}, file ${img.naturalWidth}×${img.naturalHeight}`);
    }
    let logo = null;
    const li = header && header.querySelector('img');
    if (li && qa.shown(li) && li.complete && li.naturalWidth) {
      const name = fileName(li), r = li.getBoundingClientRect();
      if (/\.jpe?g/i.test(name) || (/\.png/i.test(name) && li.naturalWidth < r.width * 1.5)) logo = `${name}: ${li.naturalWidth}×${li.naturalHeight} file shown at ${Math.round(r.width)}×${Math.round(r.height)}`;
    }

    // cursor effects
    const cursorNone = ['html', 'body', 'main'].some(s => { const el = document.querySelector(s); return el && getComputedStyle(el).cursor === 'none'; });
    const followers = [];
    all.forEach((el, i) => {
      const s = getComputedStyle(el);
      if (s.position !== 'fixed' || s.pointerEvents !== 'none' || (header && header.contains(el))) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width <= 120 && r.height <= 120) { el.setAttribute('data-qa-fixed', String(i)); followers.push(String(i)); }
    });

    return { fonts, colours, nav, eyebrows, taglines, numbers, videoControls, originalLinks, broken, blurry, logo, cursorNone, followers };
  };

  qa.followerPositions = () => [...document.querySelectorAll('[data-qa-fixed]')].map(el => {
    const r = el.getBoundingClientRect();
    return { id: el.getAttribute('data-qa-fixed'), x: Math.round(r.left), y: Math.round(r.top), name: qa.desc(el) };
  });

  qa.navLinks = () => {
    const header = qa.header();
    if (!header) return [];
    const here = location.pathname.replace(/\/$/, '') || '/';
    const out = [];
    [...header.querySelectorAll('a[href*="#"]')].forEach((a, i) => {
      if (!qa.shown(a)) return;
      const ar = a.getBoundingClientRect();
      // accessibility skip links are hidden until focused; they aren't menu items
      if (ar.width < 4 || ar.height < 4 || /^skip\b/i.test((a.innerText || a.textContent || '').trim())) return;
      const u = new URL(a.href, location.href);
      const p = u.pathname.replace(/\/$/, '') || '/';
      if (p !== here || u.hash.length < 2) return;
      a.setAttribute('data-qa-nav', String(i));
      const label = (a.innerText || '').trim() || a.getAttribute('aria-label') || a.querySelector('img')?.alt || u.hash;
      out.push({ k: String(i), hash: u.hash, text: label.slice(0, 30) });
    });
    const seen = new Set();
    return out.filter(l => (seen.has(l.hash) ? false : seen.add(l.hash)));
  };

  qa.landing = hash => {
    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    if (!target) return { missing: true };
    const hs = qa.headerState();
    const offset = hs.exists && /(fixed|sticky)/.test(hs.position) && hs.visible ? hs.bottom : 0;
    const st = qa.structure();
    const secs = st.sections.map(b => b.el);
    const sec = secs.find(s => s === target || s.contains(target)) || target;
    const idx = secs.indexOf(sec);
    const sr = sec.getBoundingClientRect();
    const prev = idx > 0 ? secs[idx - 1].getBoundingClientRect() : null;
    const isLast = idx === secs.length - 1;
    const next = idx >= 0 && !isLast ? secs[idx + 1].getBoundingClientRect() : st.footer ? st.footer.rect() : null;
    return {
      name: qa.desc(sec), offset, top: Math.round(sr.top), height: Math.round(sr.height), vh: innerHeight, isLast,
      isFirst: idx === 0, scrollY: Math.round(scrollY),
      prevShows: prev ? Math.round(prev.bottom - offset) : 0,
      nextShows: next ? Math.round(innerHeight - next.top) : 0,
      atBottom: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2,
    };
  };

  window.__qa = qa;
}

// ---------- page driving ----------

async function settle(page, maxMs = 4000) {
  let last = -1, stable = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const y = await page.evaluate(() => scrollY);
    if (Math.abs(y - last) < 1) { if (++stable >= 4) return; } else stable = 0;
    last = y;
    await page.waitForTimeout(100);
  }
}

async function toTop(page) {
  await page.evaluate(() => { try { window.lenis?.scrollTo?.(0, { immediate: true }); } catch {} window.scrollTo(0, 0); });
  await settle(page);
}

async function scrollThrough(page, vp, onStep) {
  await page.mouse.move(vp.w / 2, vp.h / 2);
  let lastY = -1;
  for (let i = 0; i < 120; i++) {
    const { y, max, vh } = await page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight, vh: innerHeight }));
    await onStep();
    if (y >= max - 2) break;
    if (Math.abs(y - lastY) < 1) await page.evaluate(d => window.scrollBy(0, d), Math.round(vh * 0.6));
    else await page.mouse.wheel(0, Math.round(vh * 0.6));
    lastY = y;
    await page.waitForTimeout(180);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await settle(page);
  await page.waitForTimeout(600);
}

async function checkPage(context, base, pagePath, vp, profile, args, shotsDir) {
  const page = await context.newPage();
  const url = new URL(pagePath, base).href;
  const origin = new URL(base).origin;
  const errors = [], thirdParty = [];
  page.on('pageerror', e => errors.push(`page error: ${e.message.slice(0, 160)}`));
  page.on('console', m => { if (m.type() === 'error') thirdParty.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('response', r => {
    if (r.status() < 400) return;
    (r.url().startsWith(origin) ? errors : thirdParty).push(`${r.status()} ${r.url().slice(0, 140)}`);
  });
  page.on('requestfailed', r => {
    const f = r.failure()?.errorText || '';
    if (/ERR_ABORTED/.test(f)) return;
    (r.url().startsWith(origin) ? errors : thirdParty).push(`failed ${r.url().slice(0, 140)} ${f}`);
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch {
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  }
  await page.evaluate(installQa);
  await page.waitForTimeout(800);

  const desktop = vp.w >= 1024;
  const vpn = vp.name, P = pagePath;
  const L = profile.layout;

  // 1. Scroll the whole page, checking what is painted on top at every step.
  const cover = new Map();
  const collect = res => res.issues.forEach(it => {
    const key = `${it.kind}|${it.where}|${it.by}`;
    if (!cover.has(key)) cover.set(key, { ...it, scrollY: res.scrollY });
  });
  await scrollThrough(page, vp, async () => {
    collect(await page.evaluate(() => window.__qa.cover()));
    await page.evaluate(() => window.__qa.trackHidden());
  });
  collect(await page.evaluate(() => window.__qa.cover()));
  const bottom = await page.evaluate(() => window.__qa.bottom());
  // give slow or staggered reveal animations on the last screen time to finish
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__qa.trackHidden());
  const hidden = await page.evaluate(() => window.__qa.hidden());
  await page.screenshot({ path: path.join(shotsDir, `bottom-${slug(P)}-${vpn}.png`) });

  const coverItems = [...cover.values()].map(c => c.kind === 'rect'
    ? `${c.where} and ${c.by} overlap by ${c.px}px (at scroll ${c.scrollY})`
    : `${c.by} is painted over ${c.where} (at scroll ${c.scrollY})`);
  record('covered', coverItems.length ? 'FAIL' : 'PASS', P, vpn,
    coverItems.length ? 'Something covers another section while scrolling' : 'Nothing covers another section while scrolling', coverItems);

  record('hidden-content', hidden.length ? 'FAIL' : 'PASS', P, vpn,
    hidden.length ? 'Content still invisible after scrolling past it (reveal never fired)' : 'All content became visible', hidden);

  // 2. Header behaviour and footer at the bottom of the page.
  if (bottom.header.exists && profile.header.behaviour !== 'reveal-on-scroll-up') {
    const follows = bottom.header.visible;
    const want = profile.header.behaviour;
    const bad = (want === 'non-sticky' && follows) || (want === 'sticky' && !follows);
    record('header-behaviour', bad ? (args.profile ? 'FAIL' : 'REVIEW') : 'PASS', P, vpn,
      bad ? `Header is ${follows ? 'sticky' : 'not sticky'} but ${args.profile ? 'the profile says' : 'the default is'} ${want}` : `Header is ${want}`);
  }
  if (desktop && bottom.footer) {
    const ratio = bottom.footer.height / bottom.vh;
    record('footer-height', ratio > L.maxFooterVh ? 'FAIL' : 'PASS', P, vpn,
      `Footer is ${bottom.footer.height}px = ${Math.round(ratio * 100)}% of the screen (max ${Math.round(L.maxFooterVh * 100)}%)`);
  }
  if (desktop && L.footerFitsWithLastSection && bottom.last && bottom.footer) {
    const gapAbove = bottom.last.top - bottom.offset;
    let status = 'PASS', msg = `Last section and footer fill the screen exactly`;
    if (gapAbove < -2) { status = 'FAIL'; msg = `Last section doesn't fit: its top ${-gapAbove}px is cut off when scrolled to the bottom (${bottom.last.name})`; }
    else if (gapAbove > 6) { status = 'FAIL'; msg = `${gapAbove}px of the previous section still shows above the last section at the bottom of the page`; }
    record('footer-fit', status, P, vpn, msg);
  }

  // 3. Static layout, measured from the top.
  await toTop(page);
  const lay = await page.evaluate(o => window.__qa.layout(o), { exempt: L.exemptSelectors });
  record('overflow-x', lay.overflowX > 1 ? 'FAIL' : 'PASS', P, vpn,
    lay.overflowX > 1 ? `Page is ${lay.overflowX}px wider than the screen (sideways scroll)` : 'No sideways scroll');

  const S = lay.sections;
  const pinned = S.filter(s => s.pinned);
  if (!profile.motion.allowPinnedSections) {
    record('pinned-section', pinned.length ? 'FAIL' : 'PASS', P, vpn,
      pinned.length ? 'Pinned or sticky scroll sections (blocked by default: they cause overlap and empty scroll space)' : 'No pinned sections',
      pinned.map(s => s.name));
  }
  const flowS = S.filter(s => !s.pinned);
  const chain = lay.footer ? [...S, { name: 'footer', top: lay.footer.top, bottom: lay.footer.bottom }] : S;
  const overlaps = [], gaps = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const d = chain[i + 1].top - chain[i].bottom;
    if (d < -2) overlaps.push(`${chain[i].name} runs ${Math.round(-d)}px into ${chain[i + 1].name}`);
    if (d > 2) gaps.push(`${Math.round(d)}px gap between ${chain[i].name} and ${chain[i + 1].name}`);
  }
  record('section-overlap', overlaps.length ? 'FAIL' : 'PASS', P, vpn, overlaps.length ? 'Sections overlap in the page flow' : 'No sections overlap in the page flow', overlaps);
  record('section-gap', gaps.length ? 'FAIL' : 'PASS', P, vpn, gaps.length ? 'Bare gaps between sections' : 'Sections sit edge to edge', gaps);

  const maxPad = desktop ? L.maxSectionPaddingPx : Math.min(64, L.maxSectionPaddingPx);
  const padItems = [], pads = [];
  flowS.forEach(s => {
    if (s.padTop == null) return;
    if (!s.bgImage) pads.push(s.padTop, s.padBottom);
    if (s.padTop > maxPad) padItems.push(`${Math.round(s.padTop)}px empty above the content in ${s.name}`);
    if (s.padBottom > maxPad) padItems.push(`${Math.round(s.padBottom)}px empty below the content in ${s.name}`);
  });
  record('inner-padding', padItems.length ? 'FAIL' : 'PASS', P, vpn,
    padItems.length ? `Empty space inside sections over ${maxPad}px` : `Section padding within ${maxPad}px`, padItems);
  if (pads.length > 2) {
    const spread = Math.max(...pads) - Math.min(...pads);
    record('uneven-padding', spread > 48 ? 'REVIEW' : 'PASS', P, vpn, `Section paddings range over ${Math.round(spread)}px`);
  }
  const sparse = flowS.filter(s => s.coverage < 0.3 && s.height > 200).map(s => `${s.name}: ${Math.round(s.coverage * 100)}% filled`);
  record('sparse-section', sparse.length ? 'REVIEW' : 'PASS', P, vpn, sparse.length ? 'Sections that are mostly empty' : 'Sections are well filled', sparse);
  record('escapes-section', lay.escapes.length ? 'FAIL' : 'PASS', P, vpn,
    lay.escapes.length ? 'Elements reaching outside their section (unclipped)' : 'Everything stays inside its section', lay.escapes);
  const clippedOverflow = S.filter(s => s.clipsOverflow && s.overflowPx > 4).map(s => `${s.name}: ${s.overflowPx}px of content cut off`);
  record('content-overflow', clippedOverflow.length ? 'FAIL' : 'PASS', P, vpn,
    clippedOverflow.length ? 'Content taller than its section' : 'No content cut off', clippedOverflow);

  // 4. Content checks.
  const content = await page.evaluate(o => window.__qa.content(o), { originalDomain: profile.originalDomain });
  const fams = content.fonts.filter(f => f.share >= 0.005);
  record('font-families', fams.length > profile.fonts.maxFamilies ? 'FAIL' : 'PASS', P, vpn,
    `${fams.length} font famil${fams.length === 1 ? 'y' : 'ies'} in use (max ${profile.fonts.maxFamilies})`,
    fams.map(f => `${f.name} (${Math.round(f.share * 100)}% of text)`));
  record('brand-colours', content.colours.length > profile.colours.maxBrandColours + 1 ? 'REVIEW' : 'PASS', P, vpn,
    `${content.colours.length} colour hues besides neutrals (brand max ${profile.colours.maxBrandColours})`, content.colours);
  if (desktop && content.nav.header != null) {
    const h = content.nav.header, f = content.nav.footer;
    const bad = h < profile.header.navMinPx || (f != null && Math.abs(h - f) > 1);
    record('nav-font', bad ? 'FAIL' : 'PASS', P, vpn,
      `Header menu ${h}px, footer links ${f ?? 'n/a'}px (must match, header ≥ ${profile.header.navMinPx}px)`);
  }
  if (!profile.content.allowEyebrows) {
    record('eyebrow', content.eyebrows.length ? 'FAIL' : 'PASS', P, vpn,
      content.eyebrows.length ? 'Small headings above section titles' : 'No small headings above titles', content.eyebrows);
    if (content.taglines.length) record('tagline-label', 'REVIEW', P, vpn, '"Place · Tagline" style labels', content.taglines);
  }
  if (!profile.content.allowNumberLabels) {
    record('number-label', content.numbers.length ? 'FAIL' : 'PASS', P, vpn,
      content.numbers.length ? 'Number labels (01 / 02…)' : 'No number labels', content.numbers);
  }
  if (!profile.motion.heroVideoControls) {
    record('video-controls', content.videoControls.length ? 'FAIL' : 'PASS', P, vpn,
      content.videoControls.length ? 'Visible video controls' : 'No visible video controls', content.videoControls);
  }
  if (profile.originalDomain) {
    record('original-site-link', content.originalLinks.length ? 'FAIL' : 'PASS', P, vpn,
      content.originalLinks.length ? `Links to the original site (${profile.originalDomain})` : 'No links to the original site', content.originalLinks);
  }
  record('image-broken', content.broken.length ? 'FAIL' : 'PASS', P, vpn, content.broken.length ? 'Images that failed to load' : 'All images load', content.broken);
  record('image-blurry', content.blurry.length ? 'FAIL' : 'PASS', P, vpn,
    content.blurry.length ? 'Images shown larger than their file (blurry)' : 'Images are sharp at this size', content.blurry);
  if (content.logo) record('logo-raster', 'REVIEW', P, vpn, 'Header logo is a raster image; make sure it is the original file, not a screenshot', [content.logo]);

  // 5. Cursor effects: move the mouse and see what follows it.
  if (!profile.motion.allowCursorEffects) {
    const items = [];
    if (content.cursorNone) items.push('cursor: none on the page (custom cursor)');
    if (content.followers.length) {
      await page.mouse.move(vp.w * 0.3, vp.h * 0.4);
      await page.waitForTimeout(250);
      const a = await page.evaluate(() => window.__qa.followerPositions());
      await page.mouse.move(vp.w * 0.7, vp.h * 0.6);
      await page.waitForTimeout(400);
      const b = await page.evaluate(() => window.__qa.followerPositions());
      a.forEach(p => { const q = b.find(x => x.id === p.id); if (q && (Math.abs(q.x - p.x) > 20 || Math.abs(q.y - p.y) > 20)) items.push(`${p.name} follows the pointer`); });
    }
    record('cursor-effect', items.length ? 'FAIL' : 'PASS', P, vpn, items.length ? 'Cursor effects' : 'No cursor effects', items);
  }

  // 6. Menu landing, side margins and section height (desktop sizes).
  let hashNav = false;
  if (desktop) {
    const links = await page.evaluate(() => window.__qa.navLinks());
    // a page is navigated like a single-page site when its menu has 3+ links to sections on the same page
    hashNav = links.length >= 3;
    const missing = [], landing = [];
    for (const l of links) {
      await toTop(page);
      let clickNote = '';
      try {
        await page.click(`[data-qa-nav="${l.k}"]`, { timeout: 3000 });
      } catch (e) {
        clickNote = ' (a normal click was blocked, likely by an overlay)';
        await page.evaluate(k => document.querySelector(`[data-qa-nav="${k}"]`)?.click(), l.k);
      }
      await page.waitForTimeout(200);
      await settle(page);
      await page.waitForTimeout(300);
      const r = await page.evaluate(h => window.__qa.landing(h), l.hash);
      if (r.missing) { missing.push(`"${l.text}" → ${l.hash} (no element with that id)`); continue; }
      const problems = [];
      const atTop = r.isFirst && r.scrollY <= 1; // the first section can't scroll higher than the page top
      if (Math.abs(r.top - r.offset) > 6 && !(r.isLast && r.atBottom) && !atTop) problems.push(`lands ${r.top - r.offset}px ${r.top > r.offset ? 'low' : 'high'}`);
      if (r.prevShows > 2) problems.push(`previous section shows ${r.prevShows}px`);
      if (r.nextShows > 2 && !(r.isLast && r.atBottom)) problems.push(`next section peeks ${r.nextShows}px`);
      if (clickNote) problems.push(clickNote.trim());
      if (problems.length) {
        landing.push(`"${l.text}" → ${r.name}: ${problems.join(', ')}`);
        await page.screenshot({ path: path.join(shotsDir, `nav-${slug(P)}-${l.hash.slice(1).replace(/[^a-z0-9]+/gi, '-')}-${vpn}.png`) });
      }
    }
    if (links.length) {
      record('nav-anchor-missing', missing.length ? 'FAIL' : 'PASS', P, vpn, missing.length ? 'Menu links to ids that do not exist' : 'All menu anchors exist', missing);
      record('nav-landing', landing.length ? (hashNav ? 'FAIL' : 'REVIEW') : 'PASS', P, vpn,
        landing.length ? 'Menu clicks that do not land on one full section' : `All ${links.length} menu links land on one full section`, landing);
    }

    if (vp.w >= 1280 && vp.w <= 1600) {
      const lefts = S.map(s => s.minLeft).filter(v => v != null).sort((a, b) => a - b);
      if (lefts.length) {
        const p25 = Math.round(lefts[Math.floor(lefts.length * 0.25)]);
        record('side-margin', p25 > L.maxSideMarginPx ? 'FAIL' : 'PASS', P, vpn, `Content starts ${p25}px from the screen edge (max ${L.maxSideMarginPx}px)`);
      }
    }

    const fitMode = L.sectionsFitOneScreen;
    if (fitMode === true || (fitMode === 'single-page' && hashNav)) {
      await toTop(page);
      const hs = await page.evaluate(() => window.__qa.headerState());
      const offset = hs.exists && /(fixed|sticky)/.test(hs.position) ? hs.height : 0;
      // the first section may sit under the header at the page top, so it gets the full screen height
      const allow = s => (s.i === 0 ? vp.h : vp.h - offset);
      const tall = flowS.filter(s => !s.exempt && s.height > allow(s) + 2).map(s => `${s.name}: ${Math.round(s.height)}px tall, screen allows ${allow(s)}px`);
      record('section-too-tall', tall.length ? 'FAIL' : 'PASS', P, vpn,
        tall.length ? 'Sections taller than one screen' : 'Every section fits one screen', tall);
    }
  }

  // 7. Console and network.
  record('console-error', errors.length ? 'FAIL' : thirdParty.length ? 'REVIEW' : 'PASS', P, vpn,
    errors.length ? 'Page errors or failed requests on this site' : thirdParty.length ? 'Console errors or third-party failures' : 'No errors',
    [...errors, ...thirdParty]);

  if (args.full && vp === args.viewportList[0]) {
    await toTop(page);
    await page.screenshot({ path: path.join(shotsDir, `full-${slug(P)}-${vpn}.png`), fullPage: true }).catch(() => {});
  }
  await page.close();
}

async function discover(context, base, max) {
  const page = await context.newPage();
  try { await page.goto(base, { waitUntil: 'networkidle', timeout: 45000 }); }
  catch { await page.goto(base, { waitUntil: 'load', timeout: 45000 }); }
  const origin = new URL(base).origin;
  const hrefs = await page.$$eval('a[href]', as => as.map(a => a.href));
  await page.close();
  const start = new URL(base).pathname.replace(/\/$/, '') || '/';
  const paths = [start];
  for (const h of hrefs) {
    let u;
    try { u = new URL(h); } catch { continue; }
    if (u.origin !== origin || /\.(pdf|jpe?g|png|webp|avif|gif|svg|zip|mp4|mov|docx?|xlsx?)$/i.test(u.pathname) || u.pathname.startsWith('/api/')) continue;
    const p = u.pathname.replace(/\/$/, '') || '/';
    if (!paths.includes(p)) paths.push(p);
    if (paths.length >= max) break;
  }
  return paths;
}

// ---------- report ----------

function writeReport(outDir, meta) {
  const by = s => results.filter(r => r.status === s);
  const fails = by('FAIL'), reviews = by('REVIEW'), passes = by('PASS');
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ meta, summary: { fail: fails.length, review: reviews.length, pass: passes.length }, results }, null, 2));

  const lines = [];
  lines.push(`# A-Eweb QA report`, '');
  lines.push(`- Site: ${meta.url}`);
  lines.push(`- Pages: ${meta.pages.join(', ')}`);
  lines.push(`- Viewports: ${meta.viewports.join(', ')}`);
  lines.push(`- Profile: ${meta.profile || 'defaults'}`);
  lines.push(`- Run: ${meta.date}`, '');
  lines.push(`**FAIL ${fails.length} · REVIEW ${reviews.length} · PASS ${passes.length}**`, '');
  const section = (title, list) => {
    if (!list.length) return;
    lines.push(`## ${title}`, '');
    const checks = [...new Set(list.map(r => r.check))];
    for (const c of checks) {
      lines.push(`### ${c}`, '');
      for (const r of list.filter(x => x.check === c)) {
        lines.push(`- **${r.page} @ ${r.viewport}**: ${r.message}`);
        r.items.forEach(it => lines.push(`  - ${it}`));
        if (r.more) lines.push(`  - …and ${r.more} more`);
      }
      lines.push('');
    }
  };
  section('FAIL', fails);
  section('REVIEW', reviews);
  lines.push('## PASS', '');
  const passChecks = [...new Set(passes.map(r => r.check))];
  passChecks.forEach(c => lines.push(`- ${c}: ${passes.filter(r => r.check === c).length} page × viewport runs`));
  lines.push('', `Screenshots: ${path.join(outDir, 'shots')}`);
  fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n'));
  return { fails, reviews, passes };
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profile = loadProfile(args.profile);
  const { chromium } = loadPlaywright();
  const outDir = path.resolve(args.out);
  const shotsDir = path.join(outDir, 'shots');
  fs.rmSync(shotsDir, { recursive: true, force: true });
  fs.mkdirSync(shotsDir, { recursive: true });

  const browser = await launchBrowser(chromium);
  try {
    const first = args.viewportList[0];
    const discoverCtx = await browser.newContext({ viewport: { width: first.w, height: first.h } });
    const pages = args.pages || await discover(discoverCtx, args.url, args.maxPages);
    await discoverCtx.close();
    console.log(`Checking ${pages.length} page(s) × ${args.viewportList.length} viewport(s): ${pages.join(', ')}`);

    for (const vp of args.viewportList) {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1,
        isMobile: vp.w < 768, hasTouch: vp.w < 768, reducedMotion: 'no-preference',
      });
      for (const p of pages) {
        process.stdout.write(`  ${vp.name} ${p} … `);
        try {
          await checkPage(ctx, args.url, p, vp, profile, args, shotsDir);
          const n = results.filter(r => r.page === p && r.viewport === vp.name && r.status === 'FAIL').length;
          console.log(n ? `${n} FAIL` : 'ok');
        } catch (e) {
          record('script-error', 'FAIL', p, vp.name, `The check could not finish: ${e.message.split('\n')[0]}`);
          console.log('error: ' + e.message.split('\n')[0]);
        }
      }
      await ctx.close();
    }

    const { fails, reviews, passes } = writeReport(outDir, {
      url: args.url, pages, viewports: args.viewportList.map(v => v.name), profile: args.profile, date: new Date().toISOString(),
    });
    console.log('');
    const checks = [...new Set(results.map(r => r.check))];
    for (const c of checks) {
      const f = fails.filter(r => r.check === c).length, rv = reviews.filter(r => r.check === c).length;
      if (f || rv) console.log(`  ${f ? 'FAIL  ' : 'REVIEW'} ${c}: ${f ? f + ' fail' : ''}${f && rv ? ', ' : ''}${rv ? rv + ' review' : ''}`);
    }
    console.log(`\nFAIL ${fails.length} · REVIEW ${reviews.length} · PASS ${passes.length}`);
    console.log(`Report: ${path.join(outDir, 'report.md')}`);
    process.exitCode = fails.length ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(2); });
