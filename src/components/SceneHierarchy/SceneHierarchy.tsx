import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faPlus,
  faClone,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { getPoseBones } from "../../config/pose";
import type { EditorScene } from "../../lib/scene";
import type { PoseSelection } from "../../types/editor";
import "./SceneHierarchy.css";

export function SceneHierarchy({
  scene,
  selection,
  onSelect,
  onVisible,
  onAdd,
  onDuplicate,
  onRemove,
  onCamera,
}: {
  scene: EditorScene;
  selection: PoseSelection;
  onSelect: (id: string, selection: PoseSelection) => void;
  onVisible: (id: string, visible: boolean) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onCamera: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  return (
    <aside
      className="scene-hierarchy editor-sidebar"
      aria-label="Scene hierarchy"
    >
      <div className="panel-heading">
        <h2>Hierarchy</h2>
        <span className="badge">Advanced editor</span>
      </div>
      <div className="actions">
        <button type="button" className="toolbar-button" onClick={onAdd}>
          <FontAwesomeIcon icon={faPlus} /> Add avatar
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Duplicate avatar"
          disabled={!scene.selectedId}
          onClick={onDuplicate}
        >
          <FontAwesomeIcon icon={faClone} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Remove avatar"
          disabled={!scene.selectedId || scene.avatars.length === 1}
          onClick={onRemove}
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
      <div className="tree" role="tree" aria-label="Scene objects">
        <div className="scene-label">Scene</div>
        {scene.avatars.map((avatar) => {
          const active = scene.selectedId === avatar.id,
            expanded = active && !collapsed.has(avatar.id);
          return (
            <div
              key={avatar.id}
              role="treeitem"
              aria-selected={active}
              aria-expanded={expanded}
              aria-label={avatar.name}
              className="avatar"
            >
              <div className={active ? "row selected" : "row"}>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${avatar.name}`}
                  onClick={() => {
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (expanded) next.add(avatar.id);
                      else next.delete(avatar.id);
                      return next;
                    });
                    onSelect(avatar.id, { kind: "none" });
                  }}
                >
                  <FontAwesomeIcon
                    icon={expanded ? faChevronDown : faChevronRight}
                  />
                </button>
                <button
                  type="button"
                  className="avatar-name"
                  onClick={() => onSelect(avatar.id, { kind: "none" })}
                >
                  <span>{avatar.name}</span>
                </button>
                <input
                  type="checkbox"
                  aria-label={`Show ${avatar.name}`}
                  checked={avatar.visible}
                  onChange={(e) => onVisible(avatar.id, e.target.checked)}
                />
              </div>
              {expanded ? (
                <div role="group" className="bones">
                  {getPoseBones(avatar.avatarType).map((bone) => (
                    <div key={bone.id}>
                      <button
                        type="button"
                        className="bone-tree-button"
                        aria-pressed={
                          selection.kind === "bone" && selection.id === bone.id
                        }
                        onClick={() =>
                          onSelect(avatar.id, { kind: "bone", id: bone.id })
                        }
                      >
                        {bone.label}
                      </button>
                      <div className="joints">
                        {bone.fields.map((field) => (
                          <button
                            type="button"
                            className="bone-tree-joint-button"
                            key={field.key}
                            aria-pressed={
                              selection.kind === "joint" &&
                              selection.id === field.key
                            }
                            onClick={() =>
                              onSelect(avatar.id, {
                                kind: "joint",
                                id: field.key,
                              })
                            }
                          >
                            {field.label}
                          </button>
                        ))}
                        {bone.id === "leftArm" || bone.id === "rightArm" ? (
                          <button
                            type="button"
                            className="bone-tree-joint-button"
                            onClick={() =>
                              onSelect(avatar.id, {
                                kind: "heldItem",
                                id: bone.id as "leftArm" | "rightArm",
                              })
                            }
                          >
                            Held Item
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <button type="button" className="toolbar-button" onClick={onCamera}>
          Scene camera
        </button>
        {scene.background ? (
          <button type="button" className="toolbar-button" onClick={onCamera}>
            Background: {scene.background.name}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
