import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

export type ExportFileType = "png" | "jpg" | "webp";
export type ExportBackgroundMode = "transparent" | "solid";

export type ExportSettings = {
  width: number;
  height: number;
  fileType: ExportFileType;
  backgroundMode: ExportBackgroundMode;
  backgroundColor: string;
};

const EXPORT_DIMENSION_MIN = 64;
const EXPORT_DIMENSION_MAX = 4096;
const EXPORT_DIMENSION_SLIDER_STEP = 16;

type ExportModalProps = {
  isOpen: boolean;
  isExporting: boolean;
  isPreviewLoading: boolean;
  previewUrl: string | null;
  previewError: string | null;
  settings: ExportSettings;
  onClose: () => void;
  onDimensionChange: (field: "width" | "height", value: number) => void;
  onFileTypeChange: (value: ExportFileType) => void;
  onBackgroundModeChange: (value: ExportBackgroundMode) => void;
  onBackgroundColorChange: (value: string) => void;
  onExport: () => void;
};

export function ExportModal({
  isOpen,
  isExporting,
  isPreviewLoading,
  previewUrl,
  previewError,
  settings,
  onClose,
  onDimensionChange,
  onFileTypeChange,
  onBackgroundModeChange,
  onBackgroundColorChange,
  onExport,
}: ExportModalProps) {
  if (!isOpen) {
    return null;
  }

  const isTransparentBackgroundAvailable = settings.fileType !== "jpg";
  const effectiveBackgroundMode = isTransparentBackgroundAvailable
    ? settings.backgroundMode
    : "solid";

  return (
    <div className="document-overlay">
      <div
        className="document-modal export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        <div className="document-header modal-header">
          <div>
            <h2 id="export-modal-title">Export</h2>
            <p className="document-copy modal-copy">
              Preview the current scene and choose the output format, resolution, and background treatment before saving.
            </p>
          </div>

          <div className="document-header-actions">
            <button
              className="icon-button modal-close-button"
              type="button"
              aria-label="Close export modal"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        <div className="export-modal-body">
          <section className="export-preview-panel modal-page-section">
            <div className="modal-section-header">
              <h3>Preview</h3>
              <p className="modal-section-copy">
                The current viewing angle is preserved while the character is refit for the selected output size.
              </p>
            </div>

            <div className="export-preview-frame">
              {previewUrl ? (
                <div
                  className={
                    effectiveBackgroundMode === "transparent"
                      ? "export-preview-bounds export-preview-bounds--transparent"
                      : "export-preview-bounds export-preview-bounds--solid"
                  }
                >
                  <img className="export-preview-image" src={previewUrl} alt="Export preview" />
                </div>
              ) : (
                <div className="export-preview-placeholder">
                  {isPreviewLoading ? "Generating preview..." : (previewError ?? "Preview unavailable.")}
                </div>
              )}

              {isPreviewLoading && previewUrl ? (
                <div className="export-preview-status">Updating preview...</div>
              ) : null}
            </div>
          </section>

          <section className="export-settings-panel modal-page-section">
            <div className="modal-section-header">
              <h3>Settings</h3>
              <p className="modal-section-copy">
                Adjust the target size and file settings for the final render.
              </p>
            </div>

            <div className="export-settings-grid">
              <label className="export-setting-field" htmlFor="export-width-input">
                <span className="form-label">Width</span>
                <input
                  id="export-width-input"
                  className="editor-input export-control export-control--dimension"
                  type="number"
                  min={EXPORT_DIMENSION_MIN}
                  max={EXPORT_DIMENSION_MAX}
                  step={1}
                  value={settings.width}
                  onChange={(event) => {
                    const nextValue = event.target.valueAsNumber;

                    if (Number.isFinite(nextValue)) {
                      onDimensionChange("width", nextValue);
                    }
                  }}
                />
                <input
                  className="editor-range export-dimension-slider"
                  type="range"
                  min={EXPORT_DIMENSION_MIN}
                  max={EXPORT_DIMENSION_MAX}
                  step={EXPORT_DIMENSION_SLIDER_STEP}
                  value={settings.width}
                  aria-label="Export width"
                  onChange={(event) => onDimensionChange("width", Number(event.target.value))}
                />
              </label>

              <label className="export-setting-field" htmlFor="export-height-input">
                <span className="form-label">Height</span>
                <input
                  id="export-height-input"
                  className="editor-input export-control export-control--dimension"
                  type="number"
                  min={EXPORT_DIMENSION_MIN}
                  max={EXPORT_DIMENSION_MAX}
                  step={1}
                  value={settings.height}
                  onChange={(event) => {
                    const nextValue = event.target.valueAsNumber;

                    if (Number.isFinite(nextValue)) {
                      onDimensionChange("height", nextValue);
                    }
                  }}
                />
                <input
                  className="editor-range export-dimension-slider"
                  type="range"
                  min={EXPORT_DIMENSION_MIN}
                  max={EXPORT_DIMENSION_MAX}
                  step={EXPORT_DIMENSION_SLIDER_STEP}
                  value={settings.height}
                  aria-label="Export height"
                  onChange={(event) => onDimensionChange("height", Number(event.target.value))}
                />
              </label>
            </div>

            <label className="form-label" htmlFor="export-file-type-select">
              File type
            </label>
            <select
              id="export-file-type-select"
              className="editor-select export-control export-control--select"
              value={settings.fileType}
              onChange={(event) => onFileTypeChange(event.target.value as ExportFileType)}
            >
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WEBP</option>
            </select>

            <div className="modal-section-header">
              <h3>Background</h3>
              <p className="modal-section-copy">
                PNG and WEBP can preserve transparency. JPG always exports against a solid color.
              </p>
            </div>

            <div className="new-file-source-tabs" role="tablist" aria-label="Export background options">
              <button
                className={
                  effectiveBackgroundMode === "transparent"
                    ? "new-file-source-tab is-active"
                    : "new-file-source-tab"
                }
                type="button"
                role="tab"
                aria-selected={effectiveBackgroundMode === "transparent"}
                disabled={!isTransparentBackgroundAvailable}
                onClick={() => onBackgroundModeChange("transparent")}
              >
                Transparent
              </button>
              <button
                className={
                  effectiveBackgroundMode === "solid"
                    ? "new-file-source-tab is-active"
                    : "new-file-source-tab"
                }
                type="button"
                role="tab"
                aria-selected={effectiveBackgroundMode === "solid"}
                onClick={() => onBackgroundModeChange("solid")}
              >
                Solid Color
              </button>
            </div>

            {effectiveBackgroundMode === "solid" ? (
              <label className="export-setting-field" htmlFor="export-background-color-input">
                <span className="form-label">Background color</span>
                <div className="export-color-row">
                  <input
                    id="export-background-color-input"
                    className="export-color-input"
                    type="color"
                    value={settings.backgroundColor}
                    onChange={(event) => onBackgroundColorChange(event.target.value)}
                  />
                  <span className="tool-pill export-color-value">{settings.backgroundColor.toUpperCase()}</span>
                </div>
              </label>
            ) : (
              <p className="panel-note">
                Transparent exports keep the canvas alpha channel so you can composite the render elsewhere.
              </p>
            )}
          </section>
        </div>

        <div className="document-footer modal-footer">
          <p className="document-footer-copy modal-footer-copy">
            Export uses the current pose, viewing angle, lighting mode, and visible skin layers.
          </p>

          <div className="modal-footer-actions">
            <button className="toolbar-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="toolbar-button toolbar-button--accent"
              type="button"
              onClick={onExport}
              disabled={isExporting || isPreviewLoading || Boolean(previewError)}
            >
              {isExporting ? "Exporting..." : "Export Image"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}