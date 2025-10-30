import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createOrUpdateTeam } from "../database/scriptDb.js";

export default {
  data: new SlashCommandBuilder()
    .setName("team")
    .setDescription("Gestion des équipes")
    .addSubcommand((sc) =>
      sc
        .setName("creer")
        .setDescription("Créer une équipe")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Nom de l'équipe").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("image")
            .setDescription("Logo de l'équipe")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub == "creer") {
      const name = interaction.options.getString("nom");
      const img = interaction.options.getString("image");

      try {
        createOrUpdateTeam(name, img);
      } catch (e) {
        return interaction.reply("⚠️ " + e.message);
      }

      const embed = new EmbedBuilder()
        .setColor(0x140126)
        .setTitle(`Équipe ${name} enregistrée`)
        .setImage(img || interaction.guild.iconURL())
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
      });
    }
  },
};
