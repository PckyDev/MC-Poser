import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

import { PRESET_NAMES, type PosePresetName } from "../../config/pose";
import { formatPresetName } from "../../utils/editor";

type EditorTopbarProps = {
  canRedo: boolean;
  canUndo: boolean;
  isExportDisabled: boolean;
  isShareDisabled: boolean;
  selectedPreset: PosePresetName | null;
  onOpenDocumentModal: () => void;
  onOpenDiscord: () => void;
  onOpenGitHubRepo: () => void;
  onOpenIdeasModal: () => void;
  onOpenNewFileModal: () => void;
  onOpenPoseFile: () => void;
  onOpenIssueModal: () => void;
  onSavePoseFile: () => void;
  onSavePoseFileAs: () => void;
  onApplyPreset: (preset: PosePresetName) => void;
  onResetPose: () => void;
  onResetCamera: () => void;
  onOpenShareModal: () => void;
  onOpenSupportLink: () => void;
  onOpenExportModal: () => void;
  onRedo: () => void;
  onUndo: () => void;
};

export function EditorTopbar({
  canRedo,
  canUndo,
  isExportDisabled,
  isShareDisabled,
  selectedPreset,
  onOpenDocumentModal,
  onOpenDiscord,
  onOpenGitHubRepo,
  onOpenIdeasModal,
  onOpenNewFileModal,
  onOpenPoseFile,
  onOpenIssueModal,
  onSavePoseFile,
  onSavePoseFileAs,
  onApplyPreset,
  onResetPose,
  onResetCamera,
  onOpenShareModal,
  onOpenSupportLink,
  onOpenExportModal,
  onRedo,
  onUndo,
}: EditorTopbarProps) {
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isPoseMenuOpen, setIsPoseMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const editMenuRef = useRef<HTMLDivElement | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const poseMenuRef = useRef<HTMLDivElement | null>(null);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);
  const helpMenuRef = useRef<HTMLDivElement | null>(null);

  function closeAllMenus(): void {
    setIsEditMenuOpen(false);
    setIsFileMenuOpen(false);
    setIsPoseMenuOpen(false);
    setIsViewMenuOpen(false);
    setIsHelpMenuOpen(false);
  }

  useEffect(() => {
    if (!isEditMenuOpen && !isFileMenuOpen && !isPoseMenuOpen && !isViewMenuOpen && !isHelpMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const targetNode = event.target as Node;
      const clickedOutsideEditMenu = editMenuRef.current && !editMenuRef.current.contains(targetNode);
      const clickedOutsideFileMenu = fileMenuRef.current && !fileMenuRef.current.contains(targetNode);
      const clickedOutsidePoseMenu = poseMenuRef.current && !poseMenuRef.current.contains(targetNode);
      const clickedOutsideViewMenu = viewMenuRef.current && !viewMenuRef.current.contains(targetNode);
      const clickedOutsideHelpMenu = helpMenuRef.current && !helpMenuRef.current.contains(targetNode);

      if (
        clickedOutsideEditMenu &&
        clickedOutsideFileMenu &&
        clickedOutsidePoseMenu &&
        clickedOutsideViewMenu &&
        clickedOutsideHelpMenu
      ) {
        closeAllMenus();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAllMenus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEditMenuOpen, isFileMenuOpen, isHelpMenuOpen, isPoseMenuOpen, isViewMenuOpen]);

  function handleFileAction(action: () => void): void {
    action();
    closeAllMenus();
  }

  function handleEditAction(action: () => void): void {
    action();
    closeAllMenus();
  }

  function handlePoseReset(): void {
    onResetPose();
    closeAllMenus();
  }

  function handlePresetClick(preset: PosePresetName): void {
    onApplyPreset(preset);
    closeAllMenus();
  }

  function handleViewAction(action: () => void): void {
    action();
    closeAllMenus();
  }

  function handleHelpAction(action: () => void): void {
    action();
    closeAllMenus();
  }

  return (
    <header className="editor-topbar">
      <div className="brand-cluster">
        <div className="brand-copy">
          <strong>MC Poser</strong>
        </div>
      </div>

      <div className="menu-strip" aria-label="Workspace actions">
        <div className="menu-dropdown" ref={fileMenuRef}>
          <button
            className="menu-button menu-button--dropdown"
            type="button"
            aria-expanded={isFileMenuOpen}
            onClick={() => {
              setIsFileMenuOpen((currentValue) => !currentValue);
              setIsEditMenuOpen(false);
              setIsPoseMenuOpen(false);
              setIsViewMenuOpen(false);
              setIsHelpMenuOpen(false);
            }}
          >
            File
            <FontAwesomeIcon
              className={isFileMenuOpen ? "menu-button-caret is-open" : "menu-button-caret"}
              icon={faChevronDown}
            />
          </button>

          {isFileMenuOpen ? (
            <div className="menu-dropdown-panel" role="menu" aria-label="File actions">
              <button className="menu-dropdown-item" type="button" onClick={() => handleFileAction(onOpenNewFileModal)}>
                New File
              </button>
              <button className="menu-dropdown-item" type="button" onClick={() => handleFileAction(onOpenPoseFile)}>
                Open...
              </button>
              <div className="menu-dropdown-divider" />
              <button className="menu-dropdown-item" type="button" onClick={() => handleFileAction(onSavePoseFile)}>
                Save
              </button>
              <button className="menu-dropdown-item" type="button" onClick={() => handleFileAction(onSavePoseFileAs)}>
                Save As...
              </button>
            </div>
          ) : null}
        </div>

        <div className="menu-dropdown" ref={editMenuRef}>
          <button
            className="menu-button menu-button--dropdown"
            type="button"
            aria-expanded={isEditMenuOpen}
            onClick={() => {
              setIsEditMenuOpen((currentValue) => !currentValue);
              setIsFileMenuOpen(false);
              setIsPoseMenuOpen(false);
              setIsViewMenuOpen(false);
              setIsHelpMenuOpen(false);
            }}
          >
            Edit
            <FontAwesomeIcon
              className={isEditMenuOpen ? "menu-button-caret is-open" : "menu-button-caret"}
              icon={faChevronDown}
            />
          </button>

          {isEditMenuOpen ? (
            <div className="menu-dropdown-panel" role="menu" aria-label="Edit actions">
              <button
                className="menu-dropdown-item menu-dropdown-item--shortcut"
                type="button"
                disabled={!canUndo}
                onClick={() => handleEditAction(onUndo)}
              >
                <span>Undo</span>
                <kbd>Ctrl/Cmd+Z</kbd>
              </button>
              <button
                className="menu-dropdown-item menu-dropdown-item--shortcut"
                type="button"
                disabled={!canRedo}
                onClick={() => handleEditAction(onRedo)}
              >
                <span>Redo</span>
                <kbd>Ctrl/Cmd+Shift+Z</kbd>
              </button>
            </div>
          ) : null}
        </div>

        <div className="menu-dropdown" ref={poseMenuRef}>
          <button
            className="menu-button menu-button--dropdown"
            type="button"
            aria-expanded={isPoseMenuOpen}
            onClick={() => {
              setIsPoseMenuOpen((currentValue) => !currentValue);
              setIsEditMenuOpen(false);
              setIsFileMenuOpen(false);
              setIsViewMenuOpen(false);
              setIsHelpMenuOpen(false);
            }}
          >
            Pose
            <FontAwesomeIcon
              className={isPoseMenuOpen ? "menu-button-caret is-open" : "menu-button-caret"}
              icon={faChevronDown}
            />
          </button>

          {isPoseMenuOpen ? (
            <div className="menu-dropdown-panel" role="menu" aria-label="Pose actions">
              <button className="menu-dropdown-item" type="button" onClick={handlePoseReset}>
                Reset Pose
              </button>

              <div className="menu-dropdown-divider" />

              {PRESET_NAMES.map((presetName) => (
                <button
                  key={presetName}
                  className={selectedPreset === presetName ? "menu-dropdown-item is-active" : "menu-dropdown-item"}
                  type="button"
                  onClick={() => handlePresetClick(presetName)}
                >
                  {formatPresetName(presetName)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="menu-dropdown" ref={viewMenuRef}>
          <button
            className="menu-button menu-button--dropdown"
            type="button"
            aria-expanded={isViewMenuOpen}
            onClick={() => {
              setIsViewMenuOpen((currentValue) => !currentValue);
              setIsEditMenuOpen(false);
              setIsFileMenuOpen(false);
              setIsPoseMenuOpen(false);
              setIsHelpMenuOpen(false);
            }}
          >
            View
            <FontAwesomeIcon
              className={isViewMenuOpen ? "menu-button-caret is-open" : "menu-button-caret"}
              icon={faChevronDown}
            />
          </button>

          {isViewMenuOpen ? (
            <div className="menu-dropdown-panel" role="menu" aria-label="View actions">
              <button className="menu-dropdown-item" type="button" onClick={() => handleViewAction(onResetCamera)}>
                Reset Camera
              </button>
            </div>
          ) : null}
        </div>

        <div className="menu-dropdown" ref={helpMenuRef}>
          <button
            className="menu-button menu-button--dropdown"
            type="button"
            aria-expanded={isHelpMenuOpen}
            onClick={() => {
              setIsHelpMenuOpen((currentValue) => !currentValue);
              setIsEditMenuOpen(false);
              setIsFileMenuOpen(false);
              setIsPoseMenuOpen(false);
              setIsViewMenuOpen(false);
            }}
          >
            Help
            <FontAwesomeIcon
              className={isHelpMenuOpen ? "menu-button-caret is-open" : "menu-button-caret"}
              icon={faChevronDown}
            />
          </button>

          {isHelpMenuOpen ? (
            <div className="menu-dropdown-panel" role="menu" aria-label="Help actions">
              <button className="menu-dropdown-item" type="button" onClick={() => handleHelpAction(onOpenSupportLink)}>
                Support on Ko-Fi
              </button>
              <button className="menu-dropdown-item" type="button" onClick={() => handleHelpAction(onOpenDiscord)}>
                Join Discord
              </button>
              <button className="menu-dropdown-item" type="button" onClick={() => handleHelpAction(onOpenGitHubRepo)}>
                View on GitHub
              </button>
              <div className="menu-dropdown-divider" />
              <button className="menu-dropdown-item" type="button" onClick={() => handleHelpAction(onOpenIdeasModal)}>
                Suggest Ideas
              </button>
              <button className="menu-dropdown-item" type="button" onClick={() => handleHelpAction(onOpenIssueModal)}>
                Report Bug/Issue
              </button>
            </div>
          ) : null}
        </div>

        <button className="menu-button" type="button" onClick={onOpenDocumentModal}>
          Document
        </button>
      </div>

      <div className="toolbar-strip">
        <button
          className="toolbar-button"
          type="button"
          onClick={onOpenShareModal}
          disabled={isShareDisabled}
        >
          Share
        </button>
        <button
          className="toolbar-button toolbar-button--accent"
          type="button"
          onClick={onOpenExportModal}
          disabled={isExportDisabled}
        >
          Export
        </button>
      </div>
    </header>
  );
}
