import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function setup(page: Page) {
  await page.addInitScript(() => { Object.defineProperty(window, "showSaveFilePicker", { value: undefined }); });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" || /Feedback loop|VALIDATE_STATUS|shader error/i.test(message.text())) errors.push(message.text());
  });
  await page.route("**/src/App.tsx*", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace("viewerRef.current = viewer;",
      "viewerRef.current = viewer; window.__studioViewer = viewer;") });
  });
  await page.goto("/");
  return errors;
}

async function load(page: Page, kind = "modern", avatarType = "default", model = "default", appearance?: unknown) {
  const source = await page.evaluate(kind => {
    const canvas = document.createElement("canvas");
    canvas.width = kind === "hd" ? 128 : 64;
    canvas.height = kind === "legacy" ? 32 : canvas.width;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(canvas.width / 64, canvas.width / 64);
    ctx.fillStyle = "#d88754";
    ctx.fillRect(0, 0, 64, 64);
    ctx.clearRect(32, 0, 32, 16);
    ctx.fillStyle = "rgba(160,190,250,0.7)";
    ctx.fillRect(40, 0, 8, 8);
    return canvas.toDataURL();
  }, kind);
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "studio.mcpose", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
      version: 2, avatarType, uploadModel: model, showOuterLayer: true,
      showOuterLayerIn3d: true, appearance,
      skin: { origin: "upload", label: "studio", source, modelPreference: model },
    })),
  });
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => (window as any).__studioViewer?.playerObject.skin.visible)).toBe(true);
}

async function pixels(page: Page) {
  return page.evaluate(() => {
    const viewer = (window as any).__studioViewer;
    viewer.render();
    const canvas = document.createElement("canvas");
    canvas.width = viewer.canvas.width; canvas.height = viewer.canvas.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(viewer.canvas, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0, transparent = 0, partial = 0, color = 0, warmPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 255) opaque++;
      else if (data[i + 3] === 0) transparent++;
      else partial++;
      color += data[i]! + data[i + 1]! + data[i + 2]!;
      if (data[i]! > data[i + 2]! * 1.2 && data[i]! > 60 && data[i + 3]! > 200) warmPixels++;
    }
    return { opaque, transparent, partial, color, warmPixels };
  });
}

test("Render options collapse to give the inspector space and preserve settings", async ({ page }) => {
  await page.setViewportSize({ width: 881, height: 892 });
  await setup(page);
  await load(page);
  const toggle = page.getByRole("button", { name: "Render options", exact: true });
  await expect(toggle).toHaveCSS("border-top-width", "0px");
  await expect(toggle.locator("svg[data-icon='chevron-down']")).toHaveCount(1);
  const inspector = page.locator(".editor-sidebar--right > .editor-panel--stretch");
  const before = (await inspector.boundingBox())!.height;
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await inspector.boundingBox())!.height).toBeGreaterThan(before + 100);
  await expect(page.getByRole("combobox", { name: "Render style" })).toHaveCount(0);
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("3D outer layer", { exact: true })).toBeChecked();
  await page.getByRole("combobox", { name: "Render style" }).selectOption("stylized");
  await expect(page.getByText("Soft studio lighting", { exact: false })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await toggle.click();
  await toggle.press("Space");
  await expect(page.getByRole("combobox", { name: "Render style" })).toHaveValue("stylized");
});

test("Choosing Stylized applies render defaults together and undo restores previous options", async ({ page }) => {
  await setup(page);
  await load(page);
  await page.getByLabel("3D outer layer", { exact: true }).uncheck();
  await page.getByLabel("Show outer layer", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Document", exact: true }).click();
  await page.getByRole("button", { name: "Avatar Type", exact: true }).click();
  await page.getByRole("button", { name: /^Stylized / }).click();
  await page.getByRole("button", { name: "Close document modal" }).click();
  await expect(page.getByRole("combobox", { name: "Render style" })).toHaveValue("stylized");
  await expect(page.getByLabel("3D outer layer", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Show outer layer", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  await expect(page.getByRole("combobox", { name: "Render style" })).toHaveValue("classic");
  await expect(page.getByLabel("3D outer layer", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Show outer layer", { exact: true })).not.toBeChecked();
});

test("New Stylized avatars get defaults while imported Stylized poses retain their settings", async ({ page }) => {
  await setup(page);
  const source = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#d88754";
    ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL();
  });
  await page.getByRole("button", { name: "Create New File", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Create a new file" });
  await modal.getByRole("button", { name: /^Stylized / }).click();
  await modal.getByRole("tab", { name: "Upload PNG" }).click();
  await page.locator('input[type="file"][accept=".png,image/png"]').nth(1).setInputFiles({
    name: "studio.png", mimeType: "image/png", buffer: Buffer.from(source.split(",")[1]!, "base64"),
  });
  await modal.getByRole("button", { name: "Create From Uploaded PNG" }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole("combobox", { name: "Render style" })).toHaveValue("stylized");
  await expect(page.getByLabel("3D outer layer", { exact: true })).toBeChecked();
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "saved.mcpose", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
      version: 2, avatarType: "stylized", showOuterLayer: false, showOuterLayerIn3d: false,
      appearance: { mode: "classic" },
      skin: { origin: "upload", source, label: "studio", modelPreference: "default" },
    })),
  });
  await expect(page.getByRole("combobox", { name: "Render style" })).toHaveValue("classic");
  await expect(page.getByLabel("3D outer layer", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Show outer layer", { exact: true })).not.toBeChecked();
});

for (const kind of ["modern", "legacy", "hd"])
  for (const avatar of ["default", "bobblehead", "advanced", "stylized"])
    test(`studio matrix ${kind} ${avatar}`, async ({ page }) => {
      const errors = await setup(page);
      for (const model of ["default", "slim"]) {
        await load(page, kind, avatar, model);
        for (const layer of ["hidden", "flat", "voxel"]) {
          await page.getByLabel("3D outer layer", { exact: true }).setChecked(layer === "voxel");
          await page.getByLabel("Show outer layer", { exact: true }).setChecked(layer !== "hidden");
          const before = await pixels(page);
          expect(before.warmPixels).toBeGreaterThan(500);
          await page.getByRole("combobox", { name: "Render style", exact: true }).selectOption("stylized");
          const styled = await pixels(page);
          expect(styled.opaque).toBeGreaterThan(500);
          expect(styled.color).toBeGreaterThan(20000);
          expect(styled.transparent).toBeGreaterThan(500);
          expect(styled.color).not.toBe(before.color);
          await expect(page.getByRole("button", { name: "Use unlit viewport" })).toBeDisabled();
          await page.getByRole("combobox", { name: "Render style", exact: true }).selectOption("classic");
          const restored = await pixels(page);
          expect(restored).toEqual(before);
        }
      }
      expect(errors).toEqual([]);
    });

test("warm glow colors surfaces without expanding the transparency mask", async ({ page }) => {
  const errors = await setup(page);
  await load(page, "modern", "stylized");
  await page.getByRole("combobox", { name: "Render style", exact: true }).selectOption("stylized");
  await page.getByRole("slider", { name: /^Glow/ }).fill("0");
  await page.evaluate(() => {
    const viewer = (window as any).__studioViewer;
    // Color-sensitive FXAA can change edge coverage independently of the rim.
    viewer.fxaaPass.enabled = false;
    const capture = () => {
      viewer.render();
      const canvas = document.createElement("canvas");
      canvas.width = viewer.canvas.width; canvas.height = viewer.canvas.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(viewer.canvas, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    (window as any).__rimCapture = capture;
    (window as any).__rimBaseline = capture();
  });
  await page.getByRole("slider", { name: /^Glow/ }).fill("1");
  const result = await page.evaluate(() => {
    const before = (window as any).__rimBaseline;
    const after = (window as any).__rimCapture();
    let alphaChanges = 0, litPixels = 0, unchangedOpaque = 0, darkenedPixels = 0;
    for (let i = 0; i < after.length; i += 4) {
      if (before[i + 3] !== after[i + 3]) alphaChanges++;
      if (after[i + 3] > 200 && after[i] > before[i] + 5) litPixels++;
      if (after[i + 3] === 255 && Math.abs(after[i] - before[i]) < 2) unchangedOpaque++;
      if (after[i + 3] === 255 && [0, 1, 2].some(channel => after[i + channel] < before[i + channel] - 1)) darkenedPixels++;
    }
    return { alphaChanges, litPixels, unchangedOpaque, darkenedPixels };
  });
  expect(result.alphaChanges).toBe(0);
  expect(result.litPixels).toBeGreaterThan(100);
  expect(result.unchangedOpaque).toBeGreaterThan(100);
  expect(result.darkenedPixels).toBe(0);
  const restored = await page.evaluate(() => {
    const viewer = (window as any).__studioViewer;
    let captureActive = false, broadNormals = false;
    viewer.playerObject.traverse((mesh: any) => {
      if (!mesh.isMesh) return;
      if (mesh.geometry.userData.sculptedAvatar && mesh.geometry.hasAttribute("studioLocal")) broadNormals = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      captureActive ||= materials.some((material: any) => material.userData.studioHighlightCapture?.value);
    });
    return { captureActive, broadNormals };
  });
  expect(restored).toEqual({ captureActive: false, broadNormals: false });
  expect(errors).toEqual([]);
});

test("Glow spreads inward from the silhouette instead of lighting whole sides", async ({ page }) => {
  const errors = await setup(page);
  await load(page, "modern", "stylized", "default", { mode: "stylized", brightness: 1, warmth: 0.65, glow: 0 });
  await page.evaluate(() => {
    const viewer = (window as any).__studioViewer;
    viewer.fxaaPass.enabled = false;
    viewer.controls.enableDamping = false;
    viewer.setSize(400, 600);
    viewer.camera.position.copy(viewer.controls.target).add({ x: 24, y: 8, z: 60 });
    viewer.camera.lookAt(viewer.controls.target); viewer.controls.update();
    const capture = () => {
      viewer.render();
      const canvas = document.createElement("canvas");
      canvas.width = viewer.canvas.width; canvas.height = viewer.canvas.height;
      const ctx = canvas.getContext("2d")!; ctx.drawImage(viewer.canvas, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };
    (window as any).__reachCapture = capture;
    (window as any).__reachBaseline = capture();
  });
  const samples = [];
  for (const glow of ["0.2", "0.85"]) {
    await page.getByRole("slider", { name: /^Glow/ }).fill(glow);
    samples.push(await page.evaluate(() => {
      const base: ImageData = (window as any).__reachBaseline;
      const next: ImageData = (window as any).__reachCapture();
      const { width, height } = base;
      const distance = new Int32Array(width * height).fill(-1);
      const queue = new Int32Array(width * height);
      let head = 0, tail = 0;
      for (let i = 0; i < distance.length; i++) if (base.data[i * 4 + 3]! < 40) { distance[i] = 0; queue[tail++] = i; }
      while (head < tail) {
        const i = queue[head++]!, x = i % width;
        for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
          if (j < 0 || j >= distance.length || distance[j] !== -1) continue;
          distance[j] = distance[i]! + 1; queue[tail++] = j;
        }
      }
      let count = 0, farthest = 0, alphaChanges = 0, darkened = 0;
      for (let i = 0; i < distance.length; i++) {
        const p = i * 4;
        if (base.data[p + 3] !== next.data[p + 3]) alphaChanges++;
        if (base.data[p + 3] !== 255) continue;
        if (next.data[p]! > base.data[p]! + 3) { count++; farthest = Math.max(farthest, distance[i]!); }
        if ([0, 1, 2].some(c => next.data[p + c]! < base.data[p + c]! - 1)) darkened++;
      }
      return { count, farthest, alphaChanges, darkened };
    }));
  }
  expect(samples[0]!.count).toBeGreaterThan(20);
  expect(samples[0]!.farthest).toBeLessThan(7);
  expect(samples[1]!.count).toBeGreaterThan(samples[0]!.count * 1.5);
  expect(samples[1]!.farthest).toBeGreaterThan(samples[0]!.farthest + 3);
  for (const sample of samples) { expect(sample.alphaChanges).toBe(0); expect(sample.darkened).toBe(0); }
  expect(errors).toEqual([]);
});

test("studio save, reload, undo, normalization and transparent exports", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await setup(page);
  await load(page, "modern", "stylized");
  const style = page.getByRole("combobox", { name: "Render style", exact: true });
  await style.selectOption("stylized");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  await expect(style).toHaveValue("classic");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Redo/ }).click();
  await expect(style).toHaveValue("stylized");
  await page.getByRole("slider", { name: /^Warmth/ }).fill("0.8");
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = JSON.parse(await readFile((await (await saved).path())!, "utf8"));
  expect(file.appearance).toEqual({ mode: "stylized", brightness: 1, warmth: 0.8, glow: 0.35 });
  expect(file.avatarType).toBe("stylized");
  await style.selectOption("classic");
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "restored.mcpose", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(style).toHaveValue("stylized");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("button", { name: "Generate Link", exact: true }).first().click();
  const link = page.locator("textarea.share-link-field").first();
  await expect(link).toBeVisible();
  const shareUrl = await link.inputValue();
  const shared = new URL(shareUrl);
  await page.goto("about:blank");
  await page.goto(`/${shared.search}${shared.hash}`);
  await expect(style).toHaveValue("stylized");
  for (const format of ["png", "webp", "jpg"]) {
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Export", exact: true });
    await modal.getByLabel("Width", { exact: true }).fill("512");
    await modal.getByLabel("Height", { exact: true }).fill("640");
    await modal.getByLabel("File type", { exact: true }).selectOption(format);
    await expect(modal.getByAltText("Export preview")).toBeVisible();
    const pending = page.waitForEvent("download");
    await modal.getByRole("button", { name: /Export/ }).click();
    const bytes = await readFile((await (await pending).path())!);
    const sample = await page.evaluate(async ({ base64, format }) => {
      const img = new Image();
      img.src = `data:image/${format === "jpg" ? "jpeg" : format};base64,${base64}`;
      await img.decode();
      const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d")!; ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      return { width: img.width, height: img.height, corner: data[3], center: data[(320 * img.width + 256) * 4 + 3] };
    }, { base64: bytes.toString("base64"), format });
    expect(sample).toEqual({ width: 512, height: 640, corner: format === "jpg" ? 255 : 0, center: 255 });
  }
  await load(page, "modern", "default", "default", { mode: "stylized", brightness: 100, warmth: -5, glow: "bad" });
  await expect(page.getByRole("slider", { name: /^Brightness/ })).toHaveValue("1.5");
  await expect(page.getByRole("slider", { name: /^Warmth/ })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: /^Glow/ })).toHaveValue("0.35");
  expect(errors).toEqual([]);
});

test("studio follows rig switches and rebuilt elbow-cap surfaces", async ({ page }) => {
  test.setTimeout(180000);
  const errors = await setup(page);
  await load(page);
  await page.getByRole("combobox", { name: "Render style", exact: true }).selectOption("stylized");
  const unstyled = () => page.evaluate(() => {
    const meshes: string[] = [];
    (window as any).__studioViewer.playerObject.traverse((object: any) => {
      if (object.isMesh && (Array.isArray(object.material) ? object.material : [object.material])
        .some((material: any) => material.name !== "MC Poser stylized surface")) meshes.push(object.name);
    });
    return meshes;
  });
  for (const avatar of ["Stylized", "Advanced", "Bobblehead", "Default", "Stylized", "Advanced"]) {
    await page.getByRole("button", { name: "Document", exact: true }).click();
    await page.getByRole("button", { name: "Avatar Type", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`^${avatar} `) }).click();
    await page.getByRole("button", { name: "Close document modal" }).click();
    await expect.poll(unstyled).toEqual([]);
  }
  await page.getByRole("button", { name: "Left Arm", exact: true }).click();
  await page.getByRole("button", { name: "Bottom of top arm", exact: true }).click();
  await page.getByLabel("U", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Close arm cap texture modal" }).click();
  await expect.poll(unstyled).toEqual([]);
  expect((await pixels(page)).color).toBeGreaterThan(20000);
  expect(errors).toEqual([]);
});

for (const avatar of ["advanced", "stylized"]) for (const model of ["default", "slim"])
  test(`shoulder pivot and articulated chain ${avatar} ${model}`, async ({ page }) => {
    const errors = await setup(page);
    await load(page, "modern", avatar, model);
    const results = await page.evaluate(async ({ avatar }) => {
      const viewer = (window as any).__studioViewer;
      const { applyAvatarType, applyPose } = await import("/src/utils/editor.ts");
      const { NEUTRAL_POSE } = await import("/src/config/pose.ts");
      const { getAdvancedAvatarHandAnchor } = await import("/src/utils/avatarRig.ts");
      applyAvatarType(viewer, avatar);
      applyPose(viewer, { ...NEUTRAL_POSE });
      const skin = viewer.playerObject.skin;
      const results = [];
      for (const side of ["leftArm", "rightArm"] as const) {
        const arm = skin[side];
        const root = arm.getObjectByName(`${side}-advanced-rig`);
        const hand = getAdvancedAvatarHandAnchor(viewer, side)!;
        const upper = root.children.find((child: any) => child.isMesh);
        viewer.playerObject.updateMatrixWorld(true);
        const before = arm.getWorldPosition(arm.position.clone());
        const top = root.position.y + upper.position.y + 3;
        const elbow = root.position.y + hand.position.y;
        const wrist = root.position.y + hand.position.y - 6;
        arm.rotation.set(1.1, -0.6, 0.4);
        hand.rotation.x = -1.3;
        viewer.playerObject.updateMatrixWorld(true);
        const after = arm.getWorldPosition(arm.position.clone());
        results.push({ shoulderY: arm.position.y, top, elbow, wrist,
          drift: before.distanceTo(after), attached: hand.parent === root });
      }
      return results;
    }, { avatar });
    for (const result of results) {
      expect(result.shoulderY).toBe(4);
      expect(result.top).toBe(2);
      expect(result.elbow).toBe(-4);
      expect(result.wrist).toBe(-10);
      expect(result.drift).toBeLessThan(1e-8);
      expect(result.attached).toBe(true);
    }
    expect(errors).toEqual([]);
  });

test("Stylized legs taper continuously through the knee", async ({ page }) => {
  const errors = await setup(page);
  await load(page, "modern", "stylized");
  const widths = await page.evaluate(() => {
    const skin = (window as any).__studioViewer.playerObject.skin;
    return [skin.leftLeg, skin.rightLeg].map(leg => {
      const root = leg.getObjectByName(`${leg.name}-advanced-rig`);
      const upper = root.children.find((child: any) => child.isMesh);
      const joint = root.children.find((child: any) => child.isGroup);
      const lower = joint.children.find((child: any) => child.isMesh);
      const width = (mesh: any, y: number) => {
        const positions = mesh.geometry.getAttribute("position");
        let minimum = Infinity, maximum = -Infinity;
        for (let i = 0; i < positions.count; i++) {
          if (Math.abs(positions.getY(i) - y) < 0.0001) {
            minimum = Math.min(minimum, positions.getX(i));
            maximum = Math.max(maximum, positions.getX(i));
          }
        }
        return maximum - minimum;
      };
      let nearestInnerEdge = Infinity;
      const sign = leg.name === "leftLeg" ? 1 : -1;
      joint.children.filter((child: any) => child.isMesh && child.visible).forEach((mesh: any) => {
        const positions = mesh.geometry.getAttribute("position");
        for (let i = 0; i < positions.count; i++) {
          nearestInnerEdge = Math.min(nearestInnerEdge, sign * (leg.position.x + positions.getX(i) * leg.scale.x));
        }
      });
      return { hip: width(upper, 3), upperKnee: width(upper, -3), lowerKnee: width(lower, 3), foot: width(lower, -3), jointScale: joint.scale.toArray(), nearestInnerEdge };
    });
  });
  for (const width of widths) {
    expect(width.hip).toBeGreaterThan(3);
    expect(width.upperKnee).toBeCloseTo(width.lowerKnee, 5);
    expect(width.foot).toBeGreaterThan(width.hip * 1.25);
    expect(width.jointScale).toEqual([1, 1, 1]);
    expect(width.nearestInnerEdge).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test("sculpted geometry preserves UV placement, hidden caps and restores original buffers", async ({ page }) => {
  await setup(page);
  await load(page);
  const result = await page.evaluate(async () => {
    const template = (window as any).__studioViewer.playerObject.skin.head.innerLayer;
    const { syncStylizedAvatarGeometry } = await import("/src/lib/stylizedAvatar.ts");
    const source = new template.geometry.constructor(8, 8, 8);
    // Omit the top face, like the articulated rig's joint caps.
    source.setIndex(Array.from(source.index.array).filter((_: number, i: number) => i < 12 || i >= 18));
    const mesh = new template.constructor(source, template.material.clone());
    syncStylizedAvatarGeometry(mesh, true);
    const styled = mesh.geometry;
    const positions = styled.getAttribute("position"), uv = styled.getAttribute("uv"), normals = styled.getAttribute("normal");
    let largestUvError = 0, topFaces = 0;
    for (let i = 0; i < positions.count; i++) {
      if (normals.getZ(i) > 0.999) {
        largestUvError = Math.max(largestUvError, Math.abs(uv.getX(i) - (positions.getX(i) + 4) / 8), Math.abs(uv.getY(i) - (positions.getY(i) + 4) / 8));
      }
      if (normals.getY(i) > 0.999) topFaces++;
    }
    syncStylizedAvatarGeometry(mesh, true);
    const reused = mesh.geometry === styled;
    syncStylizedAvatarGeometry(mesh, false);
    const restored = mesh.geometry === source;
    source.dispose(); mesh.material.dispose();
    return { largestUvError, topFaces, reused, restored };
  });
  expect(result.largestUvError).toBeLessThan(0.00001);
  expect(result.topFaces).toBe(0);
  expect(result.reused).toBe(true);
  expect(result.restored).toBe(true);
});

test("Stylized avatar switches, undo and saved shares retain articulated controls", async ({ page }) => {
  const errors = await setup(page);
  await load(page, "modern", "advanced");
  const snapshot = () => page.evaluate(() => {
    const v = (window as any).__studioViewer;
    const result: unknown[] = [];
    v.playerObject.skin.traverseVisible((o: any) => {
      if (o.isMesh) result.push([o.name, o.geometry.getAttribute("position").count, o.scale.toArray()]);
    });
    // Rebuilding attaches meshes in a different order without changing geometry.
    return result.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  });
  const before = await snapshot();
  await page.getByRole("button", { name: "Document", exact: true }).click();
  await page.getByRole("button", { name: "Avatar Type", exact: true }).click();
  await page.getByRole("button", { name: /^Stylized / }).click();
  await page.getByRole("button", { name: "Close document modal" }).click();
  expect(await snapshot()).not.toEqual(before);
  await expect(page.getByRole("button", { name: "Left elbow bend", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Undo/ }).click();
  expect(await snapshot()).toEqual(before);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /^Redo/ }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("button", { name: "Generate Link", exact: true }).first().click();
  const link = page.locator("textarea.share-link-field").first();
  await expect(link).toBeVisible();
  const shared = new URL(await link.inputValue());
  await page.goto("about:blank");
  await page.goto(`/${shared.search}${shared.hash}`);
  await expect(page.getByRole("button", { name: "Left elbow bend", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Document", exact: true }).click();
  await page.getByRole("button", { name: "Avatar Type", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Stylized / })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
