import { PlayerObject } from "skinview3d";
import { inferModelType, loadImage, loadSkinToCanvas } from "skinview-utils";
import {
  CanvasTexture,
  Box3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  type Material,
  type Texture,
} from "three";
import {
  applyAvatarType,
  applyPose,
  setViewerOuterLayerVisible,
} from "../utils/editor";
import {
  getAdvancedAvatarHandAnchor,
  setAdvancedArmCapTextureOffsets,
  setAdvancedAvatarOuterLayerVisibility,
} from "../utils/avatarRig";
import { createHeldItemVoxelGeometry } from "../utils/heldItems";
import { createJavaItemGroup } from "./javaItemModel";
import {
  createOuterLayerVoxelGeometry,
  getTexturePixelSource,
} from "./skinVoxels";
import {
  createStylizedMaterial,
  prepareStylizedGeometry,
} from "./stylizedRenderer";
import { syncStylizedAvatarGeometry } from "./stylizedAvatar";
import type { SceneAvatar } from "./scene";
import type { PoseBoneId } from "../types/editor";
import { NEUTRAL_POSE, getPoseBones } from "../config/pose";

export type SceneAvatarRuntime = {
  root: Group;
  playerObject: PlayerObject;
  source: SceneAvatar;
  dispose: () => void;
  setStylized: (value: boolean) => void;
};
export function avatarNeedsRebuild(a: SceneAvatar, b: SceneAvatar): boolean {
  return (
    a.skin.source !== b.skin.source ||
    a.skin.modelPreference !== b.skin.modelPreference ||
    a.avatarType !== b.avatarType ||
    a.heldItems !== b.heldItems ||
    a.advancedArmCapTextureOffsets !== b.advancedArmCapTextureOffsets ||
    a.showHeldItems !== b.showHeldItems ||
    a.showOuterLayer !== b.showOuterLayer ||
    a.showOuterLayerIn3d !== b.showOuterLayerIn3d
  );
}
export function updateSceneAvatar(
  runtime: SceneAvatarRuntime,
  avatar: SceneAvatar,
) {
  runtime.root.position.fromArray(avatar.position).multiplyScalar(16);
  runtime.root.rotation.set(
    ...(avatar.rotation.map((v) => (v * Math.PI) / 180) as [
      number,
      number,
      number,
    ]),
  );
  runtime.root.scale.setScalar(avatar.scale);
  runtime.root.visible = avatar.visible;
  applyPose(runtime, avatar.pose);
  runtime.root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const part = o.userData.scenePart as PoseBoneId | undefined;
    if (part)
      o.visible =
        o.userData.scenePartVisible && avatar.parts?.[part]?.visible !== false;
  });
}
export async function buildSceneAvatar(
  avatar: SceneAvatar,
): Promise<SceneAvatarRuntime> {
  const playerObject = new PlayerObject(),
    root = new Group();
  root.name = avatar.name;
  root.userData.sceneAvatarId = avatar.id;
  playerObject.position.y = 0;
  playerObject.cape.visible = false;
  playerObject.elytra.visible = false;
  playerObject.ears.visible = false;
  root.add(playerObject);
  const view = { playerObject };
  const materials = new Set<Material>(),
    textures = new Set<Texture>();
  const variants = new Map<
    Mesh,
    { classic: Material | Material[]; stylized: Material | Material[] }
  >();
  const dispose = () => {
    root.removeFromParent();
    root.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
  };
  try {
    const canvas = document.createElement("canvas");
    loadSkinToCanvas(canvas, await loadImage(avatar.skin.source));
    const texture = new CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = NearestFilter;
    textures.add(texture);
    playerObject.skin.map = texture;
    playerObject.skin.modelType =
      avatar.skin.modelPreference === "auto-detect"
        ? inferModelType(canvas)
        : avatar.skin.modelPreference;
    playerObject.skin.visible = true;
    setAdvancedArmCapTextureOffsets(view, avatar.advancedArmCapTextureOffsets);
    applyAvatarType(view, avatar.avatarType);
    // Use the rig's neutral foot level, including SkinObject's built-in offset.
    // Position zero should stand on the scene grid, not float above it.
    applyPose(view, NEUTRAL_POSE);
    playerObject.updateMatrixWorld(true);
    playerObject.position.y = -new Box3().setFromObject(
      playerObject.skin.leftLeg.innerLayer,
    ).min.y;
    applyPose(view, avatar.pose);
    const advanced =
      avatar.avatarType === "advanced" || avatar.avatarType === "stylized";
    if (advanced)
      setAdvancedAvatarOuterLayerVisibility(
        view,
        avatar.showOuterLayer,
        avatar.showOuterLayerIn3d,
      );
    else {
      setViewerOuterLayerVisible(
        view,
        avatar.showOuterLayer && !avatar.showOuterLayerIn3d,
      );
      const pixels = getTexturePixelSource(texture)!;
      if (avatar.showOuterLayer && avatar.showOuterLayerIn3d)
        for (const id of [
          "head",
          "torso",
          "leftArm",
          "rightArm",
          "leftLeg",
          "rightLeg",
        ] as PoseBoneId[]) {
          const outer =
            playerObject.skin[id === "torso" ? "body" : id].outerLayer;
          const geometry = createOuterLayerVoxelGeometry(
            id,
            playerObject.skin.modelType,
            pixels,
          );
          if (!geometry) continue;
          const mesh = new Mesh(
            geometry,
            new MeshStandardMaterial({
              vertexColors: true,
              transparent: true,
              alphaTest: 1 / 255,
              roughness: 1,
            }),
          );
          mesh.position.copy(outer.position);
          mesh.quaternion.copy(outer.quaternion);
          mesh.name = `${id}-outer-voxel`;
          outer.parent!.add(mesh);
        }
    }
    for (const arm of ["leftArm", "rightArm"] as const) {
      const item = avatar.heldItems[arm];
      if (!item) continue;
      const sign = arm === "leftArm" ? 1 : -1,
        a = item.adjustments;
      let group: Group;
      if (item.sourceKind === "java" && item.javaModel) {
        group = await createJavaItemGroup(item.javaModel, arm === "leftArm");
        group.position.set(
          advanced
            ? 0
            : sign * (playerObject.skin.modelType === "slim" ? 0.5 : 1),
          advanced ? -4 : -8,
          2,
        );
        group.position.x += sign * a.offsetX;
        group.position.y += a.offsetY;
        group.position.z += a.offsetZ;
        group.rotation.set(-Math.PI / 2, Math.PI, 0, "YXZ");
        group.rotateX((a.rotationX * Math.PI) / 180);
        group.rotateY((a.rotationY * Math.PI) / 180);
        group.rotateZ((a.rotationZ * Math.PI) / 180);
        group.scale.setScalar(a.scale);
      } else {
        const geometry = await createHeldItemVoxelGeometry(
          item.source,
          a.thickness,
        );
        if (!geometry) continue;
        group = new Group();
        group.add(
          new Mesh(
            geometry,
            new MeshStandardMaterial({
              vertexColors: true,
              transparent: true,
              alphaTest: 1 / 255,
              roughness: 1,
              flatShading: true,
            }),
          ),
        );
        group.position.set(
          sign *
            ((playerObject.skin.modelType === "slim" ? 0.55 : 0.75) +
              a.offsetX),
          -6.45 + a.offsetY,
          5.35 + a.offsetZ,
        );
        group.rotation.set(
          Math.PI / 4 + (a.rotationX * Math.PI) / 180,
          (arm === "leftArm" ? Math.PI : 0) +
            (sign * Math.PI) / 2 +
            (a.rotationY * Math.PI) / 180,
          sign * 0.22 + (a.rotationZ * Math.PI) / 180,
        );
        group.scale.setScalar(0.68 * a.scale);
      }
      group.name = `${arm}-held-item-group`;
      group.visible = avatar.showHeldItems;
      (advanced
        ? getAdvancedAvatarHandAnchor(view, arm)!
        : playerObject.skin[arm]
      ).add(group);
    }
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (
        let ancestor = o.parent;
        ancestor && ancestor !== root;
        ancestor = ancestor.parent
      ) {
        const bone = getPoseBones(avatar.avatarType).find(
          (b) =>
            ancestor === playerObject.skin[b.id === "torso" ? "body" : b.id],
        );
        if (bone) {
          o.userData.scenePart = bone.id;
          o.userData.scenePartVisible = o.visible;
          break;
        }
      }
      syncStylizedAvatarGeometry(o, avatar.avatarType === "stylized");
      prepareStylizedGeometry(o.geometry);
      const original = Array.isArray(o.material) ? o.material : [o.material];
      const classic = original.map((m) => {
        const s = m as MeshStandardMaterial;
        materials.add(m);
        if (s.map) textures.add(s.map);
        const c = new MeshBasicMaterial({
          map: s.map,
          color: s.color,
          vertexColors: s.vertexColors,
          transparent: s.transparent,
          opacity: s.opacity,
          alphaTest: s.alphaTest,
          side: s.side,
          depthWrite: s.depthWrite,
        });
        materials.add(c);
        return c;
      });
      const stylized = original.map((m) => {
        const s = createStylizedMaterial(m);
        materials.add(s);
        return s;
      });
      variants.set(o, {
        classic: Array.isArray(o.material) ? classic : classic[0]!,
        stylized: Array.isArray(o.material) ? stylized : stylized[0]!,
      });
    });
    const runtime: SceneAvatarRuntime = {
      root,
      playerObject,
      source: avatar,
      dispose,
      setStylized(value) {
        variants.forEach((v, m) => {
          m.material = value ? v.stylized : v.classic;
          m.castShadow = m.receiveShadow = value;
        });
      },
    };
    updateSceneAvatar(runtime, avatar);
    return runtime;
  } catch (e) {
    dispose();
    throw e;
  }
}
