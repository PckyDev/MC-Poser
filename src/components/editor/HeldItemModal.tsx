import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faXmark } from "@fortawesome/free-solid-svg-icons";

import { HELD_ITEM_PRESETS, formatHeldItemArmLabel } from "../../utils/heldItems";
import type { HeldItem, HeldItemArmId, HeldItemPresetId } from "../../types/editor";

type HeldItemSourceTab = "preset" | "upload";

type HeldItemModalProps = {
  armId: HeldItemArmId | null;
  currentItem: HeldItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (presetId: HeldItemPresetId) => void;
  onSelectUpload: (file: File) => void;
};

export function HeldItemModal({
  armId,
  currentItem,
  isOpen,
  onClose,
  onSelectPreset,
  onSelectUpload,
}: HeldItemModalProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSourceTab, setActiveSourceTab] = useState<HeldItemSourceTab>("preset");
  const [selectedPresetId, setSelectedPresetId] = useState<HeldItemPresetId>(HELD_ITEM_PRESETS[0]!.id);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveSourceTab("preset");
    setSelectedPresetId(HELD_ITEM_PRESETS[0]!.id);
    setUploadedFile(null);
    setUploadedPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return null;
    });
  }, [isOpen]);

  useEffect(() => () => {
    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
  }, [uploadedPreviewUrl]);

  const selectedPreset = useMemo(
    () => HELD_ITEM_PRESETS.find((preset) => preset.id === selectedPresetId) ?? HELD_ITEM_PRESETS[0]!,
    [selectedPresetId],
  );

  if (!isOpen || !armId) {
    return null;
  }

  const armLabel = formatHeldItemArmLabel(armId);
  const isPresetTab = activeSourceTab === "preset";
  const confirmLabel = isPresetTab
    ? `Hold ${selectedPreset.label}`
    : `Use ${uploadedFile?.name ?? "Custom Item"}`;
  const previewLabel = isPresetTab
    ? selectedPreset.label
    : uploadedFile?.name.replace(/\.png$/i, "") ?? "Custom item preview";
  const previewDetail = isPresetTab
    ? selectedPreset.detail
    : uploadedFile
      ? `${Math.max(1, Math.round(uploadedFile.size / 1024))} KB upload`
      : "Upload a PNG texture to preview the held item here.";

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".png")) {
      event.target.value = "";
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);

    setUploadedPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return nextPreviewUrl;
    });
    setUploadedFile(file);
    event.target.value = "";
  }

  function handleConfirm(): void {
    if (isPresetTab) {
      onSelectPreset(selectedPreset.id);
      return;
    }

    if (!uploadedFile) {
      return;
    }

    onSelectUpload(uploadedFile);
  }

  return (
    <div className="document-overlay">
      <div
        className="document-modal item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="held-item-modal-title"
      >
        <div className="document-header modal-header">
          <div>
            <h2 id="held-item-modal-title">Choose a held item</h2>
            <p className="document-copy modal-copy">
              Pick a preset voxel item or upload a PNG texture for the {armLabel.toLowerCase()}.
            </p>
          </div>

          <div className="document-header-actions">
            <button
              className="icon-button modal-close-button"
              type="button"
              aria-label="Close held item modal"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        <div className="item-modal-body">
          <section className="startup-section modal-page-section">
            <div className="modal-section-header">
              <h3>Item source</h3>
              <p className="modal-section-copy">
                Presets are included with the editor. Custom PNG uploads are converted into voxel sprites.
              </p>
            </div>

            <div className="new-file-source-tabs" role="tablist" aria-label="Held item source options">
              <button
                className={isPresetTab ? "new-file-source-tab is-active" : "new-file-source-tab"}
                type="button"
                role="tab"
                aria-selected={isPresetTab}
                onClick={() => setActiveSourceTab("preset")}
              >
                Presets
              </button>
              <button
                className={!isPresetTab ? "new-file-source-tab is-active" : "new-file-source-tab"}
                type="button"
                role="tab"
                aria-selected={!isPresetTab}
                onClick={() => setActiveSourceTab("upload")}
              >
                Upload PNG
              </button>
            </div>

            {isPresetTab ? (
              <div className="item-preset-grid">
                {HELD_ITEM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={
                      preset.id === selectedPreset.id
                        ? "item-preset-card is-active"
                        : "item-preset-card"
                    }
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                  >
                    <div className="item-preset-preview">
                      <img
                        className="item-preset-image"
                        src={preset.previewUrl}
                        alt={`${preset.label} preset preview`}
                      />
                    </div>
                    <div className="item-preset-copy">
                      <strong>{preset.label}</strong>
                      <span>{preset.detail}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="new-file-tab-panel">
                <input
                  ref={uploadInputRef}
                  className="hidden-input"
                  type="file"
                  accept=".png,image/png"
                  onChange={handleUploadChange}
                />

                <div className="new-file-upload-actions">
                  <button
                    className="toolbar-button"
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <FontAwesomeIcon icon={faUpload} /> Choose PNG
                  </button>
                </div>

                {uploadedPreviewUrl ? (
                  <div className="new-file-upload-preview">
                    <div className="new-file-upload-preview-frame">
                      <img
                        className="new-file-upload-preview-image"
                        src={uploadedPreviewUrl}
                        alt={uploadedFile?.name ?? "Uploaded held item preview"}
                      />
                    </div>

                    <div className="new-file-upload-preview-meta">
                      <strong>{uploadedFile?.name.replace(/\.png$/i, "")}</strong>
                      <span>{previewDetail}</span>
                    </div>
                  </div>
                ) : (
                  <p className="panel-note">
                    Upload a PNG with transparency. The texture will be voxelized into a thin 3D item in the viewport.
                  </p>
                )}
              </div>
            )}
          </section>

          <aside className="item-modal-sidebar">
            <section className="startup-section modal-page-section item-modal-preview-card">
              <div className="modal-section-header">
                <h3>Preview</h3>
                <p className="modal-section-copy">
                  The held item is attached to the {armLabel.toLowerCase()} and follows shoulder and elbow bends.
                </p>
              </div>

              <div className="item-modal-preview-frame">
                {isPresetTab || uploadedPreviewUrl ? (
                  <img
                    className="item-modal-preview-image"
                    src={isPresetTab ? selectedPreset.previewUrl : uploadedPreviewUrl ?? undefined}
                    alt={previewLabel}
                  />
                ) : (
                  <span className="item-modal-preview-placeholder">No custom texture selected</span>
                )}
              </div>

              <div className="item-modal-preview-copy">
                <strong>{previewLabel}</strong>
                <span>{previewDetail}</span>
                {currentItem ? (
                  <span>Replacing {currentItem.label} on the {armLabel.toLowerCase()}.</span>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        <div className="document-footer modal-footer">
          <p className="document-footer-copy modal-footer-copy">
            Held items use the same pixelated texture language as the rest of the editor.
          </p>

          <div className="modal-footer-actions">
            <button className="toolbar-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="toolbar-button toolbar-button--accent"
              type="button"
              onClick={handleConfirm}
              disabled={!isPresetTab && !uploadedFile}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}