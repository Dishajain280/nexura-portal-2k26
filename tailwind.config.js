/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nexura: {
          950: "#0B0614",
          900: "#150B27",
          800: "#1E1038",
          700: "#2C1650",
          600: "#3D1F6E",
          500: "#5B21B6",
          400: "#7C3AED",
          300: "#9F67F5",
          200: "#C7A8FA",
          100: "#E9DDFD",
          50: "#F6F1FE",
        },
        accent: {
          fuchsia: "#C026D3",
          pink: "#E879F9",
        },
        surface: "#0B0614",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        slate: "#64748B",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "nexura-gradient": "linear-gradient(135deg, #150B27 0%, #3D1F6E 50%, #5B21B6 100%)",
        "nexura-radial": "radial-gradient(circle at 20% 20%, rgba(124,58,237,0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(192,38,211,0.18), transparent 40%)",
        "cta-gradient": "linear-gradient(135deg, #7C3AED 0%, #C026D3 100%)",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.35)",
        "glow-purple": "0 0 40px rgba(124, 58, 237, 0.35)",
        card: "0 4px 24px rgba(0, 0, 0, 0.35)",
        "card-hover": "0 8px 32px rgba(124, 58, 237, 0.18)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
