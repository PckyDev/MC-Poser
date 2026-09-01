import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MobileSupportGate } from "./components/MobileSupportGate";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MobileSupportGate />
  </StrictMode>,
);
