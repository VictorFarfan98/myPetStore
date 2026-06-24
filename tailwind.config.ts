import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        jade: "#277c6b",
        coral: "#d95f43",
        maize: "#f2b84b",
        cloud: "#f5f7f2"
      },
      boxShadow: {
        panel: "0 16px 40px rgba(31, 41, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
