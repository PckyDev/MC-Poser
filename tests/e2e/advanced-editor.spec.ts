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
const placedModel = {
  textures: { base: "test/stone", accent: "test/accent" },
  elements: [
    {
      from: [0, 0, 0],
      to: [16, 16, 16],
      faces: Object.fromEntries(
        ["east", "west", "up", "down", "south", "north"].map((face) => [
          face,
          { texture: "#base", uv: [0, 0, 16, 16] },
        ]),
      ),
    },
    {
      from: [4, 16, 4],
      to: [12, 20, 12],
      rotation: { origin: [8, 16, 8], axis: "y", angle: 22.5 },
      faces: {
        north: { texture: "#accent", rotation: 90 },
        south: { texture: "#accent" },
      },
    },
  ],
  display: {
    thirdperson_righthand: {
      translation: [30, 20, 10],
      rotation: [60, 80, 30],
      scale: [0.1, 0.2, 0.3],
    },
  },
};
async function addPlacedModel(page: Page, png: string) {
  await openSceneAdd(page, "Java Model");
  const modal = page.getByRole("dialog", {
    name: "Add Java model",
    exact: true,
  });
  await modal.getByLabel("Java model JSON").setInputFiles({
    name: "Scene prop.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(placedModel)),
  });
  for (const path of ["test/stone", "test/accent"])
    await modal
      .getByLabel(`Texture: ${path}`)
      .setInputFiles(file("texture.png", png));
  await modal
    .getByRole("button", { name: "Use 3D model", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__sceneViewer.scene.children.filter(
            (o: any) => o.userData.sceneModelId,
          ).length,
      ),
    )
    .toBe(1);
}

test("Standalone Java models validate imports and support hierarchy, transforms and undo", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  await openSceneAdd(page, "Java Model");
  const modal = page.getByRole("dialog", {
    name: "Add Java model",
    exact: true,
  });
  await modal.getByLabel("Java model JSON").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...placedModel, parent: "missing" })),
  });
  await expect(modal.getByRole("alert")).toContainText("parent");
  await expect(
    modal.getByRole("button", { name: "Use 3D model" }),
  ).toBeDisabled();
  await modal.getByLabel("Java model JSON").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(placedModel)),
  });
  await modal
    .getByLabel("Texture: test/stone")
    .setInputFiles(file("stone.png", skin));
  await expect(
    modal.getByRole("button", { name: "Use 3D model" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add scene object", exact: true }),
  ).toBeFocused();
  await addPlacedModel(page, skin);
  await expect(page.locator(".tree > .scene-object")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Pose avatar", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Model name", { exact: true }).fill("Stone prop");
  const x = page.getByLabel("Position (blocks) X", { exact: true });
  await x.fill("");
  await x.pressSequentially("-1.25");
  await x.press("Tab");
  await page.getByLabel("Position (blocks) Y", { exact: true }).fill("0.5");
  await page.getByLabel("Rotation (degrees) Y", { exact: true }).fill("45");
  await page.getByLabel("Model scale", { exact: true }).fill("1.5");
  const data = await save(page);
  expect(data.scene.models[0]).toMatchObject({
    name: "Stone prop",
    position: [-1.25, 0.5, 0],
    rotation: [0, 45, 0],
    scale: 1.5,
  });
  expect(Object.values(data.scene.models[0].asset.textures)).toEqual([
    skin,
    skin,
  ]);
  expect(data.scene.avatars[0].position).toEqual([0, 0, 0]);
  await objectAction(page, "Stone prop", "Duplicate");
  await expect(page.locator(".tree > .scene-object")).toHaveCount(5);
  await page
    .getByRole("treeitem", { name: "Stone prop copy", exact: true })
    .hover();
  await page
    .getByRole("button", { name: "Hide Stone prop copy", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__sceneViewer.scene.children.filter(
            (o: any) => o.userData.sceneModelId && o.visible,
          ).length,
      ),
    )
    .toBe(1);
  await objectAction(page, "Stone prop copy", "Delete");
  await expect(page.locator(".tree > .scene-object")).toHaveCount(4);
  await page.getByRole("button", { name: "TestSkin", exact: true }).click();
  await page.getByRole("button", { name: "Expand Head", exact: true }).click();
  await page.getByRole("button", { name: "Head pitch", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pose avatar", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  await expect(page.locator(".tree > .scene-object")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Move model", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Pose avatar", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Redo/ }).click();
  await expect(page.locator(".tree > .scene-object")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("Standalone models survive save, import, diagnostics, sharing and exports in both styles", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const { skin, errors } = await setup(page);
  await create(page, skin);
  await addPlacedModel(page, skin);
  await page.getByLabel("Position (blocks) X", { exact: true }).fill("-1.5");
  const data = await save(page);
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "models.mcpose",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.getByLabel("Model name", { exact: true })).toHaveValue(
    "Scene prop",
  );
  await expect(
    page.getByLabel("Position (blocks) X", { exact: true }),
  ).toHaveValue("-1.5");
  const editor = page.getByRole("main", { name: "Advanced editor" });
  for (const mode of ["classic", "stylized"]) {
    await editor
      .getByRole("combobox", { name: "Render style", exact: true })
      .selectOption(mode);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(
      page.getByAltText("Export preview", { exact: true }),
    ).toBeVisible();
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export Image", exact: true })
      .click();
    expect(
      (await readFile((await (await pending).path())!)).length,
    ).toBeGreaterThan(5000);
  }
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
  expect(report.workspace.scene.models[0].asset).toEqual(
    data.scene.models[0].asset,
  );
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page
    .getByRole("button", { name: "Generate Link", exact: true })
    .first()
    .click();
  const field = page.locator("textarea.share-link-field").first();
  await expect(field).toBeVisible();
  const url = new URL(await field.inputValue());
  await page.goto("about:blank");
  await page.goto(`/${url.search}${url.hash}`);
  await expect(
    page.getByRole("treeitem", { name: "Scene prop", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Model scale", { exact: true })).toHaveValue(
    "1",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__sceneViewer.scene.children.filter(
            (o: any) => o.userData.sceneModelId,
          ).length,
      ),
    )
    .toBe(1);
  await page.screenshot({ path: testInfo.outputPath("scene-models.png") });
  await mkdir(".debug/scene-models", { recursive: true });
  await page.screenshot({ path: ".debug/scene-models/review.png" });
  expect(errors).toEqual([]);
});

test("Standalone model canvas selection and transform handles work independently of avatars", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  await addPlacedModel(page, skin);
  await page.getByLabel("Position (blocks) X", { exact: true }).fill("-1.5");
  await page.getByRole("button", { name: "Scene camera", exact: true }).click();
  await page.getByLabel("Lock camera", { exact: true }).check();
  await page.getByRole("button", { name: "Scene prop", exact: true }).click();
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
  await page.mouse.move(handle.x + 50, handle.y, { steps: 12 });
  await page.mouse.up();
  await expect(
    page.getByLabel("Position (blocks) X", { exact: true }),
  ).not.toHaveValue("-1.5");
  const moved = await save(page);
  expect(moved.scene.avatars[0].position).toEqual([0, 0, 0]);
  expect(moved.scene.selectedId).toBe(moved.scene.models[0].id);
  await page
    .getByLabel("Advanced scene viewport", { exact: true })
    .click({ position: { x: 10, y: 10 } });
  await expect(
    page.getByText("Select an object in the hierarchy or canvas."),
  ).toBeVisible();
  const center = await page.evaluate(() => {
    const v = (window as any).__sceneViewer,
      root = v.scene.children.find((o: any) => o.userData.sceneModelId);
    const p = root.position.clone().set(0, 8, 0);
    root.localToWorld(p);
    p.project(v.camera);
    const b = v.canvas.getBoundingClientRect();
    return {
      x: b.x + ((p.x + 1) * b.width) / 2,
      y: b.y + ((1 - p.y) * b.height) / 2,
    };
  });
  await page.mouse.click(center.x, center.y);
  await expect(page.getByLabel("Model name", { exact: true })).toHaveValue(
    "Scene prop",
  );
  await page.getByRole("button", { name: "Rotate model", exact: true }).click();
  expect(
    await page.evaluate(() => {
      const g = (window as any).__sceneViewer.scene.children.find(
        (o: any) => o.isTransformControls,
      );
      return { mode: g.mode, target: g.object.userData.sceneModelId };
    }),
  ).toEqual({ mode: "rotate", target: moved.scene.models[0].id });
  await page.getByRole("button", { name: "TestSkin", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pose avatar", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test("Standalone model geometry ignores hand displays and validates portable assets", async ({
  page,
}) => {
  const { skin } = await setup(page);
  const result = await page.evaluate(
    async ({ skin, input }) => {
      // @ts-expect-error Browser source module.
      const lib = await import("/src/lib/scene.ts");
      // @ts-expect-error Browser source module.
      const java = await import("/src/lib/javaItemModel.ts");
      // @ts-expect-error Browser source module.
      const renderer = await import("/src/lib/sceneRenderer.ts");
      const asset = java.normalizeJavaItemAsset({
        model: input,
        textures: { "test/stone": skin, "test/accent": skin },
      });
      const a = lib.createSceneAvatar({
        source: skin,
        label: "Test",
        origin: "upload",
        modelPreference: "default",
      });
      const m = lib.createSceneModel("Block", asset),
        scene = { ...lib.createEditorScene(a), models: [m] };
      const failures: boolean[] = [];
      for (const raw of [
        { ...scene, models: [{ ...m, id: a.id }] },
        { ...scene, models: Array(33).fill(m) },
        {
          ...scene,
          models: [
            {
              ...m,
              asset: {
                ...asset,
                textures: { "test/stone": "https://example.com/texture.png" },
              },
            },
          ],
        },
      ]) {
        try {
          lib.normalizeEditorScene(raw, (a: any) => a);
          failures.push(false);
        } catch {
          failures.push(true);
        }
      }
      const old = { ...scene } as any;
      delete old.models;
      const compatibility = lib.normalizeEditorScene(old, (a: any) => a).models;
      const canvas = document.createElement("canvas");
      document.body.append(canvas);
      const errors: string[] = [];
      const r = renderer.createSceneRenderer(canvas, {
        onPick() {},
        onTransform() {},
        onCamera() {},
        onError(e: string) {
          errors.push(e);
        },
        onReady() {},
      });
      const settings = {
        width: 240,
        height: 180,
        fileType: "png",
        backgroundMode: "transparent",
        backgroundColor: "#fff",
      };
      const output: any = { failures, compatibility, errors };
      try {
        r.sync(scene);
        await r.export(settings);
        const runtime = r.models.get(m.id),
          display = runtime.root.children[0],
          mesh = display.children[0];
        mesh.geometry.computeBoundingBox();
        output.display = {
          position: display.position.toArray(),
          rotation: display.rotation.toArray().slice(0, 3),
          scale: display.scale.toArray(),
        };
        output.bounds = [
          mesh.geometry.boundingBox.min.toArray(),
          mesh.geometry.boundingBox.max.toArray(),
        ];
        output.uv = Array.from(mesh.geometry.attributes.uv.array).slice(0, 8);
        output.mode = mesh.material[0].type;
        r.sync({
          ...scene,
          appearance: { ...scene.appearance, mode: "stylized" },
        });
        await r.export(settings);
        output.stylized = mesh.material[0].name;
        r.sync({ ...scene, models: [] });
        await r.export(settings);
        output.remaining = r.models.size;
      } finally {
        r.dispose();
        canvas.remove();
      }
      return output;
    },
    { skin, input: placedModel },
  );
  expect(result.failures).toEqual([true, true, true]);
  expect(result.compatibility).toEqual([]);
  expect(result.display).toEqual({
    position: [0, 8, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  });
  expect(result.bounds).toEqual([
    [-8, -8, -8],
    [8, 8, 8],
  ]);
  expect(result.uv).toEqual([0, 1, 1, 1, 0, 0, 1, 0]);
  expect(result.mode).toBe("MeshBasicMaterial");
  expect(result.stylized).toBe("MC Poser stylized surface");
  expect(result.remaining).toBe(0);
  expect(result.errors).toEqual([]);
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

async function openSceneAdd(page: Page, name: "Avatar" | "Java Model") {
  await page
    .getByRole("button", { name: "Add scene object", exact: true })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

test("Scene toolbar is flush and icon-only with an accessible add menu", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  const tools = page.getByRole("toolbar", { name: "Scene tools" });
  const names = ["Move avatar", "Rotate avatar", "Pose avatar"];
  const boxes = [];
  for (const name of names) {
    const button = tools.getByRole("button", { name, exact: true });
    await expect(button).not.toHaveAttribute("title");
    await button.hover();
    await expect(page.getByRole("tooltip")).toHaveText(name);
    await page.mouse.move(800, 600);
    expect(await button.innerText()).toBe("");
    const box = (await button.boundingBox())!;
    expect(box.width).toBe(box.height);
    boxes.push(box);
  }
  const bar = (await tools.boundingBox())!;
  expect(boxes[0]!.x).toBe(bar.x);
  expect(boxes[0]!.y).toBe(bar.y);
  expect(boxes[1]!.x).toBe(boxes[0]!.x + boxes[0]!.width);
  expect(boxes[2]!.x).toBe(boxes[1]!.x + boxes[1]!.width);
  const rotate = tools.getByRole("button", {
    name: "Rotate avatar",
    exact: true,
  });
  await expect(rotate).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await rotate.hover();
  await expect(rotate).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await rotate.click();
  await expect(rotate).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Advanced editor", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Add avatar", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add Java model", exact: true }),
  ).toHaveCount(0);
  const add = page.getByRole("button", {
    name: "Add scene object",
    exact: true,
  });
  const addBox = (await add.boundingBox())!;
  expect(addBox.width).toBe(boxes[0]!.width);
  expect(addBox.height).toBe(boxes[0]!.height);
  expect(addBox.y).toBe(bar.y);
  await add.focus();
  await add.press("ArrowDown");
  const menu = page.getByRole("menu", {
    name: "Add scene object",
    exact: true,
  });
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Avatar",
    "Java Model",
    "Scene Background",
  ]);
  await expect(
    menu.getByRole("menuitem", { name: "Avatar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitem", { name: "Java Model", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(add).toBeFocused();
  await add.click();
  await page
    .getByRole("toolbar", { name: "Scene tools" })
    .click({ position: { x: 200, y: 20 } });
  await expect(menu).toHaveCount(0);
  await openSceneAdd(page, "Avatar");
  await expect(
    page.getByRole("dialog", { name: "Add avatar", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close add avatar", exact: true })
    .click();
  await expect(add).toBeFocused();
  await openSceneAdd(page, "Java Model");
  await expect(
    page.getByRole("dialog", { name: "Add Java model", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
  await page.getByRole("button", { name: "TestSkin", exact: true }).click();
  await add.click();
  await mkdir(".debug/scene-toolbar", { recursive: true });
  await page.screenshot({ path: ".debug/scene-toolbar/review.png" });
  await page.setViewportSize({ width: 881, height: 892 });
  const narrowBar = (await tools.boundingBox())!;
  const narrowButton = (await tools
    .getByRole("button", { name: "Move avatar", exact: true })
    .boundingBox())!;
  expect(narrowBar.height).toBe(narrowButton.height + 1);
  expect(narrowButton.width).toBe(narrowButton.height);
  await page.screenshot({ path: ".debug/scene-toolbar/narrow.png" });
  expect(errors).toEqual([]);
});

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
  await openSceneAdd(page, "Avatar");
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
  await openSceneAdd(page, "Avatar");
  await modal.getByLabel("New avatar username").fill("SceneTest");
  await modal.getByRole("button", { name: "Add by username" }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".tree > .scene-object")).toHaveCount(5);
  await page.getByRole("treeitem", { name: "Second", exact: true }).hover();
  await page.getByRole("button", { name: "Hide Second", exact: true }).click();
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
  await page.getByRole("button", { name: "SceneTest", exact: true }).click();
  await page.getByRole("button", { name: "Expand Head", exact: true }).click();
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
  await page.getByRole("button", { name: "TestSkin", exact: true }).click();
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
    page.getByText("Select an object in the hierarchy or canvas."),
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
  await page.getByRole("button", { name: "Expand Head", exact: true }).click();
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
  expect((await save(page)).scene.selectedId).toBe(null);
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
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
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
  await objectAction(page, "TestSkin", "Duplicate");
  await page.getByLabel("Avatar name", { exact: true }).fill("Second avatar");
  const positionField = page.getByLabel("Position (blocks) X", { exact: true });
  await positionField.fill("");
  await positionField.pressSequentially("-1.5");
  await expect(positionField).toHaveValue("-1.5");
  await page.getByRole("button", { name: "Expand Head", exact: true }).click();
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
  await page.getByRole("button", { name: "Scene camera", exact: true }).click();
  await page
    .getByLabel("Add scene background image", { exact: true })
    .setInputFiles(file("scene.png", background));
  await expect(
    page.getByRole("img", { name: "Scene background", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Scene camera", exact: true }).click();
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
  await objectAction(page, "Second avatar", "Delete");
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
  await objectAction(page, "TestSkin", "Duplicate");
  await page.getByRole("button", { name: "Scene camera", exact: true }).click();
  await page
    .getByLabel("Add scene background image", { exact: true })
    .setInputFiles(file("scene.png", background));
  await expect(
    page.getByRole("img", { name: "Scene background", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Scene camera", exact: true }).click();
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
  await expect(page.locator(".tree > .scene-object")).toHaveCount(5);
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

async function objectAction(page: Page, name: string, action: string) {
  await page
    .getByRole("treeitem", { name, exact: true })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

test('Simple editor exports above 4096 pixels',async({page})=>{
 const {skin,errors}=await setup(page);
 await page.getByRole('button',{name:'Create New File',exact:true}).click();
 await page.getByRole('tab',{name:'Upload PNG',exact:true}).click();
 await page.locator('input[accept=".png,image/png"]').nth(1).setInputFiles(file('TestSkin.png',skin));
 await page.getByRole('button',{name:'Create From Uploaded PNG',exact:true}).click();
 await page.getByRole('button',{name:'Export',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Export',exact:true});
 await modal.getByRole('button',{name:'Unlink aspect ratio',exact:true}).click();
 await modal.getByLabel('Width',{exact:true}).fill('5000');await modal.getByLabel('Height',{exact:true}).fill('128');
 await modal.getByLabel('Height',{exact:true}).blur();
 const pending=page.waitForEvent('download');await modal.getByRole('button',{name:'Export Image',exact:true}).click();
 const buffer=await readFile((await (await pending).path())!);
 expect(buffer.readUInt32BE(16)).toBe(5000);expect(buffer.readUInt32BE(20)).toBe(128);expect(errors).toEqual([]);
});

test("Export dimensions link both ways and exceed the old resolution cap", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Export", exact: true });
  const width = modal.getByLabel("Width", { exact: true }),
    height = modal.getByLabel("Height", { exact: true });
  await expect(modal.getByRole("slider")).toHaveCount(0);
  await expect(
    modal.locator(".modal-section-copy,.panel-note,.modal-footer-copy"),
  ).toHaveCount(0);
  await expect(width).not.toHaveAttribute("max");
  await width.fill("3200");
  await width.blur();
  await expect(height).toHaveValue("1800");
  await height.fill("900");
  await height.blur();
  await expect(width).toHaveValue("1600");
  await expect(
    modal.getByRole("button", { name: "Export Image", exact: true }),
  ).toBeEnabled();
  await mkdir(".debug/export", { recursive: true });
  await page.screenshot({ path: ".debug/export/review.png" });
  await modal
    .getByRole("button", { name: "Unlink aspect ratio", exact: true })
    .click();
  await width.fill("5000");
  await width.blur();
  await expect(height).toHaveValue("900");
  await height.fill("128");
  await height.blur();
  await modal
    .getByRole("button", { name: "Link aspect ratio", exact: true })
    .click();
  await height.fill("256");
  await height.blur();
  await expect(width).toHaveValue("10000");
  await modal
    .getByRole("button", { name: "Unlink aspect ratio", exact: true })
    .click();
  await width.fill("999999");
  await width.blur();
  await modal
    .getByRole("button", { name: "Export Image", exact: true })
    .click();
  await expect(modal.getByRole("alert")).toContainText(
    "This browser can render up to",
  );
  await width.fill("5000");
  await width.blur();
  await height.fill("128");
  await height.blur();
  const pending = page.waitForEvent("download");
  await modal
    .getByRole("button", { name: "Export Image", exact: true })
    .click();
  const buffer = await readFile((await (await pending).path())!);
  const dimensions = await page.evaluate(async (bytes) => {
    const img = await createImageBitmap(
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    );
    const size = [img.width, img.height];
    img.close();
    return size;
  }, Array.from(buffer));
  expect(dimensions).toEqual([5000, 128]);
  expect(errors).toEqual([]);
});

test("Grid color and styled visibility toggle preserve defaults and saved settings", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  await page
    .getByRole("button", { name: "Perspective grid", exact: true })
    .click();
  const toggle = page.getByRole("switch", {
    name: "Show perspective grid",
    exact: true,
  });
  await expect(toggle).toBeChecked();
  await expect(toggle).toHaveCSS("width", "36px");
  const readColors = () =>
    page.evaluate(() =>
      Array.from(
        (window as any).__sceneViewer.scene.children.find(
          (o: any) => o.type === "GridHelper",
        ).geometry.attributes.color.array,
      ),
    );
  const defaults = await readColors();
  await expect(
    page.getByRole("button", { name: "Reset grid color", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Grid color", { exact: true }).fill("#ff3300");
  await expect.poll(readColors).not.toEqual(defaults);
  expect((await save(page)).scene.gridColor).toBe("#ff3300");
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  const saved = await save(page);
  expect(saved.scene.showGrid).toBe(false);
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "grid.mcpose",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await page
    .getByRole("button", { name: "Perspective grid", exact: true })
    .click();
  await expect(page.getByLabel("Grid color", { exact: true })).toHaveValue(
    "#ff3300",
  );
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await page
    .getByRole("button", { name: "Reset grid color", exact: true })
    .click();
  await expect.poll(readColors).toEqual(defaults);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  await expect(page.getByLabel("Grid color", { exact: true })).toHaveValue(
    "#ff3300",
  );
  const legacy = structuredClone(saved);
  delete legacy.scene.gridColor;
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "legacy.mcpose",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await page
    .getByRole("button", { name: "Perspective grid", exact: true })
    .click();
  await toggle.click();
  await expect.poll(readColors).toEqual(defaults);
  await mkdir(".debug/hierarchy", { recursive: true });
  await page.screenshot({ path: ".debug/hierarchy/grid-options.png" });
  expect(errors).toEqual([]);
});

test("Inline model renaming and selection-driven Inspector", async ({
  page,
}) => {
  const { skin, background, errors } = await setup(page);
  await create(page, skin);
  await addPlacedModel(page, skin);
  await expect(
    page.getByRole("heading", { name: "Inspector", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Scene inspector" }),
  ).toHaveCount(0);
  await objectAction(page, "Scene prop", "Rename");
  const input = page.getByRole("textbox", {
    name: "Rename Java model",
    exact: true,
  });
  await expect(input).toBeFocused();
  expect(
    await input.evaluate((e: HTMLInputElement) => [
      e.selectionStart,
      e.selectionEnd,
    ]),
  ).toEqual([0, "Scene prop".length]);
  await input.fill("Hammer");
  await input.press("Enter");
  await expect(
    page.getByRole("treeitem", { name: "Hammer", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Model name", { exact: true })).toHaveValue(
    "Hammer",
  );
  await objectAction(page, "Hammer", "Rename");
  await input.fill("Cancelled");
  await input.press("Escape");
  await expect(
    page.getByRole("treeitem", { name: "Hammer", exact: true }),
  ).toBeVisible();
  await objectAction(page, "Hammer", "Rename");
  await input.fill("  ");
  await input.press("Enter");
  await expect(
    page.getByRole("treeitem", { name: "Hammer", exact: true }),
  ).toBeVisible();
  await objectAction(page, "Hammer", "Rename");
  await input.fill("Prop");
  await page.getByRole("button", { name: "Scene camera", exact: true }).click();
  await expect(
    page.getByRole("treeitem", { name: "Prop", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Vertical field of view", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Model name", { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel("Background image", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Perspective grid", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Show perspective grid", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Vertical field of view", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Add scene background image", { exact: true })
    .setInputFiles(file("Background.png", background));
  await expect(
    page.getByRole("img", { name: "Scene background", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Background image", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Show perspective grid", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "TestSkin", exact: true }).click();
  await expect(page.getByLabel("Avatar name", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Head", exact: true }).click();
  await expect(page.getByLabel("Avatar name", { exact: true })).toHaveCount(0);
  await expect(
    page.locator('.editor-sidebar--right input[type="range"]').first(),
  ).toBeVisible();
  const data = await save(page);
  expect(data.scene.models[0].name).toBe("Prop");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  await expect(
    page.getByRole("treeitem", { name: "Hammer", exact: true }),
  ).toBeVisible();
  await objectAction(page, "Hammer", "Rename");
  await mkdir(".debug/hierarchy", { recursive: true });
  await page.screenshot({ path: ".debug/hierarchy/rename-inspector.png" });
  await input.press("Escape");
  expect(errors).toEqual([]);
});

test("Hierarchy settings, empty space, background and perspective grid", async ({
  page,
}) => {
  const { skin, background, errors } = await setup(page);
  await create(page, skin);
  await objectAction(page, "TestSkin", "Avatar settings");
  await expect(
    page.getByRole("dialog", { name: "Document", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Avatar type options" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close document modal" }).click();
  const hierarchy = page.getByRole("complementary", {
    name: "Scene hierarchy",
  });
  const rect = (await hierarchy.boundingBox())!;
  await page.mouse.click(rect.x + 70, rect.y + rect.height - 30);
  await expect(
    page.getByText("Select an object in the hierarchy or canvas."),
  ).toBeVisible();
  await page.mouse.click(rect.x + 70, rect.y + rect.height - 30, {
    button: "right",
  });
  await expect(page.getByRole("menuitem")).toHaveText([
    "Avatar",
    "Java Model",
    "Scene Background",
  ]);
  await page.getByRole("menuitem", { name: "Java Model", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Add Java model", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Add scene object", exact: true })
    .click();
  const pending = page.waitForEvent("filechooser");
  await page
    .getByRole("menuitem", { name: "Scene Background", exact: true })
    .click();
  await (await pending).setFiles(file("Landscape.png", background));
  const rows = page.locator(".tree > .scene-object");
  await expect(rows).toHaveCount(4);
  await page.getByRole("button", { name: "TestSkin", exact: true }).click();
  await page
    .getByRole("treeitem", { name: "Head", exact: true })
    .locator(".part-row")
    .hover();
  const partRow = page
    .getByRole("treeitem", { name: "Head", exact: true })
    .locator(".part-row");
  await expect
    .poll(
      async () =>
        (await partRow.locator(".quick-actions").boundingBox())!.width,
    )
    .toBe(52);
  const lockBox = (await partRow
    .getByRole("button", { name: "Lock Head", exact: true })
    .boundingBox())!;
  const partBox = (await partRow.boundingBox())!;
  expect(lockBox.x + lockBox.width).toBeLessThanOrEqual(
    partBox.x + partBox.width,
  );
  await mkdir(".debug/hierarchy", { recursive: true });
  await page.screenshot({ path: ".debug/hierarchy/extras.png" });
  expect(
    await rows.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("aria-label")),
    ),
  ).toEqual([
    "TestSkin",
    "Scene camera",
    "Perspective grid",
    "Scene background",
  ]);
  await page
    .getByRole("button", { name: "Add scene object", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Scene Background", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("treeitem", { name: "Scene background", exact: true })
    .hover();
  await page
    .getByRole("button", { name: "Hide Scene background", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Scene background", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("treeitem", { name: "Perspective grid", exact: true })
    .hover();
  await page
    .getByRole("button", { name: "Hide Perspective grid", exact: true })
    .click();
  let data = await save(page);
  expect(data.scene.showGrid).toBe(false);
  expect(data.scene.background.visible).toBe(false);
  await objectAction(page, "Scene background", "Delete");
  await expect(
    page.getByRole("treeitem", { name: "Scene background", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add scene object", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Scene Background", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("Individual part visibility and locks persist and protect posing", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  const head = page.getByRole("treeitem", { name: "Head", exact: true });
  await head.locator(".part-row").hover();
  await head.getByRole("button", { name: "Hide Head", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const v = (window as any).__sceneViewer;
        let count = 0;
        v.scene.traverseVisible((o: any) => {
          if (o.userData.scenePart === "head" && o.isMesh) count++;
        });
        return count;
      }),
    )
    .toBe(0);
  await head.getByRole("button", { name: "Show Head", exact: true }).click();
  await head.getByRole("button", { name: "Head", exact: true }).click();
  await head.getByRole("button", { name: "Lock Head", exact: true }).click();
  await expect(
    page.locator('.object-inspector input[type="range"]').first(),
  ).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as any).__sceneViewer.scene.children.find(
            (o: any) => o.isTransformControls,
          )?.object,
        ),
      ),
    )
    .toBe(false);
  let data = await save(page);
  expect(data.scene.avatars[0].parts.head).toEqual({
    visible: true,
    locked: true,
  });
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "parts.mcpose",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(
    head.getByRole("button", { name: "Unlock Head", exact: true }),
  ).toBeVisible();
  await head.getByRole("button", { name: "Unlock Head", exact: true }).click();
  await head.getByRole("button", { name: "Expand Head", exact: true }).click();
  await head.getByRole("button", { name: "Head pitch", exact: true }).click();
  await expect(
    page.locator('.object-inspector input[type="range"]').first(),
  ).toBeEnabled();
  await head.locator(".part-row").hover();
  await head.getByRole("button", { name: "Hide Head", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  data = await save(page);
  expect(data.scene.avatars[0].parts.head.visible).toBe(true);
  expect(errors).toEqual([]);
});

test("Part visibility is independent across every avatar rig, arm model and layer mode", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { skin } = await setup(page);
  const result = await page.evaluate(async (skin) => {
    // @ts-expect-error Browser module
    const { createSceneAvatar } = await import("/src/lib/scene.ts");
    // @ts-expect-error Browser module
    const { buildSceneAvatar, updateSceneAvatar } = await import(
      "/src/lib/sceneAvatar.ts"
    );
    const failures: string[] = [];
    for (const avatarType of ["default", "bobblehead", "advanced", "stylized"])
      for (const modelPreference of ["default", "slim"])
        for (const mode of ["none", "flat", "3d"]) {
          const a = createSceneAvatar(
            { source: skin, label: "Test", origin: "upload", modelPreference },
            {
              avatarType,
              showOuterLayer: mode !== "none",
              showOuterLayerIn3d: mode === "3d",
            },
          );
          const runtime = await buildSceneAvatar(a);
          const visible = () => {
            const counts: Record<string, number> = {};
            runtime.root.traverseVisible((o: any) => {
              if (o.isMesh && o.userData.scenePart)
                counts[o.userData.scenePart] =
                  (counts[o.userData.scenePart] ?? 0) + 1;
            });
            return counts;
          };
          const baseline = visible();
          for (const part of [
            "head",
            "torso",
            "leftArm",
            "rightArm",
            "leftLeg",
            "rightLeg",
          ]) {
            updateSceneAvatar(runtime, {
              ...a,
              parts: { [part]: { visible: false, locked: false } },
            });
            const hidden = visible();
            if (
              hidden[part] ||
              !baseline[part] ||
              Object.keys(baseline).some(
                (other) => other !== part && baseline[other] !== hidden[other],
              )
            )
              failures.push(`${avatarType}/${modelPreference}/${mode}/${part}`);
          }
          updateSceneAvatar(runtime, a);
          if (JSON.stringify(visible()) !== JSON.stringify(baseline))
            failures.push("restore");
          runtime.dispose();
        }
    return failures;
  }, skin);
  expect(result).toEqual([]);
});

test("Avatar drawers nest parts and idle actions align right", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  const avatar = page.getByRole("treeitem", { name: "TestSkin", exact: true });
  const drawer = avatar.getByRole("group", {
    name: "TestSkin parts",
    exact: true,
  });
  const camera = page.getByRole("treeitem", {
    name: "Scene camera",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  await expect(
    avatar.getByRole("button", { name: "Head pitch", exact: true }),
  ).not.toBeVisible();
  await avatar
    .getByRole("button", { name: "Expand Head", exact: true })
    .click();
  await expect(
    avatar.getByRole("button", { name: "Head pitch", exact: true }),
  ).toBeVisible();
  const head = avatar.getByRole("treeitem", { name: "Head", exact: true });
  expect(
    (await head
      .getByRole("button", { name: "Head pitch", exact: true })
      .boundingBox())!.x,
  ).toBeGreaterThan(
    (await head
      .getByRole("button", { name: "Head", exact: true })
      .boundingBox())!.x,
  );
  await expect
    .poll(
      async () =>
        (await camera.boundingBox())!.y -
        ((await drawer.boundingBox())!.y +
          (await drawer.boundingBox())!.height),
    )
    .toBeCloseTo(0, 0);
  await avatar
    .getByRole("button", { name: "Collapse TestSkin", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  await avatar
    .getByRole("button", { name: "Expand TestSkin", exact: true })
    .click();
  await expect(drawer).toBeVisible();
  await avatar.locator(".object-row").hover();
  await avatar
    .getByRole("button", { name: "Hide TestSkin", exact: true })
    .click();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(700, 500);
  const eye = avatar.getByRole("button", {
    name: "Show TestSkin",
    exact: true,
  });
  await expect
    .poll(
      async () =>
        (await avatar.locator(".object-row > .quick-actions").boundingBox())!
          .width,
    )
    .toBe(26);
  const idle = (await eye.boundingBox())!;
  await avatar.locator(".object-row").hover();
  await expect
    .poll(
      async () =>
        (await avatar.locator(".object-row > .quick-actions").boundingBox())!
          .width,
    )
    .toBe(52);
  expect(idle.x - (await eye.boundingBox())!.x).toBeCloseTo(26, 0);
  await mkdir(".debug/hierarchy", { recursive: true });
  await page.screenshot({ path: ".debug/hierarchy/nested.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await avatar
    .getByRole("button", { name: "Collapse TestSkin", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("Hierarchy visibility, locks, context menus and attached dropdowns", async ({
  page,
}) => {
  const { skin, errors } = await setup(page);
  await create(page, skin);
  const row = page.getByRole("treeitem", { name: "TestSkin", exact: true });
  await expect(page.locator(".tree > .scene-object")).toHaveCount(3);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(700, 500);
  await expect(
    row.getByRole("button", { name: "Hide TestSkin", exact: true }),
  ).toHaveCSS("opacity", "0");
  await row.locator(".object-row").hover();
  await expect(
    row.getByRole("button", { name: "Hide TestSkin", exact: true }),
  ).toHaveCSS("opacity", "1");
  await row.getByRole("button", { name: "Hide TestSkin", exact: true }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(700, 500);
  await expect(
    row.getByRole("button", { name: "Show TestSkin", exact: true }),
  ).toHaveCSS("opacity", "1");
  await objectAction(page, "TestSkin", "Show");
  await objectAction(page, "TestSkin", "Lock");
  await expect(
    page.getByLabel("Position (blocks) X", { exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(700, 500);
  await expect(
    row.getByRole("button", { name: "Unlock TestSkin", exact: true }),
  ).toHaveCSS("opacity", "1");
  let data = await save(page);
  expect(data.scene.avatars[0].locked).toBe(true);
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "locked.mcpose",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(
    page.getByLabel("Position (blocks) X", { exact: true }),
  ).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const viewer = (window as any).__sceneViewer;
        return Boolean(
          viewer.scene.children.find((o: any) => o.isTransformControls)?.object,
        );
      }),
    )
    .toBe(false);
  const point = await page.evaluate(() => {
    const v = (window as any).__sceneViewer,
      root = v.scene.children.find((o: any) => o.userData.sceneAvatarId);
    const p = root.position.clone().set(0, 28, 0).project(v.camera),
      b = v.canvas.getBoundingClientRect();
    return {
      x: b.x + ((p.x + 1) * b.width) / 2,
      y: b.y + ((1 - p.y) * b.height) / 2,
    };
  });
  await page.mouse.click(point.x, point.y);
  await expect(row).toHaveAttribute("aria-selected", "false");
  await row.getByRole("button", { name: "TestSkin", exact: true }).click();
  await row.getByRole("button", { name: "TestSkin", exact: true }).focus();
  await page.keyboard.press("Shift+F10");
  await expect(
    page.getByRole("menuitem", { name: "Delete", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(
    row.getByRole("button", { name: "TestSkin", exact: true }),
  ).toBeFocused();
  await objectAction(page, "TestSkin", "Duplicate");
  await expect(
    page.getByLabel("Position (blocks) X", { exact: true }),
  ).toBeEnabled();
  await objectAction(page, "TestSkin copy", "Delete");
  await objectAction(page, "TestSkin", "Unlock");
  await page.getByRole("button", { name: "TestSkin", exact: true }).click();
  await expect(
    page.getByLabel("Position (blocks) X", { exact: true }),
  ).toBeEnabled();
  const camera = page.getByRole("treeitem", {
    name: "Scene camera",
    exact: true,
  });
  await expect(camera.getByRole("button", { name: /Hide/ })).toHaveCount(0);
  await objectAction(page, "Scene camera", "Lock");
  await camera.click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Duplicate", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("menuitem", { name: "Delete", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  data = await save(page);
  expect(data.scene.camera.locked).toBe(true);
  for (const name of [
    "File",
    "Edit",
    "Pose",
    "View",
    "Help",
    "Add scene object",
  ]) {
    const trigger = page.getByRole("button", { name, exact: true });
    await trigger.click();
    const panel = page.locator(".menu-dropdown-panel:visible");
    const a = (await trigger.boundingBox())!,
      b = (await panel.boundingBox())!;
    expect(Math.abs(b.y - a.y - a.height)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
  }
  await addPlacedModel(page, skin);
  await objectAction(page, "Scene prop", "Lock");
  await expect(
    page.getByLabel("Position (blocks) X", { exact: true }),
  ).toBeDisabled();
  data = await save(page);
  expect(data.scene.models[0].locked).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as any).__sceneViewer.scene.children.find(
            (o: any) => o.isTransformControls,
          )?.object,
        ),
      ),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  await expect(
    page.getByLabel("Position (blocks) X", { exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "TestSkin", exact: true }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(700, 500);
  await mkdir(".debug/hierarchy", { recursive: true });
  await page.screenshot({ path: ".debug/hierarchy/review.png" });
  expect(errors).toEqual([]);
});
