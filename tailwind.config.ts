import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          white: "#FFFFFF",
          black: "#101010",
          gold: "#D6AC63"
        },
        // Keep existing utility names as compatibility aliases while the UI migrates.
        ink: "#101010",
        jade: "#101010",
        coral: "#101010",
        maize: "#D6AC63",
        cloud: "#F6F4EF"
      },
      boxShadow: {
        panel: "0 12px 30px rgba(16, 16, 16, 0.07)"
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
