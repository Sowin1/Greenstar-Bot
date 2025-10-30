export default {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    if (message.author.bot || !message.content) return;
    if (message.content.toLowerCase() === 'ping') {
      await message.reply('pong');
    }
  }
};
