const tokens = require("./src/lib/brand-tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: tokens.brand,
      },
      fontFamily: {
        title: "KCCDodamdodam",
      },
    },
  },
  plugins: [],
};
