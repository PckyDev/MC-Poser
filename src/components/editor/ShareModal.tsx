import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

type ShareModalProps = {
  isOpen: boolean;
  isGeneratingProjectLink: boolean;
  isGeneratingImageLink: boolean;
  projectLink: string | null;
  imageLink: string | null;
  projectError: string | null;
  imageError: string | null;
  imageOutputSummary: string;
  onClose: () => void;
  onGenerateProjectLink: () => void;
  onGenerateImageLink: () => void;
  onCopyProjectLink: () => void;
  onCopyImageLink: () => void;
};

export function ShareModal({
  isOpen,
  isGeneratingProjectLink,
  isGeneratingImageLink,
  projectLink,
  imageLink,
  projectError,
  imageError,
  imageOutputSummary,
  onClose,
  onGenerateProjectLink,
  onGenerateImageLink,
  onCopyProjectLink,
  onCopyImageLink,
}: ShareModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="document-overlay">
      <div
        className="document-modal share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <div className="document-header modal-header">
          <div>
            <h2 id="share-modal-title">Share</h2>
            <p className="document-copy modal-copy">
              Create compact share links for the current project or image output.
            </p>
          </div>

          <div className="document-header-actions">
            <button
              className="icon-button modal-close-button"
              type="button"
              aria-label="Close share modal"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        <div className="share-modal-body">
          <section className="share-option-card modal-page-section">
            <div className="modal-section-header">
              <h3>Share project file</h3>
              <p className="modal-section-copy">
                Generates a compact link that opens this workspace in the editor as a shared .mcpose file.
              </p>
            </div>

            <div className="share-card-actions">
              <button
                className="toolbar-button toolbar-button--accent"
                type="button"
                onClick={onGenerateProjectLink}
                disabled={isGeneratingProjectLink}
              >
                {isGeneratingProjectLink
                  ? "Generating..."
                  : (projectLink ? "Regenerate Link" : "Generate Link")}
              </button>

              {projectLink ? (
                <button className="toolbar-button" type="button" onClick={onCopyProjectLink}>
                  Copy Link
                </button>
              ) : null}
            </div>

            {projectLink ? (
              <textarea
                className="editor-input share-link-field"
                readOnly
                rows={6}
                value={projectLink}
              />
            ) : null}

            {projectError ? <p className="share-link-error">{projectError}</p> : null}

            <p className="panel-note">
              The link is compressed and encoded, but uploaded PNG skins still add size because they are bundled into the share payload.
            </p>
          </section>

          <section className="share-option-card modal-page-section">
            <div className="modal-section-header">
              <h3>Share image output</h3>
              <p className="modal-section-copy">
                Generates a compact link that opens a standalone view of the current rendered image output.
              </p>
            </div>

            <span className="tool-pill share-output-summary">{imageOutputSummary}</span>

            <div className="share-card-actions">
              <button
                className="toolbar-button toolbar-button--accent"
                type="button"
                onClick={onGenerateImageLink}
                disabled={isGeneratingImageLink}
              >
                {isGeneratingImageLink
                  ? "Generating..."
                  : (imageLink ? "Regenerate Link" : "Generate Link")}
              </button>

              {imageLink ? (
                <>
                  <button className="toolbar-button" type="button" onClick={onCopyImageLink}>
                    Copy Link
                  </button>
                  <a
                    className="toolbar-button share-open-link"
                    href={imageLink}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open Link
                  </a>
                </>
              ) : null}
            </div>

            {imageLink ? (
              <textarea
                className="editor-input share-link-field"
                readOnly
                rows={6}
                value={imageLink}
              />
            ) : null}

            {imageError ? <p className="share-link-error">{imageError}</p> : null}

            <p className="panel-note">
              Image links encode the workspace plus render settings, which makes them much shorter than embedding the raw image bytes directly.
            </p>
          </section>
        </div>

        <div className="document-footer modal-footer">
          <p className="document-footer-copy modal-footer-copy">
            Links are generated locally in your browser from the current workspace state.
          </p>

          <div className="modal-footer-actions">
            <button className="toolbar-button" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}