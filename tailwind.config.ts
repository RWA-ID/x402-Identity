import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "402": {
          DEFAULT: "#f97316",
          light: "#fb923c",
          dim: "#431407",
        },
      },
      fontFamily: {
        mono: ["Space Mono", "monospace"],
        sans: ["IBM Plex Sans", "sans-serif"],
      },
      boxShadow: {
        "402": "0 0 20px rgba(249, 115, 22, 0.25)",
        "402-lg": "0 0 40px rgba(249, 115, 22, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
