import { useEffect, useState } from "react";

import { getPoseBones } from "../../config/pose";
import type { AvatarType, PoseSelection, PoseState } from "../../types/editor";

type RightSidebarProps = {
  avatarType: AvatarType;
  selectedSelection: PoseSelection;
  pose: PoseState;
  showOuterLayer: boolean;
  showOuterLayerIn3d: boolean;
  onUpdatePose: (key: keyof PoseState, value: number) => void;
  onToggleOuterLayer: (checked: boolean) => void;
  onToggleOuterLayerIn3d: (checked: boolean) => void;
};

export function RightSidebar({
  avatarType,
  selectedSelection,
  pose,
  showOuterLayer,
  showOuterLayerIn3d,
  onUpdatePose,
  onToggleOuterLayer,
  onToggleOuterLayerIn3d,
}: RightSidebarProps) {
  const visibleBones = getPoseBones(avatarType);
  const [editingFieldKey, setEditingFieldKey] = useState<keyof PoseState | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const fallbackBone = visibleBones[0]!;

  const selectedBone =
    selectedSelection.kind === "bone"
      ? visibleBones.find((bone) => bone.id === selectedSelection.id) ?? fallbackBone
      : visibleBones.find((bone) => bone.fields.some((field) => field.key === selectedSelection.id)) ?? fallbackBone;

  const selectedFields =
    selectedSelection.kind === "bone"
      ? selectedBone.fields
      : selectedBone.fields.filter((field) => field.key === selectedSelection.id);

  const selectionTitle =
    selectedSelection.kind === "bone"
      ? selectedBone.label
      : (selectedFields[0]?.label ?? selectedBone.label);

  useEffect(() => {
    setEditingFieldKey(null);
    setEditingValue("");
  }, [selectedSelection]);

  function startEditingField(fieldKey: keyof PoseState): void {
    setEditingFieldKey(fieldKey);
    setEditingValue(String(pose[fieldKey]));
  }

  function cancelEditingField(): void {
    setEditingFieldKey(null);
    setEditingValue("");
  }

  function commitEditingField(fieldKey: keyof PoseState, min: number, max: number): void {
    const parsedValue = Number(editingValue);

    if (!Number.isFinite(parsedValue)) {
      cancelEditingField();
      return;
    }

    const clampedValue = Math.min(max, Math.max(min, Math.round(parsedValue)));
    onUpdatePose(fieldKey, clampedValue);
    cancelEditingField();
  }

  return (
    <aside className="editor-sidebar editor-sidebar--right">
      <section className="editor-panel editor-panel--stretch">
        <div className="panel-heading">
          <div>
            <h2>{selectionTitle}</h2>
          </div>
        </div>

        <div className="panel-content panel-content--scroll panel-content--stacked">
          <div className="slider-stack">
            {selectedFields.map((field) => (
              <div key={field.key} className="slider-item">
                <div className="slider-header">
                  <span>{field.label}</span>

                  {editingFieldKey === field.key ? (
                    <input
                      className="slider-value-input"
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={1}
                      autoFocus
                      value={editingValue}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onBlur={() => commitEditingField(field.key, field.min, field.max)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitEditingField(field.key, field.min, field.max);
                        }

                        if (event.key === "Escape") {
                          cancelEditingField();
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="slider-value-button"
                      type="button"
                      onClick={() => startEditingField(field.key)}
                    >
                      {pose[field.key]}°
                    </button>
                  )}
                </div>
                <input
                  className="editor-range"
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={1}
                  value={pose[field.key]}
                  onChange={(event) => onUpdatePose(field.key, Number(event.target.value))}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="editor-panel">
        <div className="panel-heading">
          <div>
            <h2>Render options</h2>
          </div>
        </div>

        <div className="panel-content panel-content--stacked">
          <label className="toggle-row">
            <span>Show outer layer</span>
            <input
              type="checkbox"
              checked={showOuterLayer}
              onChange={(event) => onToggleOuterLayer(event.target.checked)}
            />
          </label>

          <label className="toggle-row">
            <span>3D outer layer</span>
            <input
              type="checkbox"
              checked={showOuterLayerIn3d}
              onChange={(event) => onToggleOuterLayerIn3d(event.target.checked)}
            />
          </label>
        </div>
      </section>
    </aside>
  );
}
