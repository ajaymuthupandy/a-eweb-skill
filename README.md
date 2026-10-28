# A-Eweb skill

A Claude Code skill for the A-Eweb team's client website redesigns. It holds the rules, workflow
and checks distilled from 42 projects and 284 Claude Code sessions (Oct 2026), so Claude stops
repeating the corrections the team kept sending: sections overlapping, unwanted gaps, the last
section and footer not fitting, menu clicks landing wrong, small headings, number labels, and
designs that repeat across sites.

## Install (each team member, once)

Claude Code's memory and skills live on each computer, so every laptop needs this repo.

```bash
git clone https://github.com/ajaymuthupandy/a-eweb-skill.git ~/.claude/skills/a-eweb
```

On Windows (PowerShell):

```powershell
git clone https://github.com/ajaymuthupandy/a-eweb-skill.git "$env:USERPROFILE\.claude\skills\a-eweb"
```

Then make sure Node 18+ and Playwright are available for the QA script:

```bash
npm i -g playwright
npx playwright install chromium
```

(If Playwright is installed but its browser build is missing, the script falls back to installed
Chrome or any Chromium Playwright downloaded before.)

Restart Claude Code. The skill loads automatically for redesign work, or call it with `/a-eweb`.

## Keep it in sync

- **Before starting work:** `git -C ~/.claude/skills/a-eweb pull`
- **After finishing a site:** Claude adds `registry/<site>.json`. Commit and push it so the other two
  laptops' "don't repeat designs" check knows about it:
  ```bash
  cd ~/.claude/skills/a-eweb
  git add registry && git commit -m "registry: <site>" && git push
  ```
- One file per site means two people adding different sites never conflict.
- Changing a rule (for example a new standing preference from the manager)? Edit the relevant file
  in `references/`, commit, push, and tell the others to pull.

## What's inside

| Path | What it is |
|---|---|
| `SKILL.md` | The workflow Claude follows: modes, global rules, the QA gate |
| `references/` | Layout and spacing, brand and content, animation, design differentiation, the 120-style catalogue, QA protocol, deploy |
| `config/project-profile.template.json` | Per-site settings; Claude copies it into each project as `a-eweb.profile.json` |
| `registry/` | One JSON file per past site: style, fonts, hero, motifs, components |
| `scripts/check-site.mjs` | The QA gate: measures overlap, gaps, footer fit, menu landing, fonts, labels and more |
| `scripts/registry.mjs` | `list` what repeats across past sites; `check` a new design against them |
| `scripts/correction-stats.mjs` | Counts repeated corrections in Claude Code history, before and after a date |

## Is it working?

Run this every couple of weeks on each laptop (each laptop has its own history):

```bash
node ~/.claude/skills/a-eweb/scripts/correction-stats.mjs --since 2026-10-29
```

It shows each correction type per 100 typed messages, before and after the skill was installed.
Baseline at install (895 messages, 42 projects): overlap 12.7, gaps 11.4, last section + footer 9.7,
fill gaps with elements 4.6, footer too tall 4.0, "still / again" 3.4.

## Registry entries to complete

29 of the 40 seeded entries only have fonts and components from a code scan. When someone next opens one
of those projects, ask Claude to fill in its style, hero, sections and motifs. `node scripts/registry.mjs list`
prints the list.
