// theme.js — swap these values to re-skin every deck your generator produces.
// Keep this as the single source of truth for color/font/spacing so
// components.js never hardcodes a hex value or font name.

module.exports = {
  // ---- Palette: "Midnight Executive" (swap for your brand palette) ----
  colors: {
    primary: "1E2761",      // dominant color — headers, primary shapes
    primaryDark: "141B4D",  // for gradients / decorative depth
    secondary: "CADCFC",    // secondary accent, used on dark backgrounds
    accentWhite: "FFFFFF",
    gray: "5A6072",         // body text on light backgrounds
    lightBg: "F4F6FC",      // light section background / card fill
    cardBg: "FFFFFF",
    mutedOnDark: "AEB8E0",  // captions/footers on dark backgrounds
  },

  fonts: {
    heading: "Cambria",   // pick a safe-list serif/sans with personality
    body: "Calibri",      // pick a safe-list font — see DESIGN_RULES.md
  },

  type: {
    title: 32,
    titleLarge: 44,
    sectionHeader: 20,
    cardTitle: 15,
    body: 13,
    caption: 10,
  },

  spacing: {
    margin: 0.6,       // inches, minimum slide-edge margin
    gutter: 0.3,       // inches, between content blocks
    slideW: 13.333,    // LAYOUT_WIDE
    slideH: 7.5,
  },

  // Named alternate palettes — swap `colors` above to try a different one
  palettes: {
    midnightExecutive: { primary: "1E2761", secondary: "CADCFC", accent: "FFFFFF" },
    forestMoss: { primary: "2C5F2D", secondary: "97BC62", accent: "F5F5F5" },
    coralEnergy: { primary: "F96167", secondary: "F9E795", accent: "2F3C7E" },
    oceanGradient: { primary: "065A82", secondary: "1C7293", accent: "21295C" },
    charcoalMinimal: { primary: "36454F", secondary: "F2F2F2", accent: "212121" },
    tealTrust: { primary: "028090", secondary: "00A896", accent: "02C39A" },
  },
};
