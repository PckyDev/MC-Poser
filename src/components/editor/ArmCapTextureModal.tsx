import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

import type {
  ArmModel,
  AdvancedArmCapTextureOffsets,
  ArmCapTextureOffset,
  ArmCapTextureTarget,
  HeldItemArmId,
} from "../../types/editor";
import {
  SKIN_TEXTURE_GRID_SIZE,
  clampArmCapTextureOffset,
  getArmCapTextureBaseRegion,
  getArmCapTextureSelectionRect,
  getArmCapTextureSelectionBounds,
  getArmCapTextureTargetLabel,
} from "../../utils/armCapTextureMap";
import { formatHeldItemArmLabel } from "../../utils/heldItems";

type ArmCapTextureModalProps = {
  armId: HeldItemArmId | null;
  currentOffsets: AdvancedArmCapTextureOffsets;
  isOpen: boolean;
  modelType: ArmModel;
  skinSource: string | null;
  target: ArmCapTextureTarget | null;
  onClose: () => void;
  onSave: (armId: HeldItemArmId, target: ArmCapTextureTarget, offset: ArmCapTextureOffset) => void;
};

function toSelectionStyle(region: {
  u: number;
  v: number;
  width: number;
  height: number;
}): CSSProperties {
  return {
    left: `${(region.u / SKIN_TEXTURE_GRID_SIZE) * 100}%`,
    top: `${(region.v / SKIN_TEXTURE_GRID_SIZE) * 100}%`,
    width: `${(region.width / SKIN_TEXTURE_GRID_SIZE) * 100}%`,
    height: `${(region.height / SKIN_TEXTURE_GRID_SIZE) * 100}%`,
  };
}

export function ArmCapTextureModal({
  armId,
  currentOffsets,
  isOpen,
  modelType,
  skinSource,
  target,
  onClose,
  onSave,
}: ArmCapTextureModalProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [draftOffset, setDraftOffset] = useState<ArmCapTextureOffset>({ u: 0, v: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isOpen || !armId || !target) {
      return;
    }

    setDraftOffset(currentOffsets[armId][target]);
  }, [armId, currentOffsets, isOpen, target]);

  if (!isOpen || !armId || !target || !skinSource) {
    return null;
  }

  const activeArmId = armId;
  const activeTarget = target;
  const armLabel = formatHeldItemArmLabel(activeArmId);
  const targetLabel = getArmCapTextureTargetLabel(target);
  const baseRegion = getArmCapTextureBaseRegion(activeArmId, modelType);
  const selectionBounds = getArmCapTextureSelectionBounds(activeArmId, modelType);
  const selectedRegion = getArmCapTextureSelectionRect(activeArmId, modelType, draftOffset);
  const isDefaultOffset = draftOffset.u === 0 && draftOffset.v === 0;

  function updateOffsetFromAbsolutePosition(u: number, v: number): void {
    setDraftOffset(
      clampArmCapTextureOffset(activeArmId, modelType, {
        u: u - baseRegion.u,
        v: v - baseRegion.v,
      }),
    );
  }

  function updateOffsetFromPointer(clientX: number, clientY: number): void {
    const stageBounds = stageRef.current?.getBoundingClientRect();

    if (!stageBounds) {
      return;
    }

    const pointerU = Math.round(
      ((clientX - stageBounds.left) / Math.max(stageBounds.width, 1)) * SKIN_TEXTURE_GRID_SIZE -
        baseRegion.width / 2,
    );
    const pointerV = Math.round(
      ((clientY - stageBounds.top) / Math.max(stageBounds.height, 1)) * SKIN_TEXTURE_GRID_SIZE -
        baseRegion.height / 2,
    );

    updateOffsetFromAbsolutePosition(pointerU, pointerV);
  }

  return (
    <div className="document-overlay">
      <div
        className="document-modal arm-cap-map-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arm-cap-map-modal-title"
      >
        <div className="document-header modal-header">
          <div>
            <h2 id="arm-cap-map-modal-title">Map {targetLabel.toLowerCase()}</h2>
            <p className="document-copy modal-copy">
              Move the skin area used for the {targetLabel.toLowerCase()} on the {armLabel.toLowerCase()}. The elbow cap renders on the base layer only.
            </p>
          </div>

          <div className="document-header-actions">
            <button
              className="icon-button modal-close-button"
              type="button"
              aria-label="Close arm cap texture modal"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        <div className="arm-cap-map-modal-body">
          <section className="modal-page-section arm-cap-map-preview-panel">
            <div
              ref={stageRef}
              className="arm-cap-map-stage"
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return;
                }

                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setIsDragging(true);
                updateOffsetFromPointer(event.clientX, event.clientY);
              }}
              onPointerMove={(event) => {
                if (!isDragging) {
                  return;
                }

                updateOffsetFromPointer(event.clientX, event.clientY);
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }

                setIsDragging(false);
              }}
              onPointerCancel={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }

                setIsDragging(false);
              }}
            >
              <img
                className="arm-cap-map-image"
                src={skinSource}
                alt={`${armLabel} skin texture`}
              />
              <div className="arm-cap-map-grid" aria-hidden="true" />
              <div
                className="arm-cap-map-default-region"
                style={toSelectionStyle(baseRegion)}
                aria-hidden="true"
              />
              <div
                className="arm-cap-map-selection"
                style={toSelectionStyle(selectedRegion)}
                aria-hidden="true"
              />
            </div>
          </section>

          <aside className="modal-page-section arm-cap-map-sidebar">
            <div className="modal-section-header">
              <h3>Coordinates</h3>
              <p className="modal-section-copy">
                Use exact texture coordinates when you need a precise cap placement.
              </p>
            </div>

            <div className="arm-cap-map-coordinate-grid">
              <label className="arm-cap-map-coordinate-field" htmlFor="arm-cap-map-u-input">
                <span className="form-label">U</span>
                <input
                  id="arm-cap-map-u-input"
                  className="editor-input"
                  type="number"
                  min={selectionBounds.minU}
                  max={selectionBounds.maxU}
                  step={1}
                  value={selectedRegion.u}
                  onChange={(event) => {
                    const nextValue = event.target.valueAsNumber;

                    if (!Number.isFinite(nextValue)) {
                      return;
                    }

                    updateOffsetFromAbsolutePosition(nextValue, selectedRegion.v);
                  }}
                />
              </label>

              <label className="arm-cap-map-coordinate-field" htmlFor="arm-cap-map-v-input">
                <span className="form-label">V</span>
                <input
                  id="arm-cap-map-v-input"
                  className="editor-input"
                  type="number"
                  min={selectionBounds.minV}
                  max={selectionBounds.maxV}
                  step={1}
                  value={selectedRegion.v}
                  onChange={(event) => {
                    const nextValue = event.target.valueAsNumber;

                    if (!Number.isFinite(nextValue)) {
                      return;
                    }

                    updateOffsetFromAbsolutePosition(selectedRegion.u, nextValue);
                  }}
                />
              </label>
            </div>

            <div className="arm-cap-map-meta">
              <p className="panel-note">
                Default anchor: U {baseRegion.u}, V {baseRegion.v}
              </p>
              <p className="panel-note">
                Sample size: {selectedRegion.width} x {selectedRegion.height} px
              </p>
            </div>

            <div className="arm-cap-map-actions">
              <button
                className="toolbar-button"
                type="button"
                disabled={isDefaultOffset}
                onClick={() => setDraftOffset({ u: 0, v: 0 })}
              >
                Reset to Default
              </button>
              <button className="toolbar-button" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="toolbar-button toolbar-button--accent"
                type="button"
                onClick={() => onSave(activeArmId, activeTarget, draftOffset)}
              >
                Apply Mapping
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}