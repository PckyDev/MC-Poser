import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faCube,
  faEye,
  faEyeSlash,
  faLock,
  faLockOpen,
} from "@fortawesome/free-solid-svg-icons";
import { SceneToolButton } from "../SceneToolButton";
import { getPoseBones } from "../../config/pose";
import type { SceneAvatar } from "../../lib/scene";
import type { PoseSelection, PoseBoneId } from "../../types/editor";
import "./SceneAvatarTree.css";

export function SceneAvatarTree({
  avatar,
  open,
  selection,
  onSelect,
  onPartChange,
}: {
  onPartChange: (
    id: string,
    part: PoseBoneId,
    changes: { visible?: boolean; locked?: boolean },
  ) => void;
  avatar: SceneAvatar;
  open: boolean;
  selection: PoseSelection;
  onSelect: (id: string, selection: PoseSelection) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const reduced = useReducedMotion();
  const id = useId();
  const transition = {
    duration: reduced ? 0 : 0.22,
    ease: "easeInOut" as const,
  };
  return (
    <motion.div
      className="scene-avatar-tree"
      role="group"
      aria-label={`${avatar.name} parts`}
      inert={!open}
      aria-hidden={!open}
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={transition}
    >
      {getPoseBones(avatar.avatarType).map((bone) => {
        const part = avatar.parts?.[bone.id];
        const locked = avatar.locked || part?.locked;
        const selected = selection.kind === "bone" && selection.id === bone.id;
        const containsSelection =
          (selection.kind === "joint" &&
            bone.fields.some((f) => f.key === selection.id)) ||
          (selection.kind === "heldItem" && selection.id === bone.id);
        const unfolded = expanded[bone.id] ?? containsSelection;
        const controlsId = `${id}-${bone.id}`;
        return (
          <div
            role="treeitem"
            aria-label={bone.label}
            aria-selected={selected}
            aria-expanded={unfolded}
            key={bone.id}
          >
            <div className="part-row">
              <button
                type="button"
                className="branch-toggle"
                aria-label={`${unfolded ? "Collapse" : "Expand"} ${bone.label}`}
                aria-expanded={unfolded}
                aria-controls={controlsId}
                onClick={() =>
                  setExpanded((v) => ({ ...v, [bone.id]: !unfolded }))
                }
              >
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className={unfolded ? "expanded" : ""}
                />
              </button>
              <button
                type="button"
                className="part-name"
                disabled={locked}
                aria-pressed={selected}
                onClick={() =>
                  onSelect(avatar.id, { kind: "bone", id: bone.id })
                }
              >
                <FontAwesomeIcon icon={faCube} />
                <span>{bone.label}</span>
              </button>
              <div className="quick-actions">
                <SceneToolButton
                  className={`quick-action ${part?.visible === false ? "is-active" : ""}`}
                  label={`${part?.visible === false ? "Show" : "Hide"} ${bone.label}`}
                  icon={part?.visible === false ? faEyeSlash : faEye}
                  disabled={avatar.locked}
                  onClick={() =>
                    onPartChange(avatar.id, bone.id, {
                      visible: part?.visible === false,
                    })
                  }
                />
                <SceneToolButton
                  className={`quick-action ${part?.locked ? "is-active" : ""}`}
                  label={`${part?.locked ? "Unlock" : "Lock"} ${bone.label}`}
                  icon={part?.locked ? faLock : faLockOpen}
                  disabled={avatar.locked}
                  onClick={() =>
                    onPartChange(avatar.id, bone.id, { locked: !part?.locked })
                  }
                />
              </div>
            </div>
            <motion.div
              className="part-children"
              id={controlsId}
              role="group"
              inert={!unfolded}
              aria-hidden={!unfolded}
              initial={false}
              animate={{
                height: unfolded ? "auto" : 0,
                opacity: unfolded ? 1 : 0,
              }}
              transition={transition}
            >
              {bone.fields.map((field) => (
                <div
                  role="treeitem"
                  aria-label={field.label}
                  aria-selected={
                    selection.kind === "joint" && selection.id === field.key
                  }
                  key={field.key}
                >
                  <button
                    type="button"
                    disabled={locked}
                    aria-pressed={
                      selection.kind === "joint" && selection.id === field.key
                    }
                    onClick={() =>
                      onSelect(avatar.id, { kind: "joint", id: field.key })
                    }
                  >
                    {field.label}
                  </button>
                </div>
              ))}
              {(bone.id === "leftArm" || bone.id === "rightArm") && (
                <div
                  role="treeitem"
                  aria-label={`${bone.label} held item`}
                  aria-selected={
                    selection.kind === "heldItem" && selection.id === bone.id
                  }
                >
                  <button
                    type="button"
                    disabled={locked}
                    aria-pressed={
                      selection.kind === "heldItem" && selection.id === bone.id
                    }
                    onClick={() =>
                      onSelect(avatar.id, {
                        kind: "heldItem",
                        id: bone.id as "leftArm" | "rightArm",
                      })
                    }
                  >
                    Held Item
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        );
      })}
    </motion.div>
  );
}
