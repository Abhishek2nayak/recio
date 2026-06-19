import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "./Studio.js";
import { initTheme } from "../lib/theme.js";
import "../styles/global.css";

// Honour the light/dark mode chosen in the popup (else follow the OS).
void initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
);
