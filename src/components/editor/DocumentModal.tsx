import { useEffect, useId, useState, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCube, faFileLines, faImage, faXmark } from "@fortawesome/free-solid-svg-icons";

import { QUICK_LOADS } from "../../config/pose";
import type { ModelPreference } from "../../types/editor";
import { formatPresetName } from "../../utils/editor";

const DOCUMENT_MODAL_PAGES = [
  { id: "pose-file", label: "Pose File", icon: faFileLines },
  { id: "current-asset", label: "Current Asset", icon: faCube },
  { id: "skin-source", label: "Skin Source", icon: faImage },
];

type DocumentModalPage = (typeof DOCUMENT_MODAL_PAGES)[number]["id"];

type DocumentModalProps = {
  isOpen: boolean;
  poseFileName: string;
  skinLabel: string | null;
  skinOrigin: string;
  isRigModified: boolean;
  assetDetail: string | null;
  activePoseLabel: string;
  modelLabel: string;
  selectedPreset: string | null;
  username: string;
  uploadModel: ModelPreference;
  isLoading: boolean;
  onClose: () => void;
  onPoseFileNameChange: (value: string) => void;
  onPoseFileNameBlur: () => void;
  onUsernameChange: (value: string) => void;
  onUsernameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onQuickLoad: (value: string) => void;
  onOpenFilePicker: () => void;
  onUploadModelChange: (value: ModelPreference) => void;
};

export function DocumentModal({
  isOpen,
  poseFileName,
  skinLabel,
  skinOrigin,
  isRigModified,
  assetDetail,
  activePoseLabel,
  modelLabel,
  selectedPreset,
  username,
  uploadModel,
  isLoading,
  onClose,
  onPoseFileNameChange,
  onPoseFileNameBlur,
  onUsernameChange,
  onUsernameSubmit,
  onQuickLoad,
  onOpenFilePicker,
  onUploadModelChange,
}: DocumentModalProps) {
  const [activePage, setActivePage] = useState<DocumentModalPage>("pose-file");
  const usernameFormId = useId();

  useEffect(() => {
    if (isOpen) {
      setActivePage("pose-file");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const isPoseFilePage = activePage === "pose-file";
  const isCurrentAssetPage = activePage === "current-asset";

  return (
    <div className="document-overlay">
      <div
        className="document-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-modal-title"
      >
        <div className="document-header modal-header">
          <div>
            <h2 id="document-modal-title">Document</h2>
            <p className="document-copy modal-copy">
              Manage the current pose file and swap skin sources here so the main sidebar stays focused on presets.
            </p>
          </div>

          <div className="document-header-actions">
            <button
              className="icon-button modal-close-button"
              type="button"
              aria-label="Close document modal"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <aside className="modal-sidebar" aria-label="Document modal pages">
            <div className="modal-sidebar-nav">
              {DOCUMENT_MODAL_PAGES.map((page) => (
                <button
                  key={page.id}
                  className={activePage === page.id ? "modal-nav-button is-active" : "modal-nav-button"}
                  type="button"
                  onClick={() => setActivePage(page.id)}
                >
                  <FontAwesomeIcon className="modal-nav-icon" icon={page.icon} />
                  {page.label}
                </button>
              ))}
            </div>
          </aside>

          <div className="modal-page-area">
            {isPoseFilePage ? (
              <section className="modal-page-section">
                <div className="modal-section-header">
                  <h3>Pose file</h3>
                  <p className="modal-section-copy">
                    Rename the active workspace file and inspect the current skin and rig state.
                  </p>
                </div>

                <label className="form-label" htmlFor="document-pose-file-name">
                  Current pose file
                </label>
                <input
                  id="document-pose-file-name"
                  className="editor-input"
                  value={poseFileName}
                  onChange={(event) => onPoseFileNameChange(event.target.value)}
                  onBlur={onPoseFileNameBlur}
                />

                <div className="info-grid">
                  <div className="info-card">
                    <span>Pose state</span>
                    <strong>{activePoseLabel}</strong>
                  </div>
                  <div className="info-card">
                    <span>Rig state</span>
                    <strong>{isRigModified ? "Modified" : "Neutral"}</strong>
                  </div>
                </div>
              </section>
            ) : isCurrentAssetPage ? (
              <section className="modal-page-section">
                <div className="modal-section-header">
                  <h3>Current asset</h3>
                  <p className="modal-section-copy">
                    Inspect the loaded character, source type, arm model, and active pose preset for the current scene.
                  </p>
                </div>

                <div className="info-grid info-grid--single">
                  <div className="info-card">
                    <span>Character</span>
                    <strong>{skinLabel ?? "Empty scene"}</strong>
                  </div>
                  <div className="info-card">
                    <span>Source</span>
                    <strong>{skinOrigin}</strong>
                  </div>
                  <div className="info-card">
                    <span>Arm model</span>
                    <strong>{modelLabel}</strong>
                  </div>
                  <div className="info-card">
                    <span>Selection</span>
                    <strong>{selectedPreset ? formatPresetName(selectedPreset) : "Custom"}</strong>
                  </div>
                </div>

                <p className="panel-note">
                  {assetDetail ?? "Open the startup modal or load a skin from the document modal."}
                </p>
              </section>
            ) : (
              <section className="modal-page-section">
                <div className="modal-section-header">
                  <h3>Skin source</h3>
                  <p className="modal-section-copy">
                    Load a skin from a username or upload a PNG, then choose the arm model used for local files.
                  </p>
                </div>

                <form id={usernameFormId} className="editor-form" onSubmit={onUsernameSubmit}>
                  <label className="form-label" htmlFor="document-username-input">
                    Username lookup
                  </label>
                  <div className="inline-form-row inline-form-row--single">
                    <input
                      id="document-username-input"
                      className="editor-input"
                      autoComplete="off"
                      spellCheck={false}
                      value={username}
                      onChange={(event) => onUsernameChange(event.target.value)}
                      placeholder="Enter Java username"
                    />
                  </div>
                </form>

                <div className="chip-strip">
                  {QUICK_LOADS.map((quickUsername) => (
                    <button
                      key={quickUsername}
                      className="chip-button"
                      type="button"
                      onClick={() => onQuickLoad(quickUsername)}
                    >
                      {quickUsername}
                    </button>
                  ))}
                </div>

                <div className="panel-divider" />

                <label className="form-label" htmlFor="document-upload-model-select">
                  Uploaded arm model
                </label>
                <select
                  id="document-upload-model-select"
                  className="editor-select"
                  value={uploadModel}
                  onChange={(event) => onUploadModelChange(event.target.value as ModelPreference)}
                >
                  <option value="auto-detect">Auto-detect</option>
                  <option value="default">Classic arms</option>
                  <option value="slim">Slim arms</option>
                </select>
              </section>
            )}
          </div>
        </div>

        <div className="document-footer modal-footer">
          <p className="document-footer-copy modal-footer-copy">
            {isPoseFilePage
              ? "Changes to the pose file name apply directly in the current editor session."
              : isCurrentAssetPage
                ? "The current asset page reflects the live scene in the editor viewport."
              : "Use quick loads, a username lookup, or a PNG upload to swap the active skin source."}
          </p>

          <div className="modal-footer-actions">
            {!isPoseFilePage ? (
              <>
                <button className="toolbar-button" type="button" onClick={onOpenFilePicker}>
                  Upload PNG
                </button>
                <button
                  className="toolbar-button toolbar-button--accent"
                  type="submit"
                  form={usernameFormId}
                  disabled={isLoading}
                >
                  Load Username
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}