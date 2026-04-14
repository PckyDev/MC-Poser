import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { SkinViewer } from "skinview3d";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";

import { DocumentModal } from "./components/editor/DocumentModal";
import { DocumentTabBar } from "./components/editor/DocumentTabBar";
import { EditorTopbar } from "./components/editor/EditorTopbar";
import {
  ExportModal,
  type ExportBackgroundMode,
  type ExportFileType,
  type ExportSettings,
} from "./components/editor/ExportModal";
import {
  HelpContactModal,
  type HelpContactModalKind,
} from "./components/editor/HelpContactModal";
import { HeldItemModal } from "./components/editor/HeldItemModal";
import { LeftSidebar } from "./components/editor/LeftSidebar";
import { NewFileModal } from "./components/editor/NewFileModal";
import { RightSidebar } from "./components/editor/RightSidebar";
import { ShareModal } from "./components/editor/ShareModal";
import { StartupModal } from "./components/editor/StartupModal";
import { ViewportPanel } from "./components/editor/ViewportPanel";
import {
  DEFAULT_POSE_SELECTION,
  DEFAULT_USERNAME,
  NEUTRAL_POSE,
  getPoseBones,
  POSE_BONES,
  PRESET_NAMES,
  POSE_PRESETS,
  type PosePresetName,
} from "./config/pose";
import type {
  ArmModel,
  AvatarType,
  HeldItemAdjustments,
  HeldItem,
  HeldItemArmId,
  HeldItemPresetId,
  HeldItemsState,
  LoadedSkin,
  ModelPreference,
  PoseBoneId,
  PoseSelection,
  PoseState,
  SkinLookupResult,
} from "./types/editor";
import {
  applyAvatarType,
  applyPose,
  buildDownloadName,
  buildSuggestedPoseName,
  clonePose,
  countAdjustedJoints,
  formatAvatarTypeLabel,
  formatModelLabel,
  formatPresetName,
  getViewerTorsoJointRoot,
  normalizePoseFileName,
  setViewerInnerLayerVisible,
  setViewerOuterLayerVisible,
} from "./utils/editor";
import {
  getAdvancedAvatarJointObject,
  getAdvancedAvatarHandAnchor,
  getAdvancedAvatarOutlineObjects,
  isAdvancedAvatarActive,
  setAdvancedAvatarOuterLayerVisibility,
} from "./utils/avatarRig";
import {
  HELD_ITEM_ARM_IDS,
  EMPTY_HELD_ITEMS,
  areHeldItemAdjustmentsDefault,
  buildPresetHeldItem,
  canRevokeHeldItemSource,
  cloneHeldItemAdjustments,
  cloneHeldItems,
  createHeldItemVoxelGeometry,
  createDefaultHeldItemAdjustments,
  createUploadedHeldItem,
  formatHeldItemArmLabel,
  isHeldItemArmId,
  isHeldItemPresetId,
  isHeldItemSourceKind,
} from "./utils/heldItems";

type WorkspaceDocument = {
  id: string;
  poseFileName: string;
  fileHandle: WorkspaceFileHandle | null;
  heldItems: HeldItemsState;
  pose: PoseState;
  selectedPoseSelection: PoseSelection;
  selectedPreset: PosePresetName | null;
  showOuterLayer: boolean;
  showOuterLayerIn3d: boolean;
  showHeldItems: boolean;
  skin: LoadedSkin | null;
  avatarType: AvatarType;
  resolvedModel: ArmModel | null;
  uploadModel: ModelPreference;
};

type ImportedWorkspaceFile = {
  version?: unknown;
  poseFileName?: unknown;
  pose?: unknown;
  heldItems?: unknown;
  skin?: unknown;
  selectedPoseSelection?: unknown;
  selectedPreset?: unknown;
  showOuterLayer?: unknown;
  showOuterLayerIn3d?: unknown;
  showHeldItems?: unknown;
  avatarType?: unknown;
  resolvedModel?: unknown;
  uploadModel?: unknown;
};

type SerializableWorkspaceFile = {
  version: 2;
  poseFileName: string;
  pose: PoseState;
  heldItems: HeldItemsState;
  skin: LoadedSkin | null;
  selectedPoseSelection: PoseSelection;
  selectedPreset: PosePresetName | null;
  showOuterLayer: boolean;
  showOuterLayerIn3d: boolean;
  showHeldItems: boolean;
  resolvedModel: ArmModel | null;
  avatarType: AvatarType;
  uploadModel: ModelPreference;
};

type PendingNewFileUpload = {
  file: File;
  previewUrl: string;
  fileName: string;
  detail: string;
};

const DEFAULT_EXPORT_BACKGROUND_COLOR = "#242a31";
const EXPORT_PREVIEW_MAX_EDGE = 560;
const SHARE_PROJECT_HASH_KEY = "p";
const SHARE_IMAGE_HASH_KEY = "i";
const LEGACY_SHARE_PROJECT_HASH_KEY = "share-project";
const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const SHARE_FILE_TYPES: readonly ExportFileType[] = ["png", "jpg", "webp"];
const SHARE_MODEL_PREFERENCES: readonly ModelPreference[] = ["default", "slim", "auto-detect"];
const SHARE_ARM_MODELS: readonly ArmModel[] = ["default", "slim"];
const SHARE_AVATAR_TYPES: readonly AvatarType[] = ["default", "bobblehead", "advanced"];
const HELD_ITEM_ADJUSTMENT_KEYS = [
  "offsetX",
  "offsetY",
  "offsetZ",
  "rotationX",
  "rotationY",
  "rotationZ",
  "scale",
  "thickness",
] as const satisfies readonly (keyof HeldItemAdjustments)[];
const PRIMARY_SITE_ORIGIN = "https://mcposer.pcky.dev";
const DEFAULT_SEO_TITLE = "MC Poser | Pose Minecraft skins in 3D";
const DEFAULT_SEO_DESCRIPTION =
  "Browser-based Minecraft skin pose editor with 3D controls, image export, and compact share links.";

type SharedSelectionPayload = readonly [0 | 1 | 2, number];

type SharedSkinPayload = readonly [
  string,
  string,
  0 | 1,
  string,
  0 | 1 | 2,
];

type SharedHeldItemAdjustmentsPayload = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

type SharedHeldItemPayload = readonly [
  string,
  0 | 1,
  string,
  string,
  SharedHeldItemAdjustmentsPayload?,
];

type SharedHeldItemsPayload = readonly [
  SharedHeldItemPayload | null,
  SharedHeldItemPayload | null,
];

type SharedProjectPayload =
  | readonly [
      1,
      string,
      number[],
      SharedSelectionPayload,
      number,
      0 | 1,
      0 | 1,
      SharedSkinPayload | null,
      -1 | 0 | 1,
      0 | 1 | 2,
      0 | 1 | 2,
    ]
  | readonly [
      2,
      string,
      number[],
      SharedSelectionPayload,
      number,
      0 | 1,
      0 | 1,
      SharedSkinPayload | null,
      -1 | 0 | 1,
      0 | 1 | 2,
      0 | 1 | 2,
      SharedHeldItemsPayload,
      (0 | 1)?,
    ];

type SharedExportSettingsPayload = readonly [
  number,
  number,
  0 | 1 | 2,
  0 | 1,
  string,
];

type SharedImagePayload = readonly [
  1,
  SharedProjectPayload,
  SharedExportSettingsPayload,
];

type ShareHashPayload = {
  kind: "project" | "image";
  payload: string;
};

type ViewportLightingMode = "lit" | "unlit";

type ViewportGizmoViewId = "right" | "left" | "top" | "bottom" | "front" | "back";

type ViewportGizmo = {
  dispose: () => void;
  pickView: (clientX: number, clientY: number) => ViewportGizmoViewId | null;
  render: (viewer: SkinViewer) => void;
  resize: () => void;
};

type RotationGizmoBinding = {
  object: Object3D;
  showX: boolean;
  showY: boolean;
  showZ: boolean;
  updatePoseFromObject: (nextPose: PoseState, object: Object3D) => PoseState;
};

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

type MeshMaterial = Mesh["material"];

type OuterLayerVoxelMeshes = Partial<Record<PoseBoneId, Mesh>>;
type HeldItemMeshes = Partial<Record<HeldItemArmId, Group>>;

type ViewportMaterialVariants = {
  lit: MeshMaterial;
  unlit: MeshMaterial | null;
};

type ViewportGizmoFacePalette = {
  accent: string;
  base: string;
  glyph: string;
  shadow: string;
};

type ViewportGizmoFaceDefinition = {
  center: readonly [number, number, number];
  id: ViewportGizmoViewId;
  icon: string[];
  normal: readonly [number, number, number];
  palette: ViewportGizmoFacePalette;
};

type WorkspaceFileWriter = {
  write: (data: string | Blob) => Promise<void>;
  close: () => Promise<void>;
};

type WorkspaceFileHandle = {
  name: string;
  createWritable: () => Promise<WorkspaceFileWriter>;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<WorkspaceFileHandle>;
};

type DebugWindow = Window & {
  __MC_POSER_DEBUG__?: {
    activeDocumentId: string;
    renderInfo: {
      calls: number;
      lines: number;
      triangles: number;
    } | null;
    showOuterLayer: boolean;
    showOuterLayerIn3d: boolean;
    showHeldItems: boolean;
    voxelMeshes: Partial<Record<
      PoseBoneId,
      {
        attachedToScene: boolean;
        indexCount: number;
        materialType: string;
        materialColor: string | null;
        materialDepthTest: boolean | null;
        materialDepthWrite: boolean | null;
        materialOpacity: number | null;
        materialTransparent: boolean | null;
        materialVertexColors: boolean | null;
        parentName: string | null;
        parentType: string | null;
        positionCount: number;
        renderedFrames: number;
        visible: boolean;
      }
    >>;
  };
  __MC_POSER_DEBUG_HELPERS__?: {
    addSceneDebugCube: () => void;
    addSceneDebugVoxelClone: () => void;
    removeSceneDebugCube: () => void;
    removeSceneDebugVoxelClone: () => void;
  };
};

const POSE_KEYS = Object.keys(NEUTRAL_POSE) as Array<keyof PoseState>;
const POSE_FIELD_LIMITS = new Map(
  POSE_BONES.flatMap((bone) => bone.fields.map((field) => [field.key, field] as const)),
);
const POSE_BONE_ID_SET = new Set<PoseBoneId>(POSE_BONES.map((bone) => bone.id));
const POSE_PRESET_NAME_SET = new Set<PosePresetName>(
  Object.keys(POSE_PRESETS) as PosePresetName[],
);
const OUTER_LAYER_TEXTURE_ORIGINS: Record<PoseBoneId, { u: number; v: number }> = {
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
const VIEWPORT_MATERIAL_VARIANTS_KEY = "__mcPoserViewportMaterialVariants";
const VIEWPORT_GIZMO_FACE_DEFINITIONS: ViewportGizmoFaceDefinition[] = [
  {
    center: [0.84, 0, 0],
    id: "right",
    icon: [
      ".......",
      "...##..",
      "....##.",
      "#####..",
      "....##.",
      "...##..",
      ".......",
    ],
    normal: [1, 0, 0],
    palette: {
      accent: "#d9806f",
      base: "#b85b4f",
      glyph: "#fff4df",
      shadow: "#6d2f2a",
    },
  },
  {
    center: [-0.84, 0, 0],
    id: "left",
    icon: [
      ".......",
      "..##...",
      ".##....",
      "..#####",
      ".##....",
      "..##...",
      ".......",
    ],
    normal: [-1, 0, 0],
    palette: {
      accent: "#a05852",
      base: "#87413e",
      glyph: "#fff1d8",
      shadow: "#4f2523",
    },
  },
  {
    center: [0, 0.84, 0],
    id: "top",
    icon: [
      "...#...",
      "..###..",
      ".##.##.",
      "...#...",
      "...#...",
      ".......",
      ".......",
    ],
    normal: [0, 1, 0],
    palette: {
      accent: "#7fc96e",
      base: "#5ea95a",
      glyph: "#f4ffe4",
      shadow: "#355d35",
    },
  },
  {
    center: [0, -0.84, 0],
    id: "bottom",
    icon: [
      ".......",
      ".......",
      "...#...",
      "...#...",
      ".##.##.",
      "..###..",
      "...#...",
    ],
    normal: [0, -1, 0],
    palette: {
      accent: "#b88f52",
      base: "#8c6b3e",
      glyph: "#fff0d1",
      shadow: "#513b22",
    },
  },
  {
    center: [0, 0, 0.84],
    id: "front",
    icon: [
      ".......",
      ".##.##.",
      ".##.##.",
      ".......",
      ".#####.",
      ".#...#.",
      ".......",
    ],
    normal: [0, 0, 1],
    palette: {
      accent: "#84aeea",
      base: "#567dc8",
      glyph: "#eef6ff",
      shadow: "#2c4476",
    },
  },
  {
    center: [0, 0, -0.84],
    id: "back",
    icon: [
      ".#####.",
      ".#...#.",
      ".#.#.#.",
      ".#...#.",
      ".#.#.#.",
      ".#...#.",
      ".#####.",
    ],
    normal: [0, 0, -1],
    palette: {
      accent: "#5f78af",
      base: "#415788",
      glyph: "#eef5ff",
      shadow: "#24324d",
    },
  },
];
const VIEWPORT_LIGHTING_PRESETS: Record<
  ViewportLightingMode,
  { globalLightIntensity: number; cameraLightIntensity: number }
> = {
  lit: {
    globalLightIntensity: 1.15,
    cameraLightIntensity: 0.85,
  },
  unlit: {
    globalLightIntensity: 1,
    cameraLightIntensity: 0,
  },
};

type VoxelThicknessAxis = "x" | "y" | "z";

type VoxelSlabTransform = {
  axis: VoxelThicknessAxis;
  outwardDirection: -1 | 1;
};

function getOuterLayerShellExpansion(boneId: PoseBoneId): number {
  return boneId === "head" ? 0.5 : 0.25;
}

function resolveViewportGizmoCameraView(viewId: ViewportGizmoViewId): {
  direction: Vector3;
  up: Vector3;
} {
  switch (viewId) {
    case "right":
      return {
        direction: new Vector3(1, 0, 0),
        up: new Vector3(0, 1, 0),
      };
    case "left":
      return {
        direction: new Vector3(-1, 0, 0),
        up: new Vector3(0, 1, 0),
      };
    case "top":
      return {
        direction: new Vector3(0, 1, 0),
        up: new Vector3(0, 0, 1),
      };
    case "bottom":
      return {
        direction: new Vector3(0, -1, 0),
        up: new Vector3(0, 0, 1),
      };
    case "front":
      return {
        direction: new Vector3(0, 0, 1),
        up: new Vector3(0, 1, 0),
      };
    case "back":
      return {
        direction: new Vector3(0, 0, -1),
        up: new Vector3(0, 1, 0),
      };
  }
}

function drawViewportGizmoIcon(
  context: CanvasRenderingContext2D,
  icon: string[],
  palette: ViewportGizmoFacePalette,
): void {
  const pixelSize = 4;
  const iconHeight = icon.length * pixelSize;
  const iconWidth = (icon[0]?.length ?? 0) * pixelSize;
  const offsetX = Math.floor((context.canvas.width - iconWidth) / 2);
  const offsetY = Math.floor((context.canvas.height - iconHeight) / 2);

  icon.forEach((row, rowIndex) => {
    row.split("").forEach((pixel, columnIndex) => {
      if (pixel !== "#") {
        return;
      }

      context.fillStyle = palette.shadow;
      context.fillRect(
        offsetX + columnIndex * pixelSize + 1,
        offsetY + rowIndex * pixelSize + 1,
        pixelSize,
        pixelSize,
      );

      context.fillStyle = palette.glyph;
      context.fillRect(
        offsetX + columnIndex * pixelSize,
        offsetY + rowIndex * pixelSize,
        pixelSize,
        pixelSize,
      );
    });
  });
}

function createViewportGizmoFaceTexture(
  icon: string[],
  palette: ViewportGizmoFacePalette,
): CanvasTexture {
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 64;
  faceCanvas.height = 64;

  const context = faceCanvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create viewport gizmo textures.");
  }

  context.imageSmoothingEnabled = false;
  context.fillStyle = palette.shadow;
  context.fillRect(0, 0, faceCanvas.width, faceCanvas.height);
  context.fillStyle = palette.base;
  context.fillRect(4, 4, faceCanvas.width - 8, faceCanvas.height - 8);

  const tileSize = 8;

  for (let rowIndex = 0; rowIndex < 7; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < 7; columnIndex += 1) {
      if ((rowIndex + columnIndex) % 2 !== 0) {
        continue;
      }

      context.fillStyle = palette.accent;
      context.fillRect(
        4 + columnIndex * tileSize,
        4 + rowIndex * tileSize,
        tileSize,
        tileSize,
      );
    }
  }

  context.fillStyle = "rgba(255, 255, 255, 0.16)";
  context.fillRect(4, 4, faceCanvas.width - 8, 6);
  drawViewportGizmoIcon(context, icon, palette);

  const texture = new CanvasTexture(faceCanvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;

  return texture;
}

function createViewportGizmo(canvas: HTMLCanvasElement): ViewportGizmo {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "low-power",
  });
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 20);
  const gizmoAssembly = new Group();
  const gizmoRoot = new Group();
  const pickPointer = new Vector2();
  const pickRaycaster = new Raycaster();
  const cubeGeometry = new BoxGeometry(1.68, 1.68, 1.68);
  const edgeGeometry = new EdgesGeometry(cubeGeometry);
  const faceTextures = VIEWPORT_GIZMO_FACE_DEFINITIONS.map(({ icon, palette }) =>
    createViewportGizmoFaceTexture(icon, palette),
  );
  const faceMaterials = faceTextures.map(
    (texture) =>
      new MeshStandardMaterial({
        map: texture,
        metalness: 0,
        roughness: 1,
      }),
  );
  const cubeMesh = new Mesh(cubeGeometry, faceMaterials);
  const edgeMaterial = new LineBasicMaterial({
    color: 0x161b22,
    opacity: 0.62,
    transparent: true,
  });
  const edgeLines = new LineSegments(edgeGeometry, edgeMaterial);
  const markerGeometry = new BoxGeometry(0.26, 0.26, 0.26);
  const markerConfigs = [
    { color: 0xff9d86, position: [1.14, 0, 0] as const, viewId: "right" as const },
    { color: 0x8bdb76, position: [0, 1.14, 0] as const, viewId: "top" as const },
    { color: 0x94c9ff, position: [0, 0, 1.14] as const, viewId: "front" as const },
  ];
  const markerMaterials = markerConfigs.map(
    ({ color }) =>
      new MeshStandardMaterial({
        color,
        metalness: 0,
        roughness: 1,
      }),
  );
  const markerMeshes = markerConfigs.map(({ position, viewId }, markerIndex) => {
    const markerMesh = new Mesh(markerGeometry, markerMaterials[markerIndex]!);
    const [x, y, z] = position;

    markerMesh.position.set(x, y, z);
    markerMesh.userData.viewId = viewId;
    return markerMesh;
  });
  const pickTargets: Object3D[] = [cubeMesh, ...markerMeshes];

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  camera.position.set(0, 0, 4.6);
  scene.add(new AmbientLight(0xffffff, 1.5));

  const keyLight = new DirectionalLight(0xffffff, 1.05);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const fillLight = new DirectionalLight(0xa7c5ff, 0.45);
  fillLight.position.set(-2, -1, 3);
  scene.add(fillLight);

  gizmoAssembly.add(cubeMesh);
  gizmoAssembly.add(edgeLines);
  markerMeshes.forEach((markerMesh) => {
    gizmoAssembly.add(markerMesh);
  });
  gizmoRoot.add(gizmoAssembly);
  scene.add(gizmoRoot);

  const resize = () => {
    const width = Math.max(1, Math.floor(canvas.clientWidth));
    const height = Math.max(1, Math.floor(canvas.clientHeight));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = (viewer: SkinViewer) => {
    viewer.camera.updateMatrixWorld();
    gizmoRoot.quaternion.copy(viewer.camera.quaternion).invert();
    renderer.render(scene, camera);
  };

  const resolveFaceViewIdFromMaterialIndex = (
    materialIndex: number | null,
  ): ViewportGizmoViewId | null => {
    if (
      materialIndex === null ||
      materialIndex < 0 ||
      materialIndex >= VIEWPORT_GIZMO_FACE_DEFINITIONS.length
    ) {
      return null;
    }

    return VIEWPORT_GIZMO_FACE_DEFINITIONS[materialIndex]?.id ?? null;
  };

  const resolveCubeMaterialIndexFromFaceIndex = (faceIndex: number | undefined): number | null => {
    if (typeof faceIndex !== "number") {
      return null;
    }

    const geometryGroup = cubeGeometry.groups.find((group) => {
      const triangleStart = faceIndex * 3;
      return triangleStart >= group.start && triangleStart < group.start + group.count;
    });

    return geometryGroup?.materialIndex ?? null;
  };

  const pickView = (clientX: number, clientY: number): ViewportGizmoViewId | null => {
    const canvasBounds = canvas.getBoundingClientRect();

    if (canvasBounds.width <= 0 || canvasBounds.height <= 0) {
      return null;
    }

    const localClickX = clientX - canvasBounds.left;
    const localClickY = clientY - canvasBounds.top;

    pickPointer.x = (localClickX / canvasBounds.width) * 2 - 1;
    pickPointer.y = -((localClickY / canvasBounds.height) * 2 - 1);

    camera.updateMatrixWorld();
    gizmoRoot.updateMatrixWorld(true);
    pickRaycaster.setFromCamera(pickPointer, camera);

    const hit = pickRaycaster.intersectObjects(pickTargets, false)[0];

    if (!hit) {
      return null;
    }

    if (hit.object !== cubeMesh) {
      return (hit.object.userData.viewId as ViewportGizmoViewId | undefined) ?? null;
    }

    return resolveFaceViewIdFromMaterialIndex(
      typeof hit.face?.materialIndex === "number"
        ? hit.face.materialIndex
        : resolveCubeMaterialIndexFromFaceIndex(hit.faceIndex),
    );
  };

  const dispose = () => {
    markerGeometry.dispose();
    cubeGeometry.dispose();
    edgeGeometry.dispose();
    edgeMaterial.dispose();
    disposeMaterialInstances(faceMaterials, markerMaterials);
    faceTextures.forEach((texture) => {
      texture.dispose();
    });
    renderer.dispose();
  };

  resize();

  return {
    dispose,
    pickView,
    render,
    resize,
  };
}

function collectMaterialInstances(materialSet: MeshMaterial | null): Material[] {
  if (!materialSet) {
    return [];
  }

  return Array.isArray(materialSet) ? materialSet : [materialSet];
}

function disposeMaterialInstances(...materialSets: Array<MeshMaterial | null>): void {
  const uniqueMaterials = new Set<Material>();

  materialSets
    .flatMap((materialSet) => collectMaterialInstances(materialSet))
    .forEach((material) => {
      uniqueMaterials.add(material);
    });

  uniqueMaterials.forEach((material) => {
    material.dispose();
  });
}

function createUnlitMaterialVariant(materialSet: MeshMaterial): MeshMaterial {
  if (Array.isArray(materialSet)) {
    return materialSet.map((material) => createUnlitSingleMaterial(material));
  }

  return createUnlitSingleMaterial(materialSet);
}

function createUnlitSingleMaterial(sourceMaterial: Material): MeshBasicMaterial {
  const renderMaterial = sourceMaterial as Material &
    Partial<MeshBasicMaterial> &
    Partial<MeshStandardMaterial>;
  const unlitMaterial = new MeshBasicMaterial();

  unlitMaterial.name = sourceMaterial.name;
  unlitMaterial.alphaMap = renderMaterial.alphaMap ?? null;
  unlitMaterial.alphaTest = renderMaterial.alphaTest ?? 0;
  unlitMaterial.depthTest = sourceMaterial.depthTest;
  unlitMaterial.depthWrite = sourceMaterial.depthWrite;
  unlitMaterial.map = renderMaterial.map ?? null;
  unlitMaterial.opacity = sourceMaterial.opacity;
  unlitMaterial.side = sourceMaterial.side;
  unlitMaterial.toneMapped = false;
  unlitMaterial.transparent = sourceMaterial.transparent;
  unlitMaterial.vertexColors = renderMaterial.vertexColors ?? false;
  unlitMaterial.visible = sourceMaterial.visible;
  unlitMaterial.wireframe = renderMaterial.wireframe ?? false;

  if (renderMaterial.color) {
    unlitMaterial.color.copy(renderMaterial.color);
  }

  return unlitMaterial;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isModelPreference(value: unknown): value is ModelPreference {
  return value === "default" || value === "slim" || value === "auto-detect";
}

function isAvatarType(value: unknown): value is AvatarType {
  return value === "default" || value === "bobblehead" || value === "advanced";
}

function isArmModel(value: unknown): value is ArmModel {
  return value === "default" || value === "slim";
}

function isPoseBoneId(value: unknown): value is PoseBoneId {
  return typeof value === "string" && POSE_BONE_ID_SET.has(value as PoseBoneId);
}

function isPoseKey(value: unknown): value is keyof PoseState {
  return typeof value === "string" && POSE_KEYS.includes(value as keyof PoseState);
}

function normalizeImportedHeldItemAdjustments(rawAdjustments: unknown): HeldItemAdjustments {
  const nextAdjustments = createDefaultHeldItemAdjustments();

  if (!isObjectRecord(rawAdjustments)) {
    return nextAdjustments;
  }

  for (const adjustmentKey of HELD_ITEM_ADJUSTMENT_KEYS) {
    const rawValue = rawAdjustments[adjustmentKey];

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      nextAdjustments[adjustmentKey] = rawValue;
    }
  }

  return nextAdjustments;
}

function normalizeImportedHeldItem(rawHeldItem: unknown): HeldItem | null {
  if (!isObjectRecord(rawHeldItem)) {
    return null;
  }

  const presetId = isHeldItemPresetId(rawHeldItem.presetId)
    ? rawHeldItem.presetId
    : null;

  if (presetId) {
    const presetItem = buildPresetHeldItem(presetId);

    return {
      ...presetItem,
      adjustments: normalizeImportedHeldItemAdjustments(rawHeldItem.adjustments),
      detail:
        typeof rawHeldItem.detail === "string" && rawHeldItem.detail.trim()
          ? rawHeldItem.detail.trim()
          : presetItem.detail,
      label:
        typeof rawHeldItem.label === "string" && rawHeldItem.label.trim()
          ? rawHeldItem.label.trim()
          : presetItem.label,
      source:
        typeof rawHeldItem.source === "string" && rawHeldItem.source.trim()
          ? rawHeldItem.source.trim()
          : presetItem.source,
    };
  }

  const source = typeof rawHeldItem.source === "string" ? rawHeldItem.source.trim() : "";

  if (!source) {
    return null;
  }

  return {
    adjustments: normalizeImportedHeldItemAdjustments(rawHeldItem.adjustments),
    detail:
      typeof rawHeldItem.detail === "string" && rawHeldItem.detail.trim()
        ? rawHeldItem.detail.trim()
        : "Imported held item",
    label:
      typeof rawHeldItem.label === "string" && rawHeldItem.label.trim()
        ? rawHeldItem.label.trim()
        : "Imported item",
    presetId: null,
    source,
    sourceKind: isHeldItemSourceKind(rawHeldItem.sourceKind)
      ? rawHeldItem.sourceKind
      : "upload",
  };
}

function normalizeImportedHeldItems(rawHeldItems: unknown): HeldItemsState {
  if (!isObjectRecord(rawHeldItems)) {
    return cloneHeldItems();
  }

  return {
    leftArm: normalizeImportedHeldItem(rawHeldItems.leftArm),
    rightArm: normalizeImportedHeldItem(rawHeldItems.rightArm),
  };
}

function normalizeImportedPose(rawPose: unknown): PoseState {
  const nextPose = clonePose(NEUTRAL_POSE);

  if (!isObjectRecord(rawPose)) {
    return nextPose;
  }

  for (const poseKey of POSE_KEYS) {
    const rawValue = rawPose[poseKey];

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      nextPose[poseKey] = rawValue;
    }
  }

  return nextPose;
}

function normalizeImportedSelection(rawSelection: unknown): PoseSelection {
  if (!isObjectRecord(rawSelection) || typeof rawSelection.kind !== "string") {
    return DEFAULT_POSE_SELECTION;
  }

  if (rawSelection.kind === "bone" && isPoseBoneId(rawSelection.id)) {
    return {
      kind: "bone",
      id: rawSelection.id,
    };
  }

  if (rawSelection.kind === "joint" && isPoseKey(rawSelection.id)) {
    return {
      kind: "joint",
      id: rawSelection.id,
    };
  }

  if (rawSelection.kind === "heldItem" && isHeldItemArmId(rawSelection.id)) {
    return {
      kind: "heldItem",
      id: rawSelection.id,
    };
  }

  return DEFAULT_POSE_SELECTION;
}

function normalizeImportedSkin(
  rawSkin: unknown,
  rawResolvedModel: unknown,
): LoadedSkin | null {
  if (!isObjectRecord(rawSkin)) {
    return null;
  }

  const source = typeof rawSkin.source === "string" ? rawSkin.source.trim() : "";

  if (!source) {
    return null;
  }

  const origin = rawSkin.origin === "username" ? "username" : "upload";
  const fallbackModel =
    origin === "username"
      ? (isArmModel(rawResolvedModel) ? rawResolvedModel : "default")
      : "auto-detect";

  return {
    source,
    label:
      typeof rawSkin.label === "string" && rawSkin.label.trim()
        ? rawSkin.label.trim()
        : "Imported skin",
    origin,
    detail:
      typeof rawSkin.detail === "string" && rawSkin.detail.trim()
        ? rawSkin.detail.trim()
        : origin === "username"
          ? "Imported username skin"
          : "Imported PNG skin",
    modelPreference: isModelPreference(rawSkin.modelPreference)
      ? rawSkin.modelPreference
      : fallbackModel,
  };
}

async function serializeWorkspaceHeldItem(item: HeldItem | null): Promise<HeldItem | null> {
  if (!item) {
    return null;
  }

  const serializedAdjustments = cloneHeldItemAdjustments(item.adjustments);

  if (item.sourceKind !== "upload" || item.source.startsWith("data:")) {
    return {
      ...item,
      adjustments: serializedAdjustments,
    };
  }

  const response = await fetch(item.source);

  if (!response.ok) {
    throw new Error("Unable to package an uploaded held item for saving.");
  }

  const dataUrl = await blobToDataUrl(await response.blob());

  return {
    ...item,
    adjustments: serializedAdjustments,
    source: dataUrl,
  };
}

async function serializeWorkspaceHeldItems(heldItems: HeldItemsState): Promise<HeldItemsState> {
  return {
    leftArm: await serializeWorkspaceHeldItem(heldItems.leftArm),
    rightArm: await serializeWorkspaceHeldItem(heldItems.rightArm),
  };
}

function canRevokeSkinSource(skin: LoadedSkin | null): skin is LoadedSkin {
  return skin?.origin === "upload" && skin.source.startsWith("blob:");
}

function getSaveFilePicker(): SaveFilePickerWindow["showSaveFilePicker"] {
  return (window as SaveFilePickerWindow).showSaveFilePicker;
}

function getOuterLayerDimensions(
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

function getTexturePixelSource(texture: Texture | null): TexturePixelSource | null {
  const image = texture?.image as (CanvasImageSource & {
    width?: number;
    height?: number;
  }) | null;

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

function createOuterLayerVoxelGeometry(
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

      positions.push(
        localX + center.x,
        localY + center.y,
        localZ + center.z,
      );
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
    { u: textureOrigin.u + width + depth * 2, v: textureOrigin.v + depth, width, height },
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
    { u: textureOrigin.u + width + depth, v: textureOrigin.v + depth, width: depth, height },
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

  visitFaceTexels(
    { u: textureOrigin.u + width + depth, v: textureOrigin.v, width, height: depth },
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

  const voxelGeometry = new BufferGeometry();
  voxelGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  voxelGeometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  voxelGeometry.setAttribute("color", new Float32BufferAttribute(colors, 4));
  voxelGeometry.computeBoundingBox();
  voxelGeometry.computeBoundingSphere();

  return voxelGeometry;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read that PNG file."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Unable to read that PNG file."));
    };

    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Unable to render that export image."));
    }, type, quality);
  });
}

function getExportMimeType(fileType: ExportFileType): string {
  switch (fileType) {
    case "png":
      return "image/png";
    case "jpg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
  }
}

function buildDefaultExportSettings(sourceCanvas: HTMLCanvasElement | null): ExportSettings {
  const sourceAspectRatio =
    sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0
      ? sourceCanvas.height / sourceCanvas.width
      : 1;
  const width = 1024;

  return {
    width,
    height: Math.max(64, Math.round(width * sourceAspectRatio)),
    fileType: "png",
    backgroundMode: "transparent",
    backgroundColor: DEFAULT_EXPORT_BACKGROUND_COLOR,
  };
}

function buildExportPreviewSettings(settings: ExportSettings): ExportSettings {
  const longestEdge = Math.max(settings.width, settings.height, 1);
  const scale = Math.min(1, EXPORT_PREVIEW_MAX_EDGE / longestEdge);

  return {
    ...settings,
    width: Math.max(64, Math.round(settings.width * scale)),
    height: Math.max(64, Math.round(settings.height * scale)),
  };
}

function modelPreferenceToShareCode(value: ModelPreference): 0 | 1 | 2 {
  switch (value) {
    case "default":
      return 0;
    case "slim":
      return 1;
    case "auto-detect":
      return 2;
  }
}

function modelPreferenceFromShareCode(
  value: unknown,
  fallback: ModelPreference = "auto-detect",
): ModelPreference {
  return typeof value === "number" && SHARE_MODEL_PREFERENCES[value]
    ? SHARE_MODEL_PREFERENCES[value]
    : fallback;
}

function armModelToShareCode(value: ArmModel | null): -1 | 0 | 1 {
  if (value === null) {
    return -1;
  }

  return value === "default" ? 0 : 1;
}

function armModelFromShareCode(value: unknown): ArmModel | null {
  return typeof value === "number" && SHARE_ARM_MODELS[value]
    ? SHARE_ARM_MODELS[value]
    : null;
}

function exportFileTypeToShareCode(value: ExportFileType): 0 | 1 | 2 {
  switch (value) {
    case "png":
      return 0;
    case "jpg":
      return 1;
    case "webp":
      return 2;
  }
}

function exportFileTypeFromShareCode(value: unknown): ExportFileType {
  return typeof value === "number" && SHARE_FILE_TYPES[value]
    ? SHARE_FILE_TYPES[value]
    : "png";
}

function avatarTypeToShareCode(value: AvatarType): 0 | 1 | 2 {
  if (value === "bobblehead") {
    return 1;
  }

  if (value === "advanced") {
    return 2;
  }

  return 0;
}

function avatarTypeFromShareCode(value: unknown): AvatarType {
  return typeof value === "number" && SHARE_AVATAR_TYPES[value]
    ? SHARE_AVATAR_TYPES[value]
    : "default";
}

function heldItemSourceKindToShareCode(value: HeldItem["sourceKind"]): 0 | 1 {
  return value === "preset" ? 0 : 1;
}

function heldItemSourceKindFromShareCode(value: unknown): HeldItem["sourceKind"] {
  return value === 0 ? "preset" : "upload";
}

function encodeShareSelection(selection: PoseSelection): SharedSelectionPayload {
  if (selection.kind === "bone") {
    const boneIndex = POSE_BONES.findIndex((bone) => bone.id === selection.id);

    return [0, boneIndex === -1 ? 0 : boneIndex];
  }

  if (selection.kind === "heldItem") {
    const armIndex = HELD_ITEM_ARM_IDS.indexOf(selection.id);

    return [2, armIndex === -1 ? 0 : armIndex];
  }

  const poseIndex = POSE_KEYS.indexOf(selection.id);

  return [1, poseIndex === -1 ? 0 : poseIndex];
}

function decodeShareSelection(payload: unknown): PoseSelection {
  if (!Array.isArray(payload)) {
    return DEFAULT_POSE_SELECTION;
  }

  const selectionKind = payload[0];
  const selectionIndex = typeof payload[1] === "number" ? Math.trunc(payload[1]) : -1;

  if (selectionKind === 0) {
    const boneId = POSE_BONES[selectionIndex]?.id;

    if (boneId) {
      return { kind: "bone", id: boneId };
    }
  }

  if (selectionKind === 1) {
    const poseKey = POSE_KEYS[selectionIndex];

    if (poseKey) {
      return { kind: "joint", id: poseKey };
    }
  }

  if (selectionKind === 2) {
    const armId = HELD_ITEM_ARM_IDS[selectionIndex];

    if (armId) {
      return { kind: "heldItem", id: armId };
    }
  }

  return DEFAULT_POSE_SELECTION;
}

function encodeShareSkin(skin: LoadedSkin | null): SharedSkinPayload | null {
  if (!skin) {
    return null;
  }

  const encodedSource =
    skin.origin === "upload" && skin.source.startsWith(PNG_DATA_URL_PREFIX)
      ? skin.source.slice(PNG_DATA_URL_PREFIX.length)
      : skin.source;

  return [
    encodedSource,
    skin.label,
    skin.origin === "username" ? 0 : 1,
    skin.detail,
    modelPreferenceToShareCode(skin.modelPreference),
  ];
}

function decodeShareSkin(
  payload: unknown,
  resolvedModel: ArmModel | null,
): LoadedSkin | null {
  if (!Array.isArray(payload) || typeof payload[0] !== "string") {
    return null;
  }

  const origin = payload[2] === 0 ? "username" : "upload";
  const rawSource = payload[0].trim();

  if (!rawSource) {
    return null;
  }

  const fallbackModel = origin === "username" ? (resolvedModel ?? "default") : "auto-detect";

  return {
    source:
      origin === "upload" && !rawSource.startsWith("data:")
        ? `${PNG_DATA_URL_PREFIX}${rawSource}`
        : rawSource,
    label:
      typeof payload[1] === "string" && payload[1].trim()
        ? payload[1].trim()
        : "Shared skin",
    origin,
    detail:
      typeof payload[3] === "string" && payload[3].trim()
        ? payload[3].trim()
        : origin === "username"
          ? "Shared username skin"
          : "Shared PNG skin",
    modelPreference: modelPreferenceFromShareCode(payload[4], fallbackModel),
  };
}

function encodeShareHeldItemAdjustments(
  adjustments: HeldItemAdjustments,
): SharedHeldItemAdjustmentsPayload | undefined {
  const normalizedAdjustments = cloneHeldItemAdjustments(adjustments);

  if (areHeldItemAdjustmentsDefault(normalizedAdjustments)) {
    return undefined;
  }

  return [
    normalizedAdjustments.offsetX,
    normalizedAdjustments.offsetY,
    normalizedAdjustments.offsetZ,
    normalizedAdjustments.rotationX,
    normalizedAdjustments.rotationY,
    normalizedAdjustments.rotationZ,
    normalizedAdjustments.scale,
    normalizedAdjustments.thickness,
  ];
}

function decodeShareHeldItemAdjustments(payload: unknown): HeldItemAdjustments {
  if (!Array.isArray(payload)) {
    return createDefaultHeldItemAdjustments();
  }

  const nextAdjustments: Partial<HeldItemAdjustments> = {};

  HELD_ITEM_ADJUSTMENT_KEYS.forEach((adjustmentKey, index) => {
    const value = payload[index];

    if (typeof value === "number" && Number.isFinite(value)) {
      nextAdjustments[adjustmentKey] = value;
    }
  });

  return cloneHeldItemAdjustments(nextAdjustments);
}

function encodeShareHeldItem(item: HeldItem | null): SharedHeldItemPayload | null {
  if (!item) {
    return null;
  }

  const encodedAdjustments = encodeShareHeldItemAdjustments(item.adjustments);

  return encodedAdjustments
    ? [
        item.label,
        heldItemSourceKindToShareCode(item.sourceKind),
        item.detail,
        item.sourceKind === "preset" && item.presetId ? item.presetId : item.source,
        encodedAdjustments,
      ]
    : [
        item.label,
        heldItemSourceKindToShareCode(item.sourceKind),
        item.detail,
        item.sourceKind === "preset" && item.presetId ? item.presetId : item.source,
      ];
}

function decodeShareHeldItem(payload: unknown): HeldItem | null {
  if (!Array.isArray(payload) || typeof payload[3] !== "string") {
    return null;
  }

  const sourceKind = heldItemSourceKindFromShareCode(payload[1]);
  const payloadValue = payload[3].trim();

  if (!payloadValue) {
    return null;
  }

  if (sourceKind === "preset" && isHeldItemPresetId(payloadValue)) {
    const presetItem = buildPresetHeldItem(payloadValue);

    return {
      ...presetItem,
      adjustments: decodeShareHeldItemAdjustments(payload[4]),
      detail:
        typeof payload[2] === "string" && payload[2].trim()
          ? payload[2].trim()
          : presetItem.detail,
      label:
        typeof payload[0] === "string" && payload[0].trim()
          ? payload[0].trim()
          : presetItem.label,
    };
  }

  return {
    adjustments: decodeShareHeldItemAdjustments(payload[4]),
    detail:
      typeof payload[2] === "string" && payload[2].trim()
        ? payload[2].trim()
        : "Shared held item",
    label:
      typeof payload[0] === "string" && payload[0].trim()
        ? payload[0].trim()
        : "Shared item",
    presetId: null,
    source: payloadValue,
    sourceKind: sourceKind === "preset" ? "upload" : sourceKind,
  };
}

function encodeShareHeldItems(heldItems: HeldItemsState): SharedHeldItemsPayload {
  return [
    encodeShareHeldItem(heldItems.leftArm),
    encodeShareHeldItem(heldItems.rightArm),
  ];
}

function decodeShareHeldItems(payload: unknown): HeldItemsState {
  if (!Array.isArray(payload)) {
    return cloneHeldItems();
  }

  return {
    leftArm: decodeShareHeldItem(payload[0]),
    rightArm: decodeShareHeldItem(payload[1]),
  };
}

function buildHeldItemGeometryKey(heldItems: HeldItemsState): string {
  return HELD_ITEM_ARM_IDS.map((armId) => {
    const heldItem = heldItems[armId];

    if (!heldItem) {
      return `${armId}:none`;
    }

    const thickness = cloneHeldItemAdjustments(heldItem.adjustments).thickness;

    return [
      armId,
      heldItem.sourceKind,
      heldItem.presetId ?? "upload",
      heldItem.source,
      thickness,
    ].join(":");
  }).join("|");
}

function encodeWorkspaceForShare(
  workspaceFile: SerializableWorkspaceFile,
): SharedProjectPayload {
  return [
    2,
    workspaceFile.poseFileName,
    POSE_KEYS.map((poseKey) => workspaceFile.pose[poseKey]),
    encodeShareSelection(workspaceFile.selectedPoseSelection),
    workspaceFile.selectedPreset ? PRESET_NAMES.indexOf(workspaceFile.selectedPreset) : -1,
    workspaceFile.showOuterLayer ? 1 : 0,
    workspaceFile.showOuterLayerIn3d ? 1 : 0,
    encodeShareSkin(workspaceFile.skin),
    armModelToShareCode(workspaceFile.resolvedModel),
    modelPreferenceToShareCode(workspaceFile.uploadModel),
    avatarTypeToShareCode(workspaceFile.avatarType),
    encodeShareHeldItems(workspaceFile.heldItems),
    workspaceFile.showHeldItems ? 1 : 0,
  ];
}

function decodeSharedProjectPayload(payload: unknown): ImportedWorkspaceFile {
  if (
    !Array.isArray(payload) ||
    (payload[0] !== 1 && payload[0] !== 2)
  ) {
    throw new Error("That shared project link is invalid.");
  }

  const sharePayload = payload as unknown[];
  const nextPose = clonePose(NEUTRAL_POSE);
  const poseValues = Array.isArray(sharePayload[2]) ? sharePayload[2] : [];

  poseValues.forEach((rawValue, index) => {
    const poseKey = POSE_KEYS[index];

    if (poseKey && typeof rawValue === "number" && Number.isFinite(rawValue)) {
      nextPose[poseKey] = rawValue;
    }
  });

  const resolvedModel = armModelFromShareCode(sharePayload[8]);
  const selectedPresetIndex =
    typeof sharePayload[4] === "number" ? Math.trunc(sharePayload[4]) : -1;
  const selectedPreset = PRESET_NAMES[selectedPresetIndex] ?? null;
  const heldItems = sharePayload[0] === 2
    ? decodeShareHeldItems(sharePayload[11])
    : cloneHeldItems();

  return {
    version: sharePayload[0],
    poseFileName:
      typeof sharePayload[1] === "string" && sharePayload[1].trim()
        ? sharePayload[1].trim()
        : "shared-project.mcpose",
    pose: nextPose,
    heldItems,
    skin: decodeShareSkin(sharePayload[7], resolvedModel),
    selectedPoseSelection: decodeShareSelection(sharePayload[3]),
    selectedPreset,
    showOuterLayer: sharePayload[5] !== 0,
    showOuterLayerIn3d: sharePayload[6] === 1,
    showHeldItems: sharePayload[12] !== 0,
    resolvedModel,
    uploadModel: modelPreferenceFromShareCode(sharePayload[9]),
    avatarType: avatarTypeFromShareCode(sharePayload[10]),
  };
}

function decodeProjectShareValue(payload: unknown): ImportedWorkspaceFile {
  if (Array.isArray(payload)) {
    return decodeSharedProjectPayload(payload);
  }

  if (isObjectRecord(payload)) {
    return payload as ImportedWorkspaceFile;
  }

  throw new Error("That shared project link is invalid.");
}

function encodeShareExportSettings(
  settings: ExportSettings,
): SharedExportSettingsPayload {
  return [
    settings.width,
    settings.height,
    exportFileTypeToShareCode(settings.fileType),
    settings.backgroundMode === "solid" ? 1 : 0,
    settings.backgroundColor,
  ];
}

function decodeShareExportSettings(payload: unknown): ExportSettings {
  if (!Array.isArray(payload)) {
    throw new Error("That shared image link is invalid.");
  }

  const nextFileType = exportFileTypeFromShareCode(payload[2]);
  const nextWidth =
    typeof payload[0] === "number" && Number.isFinite(payload[0])
      ? Math.max(64, Math.min(4096, Math.round(payload[0])))
      : 1024;
  const nextHeight =
    typeof payload[1] === "number" && Number.isFinite(payload[1])
      ? Math.max(64, Math.min(4096, Math.round(payload[1])))
      : 1024;

  return {
    width: nextWidth,
    height: nextHeight,
    fileType: nextFileType,
    backgroundMode:
      nextFileType === "jpg"
        ? "solid"
        : payload[3] === 1
          ? "solid"
          : "transparent",
    backgroundColor:
      typeof payload[4] === "string" && /^#[0-9a-fA-F]{6}$/.test(payload[4])
        ? payload[4]
        : DEFAULT_EXPORT_BACKGROUND_COLOR,
  };
}

function encodeImageSharePayload(
  workspaceFile: SerializableWorkspaceFile,
  settings: ExportSettings,
): SharedImagePayload {
  return [1, encodeWorkspaceForShare(workspaceFile), encodeShareExportSettings(settings)];
}

function decodeImageSharePayload(payload: unknown): {
  workspaceFile: ImportedWorkspaceFile;
  exportSettings: ExportSettings;
} {
  if (!Array.isArray(payload) || payload[0] !== 1) {
    throw new Error("That shared image link is invalid.");
  }

  return {
    workspaceFile: decodeSharedProjectPayload(payload[1]),
    exportSettings: decodeShareExportSettings(payload[2]),
  };
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);

    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(base64Url: string): Uint8Array {
  const normalizedBase64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = normalizedBase64.length % 4;
  const paddedBase64 =
    paddingLength === 0
      ? normalizedBase64
      : `${normalizedBase64}${"=".repeat(4 - paddingLength)}`;
  const binary = atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function compressTextPayload(value: string): Promise<string> {
  const rawBytes = new TextEncoder().encode(value);

  if (typeof CompressionStream === "function") {
    const compressedBuffer = await new Response(
      new Blob([rawBytes]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer();

    return `gz.${encodeBase64Url(new Uint8Array(compressedBuffer))}`;
  }

  return `b64.${encodeBase64Url(rawBytes)}`;
}

async function decompressTextPayload(payload: string): Promise<string> {
  const separatorIndex = payload.indexOf(".");
  const format = separatorIndex === -1 ? "b64" : payload.slice(0, separatorIndex);
  const encodedPayload = separatorIndex === -1 ? payload : payload.slice(separatorIndex + 1);
  const bytes = decodeBase64Url(encodedPayload);

  if (format === "gz") {
    if (typeof DecompressionStream !== "function") {
      throw new Error("This browser cannot open compressed share links.");
    }

    const compressedBytes = new Uint8Array(bytes.byteLength);
    compressedBytes.set(bytes);
    const decompressedBuffer = await new Response(
      new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();

    return new TextDecoder().decode(decompressedBuffer);
  }

  if (format === "b64") {
    return new TextDecoder().decode(bytes);
  }

  throw new Error("That share link format is not supported.");
}

function buildShareUrl(kind: ShareHashPayload["kind"], payload: string): string {
  const shareHashKey = kind === "image" ? SHARE_IMAGE_HASH_KEY : SHARE_PROJECT_HASH_KEY;
  const shareBaseUrl = buildCanonicalUrl(window.location.pathname, window.location.search);

  return `${shareBaseUrl}#${shareHashKey}=${payload}`;
}

function readSharePayloadFromHash(hash: string): ShareHashPayload | null {
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const imagePayload = hashParams.get(SHARE_IMAGE_HASH_KEY)?.trim() ?? "";

  if (imagePayload) {
    return {
      kind: "image",
      payload: imagePayload,
    };
  }

  const projectPayload =
    hashParams.get(SHARE_PROJECT_HASH_KEY)?.trim() ??
    hashParams.get(LEGACY_SHARE_PROJECT_HASH_KEY)?.trim() ??
    "";

  return projectPayload
    ? {
        kind: "project",
        payload: projectPayload,
      }
    : null;
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const fallbackTextArea = document.createElement("textarea");
  fallbackTextArea.value = value;
  fallbackTextArea.setAttribute("readonly", "true");
  fallbackTextArea.style.position = "fixed";
  fallbackTextArea.style.opacity = "0";
  fallbackTextArea.style.pointerEvents = "none";
  document.body.appendChild(fallbackTextArea);
  fallbackTextArea.select();
  fallbackTextArea.setSelectionRange(0, fallbackTextArea.value.length);

  const didCopy = document.execCommand("copy");
  fallbackTextArea.remove();

  if (!didCopy) {
    throw new Error("Unable to copy that link in this browser.");
  }
}

function upsertMetaTag(
  attributeName: "name" | "property",
  attributeValue: string,
  content: string,
): void {
  const selector = `meta[${attributeName}="${attributeValue}"]`;
  let metaTag = document.head.querySelector<HTMLMetaElement>(selector);

  if (!metaTag) {
    metaTag = document.createElement("meta");
    metaTag.setAttribute(attributeName, attributeValue);
    document.head.append(metaTag);
  }

  metaTag.content = content;
}

function upsertCanonicalLink(href: string): void {
  let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!canonicalLink) {
    canonicalLink = document.createElement("link");
    canonicalLink.rel = "canonical";
    document.head.append(canonicalLink);
  }

  canonicalLink.href = href;
}

function buildCanonicalUrl(pathname: string, search = ""): string {
  return new URL(`${pathname}${search}`, `${PRIMARY_SITE_ORIGIN}/`).toString();
}

function setDocumentSeoMetadata({
  description,
  title,
}: {
  description: string;
  title: string;
}): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const canonicalUrl = buildCanonicalUrl(window.location.pathname, window.location.search);

  document.title = title;
  upsertMetaTag("name", "description", description);
  upsertMetaTag("property", "og:title", title);
  upsertMetaTag("property", "og:description", description);
  upsertMetaTag("property", "og:type", "website");
  upsertMetaTag("property", "og:url", canonicalUrl);
  upsertMetaTag("name", "twitter:title", title);
  upsertMetaTag("name", "twitter:description", description);
  upsertCanonicalLink(canonicalUrl);
}

function getBoundsCorners(bounds: Box3): Vector3[] {
  const { min, max } = bounds;

  return [
    new Vector3(min.x, min.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(max.x, max.y, max.z),
  ];
}

function calculateCameraFitDistance(bounds: Box3, center: Vector3, camera: PerspectiveCamera): number {
  const inverseCameraRotation = camera.quaternion.clone().invert();
  const zoom = Math.max(camera.zoom, 0.0001);
  const verticalFov = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) / zoom);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const horizontalTangent = Math.max(Math.tan(horizontalFov / 2), 0.0001);
  const verticalTangent = Math.max(Math.tan(verticalFov / 2), 0.0001);
  let requiredDistance = 0;

  getBoundsCorners(bounds).forEach((corner) => {
    const localCorner = corner.clone().sub(center).applyQuaternion(inverseCameraRotation);

    requiredDistance = Math.max(
      requiredDistance,
      localCorner.z + Math.abs(localCorner.x) / horizontalTangent,
      localCorner.z + Math.abs(localCorner.y) / verticalTangent,
    );
  });

  return requiredDistance;
}

async function serializeWorkspaceSkin(skin: LoadedSkin | null): Promise<LoadedSkin | null> {
  if (!skin) {
    return null;
  }

  if (skin.origin !== "upload" || skin.source.startsWith("data:")) {
    return { ...skin };
  }

  const response = await fetch(skin.source);

  if (!response.ok) {
    throw new Error("Unable to package the uploaded PNG skin for saving.");
  }

  const dataUrl = await blobToDataUrl(await response.blob());

  return {
    ...skin,
    source: dataUrl,
  };
}

function createWorkspaceDocument(
  rawName: string,
  overrides: Partial<Omit<WorkspaceDocument, "id" | "poseFileName">> = {},
): WorkspaceDocument {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    poseFileName: normalizePoseFileName(rawName),
    fileHandle: overrides.fileHandle ?? null,
    heldItems: cloneHeldItems(overrides.heldItems),
    pose: clonePose(overrides.pose ?? NEUTRAL_POSE),
    selectedPoseSelection: overrides.selectedPoseSelection ?? DEFAULT_POSE_SELECTION,
    selectedPreset: overrides.selectedPreset ?? "neutral",
    showOuterLayer: overrides.showOuterLayer ?? true,
    showOuterLayerIn3d: overrides.showOuterLayerIn3d ?? false,
    showHeldItems: overrides.showHeldItems ?? true,
    skin: overrides.skin ?? null,
    avatarType: overrides.avatarType ?? "default",
    resolvedModel: overrides.resolvedModel ?? null,
    uploadModel: overrides.uploadModel ?? "auto-detect",
  };
}

export default function App() {
  const initialDocument = createWorkspaceDocument("untitled-pose-01.mcpose", {
    pose: clonePose(POSE_PRESETS.showcase),
    selectedPreset: "showcase",
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startupSkinInputRef = useRef<HTMLInputElement | null>(null);
  const poseFileInputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportGizmoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const rotationGizmoRef = useRef<TransformControls | null>(null);
  const rotationGizmoBindingRef = useRef<RotationGizmoBinding | null>(null);
  const rotationGizmoDraftPoseRef = useRef<PoseState | null>(null);
  const isRotationGizmoDraggingRef = useRef(false);
  const suppressViewportClickRef = useRef(false);
  const selectedOutlineRef = useRef<Group | null>(null);
  const outerLayerVoxelMeshesRef = useRef<OuterLayerVoxelMeshes>({});
  const heldItemMeshesRef = useRef<HeldItemMeshes>({});
  const heldItemBuildRequestIdRef = useRef(0);
  const sceneDebugCubeRef = useRef<Mesh | null>(null);
  const sceneDebugVoxelCloneRef = useRef<Mesh | null>(null);
  const documentsRef = useRef<WorkspaceDocument[]>([initialDocument]);
  const activeDocumentIdRef = useRef(initialDocument.id);
  const nextPoseIndexRef = useRef(2);
  const exportPreviewRequestIdRef = useRef(0);
  const poseRef = useRef(initialDocument.pose);
  const avatarTypeRef = useRef(initialDocument.avatarType);
  const selectedPoseSelectionRef = useRef(initialDocument.selectedPoseSelection);

  const [viewerReady, setViewerReady] = useState(false);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([initialDocument]);
  const [activeDocumentId, setActiveDocumentId] = useState(initialDocument.id);
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Booting editor viewport...");
  const [error, setError] = useState<string | null>(null);
  const [startupFileName, setStartupFileName] = useState("untitled-pose-01.mcpose");
  const [startupUsername, setStartupUsername] = useState(DEFAULT_USERNAME);
  const [startupAvatarType, setStartupAvatarType] = useState<AvatarType>("default");
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [helpContactModalKind, setHelpContactModalKind] = useState<HelpContactModalKind | null>(null);
  const [heldItemModalArmId, setHeldItemModalArmId] = useState<HeldItemArmId | null>(null);
  const [isStartupModalOpen, setIsStartupModalOpen] = useState(true);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportPreviewLoading, setIsExportPreviewLoading] = useState(false);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [exportPreviewError, setExportPreviewError] = useState<string | null>(null);
  const [isGeneratingProjectShareLink, setIsGeneratingProjectShareLink] = useState(false);
  const [isGeneratingImageShareLink, setIsGeneratingImageShareLink] = useState(false);
  const [projectShareLink, setProjectShareLink] = useState<string | null>(null);
  const [imageShareLink, setImageShareLink] = useState<string | null>(null);
  const [projectShareError, setProjectShareError] = useState<string | null>(null);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const [shareLandingMode, setShareLandingMode] = useState<"editor" | "image">("editor");
  const [sharedImageSettings, setSharedImageSettings] = useState<ExportSettings | null>(null);
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);
  const [sharedImageViewError, setSharedImageViewError] = useState<string | null>(null);
  const [isSharedImageRendering, setIsSharedImageRendering] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(
    buildDefaultExportSettings(null),
  );
  const [pendingNewFileUpload, setPendingNewFileUpload] = useState<PendingNewFileUpload | null>(null);
  const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState(false);
  const [viewportLightingMode, setViewportLightingMode] =
    useState<ViewportLightingMode>("unlit");
  const viewportLightingModeRef = useRef<ViewportLightingMode>("unlit");

  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0]!;
  const {
    poseFileName,
    pose,
    heldItems,
    selectedPoseSelection,
    selectedPreset,
    showOuterLayer,
    showOuterLayerIn3d,
    showHeldItems,
    skin,
    avatarType,
    resolvedModel,
    uploadModel,
  } = activeDocument;
  const heldItemGeometryKey = buildHeldItemGeometryKey(heldItems);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    avatarTypeRef.current = avatarType;
  }, [avatarType]);

  useEffect(() => {
    selectedPoseSelectionRef.current = selectedPoseSelection;
  }, [selectedPoseSelection]);

  useEffect(() => {
    activeDocumentIdRef.current = activeDocumentId;
  }, [activeDocumentId]);

  useEffect(() => {
    viewportLightingModeRef.current = viewportLightingMode;
  }, [viewportLightingMode]);
  useEffect(() => {
    closeHeldItemModal();
  }, [activeDocumentId]);

  useEffect(() => {
    const activeSkinLabel = skin?.label?.trim() ?? "";

    if (shareLandingMode === "image") {
      const sharedDimensions = sharedImageSettings
        ? `${sharedImageSettings.width}x${sharedImageSettings.height}`
        : null;
      const sharedTitle = activeSkinLabel
        ? `${activeSkinLabel} shared render | MC Poser`
        : "Shared Minecraft skin render | MC Poser";
      const sharedSubject = activeSkinLabel
        ? `${activeSkinLabel} Minecraft skin render`
        : "Minecraft skin render";

      setDocumentSeoMetadata({
        title: sharedTitle,
        description: sharedDimensions
          ? `View a shared ${sharedDimensions} ${sharedSubject} created with MC Poser.`
          : `View a shared ${sharedSubject} created with MC Poser.`,
      });
      return;
    }

    if (activeSkinLabel) {
      setDocumentSeoMetadata({
        title: `${activeSkinLabel} pose editor | MC Poser`,
        description:
          `Pose the ${activeSkinLabel} Minecraft skin in 3D, adjust layers and framing, ` +
          "export polished renders, and share the scene with MC Poser.",
      });
      return;
    }

    if (hasEnteredWorkspace) {
      setDocumentSeoMetadata({
        title: `${poseFileName.replace(/\.mcpose$/i, "")} | MC Poser`,
        description:
          "Create Minecraft skin poses in 3D, export image renders, and share scenes online with MC Poser.",
      });
      return;
    }

    setDocumentSeoMetadata({
      title: DEFAULT_SEO_TITLE,
      description: DEFAULT_SEO_DESCRIPTION,
    });
  }, [hasEnteredWorkspace, poseFileName, shareLandingMode, sharedImageSettings, skin]);

  useEffect(() => {
    if (!isExportModalOpen) {
      return;
    }

    if (!viewerReady || !skin) {
      setExportPreviewUrl(null);
      setExportPreviewError("Load a skin before opening the export modal.");
      setIsExportPreviewLoading(false);
      return;
    }

    let isCancelled = false;
    const requestId = ++exportPreviewRequestIdRef.current;

    setIsExportPreviewLoading(true);
    setExportPreviewError(null);

    void (async () => {
      try {
        const previewBlob = await renderExportBlob(buildExportPreviewSettings(exportSettings));
        const nextPreviewUrl = await blobToDataUrl(previewBlob);

        if (isCancelled || exportPreviewRequestIdRef.current !== requestId) {
          return;
        }

        setExportPreviewUrl(nextPreviewUrl);
      } catch (previewError) {
        if (isCancelled || exportPreviewRequestIdRef.current !== requestId) {
          return;
        }

        setExportPreviewError(
          previewError instanceof Error
            ? previewError.message
            : "Unable to render the export preview.",
        );
      } finally {
        if (!isCancelled && exportPreviewRequestIdRef.current === requestId) {
          setIsExportPreviewLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [avatarType, exportSettings, isExportModalOpen, skin, viewerReady]);

  function releaseDocumentUploadSkin(document: WorkspaceDocument): void {
    const currentSkin = document.skin;

    if (canRevokeSkinSource(currentSkin)) {
      URL.revokeObjectURL(currentSkin.source);
    }
  }

  function releaseDocumentHeldItems(document: WorkspaceDocument): void {
    HELD_ITEM_ARM_IDS.forEach((armId) => {
      const heldItem = document.heldItems[armId];

      if (canRevokeHeldItemSource(heldItem)) {
        URL.revokeObjectURL(heldItem.source);
      }
    });
  }

  function updateDocument(
    documentId: string,
    updater: (currentDocument: WorkspaceDocument) => WorkspaceDocument,
  ): void {
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === documentId ? updater(document) : document,
      ),
    );
  }

  function switchToDocument(documentId: string): void {
    const nextDocument = documents.find((document) => document.id === documentId);

    if (!nextDocument) {
      return;
    }

    setActiveDocumentId(documentId);

    if (nextDocument.skin?.origin === "username") {
      setUsername(nextDocument.skin.label);
    }

    setStatus(`Switched to ${nextDocument.poseFileName}.`);
  }

  function appendDocument(
    rawName: string,
    overrides: Partial<Omit<WorkspaceDocument, "id" | "poseFileName">> = {},
  ): WorkspaceDocument {
    const nextDocument = createWorkspaceDocument(rawName, overrides);

    setDocuments((currentDocuments) => [...currentDocuments, nextDocument]);
    setActiveDocumentId(nextDocument.id);
    setError(null);

    return nextDocument;
  }

  function openDocumentFromStartup(
    rawName: string,
    overrides: Partial<Omit<WorkspaceDocument, "id" | "poseFileName">> = {},
  ): WorkspaceDocument {
    const nextDocument = createWorkspaceDocument(rawName, overrides);

    if (!hasEnteredWorkspace && documents.length === 1) {
      const placeholderDocumentId = activeDocumentId;

      setDocuments((currentDocuments) =>
        currentDocuments.map((document) =>
          document.id === placeholderDocumentId
            ? {
                ...nextDocument,
                id: placeholderDocumentId,
              }
            : document,
        ),
      );

      setActiveDocumentId(placeholderDocumentId);
      setError(null);

      return {
        ...nextDocument,
        id: placeholderDocumentId,
      };
    }

    return appendDocument(rawName, overrides);
  }

  function centerViewerOnCharacter(viewer: SkinViewer): void {
    viewer.camera.up.set(0, 1, 0);
    viewer.controls.target.set(0, 0, 0);
    viewer.controls.update();
  }

  function snapViewerCameraToGizmoView(
    viewer: SkinViewer,
    viewId: ViewportGizmoViewId,
  ): void {
    const { direction, up } = resolveViewportGizmoCameraView(viewId);
    const target = viewer.controls.target.clone();
    const currentDistance = Math.max(18, viewer.camera.position.distanceTo(target));
    const snappedPosition = target.clone().addScaledVector(direction, currentDistance);

    viewer.controls.minPolarAngle = 0.02;
    viewer.controls.maxPolarAngle = Math.PI - 0.02;
    viewer.camera.up.copy(up);
    viewer.camera.position.copy(snappedPosition);
    viewer.camera.lookAt(target);
    viewer.controls.target.copy(target);
    viewer.controls.update();
    viewer.render();
    publishDebugState(viewer);
  }

  function getViewportMaterialVariants(mesh: Mesh): ViewportMaterialVariants {
    const storedVariants = mesh.userData[
      VIEWPORT_MATERIAL_VARIANTS_KEY
    ] as ViewportMaterialVariants | undefined;

    if (storedVariants) {
      return storedVariants;
    }

    const nextVariants: ViewportMaterialVariants = {
      lit: mesh.material,
      unlit: null,
    };

    mesh.userData[VIEWPORT_MATERIAL_VARIANTS_KEY] = nextVariants;

    return nextVariants;
  }

  function clearViewportMaterialVariants(mesh: Mesh): void {
    delete mesh.userData[VIEWPORT_MATERIAL_VARIANTS_KEY];
  }

  function applyViewportLighting(
    viewer: SkinViewer,
    lightingMode: ViewportLightingMode,
  ): void {
    const lightingPreset = VIEWPORT_LIGHTING_PRESETS[lightingMode];

    viewer.globalLight.intensity = lightingPreset.globalLightIntensity;
    viewer.cameraLight.intensity = lightingPreset.cameraLightIntensity;

    viewer.playerObject.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }

      const materialVariants = getViewportMaterialVariants(object);

      if (
        object.material !== materialVariants.lit &&
        object.material !== materialVariants.unlit
      ) {
        disposeMaterialInstances(materialVariants.unlit);
        materialVariants.lit = object.material;
        materialVariants.unlit = null;
      }

      if (lightingMode === "unlit") {
        materialVariants.unlit ??= createUnlitMaterialVariant(materialVariants.lit);
        object.material = materialVariants.unlit;
        return;
      }

      object.material = materialVariants.lit;
    });
  }

  function disposeViewerViewportMaterialVariants(viewer: SkinViewer): void {
    viewer.playerObject.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }

      const materialVariants = object.userData[
        VIEWPORT_MATERIAL_VARIANTS_KEY
      ] as ViewportMaterialVariants | undefined;

      if (!materialVariants) {
        return;
      }

      if (object.material === materialVariants.unlit) {
        object.material = materialVariants.lit;
      }

      disposeMaterialInstances(materialVariants.unlit);
      clearViewportMaterialVariants(object);
    });
  }

  function disposeOwnedMeshMaterials(mesh: Mesh): void {
    const materialVariants = mesh.userData[
      VIEWPORT_MATERIAL_VARIANTS_KEY
    ] as ViewportMaterialVariants | undefined;

    disposeMaterialInstances(
      mesh.material,
      materialVariants?.lit ?? null,
      materialVariants?.unlit ?? null,
    );
    clearViewportMaterialVariants(mesh);
  }

  function disposeSelectedOutline(): void {
    const selectedOutline = selectedOutlineRef.current;

    if (!selectedOutline) {
      return;
    }

    selectedOutline.removeFromParent();
    selectedOutline.traverse((descendant) => {
      if (!(descendant instanceof LineSegments)) {
        return;
      }

      descendant.geometry.dispose();

      if (Array.isArray(descendant.material)) {
        descendant.material.forEach((material) => material.dispose());
      } else {
        descendant.material.dispose();
      }
    });

    selectedOutlineRef.current = null;
  }

  function resolveSelectedBoneId(selection: PoseSelection): PoseBoneId {
    if (selection.kind === "bone") {
      return selection.id;
    }

    if (selection.kind === "heldItem") {
      return selection.id;
    }

    return POSE_BONES.find((bone) => bone.fields.some((field) => field.key === selection.id))?.id ?? "head";
  }

  function resolveSelectedHeldItemArmId(selection: PoseSelection): HeldItemArmId | null {
    if (selection.kind === "heldItem") {
      return selection.id;
    }

    return selection.kind === "bone" && isHeldItemArmId(selection.id)
      ? selection.id
      : null;
  }

  function getViewerBonePickRoot(viewer: SkinViewer, boneId: PoseBoneId): Object3D {
    switch (boneId) {
      case "head":
        return viewer.playerObject.skin.head;
      case "torso":
        return viewer.playerObject.skin.body;
      case "leftArm":
        return viewer.playerObject.skin.leftArm;
      case "rightArm":
        return viewer.playerObject.skin.rightArm;
      case "leftLeg":
        return viewer.playerObject.skin.leftLeg;
      case "rightLeg":
        return viewer.playerObject.skin.rightLeg;
    }
  }

  function getViewerBoneOutlineObjects(
    viewer: SkinViewer,
    boneId: PoseBoneId,
  ): Object3D[] {
    const heldItemOutlineObject = isHeldItemArmId(boneId)
      ? showHeldItems
        ? heldItemMeshesRef.current[boneId]
        : null
      : null;

    if (avatarType === "advanced" && isAdvancedAvatarActive(viewer)) {
      const advancedOutlineObjects = getAdvancedAvatarOutlineObjects(viewer, boneId);

      if (advancedOutlineObjects && advancedOutlineObjects.length > 0) {
        return heldItemOutlineObject
          ? [...advancedOutlineObjects, heldItemOutlineObject]
          : advancedOutlineObjects;
      }
    }

    const targetPart = getViewerBonePickRoot(viewer, boneId) as Partial<{
      innerLayer: Object3D;
      outerLayer: Object3D;
    }>;

    if (showOuterLayer && targetPart.outerLayer) {
      return heldItemOutlineObject
        ? [targetPart.outerLayer, heldItemOutlineObject]
        : [targetPart.outerLayer];
    }

    if (targetPart.innerLayer) {
      return heldItemOutlineObject
        ? [targetPart.innerLayer, heldItemOutlineObject]
        : [targetPart.innerLayer];
    }

    const defaultTarget = getViewerBonePickRoot(viewer, boneId);

    return heldItemOutlineObject ? [defaultTarget, heldItemOutlineObject] : [defaultTarget];
  }

  function disposeHeldItemMeshes(): void {
    Object.values(heldItemMeshesRef.current).forEach((heldItemGroup) => {
      if (!heldItemGroup) {
        return;
      }

      heldItemGroup.removeFromParent();
      heldItemGroup.traverse((descendant) => {
        if (!(descendant instanceof Mesh)) {
          return;
        }

        descendant.geometry.dispose();
        disposeOwnedMeshMaterials(descendant);
      });
    });

    heldItemMeshesRef.current = {};
  }

  function resolveHeldItemAttachmentParent(
    viewer: SkinViewer,
    armId: HeldItemArmId,
  ): Object3D {
    if (avatarType === "advanced" && isAdvancedAvatarActive(viewer)) {
      return getAdvancedAvatarHandAnchor(viewer, armId) ?? viewer.playerObject.skin[armId];
    }

    return viewer.playerObject.skin[armId];
  }

  function applyHeldItemVisibility(isVisible: boolean): void {
    Object.values(heldItemMeshesRef.current).forEach((heldItemGroup) => {
      if (heldItemGroup) {
        heldItemGroup.visible = isVisible;
      }
    });
  }

  function applyHeldItemTransform(
    heldItemGroup: Group,
    armId: HeldItemArmId,
    modelType: ArmModel,
    adjustments: HeldItemAdjustments,
  ): void {
    const direction = armId === "leftArm" ? 1 : -1;
    const horizontalOffset = modelType === "slim" ? 0.55 : 0.75;
    const baseYRotation = armId === "leftArm" ? Math.PI : 0;
    const forwardPitch = Math.PI / 4;
    const normalizedAdjustments = cloneHeldItemAdjustments(adjustments);
    const radiansPerDegree = Math.PI / 180;

    heldItemGroup.position.set(
      direction * (horizontalOffset + normalizedAdjustments.offsetX),
      -6.45 + normalizedAdjustments.offsetY,
      5.35 + normalizedAdjustments.offsetZ,
    );
    heldItemGroup.rotation.set(
      forwardPitch + normalizedAdjustments.rotationX * radiansPerDegree,
      baseYRotation + direction * (Math.PI / 2) + normalizedAdjustments.rotationY * radiansPerDegree,
      direction * 0.22 + normalizedAdjustments.rotationZ * radiansPerDegree,
    );
    heldItemGroup.scale.setScalar(0.68 * Math.max(0.1, normalizedAdjustments.scale));
  }

  function syncHeldItemMeshTransforms(viewer: SkinViewer, nextHeldItems: HeldItemsState): boolean {
    const modelType = viewer.playerObject.skin.modelType as ArmModel;
    let hasChanges = false;

    HELD_ITEM_ARM_IDS.forEach((armId) => {
      const heldItemGroup = heldItemMeshesRef.current[armId];
      const heldItem = nextHeldItems[armId];

      if (!heldItemGroup || !heldItem) {
        return;
      }

      const attachmentParent = resolveHeldItemAttachmentParent(viewer, armId);

      if (heldItemGroup.parent !== attachmentParent) {
        attachmentParent.add(heldItemGroup);
      }

      heldItemGroup.visible = showHeldItems;
      applyHeldItemTransform(heldItemGroup, armId, modelType, heldItem.adjustments);
      hasChanges = true;
    });

    return hasChanges;
  }

  async function rebuildHeldItemMeshes(viewer: SkinViewer, nextHeldItems: HeldItemsState): Promise<void> {
    const requestId = heldItemBuildRequestIdRef.current;
    const nextHeldItemMeshes: HeldItemMeshes = {};
    const modelType = viewer.playerObject.skin.modelType as ArmModel;

    for (const armId of HELD_ITEM_ARM_IDS) {
      const heldItem = nextHeldItems[armId];

      if (!heldItem) {
        continue;
      }

      const voxelGeometry = await createHeldItemVoxelGeometry(
        heldItem.source,
        heldItem.adjustments.thickness,
      );

      if (heldItemBuildRequestIdRef.current !== requestId) {
        voxelGeometry?.dispose();
        return;
      }

      if (!voxelGeometry) {
        continue;
      }

      const heldItemMaterial = new MeshStandardMaterial({
        alphaTest: 1 / 255,
        flatShading: true,
        metalness: 0,
        roughness: 1,
        transparent: true,
        vertexColors: true,
      });
      const heldItemMesh = new Mesh(voxelGeometry, heldItemMaterial);
      const heldItemGroup = new Group();

      heldItemMesh.name = `${armId}-held-item-mesh`;
      heldItemMesh.frustumCulled = false;
      heldItemGroup.name = `${armId}-held-item-group`;
      heldItemGroup.add(heldItemMesh);
      heldItemGroup.visible = showHeldItems;
      applyHeldItemTransform(heldItemGroup, armId, modelType, heldItem.adjustments);
      resolveHeldItemAttachmentParent(viewer, armId).add(heldItemGroup);
      nextHeldItemMeshes[armId] = heldItemGroup;
    }

    if (heldItemBuildRequestIdRef.current !== requestId) {
      Object.values(nextHeldItemMeshes).forEach((heldItemGroup) => {
        heldItemGroup?.removeFromParent();
      });
      return;
    }

    heldItemMeshesRef.current = nextHeldItemMeshes;
  }

  function getViewerOuterLayerMeshes(viewer: SkinViewer): {
    head: Mesh | null;
    torso: Mesh | null;
    leftArm: Mesh | null;
    rightArm: Mesh | null;
    leftLeg: Mesh | null;
    rightLeg: Mesh | null;
  } {
    const outerLayerMeshes = {
      head: viewer.playerObject.skin.head.outerLayer,
      torso: viewer.playerObject.skin.body.outerLayer,
      leftArm: viewer.playerObject.skin.leftArm.outerLayer,
      rightArm: viewer.playerObject.skin.rightArm.outerLayer,
      leftLeg: viewer.playerObject.skin.leftLeg.outerLayer,
      rightLeg: viewer.playerObject.skin.rightLeg.outerLayer,
    };

    return {
      head: outerLayerMeshes.head instanceof Mesh ? outerLayerMeshes.head : null,
      torso: outerLayerMeshes.torso instanceof Mesh ? outerLayerMeshes.torso : null,
      leftArm: outerLayerMeshes.leftArm instanceof Mesh ? outerLayerMeshes.leftArm : null,
      rightArm: outerLayerMeshes.rightArm instanceof Mesh ? outerLayerMeshes.rightArm : null,
      leftLeg: outerLayerMeshes.leftLeg instanceof Mesh ? outerLayerMeshes.leftLeg : null,
      rightLeg: outerLayerMeshes.rightLeg instanceof Mesh ? outerLayerMeshes.rightLeg : null,
    };
  }

  function disposeOuterLayerVoxelMeshes(): void {
    Object.values(outerLayerVoxelMeshesRef.current).forEach((voxelMesh) => {
      if (!voxelMesh) {
        return;
      }

      voxelMesh.removeFromParent();
      voxelMesh.geometry.dispose();
      disposeOwnedMeshMaterials(voxelMesh);
    });

    outerLayerVoxelMeshesRef.current = {};
  }

  function rebuildOuterLayerVoxelMeshes(viewer: SkinViewer): void {
    disposeOuterLayerVoxelMeshes();

    if (avatarType === "advanced") {
      return;
    }

    const textureMap = viewer.playerObject.skin.map;
    const pixelSource = getTexturePixelSource(textureMap);

    if (!textureMap || !pixelSource) {
      return;
    }

    const outerLayerMeshes = getViewerOuterLayerMeshes(viewer);
    const modelType = viewer.playerObject.skin.modelType as ArmModel;

    for (const [boneId, outerLayerMesh] of Object.entries(outerLayerMeshes) as Array<
      [PoseBoneId, Mesh | null]
    >) {
      const voxelParent = outerLayerMesh?.parent;

      if (!outerLayerMesh || !voxelParent) {
        continue;
      }

      const voxelGeometry = createOuterLayerVoxelGeometry(
        boneId,
        modelType,
        pixelSource,
      );

      if (!voxelGeometry) {
        continue;
      }

      const voxelMaterial = new MeshStandardMaterial({
        alphaTest: 1 / 255,
        flatShading: true,
        metalness: 0,
        roughness: 1,
        transparent: true,
        vertexColors: true,
      });

      const voxelMesh = new Mesh(voxelGeometry, voxelMaterial);

      voxelMesh.userData.renderedFrames = 0;
      voxelMesh.onBeforeRender = () => {
        voxelMesh.userData.renderedFrames =
          ((voxelMesh.userData.renderedFrames as number | undefined) ?? 0) + 1;
      };

      voxelMesh.name = `${boneId}-outer-voxel`;
      voxelMesh.frustumCulled = false;
      voxelMesh.position.copy(outerLayerMesh.position);
      voxelMesh.quaternion.copy(outerLayerMesh.quaternion);
      voxelMesh.renderOrder = outerLayerMesh.renderOrder + 1;
      voxelMesh.visible = false;

      voxelParent.add(voxelMesh);
      outerLayerVoxelMeshesRef.current[boneId] = voxelMesh;
    }
  }

  function applyOuterLayerPresentation(
    viewer: SkinViewer,
    isVisible: boolean,
    is3dOuterLayerEnabled: boolean,
  ): void {
    if (avatarType === "advanced") {
      setAdvancedAvatarOuterLayerVisibility(viewer, isVisible, is3dOuterLayerEnabled);

      Object.values(outerLayerVoxelMeshesRef.current).forEach((voxelMesh) => {
        if (voxelMesh) {
          voxelMesh.visible = false;
        }
      });

      return;
    }

    if (
      is3dOuterLayerEnabled &&
      Object.keys(outerLayerVoxelMeshesRef.current).length === 0
    ) {
      rebuildOuterLayerVoxelMeshes(viewer);
    }

    setViewerOuterLayerVisible(viewer, isVisible && !is3dOuterLayerEnabled);

    Object.values(outerLayerVoxelMeshesRef.current).forEach((voxelMesh) => {
      if (voxelMesh) {
        voxelMesh.visible = isVisible && is3dOuterLayerEnabled;
      }
    });
  }

  async function buildWorkspaceFilePayload(
    documentToSerialize: WorkspaceDocument,
    overridePoseFileName = documentToSerialize.poseFileName,
  ): Promise<SerializableWorkspaceFile> {
    return {
      version: 2,
      poseFileName: overridePoseFileName,
      heldItems: await serializeWorkspaceHeldItems(documentToSerialize.heldItems),
      pose: clonePose(documentToSerialize.pose),
      skin: await serializeWorkspaceSkin(documentToSerialize.skin),
      selectedPoseSelection: documentToSerialize.selectedPoseSelection,
      selectedPreset: documentToSerialize.selectedPreset,
      showOuterLayer: documentToSerialize.showOuterLayer,
      showOuterLayerIn3d: documentToSerialize.showOuterLayerIn3d,
      showHeldItems: documentToSerialize.showHeldItems,
      resolvedModel: documentToSerialize.resolvedModel,
      avatarType: documentToSerialize.avatarType,
      uploadModel: documentToSerialize.uploadModel,
    };
  }

  function downloadWorkspaceFile(fileName: string, contents: string): void {
    const fileBlob = new Blob([contents], {
      type: "application/json;charset=utf-8",
    });
    const fileUrl = URL.createObjectURL(fileBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = fileUrl;
    downloadLink.download = fileName;
    downloadLink.click();

    URL.revokeObjectURL(fileUrl);
  }

  function downloadExportFile(fileName: string, fileBlob: Blob): void {
    const fileUrl = URL.createObjectURL(fileBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = fileUrl;
    downloadLink.download = fileName;
    downloadLink.click();

    URL.revokeObjectURL(fileUrl);
  }

  async function writeWorkspaceFileToHandle(
    fileHandle: WorkspaceFileHandle,
    contents: string,
  ): Promise<void> {
    const writable = await fileHandle.createWritable();

    await writable.write(contents);
    await writable.close();
  }

  async function pickWorkspaceSaveFile(
    suggestedName: string,
  ): Promise<WorkspaceFileHandle | null> {
    const showSaveFilePicker = getSaveFilePicker();

    if (!showSaveFilePicker) {
      return null;
    }

    try {
      return await showSaveFilePicker({
        suggestedName,
        excludeAcceptAllOption: false,
        types: [
          {
            description: "MC Poser workspace",
            accept: {
              "application/json": [".mcpose"],
            },
          },
        ],
      });
    } catch (pickerError) {
      if (
        pickerError instanceof DOMException &&
        pickerError.name === "AbortError"
      ) {
        return null;
      }

      throw pickerError;
    }
  }

  function createSelectedOutline(targetObjects: Object3D[]): Group | null {
    const selectedOutline = new Group();
    let hasOutlineMesh = false;

    targetObjects.forEach((targetObject) => {
      targetObject.updateWorldMatrix(true, true);

      targetObject.traverse((descendant) => {
        if (!(descendant instanceof Mesh)) {
          return;
        }

        const outlineSegment = new LineSegments(
          new EdgesGeometry(descendant.geometry),
          new LineBasicMaterial({
            color: 0xffb366,
            depthTest: false,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
          }),
        );
        const worldPosition = new Vector3();
        const worldQuaternion = new Quaternion();
        const worldScale = new Vector3();

        descendant.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
        outlineSegment.position.copy(worldPosition);
        outlineSegment.quaternion.copy(worldQuaternion);
        outlineSegment.scale.copy(worldScale).multiplyScalar(1.035);
        outlineSegment.renderOrder = 12;
        selectedOutline.add(outlineSegment);
        hasOutlineMesh = true;
      });
    });

    return hasOutlineMesh ? selectedOutline : null;
  }

  function clampPoseValue(poseKey: keyof PoseState, value: number): number {
    const fieldConfig = POSE_FIELD_LIMITS.get(poseKey);
    const roundedValue = Math.round(value);

    if (!fieldConfig) {
      return roundedValue;
    }

    return Math.min(fieldConfig.max, Math.max(fieldConfig.min, roundedValue));
  }

  function resolvePrimaryRotationObject(viewer: SkinViewer, boneId: PoseBoneId): Object3D {
    switch (boneId) {
      case "head":
        return viewer.playerObject.skin.head;
      case "torso":
        return getViewerTorsoJointRoot(viewer);
      case "leftArm":
        return viewer.playerObject.skin.leftArm;
      case "rightArm":
        return viewer.playerObject.skin.rightArm;
      case "leftLeg":
        return viewer.playerObject.skin.leftLeg;
      case "rightLeg":
        return viewer.playerObject.skin.rightLeg;
    }
  }

  function createRotationGizmoBinding(
    viewer: SkinViewer,
    selection: PoseSelection,
  ): RotationGizmoBinding | null {
    if (selection.kind === "joint") {
      const advancedJointObject = getAdvancedAvatarJointObject(viewer, selection.id);

      if (advancedJointObject) {
        switch (selection.id) {
          case "spineBend":
            return {
              object: advancedJointObject,
              showX: true,
              showY: false,
              showZ: false,
              updatePoseFromObject: (nextPose, object) => ({
                ...nextPose,
                spineBend: clampPoseValue("spineBend", -object.rotation.x * (180 / Math.PI)),
              }),
            };
          case "leftElbowPitch":
          case "rightElbowPitch":
            return {
              object: advancedJointObject,
              showX: true,
              showY: false,
              showZ: false,
              updatePoseFromObject: (nextPose, object) => ({
                ...nextPose,
                [selection.id]: clampPoseValue(selection.id, -object.rotation.x * (180 / Math.PI)),
              }),
            };
          case "leftKneePitch":
          case "rightKneePitch":
            return {
              object: advancedJointObject,
              showX: true,
              showY: false,
              showZ: false,
              updatePoseFromObject: (nextPose, object) => ({
                ...nextPose,
                [selection.id]: clampPoseValue(selection.id, object.rotation.x * (180 / Math.PI)),
              }),
            };
        }
      }

      const primaryObject = resolvePrimaryRotationObject(viewer, resolveSelectedBoneId(selection));

      switch (selection.id) {
        case "headPitch":
        case "leftArmPitch":
        case "rightArmPitch":
        case "leftLegPitch":
        case "rightLegPitch":
        case "bodyPitch":
          return {
            object: primaryObject,
            showX: true,
            showY: false,
            showZ: false,
            updatePoseFromObject: (nextPose, object) => ({
              ...nextPose,
              [selection.id]: clampPoseValue(selection.id, object.rotation.x * (180 / Math.PI)),
            }),
          };
        case "headYaw":
        case "leftArmYaw":
        case "rightArmYaw":
        case "leftLegYaw":
        case "rightLegYaw":
        case "bodyYaw":
          return {
            object: primaryObject,
            showX: false,
            showY: true,
            showZ: false,
            updatePoseFromObject: (nextPose, object) => ({
              ...nextPose,
              [selection.id]: clampPoseValue(selection.id, object.rotation.y * (180 / Math.PI)),
            }),
          };
        case "headRoll":
        case "leftArmRoll":
        case "rightArmRoll":
        case "leftLegRoll":
        case "rightLegRoll":
        case "bodyRoll":
          return {
            object: primaryObject,
            showX: false,
            showY: false,
            showZ: true,
            updatePoseFromObject: (nextPose, object) => ({
              ...nextPose,
              [selection.id]: clampPoseValue(selection.id, object.rotation.z * (180 / Math.PI)),
            }),
          };
      }

      return null;
    }

    const selectedBoneId = resolveSelectedBoneId(selection);

    switch (selectedBoneId) {
      case "head":
        return {
          object: viewer.playerObject.skin.head,
          showX: true,
          showY: true,
          showZ: true,
          updatePoseFromObject: (nextPose, object) => ({
            ...nextPose,
            headPitch: clampPoseValue("headPitch", object.rotation.x * (180 / Math.PI)),
            headYaw: clampPoseValue("headYaw", object.rotation.y * (180 / Math.PI)),
            headRoll: clampPoseValue("headRoll", object.rotation.z * (180 / Math.PI)),
          }),
        };
      case "torso":
        return {
          object: getViewerTorsoJointRoot(viewer),
          showX: true,
          showY: true,
          showZ: false,
          updatePoseFromObject: (nextPose, object) => ({
            ...nextPose,
            bodyPitch: clampPoseValue("bodyPitch", object.rotation.x * (180 / Math.PI)),
            bodyYaw: clampPoseValue("bodyYaw", object.rotation.y * (180 / Math.PI)),
          }),
        };
      case "leftArm":
      case "rightArm":
      case "leftLeg":
      case "rightLeg": {
        const object = resolvePrimaryRotationObject(viewer, selectedBoneId);
        const axisPrefix = selectedBoneId;

        return {
          object,
          showX: true,
          showY: true,
          showZ: true,
          updatePoseFromObject: (nextPose, targetObject) => ({
            ...nextPose,
            [`${axisPrefix}Pitch`]: clampPoseValue(
              `${axisPrefix}Pitch` as keyof PoseState,
              targetObject.rotation.x * (180 / Math.PI),
            ),
            [`${axisPrefix}Yaw`]: clampPoseValue(
              `${axisPrefix}Yaw` as keyof PoseState,
              targetObject.rotation.y * (180 / Math.PI),
            ),
            [`${axisPrefix}Roll`]: clampPoseValue(
              `${axisPrefix}Roll` as keyof PoseState,
              targetObject.rotation.z * (180 / Math.PI),
            ),
          }),
        };
      }
    }
  }

  function syncRotationGizmo(): void {
    const viewer = viewerRef.current;
    const rotationGizmo = rotationGizmoRef.current;

    if (!viewer || !rotationGizmo) {
      rotationGizmoBindingRef.current = null;
      return;
    }

    if (!skin || isLoading) {
      rotationGizmo.detach();
      rotationGizmo.visible = false;
      rotationGizmoBindingRef.current = null;
      return;
    }

    if (isRotationGizmoDraggingRef.current) {
      return;
    }

    const nextBinding = createRotationGizmoBinding(viewer, selectedPoseSelection);

    if (!nextBinding) {
      rotationGizmo.detach();
      rotationGizmo.visible = false;
      rotationGizmoBindingRef.current = null;
      return;
    }

    rotationGizmo.attach(nextBinding.object);
    rotationGizmo.showX = nextBinding.showX;
    rotationGizmo.showY = nextBinding.showY;
    rotationGizmo.showZ = nextBinding.showZ;
    rotationGizmo.visible = true;
    rotationGizmoBindingRef.current = nextBinding;
    viewer.render();
    publishDebugState(viewer);
  }

  function syncSelectedOutline(): void {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    disposeSelectedOutline();

    if (!skin) {
      return;
    }

    const selectedHeldItemArmId = resolveSelectedHeldItemArmId(selectedPoseSelection);
    const outlineTargets =
      selectedPoseSelection.kind === "heldItem" && selectedHeldItemArmId
        ? showHeldItems && heldItemMeshesRef.current[selectedHeldItemArmId]
          ? [heldItemMeshesRef.current[selectedHeldItemArmId]!]
          : getViewerBoneOutlineObjects(viewer, selectedHeldItemArmId)
        : getViewerBoneOutlineObjects(viewer, resolveSelectedBoneId(selectedPoseSelection));
    const selectedOutline = createSelectedOutline(outlineTargets);

    if (!selectedOutline) {
      return;
    }

    viewer.scene.add(selectedOutline);
    selectedOutlineRef.current = selectedOutline;
  }

  function updateSelectedOutline(): void {
    syncSelectedOutline();
  }

  function publishDebugState(viewer: SkinViewer | null): void {
    const debugWindow = window as DebugWindow;

    debugWindow.__MC_POSER_DEBUG__ = {
      activeDocumentId,
      renderInfo: viewer
        ? {
            calls: viewer.renderer.info.render.calls,
            lines: viewer.renderer.info.render.lines,
            triangles: viewer.renderer.info.render.triangles,
          }
        : null,
      showOuterLayer,
      showOuterLayerIn3d,
      showHeldItems,
      voxelMeshes: Object.fromEntries(
        (Object.entries(outerLayerVoxelMeshesRef.current) as Array<
          [PoseBoneId, Mesh | undefined]
        >).flatMap(([boneId, voxelMesh]) => {
          if (!voxelMesh) {
            return [];
          }

          return [
            [
              boneId,
              {
                attachedToScene: viewer
                  ? viewer.scene.getObjectById(voxelMesh.id) !== undefined
                  : false,
                indexCount: voxelMesh.geometry.getIndex()?.count ?? 0,
                materialColor:
                  !Array.isArray(voxelMesh.material) && "color" in voxelMesh.material
                    ? (voxelMesh.material as MeshBasicMaterial).color.getHexString()
                    : null,
                materialDepthTest:
                  !Array.isArray(voxelMesh.material) && "depthTest" in voxelMesh.material
                    ? voxelMesh.material.depthTest
                    : null,
                materialDepthWrite:
                  !Array.isArray(voxelMesh.material) && "depthWrite" in voxelMesh.material
                    ? voxelMesh.material.depthWrite
                    : null,
                materialOpacity:
                  !Array.isArray(voxelMesh.material) && "opacity" in voxelMesh.material
                    ? voxelMesh.material.opacity
                    : null,
                materialTransparent:
                  !Array.isArray(voxelMesh.material) && "transparent" in voxelMesh.material
                    ? voxelMesh.material.transparent
                    : null,
                materialType: Array.isArray(voxelMesh.material)
                  ? (voxelMesh.material[0]?.type ?? "unknown")
                  : voxelMesh.material.type,
                materialVertexColors:
                  !Array.isArray(voxelMesh.material) && "vertexColors" in voxelMesh.material
                    ? voxelMesh.material.vertexColors
                    : null,
                parentName: voxelMesh.parent?.name ?? null,
                parentType: voxelMesh.parent?.type ?? null,
                positionCount: voxelMesh.geometry.getAttribute("position")?.count ?? 0,
                renderedFrames: (voxelMesh.userData.renderedFrames as number | undefined) ?? 0,
                visible: voxelMesh.visible,
              },
            ],
          ];
        }),
      ),
    };
  }

  function attachDebugHelpers(): void {
    const debugWindow = window as DebugWindow;

    debugWindow.__MC_POSER_DEBUG_HELPERS__ = {
      addSceneDebugCube: () => {
        const viewer = viewerRef.current;

        if (!viewer || sceneDebugCubeRef.current) {
          return;
        }

        const debugCube = new Mesh(
          new BoxGeometry(6, 6, 6),
          new MeshBasicMaterial({
            color: 0x00ff66,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }),
        );

        debugCube.name = "scene-debug-cube";
        debugCube.position.set(14, 2, 0);
        debugCube.renderOrder = 100;
        viewer.scene.add(debugCube);
        sceneDebugCubeRef.current = debugCube;
        viewer.render();
        publishDebugState(viewer);
      },
      addSceneDebugVoxelClone: () => {
        const viewer = viewerRef.current;
        const headVoxelMesh = outerLayerVoxelMeshesRef.current.head;

        if (!viewer || !headVoxelMesh || sceneDebugVoxelCloneRef.current) {
          return;
        }

        const debugVoxelClone = new Mesh(
          headVoxelMesh.geometry.clone(),
          Array.isArray(headVoxelMesh.material)
            ? headVoxelMesh.material.map((material) => material.clone())
            : headVoxelMesh.material.clone(),
        );

        debugVoxelClone.name = "scene-debug-voxel-clone";
        debugVoxelClone.position.set(22, 4, 0);
        debugVoxelClone.renderOrder = 101;
        viewer.scene.add(debugVoxelClone);
        sceneDebugVoxelCloneRef.current = debugVoxelClone;
        viewer.render();
        publishDebugState(viewer);
      },
      removeSceneDebugCube: () => {
        const viewer = viewerRef.current;
        const debugCube = sceneDebugCubeRef.current;

        if (!viewer || !debugCube) {
          return;
        }

        debugCube.removeFromParent();
        debugCube.geometry.dispose();

        if (Array.isArray(debugCube.material)) {
          debugCube.material.forEach((material) => material.dispose());
        } else {
          debugCube.material.dispose();
        }

        sceneDebugCubeRef.current = null;
        viewer.render();
        publishDebugState(viewer);
      },
      removeSceneDebugVoxelClone: () => {
        const viewer = viewerRef.current;
        const debugVoxelClone = sceneDebugVoxelCloneRef.current;

        if (!viewer || !debugVoxelClone) {
          return;
        }

        debugVoxelClone.removeFromParent();
        debugVoxelClone.geometry.dispose();

        if (Array.isArray(debugVoxelClone.material)) {
          debugVoxelClone.material.forEach((material) => material.dispose());
        } else {
          debugVoxelClone.material.dispose();
        }

        sceneDebugVoxelCloneRef.current = null;
        viewer.render();
        publishDebugState(viewer);
      },
    };
  }

  function refreshViewerPose(nextPose: PoseState, nextOuterLayer: boolean): void {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    applyPose(viewer, nextPose);
    applyOuterLayerPresentation(viewer, nextOuterLayer, showOuterLayerIn3d);
    centerViewerOnCharacter(viewer);
    updateSelectedOutline();
    viewer.render();
    publishDebugState(viewer);
  }

  function clearViewerSkin(): void {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    disposeSelectedOutline();
    disposeHeldItemMeshes();
    disposeOuterLayerVoxelMeshes();
    viewer.loadSkin(null);
    viewer.render();
    publishDebugState(viewer);
  }

  function queueNextPoseFileName(): void {
    setStartupFileName(buildSuggestedPoseName(nextPoseIndexRef.current));
    nextPoseIndexRef.current += 1;
  }

  function clearPendingNewFileUpload(): void {
    setPendingNewFileUpload((currentUpload) => {
      if (currentUpload) {
        URL.revokeObjectURL(currentUpload.previewUrl);
      }

      return null;
    });
  }

  function handleOpenStartupSkinPicker(): void {
    startupSkinInputRef.current?.click();
  }

  function handleOpenPoseFilePicker(): void {
    poseFileInputRef.current?.click();
  }

  function finalizeWorkspaceEntry(): void {
    setHasEnteredWorkspace(true);
    setIsStartupModalOpen(false);
    setIsNewFileModalOpen(false);
  }

  function openNewFileModal(): void {
    clearPendingNewFileUpload();
    setStartupFileName(buildSuggestedPoseName(nextPoseIndexRef.current));
    setStartupUsername(username || DEFAULT_USERNAME);
    setStartupAvatarType("default");
    setIsNewFileModalOpen(true);
  }

  function closeNewFileModal(): void {
    clearPendingNewFileUpload();
    setIsNewFileModalOpen(false);

    if (!hasEnteredWorkspace) {
      setIsStartupModalOpen(true);
    }
  }

  function handleStartupCreateNewFile(): void {
    setIsStartupModalOpen(false);
    openNewFileModal();
  }

  function closeDocumentModal(): void {
    setIsDocumentModalOpen(false);
  }

  function openDocumentModal(): void {
    setIsDocumentModalOpen(true);
  }

  function closeHelpContactModal(): void {
    setHelpContactModalKind(null);
  }

  function closeHeldItemModal(): void {
    setHeldItemModalArmId(null);
  }

  function openHeldItemModal(armId: HeldItemArmId): void {
    setHeldItemModalArmId(armId);
  }

  function openIdeasModal(): void {
    setHelpContactModalKind("ideas");
  }

  function openIssueModal(): void {
    setHelpContactModalKind("issues");
  }

  function openSupportLink(): void {
    window.open("https://ko-fi.com/pockydev", "_blank", "noopener,noreferrer");
  }

  function openGitHubRepo(): void {
    window.open("https://github.com/PckyDev/MC-Poser", "_blank", "noopener,noreferrer");
  }

  function closeShareModal(): void {
    setIsShareModalOpen(false);
    setIsGeneratingProjectShareLink(false);
    setIsGeneratingImageShareLink(false);
    setProjectShareLink(null);
    setImageShareLink(null);
    setProjectShareError(null);
    setImageShareError(null);
  }

  function openShareModal(): void {
    setIsShareModalOpen(true);
    setProjectShareLink(null);
    setImageShareLink(null);
    setProjectShareError(null);
    setImageShareError(null);
  }

  function closeExportModal(): void {
    setIsExportModalOpen(false);
    setIsExporting(false);
    setIsExportPreviewLoading(false);
    setExportPreviewError(null);
    setExportPreviewUrl(null);
  }

  function openExportModal(): void {
    setExportSettings(buildDefaultExportSettings(viewerRef.current?.canvas ?? null));
    setExportPreviewError(null);
    setExportPreviewUrl(null);
    setIsExportModalOpen(true);
  }

  function applyHeldItemToArm(armId: HeldItemArmId, nextHeldItem: HeldItem): void {
    updateDocument(activeDocumentId, (currentDocument) => {
      const previousHeldItem = currentDocument.heldItems[armId];
      const appliedHeldItem = {
        ...nextHeldItem,
        adjustments: cloneHeldItemAdjustments(
          previousHeldItem?.adjustments ?? nextHeldItem.adjustments,
        ),
      };

      if (
        canRevokeHeldItemSource(previousHeldItem) &&
        previousHeldItem.source !== appliedHeldItem.source
      ) {
        URL.revokeObjectURL(previousHeldItem.source);
      }

      return {
        ...currentDocument,
        heldItems: {
          ...currentDocument.heldItems,
          [armId]: appliedHeldItem,
        },
        selectedPoseSelection: { kind: "heldItem", id: armId },
      };
    });
    setError(null);
    setStatus(`${nextHeldItem.label} is now held in the ${formatHeldItemArmLabel(armId).toLowerCase()}.`);
    closeHeldItemModal();
  }

  function updateHeldItemAdjustment(
    armId: HeldItemArmId,
    adjustmentKey: keyof HeldItemAdjustments,
    value: number,
  ): void {
    updateDocument(activeDocumentId, (currentDocument) => {
      const heldItem = currentDocument.heldItems[armId];

      if (!heldItem) {
        return currentDocument;
      }

      return {
        ...currentDocument,
        heldItems: {
          ...currentDocument.heldItems,
          [armId]: {
            ...heldItem,
            adjustments: {
              ...cloneHeldItemAdjustments(heldItem.adjustments),
              [adjustmentKey]: value,
            },
          },
        },
      };
    });
    setError(null);
  }

  function resetHeldItemAdjustments(armId: HeldItemArmId): void {
    updateDocument(activeDocumentId, (currentDocument) => {
      const heldItem = currentDocument.heldItems[armId];

      if (!heldItem) {
        return currentDocument;
      }

      return {
        ...currentDocument,
        heldItems: {
          ...currentDocument.heldItems,
          [armId]: {
            ...heldItem,
            adjustments: createDefaultHeldItemAdjustments(),
          },
        },
      };
    });
    setError(null);
    setStatus(`Reset held item controls for the ${formatHeldItemArmLabel(armId).toLowerCase()}.`);
  }

  function handleHeldItemPresetSelect(presetId: HeldItemPresetId): void {
    if (!heldItemModalArmId) {
      return;
    }

    applyHeldItemToArm(heldItemModalArmId, buildPresetHeldItem(presetId));
  }

  function handleHeldItemUploadSelect(file: File): void {
    if (!heldItemModalArmId) {
      return;
    }

    applyHeldItemToArm(
      heldItemModalArmId,
      createUploadedHeldItem(file, URL.createObjectURL(file)),
    );
  }

  function removeHeldItemFromArm(armId: HeldItemArmId): void {
    updateDocument(activeDocumentId, (currentDocument) => {
      const previousHeldItem = currentDocument.heldItems[armId];

      if (canRevokeHeldItemSource(previousHeldItem)) {
        URL.revokeObjectURL(previousHeldItem.source);
      }

      return {
        ...currentDocument,
        heldItems: {
          ...currentDocument.heldItems,
          [armId]: null,
        },
      };
    });
    setError(null);
    setStatus(`Removed the held item from the ${formatHeldItemArmLabel(armId).toLowerCase()}.`);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const gizmoCanvas = viewportGizmoCanvasRef.current;
    const stage = stageRef.current;

    if (!canvas || !gizmoCanvas || !stage) {
      return;
    }

    const viewer = new SkinViewer({
      canvas,
      width: Math.max(stage.clientWidth, 480),
      height: Math.max(stage.clientHeight, 560),
      preserveDrawingBuffer: true,
      enableControls: true,
      fov: 40,
      zoom: 0.88,
    });

    let viewportGizmo: ViewportGizmo | null = createViewportGizmo(gizmoCanvas);
    const rotationGizmo = new TransformControls(viewer.camera, canvas);
    const renderViewer = viewer.render.bind(viewer);

    viewer.render = () => {
      renderViewer();
      viewportGizmo?.render(viewer);
    };

    viewerRef.current = viewer;
    rotationGizmoRef.current = rotationGizmo;
    attachDebugHelpers();
    applyViewportLighting(viewer, viewportLightingMode);
    viewer.controls.enablePan = false;
    viewer.controls.enableDamping = true;
    viewer.controls.dampingFactor = 0.08;
    viewer.controls.minDistance = 18;
    viewer.controls.maxDistance = 72;
    viewer.controls.minPolarAngle = Math.PI / 3.2;
    viewer.controls.maxPolarAngle = Math.PI - Math.PI / 4.5;
    centerViewerOnCharacter(viewer);
    applyAvatarType(viewer, avatarType);
    applyPose(viewer, pose);
    applyOuterLayerPresentation(viewer, showOuterLayer, showOuterLayerIn3d);
    syncSelectedOutline();
    rotationGizmo.setMode("rotate");
    rotationGizmo.setSpace("local");
    rotationGizmo.size = 0.9;
    rotationGizmo.visible = false;
    viewer.scene.add(rotationGizmo);
    rotationGizmo.addEventListener("mouseDown", () => {
      suppressViewportClickRef.current = true;
    });
    rotationGizmo.addEventListener("dragging-changed", (event) => {
      const isDragging = Boolean((event as { value?: boolean }).value);

      isRotationGizmoDraggingRef.current = isDragging;
      viewer.controls.enabled = !isDragging;

      if (isDragging) {
        rotationGizmoDraftPoseRef.current = clonePose(poseRef.current);
        return;
      }

      const binding = rotationGizmoBindingRef.current;
      const draftPose = rotationGizmoDraftPoseRef.current;

      rotationGizmoDraftPoseRef.current = null;

      if (!binding || !draftPose) {
        syncSelectedOutline();
        viewer.render();
        publishDebugState(viewer);
        return;
      }

      const committedPose = binding.updatePoseFromObject(draftPose, binding.object);

      updateDocument(activeDocumentIdRef.current, (currentDocument) => ({
        ...currentDocument,
        selectedPreset: null,
        pose: committedPose,
      }));
    });
    rotationGizmo.addEventListener("objectChange", () => {
      if (!isRotationGizmoDraggingRef.current) {
        return;
      }

      const binding = rotationGizmoBindingRef.current;

      if (!binding) {
        return;
      }

      const nextDraftPose = binding.updatePoseFromObject(
        rotationGizmoDraftPoseRef.current ?? poseRef.current,
        binding.object,
      );

      rotationGizmoDraftPoseRef.current = nextDraftPose;
      syncSelectedOutline();
      viewer.render();
      publishDebugState(viewer);
    });
    syncRotationGizmo();
    viewer.render();
    publishDebugState(viewer);

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const boneTargets = [
      { id: "head", object: viewer.playerObject.skin.head },
      { id: "leftArm", object: viewer.playerObject.skin.leftArm },
      { id: "rightArm", object: viewer.playerObject.skin.rightArm },
      { id: "leftLeg", object: viewer.playerObject.skin.leftLeg },
      { id: "rightLeg", object: viewer.playerObject.skin.rightLeg },
      { id: "torso", object: viewer.playerObject.skin.body },
    ] as const;

    const resolveBoneFromObject = (hitObject: Object3D | null): PoseBoneId | null => {
      if (!hitObject) {
        return null;
      }

      for (const target of boneTargets) {
        let currentObject: Object3D | null = hitObject;

        while (currentObject) {
          if (currentObject === target.object) {
            return target.id;
          }

          currentObject = currentObject.parent;
        }
      }

      return null;
    };

    const handleViewportClick = (event: MouseEvent) => {
      if (suppressViewportClickRef.current) {
        suppressViewportClickRef.current = false;
        return;
      }

      const rect = canvas.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, viewer.camera);

      const hitObject = raycaster.intersectObjects(
        boneTargets.map((target) => target.object),
        true,
      )[0]?.object ?? null;
      const selectedBoneId = resolveBoneFromObject(hitObject);

      if (!selectedBoneId) {
        return;
      }

      updateDocument(activeDocumentIdRef.current, (document) => ({
        ...document,
        selectedPoseSelection: { kind: "bone", id: selectedBoneId },
      }));
    };

    const handleViewportGizmoClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const snappedView = viewportGizmo?.pickView(event.clientX, event.clientY);

      if (!snappedView) {
        return;
      }

      snapViewerCameraToGizmoView(viewer, snappedView);
    };

    canvas.addEventListener("click", handleViewportClick);
    gizmoCanvas.addEventListener("click", handleViewportGizmoClick);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      viewer.setSize(
        Math.max(Math.floor(entry.contentRect.width), 480),
        Math.max(Math.floor(entry.contentRect.height), 560),
      );
      viewportGizmo?.resize();
      viewer.controls.update();
      viewer.render();
      publishDebugState(viewer);
    });

    resizeObserver.observe(stage);
    setViewerReady(true);
    setStatus("Viewport ready. Create or open a pose file to begin.");

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("click", handleViewportClick);
      gizmoCanvas.removeEventListener("click", handleViewportGizmoClick);
      disposeSelectedOutline();
      rotationGizmo.detach();
      rotationGizmo.removeFromParent();
      rotationGizmo.dispose();
      rotationGizmoDraftPoseRef.current = null;
      disposeHeldItemMeshes();
      disposeOuterLayerVoxelMeshes();
      disposeViewerViewportMaterialVariants(viewer);
      viewportGizmo?.dispose();
      viewportGizmo = null;
      rotationGizmoRef.current = null;
      rotationGizmoBindingRef.current = null;
      isRotationGizmoDraggingRef.current = false;
      sceneDebugCubeRef.current?.removeFromParent();
      sceneDebugCubeRef.current = null;
      sceneDebugVoxelCloneRef.current?.removeFromParent();
      sceneDebugVoxelCloneRef.current = null;
      documentsRef.current.forEach(releaseDocumentUploadSkin);
      documentsRef.current.forEach(releaseDocumentHeldItems);
      viewer.dispose();
      viewerRef.current = null;
      (window as DebugWindow).__MC_POSER_DEBUG_HELPERS__ = undefined;
      setViewerReady(false);
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    applyViewportLighting(viewer, viewportLightingMode);
    viewer.render();
    publishDebugState(viewer);
  }, [viewportLightingMode]);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    applyPose(viewer, pose);
    syncSelectedOutline();
    syncRotationGizmo();
    viewer.render();
    publishDebugState(viewer);
  }, [avatarType, pose]);

  useEffect(() => {
    syncSelectedOutline();
    syncRotationGizmo();
  }, [selectedPoseSelection, skin]);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    applyOuterLayerPresentation(viewer, showOuterLayer, showOuterLayerIn3d);
    applyViewportLighting(viewer, viewportLightingMode);
    syncSelectedOutline();
    syncRotationGizmo();
    viewer.render();
    publishDebugState(viewer);
  }, [showOuterLayer, showOuterLayerIn3d, resolvedModel, viewportLightingMode]);

  useEffect(() => {
    if (skin?.origin !== "upload") {
      return;
    }

    updateDocument(activeDocumentId, (document) => {
      if (!document.skin || document.skin.origin !== "upload") {
        return document;
      }

      return {
        ...document,
        skin: {
          ...document.skin,
          modelPreference: document.uploadModel,
        },
      };
    });
    setIsLoading(true);
    setStatus("Updating uploaded skin model...");
  }, [activeDocumentId, skin?.origin, uploadModel]);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer || !skin) {
      if (viewer) {
        disposeSelectedOutline();
        disposeHeldItemMeshes();
        disposeOuterLayerVoxelMeshes();
        disposeViewerViewportMaterialVariants(viewer);
        viewer.loadSkin(null);
        applyViewportLighting(viewer, viewportLightingModeRef.current);
        viewer.render();
        publishDebugState(viewer);
      }

      return;
    }

    let cancelled = false;

    const loadSkinIntoViewer = async () => {
      try {
        disposeViewerViewportMaterialVariants(viewer);
        disposeHeldItemMeshes();
        disposeOuterLayerVoxelMeshes();

        await viewer.loadSkin(skin.source, {
          model: skin.modelPreference,
          makeVisible: true,
        });

        if (cancelled) {
          return;
        }

        setViewerInnerLayerVisible(viewer, true);
        applyAvatarType(viewer, avatarType);
        rebuildOuterLayerVoxelMeshes(viewer);
        applyOuterLayerPresentation(viewer, showOuterLayer, showOuterLayerIn3d);
        applyViewportLighting(viewer, viewportLightingModeRef.current);
        centerViewerOnCharacter(viewer);
        applyPose(viewer, pose);
        syncSelectedOutline();
        syncRotationGizmo();
        viewer.render();
        publishDebugState(viewer);

        updateDocument(activeDocumentId, (currentDocument) => ({
          ...currentDocument,
          resolvedModel: viewer.playerObject.skin.modelType as ArmModel,
        }));
        setError(null);
        setStatus(`${skin.label} is ready in the viewport.`);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load that skin texture.",
        );
        setStatus("Skin load failed.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSkinIntoViewer();

    return () => {
      cancelled = true;
    };
  }, [activeDocumentId, skin?.source, skin?.modelPreference]);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer || !skin) {
      return;
    }

    applyAvatarType(viewer, avatarType);
    applyPose(viewer, pose);
    applyOuterLayerPresentation(viewer, showOuterLayer, showOuterLayerIn3d);
    syncSelectedOutline();
    syncRotationGizmo();
    viewer.render();
    publishDebugState(viewer);
  }, [avatarType, pose, showOuterLayer, showOuterLayerIn3d, skin]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const requestId = ++heldItemBuildRequestIdRef.current;

    disposeHeldItemMeshes();

    if (!viewer || !skin || isLoading) {
      if (viewer) {
        syncSelectedOutline();
        viewer.render();
        publishDebugState(viewer);
      }

      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await rebuildHeldItemMeshes(viewer, heldItems);

        if (cancelled || heldItemBuildRequestIdRef.current !== requestId) {
          return;
        }

        applyViewportLighting(viewer, viewportLightingModeRef.current);
        syncSelectedOutline();
        viewer.render();
        publishDebugState(viewer);
      } catch (heldItemError) {
        if (cancelled || heldItemBuildRequestIdRef.current !== requestId) {
          return;
        }

        setError(
          heldItemError instanceof Error
            ? heldItemError.message
            : "Unable to render the held item.",
        );
        setStatus("Held item render failed.");
      }
    })();

    return () => {
      cancelled = true;

      if (heldItemBuildRequestIdRef.current === requestId) {
        disposeHeldItemMeshes();
      }
    };
  }, [activeDocumentId, avatarType, heldItemGeometryKey, isLoading, skin]);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer || !skin || isLoading) {
      return;
    }

    if (!syncHeldItemMeshTransforms(viewer, heldItems)) {
      return;
    }

    syncSelectedOutline();
    viewer.render();
    publishDebugState(viewer);
  }, [heldItems, isLoading, skin]);

  useEffect(() => {
    const viewer = viewerRef.current;

    applyHeldItemVisibility(showHeldItems);

    if (!viewer || !skin) {
      return;
    }

    syncSelectedOutline();
    viewer.render();
    publishDebugState(viewer);
  }, [showHeldItems, skin]);

  async function loadUsername(nextUsername: string, targetDocumentId = activeDocumentId): Promise<void> {
    const trimmedUsername = nextUsername.trim();

    if (!trimmedUsername) {
      setError("Enter a Minecraft username first.");
      setStatus("Username input is empty.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatus(`Resolving ${trimmedUsername} from Mojang...`);

    try {
      const response = await fetch(
        `/api/skin?username=${encodeURIComponent(trimmedUsername)}`,
      );
      const payload = (await response.json()) as SkinLookupResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to resolve that username.");
      }

      updateDocument(targetDocumentId, (currentDocument) => {
        const currentSkin = currentDocument.skin;

        if (canRevokeSkinSource(currentSkin)) {
          URL.revokeObjectURL(currentSkin.source);
        }

        return {
          ...currentDocument,
          skin: {
            source: payload.textureUrl,
            label: payload.username,
            origin: "username",
            detail: `UUID ${payload.uuid}`,
            modelPreference: payload.model,
          },
          resolvedModel: payload.model,
        };
      });
      setStatus(`Rendering ${payload.username}...`);
    } catch (lookupError) {
      setIsLoading(false);
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Unable to resolve that username.",
      );
      setStatus("Username lookup failed.");
    }
  }

  function handleUsernameSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void loadUsername(username);
  }

  function handleQuickLoad(nextUsername: string): void {
    setUsername(nextUsername);
    void loadUsername(nextUsername);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".png")) {
      setError("Upload a PNG skin file.");
      setStatus("That file is not a PNG skin.");
      event.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setIsLoading(true);
    setError(null);

    updateDocument(activeDocumentId, (currentDocument) => {
      const currentSkin = currentDocument.skin;

      if (canRevokeSkinSource(currentSkin)) {
        URL.revokeObjectURL(currentSkin.source);
      }

      return {
        ...currentDocument,
        skin: {
          source: objectUrl,
          label: file.name.replace(/\.png$/i, ""),
          origin: "upload",
          detail: `${Math.round(file.size / 1024)} KB upload`,
          modelPreference: currentDocument.uploadModel,
        },
        resolvedModel: null,
      };
    });

    setStatus(`Loading ${file.name} into ${poseFileName}...`);
    event.target.value = "";
  }

  function handleOpenFilePicker(): void {
    fileInputRef.current?.click();
  }

  function handleStartupSkinFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".png")) {
      setError("Upload a PNG skin file.");
      setStatus("That file is not a PNG skin.");
      event.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setPendingNewFileUpload((currentUpload) => {
      if (currentUpload) {
        URL.revokeObjectURL(currentUpload.previewUrl);
      }

      return {
        file,
        previewUrl,
        fileName: file.name,
        detail: `${Math.round(file.size / 1024)} KB upload`,
      };
    });

    setError(null);
    setStatus(`${file.name} is ready to create ${startupFileName}.`);
    event.target.value = "";
  }

  function createUploadedPoseFile(): void {
    if (!pendingNewFileUpload) {
      setError("Choose a PNG skin before creating the workspace.");
      setStatus("No uploaded PNG is ready yet.");
      return;
    }

    const { file, detail } = pendingNewFileUpload;
    const objectUrl = URL.createObjectURL(file);
    const nextDocument = openDocumentFromStartup(startupFileName, {
      skin: {
        source: objectUrl,
        label: file.name.replace(/\.png$/i, ""),
        origin: "upload",
        detail,
        modelPreference: "auto-detect",
      },
      avatarType: startupAvatarType,
      resolvedModel: null,
      uploadModel: "auto-detect",
    });

    finalizeWorkspaceEntry();
    clearPendingNewFileUpload();
    queueNextPoseFileName();
    setIsLoading(true);
    setError(null);
    setStatus(`Loading ${file.name} into ${nextDocument.poseFileName}...`);
  }

  function importWorkspaceFile(
    parsedFile: ImportedWorkspaceFile,
    fallbackFileName: string,
  ): WorkspaceDocument {
    if (!isObjectRecord(parsedFile)) {
      throw new Error("That pose file format is invalid.");
    }

    const resolvedModel = isArmModel(parsedFile.resolvedModel)
      ? parsedFile.resolvedModel
      : null;
    const importedSkin = normalizeImportedSkin(
      parsedFile.skin,
      parsedFile.resolvedModel,
    );
    const nextDocument = openDocumentFromStartup(
      typeof parsedFile.poseFileName === "string" && parsedFile.poseFileName.trim()
        ? parsedFile.poseFileName
        : fallbackFileName,
      {
        heldItems: normalizeImportedHeldItems(parsedFile.heldItems),
        pose: normalizeImportedPose(parsedFile.pose),
        skin: importedSkin,
        selectedPoseSelection: normalizeImportedSelection(
          parsedFile.selectedPoseSelection,
        ),
        selectedPreset:
          typeof parsedFile.selectedPreset === "string" &&
          POSE_PRESET_NAME_SET.has(parsedFile.selectedPreset as PosePresetName)
            ? (parsedFile.selectedPreset as PosePresetName)
            : null,
        showOuterLayer:
          typeof parsedFile.showOuterLayer === "boolean"
            ? parsedFile.showOuterLayer
            : true,
        showOuterLayerIn3d:
          typeof parsedFile.showOuterLayerIn3d === "boolean"
            ? parsedFile.showOuterLayerIn3d
            : false,
        showHeldItems:
          typeof parsedFile.showHeldItems === "boolean"
            ? parsedFile.showHeldItems
            : true,
        avatarType: isAvatarType(parsedFile.avatarType)
          ? parsedFile.avatarType
          : "default",
        resolvedModel,
        uploadModel: isModelPreference(parsedFile.uploadModel)
          ? parsedFile.uploadModel
          : importedSkin?.origin === "upload"
            ? importedSkin.modelPreference
            : "auto-detect",
      },
    );

    if (importedSkin?.origin === "username") {
      setUsername(importedSkin.label);
    }

    finalizeWorkspaceEntry();
    clearPendingNewFileUpload();
    queueNextPoseFileName();
    setError(null);
    setIsLoading(importedSkin !== null);
    setStatus(
      importedSkin
        ? `Opening ${nextDocument.poseFileName}...`
        : `Opened ${nextDocument.poseFileName}.`,
    );

    return nextDocument;
  }

  async function handleOpenPoseFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!/\.(mcpose|json)$/i.test(file.name)) {
      setError("Open a .mcpose workspace file.");
      setStatus("That file is not a pose workspace.");
      event.target.value = "";
      return;
    }

    try {
      const parsedFile = JSON.parse(await file.text()) as ImportedWorkspaceFile;
      importWorkspaceFile(parsedFile, file.name);
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Unable to open that pose file.",
      );
      setStatus("Pose file open failed.");
    } finally {
      event.target.value = "";
    }
  }


      useEffect(() => {
        const sharedHashPayload = readSharePayloadFromHash(window.location.hash);

        if (!sharedHashPayload) {
          return;
        }

        let cancelled = false;

        void (async () => {
          try {
            const decodedPayload = JSON.parse(
              await decompressTextPayload(sharedHashPayload.payload),
            ) as unknown;

            if (cancelled) {
              return;
            }

            if (sharedHashPayload.kind === "image") {
              const imageSharePayload = decodeImageSharePayload(decodedPayload);

              setExportSettings(imageSharePayload.exportSettings);
              setSharedImageSettings(imageSharePayload.exportSettings);
              setShareLandingMode("image");
              importWorkspaceFile(imageSharePayload.workspaceFile, "shared-image.mcpose");
              return;
            }

            importWorkspaceFile(
              decodeProjectShareValue(decodedPayload),
              "shared-project.mcpose",
            );
          } catch (shareOpenError) {
            if (cancelled) {
              return;
            }

            setError(
              shareOpenError instanceof Error
                ? shareOpenError.message
                : "Unable to open that shared project link.",
            );
            setStatus("Shared project link failed.");
          }
        })();

        return () => {
          cancelled = true;
        };
      }, []);

      useEffect(() => {
        if (
          shareLandingMode !== "image" ||
          !sharedImageSettings ||
          !viewerReady ||
          !skin ||
          isLoading
        ) {
          return;
        }

        let isCancelled = false;

        setIsSharedImageRendering(true);
        setSharedImageViewError(null);

        void (async () => {
          try {
            const nextSharedImageUrl = await blobToDataUrl(
              await renderExportBlob(sharedImageSettings),
            );

            if (isCancelled) {
              return;
            }

            setSharedImageUrl(nextSharedImageUrl);
          } catch (sharedImageError) {
            if (isCancelled) {
              return;
            }

            setSharedImageViewError(
              sharedImageError instanceof Error
                ? sharedImageError.message
                : "Unable to render that shared image.",
            );
          } finally {
            if (!isCancelled) {
              setIsSharedImageRendering(false);
            }
          }
        })();

        return () => {
          isCancelled = true;
        };
      }, [avatarType, isLoading, shareLandingMode, sharedImageSettings, skin, viewerReady]);
  function handleSelectBone(nextBoneId: PoseBoneId): void {
    updateDocument(activeDocumentId, (currentDocument) => ({
      ...currentDocument,
      selectedPoseSelection: { kind: "bone", id: nextBoneId },
    }));
  }
  function handleSelectHeldItem(nextArmId: HeldItemArmId): void {
    updateDocument(activeDocumentId, (currentDocument) => ({
      ...currentDocument,
      selectedPoseSelection: { kind: "heldItem", id: nextArmId },
    }));
  }

  function handleSelectJoint(nextJointId: keyof PoseState): void {
    updateDocument(activeDocumentId, (currentDocument) => ({
      ...currentDocument,
      selectedPoseSelection: { kind: "joint", id: nextJointId },
    }));
  }

  function updatePose(key: keyof PoseState, value: number): void {
    updateDocument(activeDocumentId, (currentDocument) => ({
      ...currentDocument,
      selectedPreset: null,
      pose: {
        ...currentDocument.pose,
        [key]: value,
      },
    }));
  }

  function applyPreset(nextPreset: PosePresetName): void {
    updateDocument(activeDocumentId, (currentDocument) => ({
      ...currentDocument,
      selectedPreset: nextPreset,
      pose: clonePose(POSE_PRESETS[nextPreset]),
    }));
  }

  function resetPose(): void {
    applyPreset("neutral");
    setStatus("Pose reset to neutral.");
  }

  function handleResetCamera(): void {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    viewer.resetCameraPose();
    centerViewerOnCharacter(viewer);
    viewer.render();
    setStatus("Camera reset to default editor view.");
  }

  async function renderExportBlob(settings: ExportSettings): Promise<Blob> {
    const viewer = viewerRef.current;
    const stage = stageRef.current;
    const selectedOutline = selectedOutlineRef.current;
    const rotationGizmo = rotationGizmoRef.current;

    if (!viewer || !skin) {
      throw new Error("Load a skin before exporting.");
    }

    if (settings.width < 64 || settings.height < 64) {
      throw new Error("Export resolution must be at least 64 x 64 pixels.");
    }

    const previousSelectedOutlineVisibility = selectedOutline?.visible ?? false;
    const previousRotationGizmoVisibility = rotationGizmo?.visible ?? false;

    if (selectedOutline) {
      selectedOutline.visible = false;
    }

    if (rotationGizmo) {
      rotationGizmo.visible = false;
    }

    viewer.render();

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = settings.width;
    exportCanvas.height = settings.height;

    const context = exportCanvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to create an export canvas.");
    }

    const restoreWidth = Math.max(stage?.clientWidth ?? viewer.canvas.clientWidth, 480);
    const restoreHeight = Math.max(stage?.clientHeight ?? viewer.canvas.clientHeight, 560);
    const savedCameraPosition = viewer.camera.position.clone();
    const savedCameraUp = viewer.camera.up.clone();
    const savedControlsTarget = viewer.controls.target.clone();
    const effectiveBackgroundMode =
      settings.fileType === "jpg" ? "solid" : settings.backgroundMode;
    const targetAspectRatio = settings.width / Math.max(settings.height, 1);
    const playerBounds = new Box3().setFromObject(viewer.playerObject);
    let exportBlobPromise: Promise<Blob>;

    try {
      viewer.setSize(settings.width, settings.height);
      viewer.camera.aspect = targetAspectRatio;
      viewer.camera.updateProjectionMatrix();

      if (!playerBounds.isEmpty()) {
        const center = playerBounds.getCenter(new Vector3());
        const cameraOffsetDirection = savedCameraPosition
          .clone()
          .sub(savedControlsTarget);

        if (cameraOffsetDirection.lengthSq() < 0.0001) {
          cameraOffsetDirection.set(0, 0, 1);
        }

        cameraOffsetDirection.normalize();

        const fittedDistance = Math.max(
          calculateCameraFitDistance(playerBounds, center, viewer.camera) * 1.08,
          1,
        );

        viewer.camera.up.copy(savedCameraUp);
        viewer.camera.position.copy(
          center.clone().addScaledVector(cameraOffsetDirection, fittedDistance),
        );
        viewer.camera.lookAt(center);
        viewer.controls.target.copy(center);
        viewer.controls.update();
      }

      viewer.render();

      context.clearRect(0, 0, settings.width, settings.height);

      if (effectiveBackgroundMode === "solid") {
        context.fillStyle = settings.backgroundColor;
        context.fillRect(0, 0, settings.width, settings.height);
      }

      context.imageSmoothingEnabled = true;
      context.drawImage(viewer.canvas, 0, 0, settings.width, settings.height);

      exportBlobPromise = canvasToBlob(
        exportCanvas,
        getExportMimeType(settings.fileType),
        settings.fileType === "png" ? undefined : 0.95,
      );
    } finally {
      viewer.setSize(restoreWidth, restoreHeight);
      viewer.camera.up.copy(savedCameraUp);
      viewer.camera.position.copy(savedCameraPosition);
      viewer.controls.target.copy(savedControlsTarget);
      viewer.camera.lookAt(savedControlsTarget);
      viewer.controls.update();

      if (selectedOutline) {
        selectedOutline.visible = previousSelectedOutlineVisibility;
      }

      if (rotationGizmo) {
        rotationGizmo.visible = previousRotationGizmoVisibility;
      }

      viewer.render();
      publishDebugState(viewer);
    }

    return exportBlobPromise;
  }

  async function handleExport(): Promise<void> {
    if (!skin) {
      return;
    }

    try {
      setIsExporting(true);
      const exportBlob = await renderExportBlob(exportSettings);
      const exportFileName = `${buildDownloadName(skin.label)}.${exportSettings.fileType}`;

      downloadExportFile(exportFileName, exportBlob);
      closeExportModal();
      setStatus(`Exported ${skin.label} as ${exportSettings.fileType.toUpperCase()}.`);
      setError(null);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Unable to export the current render.",
      );
      setStatus("Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportDimensionChange(
    field: "width" | "height",
    rawValue: number,
  ): void {
    const nextValue = Math.max(64, Math.min(4096, Math.round(rawValue)));

    setExportSettings((currentSettings) => ({
      ...currentSettings,
      [field]: nextValue,
    }));
  }

  function handleExportFileTypeChange(nextFileType: ExportFileType): void {
    setExportSettings((currentSettings) => ({
      ...currentSettings,
      fileType: nextFileType,
      backgroundMode:
        nextFileType === "jpg" ? "solid" : currentSettings.backgroundMode,
    }));
  }

  function handleExportBackgroundModeChange(nextBackgroundMode: ExportBackgroundMode): void {
    setExportSettings((currentSettings) => ({
      ...currentSettings,
      backgroundMode: nextBackgroundMode,
    }));
  }

  function handleExportBackgroundColorChange(nextBackgroundColor: string): void {
    setExportSettings((currentSettings) => ({
      ...currentSettings,
      backgroundColor: nextBackgroundColor,
    }));
  }

  async function handleGenerateProjectShareLink(): Promise<void> {
    try {
      setIsGeneratingProjectShareLink(true);
      setProjectShareError(null);

      const workspacePayload = await buildWorkspaceFilePayload(activeDocument);
      const serializedWorkspace = JSON.stringify(encodeWorkspaceForShare(workspacePayload));
      const compressedPayload = await compressTextPayload(serializedWorkspace);

      setProjectShareLink(buildShareUrl("project", compressedPayload));
      setStatus(`Project share link ready for ${activeDocument.poseFileName}.`);
    } catch (shareError) {
      setProjectShareError(
        shareError instanceof Error
          ? shareError.message
          : "Unable to generate that project share link.",
      );
      setStatus("Project share link failed.");
    } finally {
      setIsGeneratingProjectShareLink(false);
    }
  }

  async function handleGenerateImageShareLink(): Promise<void> {
    if (!skin) {
      return;
    }

    try {
      setIsGeneratingImageShareLink(true);
      setImageShareError(null);

      const workspacePayload = await buildWorkspaceFilePayload(activeDocument);
      const serializedImageShare = JSON.stringify(
        encodeImageSharePayload(workspacePayload, exportSettings),
      );
      const compressedPayload = await compressTextPayload(serializedImageShare);

      setImageShareLink(buildShareUrl("image", compressedPayload));
      setStatus(`Image share link ready for ${skin.label}.`);
    } catch (shareError) {
      setImageShareError(
        shareError instanceof Error
          ? shareError.message
          : "Unable to generate that image share link.",
      );
      setStatus("Image share link failed.");
    } finally {
      setIsGeneratingImageShareLink(false);
    }
  }

  async function handleCopyProjectShareLink(): Promise<void> {
    if (!projectShareLink) {
      return;
    }

    try {
      await copyTextToClipboard(projectShareLink);
      setStatus("Project share link copied.");
    } catch (copyError) {
      setProjectShareError(
        copyError instanceof Error
          ? copyError.message
          : "Unable to copy that project share link.",
      );
      setStatus("Project share link copy failed.");
    }
  }

  async function handleCopyImageShareLink(): Promise<void> {
    if (!imageShareLink) {
      return;
    }

    try {
      await copyTextToClipboard(imageShareLink);
      setStatus("Image share link copied.");
    } catch (copyError) {
      setImageShareError(
        copyError instanceof Error
          ? copyError.message
          : "Unable to copy that image share link.",
      );
      setStatus("Image share link copy failed.");
    }
  }

  async function saveWorkspaceFile(saveAs: boolean): Promise<void> {
    const currentDocument = activeDocument;
    let nextPoseFileName = currentDocument.poseFileName;
    let nextFileHandle = currentDocument.fileHandle;

    if (saveAs) {
      const pickedFileHandle = await pickWorkspaceSaveFile(currentDocument.poseFileName);

      if (pickedFileHandle) {
        nextFileHandle = pickedFileHandle;
        nextPoseFileName = normalizePoseFileName(pickedFileHandle.name);
      } else {
        const promptedName = window.prompt("Save pose file as", currentDocument.poseFileName);

        if (!promptedName) {
          return;
        }

        nextPoseFileName = normalizePoseFileName(promptedName);
      }
    }

    setError(null);
    setStatus(`Saving ${nextPoseFileName}...`);

    try {
      const filePayload = await buildWorkspaceFilePayload(currentDocument, nextPoseFileName);
      const serializedContents = JSON.stringify(filePayload, null, 2);

      if (nextFileHandle) {
        await writeWorkspaceFileToHandle(nextFileHandle, serializedContents);
      } else {
        downloadWorkspaceFile(nextPoseFileName, serializedContents);
      }

      updateDocument(currentDocument.id, (document) => ({
        ...document,
        poseFileName: nextPoseFileName,
        fileHandle: nextFileHandle,
      }));
      setStatus(`Saved ${nextPoseFileName}.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save that pose file.",
      );
      setStatus("Save failed.");
    }
  }

  function handlePoseFileNameBlur(): void {
    updateDocument(activeDocumentId, (currentDocument) => ({
      ...currentDocument,
      poseFileName: normalizePoseFileName(currentDocument.poseFileName),
    }));
  }

  function handlePoseFileNameChange(nextValue: string): void {
    updateDocument(activeDocumentId, (currentDocument) => ({
      ...currentDocument,
      poseFileName: nextValue,
    }));
  }

  function handleUploadModelChange(nextModel: ModelPreference): void {
    updateDocument(activeDocumentId, (currentDocument) => ({
      ...currentDocument,
      uploadModel: nextModel,
      skin:
        currentDocument.skin?.origin === "upload"
          ? {
              ...currentDocument.skin,
              modelPreference: nextModel,
            }
          : currentDocument.skin,
    }));

    if (skin?.origin === "upload") {
      setIsLoading(true);
      setStatus("Updating uploaded skin model...");
    }
  }

  function handleAvatarTypeChange(nextAvatarType: AvatarType): void {
    const supportedPoseKeys = new Set(
      getPoseBones(nextAvatarType).flatMap((bone) => bone.fields.map((field) => field.key)),
    );

    updateDocument(activeDocumentId, (currentDocument) => ({
      ...currentDocument,
      avatarType: nextAvatarType,
      selectedPoseSelection:
        currentDocument.selectedPoseSelection.kind === "joint" &&
        !supportedPoseKeys.has(currentDocument.selectedPoseSelection.id)
          ? {
              kind: "bone",
              id: resolveSelectedBoneId(currentDocument.selectedPoseSelection),
            }
          : currentDocument.selectedPoseSelection,
    }));
    setError(null);
    setStatus(`Switched ${poseFileName} to the ${formatAvatarTypeLabel(nextAvatarType)} avatar type.`);
  }

  function handleStartupFileNameBlur(): void {
    setStartupFileName(normalizePoseFileName(startupFileName));
  }

  function createUsernamePoseFile(rawUsername = startupUsername): void {
    const trimmedUsername = rawUsername.trim();

    if (!trimmedUsername) {
      setError("Enter a Minecraft username to start from.");
      setStatus("Startup username is empty.");
      return;
    }

    const nextDocument = openDocumentFromStartup(startupFileName, {
      avatarType: startupAvatarType,
    });

    finalizeWorkspaceEntry();
    clearPendingNewFileUpload();
    queueNextPoseFileName();
    setUsername(trimmedUsername);
    setStatus(`Created ${nextDocument.poseFileName}. Loading ${trimmedUsername}...`);
    void loadUsername(trimmedUsername, nextDocument.id);
  }

  function handleStartupQuickLoad(nextUsername: string): void {
    setStartupUsername(nextUsername);
    createUsernamePoseFile(nextUsername);
  }

  const adjustedJointCount = countAdjustedJoints(pose);
  const isExportDisabled = !skin || isLoading || shareLandingMode === "image";
  const isShareDisabled = !skin || isLoading || shareLandingMode === "image";
  const currentModelLabel = skin ? formatModelLabel(skin.modelPreference, resolvedModel) : "No model";
  const activePoseLabel = selectedPreset ? formatPresetName(selectedPreset) : "Custom";
  const shareImageOutputSummary = `${exportSettings.fileType.toUpperCase()} • ${exportSettings.width} x ${exportSettings.height} • ${
    exportSettings.fileType !== "jpg" && exportSettings.backgroundMode === "transparent"
      ? "Transparent background"
      : `Solid ${exportSettings.backgroundColor.toUpperCase()}`
  }`;

  return (
    <>
      <div
        className={
          shareLandingMode === "image"
            ? "editor-shell editor-shell--share-hidden"
            : "editor-shell"
        }
      >
      <EditorTopbar
        isExportDisabled={isExportDisabled}
        isShareDisabled={isShareDisabled}
        selectedPreset={selectedPreset}
        onOpenDocumentModal={openDocumentModal}
        onOpenGitHubRepo={openGitHubRepo}
        onOpenIdeasModal={openIdeasModal}
        onOpenNewFileModal={openNewFileModal}
        onOpenPoseFile={handleOpenPoseFilePicker}
        onOpenIssueModal={openIssueModal}
        onSavePoseFile={() => {
          void saveWorkspaceFile(false);
        }}
        onSavePoseFileAs={() => {
          void saveWorkspaceFile(true);
        }}
        onApplyPreset={applyPreset}
        onResetPose={resetPose}
        onResetCamera={handleResetCamera}
        onOpenShareModal={openShareModal}
        onOpenSupportLink={openSupportLink}
        onOpenExportModal={openExportModal}
      />

      <DocumentTabBar
        documents={documents.map((document) => ({
          id: document.id,
          poseFileName: document.poseFileName,
        }))}
        activeDocumentId={activeDocumentId}
        onSelectDocument={switchToDocument}
      />

      <main className="editor-body">
        <LeftSidebar
          avatarType={avatarType}
          selectedSelection={selectedPoseSelection}
          onSelectBone={handleSelectBone}
          onSelectHeldItem={handleSelectHeldItem}
          onSelectJoint={handleSelectJoint}
        />

        <ViewportPanel
          stageRef={stageRef}
          canvasRef={canvasRef}
          gizmoCanvasRef={viewportGizmoCanvasRef}
          isLoading={isLoading}
          viewportLightingMode={viewportLightingMode}
          onViewportLightingModeChange={setViewportLightingMode}
        />

        <RightSidebar
          avatarType={avatarType}
          heldItems={heldItems}
          selectedSelection={selectedPoseSelection}
          pose={pose}
          showOuterLayer={showOuterLayer}
          showOuterLayerIn3d={showOuterLayerIn3d}
          showHeldItems={showHeldItems}
          onOpenHeldItemModal={openHeldItemModal}
          onRemoveHeldItem={removeHeldItemFromArm}
          onResetHeldItemAdjustments={resetHeldItemAdjustments}
          onUpdateHeldItemAdjustment={updateHeldItemAdjustment}
          onUpdatePose={updatePose}
          onToggleHeldItems={(nextValue) => {
            updateDocument(activeDocumentId, (document) => ({
              ...document,
              showHeldItems: nextValue,
            }));
          }}
          onToggleOuterLayer={(nextValue) => {
            updateDocument(activeDocumentId, (document) => ({
              ...document,
              showOuterLayer: nextValue,
            }));
          }}
          onToggleOuterLayerIn3d={(nextValue) => {
            updateDocument(activeDocumentId, (document) => ({
              ...document,
              showOuterLayerIn3d: nextValue,
            }));
          }}
        />
      </main>

      <input
        ref={fileInputRef}
        className="hidden-input"
        type="file"
        accept=".png,image/png"
        onChange={handleFileChange}
      />

      <input
        ref={startupSkinInputRef}
        className="hidden-input"
        type="file"
        accept=".png,image/png"
        onChange={handleStartupSkinFileChange}
      />

      <input
        ref={poseFileInputRef}
        className="hidden-input"
        type="file"
        accept=".mcpose,application/json"
        onChange={(event) => {
          void handleOpenPoseFileChange(event);
        }}
      />

      <DocumentModal
        isOpen={isDocumentModalOpen}
        poseFileName={poseFileName}
        skinLabel={skin?.label ?? null}
        skinOrigin={skin?.origin ?? "none"}
        isRigModified={adjustedJointCount > 0}
        assetDetail={skin?.detail ?? null}
        activePoseLabel={activePoseLabel}
        avatarType={avatarType}
        modelLabel={currentModelLabel}
        selectedPreset={selectedPreset}
        username={username}
        uploadModel={uploadModel}
        isLoading={isLoading}
        onClose={closeDocumentModal}
        onPoseFileNameChange={handlePoseFileNameChange}
        onPoseFileNameBlur={handlePoseFileNameBlur}
        onUsernameChange={setUsername}
        onUsernameSubmit={handleUsernameSubmit}
        onQuickLoad={handleQuickLoad}
        onOpenFilePicker={handleOpenFilePicker}
        onAvatarTypeChange={handleAvatarTypeChange}
        onUploadModelChange={handleUploadModelChange}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        isExporting={isExporting}
        isPreviewLoading={isExportPreviewLoading}
        previewUrl={exportPreviewUrl}
        previewError={exportPreviewError}
        settings={exportSettings}
        onClose={closeExportModal}
        onDimensionChange={handleExportDimensionChange}
        onFileTypeChange={handleExportFileTypeChange}
        onBackgroundModeChange={handleExportBackgroundModeChange}
        onBackgroundColorChange={handleExportBackgroundColorChange}
        onExport={() => {
          void handleExport();
        }}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        isGeneratingProjectLink={isGeneratingProjectShareLink}
        isGeneratingImageLink={isGeneratingImageShareLink}
        projectLink={projectShareLink}
        imageLink={imageShareLink}
        projectError={projectShareError}
        imageError={imageShareError}
        imageOutputSummary={shareImageOutputSummary}
        onClose={closeShareModal}
        onGenerateProjectLink={() => {
          void handleGenerateProjectShareLink();
        }}
        onGenerateImageLink={() => {
          void handleGenerateImageShareLink();
        }}
        onCopyProjectLink={() => {
          void handleCopyProjectShareLink();
        }}
        onCopyImageLink={() => {
          void handleCopyImageShareLink();
        }}
      />

      <HelpContactModal
        kind={helpContactModalKind}
        onClose={closeHelpContactModal}
      />

      <HeldItemModal
        armId={heldItemModalArmId}
        currentItem={heldItemModalArmId ? heldItems[heldItemModalArmId] : null}
        isOpen={heldItemModalArmId !== null}
        onClose={closeHeldItemModal}
        onSelectPreset={handleHeldItemPresetSelect}
        onSelectUpload={handleHeldItemUploadSelect}
      />

      <StartupModal
        isOpen={isStartupModalOpen}
        isLoading={isLoading}
        onCreateNewFile={handleStartupCreateNewFile}
        onOpenPoseFile={handleOpenPoseFilePicker}
      />

      <NewFileModal
        isOpen={isNewFileModalOpen}
        startupFileName={startupFileName}
        startupUsername={startupUsername}
        startupAvatarType={startupAvatarType}
        isLoading={isLoading}
        uploadedSkinPreviewUrl={pendingNewFileUpload?.previewUrl ?? null}
        uploadedSkinName={pendingNewFileUpload?.fileName ?? null}
        uploadedSkinDetail={pendingNewFileUpload?.detail ?? null}
        onStartupFileNameChange={setStartupFileName}
        onStartupFileNameBlur={handleStartupFileNameBlur}
        onStartupUsernameChange={setStartupUsername}
        onStartupAvatarTypeChange={setStartupAvatarType}
        onClose={closeNewFileModal}
        onCreateUsername={() => createUsernamePoseFile()}
        onCreateUpload={createUploadedPoseFile}
        onOpenSkinUpload={handleOpenStartupSkinPicker}
        onQuickLoad={handleStartupQuickLoad}
      />
      </div>

      {shareLandingMode === "image" ? (
        <div className="shared-image-page">
          {sharedImageUrl ? (
            <div className="shared-image-frame">
              <img
                className="shared-image-page-image"
                src={sharedImageUrl}
                alt="Shared MC Poser export"
              />
            </div>
          ) : (
            <div className="shared-image-card">
              <h2>Shared Image Output</h2>
              <p className="panel-note">
                {sharedImageViewError
                  ? sharedImageViewError
                  : isSharedImageRendering
                    ? "Rendering shared image..."
                    : "Preparing shared image..."}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
