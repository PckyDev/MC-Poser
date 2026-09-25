import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MobileSupportGate } from "./components/MobileSupportGate";
import "./index.css";
import { installDiagnosticErrorCapture } from "./lib/diagnostics";

installDiagnosticErrorCapture();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MobileSupportGate />
  </StrictMode>,
);
