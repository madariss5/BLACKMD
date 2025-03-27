
const axios = require('axios');

module.exports = async (sock, message) => {
  try {
    const response = await axios.get('https://meme-api.com/gimme');
    await sock.sendMessage(message.key.remoteJid, {
      image: { url: response.data.url },
      caption: `${response.data.title} 😂`
    });
  } catch (error) {
    await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Failed to fetch meme. Please try again later."
    });
  }
};
