
module.exports = async (sock, message) => {
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  await sock.sendMessage(message.key.remoteJid, {
    text: `🪙 Flipping a coin...\n\nResult: ${result}!`
  });
};
