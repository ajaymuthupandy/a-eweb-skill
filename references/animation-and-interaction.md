# Animation and interaction

The user wants sites that feel interactive and alive ("use animative elements", "the site has to be more
interactive"). They also removed scroll animations on 13 sites and complained about overlap 116 times,
mostly caused by motion: pinned sections, parallax layers, and elements animated out of their section.

The way to get both: **motion is allowed only inside its own section, and never changes the page layout.**

## Allowed by default
- Hero motion: a slow image zoom, auto-sliding hero images, a background video, a short heading reveal.
- Reveal on entry: fade or rise once when a section enters, finished in ≤ 600ms, with the final layout
  reserved from the start (no layout shift, no blank space before it plays).
- Hover and focus micro-interactions on buttons, cards and images (scale ≤ 1.04, colour, underline-draw).
- Sliders, tabs, accordions, switchers and lightboxes inside a section.
- Kinetic or split-letter headings that stay within their line box.
- Morphing shapes or gentle, slow motion of the site's own motifs, clipped by the section.
- A smooth, eased scroll to anchors.

## Blocked unless the profile allows it
| Blocked | Why (from the history) | Profile key |
|---|---|---|
| Pinned or stacked sections (GSAP `pin`, sticky card stacks, horizontal-scroll pins) | Main cause of "sections overlaying when I scroll down" | `motion.allowPinnedSections` |
| Cursor-following circles, custom cursors, magnetic buttons | "remove the circle while we move pointer", "remove the pointer effects" | `motion.allowCursorEffects` |
| Parallax layers that move content outside its section | Overlap and "image should not overlay" | `motion.allowPinnedSections` |
| Fade-ins and floating layers below the hero (overlays once scrolled) | The Ark: "when the user scrolls down there should not be any overlay", 4+ times | — |
| Perpetual floating or bobbing elements over content | "the design should not overlay… even all the design don't [go] up and down" | — |
| A preloader that hides the site | Feels slow, hides overlap problems | — |
| Small overlay animations on page open | "while opening the site there is a small overlay animation" | — |

`motion.scrollAnimations` takes `"none" | "subtle" | "rich"`:
- **none:** the user removed them (Bali Wellness, The Ark, Luna & Sol, Dedea Ubud).
- **subtle:** the default.
- **rich:** the user asked for scroll-trigger interactivity (Gardens, Tulus Hati, Desa Yogi). Still no pins
  unless allowed.

## Technical rules
- Animate only `transform` and `opacity`. Never animate `height`, `top` or `margin`.
- The section that hosts motion has `position: relative; overflow: clip`.
- GSAP: create triggers in `useGSAP` / `gsap.context()` and revert them on unmount. Call
  `ScrollTrigger.refresh()` after images and fonts load. Never set `pinSpacing: false`.
- Framer Motion: `whileInView` with `viewport={{ once: true, amount: 0.3 }}`. Reserve the final size; don't
  animate layout.
- Respect `prefers-reduced-motion`: disable reveals and parallax, show still images instead of videos.
- Test scrolling down, scrolling back up, resizing, and menu jumps. The check script does the
  scroll-to-bottom and menu passes. Scrolling back up needs a manual look.
- After a smooth-scroll library is added, re-test menu landing. It's the usual reason landing drifts.

## Hero and background video
The user asked 10 times to remove pause/play buttons:

```tsx
<video autoPlay muted loop playsInline preload="metadata" poster="/media/hero-poster.webp"
       disablePictureInPicture disableRemotePlayback aria-hidden="true" tabIndex={-1}
       className="h-full w-full object-cover">
  <source src="/media/hero.mp4" type="video/mp4" />
</video>
```

- No `controls` attribute, no custom pause/play/seek icons, no watermark.
- For reduced-motion visitors, render the poster image instead of the video. That keeps it accessible
  without a visible pause button.
- If the user asks for a delayed start ("play after 1.5 sec"), start it from JS after the delay. Keep the poster until then.
- A video the visitor chooses to watch (a manifesto modal) is different: it gets normal controls and a centred,
  responsive 16:9 frame.
- Compress videos (H.264, ≤ 8 MB for hero loops) and always provide a poster.
