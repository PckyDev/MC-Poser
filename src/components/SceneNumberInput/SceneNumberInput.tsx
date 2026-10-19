import { useState, type InputHTMLAttributes } from "react";
import "./SceneNumberInput.css";

type SceneNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "type"
> & { value: number };

export function SceneNumberInput({
  value,
  className = "",
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: SceneNumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  return (
    <input
      {...props}
      className={`scene-number-input ${className}`.trim()}
      type="number"
      value={editing ? draft : String(value)}
      onFocus={(event) => {
        setDraft(String(value));
        setEditing(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        // Keep partial numbers intact while typing, even when the scene clamps
        // the current numeric value or the input temporarily contains only '-'.
        setDraft(event.currentTarget.value);
        onChange?.(event);
      }}
      onBlur={(event) => {
        setEditing(false);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Enter" && !event.defaultPrevented)
          event.currentTarget.blur();
      }}
    />
  );
}
