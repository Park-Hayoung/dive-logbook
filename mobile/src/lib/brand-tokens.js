// Single source of truth for the brand palette.
// Edit this file to retheme the entire app — both Tailwind classes
// (bg-brand-600, text-brand-700) and JS hex usages (colors.brand[600]).
//
// Both `tailwind.config.js` and `src/lib/colors.ts` import from here,
// and components reference colors via `colors.brand[N]` / `colors.brand.fg`.
//
// `fg` = foreground color used on top of bg-brand-600 (button text/icons).
//   - For light brand-600 (yellow/pink): set fg to a dark color (#1F2937)
//   - For dark brand-600 (blue/navy): set fg to white (#FFFFFF)
//
// CommonJS so it can be required by tailwind.config.js.

module.exports = {
  brand: {
    50: "#F0F9FD",
    100: "#D8EEFA",
    200: "#B0DCF4",
    400: "#7DCBF0",
    500: "#66C3EE",
    600: "#4DBBEB",
    700: "#1B7FB7",
    900: "#0B4A6E",
    fg: "#FFFFFF",
  },
};
