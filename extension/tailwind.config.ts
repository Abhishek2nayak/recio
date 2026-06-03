import type { Config } from "tailwindcss";
import { tailwindTheme } from "@flowcap/shared/design";

// The color/typography system comes from @flowcap/shared so the popup can't drift
// from the web app or the spec.
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: tailwindTheme.colors,
      fontFamily: tailwindTheme.fontFamily,
      borderRadius: tailwindTheme.borderRadius,
    },
  },
  plugins: [],
} satisfies Config;
