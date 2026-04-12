# MC Poser

MC Poser is a browser-based editor for posing Minecraft skins in 3D. You can load a skin from a username or PNG, adjust the model with per-joint controls, export polished renders, and share either the scene or the final image with a compact link.

## What it does

- Loads Minecraft skins from Mojang profile lookups or local PNG files.
- Supports classic, slim, and auto-detect arm models.
- Provides a live 3D viewport with orbit controls, lighting modes, and a camera gizmo.
- Lets you pose the head, torso, arms, and legs with direct controls and presets.
- Exports images with configurable size, format, and background settings.
- Generates shareable links for projects and rendered outputs.

## Built with

- React
- TypeScript
- Vite
- skinview3d
- Cloudflare Pages Functions

## Getting started

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

`npm run preview` serves the built client only. If you want to test the Cloudflare Pages Function locally after a build, run:

```bash
npx wrangler pages dev dist
```

## Deploying to Cloudflare Pages

This repository is already structured for Cloudflare Pages and includes the Pages Function used for `/api/skin`.

Use these settings when creating the Pages project:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22`
- Root directory: `/`

The existing [wrangler.toml](wrangler.toml) file matches that setup.

## Project notes

- Username lookups are handled through Mojang profile APIs
- Shared project and image links are encoded in the URL hash.
- The client app builds to static assets in `dist`, while the API route is provided through `functions/api/skin.ts`.