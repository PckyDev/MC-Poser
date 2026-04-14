import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from "three";

import appleItemUrl from "../img/items/apple.png";
import bookItemUrl from "../img/items/book.png";
import diamondItemUrl from "../img/items/diamond.png";
import diamondPickaxeItemUrl from "../img/items/diamond_pickaxe.png";
import diamondSwordItemUrl from "../img/items/diamond_sword.png";

import type {
  HeldItemAdjustments,
  HeldItem,
  HeldItemArmId,
  HeldItemPresetId,
  HeldItemsState,
  HeldItemSourceKind,
} from "../types/editor";

type TexturePixelSource = {
  data: Uint8ClampedArray;
  height: number;
  width: number;
};

type TexturePixelSample = {
  alpha: number;
  blue: number;
  green: number;
  red: number;
};

type PresetDefinition = {
  detail: string;
  id: HeldItemPresetId;
  label: string;
  previewUrl: string;
};

const HELD_ITEM_MAX_TEXTURE_EDGE = 32;
const HELD_ITEM_TEMPLATE_GEOMETRY = new BoxGeometry(1, 1, 1).toNonIndexed();
const HELD_ITEM_TEMPLATE_POSITIONS = Array.from(
  HELD_ITEM_TEMPLATE_GEOMETRY.getAttribute("position").array as Float32Array,
);
const HELD_ITEM_TEMPLATE_NORMALS = Array.from(
  HELD_ITEM_TEMPLATE_GEOMETRY.getAttribute("normal").array as Float32Array,
);
const HELD_ITEM_BASE_VOXEL_THICKNESS = 0.78;
const HELD_ITEM_FACE_SHADING = [0.82, 0.82, 1.08, 0.68, 1, 0.9];

const PRESET_DEFINITIONS: PresetDefinition[] = [
  {
    detail: "Preset item texture",
    id: "diamondSword",
    label: "Diamond Sword",
    previewUrl: diamondSwordItemUrl,
  },
  {
    detail: "Preset item texture",
    id: "diamondPickaxe",
    label: "Diamond Pickaxe",
    previewUrl: diamondPickaxeItemUrl,
  },
  {
    detail: "Preset item texture",
    id: "apple",
    label: "Apple",
    previewUrl: appleItemUrl,
  },
  {
    detail: "Preset item texture",
    id: "diamond",
    label: "Diamond",
    previewUrl: diamondItemUrl,
  },
  {
    detail: "Preset item texture",
    id: "book",
    label: "Book",
    previewUrl: bookItemUrl,
  },
];

export const HELD_ITEM_ARM_IDS = ["leftArm", "rightArm"] as const satisfies readonly HeldItemArmId[];
export const EMPTY_HELD_ITEMS: HeldItemsState = {
  leftArm: null,
  rightArm: null,
};
export const DEFAULT_HELD_ITEM_ADJUSTMENTS: HeldItemAdjustments = {
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scale: 1,
  thickness: 1,
};

export const HELD_ITEM_PRESETS = PRESET_DEFINITIONS.map((definition) => ({
  detail: definition.detail,
  id: definition.id,
  label: definition.label,
  previewUrl: definition.previewUrl,
}));

function getHeldItemPresetEntry(presetId: HeldItemPresetId) {
  return HELD_ITEM_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function cloneHeldItemAdjustments(
  adjustments: Partial<HeldItemAdjustments> = DEFAULT_HELD_ITEM_ADJUSTMENTS,
): HeldItemAdjustments {
  return {
    ...DEFAULT_HELD_ITEM_ADJUSTMENTS,
    ...adjustments,
  };
}

export function createDefaultHeldItemAdjustments(): HeldItemAdjustments {
  return cloneHeldItemAdjustments();
}

export function areHeldItemAdjustmentsDefault(
  adjustments: Partial<HeldItemAdjustments> | null | undefined,
): boolean {
  const normalizedAdjustments = cloneHeldItemAdjustments(adjustments ?? undefined);

  return Object.entries(DEFAULT_HELD_ITEM_ADJUSTMENTS).every(([key, value]) => {
    return normalizedAdjustments[key as keyof HeldItemAdjustments] === value;
  });
}

function cloneHeldItem(item: HeldItem | null): HeldItem | null {
  return item
    ? {
        ...item,
        adjustments: cloneHeldItemAdjustments(item.adjustments),
      }
    : null;
}

function loadImageFromSource(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load that held-item texture."));
    image.src = source;
  });
}

function sampleTexturePixel(
  pixelSource: TexturePixelSource,
  x: number,
  y: number,
): TexturePixelSample {
  if (x < 0 || x >= pixelSource.width || y < 0 || y >= pixelSource.height) {
    return {
      alpha: 0,
      blue: 0,
      green: 0,
      red: 0,
    };
  }

  const pixelIndex = (y * pixelSource.width + x) * 4;

  return {
    alpha: pixelSource.data[pixelIndex + 3] ?? 0,
    blue: pixelSource.data[pixelIndex + 2] ?? 0,
    green: pixelSource.data[pixelIndex + 1] ?? 0,
    red: pixelSource.data[pixelIndex] ?? 0,
  };
}

export function cloneHeldItems(items: Partial<HeldItemsState> = EMPTY_HELD_ITEMS): HeldItemsState {
  return {
    leftArm: cloneHeldItem(items.leftArm ?? null),
    rightArm: cloneHeldItem(items.rightArm ?? null),
  };
}

export function buildPresetHeldItem(presetId: HeldItemPresetId): HeldItem {
  const preset = getHeldItemPresetEntry(presetId);

  if (!preset) {
    throw new Error("That held-item preset does not exist.");
  }

  return {
    adjustments: createDefaultHeldItemAdjustments(),
    detail: preset.detail,
    label: preset.label,
    presetId,
    source: preset.previewUrl,
    sourceKind: "preset",
  };
}

export function createUploadedHeldItem(file: File, source: string): HeldItem {
  return {
    adjustments: createDefaultHeldItemAdjustments(),
    detail: `${Math.max(1, Math.round(file.size / 1024))} KB upload`,
    label: file.name.replace(/\.png$/i, ""),
    presetId: null,
    source,
    sourceKind: "upload",
  };
}

export function formatHeldItemArmLabel(armId: HeldItemArmId): string {
  return armId === "leftArm" ? "Left Arm" : "Right Arm";
}

export function isHeldItemArmId(value: unknown): value is HeldItemArmId {
  return value === "leftArm" || value === "rightArm";
}

export function isHeldItemPresetId(value: unknown): value is HeldItemPresetId {
  return PRESET_DEFINITIONS.some((preset) => preset.id === value);
}

export function isHeldItemSourceKind(value: unknown): value is HeldItemSourceKind {
  return value === "preset" || value === "upload";
}

export function canRevokeHeldItemSource(item: HeldItem | null): item is HeldItem {
  return item?.sourceKind === "upload" && item.source.startsWith("blob:");
}

export async function createHeldItemVoxelGeometry(
  source: string,
  thicknessMultiplier = DEFAULT_HELD_ITEM_ADJUSTMENTS.thickness,
): Promise<BufferGeometry | null> {
  const image = await loadImageFromSource(source);
  const canvas = document.createElement("canvas");
  const longestEdge = Math.max(image.width, image.height, 1);
  const scale = Math.min(1, HELD_ITEM_MAX_TEXTURE_EDGE / longestEdge);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to read that held-item texture.");
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const pixelSource: TexturePixelSource = {
    data: imageData.data,
    height,
    width,
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const depthScale =
    HELD_ITEM_BASE_VOXEL_THICKNESS *
    (Number.isFinite(thicknessMultiplier) ? Math.max(0.1, thicknessMultiplier) : 1);

  for (let pixelY = 0; pixelY < height; pixelY += 1) {
    for (let pixelX = 0; pixelX < width; pixelX += 1) {
      const pixel = sampleTexturePixel(pixelSource, pixelX, pixelY);

      if (pixel.alpha === 0) {
        continue;
      }

      const centerX = -width / 2 + 0.5 + pixelX;
      const centerY = height / 2 - 0.5 - pixelY;

      for (let positionIndex = 0; positionIndex < HELD_ITEM_TEMPLATE_POSITIONS.length; positionIndex += 3) {
        const baseX = HELD_ITEM_TEMPLATE_POSITIONS[positionIndex] ?? 0;
        const baseY = HELD_ITEM_TEMPLATE_POSITIONS[positionIndex + 1] ?? 0;
        const baseZ = HELD_ITEM_TEMPLATE_POSITIONS[positionIndex + 2] ?? 0;

        positions.push(
          centerX + baseX,
          centerY + baseY,
          baseZ * depthScale,
        );
        normals.push(
          HELD_ITEM_TEMPLATE_NORMALS[positionIndex] ?? 0,
          HELD_ITEM_TEMPLATE_NORMALS[positionIndex + 1] ?? 0,
          HELD_ITEM_TEMPLATE_NORMALS[positionIndex + 2] ?? 0,
        );
      }

      const alpha = pixel.alpha / 255;

      for (let faceIndex = 0; faceIndex < HELD_ITEM_FACE_SHADING.length; faceIndex += 1) {
        const shading = HELD_ITEM_FACE_SHADING[faceIndex] ?? 1;
        const red = Math.min(1, (pixel.red / 255) * shading);
        const green = Math.min(1, (pixel.green / 255) * shading);
        const blue = Math.min(1, (pixel.blue / 255) * shading);

        for (let vertexIndex = 0; vertexIndex < 6; vertexIndex += 1) {
          colors.push(red, green, blue, alpha);
        }
      }
    }
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 4));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}