import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import {
  createOrUpdateTeam,
  getTeamByName,
  getTeamStats,
} from "../database/scriptDb.js";

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
    )
    .addSubcommand((sc) =>
      sc
        .setName("afficher")
        .setDescription("Affiche une équipe")
        .addStringOption((opt) =>
          opt.setName("nom").setDescription("Nom de l'équipe").setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const name = interaction.options.getString("nom");

    if (sub == "creer") {
      if (
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        return interaction.reply({
          content: "❌ Tu n'as pas la permission d'utiliser cette commande.",
          ephemeral: true,
        });
      }
      const img = interaction.options.getString("image");

      try {
        createOrUpdateTeam(name, img);
      } catch (e) {
        return interaction.reply("⚠️ " + e.message);
      }

      const embed = new EmbedBuilder()
        .setColor(0x0abf6a)
        .setTitle(`Équipe ${name} enregistrée`)
        .setImage(img || interaction.guild.iconURL())
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
      });
    } else if (sub == "afficher") {
      let team = null;
      let teamStats = null;
      try {
        team = getTeamByName(name);
        if (team == null) {
          return interaction.reply("Aucune équipe trouvée à ce nom");
        }
        teamStats = getTeamStats(name);
      } catch (e) {
        return interaction.reply("⚠️ " + e.message);
      }
      const embed = new EmbedBuilder()
        .setTitle(`Présentation de l'équipe ${team.name}`)
        .setThumbnail(team.logoUrl || interaction.guild.iconURL())
        .setColor(0x0abf6a)
        .addFields(
          {
            name: "Victoires",
            value: `${teamStats.wins}`,
          },
          {
            name: "Défaites",
            value: `${teamStats.losses}`,
          },
          {
            name: "Annulé / Egalité",
            value: `${teamStats.voids}`,
          }
        );
      await interaction.reply({ embeds: [embed] });
    }
  },
};
