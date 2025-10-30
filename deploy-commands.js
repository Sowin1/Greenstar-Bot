import "dotenv/config";
import { REST, Routes } from "discord.js";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const isDev = process.env.NODE_ENV === "dev";
const clientId = process.env.CLIENT_ID;
const devGuildId = process.env.DEV_GUILD_ID;
const prodGuildId = process.env.PROD_GUILD_ID;

if (!process.env.DISCORD_TOKEN || !clientId) {
  console.error("❌ DISCORD_TOKEN ou CLIENT_ID manquant dans .env");
  process.exit(1);
}
if (isDev && !devGuildId) {
  console.error("❌ DEV_GUILD_ID manquant pour le déploiement en DEV");
  process.exit(1);
}
if (!isDev && !prodGuildId) {
  console.error("❌ PROD_GUILD_ID manquant pour le déploiement en PROD");
  process.exit(1);
}

async function getCommandsRecursively(dir, commands = []) {
  const entries = await readdir(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const entryStats = await stat(fullPath);

    if (entryStats.isDirectory()) {
      await getCommandsRecursively(fullPath, commands);
      continue;
    }

    if (entry.endsWith(".js")) {
      const { default: cmd } = await import("file://" + fullPath);
      if (cmd?.data) commands.push(cmd.data.toJSON());
    }
  }

  return commands;
}

async function getCommandsData() {
  const commandsPath = join(process.cwd(), "src", "commands");
  return await getCommandsRecursively(commandsPath);
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

try {
  const commands = await getCommandsData();
  if (isDev) {
    console.log("➡️ Mode DEV : enregistrement dans DEV_GUILD_ID =", devGuildId);
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, devGuildId),
      { body: commands }
    );
    console.log(`✅ ${data.length} commande(s) mise(s) à jour en DEV.`);
  } else {
    console.log(
      "➡️ Mode PROD : enregistrement dans PROD_GUILD_ID =",
      prodGuildId
    );
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, prodGuildId),
      { body: commands }
    );
    console.log(`✅ ${data.length} commande(s) mise(s) à jour en PROD.`);
  }
} catch (error) {
  console.error("❌ Erreur lors du déploiement des commandes:", error);
  process.exit(1);
}
