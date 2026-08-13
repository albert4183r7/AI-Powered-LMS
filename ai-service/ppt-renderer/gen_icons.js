// gen_icons.js — renders react-icons to colored PNGs at build time.
//
// Why: generated decks need icons that (a) match the deck's palette
// exactly, (b) never trigger stock-image licensing questions, and
// (c) render identically every time. Rendering vector icons to PNG at
// generation time solves all three, and it's fully automatable — no
// image search, no manual asset curation per deck.
//
// Usage:
//   node gen_icons.js
//
// Add new icons by importing them from react-icons and adding a
// `key: Component` entry below. Run once per palette change.

const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fs = require("fs");
const theme = require("./lib/theme");

// Import whatever icon set fits your product — fa (Font Awesome), md
// (Material Design), hi (Heroicons), etc. are all available via react-icons.
const {
  FaRobot, FaLightbulb, FaBolt, FaCheckCircle, FaChartLine,
  FaUsers, FaClock, FaDatabase, FaShieldAlt, FaLock,
  FaSun, FaTint, FaLeaf,
} = require("react-icons/fa");

const icons = {
  robot: FaRobot,
  lightbulb: FaLightbulb,
  bolt: FaBolt,
  checkcircle: FaCheckCircle,
  chartline: FaChartLine,
  users: FaUsers,
  clock: FaClock,
  database: FaDatabase,
  shield: FaShieldAlt,
  lock: FaLock,
  sun: FaSun,
  water: FaTint,
  leaf: FaLeaf,
};

// Which color variants to render per icon — match these to where you'll
// place the icon (e.g. "navy" for icons on light cards, "white" for icons
// on colored badges/dark backgrounds).
const variants = {
  white: theme.colors.accentWhite,
  navy: theme.colors.primary,
};

async function renderIcon(name, Icon, hexColor) {
  const raw = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Icon, { size: 256 })
  );
  // Strip the library's own <svg> wrapper and re-wrap with an explicit
  // fill so color always applies regardless of how the icon sets
  // currentColor internally.
  const inner = raw.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 512 512" fill="#${hexColor}">${inner}</svg>`;
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  fs.writeFileSync(`assets/icons/${name}.png`, buf);
}

(async () => {
  if (!fs.existsSync("assets/icons")) fs.mkdirSync("assets/icons", { recursive: true });
  for (const [name, Icon] of Object.entries(icons)) {
    for (const [variantName, hex] of Object.entries(variants)) {
      await renderIcon(`${name}_${variantName}`, Icon, hex);
    }
  }
  console.log(`Generated ${Object.keys(icons).length * Object.keys(variants).length} icons in assets/icons/`);
})();
