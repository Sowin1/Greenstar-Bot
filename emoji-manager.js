async function fetchImageAsBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`❌ Impossible de télécharger l’image (${url})`);
  }

  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    throw new Error(`❌ URL ne renvoie pas une image (${type})`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export async function getNoLogoEmoji(client) {
  const guildIDs = process.env.EMOJI_GUILD_IDS?.split(",");
  if (!guildIDs?.length) {
    return null;
  }

  for (const guildID of guildIDs) {
    const guild = client.guilds.cache.get(guildID);
    if (!guild) {
      continue;
    }

    const emojis = await guild.emojis.fetch();
    const found = emojis.find((e) => e.name === "nologo");

    if (found)
      return {
        emojiID: found.id,
        guildID,
        emojiName: "nologo",
      };
  }
  return null;
}

export async function createOrUpdateTeamEmoji(client, teamName, logoUrl) {
  if (!client) {
    throw new Error("Client Discord manquant");
  }
  if (!teamName) {
    throw new Error("Nom de l’équipe manquant");
  }

  const guildIDs = process.env.EMOJI_GUILD_IDS?.split(",");
  if (!guildIDs?.length) {
    throw new Error("⚠️ EMOJI_GUILD_IDS absent dans l'env");
  }

  const emojiName = teamName.toLowerCase().replace(/\W+/g, "_");

  if (!logoUrl) {
    const fallback = await getNoLogoEmoji(client);
    if (!fallback)
      throw new Error("❌ Aucune emoji :nologo: trouvée dans vos serveurs");

    return fallback;
  }

  let buffer;
  try {
    buffer = await fetchImageAsBuffer(logoUrl);
  } catch {
    const fallback = await getNoLogoEmoji(client);
    if (!fallback)
      throw new Error(
        "❌ Impossible de récupérer le logo et aucune emoji :nologo:"
      );
    return fallback;
  }

  if (!buffer.length) {
    const fallback = await getNoLogoEmoji(client);
    if (!fallback) throw new Error("❌ Image vide et aucune emoji :nologo:");
    return fallback;
  }

  if (buffer.length > 256 * 1024) {
    throw new Error(
      `❌ Image > 256KB (${(buffer.length / 1024).toFixed(1)} KB)`
    );
  }

  for (const guildID of guildIDs) {
    const guild = client.guilds.cache.get(guildID);
    if (!guild) {
      continue;
    }

    const emojis = await guild.emojis.fetch();

    const existing = emojis.find((e) => e.name === emojiName);
    if (existing) {
      try {
        await existing.delete("Update team logo");
      } catch {}
    }

    if (emojis.size >= 50) {
      continue;
    }

    try {
      const emoji = await guild.emojis.create({
        attachment: buffer,
        name: emojiName,
      });

      return {
        emojiID: emoji.id,
        guildID: guild.id,
        emojiName,
      };
    } catch (err) {
      console.error("❌ Erreur création emoji =>", err);
      continue;
    }
  }

  throw new Error("🚨 Aucune place disponible pour stocker l’emoji !");
}

export async function getTeamEmojiInfo(client, teamName) {
  if (!client) {
    throw new Error("Client Discord manquant");
  }
  if (!teamName) {
    throw new Error("Nom d’équipe manquant");
  }

  const guildIDs = process.env.EMOJI_GUILD_IDS?.split(",");
  if (!guildIDs?.length) {
    throw new Error("⚠️ EMOJI_GUILD_IDS absent");
  }

  const emojiName = teamName.toLowerCase().replace(/\W+/g, "_");

  for (const guildID of guildIDs) {
    const guild = client.guilds.cache.get(guildID);
    if (!guild) {
      continue;
    }

    const emojis = await guild.emojis.fetch();
    const found = emojis.find((e) => e.name === emojiName);

    if (found) {
      return {
        emojiID: found.id,
        guildID,
        emojiName,
      };
    }
  }

  return await getNoLogoEmoji(client);
}
