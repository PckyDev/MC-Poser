import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";

async function setup(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined }),
  );
  await page.route("**/src/lib/sceneRenderer.ts*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "viewer.playerObject.visible = false;",
        "window.__sceneViewer = viewer; viewer.playerObject.visible = false;",
      ),
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create New File", exact: true }),
  ).toBeVisible();
  const images = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4f9ec4";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#e7bc96";
    ctx.fillRect(0, 0, 32, 16);
    ctx.fillStyle = "#243f68";
    ctx.fillRect(0, 20, 16, 12);
    ctx.fillRect(16, 52, 16, 12);
    const skin = c.toDataURL();
    c.width = 640;
    c.height = 360;
    ctx.fillStyle = "#658dc1";
    ctx.fillRect(0, 0, 640, 180);
    ctx.fillStyle = "#4e814c";
    ctx.fillRect(0, 180, 640, 180);
    return { skin, background: c.toDataURL() };
  });
  return { ...images, errors };
}
const file = (name: string, png: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(png.split(",")[1]!, "base64"),
});
async function create(page: Page, skin: string) {
  await page
    .getByRole("button", { name: "Create New File", exact: true })
    .click();
  await page.getByRole("tab", { name: "Upload PNG", exact: true }).click();
  await page
    .locator('input[accept=".png,image/png"]')
    .nth(1)
    .setInputFiles(file("TestSkin.png", skin));
  await page.getByRole("button", { name: /^Advanced editor / }).click();
  await page.getByRole("button", { name: "Create From Uploaded PNG" }).click();
  await expect(
    page.getByRole("main", { name: "Advanced editor" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        let n = 0;
        (window as any).__sceneViewer?.scene.traverse((o: any) => {
          if (o.userData.sceneAvatarId) n++;
        });
        return n;
      }),
    )
    .toBe(1);
}
async function save(page: Page) {
  await page.getByRole("button", { name: "File", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8"));
}

test("Add avatars from uploads and usernames, hide them, and download complete diagnostics", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  await page.route("**/api/skin?username=SceneTest", (route) =>
    route.fulfill({
      json: {
        username: "SceneTest",
        uuid: "test-uuid",
        textureUrl: skin,
        model: "slim",
      },
    }),
  );
  await page.getByRole("button", { name: "Add avatar", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Add avatar", exact: true });
  await modal.getByLabel("New avatar PNG").setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid"),
  });
  await expect(modal.getByRole("alert")).toBeVisible();
  await modal.getByLabel("New avatar type").selectOption("stylized");
  await modal
    .getByLabel("New avatar PNG")
    .setInputFiles(file("Second.png", skin));
  await expect(modal).toHaveCount(0);
  const editor = page.getByRole("main", { name: "Advanced editor" });
  await expect(
    editor.getByRole("combobox", { name: "Render style", exact: true }),
  ).toHaveValue("stylized");
  await expect(
    editor.getByLabel("3D outer layer", { exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Add avatar", exact: true }).click();
  await modal.getByLabel("New avatar username").fill("SceneTest");
  await modal.getByRole("button", { name: "Add by username" }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("treeitem")).toHaveCount(3);
  await page.getByLabel("Show Second", { exact: true }).uncheck();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const roots = (window as any).__sceneViewer.scene.children.filter(
          (o: any) => o.userData.sceneAvatarId,
        );
        return roots.length === 3
          ? roots.filter((o: any) => o.visible).length
          : -1;
      }),
    )
    .toBe(2);
  await page
    .getByRole("button", { name: "Collapse SceneTest", exact: true })
    .click();
  await expect(
    page.getByRole("treeitem", { name: "SceneTest", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("button", { name: "Expand SceneTest", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Head pitch", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page
    .getByRole("button", { name: "Download Diagnostics", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download JSON", exact: true })
    .click();
  const report = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(report.workspace.scene.avatars).toHaveLength(3);
  expect(
    report.workspace.scene.avatars.every((a: any) => a.skin.source === skin),
  ).toBe(true);
  expect(report.workspace.scene.avatars[2].skin.modelPreference).toBe("slim");
  expect(report.warnings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Scene transform gizmos work with camera lock, picking and empty-space deselection", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  const viewport = page.getByLabel("Advanced scene viewport", { exact: true });
  await page.getByRole("button", { name: "Scene camera", exact: true }).click();
  await page.getByLabel("Lock camera", { exact: true }).check();
  await page.getByRole("tab", { name: "Avatar", exact: true }).click();
  // Project a point on the real translation handle, then drive native pointer events.
  const handle = await page.evaluate(() => {
    const v = (window as any).__sceneViewer,
      g = v.scene.children.find((o: any) => o.isTransformControls);
    v.scene.updateMatrixWorld(true);
    const arrow = g.children[0].gizmo.translate.children.find(
      (o: any) => o.name === "X" && o.isMesh,
    );
    arrow.geometry.computeBoundingBox();
    const p = arrow.geometry.boundingBox.getCenter(arrow.position.clone());
    arrow.localToWorld(p);
    p.project(v.camera);
    const b = v.canvas.getBoundingClientRect();
    return {
      x: b.x + ((p.x + 1) * b.width) / 2,
      y: b.y + ((1 - p.y) * b.height) / 2,
    };
  });
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 55, handle.y, { steps: 12 });
  await page.mouse.up();
  await expect(
    page.getByLabel("Position (blocks) X", { exact: true }),
  ).not.toHaveValue("0");
  const moved = await save(page);
  expect(Math.abs(moved.scene.avatars[0].position[0])).toBeGreaterThan(0.1);
  expect(moved.scene.camera.locked).toBe(true);
  await viewport.click({ position: { x: 15, y: 15 } });
  await expect(
    page.getByText("Select an avatar in the hierarchy or canvas."),
  ).toBeVisible();
  await page.getByRole("button", { name: "TestSkin", exact: true }).click();
  await page
    .getByRole("button", { name: "Rotate avatar", exact: true })
    .click();
  expect(
    await page.evaluate(() => {
      const v = (window as any).__sceneViewer;
      return v.scene.children.find((o: any) => o.isTransformControls).mode;
    }),
  ).toBe("rotate");
  await page.getByRole("button", { name: "Head pitch", exact: true }).click();
  expect(
    await page.evaluate(() => {
      const v = (window as any).__sceneViewer,
        g = v.scene.children.find((o: any) => o.isTransformControls);
      return { mode: g.mode, axis: [g.showX, g.showY, g.showZ] };
    }),
  ).toEqual({ mode: "rotate", axis: [true, false, false] });
  await page.getByRole("button", { name: "Scene camera", exact: true }).click();
  await page.getByLabel("Lock camera", { exact: true }).uncheck();
  const before = (await save(page)).scene.camera.position;
  const box = (await viewport.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  expect((await save(page)).scene.camera.position).not.toEqual(before);
  expect((await save(page)).scene.selectedId).toBe(moved.scene.selectedId);
  expect(errors).toEqual([]);
});

test("Scene validation rejects unsafe backgrounds and duplicate IDs and clamps camera inputs", async ({
  page,
}) => {
  const { skin } = await setup(page);
  const result = await page.evaluate(async (skin) => {
    // @ts-expect-error Served directly by Vite in browser tests.
    const lib = await import("/src/lib/scene.ts");
    const avatar = lib.createSceneAvatar({
      source: skin,
      label: "Test",
      origin: "upload",
      modelPreference: "default",
    });
    const original = lib.createEditorScene(avatar),
      failures = [];
    for (const raw of [
      { ...original, avatars: [] },
      { ...original, avatars: [avatar, avatar] },
      { ...original, avatars: Array(13).fill(avatar) },
      {
        ...original,
        background: { source: "https://example.com/private.png" },
      },
    ]) {
      try {
        lib.normalizeEditorScene(raw, (a: any) => a);
        failures.push(false);
      } catch {
        failures.push(true);
      }
    }
    const valid = lib.normalizeEditorScene(
      {
        ...original,
        camera: {
          position: [NaN, Infinity, 0],
          target: [0, 0, 0],
          fov: 300,
          roll: 999,
        },
        frame: { width: 90000, height: -1 },
      },
      (a: any) => a,
    );
    return { failures, camera: valid.camera, frame: valid.frame };
  }, skin);
  expect(result.failures).toEqual([true, true, true, true]);
  expect(result.camera.fov).toBe(120);
  expect(result.camera.roll).toBe(180);
  expect(result.camera.position.every(Number.isFinite)).toBe(true);
  expect(result.frame).toEqual({ width: 4096, height: 64 });
});

test("Scene-only files export without a legacy primary avatar", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  const data = await save(page);
  data.skin = null;
  await page
    .locator('input[accept=".mcpose,application/json"]')
    .setInputFiles({
      name: "scene-only.mcpose",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await expect(
    page.getByRole("button", { name: "Export", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByAltText("Export preview", { exact: true }),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Image", exact: true }).click();
  expect(
    (await readFile((await (await pending).path())!)).length,
  ).toBeGreaterThan(5000);
  expect(errors).toEqual([]);
});

test("Undo cancels a delayed avatar rebuild and resting feet meet the grid", async ({
  page,
}) => {
  const { skin } = await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/delayed-skin.png", async (route) => {
    await held;
    await route.fulfill({
      contentType: "image/png",
      body: file("skin.png", skin).buffer,
    });
  });
  const request = page.waitForRequest("**/delayed-skin.png");
  await page.evaluate(async (skin) => {
    // @ts-expect-error Served by Vite for tests.
    const lib = await import("/src/lib/scene.ts");
    // @ts-expect-error Served by Vite for tests.
    const { createSceneRenderer } = await import("/src/lib/sceneRenderer.ts");
    const c = document.createElement("canvas");
    document.body.append(c);
    const r = createSceneRenderer(c, {
      onPick() {},
      onTransform() {},
      onCamera() {},
      onError() {},
      onReady() {},
    });
    const a = lib.createSceneAvatar({
        source: skin,
        label: "Original",
        origin: "upload",
        modelPreference: "default",
      }),
      scene = lib.createEditorScene(a);
    const settings = {
      width: 128,
      height: 128,
      fileType: "png",
      backgroundMode: "transparent",
      backgroundColor: "#fff",
    };
    r.sync(scene);
    await r.export(settings);
    (window as any).__pendingSceneTest = { r, c, scene, settings };
    r.sync({
      ...scene,
      avatars: [
        {
          ...a,
          avatarType: "stylized",
          skin: { ...a.skin, source: "/delayed-skin.png" },
        },
      ],
    });
    r.sync(scene);
  }, skin);
  await request;
  release();
  await page.waitForResponse("**/delayed-skin.png");
  const result = await page.evaluate(async () => {
    const { r, c, scene, settings } = (window as any).__pendingSceneTest;
    // Wait for image decoding and the canceled loader's completion before probing.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await r.export(settings);
    const entry = r.avatars.get(scene.avatars[0].id);
    entry.root.updateMatrixWorld(true);
    const mesh =
      entry.playerObject.skin.leftLeg.innerLayer.children[0] ??
      entry.playerObject.skin.leftLeg.innerLayer;
    mesh.geometry.computeBoundingBox();
    const p = mesh.position.clone().set(0, mesh.geometry.boundingBox.min.y, 0);
    mesh.localToWorld(p);
    const result = {
      type: entry.source.avatarType,
      skin: entry.source.skin.source,
      footY: p.y,
    };
    r.dispose();
    c.remove();
    return result;
  });
  expect(result.type).toBe("default");
  expect(result.skin).toBe(skin);
  expect(result.footY).toBeCloseTo(0, 5);
});

for (const avatarType of ["default", "bobblehead", "advanced", "stylized"])
  test(`Scene ${avatarType}: modern/HD/legacy skins, arm models, layers, styles and both item formats`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    const { skin, errors } = await setup(page);
    const result = await page.evaluate(
      async ({ skin, avatarType }) => {
        // @ts-expect-error Served directly by Vite.
        const lib = await import("/src/lib/scene.ts");
        // @ts-expect-error Served directly by Vite.
        const render = await import("/src/lib/sceneRenderer.ts");
        // @ts-expect-error Served directly by Vite.
        const items = await import("/src/utils/heldItems.ts");
        // @ts-expect-error Served directly by Vite.
        const java = await import("/src/lib/javaItemModel.ts");
        const input = await createImageBitmap(await (await fetch(skin)).blob()),
          texture = document.createElement("canvas");
        texture.width = texture.height = 16;
        texture.getContext("2d")!.drawImage(input, 0, 0, 16, 16);
        const tex = texture.toDataURL();
        const right = items.createUploadedHeldItem(
            new File([], "item.png"),
            tex,
          ),
          left = {
            ...right,
            sourceKind: "java",
            javaModel: {
              model: java.parseJavaItemModel({
                textures: { "0": "test" },
                elements: [
                  {
                    from: [6, 0, 6],
                    to: [10, 20, 10],
                    faces: Object.fromEntries(
                      ["north", "south", "east", "west", "up", "down"].map(
                        (f) => [f, { texture: "#0" }],
                      ),
                    ),
                  },
                ],
                display: {
                  thirdperson_lefthand: {
                    translation: [1, 2, 3],
                    rotation: [15, 70, 5],
                    scale: [0.5, 0.5, 0.5],
                  },
                },
              }),
              textures: { test: tex },
            },
          };
        const canvas = document.createElement("canvas"),
          failures: string[] = [],
          sizes: number[] = [];
        document.body.append(canvas);
        const runtime = render.createSceneRenderer(canvas, {
          onPick() {},
          onTransform() {},
          onCamera() {},
          onError(e: string) {
            failures.push(e);
          },
          onReady() {},
        });
        runtime.resize(240, 180);
        const settings = {
          width: 240,
          height: 180,
          fileType: "png",
          backgroundMode: "transparent",
          backgroundColor: "#ffffff",
        };
        let count = 0;
        const badGeometry: string[] = [];
        try {
          for (const [width, height] of [
            [64, 64],
            [128, 128],
            [64, 32],
          ]) {
            const c = document.createElement("canvas");
            c.width = width!;
            c.height = height!;
            c.getContext("2d")!.drawImage(
              input,
              0,
              0,
              64,
              height === 32 ? 32 : 64,
              0,
              0,
              width!,
              height!,
            );
            for (const modelPreference of ["default", "slim", "auto-detect"])
              for (const layer of ["hidden", "flat", "3d"]) {
                const a = lib.createSceneAvatar(
                  {
                    source: c.toDataURL(),
                    label: "Matrix",
                    origin: "upload",
                    modelPreference,
                  },
                  {
                    id: "matrix",
                    avatarType,
                    showOuterLayer: layer !== "hidden",
                    showOuterLayerIn3d: layer === "3d",
                    heldItems: { leftArm: left, rightArm: right },
                  },
                );
                a.pose.leftElbowPitch = 45;
                a.pose.leftArmPitch = -45;
                a.pose.rightKneePitch = 25;
                const scene = lib.createEditorScene(a);
                scene.camera.position = [3, 2.4, 5];
                scene.frame = { width: 240, height: 180 };
                scene.selectedId = null;
                for (const mode of ["classic", "stylized"]) {
                  scene.appearance = { ...scene.appearance, mode };
                  runtime.sync({ ...scene });
                  const blob = await runtime.export(settings);
                  sizes.push(blob.size);
                  count++;
                  const entry = runtime.avatars.get("matrix")!;
                  let itemCount = 0;
                  entry.root.traverse((o: any) => {
                    if (o.name.endsWith("-held-item-group")) itemCount++;
                    if (
                      o.isMesh &&
                      !Array.from(o.geometry.attributes.position.array).every(
                        (n) => Number.isFinite(n),
                      )
                    )
                      badGeometry.push(
                        `${width}/${modelPreference}/${layer}/${mode}`,
                      );
                  });
                  if (itemCount !== 2) badGeometry.push("Missing held items");
                  if (
                    modelPreference !== "auto-detect" &&
                    entry.playerObject.skin.modelType !== modelPreference
                  )
                    badGeometry.push("Wrong arm model");
                }
              }
          }
        } finally {
          runtime.dispose();
          canvas.remove();
          input.close();
        }
        return {
          count,
          failures,
          badGeometry,
          minimumBytes: Math.min(...sizes),
        };
      },
      { skin, avatarType },
    );
    expect(result.count).toBe(54);
    expect(result.failures).toEqual([]);
    expect(result.badGeometry).toEqual([]);
    expect(result.minimumBytes).toBeGreaterThan(600);
    expect(errors).toEqual([]);
  });

test("Advanced creation, hierarchy, independent posing, transforms, undo and portable save", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const { skin, background, errors } = await setup(page);
  await create(page, skin);
  await page.getByRole("button", { name: "Duplicate avatar" }).click();
  await page.getByLabel("Avatar name", { exact: true }).fill("Second avatar");
  const positionField = page.getByLabel("Position (blocks) X", { exact: true });
  await positionField.fill("");
  await positionField.pressSequentially("-1.5");
  await expect(positionField).toHaveValue("-1.5");
  await page.getByRole("button", { name: "Head pitch", exact: true }).click();
  const editor = page.getByRole("main", { name: "Advanced editor" });
  await editor
    .locator('.editor-sidebar--right input[type="range"]')
    .first()
    .fill("35");
  const saved = await save(page);
  expect(saved.editorMode).toBe("advanced");
  expect(saved.scene.avatars).toHaveLength(2);
  expect(saved.scene.avatars[0].pose.headPitch).toBe(0);
  expect(saved.scene.avatars[1].pose.headPitch).toBe(35);
  expect(saved.scene.avatars[1].position[0]).toBe(-1.5);
  await page.getByRole("tab", { name: "Camera / Background" }).click();
  await page
    .getByLabel("Background image", { exact: true })
    .setInputFiles(file("scene.png", background));
  const fovField = page.getByLabel("Vertical field of view", { exact: true });
  await fovField.fill("");
  await fovField.pressSequentially("65");
  await page.getByLabel("Lock camera", { exact: true }).check();
  await expect
    .poll(() => page.evaluate(() => (window as any).__sceneViewer.camera.fov))
    .toBe(65);
  expect(
    await page.evaluate(() => (window as any).__sceneViewer.controls.enabled),
  ).toBe(false);
  const sceneSaved = await save(page);
  expect(sceneSaved.scene.background.source).toBe(background);
  expect(sceneSaved.scene.frame).toEqual({ width: 640, height: 360 });
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "scene.mcpose",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(sceneSaved)),
  });
  await expect(
    page.getByRole("img", { name: "Scene background", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        let n = 0;
        (window as any).__sceneViewer.scene.traverse((o: any) => {
          if (o.userData.sceneAvatarId) n++;
        });
        return n;
      }),
    )
    .toBe(2);
  await page.getByRole("button", { name: "Remove avatar" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  expect((await save(page)).scene.avatars).toHaveLength(2);
  await mkdir(".debug/advanced-editor", { recursive: true });
  await page.screenshot({ path: testInfo.outputPath("advanced.png") });
  await page.screenshot({ path: ".debug/advanced-editor/advanced.png" });
  expect(errors).toEqual([]);
});

test("Advanced scene exports the saved composition and shares all avatars", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { skin, background, errors } = await setup(page);
  await create(page, skin);
  await page.getByRole("button", { name: "Duplicate avatar" }).click();
  await page.getByRole("tab", { name: "Camera / Background" }).click();
  await page
    .getByLabel("Background image", { exact: true })
    .setInputFiles(file("scene.png", background));
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Export", exact: true });
  await expect(modal.getByLabel("Width", { exact: true })).toHaveValue("640");
  await expect(modal.getByAltText("Export preview")).toBeVisible();
  const download = page.waitForEvent("download");
  await modal
    .getByRole("button", { name: "Export Image", exact: true })
    .click();
  expect(
    (await readFile((await (await download).path())!)).length,
  ).toBeGreaterThan(5000);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page
    .getByRole("button", { name: "Generate Link", exact: true })
    .last()
    .click();
  const imageField = page.locator("textarea.share-link-field").last();
  await expect(imageField).toBeVisible();
  const imageUrl = new URL(await imageField.inputValue());
  await page
    .getByRole("button", { name: "Generate Link", exact: true })
    .first()
    .click();
  const field = page.locator("textarea.share-link-field").first();
  await expect(page.locator("textarea.share-link-field")).toHaveCount(2);
  await expect(field).toBeVisible();
  const url = new URL(await field.inputValue());
  await page.goto("about:blank");
  await page.goto(`/${url.search}${url.hash}`);
  await expect(
    page.getByRole("main", { name: "Advanced editor" }),
  ).toBeVisible();
  await expect(page.getByRole("treeitem")).toHaveCount(2);
  await expect(
    page.getByRole("img", { name: "Scene background", exact: true }),
  ).toBeVisible();
  await page.goto("about:blank");
  await page.goto(`/${imageUrl.search}${imageUrl.hash}`);
  const sharedImage = page.getByAltText("Shared MC Poser export", {
    exact: true,
  });
  await expect(sharedImage).toBeVisible();
  const pixel = await sharedImage.evaluate((img: HTMLImageElement) => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return Array.from(
      ctx.getImageData(
        Math.floor(c.width / 2),
        Math.floor(c.height * 0.1),
        1,
        1,
      ).data,
    );
  });
  expect(pixel.slice(0, 3)).toEqual([101, 141, 193]);
  expect(errors).toEqual([]);
});
