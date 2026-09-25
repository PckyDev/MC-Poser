# MC Poser

MC Poser is a browser-based editor for posing Minecraft skins in 3D. Load a skin from a username or PNG, pose it with direct joint controls and viewport gizmos, then export a polished render or share the full scene with a compact link.

![MC Poser preview](src/img/pockydev-pose.png)

[Live app](https://mcposer.pcky.dev) · [Support on Ko-Fi](https://ko-fi.com/pockydev) · [Report an issue](https://github.com/PckyDev/MC-Poser/issues)

## Highlights

- Load skins from Mojang username lookups or local PNG files.
- Pose characters with sliders, presets, and in-viewport rotation gizmos.
- Switch between default, bobblehead, and advanced avatar rigs.
- Bend the lower torso, spine, elbows, and knees with per-joint controls.
- Support classic, slim, and auto-detect arm models.
- Toggle the outer layer, including voxel-style 3D outer layer rendering.
- Export PNG, JPG, or WebP renders with custom resolution and background settings.
- Generate compact share links for full projects and rendered image outputs.

## Workflow

1. Load a skin from a Minecraft username or a PNG file.
2. Choose an avatar type and arm model.
3. Pose the character in the viewport or inspector.
4. Export a render or share the scene with a link.

## Built With

- React 19
- TypeScript 6
- Vite 8
- skinview3d
- Cloudflare Pages Functions

## Getting Started

### Requirements

- Node.js `^20.19.0 || >=22.12.0`
- npm 10 or newer recommended

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

The local dev server includes the `/api/skin` middleware used for username-based skin lookups.

### Production build

```bash
npm run build
```

### Preview the static build

```bash
npm run preview
```

`npm run preview` serves the static client only and does not include the `/api/skin` lookup route.

## Regression tests

```bash
npx playwright install chromium
npm run test:e2e
npm run typecheck
```

The head-underside suite generates asymmetric four-color PNG fixtures and tests the
actual viewer meshes through Chromium. It covers modern classic/slim and legacy
skins, 64px and 128px atlases, opaque and translucent hat pixels, PNG upload and
mocked username lookup, all three avatar rigs, explicit classic/slim arms and
upload auto-detection, and hidden/flat/3D outer layers (including switching back).
Username lookups are mocked for reproducibility, not used as live Mojang API tests.
Geometry probes check all four underside quadrants of both head and hat, including
the separate Advanced voxel renderer. Test-only viewer access is injected by
Playwright into the dev response and is not included in the production bundle.
An additional test switches rigs on the same viewer, captures flat/3D undersides,
and checks that loading a skin without a hat clears the old voxel geometry.

## Support

### Diagnostics for bug reports

Choose **Help > Download Diagnostics**, or use **Download Diagnostics** in
**Help > Report Bug/Issue**. The JSON includes the active document's pose,
skin and held-item images, arm/rig/layer settings, camera, lighting/export
settings, browser/GPU details, build revision, and up to 50 recent uncaught
errors. Failed asset collection is listed in `warnings` without preventing
the rest of the download.

Review the file before sharing: it includes document/image labels, usernames,
and error text. Nothing is uploaded automatically. Cookies, browser storage,
other open documents, and page query strings/share hashes are not collected.
For reproduction, save the report's `workspace` object as a `.mcpose` JSON
file and open it with **File > Open**. Apply camera, lighting, and export
settings from `rendering` and `editor` separately. A warning about a missing
image means that original image is also needed.

The diagnostics Playwright tests verify both entry points, workspace reopening,
error limits, privacy exclusions, and graceful collection failures.

- Support development on Ko-Fi: https://ko-fi.com/pockydev
- Suggest ideas or report bugs through the in-app `Help` menu.
- GitHub issues: https://github.com/PckyDev/MC-Poser/issues
