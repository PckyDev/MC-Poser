export type MinecraftArmModel = "default" | "slim";

export type ResolvedMinecraftSkin = {
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

function decodeBase64(value: string): string {
  if (typeof atob === "function") {
    return atob(value);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf-8");
  }

  throw new Error("No base64 decoder is available in this runtime.");
}

function normalizeTextureUrl(value: string): string {
  return value.startsWith("http://")
    ? value.replace("http://", "https://")
    : value;
}

export async function resolveMinecraftSkin(
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

  const texturePayload = JSON.parse(
    decodeBase64(textureProperty.value),
  ) as TexturePayload;
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
