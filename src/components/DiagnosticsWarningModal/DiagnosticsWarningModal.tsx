import { useLayoutEffect, useRef } from "react";

import "./DiagnosticsWarningModal.css";

type DiagnosticsWarningModalProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function DiagnosticsWarningModal({ onCancel, onConfirm }: DiagnosticsWarningModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="diagnostics-warning-modal"
      aria-labelledby="diagnostics-warning-title"
      aria-describedby="diagnostics-warning-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 className="title" id="diagnostics-warning-title">Download diagnostics?</h2>
      <p className="copy" id="diagnostics-warning-description">
        Includes your active pose, skin/item images, settings, and debugging details.
        Usernames and file names may be included. Review before sharing.
        Nothing is uploaded automatically.
      </p>
      <div className="actions">
        <button className="toolbar-button" type="button" autoFocus onClick={onCancel}>
          Cancel
        </button>
        <button className="toolbar-button toolbar-button--accent" type="button" onClick={onConfirm}>
          Download JSON
        </button>
      </div>
    </dialog>
  );
}
