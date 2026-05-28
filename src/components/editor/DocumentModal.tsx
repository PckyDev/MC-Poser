import { useEffect, useId, useState, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faImage, faUser, faXmark } from "@fortawesome/free-solid-svg-icons";

import { QUICK_LOADS } from "../../config/pose";
import type { AvatarType, ModelPreference } from "../../types/editor";
import { formatAvatarTypeLabel, formatPresetName } from "../../utils/editor";

const DOCUMENT_MODAL_PAGES = [
  { id: "pose-file", label: "Pose File", icon: faFileLines },
  { id: "avatar-type", label: "Avatar Type", icon: faUser },
  { id: "skin-source", label: "Skin Source", icon: faImage },
];

const AVATAR_TYPE_OPTIONS: Array<{
  description: string;
  label: string;
  value: AvatarType;
}> = [
  {
    description: "Standard Minecraft proportions.",
    label: "Default",
    value: "default",
  },
  {
    description: "Large head with a smaller body and limbs.",
    label: "Bobblehead",
    value: "bobblehead",
  },
  {
    description: "Segmented limbs with elbow, knee, and spine bending.",
    label: "Advanced",
    value: "advanced",
  },
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
  avatarType: AvatarType;
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
  onAvatarTypeChange: (value: AvatarType) => void;
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
  avatarType,
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
  onAvatarTypeChange,
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
  const isAvatarTypePage = activePage === "avatar-type";
  const showFooterActions = !isPoseFilePage && !isAvatarTypePage;
  const assetDetailLabel = assetDetail?.startsWith("UUID ") ? "UUID" : "Detail";
  const assetDetailValue = assetDetail?.startsWith("UUID ") ? assetDetail.slice(5) : assetDetail;

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
            <p className="document-copy modal-copy">Manage the current pose file.</p>
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

                <input
                  id="document-pose-file-name"
                  className="editor-input"
                  aria-label="Current pose file"
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
                    <span>Avatar type</span>
                    <strong>{formatAvatarTypeLabel(avatarType)}</strong>
                  </div>
                  <div className="info-card">
                    <span>Selection</span>
                    <strong>{selectedPreset ? formatPresetName(selectedPreset) : "Custom"}</strong>
                  </div>
                  {assetDetailValue ? (
                    <div className="info-card">
                      <span>{assetDetailLabel}</span>
                      <strong>{assetDetailValue}</strong>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : isAvatarTypePage ? (
              <section className="modal-page-section">
                <div className="modal-section-header">
                  <h3>Avatar type</h3>
                  <p className="modal-section-copy">
                    Swap between standard Minecraft proportions and a bobblehead-style body at any time.
                  </p>
                </div>

                <div className="avatar-type-grid" role="list" aria-label="Avatar type options">
                  {AVATAR_TYPE_OPTIONS.map((avatarOption) => (
                    <button
                      key={avatarOption.value}
                      className={
                        avatarType === avatarOption.value
                          ? "avatar-type-option is-active"
                          : "avatar-type-option"
                      }
                      type="button"
                      aria-pressed={avatarType === avatarOption.value}
                      onClick={() => onAvatarTypeChange(avatarOption.value)}
                    >
                      <strong>{avatarOption.label}</strong>
                      <span>{avatarOption.description}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <section className="modal-page-section">
                <div className="modal-section-header">
                  <h3>Skin source</h3>
                </div>

                <form id={usernameFormId} className="editor-form" onSubmit={onUsernameSubmit}>
                  <div className="inline-form-row inline-form-row--single">
                    <input
                      id="document-username-input"
                      className="editor-input"
                      aria-label="Username lookup"
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

                <select
                  id="document-upload-model-select"
                  className="editor-select"
                  aria-label="Uploaded arm model"
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

        {showFooterActions ? (
          <div className="document-footer modal-footer">
            <div className="modal-footer-actions">
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
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}