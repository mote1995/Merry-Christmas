/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        cursive: ['"Great Vibes"', "cursive"],
      },
      colors: {
        vintage: {
          gold: "#D4AF37",
          burgundy: "#800020",
          greyBlue: "#5D8AA8",
          rose: "#E0BFB8",
          champagne: "#F7E7CE",
        },
      },
    },
  },
  plugins: [],
}
