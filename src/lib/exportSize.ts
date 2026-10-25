import type { WebGLRenderer } from "three";

export function validateExportSize(
  size: { width: number; height: number },
  renderer: WebGLRenderer,
) {
  if (![size.width, size.height].every((n) => Number.isSafeInteger(n) && n > 0))
    throw new Error("Export dimensions must be positive whole numbers.");
  const gl = renderer.getContext();
  const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
  const buffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
  const ratio = renderer.getPixelRatio();
  const maxWidth = Math.floor(
    Math.min(viewport[0]!, buffer, renderer.capabilities.maxTextureSize) /
      ratio,
  );
  const maxHeight = Math.floor(
    Math.min(viewport[1]!, buffer, renderer.capabilities.maxTextureSize) /
      ratio,
  );
  if (size.width > maxWidth || size.height > maxHeight)
    throw new Error(
      `This browser can render up to ${maxWidth} × ${maxHeight} pixels. Choose smaller export dimensions.`,
    );
}
