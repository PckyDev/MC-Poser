export type RenderAppearance = {
  mode: "classic" | "stylized";
  brightness: number;
  warmth: number;
  glow: number;
};

export function normalizeRenderAppearance(value?: unknown): RenderAppearance {
  const input = value && typeof value === "object" ? value as Partial<RenderAppearance> : {};
  const bounded = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  return {
    mode: input.mode === "stylized" ? "stylized" : "classic",
    brightness: bounded(input.brightness, 1, 0.6, 1.5),
    warmth: bounded(input.warmth, 0.65, 0, 1),
    glow: bounded(input.glow, 0.35, 0, 1),
  };
}
