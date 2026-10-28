# QA protocol

## Running the check

1. Start the site. Prefer a production build: `npm run build && npm run start -- -p 3100`.
   Dev mode works too; the script ignores the Next.js dev badge.
2. Run, from the project root:
   ```bash
   node "<skill>/scripts/check-site.mjs" http://localhost:3100 --profile a-eweb.profile.json
   ```
   Options:
   - `--pages /,/about,/rooms` limits the run to those pages. By default it follows the site's own links, up to 20 pages.
   - `--viewports 1440x900,390x844` changes the screen sizes.
   - `--out qa` sets the output folder.
3. Read `qa/report.md`, then look at the screenshots in `qa/shots/`, at least every `bottom-*` image.
4. Fix every FAIL and run again. Repeat until the summary says `FAIL 0`.

The script needs Playwright. It looks for it in the project, then in the global npm folder
(`npm i -g playwright` or `npm i -g @playwright/cli`), then needs `npx playwright install chromium` once.

## What the script checks

| Check id | What it measures | Fails when | Profile key |
|---|---|---|---|
| `overflow-x` | Page wider than the screen | Any sideways scroll | — |
| `section-overlap` | Sections overlapping in the page flow | One section's box runs into the next by > 2px | — |
| `covered` | What is actually on top at sample points in each section and the footer, at the bottom of the page | A point in section A shows an element from section B (or a stray layer) | — |
| `section-gap` | Space between consecutive sections | > 2px of bare background between them | — |
| `inner-padding` | Distance from section edge to its first and last content | Over `maxSectionPaddingPx` (scaled down on phones) | `layout.maxSectionPaddingPx` |
| `uneven-padding` | Spread of section paddings on a page | Range > 48px (REVIEW) | — |
| `sparse-section` | How much of a section is covered by text, images and backgrounds | < 30% covered (REVIEW) | — |
| `escapes-section` | Images, video, SVG and absolutely positioned elements reaching outside their section | Spills > 4px and the section doesn't clip it | — |
| `pinned-section` | GSAP pin spacers and `position: sticky` sections | Any, unless allowed | `motion.allowPinnedSections` |
| `section-too-tall` | Section height vs one screen (the first section may use the full screen under the header) | Taller than the screen on desktop sizes, on pages whose menu has 3+ same-page anchors | `layout.sectionsFitOneScreen` |
| `content-overflow` | Content taller than a fixed-height section | It spills or gets cut off | — |
| `footer-height` | Footer height vs screen height | Over `maxFooterVh` | `layout.maxFooterVh` |
| `footer-fit` | At the bottom of the page: is the whole last section on screen together with the footer? | Last section starts above the screen top (or under a sticky header) | `layout.footerFitsWithLastSection` |
| `nav-anchor-missing` | Menu links to `#ids` that don't exist | Any | — |
| `nav-landing` | After clicking each menu anchor: target top vs header, neighbours peeking, click blocked by an overlay | Off by > 6px, or a neighbour visible (REVIEW on pages with fewer than 3 same-page anchors) | — |
| `side-margin` | Left edge of content at 1440px wide | Over `maxSideMarginPx` | `layout.maxSideMarginPx` |
| `nav-font` | Header menu size vs footer link size | Different by > 1px, or header < `navMinPx` | `header.navMinPx` |
| `header-behaviour` | Header position vs profile | Sticky when the profile says non-sticky, or the reverse (REVIEW when no profile is given) | `header.behaviour` |
| `font-families` | Distinct font families in visible text | More than `fonts.maxFamilies` | `fonts.maxFamilies` |
| `brand-colours` | Distinct non-neutral colour hues used | More than `colours.maxBrandColours` + 1 (REVIEW) | `colours.maxBrandColours` |
| `eyebrow` | Small, uppercase or letter-spaced text right above a heading | Any, unless allowed | `content.allowEyebrows` |
| `tagline-label` | Short text with " · " separators | Any (REVIEW) | `content.allowEyebrows` |
| `number-label` | "01", "02 /", "04 / 04" style labels | Any, unless allowed | `content.allowNumberLabels` |
| `video-controls` | `<video controls>` or visible pause/play buttons | Any, unless allowed | `motion.heroVideoControls` |
| `original-site-link` | Links to the client's original domain | Any | `originalDomain` |
| `image-broken` | Images that failed to load | Any | — |
| `image-blurry` | Image shown larger than its real pixel size (×0.8) | Any image wider than 200px on screen | — |
| `logo-raster` | Header logo is a small JPG/PNG | REVIEW | — |
| `cursor-effect` | Custom cursor or small fixed elements following the pointer | Any, unless allowed | `motion.allowCursorEffects` |
| `hidden-content` | Text or images still invisible after scrolling past them | Any (reveal animation never fired) | — |
| `console-error` | Page errors, failed requests, 4xx/5xx, console errors | Any page error or failure on the site itself (third-party and console-only errors: REVIEW) | — |

Checks that need a desktop size (footer fit, menu landing, side margin, section height) run only at
widths ≥ 1024px. Overlap, gaps, overflow and content checks run at every size.

## Manual review (the script can't judge these)

After a clean run, look at the screenshots and the page and answer each with yes/no:

1. Do the decorative elements come from the site's own motifs, sit in empty space, and stay off text and photos?
2. Does anything read as AI-generated? Use the list in `brand-and-content.md`: tagline labels, poetic one-liners,
   uppercase spaced buttons, generic leaves, big numbers, gradient blobs.
3. Does each page have its own composition? Does any section repeat the previous section's layout?
4. Does the design differ from the registry entries for similar businesses?
5. Is image placement deliberate: no awkward crops, no heads cut off, no text inside images cut through, ratios respected?
6. Does it look premium and neat: aligned to one edge, consistent padding, nothing "clumsy"?
7. Scroll back up from the footer: does anything jump, flicker or overlap on the way up?
8. On the phone size: does the menu open, close and land correctly; do the logo and hamburger stay put?

## Audit report (Audit mode)

Save as `audit/<site>-audit.html`, a single self-contained HTML file. Structure:

1. **Summary**: overall verdict, counts by severity (Critical / High / Medium / Low), pages and viewports checked.
2. **Top issues**: the 5–10 that matter most, each with a screenshot, page, viewport, what's wrong, why it
   matters, and the fix.
3. **By category**: alignment, spacing and gaps, overlap, footer fit, navigation, typography, colour,
   images (quality, crop, placement), "looks AI-generated", design repetition, mobile, accessibility,
   performance, broken links and console errors.
4. **Storage and optimisation**: size of `public/`, the largest files, images that should be WebP/AVIF or resized,
   videos to compress, files that shouldn't be in git. Give the estimated size before and after.
5. **What wasn't checked**, and why.

Every issue lists a page, a viewport and evidence (a screenshot or measured value). Don't report issues you
haven't seen. The follow-up request is always "fix all the issues without changing the design…", so mark which
fixes would change the design.

## Reply after a QA run

Keep it short:
- Checked: N pages × 3 viewports.
- FAIL: 0 (or the check ids still failing, and why).
- REVIEW items you decided, and any left open.
- Manual review answers that were "no", with what you did about them.
- Local or live link.
