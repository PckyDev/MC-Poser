import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowPointer } from "@fortawesome/free-solid-svg-icons";
import { CollapsiblePanel } from "../CollapsiblePanel";
import { useRef } from "react";
import { SceneNumberInput } from "../SceneNumberInput";
import {
  defaultSceneCamera,
  readSceneImage,
  type EditorScene,
  type SceneAvatar,
  type SceneObject,
  type Triple,
} from "../../lib/scene";
import "./SceneSettings.css";

export function SceneSettings({
  scene,
  avatar,
  mode,
  onChange,
  onAvatarChange,
  onError,
}: {
  scene: EditorScene;
  avatar: SceneObject | null;
  mode: "avatar" | "camera" | "grid" | "background";
  onChange: (scene: EditorScene, group?: string) => void;
  onAvatarChange: (values: Partial<SceneAvatar>, group?: string) => void;
  onError: (message: string) => void;
}) {
  const latest = useRef(scene);
  const isModel = avatar !== null && "asset" in avatar;
  const backgroundRequest = useRef(0);
  latest.current = scene;
  const vector = (
    label: string,
    value: Triple,
    change: (v: Triple) => void,
    step = 0.1,
  ) => (
    <fieldset>
      <legend title={label}>{mode === "avatar" ? label.split(" (")[0] : label}</legend>
      <div className="vector">
        {["X", "Y", "Z"].map((axis, i) => (
          <label key={axis}>
            {axis}
            <SceneNumberInput
              aria-label={`${label} ${axis}`}
              step={step}
              value={Number(value[i]!.toFixed(3))}
              onChange={(e) => {
                if (!Number.isFinite(e.target.valueAsNumber)) return;
                const next = [...value] as Triple;
                next[i] = Math.max(
                  -10000,
                  Math.min(10000, e.target.valueAsNumber),
                );
                change(next);
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
  async function background(file?: File) {
    if (!file) return;
    const request = ++backgroundRequest.current;
    try {
      const source = await readSceneImage(file);
      const image = await createImageBitmap(file);
      if (request !== backgroundRequest.current) {
        image.close();
        return;
      }
      const factor = Math.min(1, 4096 / Math.max(image.width, image.height));
      onChange({
        ...latest.current,
        background: {
          source,
          name: file.name,
          width: image.width,
          height: image.height,
          visible: true,
        },
        frame: {
          width: Math.max(64, Math.round(image.width * factor)),
          height: Math.max(64, Math.round(image.height * factor)),
        },
      });
      image.close();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Unable to read background.");
    }
  }
  return (
    <div className={`scene-settings ${mode === "avatar" && !avatar ? "is-empty" : ""}`}>
      {mode === "avatar" ? (
        avatar ? (
          <>
            {isModel && (
              <label>
                Model name
                <input
                  aria-label="Model name"
                  value={avatar.name}
                  maxLength={100}
                  onChange={(e) =>
                    onAvatarChange({ name: e.target.value }, "avatar-name")
                  }
                />
              </label>
            )}
            <CollapsiblePanel title="Transform" storageKey="transform">
              <div className="transform-fields">
                {vector("Position (blocks)", avatar.position, (position) =>
                  onAvatarChange({ position }, "position"),
                )}
                {vector(
                  "Rotation (degrees)",
                  avatar.rotation,
                  (rotation) => onAvatarChange({ rotation }, "rotation"),
                  1,
                )}
                <label>
                  Scale
                  <SceneNumberInput
                    aria-label={isModel ? "Model scale" : "Avatar scale"}
                    min={0.05}
                    max={20}
                    step={0.05}
                    value={avatar.scale}
                    onChange={(e) => {
                      if (Number.isFinite(e.target.valueAsNumber))
                        onAvatarChange(
                          {
                            scale: Math.min(
                              20,
                              Math.max(0.05, e.target.valueAsNumber),
                            ),
                          },
                          "scale",
                        );
                    }}
                  />
                </label>
              </div>
            </CollapsiblePanel>
          </>
        ) : (
          <div className="empty-state">
            <FontAwesomeIcon icon={faArrowPointer} aria-hidden="true" />
            <p>Select an object in the scene or hierarchy to inspect its options.</p>
          </div>
        )
      ) : (
        <>
          {mode === "camera" && (
            <>
              <h3>Scene camera</h3>
              <p>
                Match the screenshot with field of view, camera height and
                angle. Lock the camera once aligned, then move the avatars into
                place.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={scene.camera.locked}
                  onChange={(e) =>
                    onChange({
                      ...scene,
                      camera: { ...scene.camera, locked: e.target.checked },
                    })
                  }
                />{" "}
                Lock camera
              </label>
              {vector("Camera position", scene.camera.position, (position) =>
                onChange(
                  { ...scene, camera: { ...scene.camera, position } },
                  "camera-position",
                ),
              )}
              {vector("Look at", scene.camera.target, (target) =>
                onChange(
                  { ...scene, camera: { ...scene.camera, target } },
                  "camera-target",
                ),
              )}
              <label>
                Vertical field of view
                <SceneNumberInput
                  aria-label="Vertical field of view"
                  min={10}
                  max={120}
                  value={scene.camera.fov}
                  onChange={(e) => {
                    if (Number.isFinite(e.target.valueAsNumber))
                      onChange(
                        {
                          ...scene,
                          camera: {
                            ...scene.camera,
                            fov: Math.min(
                              120,
                              Math.max(10, e.target.valueAsNumber),
                            ),
                          },
                        },
                        "fov",
                      );
                  }}
                />
              </label>
              <label>
                Camera roll
                <SceneNumberInput
                  aria-label="Camera roll"
                  min={-180}
                  max={180}
                  value={scene.camera.roll}
                  onChange={(e) => {
                    if (Number.isFinite(e.target.valueAsNumber))
                      onChange(
                        {
                          ...scene,
                          camera: {
                            ...scene.camera,
                            roll: Math.min(
                              180,
                              Math.max(-180, e.target.valueAsNumber),
                            ),
                          },
                        },
                        "roll",
                      );
                  }}
                />
              </label>
              <button
                type="button"
                className="toolbar-button"
                onClick={() =>
                  onChange({ ...scene, camera: defaultSceneCamera() })
                }
              >
                Reset scene camera
              </button>
            </>
          )}
          {mode === "grid" && (
            <>
              <h3>Perspective grid</h3>
              <label className="grid-visibility">
                <span>Show perspective grid</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="grid-toggle"
                  checked={scene.showGrid}
                  onChange={(e) =>
                    onChange({ ...scene, showGrid: e.target.checked })
                  }
                />
              </label>
              <label className="grid-color">
                <span>Grid color</span>
                <input
                  type="color"
                  aria-label="Grid color"
                  value={scene.gridColor ?? "#3c4550"}
                  onChange={(e) =>
                    onChange(
                      { ...scene, gridColor: e.target.value },
                      "grid-color",
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="toolbar-button"
                disabled={!scene.gridColor}
                onClick={() => onChange({ ...scene, gridColor: null })}
              >
                Reset grid color
              </button>
            </>
          )}
          {mode === "background" && (
            <>
              <h3>Scene background</h3>
              <label>
                Background image
                <input
                  aria-label="Background image"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    void background(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {scene.background ? (
                <>
                  <span className="filename">{scene.background.name}</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={scene.background.visible}
                      onChange={(e) =>
                        onChange({
                          ...scene,
                          background: {
                            ...scene.background!,
                            visible: e.target.checked,
                          },
                        })
                      }
                    />{" "}
                    Show background
                  </label>
                  <button
                    type="button"
                    className="toolbar-button"
                    onClick={() => onChange({ ...scene, background: null })}
                  >
                    Remove background
                  </button>
                </>
              ) : null}
            </>
          )}
          {mode === "camera" && (
            <fieldset>
              <legend>Composition size</legend>
              <div className="vector">
                {["width", "height"].map((key) => (
                  <label key={key}>
                    {key}
                    <SceneNumberInput
                      min={64}
                      max={4096}
                      aria-label={`Composition ${key}`}
                      value={scene.frame[key as "width" | "height"]}
                      onChange={(e) => {
                        if (Number.isFinite(e.target.valueAsNumber))
                          onChange(
                            {
                              ...scene,
                              frame: {
                                ...scene.frame,
                                [key]: Math.round(
                                  Math.min(
                                    4096,
                                    Math.max(64, e.target.valueAsNumber),
                                  ),
                                ),
                              },
                            },
                            "frame",
                          );
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {mode === "background" && (
            <p>
              The image is a flat backdrop. Perspective is matched manually; it
              does not automatically hide avatars behind objects in the
              screenshot.
            </p>
          )}
        </>
      )}
    </div>
  );
}
