import { expect, test, type Page } from "@playwright/test";

// Read the actual application's meshes without shipping a test API in production.
// All skin loading, arm/rig selection and layer switching still use the UI.
async function exposeViewer(page: Page) {
  await page.route("**/src/App.tsx", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    expect(source).toContain("viewerRef.current = viewer;");
    await route.fulfill({
      response,
      body: source.replace(
        "viewerRef.current = viewer;",
        "viewerRef.current = viewer; window.__headProbe = { viewer, Raycaster, Vector3, Mesh };",
      ),
    });
  });
}

async function makeSkin(
  page: Page,
  legacy: boolean,
  slim: boolean,
  scale: number,
  alpha: number,
) {
  return page.evaluate(
    ({ legacy, slim, scale, alpha }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 64 * scale;
      canvas.height = (legacy ? 32 : 64) * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.fillStyle = "#987654";
      ctx.fillRect(0, 0, 64, legacy ? 32 : 64);
      // Transparent unused hat pixels prevent legacy opaque-hat cleanup.
      ctx.clearRect(32, 0, 32, 16);
      if (slim) {
        for (const [x, y, w, h] of [
          [50, 16, 2, 4],
          [54, 20, 2, 12],
          [42, 48, 2, 4],
          [46, 52, 2, 12],
        ])
          ctx.clearRect(x, y, w, h);
      }
      for (const origin of [16, 48]) {
        ctx.globalAlpha = origin === 48 ? alpha : 1;
        ["#ff0000", "#00ff00", "#0000ff", "#ffff00"].forEach((color, i) => {
          ctx.fillStyle = color;
          ctx.fillRect(origin + (i % 2) * 4, Math.floor(i / 2) * 4, 4, 4);
        });
      }
      return canvas.toDataURL("image/png");
    },
    { legacy, slim, scale, alpha },
  );
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const { viewer, Raycaster, Vector3, Mesh } = (window as any).__headProbe;
    const head = viewer.playerObject.skin.head;
    const texture = viewer.playerObject.skin.map?.image;
    if (!texture) return null;
    const ctx = texture.getContext("2d");
    const points = [
      [-2.25, -2.25],
      [2.25, -2.25],
      [-2.25, 2.25],
      [2.25, 2.25],
    ];
    const read = (original: any) => {
      // Isolate mesh geometry from the rig's scale/pose, retaining its real UVs/colors.
      const mesh = new Mesh(original.geometry, original.material);
      const colors = mesh.geometry.getAttribute("color");
      return points.map(([x, z]) => {
        const hit = new Raycaster(
          new Vector3(x, -12, z),
          new Vector3(0, 1, 0),
        ).intersectObject(mesh)[0];
        if (!hit) return "missing";
        let rgb: number[];
        if (colors) {
          rgb = [
            colors.getX(hit.face.a),
            colors.getY(hit.face.a),
            colors.getZ(hit.face.a),
          ];
        } else {
          const u = Math.min(
            texture.width - 1,
            Math.floor(hit.uv.x * texture.width),
          );
          const v = Math.min(
            texture.height - 1,
            Math.floor((1 - hit.uv.y) * texture.height),
          );
          rgb = Array.from(ctx.getImageData(u, v, 1, 1).data).slice(
            0,
            3,
          ) as number[];
        }
        const max = Math.max(...rgb);
        return rgb.map((c) => (c > max * 0.5 ? 1 : 0)).join("");
      });
    };
    const voxel = head.children.find(
      (child: any) =>
        child.name === "head-outer-voxel" ||
        child.name === "head-advanced-voxel",
    );
    return {
      model: viewer.playerObject.skin.modelType,
      inner: read(head.innerLayer),
      flat: read(head.outerLayer),
      flatVisible: head.outerLayer.visible,
      voxel: voxel ? read(voxel) : null,
      voxelVisible: voxel?.visible ?? false,
    };
  });
}

const expected = ["100", "010", "001", "110"];

test("rig transitions, rendered undersides and an empty hat", async ({
  page,
}, testInfo) => {
  await exposeViewer(page);
  await page.goto("/");
  const dataUrl = await makeSkin(page, false, false, 1, 1);
  await page
    .getByRole("button", { name: "Create New File", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "Create a new file" });
  await modal.getByRole("tab", { name: "Upload PNG" }).click();
  await page
    .locator('input[type="file"][accept=".png,image/png"]')
    .nth(1)
    .setInputFiles({
      name: "orientation.png",
      mimeType: "image/png",
      buffer: Buffer.from(dataUrl.split(",")[1], "base64"),
    });
  await modal.getByRole("button", { name: "Create From Uploaded PNG" }).click();
  await expect.poll(async () => (await probe(page))?.inner).toEqual(expected);
  for (const avatar of ["Advanced", "Bobblehead", "Default", "Advanced"]) {
    await page.getByRole("button", { name: "Document", exact: true }).click();
    await page
      .getByRole("button", { name: "Avatar Type", exact: true })
      .click();
    const option = page.getByRole("button", {
      name: new RegExp(`^${avatar} `),
    });
    await option.click();
    await expect(option).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Close document modal" }).click();
    for (const voxel of [false, true]) {
      await page.getByLabel("Show outer layer", { exact: true }).check();
      await page
        .getByLabel("3D outer layer", { exact: true })
        .setChecked(voxel);
      await expect
        .poll(async () => {
          const result = await probe(page);
          return voxel ? result?.voxel : result?.flat;
        })
        .toEqual(expected);
      if (voxel)
        await expect
          .poll(() =>
            page.evaluate(() => {
              const head = (window as any).__headProbe.viewer.playerObject.skin
                .head;
              return head.children.find(
                (child: any) => child.visible && child.name.includes("voxel"),
              )?.name;
            }),
          )
          .toBe(
            avatar === "Advanced" ? "head-advanced-voxel" : "head-outer-voxel",
          );
      // Render a diagnostic underside view, hiding non-head meshes only for this capture.
      await page.evaluate(() => {
        const { viewer, Vector3 } = (window as any).__headProbe;
        const head = viewer.playerObject.skin.head;
        const saved: any[] = [];
        viewer.scene.traverse((object: any) => {
          if (!object.isMesh && !object.isLineSegments) return;
          let parent = object;
          while (parent && parent !== head) parent = parent.parent;
          if (!parent) {
            saved.push([object, object.visible]);
            object.visible = false;
          }
        });
        (window as any).__restoreHeadCapture = () =>
          saved.forEach(([object, visible]) => (object.visible = visible));
        head.updateWorldMatrix(true, true);
        viewer.camera.position.copy(head.localToWorld(new Vector3(0, -24, 0)));
        viewer.camera.up.set(0, 0, -1);
        viewer.controls.enableDamping = false;
        viewer.controls.target.copy(head.localToWorld(new Vector3(0, 4, 0)));
        viewer.controls.update();
        viewer.render();
      });
      await page.screenshot({
        path: testInfo.outputPath(`${avatar}-${voxel ? "voxel" : "flat"}.png`),
      });
      await page.evaluate(() => (window as any).__restoreHeadCapture());
    }
  }
  // A skin without any hat pixels must not leave the previously cached voxel hat behind.
  const emptyHat = await makeSkin(page, false, false, 1, 0);
  await page
    .locator('input[type="file"][accept=".png,image/png"]')
    .first()
    .setInputFiles({
      name: "no-hat.png",
      mimeType: "image/png",
      buffer: Buffer.from(emptyHat.split(",")[1], "base64"),
    });
  await expect
    .poll(async () => {
      const result = await probe(page);
      return { inner: result?.inner, voxel: result?.voxel };
    })
    .toEqual({ inner: expected, voxel: null });
});

const skins = [
  { name: "modern-classic", legacy: false, slim: false },
  { name: "modern-slim", legacy: false, slim: true },
  { name: "legacy", legacy: true, slim: false },
];

for (const skin of skins)
  for (const scale of [1, 2])
    for (const alpha of [1, 0.5])
      for (const source of ["upload", "username"] as const)
        for (const avatar of ["Default", "Bobblehead", "Advanced"]) {
          test(`${skin.name} ${64 * scale}px alpha=${alpha} ${source} ${avatar}`, async ({
            page,
          }, testInfo) => {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await exposeViewer(page);
            await page.goto("/");
            const dataUrl = await makeSkin(
              page,
              skin.legacy,
              skin.slim,
              scale,
              alpha,
            );
            await page.route("**/api/skin?*", (route) =>
              route.fulfill({
                json: {
                  username: "OrientationTest",
                  uuid: "00000000000000000000000000000001",
                  textureUrl: dataUrl,
                  model: skin.slim ? "slim" : "default",
                },
              }),
            );
            await page
              .getByRole("button", { name: "Create New File", exact: true })
              .click();
            const modal = page.getByRole("dialog", {
              name: "Create a new file",
            });
            await modal
              .getByRole("button", { name: new RegExp(`^${avatar} `) })
              .click();
            if (source === "upload") {
              await modal.getByRole("tab", { name: "Upload PNG" }).click();
              await page
                .locator('input[type="file"][accept=".png,image/png"]')
                .nth(1)
                .setInputFiles({
                  name: "orientation.png",
                  mimeType: "image/png",
                  buffer: Buffer.from(dataUrl.split(",")[1], "base64"),
                });
              await modal
                .getByRole("button", { name: "Create From Uploaded PNG" })
                .click();
            } else {
              await modal
                .getByRole("textbox", { name: "Username lookup" })
                .fill("OrientationTest");
              await modal
                .getByRole("button", {
                  name: "Create From Username OrientationTest",
                })
                .click();
            }
            await expect(modal).not.toBeVisible();
            await expect
              .poll(async () => (await probe(page))?.model)
              .toBe(skin.slim ? "slim" : "default");
            // Explicit classic/slim plus auto-detection, on the same viewer to catch stale UV/cache state.
            for (const model of source === "upload"
              ? ["default", "slim", "auto-detect"]
              : ["api"]) {
              if (source === "upload") {
                await page
                  .getByRole("button", { name: "Document", exact: true })
                  .click();
                await page
                  .getByRole("button", { name: "Skin Source", exact: true })
                  .click();
                await page.getByLabel("Uploaded arm model").selectOption(model);
                await page
                  .getByRole("button", { name: "Close document modal" })
                  .click();
              }
              // Username skins retain the API's model preference; this selector controls uploaded skins.
              const resolved =
                source === "username"
                  ? skin.slim
                    ? "slim"
                    : "default"
                  : model === "auto-detect"
                    ? skin.slim
                      ? "slim"
                      : "default"
                    : model;
              await expect
                .poll(async () => (await probe(page))?.model)
                .toBe(resolved);
              for (const mode of ["hidden", "flat", "voxel", "flat"] as const) {
                await page
                  .getByLabel("Show outer layer", { exact: true })
                  .setChecked(mode !== "hidden");
                await page
                  .getByLabel("3D outer layer", { exact: true })
                  .setChecked(mode === "voxel");
                await expect
                  .poll(async () => {
                    const result = await probe(page);
                    return (
                      result && {
                        inner: result.inner,
                        flat: result.flat,
                        flatVisible: result.flatVisible,
                        voxelVisible: result.voxelVisible,
                        ...(mode === "voxel" ? { voxel: result.voxel } : {}),
                      }
                    );
                  })
                  .toEqual({
                    inner: expected,
                    flat: expected,
                    flatVisible: mode === "flat",
                    voxelVisible: mode === "voxel",
                    ...(mode === "voxel" ? { voxel: expected } : {}),
                  });
              }
            }
            await page.screenshot({
              path: testInfo.outputPath("verified.png"),
            });
            expect(errors).toEqual([]);
          });
        }
