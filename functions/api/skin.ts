import { resolveMinecraftSkin } from "../../shared/minecraftProfile";

const JSON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

export function onRequestOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: JSON_HEADERS,
  });
}

export async function onRequestGet(context: {
  request: Request;
}): Promise<Response> {
  const requestUrl = new URL(context.request.url);
  const username = requestUrl.searchParams.get("username")?.trim() ?? "";

  if (!username) {
    return jsonResponse(400, {
      error: "Add a username query parameter.",
    });
  }

  try {
    const skin = await resolveMinecraftSkin(username);
    return jsonResponse(200, skin);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to resolve that Minecraft skin.";

    return jsonResponse(
      /username|No skin found/i.test(message) ? 400 : 502,
      { error: message },
    );
  }
}
