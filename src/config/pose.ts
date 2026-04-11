import type { PoseBoneConfig, PoseFieldConfig, PoseSelection, PoseState } from "../types/editor";

export const DEFAULT_USERNAME = "Notch";
export const QUICK_LOADS = ["Notch", "Technoblade", "Grian", "GoodTimesWithScar"] as const;

export const NEUTRAL_POSE: PoseState = {
  headPitch: 0,
  headYaw: 0,
  bodyYaw: 0,
  leftArmPitch: 0,
  leftArmYaw: 0,
  leftArmRoll: 0,
  rightArmPitch: 0,
  rightArmYaw: 0,
  rightArmRoll: 0,
  leftLegPitch: 0,
  leftLegYaw: 0,
  leftLegRoll: 0,
  rightLegPitch: 0,
  rightLegYaw: 0,
  rightLegRoll: 0,
};

export const POSE_PRESETS = {
  showcase: {
    headPitch: -6,
    headYaw: -12,
    bodyYaw: 10,
    leftArmPitch: -42,
    leftArmYaw: -8,
    leftArmRoll: -10,
    rightArmPitch: 32,
    rightArmYaw: 10,
    rightArmRoll: 18,
    leftLegPitch: 10,
    leftLegYaw: 2,
    leftLegRoll: 0,
    rightLegPitch: -12,
    rightLegYaw: -2,
    rightLegRoll: 0,
  },
  neutral: NEUTRAL_POSE,
  wave: {
    headPitch: -2,
    headYaw: 16,
    bodyYaw: -6,
    leftArmPitch: -10,
    leftArmYaw: 4,
    leftArmRoll: -8,
    rightArmPitch: -86,
    rightArmYaw: 0,
    rightArmRoll: 16,
    leftLegPitch: 4,
    leftLegYaw: 0,
    leftLegRoll: 0,
    rightLegPitch: -4,
    rightLegYaw: 0,
    rightLegRoll: 0,
  },
  stride: {
    headPitch: 4,
    headYaw: 0,
    bodyYaw: 0,
    leftArmPitch: 40,
    leftArmYaw: 0,
    leftArmRoll: -8,
    rightArmPitch: -40,
    rightArmYaw: 0,
    rightArmRoll: 8,
    leftLegPitch: -36,
    leftLegYaw: 0,
    leftLegRoll: 0,
    rightLegPitch: 36,
    rightLegYaw: 0,
    rightLegRoll: 0,
  },
} as const satisfies Record<string, PoseState>;

export type PosePresetName = keyof typeof POSE_PRESETS;

export const PRESET_NAMES = Object.keys(POSE_PRESETS) as PosePresetName[];

const HEAD_FIELDS: PoseFieldConfig[] = [
  { key: "headPitch", label: "Head pitch", min: -80, max: 80 },
  { key: "headYaw", label: "Head yaw", min: -90, max: 90 },
];

const TORSO_FIELDS: PoseFieldConfig[] = [
  { key: "bodyYaw", label: "Body yaw", min: -50, max: 50 },
];

const LEFT_ARM_FIELDS: PoseFieldConfig[] = [
  { key: "leftArmPitch", label: "Left arm pitch", min: -140, max: 140 },
  { key: "leftArmYaw", label: "Left arm yaw", min: -90, max: 90 },
  { key: "leftArmRoll", label: "Left arm roll", min: -90, max: 90 },
];

const RIGHT_ARM_FIELDS: PoseFieldConfig[] = [
  { key: "rightArmPitch", label: "Right arm pitch", min: -140, max: 140 },
  { key: "rightArmYaw", label: "Right arm yaw", min: -90, max: 90 },
  { key: "rightArmRoll", label: "Right arm roll", min: -90, max: 90 },
];

const LEFT_LEG_FIELDS: PoseFieldConfig[] = [
  { key: "leftLegPitch", label: "Left leg pitch", min: -90, max: 90 },
  { key: "leftLegYaw", label: "Left leg yaw", min: -40, max: 40 },
  { key: "leftLegRoll", label: "Left leg roll", min: -30, max: 30 },
];

const RIGHT_LEG_FIELDS: PoseFieldConfig[] = [
  { key: "rightLegPitch", label: "Right leg pitch", min: -90, max: 90 },
  { key: "rightLegYaw", label: "Right leg yaw", min: -40, max: 40 },
  { key: "rightLegRoll", label: "Right leg roll", min: -30, max: 30 },
];

export const POSE_BONES: PoseBoneConfig[] = [
  { id: "head", label: "Head", fields: HEAD_FIELDS },
  { id: "torso", label: "Torso", fields: TORSO_FIELDS },
  { id: "leftArm", label: "Left Arm", fields: LEFT_ARM_FIELDS },
  { id: "rightArm", label: "Right Arm", fields: RIGHT_ARM_FIELDS },
  { id: "leftLeg", label: "Left Leg", fields: LEFT_LEG_FIELDS },
  { id: "rightLeg", label: "Right Leg", fields: RIGHT_LEG_FIELDS },
];

export const DEFAULT_POSE_SELECTION: PoseSelection = { kind: "bone", id: "head" };
