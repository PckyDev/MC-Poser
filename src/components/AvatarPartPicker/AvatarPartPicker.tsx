import type { PoseBoneId } from "../../types/editor";
import "./AvatarPartPicker.css";

const parts: { id: PoseBoneId; label: string }[] = [
  { id: "head", label: "Head" },
  { id: "torso", label: "Torso" },
  { id: "rightArm", label: "Right arm" },
  { id: "leftArm", label: "Left arm" },
  { id: "rightLeg", label: "Right leg" },
  { id: "leftLeg", label: "Left leg" },
];

export function AvatarPartPicker({
  selected,
  onSelect,
  lockedParts = [],
}: {
  selected: PoseBoneId | null;
  onSelect: (id: PoseBoneId) => void;
  lockedParts?: string[];
}) {
  return (
    <div
      className="avatar-part-picker"
      role="group"
      aria-label="Avatar pose selector"
    >
      {parts.map((part) => (
        <button
          key={part.id}
          type="button"
          className={part.id}
          aria-label={`Select ${part.label.toLowerCase()}`}
          title={part.label}
          aria-pressed={selected === part.id}
          disabled={lockedParts.includes(part.id)}
          onClick={() => onSelect(part.id)}
        />
      ))}
    </div>
  );
}
