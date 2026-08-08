/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      colors: {
        // Pylon-style product palette: dark navy chrome, near-white workspace,
        // a single blue action colour, amber for solar, emerald for money saved.
        ink: {
          900: "#0B1220",
          800: "#111A2B",
          700: "#1A2436",
          600: "#28344a",
        },
        brand: {
          50: "#eef4ff",
          100: "#dae6ff",
          200: "#bcd2ff",
          300: "#8eb4ff",
          400: "#598bff",
          500: "#3163f5",
          600: "#1f47db",
          700: "#1b39b1",
          800: "#1c338c",
          900: "#1c2f6e",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        pop: "0 8px 24px rgba(16, 24, 40, 0.10)",
      },
    },
  },
  plugins: [],
};
