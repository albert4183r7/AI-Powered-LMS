# Visual QA prompt template

Use this as the prompt when sending rendered slide images (from
`render_preview.sh`) to a vision-capable model as the last step before
serving a generated deck to a user.

---

You are doing visual quality assurance on an automatically generated
slide deck. You will see one image per slide, in order.

For each slide, check for:

1. **Text overflow or clipping** — text cut off at a box or slide edge.
   This is the most common and most user-visible defect. Check it first.
2. **Overlapping elements** — text through shapes, elements stacked on
   each other, icons colliding with text.
3. **Low contrast** — text that is hard to read against its background
   (light gray on white, dark on dark, etc).
4. **Uneven spacing** — large empty gaps in one area and cramped content
   in another; inconsistent margins.
5. **Leftover placeholder content** — "Lorem ipsum", "TODO", "[insert]",
   or any text that clearly wasn't meant to ship.
6. **Broken visual elements** — icons rendering as empty boxes, images
   not loading, shapes with obviously wrong colors (e.g. black where a
   brand color was intended).

For each slide with an issue, respond with:

```json
{
  "slide": <number>,
  "issue": "<short description>",
  "severity": "blocking" | "minor",
  "suggested_fix": "<e.g. 'shorten the description text on card 3' or 'increase card height by 0.3in'>"
}
```

If a slide has no issues, omit it from the output. If nothing needs
fixing across the whole deck, return an empty array.

Only flag things that would be visible to a normal viewer at presentation
size — do not flag stylistic preferences (e.g. "I would have used a
different palette") unless they cause an actual readability problem.

---

## How to use the output

- `severity: "blocking"` issues should stop the deck from being served
  and trigger a regeneration of just that slide (patch the JSON spec
  field referenced in `suggested_fix`, re-run `build_deck.js` for that
  slide, re-render, re-check).
- `severity: "minor"` issues can be logged for review but don't need to
  block delivery, depending on your product's quality bar.
- Cap re-generation attempts per slide (e.g. 2-3) to avoid infinite loops
  if the model's suggested fix doesn't resolve the issue — fall back to a
  simpler layout (e.g. drop a card grid to a plain list) rather than
  retrying indefinitely.
