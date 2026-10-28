# Brand and content

## Fonts
- **The logo's font across the whole site**: headings, body, menu, buttons, footer. Asked for 22 times on 14 sites.
  - Identify it from the original site's CSS and font files first. If the logo is an image, match the
    letterforms (stroke contrast, serifs, proportions) to the closest Google font and say which one you chose.
  - If the logo font is unreadable at paragraph size (script fonts, very thin display fonts), use it for
    headings and tell the user which body font you paired it with. Never more than 2 families
    (`fonts.maxFamilies`, default 1).
- Same font for header and footer. Header menu size = footer link size.
- When the user says "do not change the font", any reference image or new design keeps the current fonts.
- Fonts that got called "AI generated" in this team's history: **Cormorant + Lato**, letter-spaced uppercase
  buttons and menus, mixed display fonts per section. Use sentence-case buttons and menus.

## Colours
- Take at most 2 brand colours from the logo, plus neutrals (`colours.maxBrandColours`).
- "Use the logo colour as the secondary colour." "Don't use pink in the header and footer" (when pink isn't the brand).
- Same background system on every page. No new palette unless the user asks for one.
- No coloured underlines under text (Gaia Oasis: "remove the orange underline").
- Text must stay readable on its background ("the font is not visible clearly"). Check contrast on photos.

## Assets
- Reuse the client's real logo, photos, videos and icons. Download originals, not thumbnails.
- No stock photos, no invented logos, no screenshot logos.
- Keep content accurate: names, prices, addresses, phone numbers, booking links. Flag conflicts you find
  (two tax rates, missing prices) instead of guessing.

## Copy
- Short by default: a heading, 1–2 sentences, maybe a few bullets. "Do not add large paragraphs, just add
  what is important." "Crisp content."
- Exception per site: Senetan later asked for more text. Record exceptions in the profile (`content.copy`).
- When a page is "full of images", add short real content from the original site, not filler.
- Text inside the hero: one heading, one line, one or two buttons. The user often removed the rest.

## Banned on every site (unless the profile allows it)
| Banned | Real examples the user removed |
|---|---|
| Small headings or labels above section titles | "Our Story", "The retreat", "Our promise", "OUR BALI STUDIO" |
| "Place · Tagline" labels | "Penatahan, Tabanan, Bali", "Female-only wellness hostel · Ubud, Bali", "Bikram Yoga · Nusa Lembongan", "Next retreat · 6 – 12 Dec 2026", "At Gayatri in Ubud, Bali" |
| Number labels and counters | "01 / 02 / 03", "04 / 04", "26+2", "8 stories", big decorative numbers in the footer |
| Stat strips as decoration | "26 postures · 2 breathing exercises" |
| AI-sounding one-liners | "Close your eyes and feel it", "Where wisdom, love & joy reside", "The original and only" |
| Generic leaves and botanical clip-art | Removed on Gardens, Melani Koch, Tulus Hati, Tunjung, As I Am Ubud |
| Lines and strokes added for decoration | Lines under hero buttons, corner lines in the header, wavy header edge |
| Floating "scroll" buttons, pointer circles | Spacious Yoga, Island Garden Huts, Tulus Hati |

## Decorative elements ("use elements to fill the gaps")
The user asked for elements in 25 projects, and also removed many of them. Elements that survived had all of these:
- They come from the site itself: shapes from the logo, the site's own illustrations, a motif from its photos
  (yellow flower + green leaf on As I Am Ubud, plants and vases on The Ark).
- They sit in genuinely empty space. Never behind or on top of text or photos.
- They're static or move very gently, and stay inside their section.
- They're a different motif from the last sites built (check the registry; generic `Botanical` corner leaves
  appear on 4 past sites already).

## Links
- The logo, every menu item, and the language buttons (EN / NL / DE) stay inside the redesign. Disable
  language switches and pricing links that would send visitors to the original site.
- Booking widgets and WhatsApp links may stay external. Point them at the real booking or WhatsApp target.
- Every internal link and anchor must resolve.

## Reference images and the home page
- When the user sends a design image ("use this design in the hero"): copy the layout, composition and
  element placement. Keep the site's fonts, colours and assets. "Take only the design reference."
- "Do not touch the home page" / "the home page is just for reference": never edit home. Build the other
  pages to match its quality and footer fit, with their own designs and their own content.
