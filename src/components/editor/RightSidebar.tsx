import { useEffect, useState } from "react";

import { getPoseBones } from "../../config/pose";
import type {
  AvatarType,
  HeldItemAdjustments,
  HeldItem,
  HeldItemArmId,
  HeldItemsState,
  PoseSelection,
  PoseState,
} from "../../types/editor";
import {
  areHeldItemAdjustmentsDefault,
  formatHeldItemArmLabel,
} from "../../utils/heldItems";

type HeldItemAdjustmentField = {
  key: keyof HeldItemAdjustments;
  label: string;
  max: number;
  min: number;
  step: number;
  suffix?: string;
};

type HeldItemAdjustmentSection = {
  fields: HeldItemAdjustmentField[];
  title: string;
};

const HELD_ITEM_ADJUSTMENT_SECTIONS: HeldItemAdjustmentSection[] = [
  {
    title: "Offset",
    fields: [
      { key: "offsetX", label: "Offset X", min: -4, max: 4, step: 0.05 },
      { key: "offsetY", label: "Offset Y", min: -8, max: 8, step: 0.05 },
      { key: "offsetZ", label: "Offset Z", min: -8, max: 8, step: 0.05 },
    ],
  },
  {
    title: "Rotation",
    fields: [
      { key: "rotationX", label: "Rotate X", min: -180, max: 180, step: 1, suffix: "°" },
      { key: "rotationY", label: "Rotate Y", min: -180, max: 180, step: 1, suffix: "°" },
      { key: "rotationZ", label: "Rotate Z", min: -180, max: 180, step: 1, suffix: "°" },
    ],
  },
  {
    title: "Appearance",
    fields: [
      { key: "scale", label: "Scale", min: 0.2, max: 3, step: 0.01, suffix: "x" },
      { key: "thickness", label: "Thickness", min: 0.2, max: 3, step: 0.01, suffix: "x" },
    ],
  },
];

function getStepPrecision(step: number): number {
  const stepText = String(step);
  const decimalIndex = stepText.indexOf(".");

  return decimalIndex === -1 ? 0 : stepText.length - decimalIndex - 1;
}

function clampStepValue(value: number, min: number, max: number, step: number): number {
  const precision = getStepPrecision(step);
  const clampedValue = Math.min(max, Math.max(min, value));
  const steppedValue = Math.round(clampedValue / step) * step;

  return Number(steppedValue.toFixed(precision));
}

function formatHeldItemAdjustmentValue(field: HeldItemAdjustmentField, value: number): string {
  const precision = getStepPrecision(field.step);
  const formattedValue = precision > 0 ? value.toFixed(precision) : String(Math.round(value));

  return field.suffix ? `${formattedValue}${field.suffix}` : formattedValue;
}

type RightSidebarProps = {
  avatarType: AvatarType;
  heldItems: HeldItemsState;
  selectedSelection: PoseSelection;
  pose: PoseState;
  showOuterLayer: boolean;
  showOuterLayerIn3d: boolean;
  showHeldItems: boolean;
  onOpenHeldItemModal: (armId: HeldItemArmId) => void;
  onRemoveHeldItem: (armId: HeldItemArmId) => void;
  onResetHeldItemAdjustments: (armId: HeldItemArmId) => void;
  onUpdateHeldItemAdjustment: (armId: HeldItemArmId, key: keyof HeldItemAdjustments, value: number) => void;
  onUpdatePose: (key: keyof PoseState, value: number) => void;
  onToggleHeldItems: (checked: boolean) => void;
  onToggleOuterLayer: (checked: boolean) => void;
  onToggleOuterLayerIn3d: (checked: boolean) => void;
};

export function RightSidebar({
  avatarType,
  heldItems,
  selectedSelection,
  pose,
  showOuterLayer,
  showOuterLayerIn3d,
  showHeldItems,
  onOpenHeldItemModal,
  onRemoveHeldItem,
  onResetHeldItemAdjustments,
  onUpdateHeldItemAdjustment,
  onUpdatePose,
  onToggleHeldItems,
  onToggleOuterLayer,
  onToggleOuterLayerIn3d,
}: RightSidebarProps) {
  const visibleBones = getPoseBones(avatarType);
  const [editingFieldKey, setEditingFieldKey] = useState<keyof PoseState | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingHeldItemKey, setEditingHeldItemKey] = useState<keyof HeldItemAdjustments | null>(null);
  const [editingHeldItemValue, setEditingHeldItemValue] = useState("");
  const fallbackBone = visibleBones[0]!;
  const selectedHeldItemArmId =
    selectedSelection.kind === "heldItem"
      ? selectedSelection.id
      : selectedSelection.kind === "bone" && (selectedSelection.id === "leftArm" || selectedSelection.id === "rightArm")
        ? selectedSelection.id
        : null;

  const selectedBone =
    selectedSelection.kind === "bone"
      ? visibleBones.find((bone) => bone.id === selectedSelection.id) ?? fallbackBone
      : selectedSelection.kind === "heldItem"
        ? visibleBones.find((bone) => bone.id === selectedSelection.id) ?? fallbackBone
        : visibleBones.find((bone) => bone.fields.some((field) => field.key === selectedSelection.id)) ?? fallbackBone;

  const selectedFields =
    selectedSelection.kind === "bone"
      ? selectedBone.fields
      : selectedSelection.kind === "heldItem"
        ? []
        : selectedBone.fields.filter((field) => field.key === selectedSelection.id);

  const selectionTitle =
    selectedSelection.kind === "bone"
      ? selectedBone.label
      : selectedSelection.kind === "heldItem"
        ? `${formatHeldItemArmLabel(selectedSelection.id)} Held Item`
        : (selectedFields[0]?.label ?? selectedBone.label);
  const heldItem = selectedHeldItemArmId ? heldItems[selectedHeldItemArmId] : null;

  useEffect(() => {
    setEditingFieldKey(null);
    setEditingValue("");
    setEditingHeldItemKey(null);
    setEditingHeldItemValue("");
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

  function startEditingHeldItemField(field: HeldItemAdjustmentField, value: number): void {
    setEditingHeldItemKey(field.key);
    setEditingHeldItemValue(String(value));
  }

  function cancelEditingHeldItemField(): void {
    setEditingHeldItemKey(null);
    setEditingHeldItemValue("");
  }

  function commitEditingHeldItemField(
    armId: HeldItemArmId,
    field: HeldItemAdjustmentField,
  ): void {
    const parsedValue = Number(editingHeldItemValue);

    if (!Number.isFinite(parsedValue)) {
      cancelEditingHeldItemField();
      return;
    }

    onUpdateHeldItemAdjustment(
      armId,
      field.key,
      clampStepValue(parsedValue, field.min, field.max, field.step),
    );
    cancelEditingHeldItemField();
  }

  function renderHeldItemSection(targetArmId: HeldItemArmId, targetItem: HeldItem | null) {
    return (
      <section className="held-item-section">
        <div className="modal-section-header">
          <h3>Held item</h3>
          <p className="modal-section-copy">
            Assign a voxelized item texture to the {formatHeldItemArmLabel(targetArmId).toLowerCase()}.
          </p>
        </div>

        {targetItem ? (
          <div className="held-item-card">
            <div className="held-item-preview-row">
              <div className="held-item-preview-frame">
                <img
                  className="held-item-preview-image"
                  src={targetItem.source}
                  alt={`${targetItem.label} held item preview`}
                />
              </div>

              <div className="held-item-preview-copy">
                <strong>{targetItem.label}</strong>
                <span>{targetItem.detail}</span>
              </div>
            </div>

            <div className="held-item-actions">
              <button
                className="toolbar-button"
                type="button"
                onClick={() => onOpenHeldItemModal(targetArmId)}
              >
                Change Item
              </button>
              <button
                className="toolbar-button"
                type="button"
                onClick={() => onRemoveHeldItem(targetArmId)}
              >
                Remove Item
              </button>
            </div>

            <div className="held-item-controls">
              <div className="held-item-controls-header">
                <div>
                  <div className="section-header">Item controls</div>
                  <p className="panel-note">
                    Adjust the item placement, rotation, scale, and voxel depth.
                  </p>
                </div>

                <button
                  className="toolbar-button"
                  type="button"
                  disabled={areHeldItemAdjustmentsDefault(targetItem.adjustments)}
                  onClick={() => onResetHeldItemAdjustments(targetArmId)}
                >
                  Reset to Default
                </button>
              </div>

              {HELD_ITEM_ADJUSTMENT_SECTIONS.map((section) => (
                <div key={section.title} className="held-item-control-group">
                  <div className="section-header">{section.title}</div>

                  <div className="slider-stack">
                    {section.fields.map((field) => {
                      const currentValue = targetItem.adjustments[field.key];

                      return (
                        <div key={field.key} className="slider-item">
                          <div className="slider-header">
                            <span>{field.label}</span>

                            {editingHeldItemKey === field.key ? (
                              <input
                                className="slider-value-input"
                                type="number"
                                min={field.min}
                                max={field.max}
                                step={field.step}
                                autoFocus
                                value={editingHeldItemValue}
                                onChange={(event) => setEditingHeldItemValue(event.target.value)}
                                onBlur={() => commitEditingHeldItemField(targetArmId, field)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    commitEditingHeldItemField(targetArmId, field);
                                  }

                                  if (event.key === "Escape") {
                                    cancelEditingHeldItemField();
                                  }
                                }}
                              />
                            ) : (
                              <button
                                className="slider-value-button"
                                type="button"
                                onClick={() => startEditingHeldItemField(field, currentValue)}
                              >
                                {formatHeldItemAdjustmentValue(field, currentValue)}
                              </button>
                            )}
                          </div>

                          <input
                            className="editor-range"
                            type="range"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={currentValue}
                            onChange={(event) => {
                              onUpdateHeldItemAdjustment(
                                targetArmId,
                                field.key,
                                clampStepValue(Number(event.target.value), field.min, field.max, field.step),
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="held-item-card held-item-card--empty">
            <p className="panel-note">
              No held item is assigned to the {formatHeldItemArmLabel(targetArmId).toLowerCase()} yet.
            </p>

            <div className="held-item-actions">
              <button
                className="toolbar-button toolbar-button--accent"
                type="button"
                onClick={() => onOpenHeldItemModal(targetArmId)}
              >
                Add Item
              </button>
            </div>
          </div>
        )}
      </section>
    );
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
          {selectedFields.length > 0 ? (
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
          ) : null}

          {selectedHeldItemArmId ? renderHeldItemSection(selectedHeldItemArmId, heldItem) : null}
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

          <label className="toggle-row">
            <span>Show held items</span>
            <input
              type="checkbox"
              checked={showHeldItems}
              onChange={(event) => onToggleHeldItems(event.target.checked)}
            />
          </label>
        </div>
      </section>
    </aside>
  );
}
