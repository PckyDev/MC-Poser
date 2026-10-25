import { SkinViewer } from "skinview3d";
import { validateExportSize } from "./exportSize";
import {
  Box3,
  BoxHelper,
  GridHelper,
  Color,
  Raycaster,
  Vector2,
  Vector3,
  type Object3D,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { createStylizedRenderer } from "./stylizedRenderer";
import {
  avatarNeedsRebuild,
  buildSceneAvatar,
  updateSceneAvatar,
  type SceneAvatarRuntime,
} from "./sceneAvatar";
import { getViewerTorsoJointRoot } from "../utils/editor";
import { getAdvancedAvatarJointObject } from "../utils/avatarRig";
import { getPoseBones } from "../config/pose";
import { selectedScenePart } from "./scene";
import type {
  EditorScene,
  SceneAvatar,
  SceneCamera,
  SceneModel,
  Triple,
} from "./scene";
import {
  buildSceneModel,
  updateSceneModel,
  type SceneModelRuntime,
} from "./sceneModel";
import type { PoseSelection, PoseState } from "../types/editor";
import type { ExportSettings } from "../components/editor/ExportModal";

export type SceneTool = "move" | "rotate" | "pose";
export function createSceneRenderer(
  canvas: HTMLCanvasElement,
  callbacks: {
    onPick: (id: string | null, selection: PoseSelection) => void;
    onTransform: (id: string, values: Partial<SceneAvatar>) => void;
    onCamera: (camera: SceneCamera) => void;
    onError: (message: string) => void;
    onReady: () => void;
  },
) {
  const viewer = new SkinViewer({
    canvas,
    preserveDrawingBuffer: true,
    renderPaused: true,
    enableControls: true,
    width: 800,
    height: 450,
    fov: 50,
  });
  viewer.playerObject.visible = false;
  viewer.controls.enableDamping = false;
  viewer.controls.enablePan = true;
  viewer.controls.minDistance = 2;
  viewer.controls.maxDistance = 16000;
  const studio = createStylizedRenderer(viewer),
    grid = new GridHelper(320, 20, 0x697380, 0x3c4550);
  viewer.scene.add(grid);
  const gizmo = new TransformControls(viewer.camera, canvas);
  gizmo.size = 0.85;
  viewer.scene.add(gizmo);
  let outline: BoxHelper | null = null,
    scene: EditorScene | null = null,
    selection: PoseSelection = { kind: "none" },
    tool: SceneTool = "move",
    disposed = false,
    applyingCamera = false,
    exporting = false;
  const avatars = new Map<string, SceneAvatarRuntime>(),
    requests = new Map<string, SceneAvatar>();
  const models = new Map<string, SceneModelRuntime>(),
    modelRequests = new Map<string, SceneModel>();
  const tasks = new Map<string, Promise<void>>(),
    failures = new Map<string, string>();
  let pending: Promise<void> = Promise.resolve();
  const render = () => {
    if (disposed) return;
    outline?.update();
    if (scene?.appearance.mode === "stylized") {
      const bounds = new Box3();
      for (const avatar of avatars.values())
        if (avatar.root.visible) bounds.expandByObject(avatar.root);
      for (const model of models.values())
        if (model.root.visible) bounds.expandByObject(model.root);
      studio.setSceneBounds(bounds);
    }
    studio.beforeRender();
    viewer.render();
  };
  const cameraSnapshot = (): SceneCamera => ({
    position: viewer.camera.position.toArray().map((v) => v / 16) as Triple,
    target: viewer.controls.target.toArray().map((v) => v / 16) as Triple,
    fov: viewer.camera.fov,
    roll: scene?.camera.roll ?? 0,
    locked: scene?.camera.locked ?? false,
  });
  const onControlsChange = () => {
    if (!exporting) render();
  };
  const onControlsEnd = () => {
    if (applyingCamera || exporting || !scene) return;
    const next = cameraSnapshot(),
      previous = scene.camera;
    const changed = [
      ...next.position,
      ...next.target,
      next.fov,
      next.roll,
    ].some(
      (v, i) =>
        Math.abs(
          v -
            [
              ...previous.position,
              ...previous.target,
              previous.fov,
              previous.roll,
            ][i]!,
        ) > 1e-7,
    );
    if (changed) callbacks.onCamera(next);
  };
  viewer.controls.addEventListener("change", onControlsChange);
  viewer.controls.addEventListener("end", onControlsEnd);
  function applyCamera(c: SceneCamera) {
    applyingCamera = true;
    viewer.camera.position.fromArray(c.position).multiplyScalar(16);
    viewer.controls.target.fromArray(c.target).multiplyScalar(16);
    if (
      viewer.camera.position.distanceToSquared(viewer.controls.target) < 0.001
    )
      viewer.camera.position.z += 0.1;
    viewer.camera.fov = c.fov;
    viewer.camera.zoom = 1;
    viewer.camera.up.set(0, 1, 0);
    viewer.camera.lookAt(viewer.controls.target);
    const direction = viewer.controls.target
      .clone()
      .sub(viewer.camera.position)
      .normalize();
    viewer.camera.up.applyAxisAngle(direction, (c.roll * Math.PI) / 180);
    viewer.camera.lookAt(viewer.controls.target);
    viewer.camera.updateProjectionMatrix();
    viewer.controls.enabled = !c.locked;
    viewer.controls.update();
    applyingCamera = false;
  }
  let binding: {
    object: Object3D;
    keys: (keyof PoseState)[];
    negative: boolean;
  } | null = null;
  function refreshSelection() {
    gizmo.detach();
    binding = null;
    if (outline) {
      outline.removeFromParent();
      outline.geometry.dispose();
      (outline.material as any).dispose();
      outline = null;
    }
    if (
      scene &&
      [...scene.avatars, ...scene.models].find(
        (o) => o.id === scene?.selectedId,
      )?.locked
    )
      return;
    const model = scene?.selectedId ? models.get(scene.selectedId) : null;
    if (model?.root.visible) {
      outline = new BoxHelper(model.root, 0xffad57);
      viewer.scene.add(outline);
      gizmo.setMode(tool === "rotate" ? "rotate" : "translate");
      gizmo.setSpace(tool === "rotate" ? "local" : "world");
      gizmo.showX = gizmo.showY = gizmo.showZ = true;
      gizmo.attach(model.root);
      return;
    }
    const entry = scene?.selectedId ? avatars.get(scene.selectedId) : null;
    if (!entry || !entry.root.visible) return;
    const part = selectedScenePart(entry.source, selection);
    if (
      tool === "pose" &&
      part &&
      (entry.source.parts?.[part]?.locked ||
        entry.source.parts?.[part]?.visible === false)
    )
      return;
    let object: Object3D = entry.root;
    if (tool === "pose" && selection.kind !== "none") {
      if (selection.kind === "heldItem")
        object =
          entry.root.getObjectByName(`${selection.id}-held-item-group`) ??
          entry.root;
      else {
        const bones = getPoseBones(entry.source.avatarType),
          selected = selection;
        const bone =
          selected.kind === "bone"
            ? bones.find((b) => b.id === selected.id)
            : bones.find((b) => b.fields.some((f) => f.key === selected.id));
        if (bone) {
          const keys =
            selection.kind === "joint"
              ? [selection.id]
              : bone.fields
                  .map((f) => f.key)
                  .filter(
                    (k) =>
                      !k.includes("Elbow") &&
                      !k.includes("Knee") &&
                      k !== "spineBend",
                  );
          const joint =
            selection.kind === "joint"
              ? getAdvancedAvatarJointObject(entry, selection.id)
              : null;
          object =
            joint ??
            (bone.id === "torso"
              ? getViewerTorsoJointRoot(entry)
              : entry.playerObject.skin[bone.id]);
          binding = {
            object,
            keys,
            negative:
              selection.kind === "joint" &&
              (selection.id.includes("Elbow") || selection.id === "spineBend"),
          };
        }
      }
    }
    outline = new BoxHelper(object, 0xffad57);
    viewer.scene.add(outline);
    if (tool !== "pose" || binding) {
      gizmo.setMode(tool === "move" ? "translate" : "rotate");
      gizmo.setSpace(tool === "move" ? "world" : "local");
      gizmo.showX = gizmo.showY = gizmo.showZ = true;
      if (binding && binding.keys.length === 1) {
        const key = binding.keys[0]!;
        gizmo.showX = !key.endsWith("Yaw") && !key.endsWith("Roll");
        gizmo.showY = key.endsWith("Yaw");
        gizmo.showZ = key.endsWith("Roll");
      }
      gizmo.attach(object);
    }
  }
  let suppressClick = false;
  gizmo.addEventListener("mouseDown", () => {
    suppressClick = true;
  });
  gizmo.addEventListener("objectChange", render);
  gizmo.addEventListener("dragging-changed", (event) => {
    const dragging = Boolean((event as { value?: boolean }).value);
    viewer.controls.enabled = !dragging && !scene?.camera.locked;
    if (dragging || !scene?.selectedId) return;
    const model = models.get(scene.selectedId);
    if (model) {
      callbacks.onTransform(model.source.id, {
        position: model.root.position.toArray().map((v) => v / 16) as Triple,
        rotation: [
          model.root.rotation.x,
          model.root.rotation.y,
          model.root.rotation.z,
        ].map((v) => (v * 180) / Math.PI) as Triple,
      });
      return;
    }
    const entry = avatars.get(scene.selectedId),
      avatar = scene.avatars.find((a) => a.id === scene!.selectedId);
    if (!entry || !avatar) return;
    if (binding) {
      const pose = { ...avatar.pose };
      for (const key of binding.keys) {
        const axis = key.endsWith("Yaw")
          ? "y"
          : key.endsWith("Roll")
            ? "z"
            : "x";
        pose[key] =
          ((binding.object.rotation[axis] * 180) / Math.PI) *
          (binding.negative ? -1 : 1);
      }
      callbacks.onTransform(avatar.id, { pose });
    } else
      callbacks.onTransform(avatar.id, {
        position: entry.root.position.toArray().map((v) => v / 16) as Triple,
        rotation: [
          entry.root.rotation.x,
          entry.root.rotation.y,
          entry.root.rotation.z,
        ].map((v) => (v * 180) / Math.PI) as Triple,
      });
  });
  let start: [number, number] | null = null,
    moved = false;
  const down = (e: PointerEvent) => {
    if (e.button === 0) {
      start = [e.clientX, e.clientY];
      moved = false;
    }
  };
  const move = (e: PointerEvent) => {
    if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 4)
      moved = true;
  };
  const up = () => {
    start = null;
  };
  const click = (e: MouseEvent) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (moved || !scene) return;
    const rect = canvas.getBoundingClientRect(),
      ray = new Raycaster();
    ray.setFromCamera(
      new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      viewer.camera,
    );
    const candidates: Object3D[] = [];
    for (const entry of avatars.values())
      if (!entry.source.locked)
        entry.root.traverseVisible((o) => {
          if (
            (o as any).isMesh &&
            !entry.source.parts?.[
              o.userData.scenePart as keyof SceneAvatar["parts"]
            ]?.locked
          )
            candidates.push(o);
        });
    for (const entry of models.values())
      if (!entry.source.locked)
        entry.root.traverseVisible((o) => {
          if ((o as any).isMesh) candidates.push(o);
        });
    const hit = ray.intersectObjects(candidates, false)[0]?.object;
    if (!hit) {
      callbacks.onPick(null, { kind: "none" });
      return;
    }
    for (let o: Object3D | null = hit; o; o = o.parent) {
      if (o.userData.sceneModelId) {
        callbacks.onPick(o.userData.sceneModelId, { kind: "none" });
        return;
      }
    }
    for (const [id, entry] of avatars) {
      let ancestor: Object3D | null = hit;
      while (ancestor && ancestor !== entry.root) ancestor = ancestor.parent;
      if (!ancestor) continue;
      // Walk from the hit upwards. Articulated arms/head are descendants of the
      // torso, so testing the torso first would swallow their selection.
      for (let o: Object3D | null = hit; o && o !== entry.root; o = o.parent) {
        const arm = ["leftArm", "rightArm"].find(
          (arm) => o!.name === `${arm}-held-item-group`,
        );
        if (arm) {
          callbacks.onPick(
            id,
            tool === "pose"
              ? { kind: "heldItem", id: arm as "leftArm" | "rightArm" }
              : { kind: "none" },
          );
          return;
        }
        const bone = getPoseBones(entry.source.avatarType).find(
          (bone) =>
            o ===
            entry.playerObject.skin[bone.id === "torso" ? "body" : bone.id],
        );
        if (bone) {
          callbacks.onPick(
            id,
            tool === "pose" ? { kind: "bone", id: bone.id } : { kind: "none" },
          );
          return;
        }
      }
      callbacks.onPick(id, { kind: "none" });
      return;
    }
  };
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  canvas.addEventListener("click", click);
  function sync(next: EditorScene) {
    const cameraChanged = scene?.camera !== next.camera;
    scene = next;
    if (cameraChanged) applyCamera(next.camera);
    grid.visible = next.showGrid;
    const gridColor = next.gridColor ?? null;
    if (grid.userData.color !== gridColor) {
      const colors = grid.geometry.getAttribute("color");
      grid.userData.defaultColors ??= colors.array.slice();
      if (gridColor) {
        const color = new Color(gridColor);
        for (let i = 0; i < colors.count; i++)
          colors.setXYZ(i, color.r, color.g, color.b);
      } else colors.array.set(grid.userData.defaultColors);
      colors.needsUpdate = true;
      grid.userData.color = gridColor;
    }
    studio.setAppearance(next.appearance);
    viewer.globalLight.intensity =
      next.appearance.mode === "stylized" ? 0.32 : 1;
    viewer.cameraLight.intensity = 0;
    for (const id of modelRequests.keys())
      if (!next.models.some((m) => m.id === id)) {
        modelRequests.delete(id);
        tasks.delete(id);
        failures.delete(id);
      }
    for (const [id, entry] of models)
      if (!next.models.some((m) => m.id === id)) {
        entry.dispose();
        models.delete(id);
        modelRequests.delete(id);
        tasks.delete(id);
        failures.delete(id);
      }
    const modelBuilds = next.models.map(async (model) => {
      const current = models.get(model.id);
      if (current && current.source.asset === model.asset) {
        modelRequests.delete(model.id);
        tasks.delete(model.id);
        failures.delete(model.id);
        updateSceneModel(current, model);
        current.setStylized(next.appearance.mode === "stylized");
        return;
      }
      if (
        modelRequests.get(model.id)?.asset === model.asset &&
        tasks.has(model.id)
      )
        return tasks.get(model.id);
      modelRequests.set(model.id, model);
      failures.delete(model.id);
      const task = (async () => {
        try {
          const runtime = await buildSceneModel(model);
          const latest = scene?.models.find((m) => m.id === model.id);
          if (disposed || modelRequests.get(model.id) !== model || !latest) {
            runtime.dispose();
            return;
          }
          models.get(model.id)?.dispose();
          models.set(model.id, runtime);
          viewer.scene.add(runtime.root);
          updateSceneModel(runtime, latest);
          runtime.setStylized(scene!.appearance.mode === "stylized");
          refreshSelection();
          render();
        } catch (e) {
          if (
            !disposed &&
            modelRequests.get(model.id) === model &&
            scene?.models.some((m) => m.id === model.id)
          ) {
            const message =
              e instanceof Error ? e.message : "Unable to build scene model.";
            failures.set(model.id, message);
            callbacks.onError(`${model.name}: ${message}`);
          }
        } finally {
          if (modelRequests.get(model.id) === model) tasks.delete(model.id);
        }
      })();
      tasks.set(model.id, task);
      return task;
    });
    for (const [id, entry] of avatars)
      if (!next.avatars.some((a) => a.id === id)) {
        entry.dispose();
        avatars.delete(id);
        requests.delete(id);
        tasks.delete(id);
        failures.delete(id);
      }
    const builds = next.avatars.map(async (avatar) => {
      const current = avatars.get(avatar.id);
      if (current && !avatarNeedsRebuild(current.source, avatar)) {
        // Undo may restore the currently displayed geometry while a replacement
        // is still loading. Invalidate that replacement before it can arrive.
        requests.delete(avatar.id);
        tasks.delete(avatar.id);
        failures.delete(avatar.id);
        current.source = avatar;
        updateSceneAvatar(current, avatar);
        current.setStylized(next.appearance.mode === "stylized");
        return;
      }
      const requested = requests.get(avatar.id);
      if (
        requested &&
        !avatarNeedsRebuild(requested, avatar) &&
        tasks.has(avatar.id)
      )
        return tasks.get(avatar.id);
      requests.set(avatar.id, avatar);
      failures.delete(avatar.id);
      const task = (async () => {
        try {
          const runtime = await buildSceneAvatar(avatar);
          if (
            disposed ||
            requests.get(avatar.id) !== avatar ||
            !scene?.avatars.some((a) => a.id === avatar.id)
          ) {
            runtime.dispose();
            return;
          }
          avatars.get(avatar.id)?.dispose();
          avatars.set(avatar.id, runtime);
          viewer.scene.add(runtime.root);
          const latest = scene.avatars.find((a) => a.id === avatar.id)!;
          runtime.source = latest;
          updateSceneAvatar(runtime, latest);
          runtime.setStylized(scene.appearance.mode === "stylized");
          refreshSelection();
          render();
        } catch (e) {
          if (!disposed && requests.get(avatar.id) === avatar) {
            const message =
              e instanceof Error ? e.message : "Unable to build scene avatar.";
            failures.set(avatar.id, message);
            callbacks.onError(`${avatar.name}: ${message}`);
          }
        } finally {
          if (requests.get(avatar.id) === avatar) tasks.delete(avatar.id);
        }
      })();
      tasks.set(avatar.id, task);
      return task;
    });
    pending = Promise.all([...builds, ...modelBuilds]).then(() => {
      if (!disposed) {
        refreshSelection();
        render();
        callbacks.onReady();
      }
    });
    refreshSelection();
    render();
  }
  return {
    viewer,
    avatars,
    models,
    sync,
    select(next: PoseSelection, nextTool: SceneTool) {
      selection = next;
      tool = nextTool;
      refreshSelection();
      render();
    },
    resize(width: number, height: number) {
      viewer.setSize(Math.max(1, width), Math.max(1, height));
      render();
    },
    async export(settings: ExportSettings) {
      validateExportSize(settings, viewer.renderer);
      await pending;
      if (!scene) throw new Error("Scene is not ready.");
      for (const model of scene.models)
        if (model.visible && (!models.has(model.id) || failures.has(model.id)))
          throw new Error(
            `Cannot export until ${model.name} has loaded successfully.`,
          );
      for (const avatar of scene.avatars)
        if (
          avatar.visible &&
          (!avatars.has(avatar.id) || failures.has(avatar.id))
        )
          throw new Error(
            `Cannot export until ${avatar.name} has loaded successfully.`,
          );
      const output = document.createElement("canvas");
      output.width = settings.width;
      output.height = settings.height;
      const ctx = output.getContext("2d");
      if (!ctx) throw new Error("Unable to create an export canvas at this size. Choose smaller dimensions.");
      if (settings.fileType === "jpg" || settings.backgroundMode === "solid") {
        ctx.fillStyle = settings.backgroundColor;
        ctx.fillRect(0, 0, output.width, output.height);
      }
      // Letterbox the saved composition. Never reframe individual avatars on export.
      const ratio = scene.frame.width / scene.frame.height,
        w = Math.min(output.width, output.height * ratio),
        h = w / ratio,
        x = (output.width - w) / 2,
        y = (output.height - h) / 2;
      if (scene.background?.visible) {
        const image = await loadBackground(scene.background.source);
        ctx.drawImage(image, x, y, w, h);
      }
      const oldSize = { w: viewer.width, h: viewer.height },
        gridVisible = grid.visible,
        outlineVisible = outline?.visible,
        gizmoVisible = gizmo.visible;
      try {
        exporting = true;
        grid.visible = false;
        if (outline) outline.visible = false;
        gizmo.visible = false;
        viewer.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
        render();
        ctx.drawImage(canvas, x, y, w, h);
      } finally {
        viewer.setSize(oldSize.w, oldSize.h);
        grid.visible = gridVisible;
        if (outline) outline.visible = Boolean(outlineVisible);
        gizmo.visible = gizmoVisible;
        exporting = false;
        render();
      }
      return new Promise<Blob>((resolve, reject) =>
        output.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Export failed."))),
          `image/${settings.fileType === "jpg" ? "jpeg" : settings.fileType}`,
          0.95,
        ),
      );
    },
    dispose() {
      disposed = true;
      requests.clear();
      modelRequests.clear();
      gizmo.detach();
      gizmo.dispose();
      outline?.geometry.dispose();
      if (outline) (outline.material as any).dispose();
      grid.geometry.dispose();
      for (const m of Array.isArray(grid.material)
        ? grid.material
        : [grid.material])
        m.dispose();
      for (const a of avatars.values()) a.dispose();
      avatars.clear();
      for (const model of models.values()) model.dispose();
      models.clear();
      studio.dispose();
      viewer.dispose();
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      canvas.removeEventListener("click", click);
    },
  };
}
function loadBackground(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load scene background."));
    image.src = source;
  });
}
