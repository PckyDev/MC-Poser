import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function startWorkspace(page: Page) {
  await page.goto("/?private=QUERY_SENTINEL");
  const skin = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fc9823";
    ctx.fillRect(0, 0, 64, 64);
    localStorage.setItem("diagnostic-secret", "STORAGE_SENTINEL");
    return canvas.toDataURL("image/png");
  });
  await page.getByRole("button", { name: "Create New File", exact: true }).click();
  await page.getByRole("tab", { name: "Upload PNG" }).click();
  await page.locator('input[type="file"][accept=".png,image/png"]').nth(1).setInputFiles({
    name: "diagnostic-skin.png", mimeType: "image/png", buffer: Buffer.from(skin.split(",")[1]!, "base64"),
  });
  await page.getByRole("button", { name: "Create From Uploaded PNG" }).click();
  await expect(page.getByRole("dialog", { name: "Create a new file" })).not.toBeVisible();
  await expect(page.getByRole("checkbox", { name: "3D outer layer", exact: true })).toBeEnabled();
  return skin;
}

async function download(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Diagnostics", exact: true }).click();
  const warning = page.getByRole("dialog", { name: "Download diagnostics?", exact: true });
  await expect(warning.getByText(/Nothing is uploaded automatically/)).toBeVisible();
  await warning.getByRole("button", { name: "Download JSON", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/^mc-poser-diagnostics-.*\.json$/);
  return JSON.parse(await readFile((await file.path())!, "utf8"));
}

test("Help downloads a portable workspace and bounded, privacy-filtered runtime diagnostics", async ({ page }) => {
  const skin = await startWorkspace(page);
  await page.getByRole("checkbox", { name: "3D outer layer", exact: true }).check();
  await page.evaluate(() => {
    for (let i = 0; i < 55; i++) window.dispatchEvent(new ErrorEvent("error", {
      message: `Test error ${i} https://example.test/asset?token=ERROR_SENTINEL#private`,
    }));
  });
  await page.getByRole("button", { name: "Help", exact: true }).click();
  const report = await download(page);
  expect(report.format).toBe("mc-poser-diagnostics");
  expect(report.app.build.revision).toMatch(/^[a-f0-9]{40}$/);
  expect(report.workspace.skin.source).toBe(skin);
  expect(report.workspace.showOuterLayerIn3d).toBe(true);
  expect(report.workspace.pose.headPitch).toEqual(expect.any(Number));
  expect(report.rendering.camera.position).toHaveLength(3);
  expect(report.environment.userAgent).toContain("Chrome");
  expect(report.recentErrors).toHaveLength(50);
  expect(report.recentErrors[49].message).toBe("Test error 54 https://example.test/asset");
  expect(report.warnings).toEqual([]);
  expect(JSON.stringify(report)).not.toMatch(/QUERY_SENTINEL|STORAGE_SENTINEL|ERROR_SENTINEL|blob:/);
  // The embedded workspace uses the existing file format, not an approximate pose dump.
  await page.locator('input[accept=".mcpose,application/json"]').setInputFiles({
    name: "reproduced.mcpose", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(report.workspace)),
  });
  await expect(page.getByRole("checkbox", { name: "3D outer layer", exact: true })).toBeChecked();
});

test("bug modal offers the same download with sharing guidance, ideas modal does not", async ({ page }, testInfo) => {
  await startWorkspace(page);
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("button", { name: "Report Bug/Issue", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Report a bug or issue" });
  await expect(modal.getByRole("heading", { name: "Attach diagnostics" })).toHaveCount(0);
  const guidance = modal.locator("section").filter({ has: page.getByRole("heading", { name: "What helps most" }) });
  await expect(guidance.getByRole("button", { name: "Download Diagnostics", exact: true })).toBeVisible();
  await expect(modal.getByText(/Nothing is uploaded automatically/)).toHaveCount(0);
  const report = await download(page);
  expect(report.workspace.skin.label).toContain("diagnostic-skin");
  await modal.screenshot({ path: testInfo.outputPath("bug-report-diagnostics.png") });
  await page.getByRole("button", { name: "Close help modal" }).click();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("button", { name: "Suggest Ideas", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download Diagnostics", exact: true })).toHaveCount(0);
});

test("diagnostics warning cancels without downloading and restores the issue modal", async ({ page }, testInfo) => {
  await startWorkspace(page);
  const downloads: string[] = [];
  page.on("download", (file) => downloads.push(file.suggestedFilename()));
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("button", { name: "Download Diagnostics", exact: true }).click();
  const warning = page.getByRole("dialog", { name: "Download diagnostics?", exact: true });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await warning.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(warning).toHaveCount(0);
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("button", { name: "Report Bug/Issue", exact: true }).click();
  const issue = page.getByRole("dialog", { name: "Report a bug or issue", exact: true });
  await issue.getByRole("button", { name: "Download Diagnostics", exact: true }).click();
  await expect(warning).toBeVisible();
  await warning.screenshot({ path: testInfo.outputPath("diagnostics-warning.png") });
  await page.keyboard.press("Escape");
  await expect(warning).toHaveCount(0);
  await expect(issue.getByRole("button", { name: "Download Diagnostics", exact: true })).toBeFocused();
  expect(downloads).toEqual([]);
});

test("collection tolerates missing WebGL and failed assets without losing other data", async ({ page }) => {
  await page.goto("/");
  await page.route("**/missing-diagnostic.png", (route) => route.fulfill({ status: 404, body: "missing" }));
  const result = await page.evaluate(async () => {
    const modulePath = "/src/lib/diagnostics.ts";
    const { collectDiagnostics, embedDiagnosticAsset } = await import(/* @vite-ignore */ modulePath);
    const warnings: string[] = [];
    const report = collectDiagnostics(null, warnings);
    const asset = await embedDiagnosticAsset({ source: "/missing-diagnostic.png", label: "Missing" }, "Skin", warnings);
    return { report, asset };
  });
  expect(result.report.rendering).toBeNull();
  expect(result.report.warnings).toHaveLength(1);
  expect(result.asset).toEqual({ source: "", label: "Missing" });
});
