import type {
  AvatarType,
  PoseBoneConfig,
  PoseFieldConfig,
  PoseSelection,
  PoseState,
} from "../types/editor";

export const DEFAULT_USERNAME = "Notch";
export const QUICK_LOADS = ["Notch", "Technoblade", "Grian", "GoodTimesWithScar"] as const;

export const NEUTRAL_POSE: PoseState = {
  headPitch: 0,
  headYaw: 0,
  bodyPitch: 0,
  bodyYaw: 0,
  bodyRoll: 0,
  leftArmPitch: 0,
  leftArmYaw: 0,
  leftArmRoll: 0,
  leftElbowPitch: 0,
  rightArmPitch: 0,
  rightArmYaw: 0,
  rightArmRoll: 0,
  rightElbowPitch: 0,
  leftLegPitch: 0,
  leftLegYaw: 0,
  leftLegRoll: 0,
  leftKneePitch: 0,
  rightLegPitch: 0,
  rightLegYaw: 0,
  rightLegRoll: 0,
  rightKneePitch: 0,
  spineBend: 0,
};

export const POSE_PRESETS = {
  showcase: {
    headPitch: -6,
    headYaw: -12,
    bodyPitch: 0,
    bodyYaw: 10,
    bodyRoll: 0,
    leftArmPitch: -42,
    leftArmYaw: -8,
    leftArmRoll: -10,
    leftElbowPitch: 0,
    rightArmPitch: 32,
    rightArmYaw: 10,
    rightArmRoll: 18,
    rightElbowPitch: 0,
    leftLegPitch: 10,
    leftLegYaw: 2,
    leftLegRoll: 0,
    leftKneePitch: 0,
    rightLegPitch: -12,
    rightLegYaw: -2,
    rightLegRoll: 0,
    rightKneePitch: 0,
    spineBend: 0,
  },
  neutral: NEUTRAL_POSE,
  wave: {
    headPitch: -2,
    headYaw: 16,
    bodyPitch: 0,
    bodyYaw: -6,
    bodyRoll: 0,
    leftArmPitch: -10,
    leftArmYaw: 4,
    leftArmRoll: -8,
    leftElbowPitch: 0,
    rightArmPitch: -86,
    rightArmYaw: 0,
    rightArmRoll: 16,
    rightElbowPitch: 0,
    leftLegPitch: 4,
    leftLegYaw: 0,
    leftLegRoll: 0,
    leftKneePitch: 0,
    rightLegPitch: -4,
    rightLegYaw: 0,
    rightLegRoll: 0,
    rightKneePitch: 0,
    spineBend: 0,
  },
  stride: {
    headPitch: 4,
    headYaw: 0,
    bodyPitch: 0,
    bodyYaw: 0,
    bodyRoll: 0,
    leftArmPitch: 40,
    leftArmYaw: 0,
    leftArmRoll: -8,
    leftElbowPitch: 0,
    rightArmPitch: -40,
    rightArmYaw: 0,
    rightArmRoll: 8,
    rightElbowPitch: 0,
    leftLegPitch: -36,
    leftLegYaw: 0,
    leftLegRoll: 0,
    leftKneePitch: 0,
    rightLegPitch: 36,
    rightLegYaw: 0,
    rightLegRoll: 0,
    rightKneePitch: 0,
    spineBend: 0,
  },
} as const satisfies Record<string, PoseState>;

export type PosePresetName = keyof typeof POSE_PRESETS;

export const PRESET_NAMES = Object.keys(POSE_PRESETS) as PosePresetName[];

const HEAD_FIELDS: PoseFieldConfig[] = [
  { key: "headPitch", label: "Head pitch", min: -80, max: 80 },
  { key: "headYaw", label: "Head yaw", min: -90, max: 90 },
];

const TORSO_FIELDS: PoseFieldConfig[] = [
  { key: "bodyPitch", label: "Body pitch", min: -70, max: 70 },
  { key: "bodyYaw", label: "Body yaw", min: -50, max: 50 },
  { key: "spineBend", label: "Spine bend", min: -70, max: 70 },
];

const LEFT_ARM_FIELDS: PoseFieldConfig[] = [
  { key: "leftArmPitch", label: "Left arm pitch", min: -140, max: 140 },
  { key: "leftArmYaw", label: "Left arm yaw", min: -90, max: 90 },
  { key: "leftArmRoll", label: "Left arm roll", min: -90, max: 90 },
  { key: "leftElbowPitch", label: "Left elbow bend", min: 0, max: 150 },
];

const RIGHT_ARM_FIELDS: PoseFieldConfig[] = [
  { key: "rightArmPitch", label: "Right arm pitch", min: -140, max: 140 },
  { key: "rightArmYaw", label: "Right arm yaw", min: -90, max: 90 },
  { key: "rightArmRoll", label: "Right arm roll", min: -90, max: 90 },
  { key: "rightElbowPitch", label: "Right elbow bend", min: 0, max: 150 },
];

const LEFT_LEG_FIELDS: PoseFieldConfig[] = [
  { key: "leftLegPitch", label: "Left leg pitch", min: -90, max: 90 },
  { key: "leftLegYaw", label: "Left leg yaw", min: -40, max: 40 },
  { key: "leftLegRoll", label: "Left leg roll", min: -30, max: 30 },
  { key: "leftKneePitch", label: "Left knee bend", min: 0, max: 150 },
];

const RIGHT_LEG_FIELDS: PoseFieldConfig[] = [
  { key: "rightLegPitch", label: "Right leg pitch", min: -90, max: 90 },
  { key: "rightLegYaw", label: "Right leg yaw", min: -40, max: 40 },
  { key: "rightLegRoll", label: "Right leg roll", min: -30, max: 30 },
  { key: "rightKneePitch", label: "Right knee bend", min: 0, max: 150 },
];

const BASIC_TORSO_FIELDS = TORSO_FIELDS.filter((field) => field.key !== "spineBend");
const BASIC_LEFT_ARM_FIELDS = LEFT_ARM_FIELDS.filter((field) => field.key !== "leftElbowPitch");
const BASIC_RIGHT_ARM_FIELDS = RIGHT_ARM_FIELDS.filter((field) => field.key !== "rightElbowPitch");
const BASIC_LEFT_LEG_FIELDS = LEFT_LEG_FIELDS.filter((field) => field.key !== "leftKneePitch");
const BASIC_RIGHT_LEG_FIELDS = RIGHT_LEG_FIELDS.filter((field) => field.key !== "rightKneePitch");

export const POSE_BONES: PoseBoneConfig[] = [
  { id: "head", label: "Head", fields: HEAD_FIELDS },
  { id: "torso", label: "Torso", fields: TORSO_FIELDS },
  { id: "leftArm", label: "Left Arm", fields: LEFT_ARM_FIELDS },
  { id: "rightArm", label: "Right Arm", fields: RIGHT_ARM_FIELDS },
  { id: "leftLeg", label: "Left Leg", fields: LEFT_LEG_FIELDS },
  { id: "rightLeg", label: "Right Leg", fields: RIGHT_LEG_FIELDS },
];

export function getPoseBones(avatarType: AvatarType): PoseBoneConfig[] {
  if (avatarType === "advanced") {
    return POSE_BONES;
  }

  return [
    { id: "head", label: "Head", fields: HEAD_FIELDS },
    { id: "torso", label: "Torso", fields: BASIC_TORSO_FIELDS },
    { id: "leftArm", label: "Left Arm", fields: BASIC_LEFT_ARM_FIELDS },
    { id: "rightArm", label: "Right Arm", fields: BASIC_RIGHT_ARM_FIELDS },
    { id: "leftLeg", label: "Left Leg", fields: BASIC_LEFT_LEG_FIELDS },
    { id: "rightLeg", label: "Right Leg", fields: BASIC_RIGHT_LEG_FIELDS },
  ];
}

export const DEFAULT_POSE_SELECTION: PoseSelection = { kind: "bone", id: "head" };
