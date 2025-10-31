import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { getActiveBets } from "../database/scriptDb.js";
import { getTeamEmojiInfo } from "../../../emoji-manager.js";

export default {
  data: new SlashCommandBuilder()
    .setName("listeparie")
    .setDescription("Affiche la liste des paris en cours"),

  async execute(interaction) {
    let bets;

    try {
      bets = getActiveBets();
    } catch (e) {
      return interaction.reply("⚠️ " + e.message);
    }

    if (!bets.length) {
      return interaction.reply("❌ Aucun pari en cours.");
    }

    const PAGE_SIZE = 10;
    const pages = [];
    for (let i = 0; i < bets.length; i += PAGE_SIZE) {
      pages.push(bets.slice(i, i + PAGE_SIZE));
    }

    let page = 0;

    const getEmbed = async () => {
      const pageData = pages[page];

      const embed = new EmbedBuilder()
        .setTitle(`📊 Paris en cours - Page ${page + 1}/${pages.length}`)
        .setColor(0x0e5944)
        .setTimestamp();

      for (let i = 0; i < pageData.length; i++) {
        const bet = pageData[i];

        const emojiT1 = await getTeamEmojiInfo(interaction.client, bet.team1);
        const emojiT2 = await getTeamEmojiInfo(interaction.client, bet.team2);

        const formattedT1 = emojiT1
          ? `<:${emojiT1.emojiName}:${emojiT1.emojiID}>`
          : "❔";
        const formattedT2 = emojiT2
          ? `<:${emojiT2.emojiName}:${emojiT2.emojiID}>`
          : "❔";

        embed.addFields({
          name: `#${page * PAGE_SIZE + i + 1} - ${formattedT1} ${
            bet.team1
          }  **VS**  ${formattedT2} ${bet.team2}`,
          value:
            `> 🔢 **ID :** \`${bet.idBet}\`\n` +
            `> 📈 **Cotes :** ${bet.cotationBet1} / ${bet.cotationBet2}\n` +
            `> 💰 **Mises :** ${bet.stake1 || "?"} / ${bet.stake2 || "?"}`,
        });
      }

      return embed;
    };

    const getButtons = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("first")
          .setLabel("⏮")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("⬅")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("➡")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === pages.length - 1),

        new ButtonBuilder()
          .setCustomId("last")
          .setLabel("⏭")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === pages.length - 1)
      );

    const message = await interaction.reply({
      embeds: [await getEmbed()],
      components: [getButtons()],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "❌ Tu ne peux pas utiliser ces boutons.",
          ephemeral: true,
        });
      }

      if (i.customId === "first") page = 0;
      if (i.customId === "prev") page = Math.max(0, page - 1);
      if (i.customId === "next") page = Math.min(pages.length - 1, page + 1);
      if (i.customId === "last") page = pages.length - 1;

      await i.update({
        embeds: [await getEmbed()],
        components: [getButtons()],
      });
    });

    // ✅ déplacé hors du collect
    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
};
