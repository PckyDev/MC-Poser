type MinecraftArmModel = "default" | "slim";

type ResolvedMinecraftSkin = {
  username: string;
  uuid: string;
  textureUrl: string;
  model: MinecraftArmModel;
};

type MojangProfileResponse = {
  id: string;
  name: string;
};

type MojangSessionResponse = {
  properties?: Array<{
    name: string;
    value: string;
  }>;
};

type TexturePayload = {
  textures?: {
    SKIN?: {
      url?: string;
      metadata?: {
        model?: string;
      };
    };
  };
};

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const JSON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json; charset=utf-8",
};

function decodeBase64(value: string): string {
  const sanitizedValue = value.replace(/\s+/g, "");

  if (!sanitizedValue || sanitizedValue.length % 4 === 1) {
    throw new Error("The Minecraft texture payload was invalid.");
  }

  const decodedBytes: number[] = [];

  for (let index = 0; index < sanitizedValue.length; index += 4) {
    const chunk = sanitizedValue.slice(index, index + 4);
    const paddingLength = chunk.endsWith("==") ? 2 : chunk.endsWith("=") ? 1 : 0;
    const chunkValues = Array.from(chunk, (character) => {
      if (character === "=") {
        return 0;
      }

      const characterIndex = BASE64_ALPHABET.indexOf(character);

      if (characterIndex === -1) {
        throw new Error("The Minecraft texture payload was invalid.");
      }

      return characterIndex;
    });
    const [first, second, third, fourth] = chunkValues;
    const combinedValue =
      ((first ?? 0) << 18) |
      ((second ?? 0) << 12) |
      ((third ?? 0) << 6) |
      (fourth ?? 0);

    decodedBytes.push((combinedValue >> 16) & 0xff);

    if (paddingLength < 2) {
      decodedBytes.push((combinedValue >> 8) & 0xff);
    }

    if (paddingLength < 1) {
      decodedBytes.push(combinedValue & 0xff);
    }
  }

  return new TextDecoder().decode(new Uint8Array(decodedBytes));
}

function normalizeTextureUrl(value: string): string {
  return value.startsWith("http://")
    ? value.replace("http://", "https://")
    : value;
}

async function resolveMinecraftSkin(
  username: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedMinecraftSkin> {
  const trimmedUsername = username.trim();

  if (!/^[A-Za-z0-9_]{2,16}$/.test(trimmedUsername)) {
    throw new Error(
      "Minecraft usernames must be 2-16 characters using letters, numbers, or underscores.",
    );
  }

  const profileResponse = await fetchImpl(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(trimmedUsername)}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (profileResponse.status === 204 || profileResponse.status === 404) {
    throw new Error(`No skin found for ${trimmedUsername}.`);
  }

  if (!profileResponse.ok) {
    throw new Error("Minecraft profile lookup failed.");
  }

  const profile = (await profileResponse.json()) as MojangProfileResponse;

  const sessionResponse = await fetchImpl(
    `https://sessionserver.mojang.com/session/minecraft/profile/${profile.id}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!sessionResponse.ok) {
    throw new Error("Minecraft texture lookup failed.");
  }

  const sessionPayload = (await sessionResponse.json()) as MojangSessionResponse;
  const textureProperty = sessionPayload.properties?.find(
    (property) => property.name === "textures",
  );

  if (!textureProperty) {
    throw new Error(`No skin texture payload was returned for ${profile.name}.`);
  }

  const texturePayload = JSON.parse(decodeBase64(textureProperty.value)) as TexturePayload;
  const textureUrl = texturePayload.textures?.SKIN?.url;

  if (!textureUrl) {
    throw new Error(`No skin texture URL was returned for ${profile.name}.`);
  }

  return {
    username: profile.name,
    uuid: profile.id,
    textureUrl: normalizeTextureUrl(textureUrl),
    model:
      texturePayload.textures?.SKIN?.metadata?.model === "slim"
        ? "slim"
        : "default",
  };
}

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
