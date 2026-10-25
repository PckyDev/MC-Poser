import {
  Mesh,
  MeshBasicMaterial,
  type Group,
  type Material,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import { createJavaItemGroup } from "./javaItemModel";
import {
  createStylizedMaterial,
  prepareStylizedGeometry,
} from "./stylizedRenderer";
import type { SceneModel } from "./scene";

export type SceneModelRuntime = {
  root: Group;
  source: SceneModel;
  dispose: () => void;
  setStylized: (value: boolean) => void;
};
export function updateSceneModel(
  runtime: SceneModelRuntime,
  model: SceneModel,
) {
  runtime.source = model;
  runtime.root.name = model.name;
  runtime.root.position.fromArray(model.position).multiplyScalar(16);
  runtime.root.rotation.set(
    ...(model.rotation.map((v) => (v * Math.PI) / 180) as [
      number,
      number,
      number,
    ]),
  );
  runtime.root.scale.setScalar(model.scale);
  runtime.root.visible = model.visible;
}
export async function buildSceneModel(
  model: SceneModel,
): Promise<SceneModelRuntime> {
  const root = await createJavaItemGroup(model.asset, false, false);
  root.userData.sceneModelId = model.id;
  const materials = new Set<Material>(),
    textures = new Set<Texture>();
  const variants = new Map<
    Mesh,
    { classic: Material[]; stylized: Material[] }
  >();
  const dispose = () => {
    root.removeFromParent();
    root.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };
  try {
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      prepareStylizedGeometry(o.geometry);
      const original = (
        Array.isArray(o.material) ? o.material : [o.material]
      ) as MeshStandardMaterial[];
      original.forEach((m) => {
        materials.add(m);
        if (m.map) textures.add(m.map);
      });
      const classic = original.map(
        (m) =>
          new MeshBasicMaterial({
            map: m.map,
            color: m.color,
            alphaTest: m.alphaTest,
            transparent: m.transparent,
            side: m.side,
          }),
      );
      const stylized = original.map((m) => createStylizedMaterial(m));
      [...classic, ...stylized].forEach((m) => materials.add(m));
      variants.set(o, { classic, stylized });
    });
    const runtime: SceneModelRuntime = {
      root,
      source: model,
      dispose,
      setStylized(value) {
        variants.forEach((v, mesh) => {
          mesh.material = value ? v.stylized : v.classic;
          mesh.castShadow = mesh.receiveShadow = value;
        });
      },
    };
    updateSceneModel(runtime, model);
    return runtime;
  } catch (error) {
    dispose();
    throw error;
  }
}
