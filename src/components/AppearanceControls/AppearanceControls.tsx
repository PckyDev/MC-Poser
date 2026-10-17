import { useId } from "react";
import type { RenderAppearance } from "../../lib/renderAppearance";
import "./AppearanceControls.css";

export function AppearanceControls({ value, onChange }: {
  value: RenderAppearance;
  onChange: (value: RenderAppearance) => void;
}) {
  const id = useId();
  return (
    <div className="appearance-controls">
      <label className="mode">
        <span>Render style</span>
        <select value={value.mode} onChange={(event) => onChange({ ...value, mode: event.target.value as RenderAppearance["mode"] })}>
          <option value="classic">Classic</option>
          <option value="stylized">Stylized</option>
        </select>
      </label>
      {value.mode === "stylized" ? (
        <>
          {([
            ["brightness", "Brightness", 0.6, 1.5],
            ["warmth", "Warmth", 0, 1],
            ["glow", "Glow", 0, 1],
          ] as const).map(([key, label, min, max]) => (
            <label className="control" key={key} htmlFor={`${id}-${key}`}>
              <span>{label} <output>{Math.round(value[key] * 100)}%</output></span>
              <input id={`${id}-${key}`} aria-label={label} title={key === "glow" ? "Increase the strength and inward spread of the soft rear-edge highlight" : undefined} className="editor-range" type="range" min={min} max={max} step={0.01}
                value={value[key]} onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })} />
            </label>
          ))}
        </>
      ) : null}
    </div>
  );
}
