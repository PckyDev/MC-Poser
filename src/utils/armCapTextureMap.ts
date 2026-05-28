import type {
  ArmModel,
  AdvancedArmCapTextureOffsets,
  ArmCapTextureOffset,
  ArmCapTextureTarget,
  HeldItemArmId,
} from "../types/editor";

export type ArmCapTextureRegion = {
  u: number;
  v: number;
  width: number;
  height: number;
};

type ArmCapTextureOffsetBounds = {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
};

export type ArmCapTextureSelectionBounds = {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
};

export const SKIN_TEXTURE_GRID_SIZE = 64;

export const ARM_CAP_TEXTURE_TARGETS = ["upperBottom", "lowerTop"] as const satisfies readonly ArmCapTextureTarget[];

const DEFAULT_ADVANCED_ARM_CAP_TEXTURE_OFFSETS: AdvancedArmCapTextureOffsets = {
  leftArm: {
    upperBottom: { u: 0, v: 0 },
    lowerTop: { u: 0, v: 0 },
  },
  rightArm: {
    upperBottom: { u: 0, v: 0 },
    lowerTop: { u: 0, v: 0 },
  },
};

const ARM_CAP_TEXTURE_TARGET_LABELS: Record<ArmCapTextureTarget, string> = {
  upperBottom: "Bottom of top arm",
  lowerTop: "Top of bottom arm",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createDefaultAdvancedArmCapTextureOffsets(): AdvancedArmCapTextureOffsets {
  return cloneAdvancedArmCapTextureOffsets(DEFAULT_ADVANCED_ARM_CAP_TEXTURE_OFFSETS);
}

export function cloneAdvancedArmCapTextureOffsets(
  offsets: AdvancedArmCapTextureOffsets = DEFAULT_ADVANCED_ARM_CAP_TEXTURE_OFFSETS,
): AdvancedArmCapTextureOffsets {
  return {
    leftArm: {
      upperBottom: { ...offsets.leftArm.upperBottom },
      lowerTop: { ...offsets.leftArm.lowerTop },
    },
    rightArm: {
      upperBottom: { ...offsets.rightArm.upperBottom },
      lowerTop: { ...offsets.rightArm.lowerTop },
    },
  };
}

export function applyArmCapTextureOffset(
  offsets: AdvancedArmCapTextureOffsets,
  armId: HeldItemArmId,
  target: ArmCapTextureTarget,
  nextOffset: ArmCapTextureOffset,
): AdvancedArmCapTextureOffsets {
  const nextOffsets = cloneAdvancedArmCapTextureOffsets(offsets);

  nextOffsets[armId][target] = {
    u: Math.round(nextOffset.u),
    v: Math.round(nextOffset.v),
  };

  return nextOffsets;
}

export function getArmCapTextureTargetLabel(target: ArmCapTextureTarget): string {
  return ARM_CAP_TEXTURE_TARGET_LABELS[target];
}

export function getArmCapTextureBaseRegion(
  armId: HeldItemArmId,
  modelType: ArmModel,
  isOuter = false,
): ArmCapTextureRegion {
  const width = modelType === "slim" ? 3 : 4;

  if (armId === "leftArm") {
    const leftArmRegion = isOuter ? { u: 48, v: 48 } : { u: 32, v: 48 };

    return {
      u: leftArmRegion.u + 4,
      v: leftArmRegion.v,
      width,
      height: 4,
    };
  }

  const rightArmRegion = isOuter ? { u: 40, v: 32 } : { u: 40, v: 16 };

  return {
    u: rightArmRegion.u + 4,
    v: rightArmRegion.v,
    width,
    height: 4,
  };
}

function getArmCapTextureOffsetBounds(
  armId: HeldItemArmId,
  modelType: ArmModel,
): ArmCapTextureOffsetBounds {
  const baseRegion = getArmCapTextureBaseRegion(armId, modelType);

  return {
    minU: -baseRegion.u,
    maxU: SKIN_TEXTURE_GRID_SIZE - baseRegion.width - baseRegion.u,
    minV: -baseRegion.v,
    maxV: SKIN_TEXTURE_GRID_SIZE - baseRegion.height - baseRegion.v,
  };
}

export function getArmCapTextureSelectionBounds(
  armId: HeldItemArmId,
  modelType: ArmModel,
): ArmCapTextureSelectionBounds {
  const baseRegion = getArmCapTextureBaseRegion(armId, modelType);
  const bounds = getArmCapTextureOffsetBounds(armId, modelType);

  return {
    minU: baseRegion.u + bounds.minU,
    maxU: baseRegion.u + bounds.maxU,
    minV: baseRegion.v + bounds.minV,
    maxV: baseRegion.v + bounds.maxV,
  };
}

export function clampArmCapTextureOffset(
  armId: HeldItemArmId,
  modelType: ArmModel,
  offset: ArmCapTextureOffset,
): ArmCapTextureOffset {
  const bounds = getArmCapTextureOffsetBounds(armId, modelType);
  const clampedU = clamp(Math.round(offset.u), bounds.minU, bounds.maxU);
  const clampedV = clamp(Math.round(offset.v), bounds.minV, bounds.maxV);

  return {
    u: clampedU,
    v: clampedV,
  };
}

export function getArmCapTextureSelectionRect(
  armId: HeldItemArmId,
  modelType: ArmModel,
  offset: ArmCapTextureOffset,
): ArmCapTextureRegion {
  const baseRegion = getArmCapTextureBaseRegion(armId, modelType);
  const clampedOffset = clampArmCapTextureOffset(armId, modelType, offset);

  return {
    u: baseRegion.u + clampedOffset.u,
    v: baseRegion.v + clampedOffset.v,
    width: baseRegion.width,
    height: baseRegion.height,
  };
}

export function getArmCapTextureRegion(
  armId: HeldItemArmId,
  target: ArmCapTextureTarget,
  modelType: ArmModel,
  offsets: AdvancedArmCapTextureOffsets,
  _isOuter = false,
): ArmCapTextureRegion {
  return getArmCapTextureSelectionRect(armId, modelType, offsets[armId][target]);
}