import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#2a2a2a",
          700: "#4A4A4A",
          400: "#6D8196",
          200: "#CBCBCB",
          50:  "#FFFFE3",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 4px rgba(74,74,74,0.08), 0 4px 16px rgba(74,74,74,0.06)",
        btn:  "0 2px 8px rgba(109,129,150,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
