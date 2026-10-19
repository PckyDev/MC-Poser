import type { SkinViewer as FullSkinViewer } from "skinview3d";
type SkinViewer = Pick<FullSkinViewer, "playerObject">;
import { Group, type Object3D } from "three";

import type { ArmModel, AvatarType, ModelPreference, PoseState } from "../types/editor";
import { applyAdvancedAvatarPose, syncAdvancedAvatarRig } from "./avatarRig";

const TORSO_JOINT_RIG_STATE_KEY = "__mcPoserTorsoJointRig";

type SkinPartObject = Object3D & {
  innerLayer: Object3D;
  outerLayer: Object3D;
};

type TorsoJointRigState = {
  root: Group;
};

const AVATAR_TYPE_DIMENSIONS: Record<
  AvatarType,
  {
    bodyScale: number;
    headScale: number;
  }
> = {
  default: {
    bodyScale: 1,
    headScale: 1,
  },
  bobblehead: {
    bodyScale: 0.72,
    headScale: 1.5,
  },
  advanced: {
    bodyScale: 1,
    headScale: 1,
  },
  stylized: { bodyScale: 1, headScale: 1.05 },
};

export function clonePose(pose: PoseState): PoseState {
  return { ...pose };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getSkinParts(viewer: SkinViewer): [
  SkinPartObject,
  SkinPartObject,
  SkinPartObject,
  SkinPartObject,
  SkinPartObject,
  SkinPartObject,
] {
  const skin = viewer.playerObject.skin;

  return [
    skin.head as SkinPartObject,
    skin.body as SkinPartObject,
    skin.leftArm as SkinPartObject,
    skin.rightArm as SkinPartObject,
    skin.leftLeg as SkinPartObject,
    skin.rightLeg as SkinPartObject,
  ];
}

function getStoredTorsoJointRig(viewer: SkinViewer): TorsoJointRigState | null {
  return (viewer.playerObject.skin.userData[TORSO_JOINT_RIG_STATE_KEY] as TorsoJointRigState | undefined) ?? null;
}

function ensureTorsoJointRig(viewer: SkinViewer): TorsoJointRigState {
  const skin = viewer.playerObject.skin;
  const storedState = getStoredTorsoJointRig(viewer);

  if (storedState?.root.parent === skin) {
    return storedState;
  }

  const torsoJointRoot = new Group();
  torsoJointRoot.name = "torso-joint-root";
  skin.add(torsoJointRoot);
  torsoJointRoot.add(skin.body, skin.head, skin.leftArm, skin.rightArm);

  const nextState = {
    root: torsoJointRoot,
  };

  skin.userData[TORSO_JOINT_RIG_STATE_KEY] = nextState;
  return nextState;
}

export function setViewerInnerLayerVisible(viewer: SkinViewer, isVisible: boolean): void {
  getSkinParts(viewer).forEach((part) => {
    part.innerLayer.visible = isVisible;
  });
}

export function setViewerOuterLayerVisible(viewer: SkinViewer, isVisible: boolean): void {
  getSkinParts(viewer).forEach((part) => {
    part.outerLayer.visible = isVisible;
  });
}

export function getViewerTorsoJointRoot(viewer: SkinViewer): Object3D {
  return ensureTorsoJointRig(viewer).root;
}

export function applyPose(viewer: SkinViewer, pose: PoseState): void {
  const torsoJointRig = ensureTorsoJointRig(viewer);

  torsoJointRig.root.rotation.set(
    toRadians(pose.bodyPitch),
    toRadians(pose.bodyYaw),
    toRadians(pose.bodyRoll),
  );

  if (applyAdvancedAvatarPose(viewer, pose)) {
    return;
  }

  const skin = viewer.playerObject.skin;

  skin.body.rotation.set(0, 0, 0);
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
}

export function applyAvatarType(viewer: SkinViewer, avatarType: AvatarType): void {
  const skin = viewer.playerObject.skin;
  const torsoJointRig = ensureTorsoJointRig(viewer);
  const { bodyScale, headScale } = AVATAR_TYPE_DIMENSIONS[avatarType];
  syncAdvancedAvatarRig(viewer, avatarType === "advanced" || avatarType === "stylized");

  torsoJointRig.root.rotation.set(0, 0, 0);
  torsoJointRig.root.position.set(0, -12 * bodyScale, 0);

  skin.head.scale.setScalar(headScale);
  skin.body.scale.setScalar(bodyScale);
  skin.leftArm.scale.setScalar(bodyScale);
  skin.rightArm.scale.setScalar(bodyScale);
  skin.leftLeg.scale.setScalar(bodyScale);
  skin.rightLeg.scale.setScalar(bodyScale);

  skin.head.position.set(0, 12 * bodyScale, 0);
  skin.body.position.set(0, 6 * bodyScale, 0);
  skin.leftArm.position.set(5 * bodyScale, 10 * bodyScale, 0);
  skin.rightArm.position.set(-5 * bodyScale, 10 * bodyScale, 0);
  skin.leftLeg.position.set(1.9 * bodyScale, -12 * bodyScale, -0.1 * bodyScale);
  skin.rightLeg.position.set(-1.9 * bodyScale, -12 * bodyScale, -0.1 * bodyScale);

  if (avatarType === "advanced" || avatarType === "stylized") {
    skin.body.position.set(0, 6 * bodyScale, 0);
    skin.head.position.set(0, 6 * bodyScale, 0);
    skin.leftArm.position.set(5 * bodyScale, 4 * bodyScale, 0);
    skin.rightArm.position.set(-5 * bodyScale, 4 * bodyScale, 0);
  }
  if (avatarType === "stylized") {
    // Head and arms inherit the torso scale through the articulated spine.
    skin.body.scale.set(0.98, 1, 1.04);
    skin.head.scale.set(1.05 / 0.98, 1.05, 1.05 / 1.04);
    skin.leftArm.scale.set(1.08 / 0.98, 1, 1.08 / 1.04);
    skin.rightArm.scale.copy(skin.leftArm.scale);
    skin.leftArm.position.x = 5.05;
    skin.rightArm.position.x = -5.05;
    skin.leftLeg.scale.set(1.04, 1, 1.08);
    skin.rightLeg.scale.copy(skin.leftLeg.scale);
    skin.leftLeg.position.x = 2.25;
    skin.rightLeg.position.x = -2.25;
  }
}

export function formatPresetName(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatAvatarTypeLabel(value: AvatarType): string {
  if (value === "stylized") return "Stylized";
  if (value === "bobblehead") {
    return "Bobblehead";
  }

  if (value === "advanced") {
    return "Advanced";
  }

  return "Default";
}

export function formatModelLabel(
  modelPreference: ModelPreference,
  resolvedModel: ArmModel | null,
): string {
  if (modelPreference === "auto-detect") {
    return resolvedModel === null
      ? "Auto-detect arms"
      : `${resolvedModel === "slim" ? "Slim" : "Classic"} arms (auto)`;
  }

  return `${modelPreference === "slim" ? "Slim" : "Classic"} arms`;
}

export function buildDownloadName(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "mc-poser"}-pose`;
}

export function normalizePoseFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = cleaned || "untitled-pose";

  return base.endsWith(".mcpose") ? base : `${base}.mcpose`;
}

export function buildSuggestedPoseName(index: number): string {
  return `untitled-pose-${String(index).padStart(2, "0")}.mcpose`;
}

export function countAdjustedJoints(pose: PoseState): number {
  return Object.values(pose).filter((value) => value !== 0).length;
}
