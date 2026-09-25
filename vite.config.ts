import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import type { ServerResponse } from "node:http";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { resolveMinecraftSkin } from "./shared/minecraftProfile";

function writeJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  const body = JSON.stringify(payload);

  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=300");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
}

function minecraftSkinApiPlugin(): Plugin {
  return {
    name: "mc-poser-dev-skin-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = request.url
          ? new URL(request.url, "http://localhost")
          : null;

        if (!requestUrl || requestUrl.pathname !== "/api/skin") {
          next();
          return;
        }

        if (request.method !== "GET") {
          writeJson(response, 405, {
            error: "Only GET requests are supported.",
          });
          return;
        }

        const username = requestUrl.searchParams.get("username")?.trim() ?? "";

        if (!username) {
          writeJson(response, 400, {
            error: "Add a username query parameter.",
          });
          return;
        }

        try {
          const skin = await resolveMinecraftSkin(username);
          writeJson(response, 200, skin);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to resolve that Minecraft skin.";

          writeJson(
            response,
            /username|No skin found/i.test(message) ? 400 : 502,
            { error: message },
          );
        }
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_BUILD__: JSON.stringify({
      revision: (() => {
        try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
        catch { return "unknown"; }
      })(),
      builtAt: new Date().toISOString(),
    }),
  },
  plugins: [react(), minecraftSkinApiPlugin()],
});
