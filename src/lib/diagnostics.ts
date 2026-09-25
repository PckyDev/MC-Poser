import type { SkinViewer } from "skinview3d";
import packageInfo from "../../package.json";

const recentErrors: { at: string; kind: string; message: string }[] = [];

export function diagnosticText(value: string): string {
  return value.replace(/https?:\/\/[^\s)"<>]+/g, (value) => {
    try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
    catch { return "[URL]"; }
  }).slice(0, 8000);
}

export function installDiagnosticErrorCapture(): void {
  const record = (kind: string, message: string) => {
    recentErrors.push({ at: new Date().toISOString(), kind, message: diagnosticText(message) });
    if (recentErrors.length > 50) recentErrors.shift();
  };
  window.addEventListener("error", (event) => record("error", event.error instanceof Error
    ? event.error.stack ?? event.message : event.message));
  window.addEventListener("unhandledrejection", (event) => record("unhandledrejection",
    event.reason instanceof Error ? event.reason.stack ?? event.reason.message
      : typeof event.reason === "string" ? event.reason : "Non-text promise rejection"));
}

export function collectDiagnostics(viewer: SkinViewer | null, warnings: string[]) {
  let rendering: unknown = null;
  try {
    if (viewer) {
      const renderer = viewer.renderer;
      const gl = renderer.getContext();
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const texture = viewer.playerObject.skin.map?.image as HTMLCanvasElement | undefined;
      rendering = {
        contextLost: gl.isContextLost(),
        gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        version: gl.getParameter(gl.VERSION),
        maxTextureSize: renderer.capabilities.maxTextureSize,
        precision: renderer.capabilities.precision,
        pixelRatio: renderer.getPixelRatio(),
        canvas: { width: renderer.domElement.width, height: renderer.domElement.height },
        memory: { ...renderer.info.memory }, render: { ...renderer.info.render },
        camera: { position: viewer.camera.position.toArray(), quaternion: viewer.camera.quaternion.toArray(),
          fov: viewer.camera.fov, zoom: viewer.camera.zoom, near: viewer.camera.near, far: viewer.camera.far,
          target: viewer.controls.target.toArray() },
        normalizedSkin: texture ? { width: texture.width, height: texture.height } : null,
      };
    }
  } catch { warnings.push("Rendering details could not be fully collected."); }
  return {
    format: "mc-poser-diagnostics", schemaVersion: 1, createdAt: new Date().toISOString(),
    app: { version: packageInfo.version, mode: import.meta.env.MODE,
      build: __APP_BUILD__, dependencies: packageInfo.dependencies },
    privacy: "Contains active document images, labels, and diagnostic errors. Review before sharing. No automatic upload. Cookies, browser storage, other documents, and page query/hash are not collected.",
    reproduction: "Save workspace as a .mcpose JSON file and use File > Open. Camera, lighting, and export settings are recorded separately in editor/rendering.",
    environment: {
      origin: location.origin, userAgent: navigator.userAgent, languages: navigator.languages,
      platform: navigator.platform, online: navigator.onLine, hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio, viewport: { width: innerWidth, height: innerHeight },
      screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
      uptimeMs: Math.round(performance.now()),
    },
    rendering, recentErrors: recentErrors.map((entry) => ({ ...entry })), warnings,
  };
}

export async function embedDiagnosticAsset<T extends { source: string }>(asset: T | null, label: string, warnings: string[]): Promise<T | null> {
  if (!asset) return null;
  if (asset.source.startsWith("data:image/png;base64,")) return { ...asset };
  try {
    const response = await fetch(asset.source, { signal: AbortSignal.timeout(8000), credentials: "omit" });
    if (!response.ok) throw new Error("Asset unavailable");
    const blob = await response.blob();
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Asset read failed"));
      reader.readAsDataURL(blob);
    });
    return { ...asset, source };
  } catch {
    warnings.push(`${label} could not be embedded. Reproduction requires the original image.`);
    return { ...asset, source: "" };
  }
}
