# AI PPTX Generation Kit

A reference implementation of the pipeline used to generate the "AI Agents"
training deck. This is not a polished npm package — it's a starter you adapt
into your own LMS backend. The core idea:

> Don't ask an LLM to output a `.pptx`. Ask it to fill in *content*, run that
> content through a *component library* that handles layout/design, render
> the result to images, and have a model visually QA it before you show it
> to a user.

## Pipeline overview

```
lesson content (from your LMS)
        │
        ▼
 1. OUTLINE PASS (LLM)        → structured JSON: sections, key points,
                                  suggested layout per section
        │
        ▼
 2. CONTENT → COMPONENT MAP    → your code (or a second LLM pass) decides
                                  which reusable layout component fits each
                                  section: card grid / stat callout /
                                  comparison table / process steps / etc.
        │
        ▼
 3. GENERATION (code, not LLM) → build_deck.js turns the JSON spec into a
                                  real .pptx by calling component functions
                                  from lib/components.js
        │
        ▼
 4. STRUCTURAL VALIDATION      → qa/validate_pptx.py — catches corrupt
                                  files, empty placeholders, overset text
                                  boxes before a human ever sees them
        │
        ▼
 5. RENDER TO IMAGES           → qa/render_preview.sh — converts the deck
                                  to slide images via LibreOffice + poppler
        │
        ▼
 6. VISUAL QA (vision LLM)     → feed the rendered images back to a model,
                                  ask it to flag overlap/overflow/contrast
                                  issues, patch the JSON spec, regenerate
        │
        ▼
   final .pptx served to the user
```

The LLM never touches OOXML or binary output directly. It only ever
produces JSON (content + layout choice) and, in the QA step, reads images
and returns structured feedback. Everything that touches the actual file
format is deterministic code you control — which is what makes output
reliable enough to ship from a product.

## Files in this kit

| File | Purpose |
|---|---|
| `DESIGN_RULES.md` | The "skill" document — palettes, typography rules, gotchas, layout patterns. Feed this to your LLM as context during the outline/layout pass so it makes good design decisions instead of generic ones. |
| `lib/theme.js` | Color palettes, fonts, spacing constants. Swap in your product's brand palette here. |
| `lib/components.js` | Reusable slide-building functions: title slide, card grid, stat callout, comparison table, process stepper, icon-row list, closing slide. This is the actual "design system" — build once, reuse forever. |
| `build_deck.js` | Example generator: reads a JSON content spec and calls the right component per slide. This is what your backend would run after the LLM produces the spec. |
| `content_example.json` | A sample spec showing the shape of data your LLM's outline pass should produce. |
| `gen_icons.js` | Renders `react-icons` to on-brand colored PNGs at build time, so every deck gets icons that match its palette with zero licensing/stock-art concerns. |
| `qa/validate_pptx.py` | Basic structural validation using `python-pptx` — file opens, no empty text frames, no shapes positioned off-slide, slide count matches spec. |
| `qa/render_preview.sh` | Converts a `.pptx` to per-slide JPEGs for visual QA (needs LibreOffice + poppler-utils installed on your server/worker). |

## How to wire this into an LMS

1. **Lesson → outline JSON.** When a lesson/module is ready to become a
   deck, call your LLM with the lesson content + `DESIGN_RULES.md` as
   system context, and ask for a JSON array of slides, each tagged with a
   `type` (`title`, `cards`, `stats`, `comparison`, `process`, `list`,
   `closing`) matching the components you've built. Force JSON-mode /
   schema-constrained output so this step can't produce malformed specs.
2. **Validate the spec shape** (cheap, no LLM needed) — required fields
   per component type, item counts within the ranges your layouts support
   (e.g. card grid = 3-6 items, not 11).
3. **Run `build_deck.js`** (or your generalized equivalent) server-side to
   produce the actual file. This step is pure code — fast, deterministic,
   cacheable.
4. **Run structural validation + render to images.**
5. **Visual QA pass**: send the images to a vision-capable model with a
   short checklist (text overflow, overlap, contrast, uneven spacing). If
   it flags something, patch the JSON spec (e.g. shorten a string, drop an
   item) and regenerate just that slide — don't regenerate the whole deck.
6. Serve the validated file to the user, with the JSON spec cached so
   "regenerate slide 4" is a targeted, cheap operation.

## Why this approach over "ask the LLM for a pptx"

- **Determinism.** The same JSON spec always produces the same layout.
  Debugging "why does slide 6 look wrong" means debugging your component
  function, not re-prompting and hoping.
- **Cheap iteration.** Regenerating one slide is a function call, not a
  full LLM generation.
- **Design consistency.** A component library enforces your brand palette,
  spacing, and typography rules structurally — the LLM can't "forget" the
  design system because it never touches layout code, only content.
- **No corrupt files.** LLM-authored OOXML/binary is fragile. Code-authored
  OOXML via a library like `pptxgenjs`/`python-pptx` is not.

## Adapting the palette and icons

Edit `lib/theme.js` to swap the palette, fonts, and spacing to match your
product's brand. Regenerate icons with `node gen_icons.js` after changing
the palette so icon colors stay in sync.

## Dependencies

```bash
npm install pptxgenjs react-icons react react-dom sharp
pip install python-pptx
# system: libreoffice, poppler-utils (for pdftoppm)
```
