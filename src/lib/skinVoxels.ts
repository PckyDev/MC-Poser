import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  type Texture,
} from "three";
import type { ArmModel, PoseBoneId } from "../types/editor";

type TexturePixelSource = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

type TexturePixelSample = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

type VoxelThicknessAxis = "x" | "y" | "z";
type VoxelSlabTransform = {
  axis: VoxelThicknessAxis;
  outwardDirection: -1 | 1;
};

const OUTER_LAYER_TEXTURE_ORIGINS: Record<
  PoseBoneId,
  { u: number; v: number }
> = {
  head: { u: 32, v: 0 },
  torso: { u: 16, v: 32 },
  leftArm: { u: 48, v: 48 },
  rightArm: { u: 40, v: 32 },
  leftLeg: { u: 0, v: 48 },
  rightLeg: { u: 0, v: 32 },
};
const VOXEL_TEMPLATE_GEOMETRY = new BoxGeometry(1, 1, 1).toNonIndexed();
const VOXEL_TEMPLATE_POSITIONS = Array.from(
  VOXEL_TEMPLATE_GEOMETRY.getAttribute("position").array as Float32Array,
);
const VOXEL_TEMPLATE_NORMALS = Array.from(
  VOXEL_TEMPLATE_GEOMETRY.getAttribute("normal").array as Float32Array,
);
const VOXEL_CUBE_SCALE = 1;
const VOXEL_EXTRUSION_THICKNESS = 0.5;
const VOXEL_FACE_SHADING = [0.82, 0.82, 1.08, 0.68, 1, 0.9];

VOXEL_TEMPLATE_GEOMETRY.dispose();

export function getOuterLayerDimensions(
  boneId: PoseBoneId,
  modelType: ArmModel,
): { width: number; height: number; depth: number } {
  switch (boneId) {
    case "head":
      return { width: 8, height: 8, depth: 8 };
    case "torso":
      return { width: 8, height: 12, depth: 4 };
    case "leftArm":
    case "rightArm":
      return { width: modelType === "slim" ? 3 : 4, height: 12, depth: 4 };
    case "leftLeg":
    case "rightLeg":
      return { width: 4, height: 12, depth: 4 };
  }
}

export function getOuterLayerShellExpansion(boneId: PoseBoneId): number {
  return boneId === "head" ? 0.5 : 0.25;
}

export function getTexturePixelSource(
  texture: Texture | null,
): TexturePixelSource | null {
  const image = texture?.image as
    | (CanvasImageSource & {
        width?: number;
        height?: number;
      })
    | null;

  if (
    !image ||
    typeof image.width !== "number" ||
    typeof image.height !== "number"
  ) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  return {
    data: imageData.data,
    width: canvas.width,
    height: canvas.height,
  };
}

export function sampleTexturePixel(
  pixelSource: TexturePixelSource,
  x: number,
  y: number,
): TexturePixelSample {
  // Face regions use the normalized 64x64 atlas, including converted legacy skins.
  // Sample the center of that texel when the source is a higher-resolution skin.
  x = Math.floor(((x + 0.5) * pixelSource.width) / 64);
  y = Math.floor(((y + 0.5) * pixelSource.height) / 64);
  if (x < 0 || x >= pixelSource.width || y < 0 || y >= pixelSource.height) {
    return {
      red: 0,
      green: 0,
      blue: 0,
      alpha: 0,
    };
  }

  const pixelIndex = (y * pixelSource.width + x) * 4;

  return {
    red: pixelSource.data[pixelIndex] ?? 0,
    green: pixelSource.data[pixelIndex + 1] ?? 0,
    blue: pixelSource.data[pixelIndex + 2] ?? 0,
    alpha: pixelSource.data[pixelIndex + 3] ?? 0,
  };
}

export function createOuterLayerVoxelGeometry(
  boneId: PoseBoneId,
  modelType: ArmModel,
  pixelSource: TexturePixelSource,
): BufferGeometry | null {
  const { width, height, depth } = getOuterLayerDimensions(boneId, modelType);
  const textureOrigin = OUTER_LAYER_TEXTURE_ORIGINS[boneId];
  const surfaceOffset = getOuterLayerShellExpansion(boneId);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const appendVoxel = (
    center: { x: number; y: number; z: number },
    slabTransform: VoxelSlabTransform,
    pixel: TexturePixelSample,
  ) => {
    const inwardShift = (VOXEL_CUBE_SCALE - VOXEL_EXTRUSION_THICKNESS) / 2;

    for (
      let positionIndex = 0;
      positionIndex < VOXEL_TEMPLATE_POSITIONS.length;
      positionIndex += 3
    ) {
      const baseX = VOXEL_TEMPLATE_POSITIONS[positionIndex] ?? 0;
      const baseY = VOXEL_TEMPLATE_POSITIONS[positionIndex + 1] ?? 0;
      const baseZ = VOXEL_TEMPLATE_POSITIONS[positionIndex + 2] ?? 0;
      let localX = baseX * VOXEL_CUBE_SCALE;
      let localY = baseY * VOXEL_CUBE_SCALE;
      let localZ = baseZ * VOXEL_CUBE_SCALE;

      if (slabTransform.axis === "x") {
        localX =
          baseX * VOXEL_EXTRUSION_THICKNESS -
          slabTransform.outwardDirection * inwardShift;
      } else if (slabTransform.axis === "y") {
        localY =
          baseY * VOXEL_EXTRUSION_THICKNESS -
          slabTransform.outwardDirection * inwardShift;
      } else {
        localZ =
          baseZ * VOXEL_EXTRUSION_THICKNESS -
          slabTransform.outwardDirection * inwardShift;
      }

      positions.push(localX + center.x, localY + center.y, localZ + center.z);
      normals.push(
        VOXEL_TEMPLATE_NORMALS[positionIndex] ?? 0,
        VOXEL_TEMPLATE_NORMALS[positionIndex + 1] ?? 0,
        VOXEL_TEMPLATE_NORMALS[positionIndex + 2] ?? 0,
      );
    }

    const alpha = pixel.alpha / 255;

    for (
      let faceIndex = 0;
      faceIndex < VOXEL_FACE_SHADING.length;
      faceIndex += 1
    ) {
      const shading = VOXEL_FACE_SHADING[faceIndex] ?? 1;
      const red = Math.min(1, (pixel.red / 255) * shading);
      const green = Math.min(1, (pixel.green / 255) * shading);
      const blue = Math.min(1, (pixel.blue / 255) * shading);

      for (let vertexIndex = 0; vertexIndex < 6; vertexIndex += 1) {
        colors.push(red, green, blue, alpha);
      }
    }
  };

  const visitFaceTexels = (
    region: { u: number; v: number; width: number; height: number },
    slabTransform: VoxelSlabTransform,
    createCenter: (
      pixelX: number,
      pixelY: number,
    ) => { x: number; y: number; z: number },
  ) => {
    for (let pixelY = 0; pixelY < region.height; pixelY += 1) {
      for (let pixelX = 0; pixelX < region.width; pixelX += 1) {
        const textureX = region.u + pixelX;
        const textureY = region.v + pixelY;
        const pixel = sampleTexturePixel(pixelSource, textureX, textureY);

        if (pixel.alpha === 0) {
          continue;
        }

        appendVoxel(createCenter(pixelX, pixelY), slabTransform, pixel);
      }
    }
  };

  visitFaceTexels(
    { u: textureOrigin.u + depth, v: textureOrigin.v + depth, width, height },
    { axis: "z", outwardDirection: 1 },
    (pixelX, pixelY) => ({
      x: -width / 2 + 0.5 + pixelX,
      y: height / 2 - 0.5 - pixelY,
      z: depth / 2 + surfaceOffset,
    }),
  );

  visitFaceTexels(
    {
      u: textureOrigin.u + width + depth * 2,
      v: textureOrigin.v + depth,
      width,
      height,
    },
    { axis: "z", outwardDirection: -1 },
    (pixelX, pixelY) => ({
      x: width / 2 - 0.5 - pixelX,
      y: height / 2 - 0.5 - pixelY,
      z: -depth / 2 - surfaceOffset,
    }),
  );

  visitFaceTexels(
    { u: textureOrigin.u, v: textureOrigin.v + depth, width: depth, height },
    { axis: "x", outwardDirection: -1 },
    (pixelX, pixelY) => ({
      x: -width / 2 - surfaceOffset,
      y: height / 2 - 0.5 - pixelY,
      z: -depth / 2 + 0.5 + pixelX,
    }),
  );

  visitFaceTexels(
    {
      u: textureOrigin.u + width + depth,
      v: textureOrigin.v + depth,
      width: depth,
      height,
    },
    { axis: "x", outwardDirection: 1 },
    (pixelX, pixelY) => ({
      x: width / 2 + surfaceOffset,
      y: height / 2 - 0.5 - pixelY,
      z: depth / 2 - 0.5 - pixelX,
    }),
  );

  visitFaceTexels(
    { u: textureOrigin.u + depth, v: textureOrigin.v, width, height: depth },
    { axis: "y", outwardDirection: 1 },
    (pixelX, pixelY) => ({
      x: -width / 2 + 0.5 + pixelX,
      y: height / 2 + surfaceOffset,
      z: -depth / 2 + 0.5 + pixelY,
    }),
  );

  // Match skinview3d's bottom UVs for every arm model and skin format.
  // Arm width does not change head/hat orientation; rows run back to front.
  visitFaceTexels(
    {
      u: textureOrigin.u + width + depth,
      v: textureOrigin.v,
      width,
      height: depth,
    },
    { axis: "y", outwardDirection: -1 },
    (pixelX, pixelY) => ({
      x: -width / 2 + 0.5 + pixelX,
      y: -height / 2 - surfaceOffset,
      z: -depth / 2 + 0.5 + pixelY,
    }),
  );

  if (positions.length === 0) {
    return null;
  }

  const voxelGeometry = new BufferGeometry();
  voxelGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  voxelGeometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  voxelGeometry.setAttribute("color", new Float32BufferAttribute(colors, 4));
  voxelGeometry.computeBoundingBox();
  voxelGeometry.computeBoundingSphere();

  return voxelGeometry;
}
