import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  // Touch devices fake :hover on tap and leave it stuck; gate hover styles to real pointers.
  future: { hoverOnlyWhenSupported: true },
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core semantic colors - all use CSS variables that switch with dark mode
        shell: "var(--shell)",
        panel: "var(--panel)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        "accent-muted": "var(--accent-muted)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        border: "var(--border)",
        "border-muted": "var(--border-muted)",
        input: "var(--input)",
        ring: "var(--ring)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        success: "var(--success)",
        "success-muted": "var(--success-muted)",
        warning: "var(--warning)",
        "warning-foreground": "var(--warning-foreground)",
        "warning-muted": "var(--warning-muted)",
        info: "var(--info)",
        "info-foreground": "var(--info-foreground)",
        "info-muted": "var(--info-muted)",
        "destructive-muted": "var(--destructive-muted)",
        "destructive-border": "var(--destructive-border)",
        overlay: "var(--overlay)",
      },
      borderRadius: {
        xl: "calc(var(--radius) * 2)",
        lg: "calc(var(--radius) + 2px)",
        md: "var(--radius)",
        sm: "calc(var(--radius) - 2px)",
      },
      transitionTimingFunction: {
        "out-strong": "var(--ease-out-strong)",
        "in-out-strong": "var(--ease-in-out-strong)",
        drawer: "var(--ease-drawer)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        overlay: "var(--shadow-overlay)",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [typography, animate],
};

export default config;
