
const axios = require('axios');

async function getDadJoke() {
  try {
    const response = await axios.get('https://icanhazdadjoke.com/', {
      headers: { 'Accept': 'application/json' }
    });
    return response.data.joke;
  } catch (error) {
    return "Why did the scarecrow win an award? Because he was outstanding in his field!";
  }
}

module.exports = async (sock, message) => {
  const joke = await getDadJoke();
  await sock.sendMessage(message.key.remoteJid, { text: `🎭 Dad Joke:\n\n${joke}` });
};
