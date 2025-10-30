export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.', ephemeral: true });
      }
    }
  }
};
