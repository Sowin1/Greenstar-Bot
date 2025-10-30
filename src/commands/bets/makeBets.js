import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { createBet, getTeamByName } from "../database/scriptDb.js";
export default {
  data: new SlashCommandBuilder()
    .setName("parie")
    .setDescription("Créer un parie")
    .addSubcommand((sc) =>
      sc
        .setName("créer")
        .setDescription("Créer un parie")
        .addStringOption((opt) =>
          opt
            .setName("equipe1")
            .setDescription("Nom de l'équipe 1")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("equipe2")
            .setDescription("Nom de l'équipe 2")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub == "créer") {
      if (
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        return interaction.reply({
          content: "❌ Tu n'as pas la permission d'utiliser cette commande.",
          flags: MessageFlags.Ephemeral,
        });
      }
      let team1 = null;
      let team2 = null;

      try {
        team1 = getTeamByName(interaction.options.getString("equipe1"));
        team2 = getTeamByName(interaction.options.getString("equipe2"));
      } catch (e) {
        return interaction.reply("⚠️ " + e.message);
      }

      if (team1 == null) {
        return interaction.reply({
          content: "L'équipe numéro 1 n'a pas été trouvée",
          flags: MessageFlags.Ephemeral,
        });
      } else if (team2 == null) {
        return interaction.reply({
          content: "L'équipe numéro 2 n'a pas été trouvée",
          flags: MessageFlags.Ephemeral,
        });
      }
      createBet(team1.idTeam, team2.idTeam, 1, 1);

      const embed = new EmbedBuilder()
        .setTitle("Parie crée avec succès")
        .setThumbnail(interaction.guild.iconURL())
        .setColor(0x0e5944)
        .setDescription(`**${team1.name}** contre **${team2.name}**`)
        .setTimestamp();
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
