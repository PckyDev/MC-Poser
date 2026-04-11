import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

import { QUICK_LOADS } from "../../config/pose";

type SkinSourceTab = "name" | "upload";

type NewFileModalProps = {
  isOpen: boolean;
  startupFileName: string;
  startupUsername: string;
  isLoading: boolean;
  uploadedSkinPreviewUrl: string | null;
  uploadedSkinName: string | null;
  uploadedSkinDetail: string | null;
  onStartupFileNameChange: (value: string) => void;
  onStartupFileNameBlur: () => void;
  onStartupUsernameChange: (value: string) => void;
  onClose: () => void;
  onCreateUsername: () => void;
  onCreateUpload: () => void;
  onOpenSkinUpload: () => void;
  onQuickLoad: (username: string) => void;
};

export function NewFileModal({
  isOpen,
  startupFileName,
  startupUsername,
  isLoading,
  uploadedSkinPreviewUrl,
  uploadedSkinName,
  uploadedSkinDetail,
  onStartupFileNameChange,
  onStartupFileNameBlur,
  onStartupUsernameChange,
  onClose,
  onCreateUsername,
  onCreateUpload,
  onOpenSkinUpload,
  onQuickLoad,
}: NewFileModalProps) {
  const [activeSkinSourceTab, setActiveSkinSourceTab] = useState<SkinSourceTab>("name");

  useEffect(() => {
    if (isOpen) {
      setActiveSkinSourceTab("name");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const trimmedUsername = startupUsername.trim();
  const isNameTab = activeSkinSourceTab === "name";
  const createButtonLabel = isNameTab
    ? `Create From Username${trimmedUsername ? ` ${trimmedUsername}` : ""}`
    : "Create From Uploaded PNG";
  const isCreateDisabled = isLoading || (isNameTab ? !trimmedUsername : !uploadedSkinPreviewUrl);

  return (
    <div className="startup-overlay">
      <div
        className="startup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-file-modal-title"
      >
        <div className="startup-header modal-header">
          <div>
            <h2 id="new-file-modal-title">Create a new file</h2>
            <p className="startup-copy modal-copy">
              Name the workspace tab, then create the file from a username lookup or a PNG skin.
            </p>
          </div>

          <button
            className="icon-button modal-close-button"
            type="button"
            aria-label="Close new file modal"
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="startup-modal-body">
          <section className="startup-section modal-page-section">
            <div className="modal-section-header">
              <h3>File details</h3>
              <p className="modal-section-copy">
                Choose the pose-file name that will appear in the workspace tabs.
              </p>
            </div>

            <label className="form-label" htmlFor="startup-file-name">
              Pose file name
            </label>
            <input
              id="startup-file-name"
              className="editor-input"
              value={startupFileName}
              onChange={(event) => onStartupFileNameChange(event.target.value)}
              onBlur={onStartupFileNameBlur}
            />
          </section>

          <section className="startup-section modal-page-section">
            <div className="modal-section-header">
              <h3>Skin source</h3>
              <p className="modal-section-copy">
                New files must start from a username skin lookup or an uploaded PNG.
              </p>
            </div>

            <div className="new-file-source-tabs" role="tablist" aria-label="Skin source options">
              <button
                className={
                  isNameTab ? "new-file-source-tab is-active" : "new-file-source-tab"
                }
                type="button"
                role="tab"
                aria-selected={isNameTab}
                onClick={() => setActiveSkinSourceTab("name")}
              >
                By Name
              </button>
              <button
                className={
                  !isNameTab ? "new-file-source-tab is-active" : "new-file-source-tab"
                }
                type="button"
                role="tab"
                aria-selected={!isNameTab}
                onClick={() => setActiveSkinSourceTab("upload")}
              >
                Upload PNG
              </button>
            </div>

            {isNameTab ? (
              <div className="new-file-tab-panel">
                <label className="form-label" htmlFor="startup-username">
                  Username lookup
                </label>
                <input
                  id="startup-username"
                  className="editor-input"
                  value={startupUsername}
                  onChange={(event) => onStartupUsernameChange(event.target.value)}
                  placeholder="Notch"
                />

                <div className="chip-strip chip-strip--startup">
                  {QUICK_LOADS.map((quickUsername) => (
                    <button
                      key={quickUsername}
                      className="chip-button"
                      type="button"
                      onClick={() => onQuickLoad(quickUsername)}
                      disabled={isLoading}
                    >
                      {quickUsername}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="new-file-tab-panel">
                <div className="new-file-upload-actions">
                  <button
                    className="toolbar-button"
                    type="button"
                    onClick={onOpenSkinUpload}
                    disabled={isLoading}
                  >
                    Choose PNG
                  </button>
                </div>

                {uploadedSkinPreviewUrl ? (
                  <div className="new-file-upload-preview">
                    <div className="new-file-upload-preview-frame">
                      <img
                        className="new-file-upload-preview-image"
                        src={uploadedSkinPreviewUrl}
                        alt={uploadedSkinName ?? "Uploaded Minecraft skin preview"}
                      />
                    </div>

                    <div className="new-file-upload-preview-meta">
                      <strong>{uploadedSkinName}</strong>
                      <span>{uploadedSkinDetail}</span>
                    </div>
                  </div>
                ) : (
                  <p className="panel-note">
                    No PNG selected yet. Choose a skin file to preview it here before creating the workspace.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="startup-footer modal-footer">
          <p className="startup-footer-copy modal-footer-copy">
            Blank files are not allowed. Pick a skin source to create the workspace.
          </p>

          <div className="modal-footer-actions">
            <button className="toolbar-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="toolbar-button toolbar-button--accent"
              type="button"
              onClick={isNameTab ? onCreateUsername : onCreateUpload}
              disabled={isCreateDisabled}
            >
              {createButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}