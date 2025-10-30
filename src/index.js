import "dotenv/config";
import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const isDev = process.env.NODE_ENV === "dev";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

async function loadEvents() {
  const eventsPath = join(process.cwd(), "src", "events");
  const files = await readdir(eventsPath);

  for (const file of files) {
    if (!file.endsWith(".js")) continue;

    const filePath = join(eventsPath, file);
    const eventModule = await import("file://" + filePath);
    const event = eventModule.default;

    if (!event?.name || !event?.execute) {
      console.warn(
        `[WARN] Le fichier ${file} n'exporte pas un événement valide.`
      );
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }

    console.log(`[EVENT] Chargé: ${event.name}`);
  }
}

async function loadCommandsRecursively(dir) {
  const entries = await readdir(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const info = await stat(fullPath);

    if (info.isDirectory()) {
      await loadCommandsRecursively(fullPath);
      continue;
    }

    if (entry.endsWith(".js")) {
      const { default: command } = await import("file://" + fullPath);

      if (!command?.data || !command?.execute) {
        console.warn(`[WARN] ${entry} n'exporte pas une commande valide.`);
        continue;
      }

      client.commands.set(command.data.name, command);
      console.log(`[CMD] Chargée: /${command.data.name}`);
    }
  }
}

async function loadCommands() {
  const commandsPath = join(process.cwd(), "src", "commands");
  await loadCommandsRecursively(commandsPath);
}

(async () => {
  await loadEvents();
  await loadCommands();

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error(
      "Erreur: DISCORD_TOKEN est manquant. Ajoute-le dans ton fichier .env"
    );
    process.exit(1);
  }

  await client.login(token);

  console.log(isDev ? "🚧 Bot lancé en mode DEV" : "✅ Bot lancé en mode PROD");
})();
