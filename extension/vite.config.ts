import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

// MV3 build via @crxjs. The popup HTML is pulled in from the manifest; the studio
// is a standalone extension page opened in a tab, so it's an extra input.
//
// We build the extension (incl. `dev` = `vite build --watch`) rather than serving it
// from a Vite dev server: MV3's CSP + the @crxjs HMR WebSocket are fragile, so a
// static `dist/` you reload manually is the reliable path. The web app keeps real HMR.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        studio: "src/studio/index.html",
        camera: "src/camera/index.html",
        offscreen: "src/offscreen/index.html",
      },
    },
  },
});
