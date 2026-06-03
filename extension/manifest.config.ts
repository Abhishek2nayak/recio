import { defineManifest } from "@crxjs/vite-plugin";

/**
 * MV3 manifest. Permissions per the FlowCap spec — `desktopCapture` + `<all_urls>`
 * so `getDisplayMedia` can offer the full OS screen (monitor/window/browser), and
 * `identity` for the Drive OAuth web-auth flow.
 *
 * NOTE: `oauth2.client_id` is filled from the env at build time (see vite.config);
 * the extension uses `launchWebAuthFlow`, so the redirect is the chromiumapp.org URL.
 */
export default defineManifest({
  manifest_version: 3,
  name: "FlowCap — Record & Share to Your Cloud",
  version: "0.1.0",
  description:
    "Screen recording & screenshots that save straight to your own Google Drive. Your storage, your control.",
  minimum_chrome_version: "116",
  action: {
    default_title: "FlowCap",
    default_popup: "src/popup/index.html",
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
  },
  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["tabs", "activeTab", "storage", "identity", "scripting", "desktopCapture"],
  host_permissions: ["https://www.googleapis.com/*", "<all_urls>"],
  commands: {
    "start-screen-recording": {
      suggested_key: { default: "Alt+Shift+R" },
      description: "Start a screen recording",
    },
    "capture-screenshot": {
      suggested_key: { default: "Alt+Shift+S" },
      description: "Capture a screenshot of the current tab",
    },
  },
  // The camera bubble page is embedded as an iframe on any site by the content
  // script, so it (and its hashed JS) must be web-accessible.
  web_accessible_resources: [
    {
      resources: ["src/camera/index.html", "assets/*"],
      matches: ["<all_urls>"],
    },
  ],
});
