import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF8",
        surface: "#FFFFFF",
        border: "#E4E2DC",
        borderStrong: "#CFCCC3",
        ink: "#161616",
        inkDim: "#6B6960",
        inkFaint: "#A7A498",
        accent: "#2B3A67",
        accentSoft: "#EEF0F5",
        good: "#3D6B4F",
        bad: "#8C3A32",
        warn: "#8A6A2C",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        none: "0px",
        sm: "2px",
        DEFAULT: "2px",
        md: "4px",
      },
    },
  },
  plugins: [],
} satisfies Config;
