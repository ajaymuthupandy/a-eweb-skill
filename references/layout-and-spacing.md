# Layout and spacing

Most correction rounds were about this file's topics: overlap (116 times), gaps (114), the last
section and footer (90), footer height (37), menu landing (32), side margins (21). Build the
patterns below in from the start. Don't retrofit them after the user complains.

## Default sizes

Use these unless the project profile says otherwise. The check script uses the same numbers.

```css
:root {
  --header-h: 72px;          /* the real header height, measured */
  --header-offset: 0px;      /* = var(--header-h) when the header is sticky or fixed, else 0 */
  --gutter: clamp(16px, 4vw, 56px);   /* side margin; never wider than 56px on desktop */
  --max: 1440px;             /* content max width */
  --section-y: clamp(32px, 4vw, 64px);/* vertical padding, same on every section */
  --gap: clamp(12px, 1.6vw, 24px);    /* inside grids and between columns */
  --nav-size: 17px;          /* header menu AND footer links, same value */
  --footer-h: 300px;         /* real footer height on desktop; keep ≤ 40% of a 900px screen */
}
```

| Rule | Default | Profile key |
|---|---|---|
| Side margin at 1440px wide | ≤ 64px | `layout.maxSideMarginPx` |
| Space between a section edge and its content | ≤ 96px desktop, ≤ 64px phone | `layout.maxSectionPaddingPx` |
| Footer height | ≤ 40% of screen height | `layout.maxFooterVh` |
| Header menu size | ≥ 16px and equal to footer link size | `header.navMinPx` |
| Last section + footer on one screen | on | `layout.footerFitsWithLastSection` |
| Every section fits one screen | on for single-page sites | `layout.sectionsFitOneScreen` |

## Sections: edge to edge, one padding

- Sections touch each other: no margin between them, no spacer divs, no `mt-*` on a section.
- Every section uses the same `padding-block: var(--section-y)`. When sections need telling apart,
  alternate background tones (cream / ivory / sand / forest). Don't add space.
- A section's content fills its width. No empty grid cells, no short last row (fill it with a CTA
  tile, a photo or a fact), no tall image beside a short text column (add a checklist, fact chips,
  a second photo or a CTA to the text side).
- Never fix a gap by setting everything to 0. Use the one padding value.

### Where gaps come from (check these in the code)
- `min-height` / `h-screen` on a section with little content → content floats in the middle with empty bands.
  Fix: make the image bigger, add content, or drop the min-height.
- Big Tailwind paddings (`py-24`, `py-32`, `pt-40`) left over from templates.
- Margin collapse: `margin-top` on a section's first child pushes the whole section down.
- Reveal animations starting at `translateY(40px)` or `opacity:0` that never fire, leaving blank space.
- Images with a fixed aspect ratio inside a taller grid cell.
- An empty wrapper or a hidden element that still takes up space.

## Single-screen sections ("only that section should be visible")

On single-page sites (and wherever the profile asks for it), each section is exactly one screen tall
on desktop and laptop, and its content must fit inside:

```css
.frame {
  min-height: calc(100svh - var(--header-offset));
  display: grid;
  align-content: center;
}
@media (min-width: 1024px) and (min-height: 640px) {
  .frame { height: calc(100svh - var(--header-offset)); overflow: clip; }
}
```

- When content is taller than the frame, shrink the images or the copy. Don't let it spill: spilled
  content covers the next section.
- Size images inside a frame with `height: 100%` / `min-height: 0` grid cells and `object-fit: cover`,
  not a fixed pixel height.
- On phones, sections may be taller than the screen. Overlap and overflow rules still apply.

## Last section + footer on one screen

When the user scrolls to the very bottom, they should see only the last section and the footer,
lined up, with nothing overlapping. Do it with CSS:

```css
footer { height: var(--footer-h); }                  /* fixed, short */
main > section:last-child {
  height: calc(100svh - var(--header-offset) - var(--footer-h));
  overflow: clip;
}
```

- At the bottom of the page, the last section then starts exactly at the top of the screen (or just
  under a sticky header), and the footer ends exactly at the bottom.
- If the footer height has to vary (it wraps at some widths), a small ResizeObserver can write the
  real height into `--footer-h`. Several past projects had a `FooterHeight` component doing this;
  reuse that idea instead of hand-tuning.
- Keep the last section's content small enough to fit. Reduce the image height first; that was the
  user's own suggestion in most rounds.
- On every page, not just home. "Like the home page, for all the pages" came up again and again.
- **Never** use a "reveal" footer (fixed footer under the page) or a negative `margin-top` on the footer.

### Footer
- Compact: logo, 3–4 short link groups or a single line, contact, copyright. Height ≤ 40% of screen.
- Same font as the header. Footer link size = header menu size (`--nav-size`).
- Footer content lines up with the header logo's left edge ("it should be straight").
- Copyright small. No duplicate WhatsApp icon in the footer, no partition lines unless the design needs them.
- Decorative art behind the footer is fine when it's faint, static, from the site's own motifs and never behind text.

## Menu click lands on one full section

```css
html { scroll-padding-top: var(--header-offset); }
section[id] { scroll-margin-top: var(--header-offset); }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
```

- After a click, the target's top sits at the header's bottom (or the top of the screen when the header
  isn't sticky). The previous section must not show above it, and the next must not peek in below.
- With Lenis or a similar smooth-scroll library, intercept anchor clicks and call
  `lenis.scrollTo(target, { offset: -headerOffset })`. Native anchor jumps fight the library and land wrong.
- The mobile menu closes on click, then scrolls. It must not block clicks after closing (an invisible
  overlay left over the page caused "menu buttons not working sometimes").
- Every menu link must point to an id that exists.
- The header logo links to the redesign's home page, never the original site.

## Header
- Header menu text ≥ 16px, same font and size as footer links. The user asked to "increase the header
  menu font size" on 16 sites.
- Logo: the original file at 2× resolution, sized so it visually matches the menu. Never a screenshot crop.
- Sticky behaviour comes from the profile: `non-sticky` (default: The Ark, Himalayan Babaji, Bali Silent),
  `sticky`, or `reveal-on-scroll-up` (Melani Koch).
- Logo and hamburger don't move or jitter on scroll. Nothing heavy sits on the right side alone
  ("it feels heavy on the right side of the header").
- No decorative lines, waves or corner strokes in the header unless they come from the brand.

## Overlap: causes to check first
When anything covers anything else, look for these in order:
1. `position: absolute/fixed` decorations whose section lacks `position: relative; overflow: clip`.
2. Pinned scroll sections (GSAP `pin: true`, `pinSpacing: false`), sticky stacking cards,
   `position: sticky` sections.
3. Negative margins (`-mt-24` hero overlap cards, pulled-up images).
4. `transform: translateY` from parallax or scroll animations moving content outside its section.
5. Fixed `height` on a section whose content is taller (content spills into the next one).
6. `100vh` on mobile (address bar) → use `svh`.
7. `z-index` used to "win" over a neighbour instead of fixing the flow.
8. Footer with a negative margin, or a fixed reveal footer.

Fix the cause, not the symptom. Adding `z-index` or `margin-top` until it looks right is what led to
"still overlaying" rounds.

## Images
- Original assets first, at the best resolution available on the client's site. If an image is blurry,
  look for a bigger version; otherwise flag it. Use AI-generated images only when the profile
  allows it (`images.allowGeneratedImages`): Matra Bali asked for them, other briefs banned them.
- Every image belongs to one section and stays inside it. Decorative images are clipped by their section.
- Use `next/image` with correct `sizes`, `object-fit: cover` and a deliberate `object-position`
  (no cut-off heads, no cropped text inside images).
- Images with text baked in (common on these sites) are kept, never cropped through the text.
- No white wash or tinted overlay on photos unless asked ("the image has been white shaded").
- No 01/02 numbers or captions on images.
- "Don't crop, use the full image" means show the full picture: pick a layout that fits its ratio.

## Mobile (390×844)
- No sideways scrolling, nothing overlapping, tap targets ≥ 44px.
- Sections may grow taller than the screen; gaps and padding scale down (≤ 64px).
- Mobile-only changes the user asks for ("only in mobile responsive") must not change desktop.
