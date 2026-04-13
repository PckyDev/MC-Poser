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

## Support

- Support development on Ko-Fi: https://ko-fi.com/pockydev
- Suggest ideas or report bugs through the in-app `Help` menu.
- GitHub issues: https://github.com/PckyDev/MC-Poser/issues