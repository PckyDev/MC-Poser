export type ModelPreference = "default" | "slim" | "auto-detect";
export type ArmModel = "default" | "slim";
export type AvatarType = "default" | "bobblehead" | "advanced";
export type HeldItemArmId = "leftArm" | "rightArm";
export type HeldItemPresetId =
  | "apple"
  | "book"
  | "diamond"
  | "diamondPickaxe"
  | "diamondSword";
export type HeldItemSourceKind = "preset" | "upload";

export type HeldItemAdjustments = {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
  thickness: number;
};

export type PoseState = {
  headPitch: number;
  headYaw: number;
  bodyPitch: number;
  bodyYaw: number;
  bodyRoll: number;
  leftArmPitch: number;
  leftArmYaw: number;
  leftArmRoll: number;
  leftElbowPitch: number;
  rightArmPitch: number;
  rightArmYaw: number;
  rightArmRoll: number;
  rightElbowPitch: number;
  leftLegPitch: number;
  leftLegYaw: number;
  leftLegRoll: number;
  leftKneePitch: number;
  rightLegPitch: number;
  rightLegYaw: number;
  rightLegRoll: number;
  rightKneePitch: number;
  spineBend: number;
  headRoll: number;
};

export type PoseBoneId = "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";

export type PoseSelection =
  | { kind: "bone"; id: PoseBoneId }
  | { kind: "joint"; id: keyof PoseState }
  | { kind: "heldItem"; id: HeldItemArmId };

export type HeldItem = {
  adjustments: HeldItemAdjustments;
  detail: string;
  label: string;
  presetId: HeldItemPresetId | null;
  source: string;
  sourceKind: HeldItemSourceKind;
};

export type HeldItemsState = {
  leftArm: HeldItem | null;
  rightArm: HeldItem | null;
};

export type LoadedSkin = {
  source: string;
  label: string;
  origin: "username" | "upload";
  detail: string;
  modelPreference: ModelPreference;
};

export type SkinLookupResult = {
  username: string;
  uuid: string;
  textureUrl: string;
  model: ArmModel;
};

export type PoseFieldConfig = {
  key: keyof PoseState;
  label: string;
  min: number;
  max: number;
};

export type PoseBoneConfig = {
  id: PoseBoneId;
  label: string;
  fields: PoseFieldConfig[];
};

export type PoseSectionConfig = {
  title: string;
  fields: PoseFieldConfig[];
};
