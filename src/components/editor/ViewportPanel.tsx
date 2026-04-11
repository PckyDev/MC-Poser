import type { RefObject } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLightbulb, faMoon } from "@fortawesome/free-solid-svg-icons";

type ViewportPanelProps = {
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  gizmoCanvasRef: RefObject<HTMLCanvasElement | null>;
  isLoading: boolean;
  viewportLightingMode: "lit" | "unlit";
  onViewportLightingModeChange: (mode: "lit" | "unlit") => void;
};

export function ViewportPanel({
  stageRef,
  canvasRef,
  gizmoCanvasRef,
  isLoading,
  viewportLightingMode,
  onViewportLightingModeChange,
}: ViewportPanelProps) {
  return (
    <section className="viewport-column">
      <div className="viewport-frame">
        <div ref={stageRef} className="viewport-stage">
          <canvas ref={canvasRef} className="viewer-canvas" />
          <div className="viewport-toolbar viewport-toolbar--top-left" role="toolbar" aria-label="Viewport lighting">
            <button
              className={
                viewportLightingMode === "lit"
                  ? "viewport-icon-button is-active"
                  : "viewport-icon-button"
              }
              type="button"
              aria-label="Use lit viewport"
              aria-pressed={viewportLightingMode === "lit"}
              title="Lit view"
              onClick={() => onViewportLightingModeChange("lit")}
            >
              <FontAwesomeIcon icon={faLightbulb} />
            </button>
            <button
              className={
                viewportLightingMode === "unlit"
                  ? "viewport-icon-button is-active"
                  : "viewport-icon-button"
              }
              type="button"
              aria-label="Use unlit viewport"
              aria-pressed={viewportLightingMode === "unlit"}
              title="Unlit view"
              onClick={() => onViewportLightingModeChange("unlit")}
            >
              <FontAwesomeIcon icon={faMoon} />
            </button>
          </div>
          <div className="viewport-overlay viewport-overlay--top-right">LMB orbit · wheel zoom</div>
          <div
            className="viewport-gizmo"
            title="Click the cube faces to snap the camera"
          >
            <canvas ref={gizmoCanvasRef} className="viewport-gizmo-canvas" />
          </div>
          {isLoading ? <div className="viewport-loader">Loading texture + rig...</div> : null}
        </div>
      </div>
    </section>
  );
}
