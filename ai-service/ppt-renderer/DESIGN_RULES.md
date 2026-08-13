# Design Rules for AI-Generated Decks

Feed this document to your LLM as system context whenever it's making
content or layout decisions (the outline/layout pass in the pipeline). The
goal is to remove every open design decision the model would otherwise
default on generically — palette, font sizes, spacing, which layout to use.
Specificity here is what prevents "generic AI slide" output.

## 1. Palette rules

- Pick ONE palette per deck, chosen for the topic — never default to blue.
- A palette = primary (60-70% of visual weight) + secondary + one accent.
  Never give three colors equal weight.
- Suggested starting palettes (primary / secondary / accent):

| Name | Primary | Secondary | Accent |
|---|---|---|---|
| Midnight Executive | `1E2761` | `CADCFC` | `FFFFFF` |
| Forest & Moss | `2C5F2D` | `97BC62` | `F5F5F5` |
| Coral Energy | `F96167` | `F9E795` | `2F3C7E` |
| Ocean Gradient | `065A82` | `1C7293` | `21295C` |
| Charcoal Minimal | `36454F` | `F2F2F2` | `212121` |
| Teal Trust | `028090` | `00A896` | `02C39A` |

- Never default to cream/beige backgrounds (`F5F5DC`, `FAF0E6`, `FFF8E1`).
  Use pure white or the brand's own neutral.
- Dark backgrounds for title/closing slides, light for content slides
  ("sandwich" structure) — or commit to dark throughout for a premium feel.
  Don't mix randomly.

## 2. Typography

- Title: 30-44pt bold. Section header: 18-24pt bold. Body: 12-16pt.
  Captions: 10-12pt, muted color.
- Pair a header font with personality (a serif like Cambria) with a plain
  body font (Calibri/Arial) — contrast without sacrificing legibility.
- Only use fonts you've confirmed render true-to-width in your rendering
  pipeline (whatever converts to images for QA). Fonts that substitute
  differently between authoring and QA rendering will show false
  overflow/fit in your QA step — either avoid them for body text, or size
  their containers with ~10% slack and don't trust QA fit checks on them.
- Left-align body text and lists. Only titles get centered.

## 3. Layout patterns (map content shape → component)

| Content shape | Component |
|---|---|
| 3-4 conceptual categories to contrast | Card grid |
| A handful of KPIs or numbers | Stat callouts (big number + label) |
| Two things being compared feature-by-feature | Comparison table |
| A sequence with a clear order | Process stepper (numbered, connected) |
| A list of 5+ short items | Icon-row list (zebra striped) |
| One big idea needing emphasis | Full-bleed statement slide |

Never use "title + bullet list" as the default. Every slide should have at
least one non-text visual element: icon, shape, chart, or a structured
layout (grid/table/stepper) instead of a plain paragraph or bullet stack.

## 4. Spacing & composition

- 0.5" minimum margin from slide edges.
- 0.3-0.5" gaps between content blocks — pick one and stay consistent
  within a deck.
- Leave breathing room. A slide that's 60% full with generous whitespace
  reads as more premium than one packed edge-to-edge.
- Vary layout slide-to-slide. Two consecutive slides using the identical
  grid/column structure reads as templated.

## 5. Explicit "never do this" list

These are the most common tells of low-effort AI-generated slides — avoid
all of them:

- No accent stripes, color bars, or single-side borders on cards/headers.
- No underline/accent-line under titles — use whitespace or a background
  color shift instead.
- No centered body paragraphs.
- No text-only slides — every slide needs a visual element.
- No low-contrast text (light gray on white, dark on dark).
- Don't let text overflow its container — shorten copy, split the slide,
  or enlarge the box. Never ship clipped text.
- Don't leave large uneven gaps (packed in one area, empty in another).

## 6. Icon and imagery guidance

- Prefer generated/vector icons in a single consistent style over stock
  photography — mixing icon styles or photo-realism with flat icons reads
  as inconsistent.
- Icons should sit inside a colored circle/rounded-square badge using the
  deck's accent or primary color, not floating bare on the slide.
- Keep icon sizing consistent across a slide (same bounding box) even if
  the icons themselves have different visual weight.

## 7. Footer / branding conventions

- Page number: bottom-right, small, muted color.
- Brand/logo mark: bottom-left, small, consistent across all content
  slides. Full logo (wordmark) reserved for title and closing slides only
  — footer uses just the icon/mark to stay unobtrusive.
- If your logo file has a baked-in white background, strip it to
  transparent before using it on any dark-background slide, or it will
  render as a visible white box.

## 8. Library implementation notes (pptxgenjs-specific)

If your generation library is `pptxgenjs`, these are known footguns worth
codifying so your LLM/codegen doesn't rediscover them by producing broken
files:

- Set the slide layout (widescreen vs. 4:3) before adding any slides —
  changing it after adds slides at the wrong canvas size.
- Hex colors: no `#` prefix, no 8-digit (alpha-in-hex) values — both
  corrupt the file. Use a separate transparency/opacity option instead.
- Shadow offsets must be non-negative; to cast a shadow in a different
  direction, change the angle, not the sign of the offset.
- Don't reuse one JS options object across multiple `add*` calls if the
  library mutates it in place — build a fresh object per call.
- Bullet lists: use the library's `bullet: true` option, never a literal
  bullet character in the string (renders as a double bullet).
- Validate every generated file (see `qa/validate_pptx.py`) before
  rendering — catching a malformed chart or shape at generation time is
  far cheaper than debugging a file PowerPoint refuses to open.
