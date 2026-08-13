// build_deck.js — the "generation" step of the pipeline.
//
// Usage:
//   node build_deck.js content_example.json
//
// This is the piece your LMS backend would call after the LLM's outline
// pass has produced a JSON spec (validated against your schema). It
// contains ZERO design decisions — every color/font/spacing choice lives
// in lib/theme.js and lib/components.js. That separation is what lets you
// safely accept LLM-authored content without LLM-authored layout risk.

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const components = require("./lib/components");
const { spacing } = require("./lib/theme");

const specPath = process.argv[2] || "content_example.json";
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // matches spacing.slideW/slideH in theme.js

const opts = { logoMarkPath: spec.meta.logoMarkPath };

const handlers = {
  title: (s) => components.titleSlide(pres, { ...s, logoPath: spec.meta.logoPath }),
  cardGrid: (s) => components.cardGrid(pres, s, opts),
  statCallouts: (s) => components.statCallouts(pres, s, opts),
  comparisonTable: (s) => components.comparisonTable(pres, s, opts),
  processStepper: (s) => components.processStepper(pres, s, opts),
  iconRowList: (s) => components.iconRowList(pres, s, opts),
  closing: (s) => components.closingSlide(pres, { ...s, logoPath: spec.meta.logoPath }),
};

spec.slides.forEach((slideSpec, i) => {
  const handler = handlers[slideSpec.type];
  if (!handler) {
    throw new Error(
      `Unknown slide type "${slideSpec.type}" at index ${i}. ` +
      `Valid types: ${Object.keys(handlers).join(", ")}`
    );
  }
  handler(slideSpec);
});

const outFile = spec.meta.fileName || "deck.pptx";
pres.writeFile({ fileName: outFile }).then(() => {
  console.log(`Wrote ${outFile} (${spec.slides.length} slides)`);
});
