import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { JavaItemImport } from "../JavaItemImport";
import type { JavaItemAsset } from "../../lib/javaItemModel";
import "./SceneModelImport.css";

export function SceneModelImport({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (name: string, asset: JavaItemAsset) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="scene-model-import"
      aria-labelledby="scene-model-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id="scene-model-title">Add Java model</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close model import"
          onClick={onClose}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </header>
      <JavaItemImport
        sceneModel
        onImport={(item) => {
          if (item.javaModel) onImport(item.label, item.javaModel);
        }}
      />
    </dialog>
  );
}
