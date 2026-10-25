import type {
  AdvancedArmCapTextureOffsets,
  AvatarType,
  HeldItemsState,
  LoadedSkin,
  PoseState,
  PoseBoneId,
  PoseSelection,
} from "../types/editor";
import { NEUTRAL_POSE, getPoseBones } from "../config/pose";
import { createDefaultAdvancedArmCapTextureOffsets } from "../utils/armCapTextureMap";
import { cloneHeldItems } from "../utils/heldItems";
import { normalizeJavaItemAsset, type JavaItemAsset } from "./javaItemModel";
import {
  normalizeRenderAppearance,
  type RenderAppearance,
} from "./renderAppearance";

export type EditorMode = "simple" | "advanced";
export type Triple = [number, number, number];
export type SceneAvatar = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  parts: Partial<Record<PoseBoneId, { visible: boolean; locked: boolean }>>;
  position: Triple;
  rotation: Triple;
  scale: number;
  skin: LoadedSkin;
  avatarType: AvatarType;
  pose: PoseState;
  heldItems: HeldItemsState;
  advancedArmCapTextureOffsets: AdvancedArmCapTextureOffsets;
  showOuterLayer: boolean;
  showOuterLayerIn3d: boolean;
  showHeldItems: boolean;
};
export type SceneCamera = {
  position: Triple;
  target: Triple;
  fov: number;
  roll: number;
  locked: boolean;
};
export function selectedScenePart(
  avatar: SceneAvatar,
  selection: PoseSelection,
) {
  if (selection.kind === "none") return undefined;
  if (selection.kind === "bone" || selection.kind === "heldItem")
    return selection.id;
  return getPoseBones(avatar.avatarType).find((b) =>
    b.fields.some((f) => f.key === selection.id),
  )?.id;
}
export type SceneModel = Pick<
  SceneAvatar,
  "id" | "name" | "visible" | "locked" | "position" | "rotation" | "scale"
> & {
  asset: JavaItemAsset;
};
export type SceneObject = SceneAvatar | SceneModel;
export const MAX_SCENE_MODELS = 32;
export function createSceneModel(
  name: string,
  asset: JavaItemAsset,
): SceneModel {
  return {
    id: crypto.randomUUID(),
    name,
    asset,
    locked: false,
    visible: true,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  };
}
export type EditorScene = {
  avatars: SceneAvatar[];
  models: SceneModel[];
  selectedId: string | null;
  appearance: RenderAppearance;
  camera: SceneCamera;
  background: {
    source: string;
    name: string;
    width: number;
    height: number;
    visible: boolean;
  } | null;
  frame: { width: number; height: number };
  showGrid: boolean;
  gridColor: string | null;
};
export const MAX_SCENE_AVATARS = 12;
export const defaultSceneCamera = (): SceneCamera => ({
  position: [3, 2, 4],
  target: [0, 1, 0],
  fov: 50,
  roll: 0,
  locked: false,
});
export function createSceneAvatar(
  skin: LoadedSkin,
  values: Partial<SceneAvatar> = {},
): SceneAvatar {
  return {
    id: crypto.randomUUID(),
    name: skin.label || "Avatar",
    skin,
    parts: {},
    locked: false,
    visible: true,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
    avatarType: "default",
    pose: { ...NEUTRAL_POSE },
    heldItems: cloneHeldItems(),
    advancedArmCapTextureOffsets: createDefaultAdvancedArmCapTextureOffsets(),
    showOuterLayer: true,
    showOuterLayerIn3d: false,
    showHeldItems: true,
    ...values,
  };
}
export function createEditorScene(
  avatar: SceneAvatar,
  appearance?: RenderAppearance,
): EditorScene {
  return {
    avatars: [avatar],
    models: [],
    selectedId: avatar.id,
    appearance: normalizeRenderAppearance(appearance),
    camera: defaultSceneCamera(),
    background: null,
    frame: { width: 1600, height: 900 },
    showGrid: true,
    gridColor: null,
  };
}
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : fallback;
const triple = (v: unknown, fallback: Triple, limit = 10000): Triple =>
  Array.isArray(v) && v.length === 3
    ? (v.map((n, i) => finite(n, fallback[i]!, -limit, limit)) as Triple)
    : [...fallback];
export function normalizeEditorScene(
  raw: unknown,
  normalizeAvatar: (
    raw: Record<string, any>,
  ) => Pick<
    SceneAvatar,
    "skin" | "pose" | "heldItems" | "advancedArmCapTextureOffsets"
  >,
): EditorScene {
  if (
    !object(raw) ||
    !Array.isArray(raw.avatars) ||
    !raw.avatars.length ||
    raw.avatars.length > MAX_SCENE_AVATARS
  )
    throw new Error(`A scene must contain 1 to ${MAX_SCENE_AVATARS} avatars.`);
  const ids = new Set<string>();
  const avatars = raw.avatars.map((a: unknown): SceneAvatar => {
    if (!object(a)) throw new Error("Invalid scene avatar.");
    const id =
      typeof a.id === "string" && a.id.length <= 100
        ? a.id
        : crypto.randomUUID();
    if (ids.has(id)) throw new Error("Scene avatar IDs must be unique.");
    ids.add(id);
    const normalized = normalizeAvatar(a);
    return createSceneAvatar(normalized.skin, {
      ...normalized,
      id,
      name: typeof a.name === "string" ? a.name.slice(0, 100) : "Avatar",
      visible: a.visible !== false,
      locked: a.locked === true,
      parts: Object.fromEntries(
        getPoseBones("advanced").map(({ id }) => [
          id,
          {
            visible: a.parts?.[id]?.visible !== false,
            locked: a.parts?.[id]?.locked === true,
          },
        ]),
      ),
      position: triple(a.position, [0, 0, 0]),
      rotation: triple(a.rotation, [0, 0, 0], 36000),
      scale: finite(a.scale, 1, 0.05, 20),
      avatarType: ["default", "bobblehead", "advanced", "stylized"].includes(
        a.avatarType,
      )
        ? a.avatarType
        : "default",
      showOuterLayer: a.showOuterLayer !== false,
      showOuterLayerIn3d: a.showOuterLayerIn3d === true,
      showHeldItems: a.showHeldItems !== false,
    });
  });
  if (
    raw.models !== undefined &&
    (!Array.isArray(raw.models) || raw.models.length > MAX_SCENE_MODELS)
  )
    throw new Error(`Scenes support up to ${MAX_SCENE_MODELS} Java models.`);
  const models = (raw.models ?? []).map((m: unknown): SceneModel => {
    if (!object(m)) throw new Error("Invalid scene model.");
    const id =
      typeof m.id === "string" && m.id.length <= 100
        ? m.id
        : crypto.randomUUID();
    if (ids.has(id)) throw new Error("Scene object IDs must be unique.");
    ids.add(id);
    return {
      ...createSceneModel(
        typeof m.name === "string" ? m.name.slice(0, 100) : "Java model",
        normalizeJavaItemAsset(m.asset),
      ),
      id,
      visible: m.visible !== false,
      locked: m.locked === true,
      position: triple(m.position, [0, 0, 0]),
      rotation: triple(m.rotation, [0, 0, 0], 36000),
      scale: finite(m.scale, 1, 0.05, 20),
    };
  });
  const defaults = defaultSceneCamera(),
    c = object(raw.camera) ? raw.camera : {};
  const camera = {
    position: triple(c.position, defaults.position),
    target: triple(c.target, defaults.target),
    fov: finite(c.fov, 50, 10, 120),
    roll: finite(c.roll, 0, -180, 180),
    locked: c.locked === true,
  };
  if (camera.position.every((v, i) => Math.abs(v - camera.target[i]!) < 0.001))
    camera.position[2] += 6;
  let background: EditorScene["background"] = null;
  if (raw.background != null) {
    const b = raw.background;
    if (
      !object(b) ||
      typeof b.source !== "string" ||
      b.source.length > 24 * 1024 * 1024 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.source)
    )
      throw new Error(
        "Scene backgrounds must be embedded PNG, JPEG or WebP images under 18 MB.",
      );
    background = {
      source: b.source,
      name: String(b.name ?? "Background").slice(0, 100),
      width: finite(b.width, 1600, 1, 8192),
      height: finite(b.height, 900, 1, 8192),
      visible: b.visible !== false,
    };
  }
  return {
    avatars,
    models,
    selectedId: ids.has(raw.selectedId) ? raw.selectedId : avatars[0]!.id,
    appearance: normalizeRenderAppearance(raw.appearance),
    camera,
    background,
    frame: {
      width: Math.round(finite(raw.frame?.width, 1600, 64, 4096)),
      height: Math.round(finite(raw.frame?.height, 900, 64, 4096)),
    },
    showGrid: raw.showGrid !== false,
    gridColor:
      typeof raw.gridColor === "string" && /^#[0-9a-f]{6}$/i.test(raw.gridColor)
        ? raw.gridColor
        : null,
  };
}

export async function readSceneImage(
  file: File,
  skin = false,
): Promise<string> {
  if (
    file.size > 18 * 1024 * 1024 ||
    !/\.(png|jpe?g|webp)$/i.test(file.name) ||
    (skin && !/\.png$/i.test(file.name))
  )
    throw new Error(
      skin
        ? "Choose a PNG skin under 18 MB."
        : "Choose a PNG, JPEG or WebP image under 18 MB.",
    );
  const image = await createImageBitmap(file);
  const { width, height } = image;
  image.close();
  if (width > (skin ? 2048 : 8192) || height > (skin ? 2048 : 8192))
    throw new Error("That image is too large.");
  if (
    skin &&
    (width < 64 ||
      width % 64 !== 0 ||
      (height !== width && height * 2 !== width))
  )
    throw new Error(
      "Choose a Minecraft skin with square or legacy 2:1 dimensions.",
    );
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
}
