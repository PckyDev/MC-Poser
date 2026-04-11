import type { SkinViewer } from "skinview3d";

import type { ArmModel, AvatarType, ModelPreference, PoseState } from "../types/editor";
import { applyAdvancedAvatarPose, syncAdvancedAvatarRig } from "./avatarRig";

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
};

export function clonePose(pose: PoseState): PoseState {
  return { ...pose };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function applyPose(viewer: SkinViewer, pose: PoseState): void {
  if (applyAdvancedAvatarPose(viewer, pose)) {
    return;
  }

  const skin = viewer.playerObject.skin;

  skin.head.rotation.set(toRadians(pose.headPitch), toRadians(pose.headYaw), 0);
  skin.body.rotation.set(0, toRadians(pose.bodyYaw), 0);
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
  syncAdvancedAvatarRig(viewer, avatarType === "advanced");

  const skin = viewer.playerObject.skin;
  const { bodyScale, headScale } = AVATAR_TYPE_DIMENSIONS[avatarType];

  skin.head.scale.setScalar(headScale);
  skin.body.scale.setScalar(bodyScale);
  skin.leftArm.scale.setScalar(bodyScale);
  skin.rightArm.scale.setScalar(bodyScale);
  skin.leftLeg.scale.setScalar(bodyScale);
  skin.rightLeg.scale.setScalar(bodyScale);

  skin.head.position.set(0, 0, 0);
  skin.body.position.set(0, -6 * bodyScale, 0);
  skin.leftArm.position.set(5 * bodyScale, -2 * bodyScale, 0);
  skin.rightArm.position.set(-5 * bodyScale, -2 * bodyScale, 0);
  skin.leftLeg.position.set(1.9 * bodyScale, -12 * bodyScale, -0.1 * bodyScale);
  skin.rightLeg.position.set(-1.9 * bodyScale, -12 * bodyScale, -0.1 * bodyScale);

  if (avatarType === "advanced") {
    skin.body.position.set(0, -6 * bodyScale, 0);
    skin.head.position.set(0, 6 * bodyScale, 0);
    skin.leftArm.position.set(5 * bodyScale, 6 * bodyScale, 0);
    skin.rightArm.position.set(-5 * bodyScale, 6 * bodyScale, 0);
  }
}

export function formatPresetName(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatAvatarTypeLabel(value: AvatarType): string {
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
