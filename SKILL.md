---
name: a-eweb
description: A-Eweb team workflow for client website redesigns (Next.js rebuilds of existing sites, mostly Bali wellness, retreat, villa and yoga sites) — new redesigns, correction rounds, UI/UX audits saved as HTML, "fix without changing the design" passes, and GitHub + Vercel deploys. Use it whenever the user asks to redesign a site, sends corrections like "fix the overlay", "reduce the gaps", "footer should match the above section", "remove these type of headings", "increase the header menu font size", "navigation is not landing perfectly", asks to "audit this site completely… save it as a html file", says "fix all the issues without changing the design", or asks to "create a repo named <site>-redesign… push it to vercel". Built from 42 projects and 284 sessions of real corrections; its QA gate must pass before any redesign work is reported as done.
---

# A-Eweb: client website redesigns

This skill exists because the same corrections were sent again and again across 42 projects
(Oct 2026). The top three are not matters of taste. They are defects that a check would have caught:

| Correction | Times | Projects |
|---|---|---|
| Sections overlap, especially the last section running into the footer | 116 | 31 |
| Gaps or white space above, below and inside sections | 114 | 38 |
| Last section and footer must fit on one screen when scrolled to the bottom | 90 | 33 |

So the core rule of this skill: **never say "done", "fixed" or hand over a link until the
QA gate in this file has passed.** The user should never be the one who finds an overlap.

`<skill>` below means this skill's folder (normally `~/.claude/skills/a-eweb`).

## 1. Identify the mode

Read the user's message and pick one. Each mode has its own steps in section 3.

| Mode | How the user usually says it |
|---|---|
| **New redesign** | "i need to redesign this site <url> using the same assets… next.js… do not add small headings…" |
| **Corrections** | Short messages, often with screenshots: "fix this overlay", "reduce the gap", "remove this", "still not fixed" |
| **Audit** | "using the vercel agent - audit this site completely… save it as a html file" |
| **Fix-only** | "fix all the issues without changing the design, theme, font style, image placement and alignment" |
| **Deploy** | "now create a repo named <site>-redesign in my git… push it to vercel… deploy it exactly how it is now" |

## 2. Global rules (always on, in every mode)

These come straight from the correction history. A project profile (`a-eweb.profile.json`)
can change the numbers or switch a rule off for one site, but nothing turns off the QA gate.

1. **No overlap.** No section, image, decoration or animated element covers another section at
   any scroll position or viewport. → `references/layout-and-spacing.md`
2. **No unwanted gaps.** Sections sit edge to edge, with one small, consistent padding. No empty
   bands, empty grid cells or dead columns. "A little breathing space" means that padding, not extra gaps.
3. **Last section + footer fit on one screen** when scrolled to the bottom, on every page (desktop and laptop).
4. **A menu click lands on exactly one full section**, with nothing of the neighbouring sections showing.
5. **Short footer.** Header menu font size = footer link size, at least 16px.
6. **Logo font only** across the whole site, and at most 2 brand colours taken from the logo. → `references/brand-and-content.md`
7. **Original assets.** The real logo file (never a screenshot), sharp images in their original quality.
8. **No small headings above section titles**, no "01 / 02" numbering, no "Place · Tagline" labels, no
   AI-sounding one-liners. Keep copy short.
9. **No links to the client's original site** from the logo, language buttons (EN/NL…), pricing or menu items.
10. **Background video**: autoplay, muted, loop, no visible controls (no pause/play/seek). → `references/animation-and-interaction.md`
11. **Motion stays inside its own section.** No pinned or stacked sections, no cursor circles or magnetic effects
    unless the user asks for them.
12. **Every site and every page looks different.** Check the design registry. → `references/design-differentiation.md`
13. **A reference image gives layout only.** Keep the site's own fonts and colours.
14. **"Do not touch the home page"** means exactly that. When the home page is the reference, never edit it.
15. **Small side margins**: gutter ≤ 56px on desktop.
16. **A correction about a pattern applies to the whole site** (headings, gaps, numbers, margins, footer, fonts)
    unless the user scopes it ("only this section", "fix only that").

## 3. Workflow by mode

### New redesign
1. **Study the original site** before designing:
   - Identify the logo font, the brand colours (from the logo) and the real assets. Download the original
     logo file and full-size images; strip WordPress `-300x200` suffixes to get originals.
   - List the content, the navigation, and whether the site is single-page or multi-page.
2. **Create `a-eweb.profile.json`** in the project root from `<skill>/config/project-profile.template.json`.
   Fill in `originalDomain`, the fonts, the colours and `siteType`.
3. **Choose a design direction** with `references/design-differentiation.md`:
   - Pick one visual style + one layout pattern + one interaction pattern from `references/design-catalogue.md`.
   - Write the design signature.
   - Run `node <skill>/scripts/registry.mjs check <proposal.json>` and revise while it reports a close match.
4. **Build** with Next.js App Router, TypeScript and Tailwind (or the project's existing stack). Use the layout
   patterns in `references/layout-and-spacing.md` from the first commit: header offset variable, section frames
   and footer variable. Retrofitting them later is what caused most overlap rounds.
5. **Run the QA gate** (section 4). Fix, then re-run until no FAIL is left.
6. **Hand over**: the local link, a QA summary, open REVIEW items, and where the screenshots are.
7. **Record the design**: add `<skill>/registry/<site>.json`, then commit and push the skill repo (see README).

### Corrections
- Apply the change the user asked for, then apply it everywhere the same issue occurs (rule 16).
- **Re-run the QA gate before replying.** The most common follow-up complaint was a correction that created a
  new overlap or gap somewhere else.
- When the user repeats themselves ("still", "again", "i said", "nothing has changed"):
  - Stop nudging margins.
  - Find the root cause in the code: computed position, transforms, pinned triggers, fixed heights, negative
    margins, z-index (checklist in `references/layout-and-spacing.md`).
  - Reproduce the exact state they describe (usually scrolled to the bottom, or just after a menu click) and
    look at a screenshot of it before claiming it's fixed.
- If a correction changes a standing preference (sticky header, more text, breathing space), update the
  profile so later rounds keep it. If it looks like a rule for every site, say so and offer to add it to this skill.

### Audit
1. Run `check-site.mjs` on every page at all viewports.
2. Do the manual review list in `references/qa-protocol.md`. Use the agent-browser skill for console errors,
   flows and screenshots.
3. Write the HTML report in the structure given in `references/qa-protocol.md`, including the storage and
   image-weight section (Vercel storage was a real problem: 804 MB, 2.48 GB, 6 GB).

### Fix-only
- **Frozen:** design, theme colours, fonts, image choice, image placement and alignment, section order.
- **Fix freely:** overlaps, broken layouts, gaps that can be closed without changing the look, broken links,
  accessibility, SEO, performance, image weight.
- **Ask first:** anything that would visibly change the design goes into a "Needs your decision" list with a
  concrete suggestion. Don't apply it.
- Take before and after screenshots at the same viewports. Revert any visual difference that isn't a fixed defect.

### Deploy
Follow `references/deploy.md`. In short: optimise images, confirm the repo name, commit as Ajay, create a
**private** `ajaymuthupandy/<site>-redesign`, connect Vercel under the same name, then prove the live site
matches local by running `check-site.mjs` on both.

## 4. QA gate (required before "done", "fixed", or any link)

```bash
node "<skill>/scripts/check-site.mjs" http://localhost:<port> --profile a-eweb.profile.json
```

- The script visits each page at 1440×900, 1280×720 and 390×844. It measures overlap, gaps, footer fit,
  menu landing, margins, fonts, colours, small headings, number labels, video controls, links to the
  original site, blurry images, cursor effects and hidden content.
- It writes `qa/report.md`, `qa/report.json` and screenshots into the project's `qa/` folder (add `qa/` to `.gitignore`).
- **Exit code 1 means at least one FAIL.** Fix it and re-run. Never report done with a FAIL open. If one
  can't be fixed, name the check and the reason in your reply.
- **Look at the screenshots yourself** (Read the PNGs), especially the `bottom-*` ones (last section + footer)
  and any `nav-*` ones. The script measures; your eyes catch what it can't.
- **REVIEW** items need a judgement call. Decide each one, and mention any you leave open.
- Then do the manual checks in `references/qa-protocol.md`: elements suit the theme, nothing looks
  AI-generated, no design repeated from the registry, image placement looks right.

Your reply after a QA run states: the pages and viewports checked, 0 FAIL (or which ones remain and why),
the REVIEW items, and anything that wasn't checked.

## 5. Files

| File | Use it for |
|---|---|
| `references/layout-and-spacing.md` | Default sizes, section frames, footer fit, menu landing, overlap and gap causes, images |
| `references/brand-and-content.md` | Fonts, colours, assets, copy, banned headings, the "looks AI-generated" list, links |
| `references/animation-and-interaction.md` | Allowed and blocked motion, technical rules, hero video |
| `references/design-differentiation.md` | Choosing a direction, design signature, registry check, per-page variety |
| `references/design-catalogue.md` | The team's 120 styles, sorted into style / layout / interaction, with duplicates and blocked items |
| `references/qa-protocol.md` | What the script checks, manual review list, audit report format |
| `references/deploy.md` | Repo, git author, image optimisation, Vercel, "deploy exactly as it is" |
| `config/project-profile.template.json` | Per-site settings and overrides |
| `registry/*.json` | One file per past site: style, fonts, hero, motifs, components |
| `scripts/check-site.mjs` | The QA gate |
| `scripts/registry.mjs` | `list` repeated fonts and motifs; `check` a proposal against past sites |
| `scripts/correction-stats.mjs` | Counts repeated corrections in Claude Code history, to show whether the skill is working |
