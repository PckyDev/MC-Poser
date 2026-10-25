import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import type { SkinViewer } from "skinview3d";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsUpDownLeftRight,
  faRotate,
  faPerson,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { SceneHierarchy } from "../SceneHierarchy";
import { SceneSettings } from "../SceneSettings";
import { SceneToolButton } from "../SceneToolButton";
import { SceneModelImport } from "../SceneModelImport";
import { AppearanceControls } from "../AppearanceControls";
import { RightSidebar } from "../editor/RightSidebar";
import { DocumentModal } from "../editor/DocumentModal";
import { HeldItemModal } from "../editor/HeldItemModal";
import { ArmCapTextureModal } from "../editor/ArmCapTextureModal";
import { createSceneRenderer, type SceneTool } from "../../lib/sceneRenderer";
import {
  selectedScenePart,
  createSceneAvatar,
  createSceneModel,
  MAX_SCENE_MODELS,
  defaultSceneCamera,
  MAX_SCENE_AVATARS,
  readSceneImage,
  type EditorScene,
  type SceneAvatar,
} from "../../lib/scene";
import {
  buildPresetHeldItem,
  createDefaultHeldItemAdjustments,
  createUploadedHeldItem,
} from "../../utils/heldItems";
import { applyArmCapTextureOffset } from "../../utils/armCapTextureMap";
import {
  getPoseBones,
  NEUTRAL_POSE,
  POSE_PRESETS,
  type PosePresetName,
} from "../../config/pose";
import type {
  AvatarType,
  HeldItem,
  HeldItemArmId,
  LoadedSkin,
  PoseSelection,
  SkinLookupResult,
  ArmCapTextureTarget,
} from "../../types/editor";
import type { ExportSettings } from "../editor/ExportModal";
import "./AdvancedEditor.css";

export type AdvancedEditorHandle = {
  export: (settings: ExportSettings) => Promise<Blob>;
  resetCamera: () => void;
  preset: (preset: PosePresetName | null) => void;
  getViewer: () => SkinViewer | null;
};
export function AdvancedEditor({
  scene,
  onChange,
  ref,
  resolveSkin,
  onError: reportError,
  documentOpen,
  onCloseDocument,
  poseFileName,
  onRename,
}: {
  scene: EditorScene;
  onChange: (scene: EditorScene, group?: string, skipHistory?: boolean) => void;
  ref: Ref<AdvancedEditorHandle>;
  resolveSkin: (username: string) => Promise<SkinLookupResult>;
  onError: (message: string) => void;
  documentOpen: boolean;
  onCloseDocument: () => void;
  poseFileName: string;
  onRename: (name: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    frame = useRef<HTMLDivElement>(null),
    space = useRef<HTMLDivElement>(null),
    skinInput = useRef<HTMLInputElement>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  const [auxiliary, setAuxiliary] = useState<"camera" | "grid" | "background">(
    "camera",
  );
  const addDialog = useRef<HTMLDivElement>(null);
  const runtime = useRef<ReturnType<typeof createSceneRenderer> | null>(null),
    latest = useRef({ scene, onChange, onError });
  latest.current = { scene, onChange, onError };
  const [selection, setSelection] = useState<PoseSelection>({ kind: "none" }),
    [tool, setTool] = useState<SceneTool>("move"),
    [pane, setPane] = useState<"avatar" | "camera">("avatar");
  useEffect(() => {
    if (pane === "camera" && auxiliary === "background" && !scene.background)
      setPane("avatar");
  }, [scene.background, pane, auxiliary]);
  const [ready, setReady] = useState(false),
    [localDocument, setLocalDocument] = useState(false),
    [addOpen, setAddOpen] = useState(false),
    [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false),
    [itemArm, setItemArm] = useState<HeldItemArmId | null>(null),
    [cap, setCap] = useState<{
      armId: HeldItemArmId;
      target: ArmCapTextureTarget;
    } | null>(null);
  const [error, setError] = useState("");
  const [modelImportOpen, setModelImportOpen] = useState(false);
  function onError(message: string) {
    setError(message);
    reportError(message);
  }
  const [addType, setAddType] = useState<AvatarType>("default");
  useEffect(() => {
    if (!addOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    addDialog.current
      ?.querySelector<HTMLInputElement>(
        'input[aria-label="New avatar username"]',
      )
      ?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [addOpen]);
  const avatar = scene.avatars.find((a) => a.id === scene.selectedId) ?? null;
  const model = scene.models.find((m) => m.id === scene.selectedId) ?? null;
  function patchObject(
    values: Partial<SceneAvatar>,
    group?: string,
    id = latest.current.scene.selectedId,
  ) {
    const current = latest.current.scene;
    if (!id) return;
    const object = [...current.avatars, ...current.models].find(
      (o) => o.id === id,
    );
    if (
      object?.locked &&
      Object.keys(values).some((key) => key !== "locked" && key !== "visible")
    )
      return;
    if (!current.models.some((m) => m.id === id)) {
      patchAvatar(values, group, id);
      return;
    }
    latest.current.onChange(
      {
        ...current,
        models: current.models.map((m) =>
          m.id === id ? { ...m, ...values } : m,
        ),
      },
      group ? `${id}:${group}` : undefined,
    );
  }
  function patchAvatar(
    values: Partial<SceneAvatar>,
    group?: string,
    id = latest.current.scene.selectedId,
  ) {
    const current = latest.current.scene;
    if (!id) return;
    const object = [...current.avatars, ...current.models].find(
      (o) => o.id === id,
    );
    if (
      object?.locked &&
      Object.keys(values).some((key) => key !== "locked" && key !== "visible")
    )
      return;
    const target = current.avatars.find((a) => a.id === id);
    if (target && values.pose) {
      const pose = { ...values.pose };
      for (const bone of getPoseBones(target.avatarType))
        if (target.parts?.[bone.id]?.locked)
          for (const field of bone.fields)
            pose[field.key] = target.pose[field.key];
      values = { ...values, pose };
    }
    if (target && values.heldItems) {
      const heldItems = { ...values.heldItems };
      for (const arm of ["leftArm", "rightArm"] as const)
        if (target.parts?.[arm]?.locked) heldItems[arm] = target.heldItems[arm];
      values = { ...values, heldItems };
    }
    onChange(
      {
        ...current,
        avatars: current.avatars.map((a) =>
          a.id === id ? { ...a, ...values } : a,
        ),
      },
      group ? `${id}:${group}` : undefined,
    );
  }
  function select(id: string | null, next: PoseSelection) {
    setSelection(next);
    if (next.kind !== "none") setTool("pose");
    else if (latest.current.scene.models.some((m) => m.id === id))
      setTool("move");
    setPane("avatar");
    onChange({ ...latest.current.scene, selectedId: id }, undefined, true);
  }
  useEffect(() => {
    const r = createSceneRenderer(canvas.current!, {
      onPick: select,
      onTransform: (id, values) => patchObject(values, undefined, id),
      onCamera: (camera) => {
        const current = latest.current.scene;
        latest.current.onChange({ ...current, camera }, "camera-orbit");
      },
      onError: (message) => latest.current.onError(message),
      onReady: () => setReady(true),
    });
    runtime.current = r;
    r.sync(latest.current.scene);
    return () => {
      r.dispose();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    runtime.current?.sync(scene);
  }, [scene]);
  useEffect(() => {
    runtime.current?.select(selection, tool);
  }, [selection, tool, scene.selectedId]);
  useEffect(() => {
    const resize = () => {
      const area = space.current,
        box = frame.current;
      if (!area || !box) return;
      const ratio = scene.frame.width / scene.frame.height;
      const w = Math.max(
        1,
        Math.min(area.clientWidth, area.clientHeight * ratio),
      );
      box.style.width = `${w}px`;
      box.style.height = `${w / ratio}px`;
      runtime.current?.resize(Math.round(w), Math.round(w / ratio));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(space.current!);
    resize();
    return () => observer.disconnect();
  }, [scene.frame.width, scene.frame.height]);
  useEffect(() => {
    setItemArm(null);
    setCap(null);
    if (scene.selectedId) setPane("avatar");
    if (
      latest.current.scene.models.some(
        (m) => m.id === latest.current.scene.selectedId,
      )
    ) {
      setSelection({ kind: "none" });
      setTool((current) => (current === "pose" ? "move" : current));
    }
  }, [scene.selectedId]);
  useImperativeHandle(ref, () => ({
    export: (settings) => runtime.current!.export(settings),
    getViewer: () => runtime.current?.viewer ?? null,
    resetCamera: () =>
      onChange({ ...latest.current.scene, camera: defaultSceneCamera() }),
    preset: (preset) =>
      patchAvatar(
        { pose: { ...(preset ? POSE_PRESETS[preset] : NEUTRAL_POSE) } },
        "preset",
      ),
  }));
  useEffect(() => {
    if (
      documentOpen &&
      !latest.current.scene.avatars.some(
        (a) => a.id === latest.current.scene.selectedId,
      )
    )
      select(latest.current.scene.avatars[0]!.id, { kind: "none" });
  }, [documentOpen]);
  function add(skin: LoadedSkin) {
    const current = latest.current.scene;
    if (current.avatars.length >= MAX_SCENE_AVATARS) {
      onError(`Scenes support up to ${MAX_SCENE_AVATARS} avatars.`);
      return;
    }
    const next = createSceneAvatar(skin, {
      avatarType: addType,
      position: [current.avatars.length * 1.5, 0, 0],
      showOuterLayerIn3d: addType === "stylized",
    });
    onChange({
      ...current,
      avatars: [...current.avatars, next],
      selectedId: next.id,
      appearance:
        addType === "stylized"
          ? { ...current.appearance, mode: "stylized" }
          : current.appearance,
    });
    setAddOpen(false);
    setSelection({ kind: "none" });
  }
  async function byName(adding: boolean, name = username) {
    setError("");
    setBusy(true);
    const targetId = latest.current.scene.selectedId;
    try {
      const result = await resolveSkin(name.trim());
      const skin: LoadedSkin = {
        source: result.textureUrl,
        label: result.username,
        origin: "username",
        detail: `UUID ${result.uuid}`,
        modelPreference: result.model,
      };
      if (adding) add(skin);
      else patchAvatar({ skin }, undefined, targetId);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Skin lookup failed.");
    } finally {
      setBusy(false);
    }
  }
  async function byFile(file: File | undefined, adding: boolean) {
    if (!file) return;
    setError("");
    setBusy(true);
    const targetId = latest.current.scene.selectedId;
    try {
      const source = await readSceneImage(file, true);
      const skin: LoadedSkin = {
        source,
        label: file.name.replace(/\.png$/i, ""),
        origin: "upload",
        detail: "Uploaded PNG",
        modelPreference: "auto-detect",
      };
      if (adding) add(skin);
      else patchAvatar({ skin }, undefined, targetId);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Skin import failed.");
    } finally {
      setBusy(false);
    }
  }
  function applyItem(item: HeldItem) {
    if (!avatar || !itemArm) return;
    patchAvatar({ heldItems: { ...avatar.heldItems, [itemArm]: item } });
    setItemArm(null);
  }
  const documentAvatar = avatar ?? scene.avatars[0]!;
  return (
    <main className="advanced-editor" aria-label="Advanced editor">
      <input
        hidden
        ref={backgroundInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Add scene background image"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || latest.current.scene.background) return;
          try {
            const source = await readSceneImage(file),
              image = await createImageBitmap(file);
            const width = image.width,
              height = image.height;
            image.close();
            if (latest.current.scene.background) return;
            const factor = Math.min(1, 4096 / Math.max(width, height));
            onChange({
              ...latest.current.scene,
              selectedId: null,
              background: {
                source,
                name: file.name,
                width,
                height,
                visible: true,
              },
              frame: {
                width: Math.max(64, Math.round(width * factor)),
                height: Math.max(64, Math.round(height * factor)),
              },
            });
            setPane("camera");
            setAuxiliary("background");
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : "Unable to read background.",
            );
          }
        }}
      />

      <SceneHierarchy
        scene={scene}
        selection={selection}
        onSelect={select}
        cameraSelected={pane === "camera" ? auxiliary : null}
        onRename={(id, name) => patchObject({ name }, undefined, id)}
        onSettings={(id) => {
          select(id, { kind: "none" });
          setUsername(scene.avatars.find((a) => a.id === id)?.skin.label ?? "");
          setLocalDocument(true);
        }}
        onBackground={() => backgroundInput.current?.click()}
        onPartChange={(id, part, changes) => {
          const a = scene.avatars.find((a) => a.id === id);
          if (!a) return;
          patchAvatar(
            {
              parts: {
                ...a.parts,
                [part]: {
                  visible: true,
                  locked: false,
                  ...a.parts?.[part],
                  ...changes,
                },
              },
            },
            undefined,
            id,
          );
        }}
        onLock={(id, locked) =>
          id === "camera"
            ? onChange({ ...scene, camera: { ...scene.camera, locked } })
            : patchObject({ locked }, undefined, id)
        }
        onCamera={(id) => {
          setAuxiliary(id as "camera" | "grid" | "background");
          setSelection({ kind: "none" });
          onChange({ ...scene, selectedId: null }, undefined, true);
          setPane("camera");
        }}
        onVisible={(id, visible) => {
          if (id === "grid") onChange({ ...scene, showGrid: visible });
          else if (id === "background" && scene.background)
            onChange({
              ...scene,
              background: { ...scene.background, visible },
            });
          else patchObject({ visible }, undefined, id);
        }}
        onAddModel={() => {
          if (scene.models.length >= MAX_SCENE_MODELS) {
            onError(`Scenes support up to ${MAX_SCENE_MODELS} Java models.`);
            return;
          }
          setModelImportOpen(true);
        }}
        onAdd={() => {
          setError("");
          setUsername("");
          setAddOpen(true);
        }}
        onDuplicate={(id) => {
          const model = scene.models.find((m) => m.id === id);
          const avatar = scene.avatars.find((a) => a.id === id);
          if (model) {
            if (scene.models.length >= MAX_SCENE_MODELS) {
              onError(`Scenes support up to ${MAX_SCENE_MODELS} Java models.`);
              return;
            }
            const copy = {
              ...model,
              locked: false,
              id: crypto.randomUUID(),
              name: `${model.name} copy`,
              position: [
                model.position[0] + 1.5,
                model.position[1],
                model.position[2],
              ] as [number, number, number],
            };
            onChange({
              ...scene,
              models: [...scene.models, copy],
              selectedId: copy.id,
            });
            return;
          }
          if (!avatar) return;
          if (scene.avatars.length >= MAX_SCENE_AVATARS) {
            onError(`Scenes support up to ${MAX_SCENE_AVATARS} avatars.`);
            return;
          }
          const copy = {
            ...avatar,
            locked: false,
            id: crypto.randomUUID(),
            name: `${avatar.name} copy`,
            position: [
              avatar.position[0] + 1.5,
              avatar.position[1],
              avatar.position[2],
            ] as [number, number, number],
          };
          onChange({
            ...scene,
            avatars: [...scene.avatars, copy],
            selectedId: copy.id,
          });
        }}
        onRemove={(id) => {
          if (id === "background") {
            onChange({ ...scene, background: null });
            return;
          }
          const model = scene.models.find((m) => m.id === id);
          if (
            [...scene.avatars, ...scene.models].find((o) => o.id === id)?.locked
          )
            return;
          if (model) {
            onChange({
              ...scene,
              models: scene.models.filter((m) => m.id !== model.id),
              selectedId: null,
            });
            return;
          }
          if (scene.avatars.length > 1)
            onChange({
              ...scene,
              avatars: scene.avatars.filter((a) => a.id !== id),
              selectedId: scene.avatars.find((a) => a.id !== id)!.id,
            });
        }}
      />
      <section className="viewport">
        {error ? (
          <div className="error-banner" role="alert">
            {error}
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss scene error"
              onClick={() => setError("")}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        ) : null}
        <div className="scene-toolbar" role="toolbar" aria-label="Scene tools">
          {(
            [
              {
                id: "move",
                label: "Move avatar",
                icon: faArrowsUpDownLeftRight,
              },
              { id: "rotate", label: "Rotate avatar", icon: faRotate },
              { id: "pose", label: "Pose avatar", icon: faPerson },
            ] as const
          ).map((t) => (
            <SceneToolButton
              icon={t.icon}
              label={
                model && t.id !== "pose"
                  ? t.label.replace("avatar", "model")
                  : t.label
              }
              key={t.id}
              aria-pressed={tool === t.id}
              disabled={t.id === "pose" && Boolean(model)}
              onClick={() => setTool(t.id)}
            />
          ))}
          <span className="camera-hint">
            {scene.camera.locked
              ? "Camera locked"
              : "Drag to orbit · right-drag to pan · scroll to zoom"}
          </span>
        </div>
        <div className="composition-space" ref={space}>
          <div className="composition-frame" ref={frame}>
            {scene.background?.visible ? (
              <img src={scene.background.source} alt="Scene background" />
            ) : null}
            <canvas ref={canvas} aria-label="Advanced scene viewport" />
            {!ready ? <div className="loading">Loading scene...</div> : null}
          </div>
        </div>
        <div className="scene-status">
          {scene.avatars.length}{" "}
          {scene.avatars.length === 1 ? "avatar" : "avatars"} ·{" "}
          {scene.models.length} {scene.models.length === 1 ? "model" : "models"}{" "}
          · {scene.frame.width} × {scene.frame.height} · Positions in Minecraft
          blocks
        </div>
      </section>
      <div className="inspector">
        <div className="panel-heading inspector-heading">
          <h2>Inspector</h2>
        </div>
        <fieldset
          className="object-inspector"
          disabled={
            pane === "avatar" &&
            Boolean(
              (model ?? avatar)?.locked ||
                (avatar &&
                  avatar.parts?.[selectedScenePart(avatar, selection)!]
                    ?.locked),
            )
          }
        >
          <div
            className={
              pane === "avatar" && avatar
                ? selection.kind === "none"
                  ? "settings-scroll"
                  : "settings-scroll empty"
                : "settings-scroll full"
            }
          >
            {(pane !== "avatar" || !avatar || selection.kind === "none") && (
              <SceneSettings
                mode={pane === "avatar" ? "avatar" : auxiliary}
                scene={scene}
                avatar={model ?? avatar}
                onChange={onChange}
                onAvatarChange={patchObject}
                onError={onError}
                onSettings={() => {
                  setUsername(avatar?.skin.label ?? "");
                  setLocalDocument(true);
                }}
              />
            )}
            {pane === "avatar" && model ? (
              <div className="model-appearance">
                <AppearanceControls
                  value={scene.appearance}
                  onChange={(appearance) =>
                    onChange({ ...scene, appearance }, "appearance")
                  }
                />
              </div>
            ) : null}
          </div>
          {pane === "avatar" && avatar ? (
            <RightSidebar
              appearance={scene.appearance}
              onAppearanceChange={(appearance) =>
                onChange({ ...scene, appearance }, "appearance")
              }
              avatarType={avatar.avatarType}
              heldItems={avatar.heldItems}
              isArmCapTextureMapAvailable={true}
              selectedSelection={selection}
              pose={avatar.pose}
              showOuterLayer={avatar.showOuterLayer}
              showOuterLayerIn3d={avatar.showOuterLayerIn3d}
              showHeldItems={avatar.showHeldItems}
              onOpenArmCapTextureModal={(armId, target) =>
                setCap({ armId, target })
              }
              onOpenHeldItemModal={setItemArm}
              onRemoveHeldItem={(arm) =>
                patchAvatar({ heldItems: { ...avatar.heldItems, [arm]: null } })
              }
              onResetHeldItemAdjustments={(arm) => {
                const item = avatar.heldItems[arm];
                if (item)
                  patchAvatar({
                    heldItems: {
                      ...avatar.heldItems,
                      [arm]: {
                        ...item,
                        adjustments: createDefaultHeldItemAdjustments(),
                      },
                    },
                  });
              }}
              onUpdateHeldItemAdjustment={(arm, key, value) => {
                const item = avatar.heldItems[arm];
                if (item)
                  patchAvatar(
                    {
                      heldItems: {
                        ...avatar.heldItems,
                        [arm]: {
                          ...item,
                          adjustments: { ...item.adjustments, [key]: value },
                        },
                      },
                    },
                    `item:${arm}:${key}`,
                  );
              }}
              onUpdatePose={(key, value) =>
                patchAvatar(
                  { pose: { ...avatar.pose, [key]: value } },
                  `pose:${key}`,
                )
              }
              onToggleHeldItems={(showHeldItems) =>
                patchAvatar({ showHeldItems })
              }
              onToggleOuterLayer={(showOuterLayer) =>
                patchAvatar({ showOuterLayer })
              }
              onToggleOuterLayerIn3d={(showOuterLayerIn3d) =>
                patchAvatar({ showOuterLayerIn3d })
              }
            />
          ) : null}
        </fieldset>
      </div>
      {modelImportOpen ? (
        <SceneModelImport
          onClose={() => setModelImportOpen(false)}
          onImport={(name, asset) => {
            const current = latest.current.scene;
            if (current.models.length >= MAX_SCENE_MODELS) {
              onError(`Scenes support up to ${MAX_SCENE_MODELS} Java models.`);
              return;
            }
            const next = createSceneModel(name, asset);
            next.position = [
              current.camera.target[0],
              0,
              current.camera.target[2],
            ];
            onChange({
              ...current,
              models: [...current.models, next],
              selectedId: next.id,
            });
            setSelection({ kind: "none" });
            setTool("move");
            setPane("avatar");
            setModelImportOpen(false);
          }}
        />
      ) : null}
      <DocumentModal
        initialPage={localDocument ? "avatar-type" : "pose-file"}
        isOpen={documentOpen || localDocument}
        poseFileName={poseFileName}
        skinLabel={documentAvatar.skin.label}
        skinOrigin={documentAvatar.skin.origin}
        isRigModified={true}
        assetDetail={documentAvatar.skin.detail}
        activePoseLabel={documentAvatar.name}
        avatarType={documentAvatar.avatarType}
        modelLabel={documentAvatar.skin.modelPreference}
        selectedPreset={null}
        username={username}
        uploadModel={documentAvatar.skin.modelPreference}
        isLoading={busy}
        onClose={() => {
          setLocalDocument(false);
          onCloseDocument();
        }}
        onPoseFileNameChange={onRename}
        onPoseFileNameBlur={() => onRename(poseFileName)}
        onUsernameChange={setUsername}
        onUsernameSubmit={(e) => {
          e.preventDefault();
          void byName(false);
        }}
        onQuickLoad={(name) => void byName(false, name)}
        onOpenFilePicker={() => skinInput.current?.click()}
        onAvatarTypeChange={(avatarType) => {
          if (documentAvatar.locked) return;
          const current = latest.current.scene;
          onChange({
            ...current,
            avatars: current.avatars.map((a) =>
              a.id === documentAvatar.id
                ? {
                    ...a,
                    avatarType,
                    ...(avatarType === "stylized"
                      ? { showOuterLayer: true, showOuterLayerIn3d: true }
                      : {}),
                  }
                : a,
            ),
            appearance:
              avatarType === "stylized"
                ? { ...current.appearance, mode: "stylized" }
                : current.appearance,
          });
        }}
        onUploadModelChange={(modelPreference) =>
          patchAvatar(
            { skin: { ...documentAvatar.skin, modelPreference } },
            undefined,
            documentAvatar.id,
          )
        }
      />
      <input
        ref={skinInput}
        type="file"
        className="hidden-input"
        accept=".png,image/png"
        onChange={(e) => {
          void byFile(e.target.files?.[0], false);
          e.target.value = "";
        }}
      />
      <HeldItemModal
        isOpen={Boolean(itemArm)}
        armId={itemArm}
        currentItem={avatar && itemArm ? avatar.heldItems[itemArm] : null}
        onClose={() => setItemArm(null)}
        onSelectPreset={(id) => applyItem(buildPresetHeldItem(id))}
        onSelectModel={applyItem}
        onSelectUpload={(file) => {
          void readSceneImage(file)
            .then((source) => applyItem(createUploadedHeldItem(file, source)))
            .catch((e) => onError(String(e)));
        }}
      />
      <ArmCapTextureModal
        isOpen={Boolean(cap && avatar)}
        armId={cap?.armId ?? null}
        target={cap?.target ?? null}
        currentOffsets={documentAvatar.advancedArmCapTextureOffsets}
        modelType={
          runtime.current?.avatars.get(documentAvatar.id)?.playerObject.skin
            .modelType ?? "default"
        }
        skinSource={
          runtime.current?.avatars
            .get(documentAvatar.id)
            ?.playerObject.skin.map?.image?.toDataURL?.() ??
          documentAvatar.skin.source
        }
        onClose={() => setCap(null)}
        onSave={(arm, target, offset) => {
          patchAvatar({
            advancedArmCapTextureOffsets: applyArmCapTextureOffset(
              documentAvatar.advancedArmCapTextureOffsets,
              arm,
              target,
              offset,
            ),
          });
          setCap(null);
        }}
      />
      {addOpen ? (
        <div className="document-overlay">
          <div
            className="add-dialog"
            ref={addDialog}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                event.preventDefault();
                if (!busy) setAddOpen(false);
              }
              if (event.key !== "Tab") return;
              const fields = Array.from(
                addDialog.current?.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
                ) ?? [],
              );
              const first = fields[0],
                last = fields.at(-1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-avatar-title"
          >
            <div className="dialog-heading">
              <h2 id="add-avatar-title">Add avatar</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close add avatar"
                disabled={busy}
                onClick={() => setAddOpen(false)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            {error ? <p role="alert">{error}</p> : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void byName(true);
              }}
            >
              <label>
                Minecraft username
                <input
                  aria-label="New avatar username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="toolbar-button"
                disabled={busy || !username.trim()}
              >
                Add by username
              </button>
            </form>
            <label>
              Or upload a skin
              <input
                aria-label="New avatar PNG"
                type="file"
                accept=".png,image/png"
                disabled={busy}
                onChange={(e) => {
                  void byFile(e.target.files?.[0], true);
                  e.target.value = "";
                }}
              />
            </label>
            <label>
              Avatar type
              <select
                aria-label="New avatar type"
                disabled={busy}
                value={addType}
                onChange={(e) => setAddType(e.target.value as AvatarType)}
              >
                {["default", "bobblehead", "advanced", "stylized"].map((t) => (
                  <option key={t} value={t}>
                    {t[0]!.toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            {busy ? <p>Loading skin...</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
