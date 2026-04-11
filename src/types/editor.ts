export type ModelPreference = "default" | "slim" | "auto-detect";
export type ArmModel = "default" | "slim";

export type PoseState = {
  headPitch: number;
  headYaw: number;
  bodyYaw: number;
  leftArmPitch: number;
  leftArmYaw: number;
  leftArmRoll: number;
  rightArmPitch: number;
  rightArmYaw: number;
  rightArmRoll: number;
  leftLegPitch: number;
  leftLegYaw: number;
  leftLegRoll: number;
  rightLegPitch: number;
  rightLegYaw: number;
  rightLegRoll: number;
};

export type PoseBoneId = "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";

export type PoseSelection =
  | { kind: "bone"; id: PoseBoneId }
  | { kind: "joint"; id: keyof PoseState };

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
