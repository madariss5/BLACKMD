
const emojiMap = {
  'a': '📱', 'b': '🅱️', 'c': '©️', 'd': '🎯', 'e': '📧',
  'f': '🎏', 'g': '🎮', 'h': '♓', 'i': 'ℹ️', 'j': '🎷',
  'k': '🎋', 'l': '💪', 'm': 'Ⓜ️', 'n': '📈', 'o': '⭕',
  'p': '🅿️', 'q': '🎯', 'r': '®️', 's': '💲', 't': '✝️',
  'u': '⛎', 'v': '✌️', 'w': '〰️', 'x': '❌', 'y': '💹',
  'z': '💤', ' ': ' ', '!': '❗', '?': '❓'
};

module.exports = async (sock, message, args) => {
  if (!args.length) {
    return await sock.sendMessage(message.key.remoteJid, {
      text: "❌ Please provide some text to emojify!"
    });
  }

  const text = args.join(" ").toLowerCase();
  const emojified = text.split('')
    .map(char => emojiMap[char] || char)
    .join(" ");

  await sock.sendMessage(message.key.remoteJid, {
    text: emojified
  });
};
