import type { SkinViewer } from "skinview3d";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Texture,
  Vector2,
  Vector3,
} from "three";

import type { ArmModel, HeldItemArmId, PoseBoneId, PoseState } from "../types/editor";

const ADVANCED_RIG_STATE_KEY = "__mcPoserAdvancedRig";
const SEGMENT_HEIGHT = 6;
const TORSO_WIDTH = 8;
const TORSO_DEPTH = 4;
const LIMB_DEPTH = 4;
const INNER_LIMB_WIDTH = 4;
const INNER_SLIM_ARM_WIDTH = 3;
const OUTER_LIMB_WIDTH = 4.5;
const OUTER_SLIM_ARM_WIDTH = 3.5;
const OUTER_TORSO_WIDTH = 8.5;
const OUTER_SEGMENT_HEIGHT = 6.25;
const OUTER_TORSO_DEPTH = 4.5;
const OUTER_LIMB_DEPTH = 4.5;
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

type SegmentHalf = "top" | "bottom";

type FaceRect = readonly [number, number, number, number];

type SkinBoxRegion = {
  u: number;
  v: number;
  width: number;
  height: number;
  depth: number;
};

type TexturePixelSource = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

type TexturePixelSample = {
  alpha: number;
  blue: number;
  green: number;
  red: number;
};

type VoxelThicknessAxis = "x" | "y" | "z";

type VoxelSlabTransform = {
  axis: VoxelThicknessAxis;
  outwardDirection: -1 | 1;
};

type SegmentRig = {
  joint: Group;
  lowerInnerMesh: Mesh;
  lowerOuterMesh: Mesh;
  lowerVoxelMesh: Mesh | null;
  originalInner: Object3D;
  originalOuter: Object3D;
  outerRegion: SkinBoxRegion;
  root: Group;
  segmentOffsetX: number;
  upperInnerMesh: Mesh;
  upperOuterMesh: Mesh;
  upperVoxelMesh: Mesh | null;
  voxelDepth: number;
  voxelSurfaceOffset: number;
  voxelWidth: number;
};

type TorsoRig = {
  lowerInnerMesh: Mesh;
  lowerOuterMesh: Mesh;
  lowerVoxelMesh: Mesh | null;
  originalInner: Object3D;
  originalOuter: Object3D;
  outerRegion: SkinBoxRegion;
  root: Group;
  spineJoint: Group;
  upperInnerMesh: Mesh;
  upperOuterMesh: Mesh;
  upperVoxelMesh: Mesh | null;
  voxelDepth: number;
  voxelSurfaceOffset: number;
  voxelWidth: number;
};

type AdvancedRigState = {
  bodyOriginalParent: Object3D;
  bodyOriginalPosition: Vector3;
  headOriginalParent: Object3D;
  headOriginalPosition: Vector3;
  headVoxelMesh: Mesh | null;
  leftArmOriginalParent: Object3D;
  leftArmOriginalPosition: Vector3;
  leftArmRig: SegmentRig;
  leftLegRig: SegmentRig;
  modelType: ArmModel;
  rightArmOriginalParent: Object3D;
  rightArmOriginalPosition: Vector3;
  rightArmRig: SegmentRig;
  rightLegRig: SegmentRig;
  skinMap: Texture | null;
  torsoRig: TorsoRig;
};

type SkinPartObject = Object3D & {
  innerLayer: Object3D;
  outerLayer: Object3D;
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function isMesh(value: Object3D): value is Mesh {
  return value instanceof Mesh;
}

function toFaceVertices(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  textureWidth: number,
  textureHeight: number,
): [Vector2, Vector2, Vector2, Vector2] {
  return [
    new Vector2(x1 / textureWidth, 1 - y2 / textureHeight),
    new Vector2(x2 / textureWidth, 1 - y2 / textureHeight),
    new Vector2(x2 / textureWidth, 1 - y1 / textureHeight),
    new Vector2(x1 / textureWidth, 1 - y1 / textureHeight),
  ];
}

function setBoxFaceUvs(
  geometry: BoxGeometry,
  faces: {
    back: FaceRect;
    bottom: FaceRect;
    front: FaceRect;
    left: FaceRect;
    right: FaceRect;
    top: FaceRect;
  },
  textureWidth = 64,
  textureHeight = 64,
): void {
  const uvAttribute = geometry.getAttribute("uv");

  if (!(uvAttribute instanceof BufferAttribute)) {
    return;
  }

  const right = toFaceVertices(...faces.right, textureWidth, textureHeight);
  const left = toFaceVertices(...faces.left, textureWidth, textureHeight);
  const top = toFaceVertices(...faces.top, textureWidth, textureHeight);
  const bottom = toFaceVertices(...faces.bottom, textureWidth, textureHeight);
  const front = toFaceVertices(...faces.front, textureWidth, textureHeight);
  const back = toFaceVertices(...faces.back, textureWidth, textureHeight);

  const packedUvs = [
    right[3], right[2], right[0], right[1],
    left[3], left[2], left[0], left[1],
    top[3], top[2], top[0], top[1],
    bottom[0], bottom[1], bottom[3], bottom[2],
    front[3], front[2], front[0], front[1],
    back[3], back[2], back[0], back[1],
  ];

  const uvValues: number[] = [];

  packedUvs.forEach((faceUvs) => {
    uvValues.push(faceUvs.x, faceUvs.y);
  });

  uvAttribute.set(new Float32Array(uvValues));
  uvAttribute.needsUpdate = true;
}

function createSegmentGeometry(
  width: number,
  height: number,
  depth: number,
  skinRegion: SkinBoxRegion,
  half: SegmentHalf,
): BoxGeometry {
  const geometry = new BoxGeometry(width, height, depth);
  const sideTop = skinRegion.v + skinRegion.depth;
  const sideBottom = sideTop + skinRegion.height;
  const sideMiddle = sideTop + skinRegion.height / 2;
  const faceTop = half === "top" ? sideTop : sideMiddle;
  const faceBottom = half === "top" ? sideMiddle : sideBottom;

  setBoxFaceUvs(geometry, {
    right: [
      skinRegion.u + skinRegion.width + skinRegion.depth,
      faceTop,
      skinRegion.u + skinRegion.width + skinRegion.depth * 2,
      faceBottom,
    ],
    left: [
      skinRegion.u,
      faceTop,
      skinRegion.u + skinRegion.depth,
      faceBottom,
    ],
    top: [
      skinRegion.u + skinRegion.depth,
      skinRegion.v,
      skinRegion.u + skinRegion.width + skinRegion.depth,
      skinRegion.v + skinRegion.depth,
    ],
    bottom: [
      skinRegion.u + skinRegion.width + skinRegion.depth,
      skinRegion.v,
      skinRegion.u + skinRegion.width * 2 + skinRegion.depth,
      skinRegion.v + skinRegion.depth,
    ],
    front: [
      skinRegion.u + skinRegion.depth,
      faceTop,
      skinRegion.u + skinRegion.width + skinRegion.depth,
      faceBottom,
    ],
    back: [
      skinRegion.u + skinRegion.width + skinRegion.depth * 2,
      faceTop,
      skinRegion.u + skinRegion.width * 2 + skinRegion.depth * 2,
      faceBottom,
    ],
  });

  return geometry;
}

function getTexturePixelSource(texture: Texture | null): TexturePixelSource | null {
  const image = texture?.image as (CanvasImageSource & { width?: number; height?: number }) | null;

  if (!image || typeof image.width !== "number" || typeof image.height !== "number") {
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

function createVoxelGeometryFromSkinBox(
  width: number,
  height: number,
  depth: number,
  skinRegion: SkinBoxRegion,
  pixelSource: TexturePixelSource,
  surfaceOffset: number,
): BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const appendVoxel = (
    center: { x: number; y: number; z: number },
    slabTransform: VoxelSlabTransform,
    pixel: TexturePixelSample,
  ) => {
    const inwardShift = (VOXEL_CUBE_SCALE - VOXEL_EXTRUSION_THICKNESS) / 2;

    for (let positionIndex = 0; positionIndex < VOXEL_TEMPLATE_POSITIONS.length; positionIndex += 3) {
      const baseX = VOXEL_TEMPLATE_POSITIONS[positionIndex] ?? 0;
      const baseY = VOXEL_TEMPLATE_POSITIONS[positionIndex + 1] ?? 0;
      const baseZ = VOXEL_TEMPLATE_POSITIONS[positionIndex + 2] ?? 0;
      let localX = baseX * VOXEL_CUBE_SCALE;
      let localY = baseY * VOXEL_CUBE_SCALE;
      let localZ = baseZ * VOXEL_CUBE_SCALE;

      if (slabTransform.axis === "x") {
        localX =
          baseX * VOXEL_EXTRUSION_THICKNESS - slabTransform.outwardDirection * inwardShift;
      } else if (slabTransform.axis === "y") {
        localY =
          baseY * VOXEL_EXTRUSION_THICKNESS - slabTransform.outwardDirection * inwardShift;
      } else {
        localZ =
          baseZ * VOXEL_EXTRUSION_THICKNESS - slabTransform.outwardDirection * inwardShift;
      }

      positions.push(localX + center.x, localY + center.y, localZ + center.z);
      normals.push(
        VOXEL_TEMPLATE_NORMALS[positionIndex] ?? 0,
        VOXEL_TEMPLATE_NORMALS[positionIndex + 1] ?? 0,
        VOXEL_TEMPLATE_NORMALS[positionIndex + 2] ?? 0,
      );
    }

    const alpha = pixel.alpha / 255;

    for (let faceIndex = 0; faceIndex < VOXEL_FACE_SHADING.length; faceIndex += 1) {
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
    createCenter: (pixelX: number, pixelY: number) => { x: number; y: number; z: number },
  ) => {
    for (let pixelY = 0; pixelY < region.height; pixelY += 1) {
      for (let pixelX = 0; pixelX < region.width; pixelX += 1) {
        const pixel = sampleTexturePixel(pixelSource, region.u + pixelX, region.v + pixelY);

        if (pixel.alpha === 0) {
          continue;
        }

        appendVoxel(createCenter(pixelX, pixelY), slabTransform, pixel);
      }
    }
  };

  visitFaceTexels(
    { u: skinRegion.u + depth, v: skinRegion.v + depth, width, height },
    { axis: "z", outwardDirection: 1 },
    (pixelX, pixelY) => ({
      x: -width / 2 + 0.5 + pixelX,
      y: height / 2 - 0.5 - pixelY,
      z: depth / 2 + surfaceOffset,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u + width + depth * 2, v: skinRegion.v + depth, width, height },
    { axis: "z", outwardDirection: -1 },
    (pixelX, pixelY) => ({
      x: width / 2 - 0.5 - pixelX,
      y: height / 2 - 0.5 - pixelY,
      z: -depth / 2 - surfaceOffset,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u, v: skinRegion.v + depth, width: depth, height },
    { axis: "x", outwardDirection: -1 },
    (pixelX, pixelY) => ({
      x: -width / 2 - surfaceOffset,
      y: height / 2 - 0.5 - pixelY,
      z: -depth / 2 + 0.5 + pixelX,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u + width + depth, v: skinRegion.v + depth, width: depth, height },
    { axis: "x", outwardDirection: 1 },
    (pixelX, pixelY) => ({
      x: width / 2 + surfaceOffset,
      y: height / 2 - 0.5 - pixelY,
      z: depth / 2 - 0.5 - pixelX,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u + depth, v: skinRegion.v, width, height: depth },
    { axis: "y", outwardDirection: 1 },
    (pixelX, pixelY) => ({
      x: -width / 2 + 0.5 + pixelX,
      y: height / 2 + surfaceOffset,
      z: -depth / 2 + 0.5 + pixelY,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u + width + depth, v: skinRegion.v, width, height: depth },
    { axis: "y", outwardDirection: -1 },
    (pixelX, pixelY) => ({
      x: -width / 2 + 0.5 + pixelX,
      y: -height / 2 - surfaceOffset,
      z: depth / 2 - 0.5 - pixelY,
    }),
  );

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

function createSegmentVoxelGeometry(
  width: number,
  height: number,
  depth: number,
  skinRegion: SkinBoxRegion,
  half: SegmentHalf,
  pixelSource: TexturePixelSource,
  surfaceOffset: number,
): BufferGeometry | null {
  const sideTop = skinRegion.v + depth;
  const sideMiddle = sideTop + skinRegion.height / 2;
  const sideBottom = sideTop + skinRegion.height;
  const faceTop = half === "top" ? sideTop : sideMiddle;
  const faceBottom = half === "top" ? sideMiddle : sideBottom;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const appendVoxel = (
    center: { x: number; y: number; z: number },
    slabTransform: VoxelSlabTransform,
    pixel: TexturePixelSample,
  ) => {
    const inwardShift = (VOXEL_CUBE_SCALE - VOXEL_EXTRUSION_THICKNESS) / 2;

    for (let positionIndex = 0; positionIndex < VOXEL_TEMPLATE_POSITIONS.length; positionIndex += 3) {
      const baseX = VOXEL_TEMPLATE_POSITIONS[positionIndex] ?? 0;
      const baseY = VOXEL_TEMPLATE_POSITIONS[positionIndex + 1] ?? 0;
      const baseZ = VOXEL_TEMPLATE_POSITIONS[positionIndex + 2] ?? 0;
      let localX = baseX * VOXEL_CUBE_SCALE;
      let localY = baseY * VOXEL_CUBE_SCALE;
      let localZ = baseZ * VOXEL_CUBE_SCALE;

      if (slabTransform.axis === "x") {
        localX =
          baseX * VOXEL_EXTRUSION_THICKNESS - slabTransform.outwardDirection * inwardShift;
      } else if (slabTransform.axis === "y") {
        localY =
          baseY * VOXEL_EXTRUSION_THICKNESS - slabTransform.outwardDirection * inwardShift;
      } else {
        localZ =
          baseZ * VOXEL_EXTRUSION_THICKNESS - slabTransform.outwardDirection * inwardShift;
      }

      positions.push(localX + center.x, localY + center.y, localZ + center.z);
      normals.push(
        VOXEL_TEMPLATE_NORMALS[positionIndex] ?? 0,
        VOXEL_TEMPLATE_NORMALS[positionIndex + 1] ?? 0,
        VOXEL_TEMPLATE_NORMALS[positionIndex + 2] ?? 0,
      );
    }

    const alpha = pixel.alpha / 255;

    for (let faceIndex = 0; faceIndex < VOXEL_FACE_SHADING.length; faceIndex += 1) {
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
    createCenter: (pixelX: number, pixelY: number) => { x: number; y: number; z: number },
  ) => {
    for (let pixelY = 0; pixelY < region.height; pixelY += 1) {
      for (let pixelX = 0; pixelX < region.width; pixelX += 1) {
        const pixel = sampleTexturePixel(pixelSource, region.u + pixelX, region.v + pixelY);

        if (pixel.alpha === 0) {
          continue;
        }

        appendVoxel(createCenter(pixelX, pixelY), slabTransform, pixel);
      }
    }
  };

  visitFaceTexels(
    { u: skinRegion.u + depth, v: faceTop, width, height },
    { axis: "z", outwardDirection: 1 },
    (pixelX, pixelY) => ({
      x: -width / 2 + 0.5 + pixelX,
      y: height / 2 - 0.5 - pixelY,
      z: depth / 2 + surfaceOffset,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u + width + depth * 2, v: faceTop, width, height },
    { axis: "z", outwardDirection: -1 },
    (pixelX, pixelY) => ({
      x: width / 2 - 0.5 - pixelX,
      y: height / 2 - 0.5 - pixelY,
      z: -depth / 2 - surfaceOffset,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u, v: faceTop, width: depth, height },
    { axis: "x", outwardDirection: -1 },
    (pixelX, pixelY) => ({
      x: -width / 2 - surfaceOffset,
      y: height / 2 - 0.5 - pixelY,
      z: -depth / 2 + 0.5 + pixelX,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u + width + depth, v: faceTop, width: depth, height },
    { axis: "x", outwardDirection: 1 },
    (pixelX, pixelY) => ({
      x: width / 2 + surfaceOffset,
      y: height / 2 - 0.5 - pixelY,
      z: depth / 2 - 0.5 - pixelX,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u + depth, v: skinRegion.v, width, height: depth },
    { axis: "y", outwardDirection: 1 },
    (pixelX, pixelY) => ({
      x: -width / 2 + 0.5 + pixelX,
      y: height / 2 + surfaceOffset,
      z: -depth / 2 + 0.5 + pixelY,
    }),
  );

  visitFaceTexels(
    { u: skinRegion.u + width + depth, v: skinRegion.v, width, height: depth },
    { axis: "y", outwardDirection: -1 },
    (pixelX, pixelY) => ({
      x: -width / 2 + 0.5 + pixelX,
      y: -height / 2 - surfaceOffset,
      z: depth / 2 - 0.5 - pixelY,
    }),
  );

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

function createVoxelMesh(geometry: BufferGeometry): Mesh {
  return new Mesh(
    geometry,
    new MeshStandardMaterial({
      alphaTest: 1 / 255,
      flatShading: true,
      metalness: 0,
      roughness: 1,
      transparent: true,
      vertexColors: true,
    }),
  );
}

function disposeVoxelMesh(mesh: Mesh | null): void {
  if (!mesh) {
    return;
  }

  mesh.removeFromParent();
  mesh.geometry.dispose();

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => material.dispose());
  } else {
    mesh.material.dispose();
  }
}

function buildLimbRig(
  part: SkinPartObject,
  innerRegion: SkinBoxRegion,
  outerRegion: SkinBoxRegion,
  innerWidth: number,
  outerWidth: number,
  segmentOffsetX: number,
): SegmentRig {
  if (!isMesh(part.innerLayer) || !isMesh(part.outerLayer)) {
    throw new Error("Advanced avatar rig requires mesh-based limb layers.");
  }

  const upperInnerMesh = new Mesh(
    createSegmentGeometry(innerWidth, SEGMENT_HEIGHT, LIMB_DEPTH, innerRegion, "top"),
    part.innerLayer.material,
  );
  upperInnerMesh.position.set(segmentOffsetX, -SEGMENT_HEIGHT / 2, 0);

  const lowerInnerMesh = new Mesh(
    createSegmentGeometry(innerWidth, SEGMENT_HEIGHT, LIMB_DEPTH, innerRegion, "bottom"),
    part.innerLayer.material,
  );
  lowerInnerMesh.position.set(0, -SEGMENT_HEIGHT / 2, 0);

  const upperOuterMesh = new Mesh(
    createSegmentGeometry(outerWidth, OUTER_SEGMENT_HEIGHT, OUTER_LIMB_DEPTH, outerRegion, "top"),
    part.outerLayer.material,
  );
  upperOuterMesh.position.set(segmentOffsetX, -OUTER_SEGMENT_HEIGHT / 2, 0);

  const lowerOuterMesh = new Mesh(
    createSegmentGeometry(outerWidth, OUTER_SEGMENT_HEIGHT, OUTER_LIMB_DEPTH, outerRegion, "bottom"),
    part.outerLayer.material,
  );
  lowerOuterMesh.position.set(0, -OUTER_SEGMENT_HEIGHT / 2, 0);

  const joint = new Group();
  joint.position.set(segmentOffsetX, -SEGMENT_HEIGHT, 0);
  joint.add(lowerInnerMesh, lowerOuterMesh);

  const root = new Group();
  root.name = `${part.name}-advanced-rig`;
  root.visible = false;
  root.add(upperInnerMesh, upperOuterMesh, joint);
  part.add(root);

  return {
    joint,
    lowerInnerMesh,
    lowerOuterMesh,
    lowerVoxelMesh: null,
    originalInner: part.innerLayer,
    originalOuter: part.outerLayer,
    outerRegion,
    root,
    segmentOffsetX,
    upperInnerMesh,
    upperOuterMesh,
    upperVoxelMesh: null,
    voxelDepth: LIMB_DEPTH,
    voxelSurfaceOffset: 0.25,
    voxelWidth: innerWidth,
  };
}

function buildTorsoRig(part: SkinPartObject): TorsoRig {
  if (!isMesh(part.innerLayer) || !isMesh(part.outerLayer)) {
    throw new Error("Advanced avatar rig requires mesh-based torso layers.");
  }

  const innerRegion = { u: 16, v: 16, width: TORSO_WIDTH, height: 12, depth: TORSO_DEPTH };
  const outerRegion = { u: 16, v: 32, width: TORSO_WIDTH, height: 12, depth: TORSO_DEPTH };
  const lowerInnerMesh = new Mesh(
    createSegmentGeometry(TORSO_WIDTH, SEGMENT_HEIGHT, TORSO_DEPTH, innerRegion, "bottom"),
    part.innerLayer.material,
  );
  lowerInnerMesh.position.y = -SEGMENT_HEIGHT / 2;

  const lowerOuterMesh = new Mesh(
    createSegmentGeometry(OUTER_TORSO_WIDTH, OUTER_SEGMENT_HEIGHT, OUTER_TORSO_DEPTH, outerRegion, "bottom"),
    part.outerLayer.material,
  );
  lowerOuterMesh.position.y = -OUTER_SEGMENT_HEIGHT / 2;

  const upperInnerMesh = new Mesh(
    createSegmentGeometry(TORSO_WIDTH, SEGMENT_HEIGHT, TORSO_DEPTH, innerRegion, "top"),
    part.innerLayer.material,
  );
  upperInnerMesh.position.y = SEGMENT_HEIGHT / 2;

  const upperOuterMesh = new Mesh(
    createSegmentGeometry(OUTER_TORSO_WIDTH, OUTER_SEGMENT_HEIGHT, OUTER_TORSO_DEPTH, outerRegion, "top"),
    part.outerLayer.material,
  );
  upperOuterMesh.position.y = OUTER_SEGMENT_HEIGHT / 2;

  const spineJoint = new Group();
  spineJoint.position.set(0, 0, 0);
  spineJoint.add(upperInnerMesh, upperOuterMesh);

  const root = new Group();
  root.name = `${part.name}-advanced-rig`;
  root.visible = false;
  root.add(lowerInnerMesh, lowerOuterMesh, spineJoint);
  part.add(root);

  return {
    lowerInnerMesh,
    lowerOuterMesh,
    lowerVoxelMesh: null,
    originalInner: part.innerLayer,
    originalOuter: part.outerLayer,
    outerRegion,
    root,
    spineJoint,
    upperInnerMesh,
    upperOuterMesh,
    upperVoxelMesh: null,
    voxelDepth: TORSO_DEPTH,
    voxelSurfaceOffset: 0.25,
    voxelWidth: TORSO_WIDTH,
  };
}

function disposeSegmentRig(rig: SegmentRig): void {
  rig.upperInnerMesh.geometry.dispose();
  rig.lowerInnerMesh.geometry.dispose();
  rig.upperOuterMesh.geometry.dispose();
  rig.lowerOuterMesh.geometry.dispose();
  disposeVoxelMesh(rig.upperVoxelMesh);
  disposeVoxelMesh(rig.lowerVoxelMesh);
  rig.root.removeFromParent();
}

function disposeTorsoRig(rig: TorsoRig): void {
  rig.upperInnerMesh.geometry.dispose();
  rig.lowerInnerMesh.geometry.dispose();
  rig.upperOuterMesh.geometry.dispose();
  rig.lowerOuterMesh.geometry.dispose();
  disposeVoxelMesh(rig.upperVoxelMesh);
  disposeVoxelMesh(rig.lowerVoxelMesh);
  rig.root.removeFromParent();
}

function getStoredAdvancedRig(viewer: SkinViewer): AdvancedRigState | null {
  return (viewer.playerObject.skin.userData[ADVANCED_RIG_STATE_KEY] as AdvancedRigState | undefined) ?? null;
}

function clearStoredAdvancedRig(viewer: SkinViewer): void {
  delete viewer.playerObject.skin.userData[ADVANCED_RIG_STATE_KEY];
}

function restoreAdvancedRig(viewer: SkinViewer, state: AdvancedRigState): void {
  const skin = viewer.playerObject.skin;

  state.headOriginalParent.add(skin.head);
  state.leftArmOriginalParent.add(skin.leftArm);
  state.rightArmOriginalParent.add(skin.rightArm);
  state.bodyOriginalParent.add(skin.body);

  skin.head.position.copy(state.headOriginalPosition);
  skin.leftArm.position.copy(state.leftArmOriginalPosition);
  skin.rightArm.position.copy(state.rightArmOriginalPosition);
  skin.body.position.copy(state.bodyOriginalPosition);
  skin.body.rotation.set(0, 0, 0);
  state.torsoRig.spineJoint.rotation.set(0, 0, 0);

  skin.body.innerLayer.visible = true;
  skin.body.outerLayer.visible = true;
  skin.leftArm.innerLayer.visible = true;
  skin.leftArm.outerLayer.visible = true;
  skin.rightArm.innerLayer.visible = true;
  skin.rightArm.outerLayer.visible = true;
  skin.leftLeg.innerLayer.visible = true;
  skin.leftLeg.outerLayer.visible = true;
  skin.rightLeg.innerLayer.visible = true;
  skin.rightLeg.outerLayer.visible = true;
  skin.head.outerLayer.visible = true;

  state.torsoRig.root.visible = false;
  state.leftArmRig.root.visible = false;
  state.rightArmRig.root.visible = false;
  state.leftLegRig.root.visible = false;
  state.rightLegRig.root.visible = false;

  [state.leftArmRig, state.rightArmRig, state.leftLegRig, state.rightLegRig].forEach((rig) => {
    rig.joint.rotation.set(0, 0, 0);
    if (rig.upperVoxelMesh) {
      rig.upperVoxelMesh.visible = false;
    }
    if (rig.lowerVoxelMesh) {
      rig.lowerVoxelMesh.visible = false;
    }
  });

  if (state.torsoRig.upperVoxelMesh) {
    state.torsoRig.upperVoxelMesh.visible = false;
  }
  if (state.torsoRig.lowerVoxelMesh) {
    state.torsoRig.lowerVoxelMesh.visible = false;
  }
  if (state.headVoxelMesh) {
    state.headVoxelMesh.visible = false;
  }
}

function destroyAdvancedRig(viewer: SkinViewer, state: AdvancedRigState): void {
  restoreAdvancedRig(viewer, state);
  disposeTorsoRig(state.torsoRig);
  disposeSegmentRig(state.leftArmRig);
  disposeSegmentRig(state.rightArmRig);
  disposeSegmentRig(state.leftLegRig);
  disposeSegmentRig(state.rightLegRig);
  disposeVoxelMesh(state.headVoxelMesh);
  clearStoredAdvancedRig(viewer);
}

function buildAdvancedRig(viewer: SkinViewer): AdvancedRigState {
  const skin = viewer.playerObject.skin;
  const modelType = skin.modelType as ArmModel;
  const innerArmWidth = modelType === "slim" ? INNER_SLIM_ARM_WIDTH : INNER_LIMB_WIDTH;
  const outerArmWidth = modelType === "slim" ? OUTER_SLIM_ARM_WIDTH : OUTER_LIMB_WIDTH;
  const leftArmOffsetX = modelType === "slim" ? 0.5 : 1;
  const rightArmOffsetX = modelType === "slim" ? -0.5 : -1;
  const state: AdvancedRigState = {
    bodyOriginalParent: skin.body.parent ?? skin,
    bodyOriginalPosition: skin.body.position.clone(),
    headOriginalParent: skin.head.parent ?? skin,
    headOriginalPosition: skin.head.position.clone(),
    headVoxelMesh: null,
    leftArmOriginalParent: skin.leftArm.parent ?? skin,
    leftArmOriginalPosition: skin.leftArm.position.clone(),
    leftArmRig: buildLimbRig(
      skin.leftArm as SkinPartObject,
      { u: 32, v: 48, width: innerArmWidth, height: 12, depth: LIMB_DEPTH },
      { u: 48, v: 48, width: innerArmWidth, height: 12, depth: LIMB_DEPTH },
      innerArmWidth,
      outerArmWidth,
      leftArmOffsetX,
    ),
    leftLegRig: buildLimbRig(
      skin.leftLeg as SkinPartObject,
      { u: 16, v: 48, width: INNER_LIMB_WIDTH, height: 12, depth: LIMB_DEPTH },
      { u: 0, v: 48, width: INNER_LIMB_WIDTH, height: 12, depth: LIMB_DEPTH },
      INNER_LIMB_WIDTH,
      OUTER_LIMB_WIDTH,
      0,
    ),
    modelType,
    rightArmOriginalParent: skin.rightArm.parent ?? skin,
    rightArmOriginalPosition: skin.rightArm.position.clone(),
    rightArmRig: buildLimbRig(
      skin.rightArm as SkinPartObject,
      { u: 40, v: 16, width: innerArmWidth, height: 12, depth: LIMB_DEPTH },
      { u: 40, v: 32, width: innerArmWidth, height: 12, depth: LIMB_DEPTH },
      innerArmWidth,
      outerArmWidth,
      rightArmOffsetX,
    ),
    rightLegRig: buildLimbRig(
      skin.rightLeg as SkinPartObject,
      { u: 0, v: 16, width: INNER_LIMB_WIDTH, height: 12, depth: LIMB_DEPTH },
      { u: 0, v: 32, width: INNER_LIMB_WIDTH, height: 12, depth: LIMB_DEPTH },
      INNER_LIMB_WIDTH,
      OUTER_LIMB_WIDTH,
      0,
    ),
    skinMap: skin.map,
    torsoRig: buildTorsoRig(skin.body as SkinPartObject),
  };

  skin.userData[ADVANCED_RIG_STATE_KEY] = state;
  return state;
}

function ensureAdvancedRig(viewer: SkinViewer): AdvancedRigState {
  const currentState = getStoredAdvancedRig(viewer);
  const skin = viewer.playerObject.skin;
  const currentModelType = skin.modelType as ArmModel;

  if (
    currentState &&
    currentState.modelType === currentModelType &&
    currentState.skinMap === skin.map
  ) {
    return currentState;
  }

  if (currentState) {
    destroyAdvancedRig(viewer, currentState);
  }

  return buildAdvancedRig(viewer);
}

function ensureHeadVoxelMesh(
  viewer: SkinViewer,
  state: AdvancedRigState,
  pixelSource: TexturePixelSource,
): Mesh | null {
  if (state.headVoxelMesh) {
    return state.headVoxelMesh;
  }

  const geometry = createVoxelGeometryFromSkinBox(
    8,
    8,
    8,
    { u: 32, v: 0, width: 8, height: 8, depth: 8 },
    pixelSource,
    0.5,
  );

  if (!geometry) {
    return null;
  }

  const voxelMesh = createVoxelMesh(geometry);
  voxelMesh.name = "head-advanced-voxel";
  voxelMesh.position.y = 4;
  voxelMesh.visible = false;
  viewer.playerObject.skin.head.add(voxelMesh);
  state.headVoxelMesh = voxelMesh;

  return voxelMesh;
}

function ensureSegmentVoxelMeshes(
  rig: SegmentRig,
  pixelSource: TexturePixelSource,
): void {
  if (!rig.upperVoxelMesh) {
    const upperGeometry = createSegmentVoxelGeometry(
      rig.voxelWidth,
      SEGMENT_HEIGHT,
      rig.voxelDepth,
      rig.outerRegion,
      "top",
      pixelSource,
      rig.voxelSurfaceOffset,
    );

    if (upperGeometry) {
      rig.upperVoxelMesh = createVoxelMesh(upperGeometry);
      rig.upperVoxelMesh.name = `${rig.root.name}-upper-voxel`;
      rig.upperVoxelMesh.position.set(rig.segmentOffsetX, -SEGMENT_HEIGHT / 2, 0);
      rig.upperVoxelMesh.visible = false;
      rig.root.add(rig.upperVoxelMesh);
    }
  }

  if (!rig.lowerVoxelMesh) {
    const lowerGeometry = createSegmentVoxelGeometry(
      rig.voxelWidth,
      SEGMENT_HEIGHT,
      rig.voxelDepth,
      rig.outerRegion,
      "bottom",
      pixelSource,
      rig.voxelSurfaceOffset,
    );

    if (lowerGeometry) {
      rig.lowerVoxelMesh = createVoxelMesh(lowerGeometry);
      rig.lowerVoxelMesh.name = `${rig.root.name}-lower-voxel`;
      rig.lowerVoxelMesh.position.set(0, -SEGMENT_HEIGHT / 2, 0);
      rig.lowerVoxelMesh.visible = false;
      rig.joint.add(rig.lowerVoxelMesh);
    }
  }
}

function ensureTorsoVoxelMeshes(
  rig: TorsoRig,
  pixelSource: TexturePixelSource,
): void {
  if (!rig.upperVoxelMesh) {
    const upperGeometry = createSegmentVoxelGeometry(
      rig.voxelWidth,
      SEGMENT_HEIGHT,
      rig.voxelDepth,
      rig.outerRegion,
      "top",
      pixelSource,
      rig.voxelSurfaceOffset,
    );

    if (upperGeometry) {
      rig.upperVoxelMesh = createVoxelMesh(upperGeometry);
      rig.upperVoxelMesh.name = `${rig.root.name}-upper-voxel`;
      rig.upperVoxelMesh.position.y = SEGMENT_HEIGHT / 2;
      rig.upperVoxelMesh.visible = false;
      rig.spineJoint.add(rig.upperVoxelMesh);
    }
  }

  if (!rig.lowerVoxelMesh) {
    const lowerGeometry = createSegmentVoxelGeometry(
      rig.voxelWidth,
      SEGMENT_HEIGHT,
      rig.voxelDepth,
      rig.outerRegion,
      "bottom",
      pixelSource,
      rig.voxelSurfaceOffset,
    );

    if (lowerGeometry) {
      rig.lowerVoxelMesh = createVoxelMesh(lowerGeometry);
      rig.lowerVoxelMesh.name = `${rig.root.name}-lower-voxel`;
      rig.lowerVoxelMesh.position.y = -SEGMENT_HEIGHT / 2;
      rig.lowerVoxelMesh.visible = false;
      rig.root.add(rig.lowerVoxelMesh);
    }
  }
}

function setSegmentOuterLayerMode(
  rig: SegmentRig,
  isVisible: boolean,
  showVoxel: boolean,
): void {
  rig.upperOuterMesh.visible = isVisible && !showVoxel;
  rig.lowerOuterMesh.visible = isVisible && !showVoxel;

  if (rig.upperVoxelMesh) {
    rig.upperVoxelMesh.visible = isVisible && showVoxel;
  }

  if (rig.lowerVoxelMesh) {
    rig.lowerVoxelMesh.visible = isVisible && showVoxel;
  }
}

function setTorsoOuterLayerMode(
  rig: TorsoRig,
  isVisible: boolean,
  showVoxel: boolean,
): void {
  rig.upperOuterMesh.visible = isVisible && !showVoxel;
  rig.lowerOuterMesh.visible = isVisible && !showVoxel;

  if (rig.upperVoxelMesh) {
    rig.upperVoxelMesh.visible = isVisible && showVoxel;
  }

  if (rig.lowerVoxelMesh) {
    rig.lowerVoxelMesh.visible = isVisible && showVoxel;
  }
}

function resolveSegmentOutlineObjects(rig: SegmentRig): Object3D[] {
  if (
    rig.upperVoxelMesh?.visible ||
    rig.lowerVoxelMesh?.visible ||
    rig.upperOuterMesh.visible ||
    rig.lowerOuterMesh.visible
  ) {
    return [rig.upperOuterMesh, rig.lowerOuterMesh];
  }

  return [rig.upperInnerMesh, rig.lowerInnerMesh];
}

function resolveTorsoOutlineObjects(rig: TorsoRig): Object3D[] {
  if (
    rig.upperVoxelMesh?.visible ||
    rig.lowerVoxelMesh?.visible ||
    rig.upperOuterMesh.visible ||
    rig.lowerOuterMesh.visible
  ) {
    return [rig.upperOuterMesh, rig.lowerOuterMesh];
  }

  return [rig.upperInnerMesh, rig.lowerInnerMesh];
}

export function isAdvancedAvatarActive(viewer: SkinViewer): boolean {
  const state = getStoredAdvancedRig(viewer);

  return Boolean(state?.torsoRig.root.visible);
}

export function getAdvancedAvatarJointObject(
  viewer: SkinViewer,
  poseKey: keyof PoseState,
): Object3D | null {
  const state = getStoredAdvancedRig(viewer);

  if (!state || !state.torsoRig.root.visible) {
    return null;
  }

  switch (poseKey) {
    case "spineBend":
      return state.torsoRig.spineJoint;
    case "leftElbowPitch":
      return state.leftArmRig.joint;
    case "rightElbowPitch":
      return state.rightArmRig.joint;
    case "leftKneePitch":
      return state.leftLegRig.joint;
    case "rightKneePitch":
      return state.rightLegRig.joint;
    default:
      return null;
  }
}

export function getAdvancedAvatarHandAnchor(
  viewer: SkinViewer,
  armId: HeldItemArmId,
): Object3D | null {
  const state = getStoredAdvancedRig(viewer);

  if (!state || !state.torsoRig.root.visible) {
    return null;
  }

  return armId === "leftArm" ? state.leftArmRig.joint : state.rightArmRig.joint;
}

export function syncAdvancedAvatarRig(viewer: SkinViewer, isAdvanced: boolean): void {
  const storedState = getStoredAdvancedRig(viewer);

  if (!isAdvanced) {
    if (storedState) {
      restoreAdvancedRig(viewer, storedState);
    }

    return;
  }

  const state = ensureAdvancedRig(viewer);
  const skin = viewer.playerObject.skin;

  state.torsoRig.root.visible = true;
  state.leftArmRig.root.visible = true;
  state.rightArmRig.root.visible = true;
  state.leftLegRig.root.visible = true;
  state.rightLegRig.root.visible = true;

  skin.body.innerLayer.visible = false;
  skin.body.outerLayer.visible = false;
  skin.leftArm.innerLayer.visible = false;
  skin.leftArm.outerLayer.visible = false;
  skin.rightArm.innerLayer.visible = false;
  skin.rightArm.outerLayer.visible = false;
  skin.leftLeg.innerLayer.visible = false;
  skin.leftLeg.outerLayer.visible = false;
  skin.rightLeg.innerLayer.visible = false;
  skin.rightLeg.outerLayer.visible = false;

  state.torsoRig.spineJoint.rotation.set(0, 0, 0);
  state.leftArmRig.joint.rotation.set(0, 0, 0);
  state.rightArmRig.joint.rotation.set(0, 0, 0);
  state.leftLegRig.joint.rotation.set(0, 0, 0);
  state.rightLegRig.joint.rotation.set(0, 0, 0);

  state.torsoRig.spineJoint.add(skin.head);
  state.torsoRig.spineJoint.add(skin.leftArm);
  state.torsoRig.spineJoint.add(skin.rightArm);

  skin.body.position.set(0, 6, 0);
  skin.head.position.set(0, 6, 0);
  skin.leftArm.position.set(5, 6, 0);
  skin.rightArm.position.set(-5, 6, 0);
}

export function applyAdvancedAvatarPose(viewer: SkinViewer, pose: PoseState): boolean {
  const state = getStoredAdvancedRig(viewer);

  if (!state || !state.torsoRig.root.visible) {
    return false;
  }

  const skin = viewer.playerObject.skin;

  skin.body.rotation.set(0, 0, 0);
  state.torsoRig.spineJoint.rotation.set(-toRadians(pose.spineBend), 0, 0);
  skin.head.rotation.set(
    toRadians(pose.headPitch),
    toRadians(pose.headYaw),
    toRadians(pose.headRoll),
  );
  skin.leftArm.rotation.set(
    toRadians(pose.leftArmPitch),
    toRadians(pose.leftArmYaw),
    toRadians(pose.leftArmRoll),
  );
  skin.rightArm.rotation.set(
    toRadians(pose.rightArmPitch),
    toRadians(pose.rightArmYaw),
    toRadians(pose.rightArmRoll),
  );
  skin.leftLeg.rotation.set(
    toRadians(pose.leftLegPitch),
    toRadians(pose.leftLegYaw),
    toRadians(pose.leftLegRoll),
  );
  skin.rightLeg.rotation.set(
    toRadians(pose.rightLegPitch),
    toRadians(pose.rightLegYaw),
    toRadians(pose.rightLegRoll),
  );

  state.leftArmRig.joint.rotation.set(-toRadians(pose.leftElbowPitch), 0, 0);
  state.rightArmRig.joint.rotation.set(-toRadians(pose.rightElbowPitch), 0, 0);
  state.leftLegRig.joint.rotation.set(toRadians(pose.leftKneePitch), 0, 0);
  state.rightLegRig.joint.rotation.set(toRadians(pose.rightKneePitch), 0, 0);

  return true;
}

export function setAdvancedAvatarOuterLayerVisibility(
  viewer: SkinViewer,
  isVisible: boolean,
  is3dOuterLayerEnabled: boolean,
): boolean {
  const state = getStoredAdvancedRig(viewer);

  if (!state || !state.torsoRig.root.visible) {
    return false;
  }

  const pixelSource = isVisible && is3dOuterLayerEnabled
    ? getTexturePixelSource(viewer.playerObject.skin.map)
    : null;
  const canShowVoxel = isVisible && is3dOuterLayerEnabled && pixelSource !== null;

  if (pixelSource) {
    ensureHeadVoxelMesh(viewer, state, pixelSource);
    ensureTorsoVoxelMeshes(state.torsoRig, pixelSource);
    ensureSegmentVoxelMeshes(state.leftArmRig, pixelSource);
    ensureSegmentVoxelMeshes(state.rightArmRig, pixelSource);
    ensureSegmentVoxelMeshes(state.leftLegRig, pixelSource);
    ensureSegmentVoxelMeshes(state.rightLegRig, pixelSource);
  }

  viewer.playerObject.skin.head.outerLayer.visible = isVisible && !canShowVoxel;

  if (state.headVoxelMesh) {
    state.headVoxelMesh.visible = isVisible && canShowVoxel;
  }

  setTorsoOuterLayerMode(state.torsoRig, isVisible, canShowVoxel);
  setSegmentOuterLayerMode(state.leftArmRig, isVisible, canShowVoxel);
  setSegmentOuterLayerMode(state.rightArmRig, isVisible, canShowVoxel);
  setSegmentOuterLayerMode(state.leftLegRig, isVisible, canShowVoxel);
  setSegmentOuterLayerMode(state.rightLegRig, isVisible, canShowVoxel);

  return true;
}

export function getAdvancedAvatarOutlineObjects(
  viewer: SkinViewer,
  boneId: PoseBoneId,
): Object3D[] | null {
  const state = getStoredAdvancedRig(viewer);

  if (!state || !state.torsoRig.root.visible) {
    return null;
  }

  switch (boneId) {
    case "head":
      if (state.headVoxelMesh?.visible || viewer.playerObject.skin.head.outerLayer.visible) {
        return [viewer.playerObject.skin.head.outerLayer];
      }

      return viewer.playerObject.skin.head.outerLayer.visible
        ? [viewer.playerObject.skin.head.outerLayer]
        : [viewer.playerObject.skin.head.innerLayer];
    case "torso":
      return resolveTorsoOutlineObjects(state.torsoRig);
    case "leftArm":
      return resolveSegmentOutlineObjects(state.leftArmRig);
    case "rightArm":
      return resolveSegmentOutlineObjects(state.rightArmRig);
    case "leftLeg":
      return resolveSegmentOutlineObjects(state.leftLegRig);
    case "rightLeg":
      return resolveSegmentOutlineObjects(state.rightLegRig);
  }
}