
const { getRandomInt } = require('../utils/mathUtils');

module.exports = {
  category: 'fun',
  commands: {
    // Removing duplicate commands: diceroll, flipcoin, 8ball, fortune, riddle, dadjoke
    // These commands already exist in fun.js
    

    // Removing rockpaperscissors - duplicate of rps command in fun.js
    // There's already a better implementation with the same functionality in fun.js

    'number': async (sock, message, args) => {
      const number = args[0] ? parseInt(args[0]) : 0;
      const facts = [`${number} squared is ${number * number}`, `${number} cubed is ${number * number * number}`];
      await sock.sendMessage(message.key.remoteJid, { text: `🔢 Random fact about ${number}:\n${facts[Math.floor(Math.random() * facts.length)]}` });
    },

    // Removed duplicates: 'roll', 'choose', and 'reverse'
    // These commands already exist in fun.js

    'scramble': async (sock, message, args) => {
      const word = args.join(' ');
      const scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
      await sock.sendMessage(message.key.remoteJid, { text: `🔄 Scrambled: ${scrambled}` });
    },

    'count': async (sock, message, args) => {
      const text = args.join(' ');
      const stats = {
        characters: text.length,
        words: text.split(/\s+/).length,
        spaces: text.split(' ').length - 1
      };
      await sock.sendMessage(message.key.remoteJid, { text: `📊 Stats:\nCharacters: ${stats.characters}\nWords: ${stats.words}\nSpaces: ${stats.spaces}` });
    },

    'flip': async (sock, message, args) => {
      const text = args.join(' ');
      const flipped = text.split('').reverse().join('');
      await sock.sendMessage(message.key.remoteJid, { text: `🔄 ${flipped}` });
    },

    'emojify': async (sock, message, args) => {
      const text = args.join(' ');
      const emojified = text.split('').join('😎');
      await sock.sendMessage(message.key.remoteJid, { text: emojified });
    },

    'uppercase': async (sock, message, args) => {
      const text = args.join(' ');
      await sock.sendMessage(message.key.remoteJid, { text: text.toUpperCase() });
    },

    'lowercase': async (sock, message, args) => {
      const text = args.join(' ');
      await sock.sendMessage(message.key.remoteJid, { text: text.toLowerCase() });
    },

    'alternating': async (sock, message, args) => {
      const text = args.join(' ');
      const alternating = text.split('').map((char, i) => i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()).join('');
      await sock.sendMessage(message.key.remoteJid, { text: alternating });
    },

    'repeat': async (sock, message, args) => {
      const times = Math.min(parseInt(args[0]) || 1, 5);
      const text = args.slice(1).join(' ');
      await sock.sendMessage(message.key.remoteJid, { text: Array(times).fill(text).join('\n') });
    },

    'countup': async (sock, message, args) => {
      const num = Math.min(parseInt(args[0]) || 5, 10);
      const countdown = Array.from({length: num}, (_, i) => i + 1).join('\n');
      await sock.sendMessage(message.key.remoteJid, { text: countdown });
    },

    'countdown': async (sock, message, args) => {
      const num = Math.min(parseInt(args[0]) || 5, 10);
      const countdown = Array.from({length: num}, (_, i) => num - i).join('\n');
      await sock.sendMessage(message.key.remoteJid, { text: countdown });
    },

    'binary': async (sock, message, args) => {
      const text = args.join(' ');
      const binary = text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
      await sock.sendMessage(message.key.remoteJid, { text: binary });
    },

    'morse': async (sock, message, args) => {
      const morseCode = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....',
        'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.',
        'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', ' ': '/'
      };
      const text = args.join(' ').toUpperCase();
      const morse = text.split('').map(char => morseCode[char] || char).join(' ');
      await sock.sendMessage(message.key.remoteJid, { text: morse });
    },

    'randomcase': async (sock, message, args) => {
      const text = args.join(' ');
      const randomCase = text.split('').map(char => Math.random() < 0.5 ? char.toUpperCase() : char.toLowerCase()).join('');
      await sock.sendMessage(message.key.remoteJid, { text: randomCase });
    },

    // Removed duplicate: 'clap'
    // This command already exists in fun.js

    'spoiler': async (sock, message, args) => {
      const text = args.join(' ');
      const spoiler = text.split('').join('||');
      await sock.sendMessage(message.key.remoteJid, { text: `||${spoiler}||` });
    },

    'vowels': async (sock, message, args) => {
      const text = args.join(' ');
      const vowels = text.match(/[aeiou]/gi)?.length || 0;
      await sock.sendMessage(message.key.remoteJid, { text: `Number of vowels: ${vowels}` });
    },

    'consonants': async (sock, message, args) => {
      const text = args.join(' ');
      const consonants = text.match(/[bcdfghjklmnpqrstvwxyz]/gi)?.length || 0;
      await sock.sendMessage(message.key.remoteJid, { text: `Number of consonants: ${consonants}` });
    },

    'letters': async (sock, message, args) => {
      const text = args.join(' ');
      const letters = text.match(/[a-z]/gi)?.length || 0;
      await sock.sendMessage(message.key.remoteJid, { text: `Number of letters: ${letters}` });
    }
  }
};
