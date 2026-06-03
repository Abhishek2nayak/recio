import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup.js";
import "../styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
