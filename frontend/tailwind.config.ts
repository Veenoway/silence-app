import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#6263A6",
        secondary: "#120621",
        terciary: "#1E1330",
        borderColor: "#251936",
        brandColor: "#241F6F",
      },
      fontFamily: {
        syne: ["var(--font-syne)", "sans-serif"],
        spaceGrotesk: ["var(--font-space-grotesk)", "sans-serif"],
        digital: ["Digital-7", "monospace"],
      },
      height: {
        "calc-header-screen": "calc(100vh - 90px)",
      },
      keyframes: {
        "pulse-once": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        reveal: {
          "0%": { opacity: "0", filter: "blur(10px)" },
          "100%": { opacity: "1", filter: "blur(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "0.6" },
          "100%": { opacity: "0" },
        },
        buzz: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%": { transform: "translateX(-3px) rotate(-1deg)" },
          "20%": { transform: "translateX(3px) rotate(1deg)" },
          "30%": { transform: "translateX(-3px) rotate(-1deg)" },
          "40%": { transform: "translateX(3px) rotate(1deg)" },
          "50%": { transform: "translateX(-2px) rotate(-0.5deg)" },
          "60%": { transform: "translateX(2px) rotate(0.5deg)" },
          "70%": { transform: "translateX(-2px) rotate(-0.5deg)" },
          "80%": { transform: "translateX(2px) rotate(0.5deg)" },
          "90%": { transform: "translateX(-1px)" },
        },
      },
      animation: {
        "pulse-once": "pulse-once 2s ease-in-out",
        reveal: "reveal 1s ease-in-out",
        fadeIn: "fadeIn 0.5s ease-in-out",
        fadeOut: "fadeOut 5s ease-in-out forwards",
        buzz: "buzz 0.5s ease-in-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
