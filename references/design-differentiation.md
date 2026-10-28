# Design differentiation

The user rejected designs as "normal", "usual", "common", "AI generated" and "same design in every page".
Almost every A-Eweb client is a Bali wellness, retreat, villa or yoga business, so picking a style by
industry alone gives every site the same look. Variety has to be planned and checked.

Unique doesn't mean random. A style that fights the brand is worse than a repeated one.

## Step 1: Read the client
Write down, from the original site: the business type, the audience, the logo font and colours, the
strongest real photos and videos, and one thing that is specific to this place (a temple view, a surf break,
a silent retreat, a painting studio, a monkey mascot). The design should grow from that specific thing.

## Step 2: Combine three choices from the catalogue
Pick **one from each group** in `design-catalogue.md`:
1. **Visual style.** Sets the look: colour handling, textures, image treatment, type arrangement.
2. **Layout pattern.** Sets how sections are composed: split-screen, magazine grid, collage, full-bleed…
3. **Interaction pattern.** Sets what moves and how: kinetic type, micro-interactions, morphing shapes…

Optionally add one supporting visual style. Never more.

Example: Monastic Minimalism (#103) + Split-Screen (#63) + Kinetic Typography (#59) for a silent retreat.
Wabi-Sabi (#95) + Collage (#45) + Micro-interactions (#71) for a painting studio.

Rules:
- Don't pick items tagged **blocked** unless the user asked for them, or **not-for-hospitality** for client sites.
- Items tagged **caution** need extra QA (overlap, readability).
- Prefer combinations the registry hasn't used for another wellness site. Run `registry.mjs list` to see what's overused.
- The user may name a style ("redesign this using claymorphism"). Then use it and still vary layout and interaction.
- Keep the brand: the chosen style changes composition, imagery and motion, not the client's fonts and colours.

## Step 3: Write the design signature
Save this as `design-proposal.json` in the project (same shape as a registry entry, see `registry/`):

```json
{
  "site": "binginretreat",
  "industry": "wellness-retreat",
  "style": { "primary": "#103 Monastic Minimalism", "supporting": [], "layout": ["#63 Split-Screen Layout"], "interaction": ["#59 Kinetic Typography"] },
  "fonts": ["Raleway"],
  "palette": ["#2f3b2b", "#efe9dd"],
  "hero": "split screen: full-height photo right, kinetic heading left on stone texture",
  "sections": ["split hero", "offset photo pair", "horizontal rooms tabs", "quote over texture band", "map + photo L-shape", "compact footer"],
  "motifs": ["hand-drawn temple roof line from the logo"],
  "components": ["RoomTabs", "KineticHeading"],
  "header": "non-sticky, logo left, menu right",
  "footer": "single line on forest green"
}
```

## Step 4: Check against past sites
```bash
node <skill>/scripts/registry.mjs check design-proposal.json
```
The script scores each past site on shared defining elements (primary style, layout, interaction, hero
description, motifs, components, fonts). If any unrelated site scores at or above the threshold,
change the hero composition, layout pattern or motif and check again. Two sites may share a style label
as long as their hero, section sequence and motifs differ.

## Step 5: Vary inside the site too
- **Every page gets its own composition.** The user said this on Bali Wellness, Yogmantra, Marni, Bingin:
  "y u keeping same design in every page". Inner pages reuse the design language (fonts, colours, buttons,
  motifs) but not the same hero and section layout.
- **Every section on a page is composed differently.** No repeating "heading left, paragraph right" blocks.
  Desa Yogi's set is a good model: cinematic hero, inline-photo manifesto, teacher switcher, letter deck,
  timetable board, collage, price list, bento, accordion, photo + map, arch close.
- Give inner pages a hero that fits their content (the same height system, but different compositions).

## Step 6: Record it
After the user accepts the design (or at deploy time), copy the final signature to `<skill>/registry/<site>.json`.
Commit and push the skill repo so the other two team members' checks know about it.

## Things that already repeat across past sites (avoid as the main idea)
`registry.mjs list` shows the current numbers. At the time of writing:
- Montserrat as the site font: 7 sites.
- Generic `Botanical` leaf decorations: 4 sites, and leaves were removed on 5 others.
- `BaliClock` (local-time widget): 2 sites. Magnetic buttons: 2 sites (both against the cursor-effects rule).
- `PageHero` + `CtaBand` + gallery + footer as the inner-page recipe: most multi-page sites.
