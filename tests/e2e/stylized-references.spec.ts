import { test, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Opt-in local art-direction checks. Never commit users' skin/pose files.
const referenceDirectory = process.env.MC_POSER_REFERENCE_DIR;
for (const name of ["PockyDev", "SkylarIsGolden", "ORGCreator"]) {
  test(`reference render ${name}`, async ({ page }, testInfo) => {
    test.skip(!referenceDirectory, "Set MC_POSER_REFERENCE_DIR to the folder containing the supplied mcpose files.");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text());
      if (message.text().includes("Feedback loop")) errors.push(message.text()); });
    await page.route("**/src/App.tsx*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      await route.fulfill({ response, body: source.replace("viewerRef.current = viewer;",
        "viewerRef.current = viewer; window.__styleViewer = viewer;") });
    });
    await page.goto("/");
    const file = JSON.parse(await readFile(path.join(referenceDirectory!, `${name}.mcpose`), "utf8"));
    const sculpted = process.env.MC_POSER_SCULPTED === "1";
    if (sculpted) {
      file.poseFileName = `${name}-stylized-review.mcpose`;
      file.avatarType = "stylized";
      file.showOuterLayerIn3d = true;
      // Separate art-directed copies, never changes to the supplied files.
      if (name === "PockyDev") Object.assign(file.pose, { headPitch: -12, headRoll: 3, leftArmPitch: -155, rightArmPitch: -155, leftArmRoll: 55, rightArmRoll: -55, leftElbowPitch: 15, rightElbowPitch: 15, rightArmYaw: 18, leftLegRoll: 18, rightLegRoll: -5, leftLegPitch: -10, leftKneePitch: 15, rightKneePitch: 8 });
      if (name === "SkylarIsGolden") Object.assign(file.pose, { headRoll: 12, leftArmPitch: -40, rightArmPitch: -40, leftLegRoll: 2, rightLegRoll: -2 });
      if (name === "ORGCreator") Object.assign(file.pose, { headRoll: -6 });
      file.appearance = { mode: "stylized", brightness: name === "PockyDev" ? 0.94 : 1, warmth: name === "PockyDev" ? 0.45 : 0.65, glow: 0.35 };
    }
    await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
      name: `${name}.mcpose`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(file)),
    });
    await expect(page.getByRole("button", { name: "Export", exact: true })).toBeEnabled();
    await expect.poll(() => page.evaluate(() => (window as any).__styleViewer?.playerObject.skin.visible)).toBe(true);
    const outputDir = path.resolve(".debug/stylized-references", process.env.MC_POSER_ITERATION ?? "current");
    await mkdir(outputDir, { recursive: true });
    if (sculpted) await writeFile(path.join(outputDir, `${name}-stylized.mcpose`), JSON.stringify(file, null, 2));
    for (const mode of sculpted ? ["stylized"] : ["classic", "stylized"]) {
      await page.getByRole("combobox", { name: "Render style", exact: true }).selectOption(mode);
      await page.evaluate((sculpted) => {
        const viewer = (window as any).__styleViewer;
        viewer.scene.traverse((object: any) => {
          if (object.type === "LineSegments" || object.type === "TransformControls") object.visible = false;
        });
        viewer.controls.enableDamping = false;
        viewer.setSize(800, 1000);
        viewer.camera.position.copy(viewer.controls.target).add(sculpted ? { x: 20, y: 15, z: 70 } : { x: 22, y: 10, z: 58 });
        viewer.camera.lookAt(viewer.controls.target);
        viewer.controls.update();
        viewer.render();
      }, sculpted);
      await page.getByRole("button", { name: "Export", exact: true }).click();
      const modal = page.getByRole("dialog", { name: "Export", exact: true });
      await modal.getByLabel("Width", { exact: true }).fill("800");
      await modal.getByLabel("Height", { exact: true }).fill("1000");
      const pending = page.waitForEvent("download");
      await modal.getByRole("button", { name: "Export Image", exact: true }).click();
      await (await pending).saveAs(path.join(outputDir, `${name}-${mode}.png`));
    }
    if (sculpted) {
      if (name === "PockyDev" && process.env.MC_POSER_GLOW_SWEEP === "1") {
        for (const glow of [0.15, 0.35, 0.85]) {
          await page.getByRole("slider", { name: "Glow", exact: true }).fill(String(glow));
          await page.getByRole("button", { name: "Export", exact: true }).click();
          const modal = page.getByRole("dialog", { name: "Export", exact: true });
          await modal.getByLabel("Width", { exact: true }).fill("800");
          await modal.getByLabel("Height", { exact: true }).fill("1000");
          const download = page.waitForEvent("download");
          await modal.getByRole("button", { name: "Export Image", exact: true }).click();
          await (await download).saveAs(path.join(outputDir, `${name}-glow-${Math.round(glow * 100)}.png`));
        }
      }
      expect(errors).toEqual([]); return;
    }
    // Explicitly opt into the extra geometry for a second comparison, preserving
    // the original file and recording that this differs from its saved settings.
    await page.getByRole("checkbox", { name: "3D outer layer", exact: true }).check();
    await page.evaluate(() => (window as any).__styleViewer.render());
    const enhanced = await page.evaluate(() => (window as any).__styleViewer.canvas.toDataURL("image/png"));
    await writeFile(path.join(outputDir, `${name}-stylized-3d.png`), Buffer.from(enhanced.split(",")[1], "base64"));
    // Exercise the actual export path too, including reframing and hidden gizmos.
    for (const variant of name === "PockyDev" ? ["supplied-rig", "advanced-rig"] : ["supplied-rig"]) {
      if (variant === "advanced-rig") {
        await page.getByRole("button", { name: "Document", exact: true }).click();
        await page.getByRole("button", { name: "Avatar Type", exact: true }).click();
        await page.getByRole("button", { name: /^Advanced / }).click();
        await page.getByRole("button", { name: "Close document modal" }).click();
      }
      await page.getByRole("button", { name: "Export", exact: true }).click();
      const modal = page.getByRole("dialog", { name: "Export", exact: true });
      await modal.getByLabel("Width", { exact: true }).fill("800");
      await modal.getByLabel("Height", { exact: true }).fill("1000");
      const download = page.waitForEvent("download");
      await modal.getByRole("button", { name: /Export/ }).click();
      await (await download).saveAs(path.join(outputDir, `${name}-${variant}-export.png`));
    }
    await page.screenshot({ path: testInfo.outputPath("editor.png") });
    expect(errors.filter((message) => !message.includes("favicon"))).toEqual([]);
  });
}
