# Greenstar Bot

Bot Discord **Greenstar** avec:

- ✅ Modes **DEV** / **PROD**
- ✅ Scripts `deploy:dev` / `deploy:prod`

## Prérequis

- Node.js >= 18
- Créer une application + bot sur le Portal Discord
  - Récupère **Application ID** (CLIENT_ID)
  - Récupère le **Token** du bot (DISCORD_TOKEN)
  - Activer **Message Content Intent** si tu veux lire le contenu

## Installation

```bash
npm install
cp .env.example .env
# édite .env : DISCORD_TOKEN, CLIENT_ID, DEV_GUILD_ID, PROD_GUILD_ID
```

## Déployer les commandes

- **DEV (guild de dev uniquement)**
  ```bash
  npm run deploy:dev
  ```
- **PROD (guild de prod uniquement)**
  ```bash
  npm run deploy:prod
  ```

## Lancer le bot

- **DEV** (hot reload + NODE_ENV=dev)
  ```bash
  npm run dev
  ```
- **PROD**
  ```bash
  npm start
  ```

## Ajouter des commandes

Ajoute des fichiers dans `src/commands/*.js` exportant par défaut :

```js
import { SlashCommandBuilder } from "discord.js";
export default {
  data: new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Dit bonjour"),
  async execute(interaction) {
    await interaction.reply("Bonjour !");
  },
};
```

## Remarques

- Ce template **enregistre les commandes par guild** (DEV/PROD). Si tu veux un enregistrement global en PROD, remplace la route dans `deploy-commands.js` par `Routes.applicationCommands(clientId)`.
- Les scripts utilisent `cross-env` pour compat Windows/macOS/Linux.
