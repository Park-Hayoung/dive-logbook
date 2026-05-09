// Imports the brand palette from a single source so editing brand-tokens.js
// updates both Tailwind classes (via tailwind.config.js) and direct JS usage.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokens = require("./brand-tokens") as { brand: BrandPalette };

type BrandPalette = {
  50: string;
  100: string;
  200: string;
  400: string;
  500: string;
  600: string;
  700: string;
  900: string;
  /** Foreground (text/icon) color for use on top of bg-brand-600. */
  fg: string;
};

export const colors = {
  brand: tokens.brand,
  surface: {
    bg: "#F9FAFB",
    card: "#FFFFFF",
    inverted: "#111827",
  },
  text: {
    primary: "#111827",
    secondary: "#6B7280",
    muted: "#9CA3AF",
    onBrand: tokens.brand.fg,
  },
} as const;
