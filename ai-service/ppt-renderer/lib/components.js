// components.js — the actual "design system." Each function takes a
// pptxgenjs slide + a content object and draws one layout pattern.
// build_deck.js maps JSON spec entries to these functions by `type`.
//
// Keep ALL positioning/color/font decisions in here. Your LLM-produced
// JSON spec should only ever contain content strings and a `type` tag —
// never coordinates, colors, or font sizes. That separation is what keeps
// output visually consistent no matter what the model writes.

const theme = require("./theme");
const { colors, fonts, type, spacing } = theme;

function bg(slide, color) {
  slide.background = { color };
}

function kicker(slide, text, color = colors.primary) {
  slide.addText(text.toUpperCase(), {
    x: spacing.margin, y: 0.5, w: 8, h: 0.35,
    fontFace: fonts.body, fontSize: 12, color, bold: true, charSpacing: 2,
  });
}

function slideTitle(slide, text, opts = {}) {
  slide.addText(text, {
    x: spacing.margin, y: opts.y ?? 0.85, w: opts.w ?? 11, h: 0.7,
    fontFace: fonts.heading, fontSize: type.title, bold: true,
    color: opts.color ?? colors.primaryDark,
  });
}

function subtitle(slide, text, y = 1.5) {
  slide.addText(text, {
    x: spacing.margin, y, w: 9.5, h: 0.4,
    fontFace: fonts.body, fontSize: type.body, color: colors.gray,
  });
}

function pageNumber(slide, n) {
  slide.addText(String(n).padStart(2, "0"), {
    x: spacing.slideW - 0.8, y: spacing.slideH - 0.42, w: 0.6, h: 0.3,
    fontFace: fonts.body, fontSize: 10, color: colors.gray, align: "right",
  });
}

function brandFooter(slide, logoMarkPath) {
  if (!logoMarkPath) return;
  slide.addImage({ path: logoMarkPath, x: spacing.margin, y: spacing.slideH - 0.47, w: 0.26, h: 0.209 });
}

// ---------------------------------------------------------------------
// COMPONENT: Title slide
// content = { kicker, title, subtitle, description, logoPath }
// ---------------------------------------------------------------------
function titleSlide(pres, content) {
  const s = pres.addSlide();
  bg(s, colors.primary);
  s.addShape("ellipse", { x: 10.3, y: -1.5, w: 5.5, h: 5.5, fill: { color: colors.primaryDark }, line: { type: "none" } });
  s.addShape("ellipse", { x: 11.8, y: 4.3, w: 3.2, h: 3.2, fill: { color: colors.primaryDark }, line: { type: "none" } });

  let y = 0.55;
  if (content.logoPath) {
    s.addImage({ path: content.logoPath, x: spacing.margin, y, w: 2.4, h: 0.4 });
    y += 0.63;
  }
  s.addText(content.kicker.toUpperCase(), {
    x: spacing.margin, y, w: 6, h: 0.35, fontFace: fonts.body, fontSize: 13,
    color: colors.secondary, bold: true, charSpacing: 2,
  });
  y += 0.4;
  s.addText(content.title, {
    x: spacing.margin, y, w: 9.5, h: 1.3, fontFace: fonts.heading, fontSize: type.titleLarge + 16,
    color: colors.accentWhite, bold: true,
  });
  y += 1.2;
  s.addText(content.subtitle, {
    x: spacing.margin, y, w: 8.5, h: 0.6, fontFace: fonts.body, fontSize: 22, color: colors.secondary,
  });
  y += 0.7;
  s.addText(content.description, {
    x: spacing.margin, y, w: 7.6, h: 0.7, fontFace: fonts.body, fontSize: type.body, color: colors.mutedOnDark,
  });

  s.addShape("line", { x: spacing.margin, y: 6.55, w: 2.2, h: 0, line: { color: colors.secondary, width: 1.5 } });
  s.addText(content.footer || "", {
    x: spacing.margin, y: 6.7, w: 6, h: 0.35, fontFace: fonts.body, fontSize: 11, color: colors.mutedOnDark,
  });
  return s;
}

// ---------------------------------------------------------------------
// COMPONENT: Card grid (3-6 items). Use for: categories, use cases,
// feature comparisons where each item is independent.
// content = { kicker, title, subtitle, items: [{title, desc, icon}], page }
// icon paths are pre-rendered PNGs (see gen_icons.js)
// ---------------------------------------------------------------------
function cardGrid(pres, content, opts = {}) {
  const s = pres.addSlide();
  bg(s, opts.background || colors.lightBg);
  kicker(s, content.kicker);
  slideTitle(s, content.title);
  if (content.subtitle) subtitle(s, content.subtitle);

  const items = content.items;
  const cols = items.length > 4 ? 3 : items.length;
  const rows = Math.ceil(items.length / cols);
  const cw = (spacing.slideW - spacing.margin * 2 - spacing.gutter * (cols - 1)) / cols;
  const ch = 2.05;
  const startY = content.subtitle ? 1.85 : 1.6;

  items.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = spacing.margin + col * (cw + spacing.gutter);
    const y = startY + row * (ch + 0.22);

    s.addShape("roundRect", {
      x, y, w: cw, h: ch, rectRadius: 0.08, fill: { color: colors.cardBg }, line: { type: "none" },
      shadow: { type: "outer", color: colors.primary, opacity: 0.1, blur: 6, offset: 2, angle: 90 },
    });
    s.addShape("roundRect", { x: x + 0.25, y: y + 0.3, w: 0.62, h: 0.62, rectRadius: 0.31, fill: { color: colors.primary }, line: { type: "none" } });
    if (it.icon) s.addImage({ path: it.icon, x: x + 0.4, y: y + 0.45, w: 0.32, h: 0.32 });
    s.addText(it.title, { x: x + 1.05, y: y + 0.28, w: cw - 1.25, h: 0.4, fontFace: fonts.heading, fontSize: 14.5, bold: true, color: colors.primaryDark });
    s.addText(it.desc, { x: x + 0.25, y: y + 1.0, w: cw - 0.5, h: 0.95, fontFace: fonts.body, fontSize: 11, color: colors.gray, lineSpacingMultiple: 1.18 });
  });

  brandFooter(s, opts.logoMarkPath);
  if (content.page) pageNumber(s, content.page);
  return s;
}

// ---------------------------------------------------------------------
// COMPONENT: Stat callouts (3-4 big numbers with labels)
// content = { kicker, title, stats: [{num, label}], insight }
// ---------------------------------------------------------------------
function statCallouts(pres, content, opts = {}) {
  const s = pres.addSlide();
  bg(s, opts.background || colors.lightBg);
  kicker(s, content.kicker);
  slideTitle(s, content.title);

  const n = content.stats.length;
  const w = (spacing.slideW - spacing.margin * 2 - spacing.gutter * (n - 1)) / n;
  const y = 1.85;
  content.stats.forEach((st, i) => {
    const x = spacing.margin + i * (w + spacing.gutter);
    s.addShape("roundRect", { x, y, w, h: 2.1, rectRadius: 0.09, fill: { color: colors.cardBg }, line: { type: "none" },
      shadow: { type: "outer", color: colors.primary, opacity: 0.12, blur: 8, offset: 3, angle: 90 } });
    s.addText(st.num, { x: x + 0.2, y: y + 0.22, w: w - 0.4, h: 0.7, fontFace: fonts.heading, fontSize: 30, bold: true, color: colors.primary });
    s.addText(st.label, { x: x + 0.2, y: y + 0.95, w: w - 0.4, h: 1.05, fontFace: fonts.body, fontSize: 11.5, color: colors.gray, lineSpacingMultiple: 1.15 });
  });

  if (content.insight) {
    s.addShape("roundRect", { x: spacing.margin, y: 4.35, w: spacing.slideW - spacing.margin * 2, h: 2.25, rectRadius: 0.1, fill: { color: colors.primary }, line: { type: "none" } });
    s.addText(content.insight.title, { x: 2.0, y: 4.62, w: 9.5, h: 0.4, fontFace: fonts.heading, fontSize: 16, bold: true, color: colors.accentWhite });
    s.addText(content.insight.body, { x: 2.0, y: 5.05, w: 9.9, h: 1.3, fontFace: fonts.body, fontSize: 13.5, color: colors.secondary, lineSpacingMultiple: 1.25 });
  }

  brandFooter(s, opts.logoMarkPath);
  if (content.page) pageNumber(s, content.page);
  return s;
}

// ---------------------------------------------------------------------
// COMPONENT: Comparison table (2 columns vs N attribute rows)
// content = { kicker, title, subtitle, colA, colB, rows: [[label, a, b]] }
// ---------------------------------------------------------------------
function comparisonTable(pres, content, opts = {}) {
  const s = pres.addSlide();
  bg(s, colors.accentWhite);
  kicker(s, content.kicker);
  slideTitle(s, content.title);
  if (content.subtitle) subtitle(s, content.subtitle);

  const leftX = spacing.margin, colW = 3.75;
  const rightColX = spacing.slideW - spacing.margin - colW * 2 - 0.1;
  const rightColX2 = spacing.slideW - spacing.margin - colW;
  const top = content.subtitle ? 2.15 : 1.9;

  s.addShape("roundRect", { x: rightColX, y: top - 0.05, w: colW, h: 0.6, rectRadius: 0.08, fill: { color: colors.lightBg }, line: { type: "none" } });
  s.addText(content.colA, { x: rightColX + 0.2, y: top - 0.02, w: colW - 0.4, h: 0.5, fontFace: fonts.heading, fontSize: 13.5, bold: true, color: colors.primaryDark, valign: "middle" });

  s.addShape("roundRect", { x: rightColX2, y: top - 0.05, w: colW, h: 0.6, rectRadius: 0.08, fill: { color: colors.primary }, line: { type: "none" } });
  s.addText(content.colB, { x: rightColX2 + 0.2, y: top - 0.02, w: colW - 0.4, h: 0.5, fontFace: fonts.heading, fontSize: 13.5, bold: true, color: colors.accentWhite, valign: "middle" });

  const rowH = 0.95;
  content.rows.forEach((r, i) => {
    const y = top + 0.75 + i * rowH;
    if (i % 2 === 0) {
      s.addShape("rect", { x: leftX, y, w: rightColX2 + colW - leftX, h: rowH - 0.08, fill: { color: colors.lightBg }, line: { type: "none" } });
    }
    s.addText(r[0], { x: leftX + 0.05, y, w: rightColX - leftX - 0.15, h: rowH - 0.08, fontFace: fonts.body, fontSize: 12.5, bold: true, color: colors.primaryDark, valign: "middle" });
    s.addText(r[1], { x: rightColX + 0.15, y, w: colW - 0.3, h: rowH - 0.08, fontFace: fonts.body, fontSize: 12, color: colors.gray, valign: "middle" });
    s.addText(r[2], { x: rightColX2 + 0.15, y, w: colW - 0.3, h: rowH - 0.08, fontFace: fonts.body, fontSize: 12, color: colors.primaryDark, valign: "middle" });
  });

  brandFooter(s, opts.logoMarkPath);
  if (content.page) pageNumber(s, content.page);
  return s;
}

// ---------------------------------------------------------------------
// COMPONENT: Process stepper (3-6 sequential steps)
// content = { kicker, title, subtitle, steps: [{n, title, desc, icon}] }
// ---------------------------------------------------------------------
function processStepper(pres, content, opts = {}) {
  const s = pres.addSlide();
  bg(s, colors.accentWhite);
  kicker(s, content.kicker);
  slideTitle(s, content.title);
  if (content.subtitle) subtitle(s, content.subtitle);

  const steps = content.steps;
  const n = steps.length;
  const gap = 0.32;
  const w = (spacing.slideW - spacing.margin * 2 - gap * (n - 1)) / n;
  const y = content.subtitle ? 2.45 : 2.1;
  const h = 3.9;

  steps.forEach((st, i) => {
    const x = spacing.margin + i * (w + gap);
    s.addShape("roundRect", { x, y, w, h, rectRadius: 0.1, fill: { color: colors.lightBg }, line: { type: "none" } });
    s.addShape("ellipse", { x: x + 0.2, y: y + 0.3, w: 0.6, h: 0.6, fill: { color: colors.primary }, line: { type: "none" } });
    s.addText(st.n, { x: x + 0.2, y: y + 0.3, w: 0.6, h: 0.6, fontFace: fonts.heading, fontSize: 20, bold: true, color: colors.accentWhite, align: "center", valign: "middle" });
    if (st.icon) s.addImage({ path: st.icon, x: x + w - 0.75, y: y + 0.37, w: 0.45, h: 0.45 });
    s.addText(st.title, { x: x + 0.2, y: y + 1.15, w: w - 0.4, h: 0.65, fontFace: fonts.heading, fontSize: 15.5, bold: true, color: colors.primaryDark });
    s.addText(st.desc, { x: x + 0.2, y: y + 1.8, w: w - 0.4, h: 1.9, fontFace: fonts.body, fontSize: 11.5, color: colors.gray, lineSpacingMultiple: 1.2 });
    if (i < n - 1) {
      s.addShape("triangle", { x: x + w + gap / 2 - 0.11, y: y + h / 2 - 0.11, w: 0.22, h: 0.22, rotate: 90, fill: { color: colors.primary }, line: { type: "none" } });
    }
  });

  brandFooter(s, opts.logoMarkPath);
  if (content.page) pageNumber(s, content.page);
  return s;
}

// ---------------------------------------------------------------------
// COMPONENT: Icon-row list (5+ items, zebra striped rows)
// content = { kicker, title, subtitle, rows: [{title, subtitle, desc, icon, badge}] }
// ---------------------------------------------------------------------
function iconRowList(pres, content, opts = {}) {
  const s = pres.addSlide();
  bg(s, colors.accentWhite);
  kicker(s, content.kicker);
  slideTitle(s, content.title);
  if (content.subtitle) subtitle(s, content.subtitle);

  const startX = spacing.margin, top = content.subtitle ? 2.1 : 1.8;
  const rowW = spacing.slideW - spacing.margin * 2, rowH = 0.92;

  content.rows.forEach((r, i) => {
    const y = top + i * rowH;
    if (i % 2 === 0) s.addShape("rect", { x: startX, y, w: rowW, h: rowH - 0.08, fill: { color: colors.lightBg }, line: { type: "none" } });
    s.addShape("roundRect", { x: startX + 0.18, y: y + 0.13, w: 0.62, h: 0.62, rectRadius: 0.31, fill: { color: colors.primary }, line: { type: "none" } });
    if (r.icon) s.addImage({ path: r.icon, x: startX + 0.33, y: y + 0.28, w: 0.32, h: 0.32 });
    s.addText(r.title, { x: startX + 1.05, y: y + 0.06, w: 2.3, h: 0.4, fontFace: fonts.heading, fontSize: 14, bold: true, color: colors.primaryDark });
    if (r.badge) {
      s.addShape("roundRect", { x: startX + 3.15, y: y + 0.11, w: 0.85, h: 0.28, rectRadius: 0.14, fill: { color: colors.lightBg }, line: { type: "none" } });
      s.addText(r.badge.toUpperCase(), { x: startX + 3.15, y: y + 0.11, w: 0.85, h: 0.28, fontFace: fonts.body, fontSize: 8, bold: true, color: colors.primary, align: "center", valign: "middle", charSpacing: 1 });
    }
    if (r.subtitle) s.addText(r.subtitle, { x: startX + 1.05, y: y + 0.44, w: 3.0, h: 0.4, fontFace: fonts.body, fontSize: 10.5, bold: true, color: colors.primary, italic: true });
    s.addText(r.desc, { x: startX + 4.2, y, w: rowW - 3.7, h: rowH - 0.08, fontFace: fonts.body, fontSize: 11.5, color: colors.gray, valign: "middle", lineSpacingMultiple: 1.18 });
  });

  brandFooter(s, opts.logoMarkPath);
  if (content.page) pageNumber(s, content.page);
  return s;
}

// ---------------------------------------------------------------------
// COMPONENT: Closing / CTA slide
// content = { headline, body, logoPath, footer }
// ---------------------------------------------------------------------
function closingSlide(pres, content, opts = {}) {
  const s = pres.addSlide();
  bg(s, colors.primary);
  s.addShape("ellipse", { x: -1.5, y: 4.5, w: 5, h: 5, fill: { color: colors.primaryDark }, line: { type: "none" } });
  s.addText(content.headline, { x: spacing.margin, y: 3.4, w: 8, h: 1.0, fontFace: fonts.heading, fontSize: type.titleLarge, bold: true, color: colors.accentWhite });
  s.addText(content.body, { x: spacing.margin, y: 4.35, w: 7.5, h: 0.8, fontFace: fonts.body, fontSize: 14, color: colors.secondary });
  if (content.logoPath) s.addImage({ path: content.logoPath, x: spacing.margin, y: 6.55, w: 1.9, h: 0.317 });
  s.addText(content.footer || "", { x: spacing.margin, y: 6.95, w: 6, h: 0.35, fontFace: fonts.body, fontSize: 12, color: colors.mutedOnDark });
  return s;
}

module.exports = {
  titleSlide, cardGrid, statCallouts, comparisonTable, processStepper,
  iconRowList, closingSlide, kicker, slideTitle, subtitle, pageNumber, brandFooter,
};
