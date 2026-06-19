import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { useThemeStore } from "./stores/themeStore.js";
import "./index.css";

// Apply the persisted theme + start tracking OS changes before first render.
useThemeStore.getState().init();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
