import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faPerson,
  faCube,
  faCamera,
  faImage,
  faBorderAll,
  faEye,
  faEyeSlash,
  faLock,
  faLockOpen,
} from "@fortawesome/free-solid-svg-icons";
import { SceneAvatarTree } from "../SceneAvatarTree";
import { SceneAddMenu } from "../SceneAddMenu";
import { SceneToolButton } from "../SceneToolButton";
import type { EditorScene } from "../../lib/scene";
import type { PoseSelection, PoseBoneId } from "../../types/editor";
import "./SceneHierarchy.css";

export function SceneHierarchy({
  scene,
  selection,
  onSelect,
  onVisible,
  onLock,
  onAdd,
  onAddModel,
  onDuplicate,
  onRemove,
  onCamera,
  cameraSelected,
  onSettings,
  onRename,
  onPartChange,
  onBackground,
}: {
  scene: EditorScene;
  selection: PoseSelection;
  cameraSelected: string | null;
  onSettings: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onPartChange: (
    id: string,
    part: PoseBoneId,
    changes: { visible?: boolean; locked?: boolean },
  ) => void;
  onBackground: () => void;
  onSelect: (id: string | null, selection: PoseSelection) => void;
  onVisible: (id: string, visible: boolean) => void;
  onLock: (id: string, locked: boolean) => void;
  onAdd: () => void;
  onAddModel: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onCamera: (id: string) => void;
}) {
  const [menu, setMenu] = useState<{
    id: string;
    x: number;
    y: number;
    trigger: HTMLElement;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const renameInput = useRef<HTMLInputElement>(null);
  const cancelRename = useRef(false);
  useEffect(() => {
    if (renaming) {
      cancelRename.current = false;
      renameInput.current?.focus();
      renameInput.current?.select();
    }
  }, [renaming]);
  const rows = [
    ...scene.avatars.map((a) => ({ ...a, kind: "avatar" as const })),
    ...scene.models.map((m) => ({ ...m, kind: "model" as const })),
    {
      id: "camera",
      name: "Scene camera",
      kind: "camera" as const,
      locked: scene.camera.locked,
      visible: true,
    },
    {
      id: "grid",
      name: "Perspective grid",
      kind: "grid" as const,
      locked: false,
      visible: scene.showGrid,
    },
    ...(scene.background
      ? [
          {
            id: "background",
            name: "Scene background",
            kind: "background" as const,
            locked: false,
            visible: scene.background.visible,
          },
        ]
      : []),
  ];
  const target = rows.find((r) => r.id === menu?.id);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const close = () => {
    menu?.trigger.focus();
    setMenu(null);
  };
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const panel = menuRef.current,
      rect = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(4, Math.min(menu.x, innerWidth - rect.width - 4))}px`;
    panel.style.top = `${Math.max(4, Math.min(menu.y, innerHeight - rect.height - 4))}px`;
    panel.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const dismiss = () => setMenu(null);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [menu]);
  return (
    <aside
      className="scene-hierarchy editor-sidebar"
      aria-label="Scene hierarchy"
      tabIndex={-1}
      onClick={(e) => {
        if (
          !(e.target as HTMLElement).closest(
            ".scene-object, .panel-heading, .menu-dropdown-panel",
          )
        )
          onSelect(null, { kind: "none" });
      }}
      onContextMenu={(e) => {
        if (
          !(e.target as HTMLElement).closest(
            ".scene-object, .panel-heading, .menu-dropdown-panel",
          )
        ) {
          e.preventDefault();
          setMenu({
            id: "empty",
            x: e.clientX,
            y: e.clientY,
            trigger: e.currentTarget,
          });
        }
      }}
    >
      <div className="panel-heading">
        <h2>Hierarchy</h2>
        <SceneAddMenu
          onAvatar={onAdd}
          onModel={onAddModel}
          onBackground={onBackground}
          hasBackground={Boolean(scene.background)}
        />
      </div>
      <div className="hierarchy-content-scroll">
      <div className="hierarchy-scroll">
        <div className="tree" role="tree" aria-label="Scene objects">
          {rows.map((row) => {
            const open =
              expanded[row.id] ??
              (!cameraSelected && scene.selectedId === row.id);
            return (
              <div
                key={row.id}
                role="treeitem"
                aria-label={row.name}
                aria-selected={
                  !["avatar", "model"].includes(row.kind)
                    ? cameraSelected === row.id
                    : !cameraSelected && scene.selectedId === row.id
                }
                className="scene-object"
                aria-expanded={row.kind === "avatar" ? open : undefined}
                onContextMenu={(e) => {
                  if ((e.target as HTMLElement).closest("input")) return;
                  e.preventDefault();
                  setMenu({
                    id: row.id,
                    x: e.clientX,
                    y: e.clientY,
                    trigger:
                      e.currentTarget.querySelector<HTMLButtonElement>(
                        ".object-name",
                      )!,
                  });
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "ContextMenu" ||
                    (e.shiftKey && e.key === "F10")
                  ) {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenu({
                      id: row.id,
                      x: rect.left + 24,
                      y: rect.bottom,
                      trigger:
                        e.currentTarget.querySelector<HTMLButtonElement>(
                          ".object-name",
                        )!,
                    });
                  }
                }}
              >
                <div className="object-row">
                  <span className="object-symbol">
                    {row.kind === "avatar" && (
                      <button
                        type="button"
                        className="avatar-toggle"
                        aria-label={`${open ? "Collapse" : "Expand"} ${row.name}`}
                        aria-expanded={open}
                        onClick={() =>
                          setExpanded((v) => ({ ...v, [row.id]: !open }))
                        }
                      >
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          className={open ? "expanded" : ""}
                        />
                      </button>
                    )}
                    <FontAwesomeIcon
                      className="object-icon"
                      icon={
                        row.kind === "grid"
                          ? faBorderAll
                          : row.kind === "background"
                            ? faImage
                            : row.kind === "camera"
                              ? faCamera
                              : row.kind === "model"
                                ? faCube
                                : faPerson
                      }
                    />
                  </span>
                  {renaming === row.id ? (
                    <input
                      className="object-rename"
                      ref={renameInput}
                      aria-label={row.kind === "avatar" ? "Rename avatar" : "Rename Java model"}
                      defaultValue={row.name}
                      maxLength={100}
                      onBlur={(e) => {
                        const name = e.currentTarget.value.trim();
                        if (!cancelRename.current && name && name !== row.name)
                          onRename(row.id, name);
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRename.current = true;
                          setRenaming(null);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="object-name"
                      onClick={() =>
                        !["avatar", "model"].includes(row.kind)
                          ? onCamera(row.id)
                          : (setExpanded((v) => ({ ...v, [row.id]: true })),
                            onSelect(row.id, { kind: "none" }))
                      }
                    >
                      {row.name}
                    </button>
                  )}
                  <div className="quick-actions">
                    {row.kind !== "camera" && (
                      <SceneToolButton
                        className={`quick-action ${!row.visible ? "is-active" : ""}`}
                        label={`${row.visible ? "Hide" : "Show"} ${row.name}`}
                        icon={row.visible ? faEye : faEyeSlash}
                        onClick={() => onVisible(row.id, !row.visible)}
                      />
                    )}
                    {["avatar", "model", "camera"].includes(row.kind) && (
                      <SceneToolButton
                        className={`quick-action ${row.locked ? "is-active" : ""}`}
                        label={`${row.locked ? "Unlock" : "Lock"} ${row.name}`}
                        icon={row.locked ? faLock : faLockOpen}
                        onClick={() => onLock(row.id, !row.locked)}
                      />
                    )}
                  </div>
                </div>
                {row.kind === "avatar" && (
                  <SceneAvatarTree
                    avatar={row}
                    open={open}
                    selection={
                      !cameraSelected && scene.selectedId === row.id
                        ? selection
                        : { kind: "none" }
                    }
                    onSelect={onSelect}
                    onPartChange={onPartChange}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>
      {menu &&
        (target || menu.id === "empty") &&
        createPortal(
          <div
            ref={menuRef}
            className="scene-context-menu menu-dropdown-panel"
            role="menu"
            aria-label={
              target ? `Actions for ${target.name}` : "Add scene object"
            }
            style={{ position: "fixed", left: menu.x, top: menu.y }}
            onKeyDown={(e) => {
              const items = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)",
                ),
              );
              const index = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (e.key === "Escape" || e.key === "Tab") {
                if (e.key === "Escape") e.preventDefault();
                close();
              } else if (
                ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)
              ) {
                e.preventDefault();
                items[
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : (index +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          items.length) %
                        items.length
                ]?.focus();
              }
            }}
          >
            {!target ? (
              <>
                <button
                  role="menuitem"
                  className="menu-dropdown-item"
                  onClick={() => {
                    close();
                    onAdd();
                  }}
                >
                  Avatar
                </button>
                <button
                  role="menuitem"
                  className="menu-dropdown-item"
                  onClick={() => {
                    close();
                    onAddModel();
                  }}
                >
                  Java Model
                </button>
                <button
                  role="menuitem"
                  className="menu-dropdown-item"
                  disabled={Boolean(scene.background)}
                  onClick={() => {
                    close();
                    onBackground();
                  }}
                >
                  Scene Background
                </button>
              </>
            ) : (
              <>
                {target.kind === "avatar" && (
                  <button
                    role="menuitem"
                    className="menu-dropdown-item"
                    disabled={target.locked}
                    onClick={() => {
                      close();
                      onSettings(target.id);
                    }}
                  >
                    Avatar settings
                  </button>
                )}
                {(target.kind === "model" || target.kind === "avatar") && (
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-dropdown-item"
                    disabled={target.locked}
                    onClick={() => {
                      close();
                      onSelect(target.id, { kind: "none" });
                      setRenaming(target.id);
                    }}
                  >
                    Rename
                  </button>
                )}
                {target.kind !== "camera" && (
                  <button
                    className="menu-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      onVisible(target.id, !target.visible);
                      close();
                    }}
                  >
                    {target.visible ? "Hide" : "Show"}
                  </button>
                )}
                {["avatar", "model", "camera"].includes(target.kind) && (
                  <button
                    className="menu-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      onLock(target.id, !target.locked);
                      close();
                    }}
                  >
                    {target.locked ? "Unlock" : "Lock"}
                  </button>
                )}
                <button
                  className="menu-dropdown-item"
                  role="menuitem"
                  disabled={!["avatar", "model"].includes(target.kind)}
                  onClick={() => {
                    onDuplicate(target.id);
                    close();
                  }}
                >
                  Duplicate
                </button>
                <button
                  className="menu-dropdown-item"
                  role="menuitem"
                  disabled={
                    target.kind === "camera" ||
                    target.kind === "grid" ||
                    target.locked ||
                    (target.kind === "avatar" && scene.avatars.length === 1)
                  }
                  onClick={() => {
                    onRemove(target.id);
                    close();
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </aside>
  );
}
