const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { isFeatureEnabled } = require('../utils/groupSettings');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const { formatNumber, randomInt, shuffleArray, sleep } = require('../utils/helpers');
const crypto = require('crypto');
const mathjs = require('mathjs');
const moment = require('moment');
const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');
const { getRandomInt } = require('../utils/mathUtils');


/**
 * Helper function to check if games are enabled for a group
 * @param {Object} sock WhatsApp socket
 * @param {string} remoteJid Group or sender JID
 * @returns {Promise<boolean>} Whether games are enabled
 */
async function areGamesEnabled(sock, remoteJid) {
    // If it's a group, check if games feature is enabled
    if (remoteJid.endsWith('g.us')) {
        const gamesEnabled = await isFeatureEnabled(remoteJid, 'games');
        if (!gamesEnabled) {
            await safeSendText(sock, remoteJid, '❌ Games are disabled in this group. Ask an admin to enable them with *.feature games on*');
            return false;
        }
    }
    return true;
}

// Game state initialization - improved with timeouts and better state tracking
function initializeGameState() {
    if (!global.games) {
        global.games = {
            tictactoe: new Map(),
            hangman: new Map(),
            wordle: new Map(),
            quiz: new Map(),
            trivia: new Map()
        };
    }

    // Clean up expired games every hour
    if (!global.gameCleanupInterval) {
        global.gameCleanupInterval = setInterval(() => {
            const now = Date.now();
            const TIMEOUT = 30 * 60 * 1000; // 30 minutes

            for (const [gameType, gameMap] of Object.entries(global.games)) {
                for (const [gameId, game] of gameMap.entries()) {
                    if (now - game.lastActivity > TIMEOUT) {
                        gameMap.delete(gameId);
                        logger.info(`Game ${gameType} in ${gameId} expired and cleaned up`);
                    }
                }
            }
        }, 60 * 60 * 1000); // Run cleanup hourly
    }
}

// TicTacToe board rendering
function renderBoard(board) {
    const cells = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    let result = '';

    for (let i = 0; i < 9; i++) {
        // Replace with X, O or number
        if (board[i] === 'X') {
            result += '❌';
        } else if (board[i] === 'O') {
            result += '⭕';
        } else {
            result += cells[i];
        }

        // Add row separators
        if (i % 3 === 2) {
            result += '\n';
        } else {
            result += ' | ';
        }
    }

    return result;
}

// Check if someone won the TicTacToe game
function checkWinner(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] !== ' ' && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    return null;
}

// Get AI move for TicTacToe
function getBotMove(board) {
    // Check for winning moves
    const winningMove = findWinningMove(board, 'O');
    if (winningMove !== -1) return winningMove;

    // Block player from winning
    const blockingMove = findWinningMove(board, 'X');
    if (blockingMove !== -1) return blockingMove;

    // Take center if available
    if (board[4] === ' ') return 4;

    // Take a corner
    const corners = [0, 2, 6, 8];
    const availableCorners = corners.filter(i => board[i] === ' ');
    if (availableCorners.length > 0) {
        return availableCorners[Math.floor(Math.random() * availableCorners.length)];
    }

    // Take any available square
    const availableMoves = board.map((cell, index) => cell === ' ' ? index : -1).filter(i => i !== -1);
    if (availableMoves.length > 0) {
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    return -1; // No moves available
}

// Find winning move for TicTacToe
function findWinningMove(board, player) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        // Check if two are filled and one is empty
        if (board[a] === player && board[b] === player && board[c] === ' ') return c;
        if (board[a] === player && board[c] === player && board[b] === ' ') return b;
        if (board[b] === player && board[c] === player && board[a] === ' ') return a;
    }

    return -1; // No winning move
}

// Hangman display
function getHangmanDisplay(game) {
    const hangmanStages = [
        `
  +---+
  |   |
      |
      |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
      |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
  |   |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
 /|   |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
 /|\\  |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
 /|\\  |
 /    |
      |
=========`,
        `
  +---+
  |   |
  O   |
 /|\\  |
 / \\  |
      |
=========`
    ];

    const guessedWord = game.word.split('').map(letter =>
        game.guessedLetters.includes(letter) ? letter : '_'
    ).join(' ');

    return `
${hangmanStages[game.wrongGuesses]}

Word: ${guessedWord}
Guessed: ${game.guessedLetters.join(', ') || 'None'}
Wrong guesses: ${game.wrongGuesses}/6
    `;
}

// Wordle display
function handleWordleGuess(word, guess) {
    const result = [];
    const wordArr = word.toLowerCase().split('');
    const guessArr = guess.toLowerCase().split('');

    // First pass: mark correct letters (green)
    for (let i = 0; i < guessArr.length; i++) {
        if (guessArr[i] === wordArr[i]) {
            result[i] = '🟩'; // Correct position
            wordArr[i] = null; // Mark as used
        }
    }

    // Second pass: mark present but incorrect position (yellow)
    for (let i = 0; i < guessArr.length; i++) {
        if (result[i]) continue; // Skip already marked positions

        const letterIndex = wordArr.indexOf(guessArr[i]);
        if (letterIndex !== -1) {
            result[i] = '🟨'; // Present but wrong position
            wordArr[letterIndex] = null; // Mark as used
        } else {
            result[i] = '⬛'; // Not present
        }
    }

    return result.join('');
}

// Initialize all game state tracking
initializeGameState();

module.exports = {
    category: 'fun',
    trivia: async (sock, msg) => {
        const questions = [
            {q: "What's the capital of France?", a: "Paris"},
            {q: "Which planet is known as the Red Planet?", a: "Mars"},
            {q: "What's the largest ocean?", a: "Pacific"}
        ];
        const question = questions[Math.floor(Math.random() * questions.length)];
        await safeSendText(sock, msg.key.remoteJid, `🎯 *Trivia Time*\n\nQuestion: ${question.q}\n\nUse .answer [your answer] to respond!`);
    },
    hangman: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🎮 *Hangman Game*\n\nWord: _ _ _ _ _\nGuesses left: 6\n\nUse .guess [letter] to play!");
    },
    wordchain: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🔤 *Word Chain Game*\n\nLast word: START\n\nContinue with a word that begins with 'T'!");
    },
    unscramble: async (sock, msg) => {
        const words = ["PYTHON", "JAVASCRIPT", "CODING", "PROGRAMMING"];
        const word = words[Math.floor(Math.random() * words.length)];
        const scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
        await safeSendText(sock, msg.key.remoteJid, `🔠 *Unscramble*\n\nScrambled word: ${scrambled}`);
    },
    math: async (sock, msg) => {
        const num1 = getRandomInt(1, 10);
        const num2 = getRandomInt(1, 10);
        await safeSendText(sock, msg.key.remoteJid, `🔢 *Math Challenge*\n\nWhat is ${num1} × ${num2}?`);
    },
    memory: async (sock, msg) => {
        const sequence = Array.from({length: 5}, () => getRandomInt(1, 9)).join(' ');
        await safeSendText(sock, msg.key.remoteJid, `🧠 *Memory Game*\n\nRemember this sequence:\n${sequence}\n\n(It will disappear in 5 seconds!)`);
    },
    tictactoe: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "⭕ *Tic Tac Toe*\n\n- | - | -\n---------\n- | - | -\n---------\n- | - | -\n\nUse .place [1-9] to play!");
    },
    typing: async (sock, msg) => {
        const sentences = ["The quick brown fox jumps over the lazy dog", "Pack my box with five dozen liquor jugs"];
        const sentence = sentences[Math.floor(Math.random() * sentences.length)];
        await safeSendText(sock, msg.key.remoteJid, `⌨️ *Typing Test*\n\nType this sentence:\n${sentence}`);
    },
    guess: async (sock, msg) => {
        const number = getRandomInt(1, 100);
        await safeSendText(sock, msg.key.remoteJid, "🔢 *Number Guessing*\n\nI'm thinking of a number between 1 and 100!\nUse .try [number] to guess!");
    },
    anagram: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "📝 *Anagram Game*\n\nMake as many words as possible from:\nPROGRAMMING\n\nUse .submit [word] to submit a word!");
    },
    quiz: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "❓ *Quiz Game*\n\nCategory: Technology\nDifficulty: Medium\n\nUse .start to begin!");
    },
    simon: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🎮 *Simon Says*\n\nRepeat after me:\nRed, Blue, Green\n\nUse .repeat [colors] to respond!");
    },
    riddles: async (sock, msg) => {
        const riddles = [
            "What has keys but no locks?",
            "What has cities but no houses?"
        ];
        await safeSendText(sock, msg.key.remoteJid, `🤔 *Riddle*\n\n${riddles[getRandomInt(0, riddles.length - 1)]}`);
    },
    boggle: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "📝 *Boggle*\n\nFind words in this 4x4 grid!\nUse .find [word] to submit words!");
    },
    cryptogram: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🔍 *Cryptogram*\n\nDecode this message:\nXYZ ABC\n\nUse .decode [message] to solve!");
    },
    synonym: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "📚 *Synonym Game*\n\nFind a synonym for: HAPPY\n\nUse .syn [word] to answer!");
    },
    categories: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "📝 *Categories*\n\nLetter: S\nCategories: Countries, Animals, Foods\n\nGo!");
    },
    wordle: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🎯 *Wordle*\n\nGuess the 5-letter word!\n⬜⬜⬜⬜⬜\n\nUse .guess [word] to play!");
    },
    connectfour: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🔵 *Connect Four*\n\n| | | | | | |\n| | | | | | |\n| | | | | | |\n\nUse .drop [1-7] to play!");
    },
    battleship: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "⚓ *Battleship*\n\nYour grid:\n~ ~ ~ ~\n~ ~ ~ ~\n\nUse .fire [A1-D4] to attack!");
    },
    chess: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "♟️ *Chess*\n\nUse standard chess notation to play!\nExample: .move e2e4");
    },
    minesweeper: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "💣 *Minesweeper*\n\n⬜⬜⬜\n⬜⬜⬜\n⬜⬜⬜\n\nUse .reveal [A1-C3] to play!");
    },
    rps: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "✌️ *Rock Paper Scissors*\n\nMake your choice!\nUse .pick [rock/paper/scissors]");
    },
    twentyone: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🎲 *Twenty One*\n\nYour cards: 7♠️ 8♣️\nDealer shows: A♥️\n\nUse .hit or .stand!");
    },
    mastermind: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🎯 *Mastermind*\n\nGuess the 4-color code!\nColors: R G B Y\n\nUse .guess [RGYB] to play!");
    },
    bingo: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🎱 *Bingo*\n\nB I N G O\n1 16 31 46 61\n\nUse .mark [number] when called!");
    },
    maze: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🌟 *Maze*\n\n⬜⬜⬜\n⬛⬛⬜\n🟦⬜🎯\n\nUse .move [up/down/left/right]!");
    },
    tetris: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🟦 *Tetris*\n\nNext piece: 🟦🟦\n           🟦🟦\n\nUse .rotate or .move [left/right]!");
    },
    snake: async (sock, msg) => {
        await safeSendText(sock, msg.key.remoteJid, "🐍 *Snake*\n\n⬜⬜🍎\n⬜🐍⬜\n⬜⬜⬜\n\nUse .move [direction] to play!");
    },
    commands: {
        joke: async (sock, msg) => {
            const jokes = [
                'Why don\'t scientists trust atoms? Because they make up everything!',
                'What do you call a bear with no teeth? A gummy bear!',
                'Why did the scarecrow win an award? Because he was outstanding in his field!',
                'What do you call a fake noodle? An impasta!',
                'Why did the cookie go to the doctor? Because it was feeling crumbly!'
            ];
            await safeSendText(sock, msg.key.remoteJid, `😄 ${jokes[Math.floor(Math.random() * jokes.length)]}`);
        },
        riddle: async (sock, msg) => {
            const riddles = [
                'What has keys, but no locks; space, but no room; and you can enter, but not go in? A keyboard!',
                'What gets wetter and wetter the more it dries? A towel!',
                'What has cities, but no houses; forests, but no trees; and rivers, but no water? A map!'
            ];
            await safeSendText(sock, msg.key.remoteJid, riddles[Math.floor(Math.random() * riddles.length)]);
        },
        '8ball': async (sock, msg) => {
            const responses = [
                'It is certain',
                'Without a doubt',
                'Yes definitely',
                'Most likely',
                'Ask again later',
                'Cannot predict now',
                'Don\'t count on it',
                'My sources say no',
                'Very doubtful'
            ];
            await safeSendText(sock, msg.key.remoteJid, `🎱 ${responses[Math.floor(Math.random() * responses.length)]}`);
        },
        dice: async (sock, msg, args) => {
            const sides = parseInt(args[0]) || 6;
            await safeSendText(sock, msg.key.remoteJid, `🎲 You rolled a ${Math.floor(Math.random() * sides) + 1}`);
        },
        flip: async (sock, msg) => {
            await safeSendText(sock, msg.key.remoteJid, Math.random() < 0.5 ? 'Heads' : 'Tails');
        },
        fortune: async (sock, msg) => {
            const fortunes = [
                'A beautiful, smart, and loving person will be coming into your life.',
                'A dubious friend may be an enemy in camouflage.',
                'A faithful friend is a strong defense.',
                'A fresh start will put you on your way.',
                'A friend asks only for your time not your money.'
            ];
            await safeSendText(sock, msg.key.remoteJid, `🥠 ${fortunes[Math.floor(Math.random() * fortunes.length)]}`);
        },
        meme: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Here\'s a random meme! 😂'),
        fact: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Here\'s a random fact! 📚'),
        trivia: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Time for trivia! 🤔'),
        rps: async (sock, msg, args) => {
            const choices = ['rock', 'paper', 'scissors'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            const userChoice = args[0]?.toLowerCase();

            if (!choices.includes(userChoice)) {
                return await safeSendText(sock, msg.key.remoteJid, 'Please choose rock, paper, or scissors!');
            }

            let result;
            if (userChoice === botChoice) result = 'Tie!';
            else if (
                (userChoice === 'rock' && botChoice === 'scissors') ||
                (userChoice === 'paper' && botChoice === 'rock') ||
                (userChoice === 'scissors' && botChoice === 'paper')
            ) result = 'You win!';
            else result = 'Bot wins!';

            await safeSendText(sock, msg.key.remoteJid, `You chose ${userChoice}, bot chose ${botChoice}. ${result}`);
        },
        compliment: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Random compliment'),
        roast: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Random roast'),
        pickup: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Pickup line'),
        dare: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Random dare'),
        truth: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Random truth'),
        would: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Would you rather'),
        never: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Never have I ever'),
        quote: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Random quote'),
        wisdom: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Words of wisdom'),
        challenge: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Daily challenge'),
        achievement: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Achievement unlocked'),
        quest: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'New quest'),
        mission: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Secret mission'),
        adventure: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Random adventure'),
        story: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Random story'),
        dadjoke: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Dad joke'),
        pun: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Random pun'),
        emoji: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'Random emoji'),
        ascii: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, 'ASCII art'),
        reversetext: async (sock, msg, args) => await safeSendText(sock, msg.key.remoteJid, args.join(' ').split('').reverse().join('')),
        mock: async (sock, msg, args) => await safeSendText(sock, msg.key.remoteJid, args.join(' ').split('').map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join('')),
        clap: async (sock, msg, args) => await safeSendText(sock, msg.key.remoteJid, args.join(' ').split(' ').join(' 👏 ')),
        vaporwave: async (sock, msg, args) => await safeSendText(sock, msg.key.remoteJid, args.join(' ').split('').join(' ')),
        zalgo: async (sock, msg, args) => await safeSendText(sock, msg.key.remoteJid, 'Zalgo text'),
        uwu: async (sock, msg, args) => await safeSendText(sock, msg.key.remoteJid, 'UwU text'),
        rate: async (sock, msg, args) => await safeSendText(sock, msg.key.remoteJid, `I rate ${args.join(' ')} a ${Math.floor(Math.random() * 10) + 1}/10`),
        ship: async (sock, msg, args) => await safeSendText(sock, msg.key.remoteJid, `Ship compatibility: ${Math.floor(Math.random() * 100)}%`),
        choose: async (sock, msg, args) => await safeSendText(sock, msg.key.remoteJid, args[Math.floor(Math.random() * args.length)]),
        roll: async (sock, msg, args) => {
            const num = parseInt(args[0]) || 100;
            await safeSendText(sock, msg.key.remoteJid, `🎲 ${Math.floor(Math.random() * num) + 1}`);
        },
        flipcoin: async (sock, msg) => {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            await safeSendText(sock, msg.key.remoteJid, `🪙 Coin flip: ${result}!`);
        },
        // Removed duplicate reaction commands (hug, pat, slap, kill, dance, cry, laugh)
        // These are better handled by the reactions.js module with GIFs
        cookie: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '🍪'),
        party: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '🎉'),
        
        // New fun commands (30 more)
        lenny: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '( ͡° ͜ʖ ͡°)'),
        shrug: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '¯\\_(ツ)_/¯'),
        tableflip: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '(╯°□°）╯︵ ┻━┻'),
        unflip: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '┬─┬ ノ( ゜-゜ノ)'),
        
        binary: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text to convert');
            const text = args.join(' ');
            const binary = text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
            await safeSendText(sock, msg.key.remoteJid, `Binary: ${binary}`);
        },
        
        decode: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide binary code to convert');
            try {
                const binary = args.join(' ').split(' ');
                const text = binary.map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
                await safeSendText(sock, msg.key.remoteJid, `Decoded: ${text}`);
            } catch (err) {
                await safeSendText(sock, msg.key.remoteJid, 'Invalid binary code');
            }
        },
        
        reverse: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text to reverse');
            await safeSendText(sock, msg.key.remoteJid, args.join(' ').split('').reverse().join(''));
        },
        
        emojify: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text to emojify');
            const text = args.join(' ').split('').join('😎');
            await safeSendText(sock, msg.key.remoteJid, text);
        },
        
        spoiler: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text to spoilerify');
            await safeSendText(sock, msg.key.remoteJid, `||${args.join(' ')}||`);
        },
        
        tiny: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text');
            const tinyMap = {
                'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ',
                'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'q': 'ᑫ', 'r': 'ʳ',
                's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ'
            };
            const text = args.join(' ').toLowerCase().split('').map(c => tinyMap[c] || c).join('');
            await safeSendText(sock, msg.key.remoteJid, text);
        },
        
        jumble: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text to jumble');
            const text = args.join(' ');
            const words = text.split(' ').map(word => {
                if (word.length <= 2) return word;
                const first = word[0];
                const last = word[word.length - 1];
                const middle = word.slice(1, -1).split('').sort(() => Math.random() - 0.5).join('');
                return first + middle + last;
            }).join(' ');
            await safeSendText(sock, msg.key.remoteJid, words);
        },
        
        password: async (sock, msg, args) => {
            const length = parseInt(args[0]) || 12;
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
            let password = '';
            for (let i = 0; i < length; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            await safeSendText(sock, msg.key.remoteJid, `🔐 Generated Password: ${password}`);
        },
        
        mirror: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text to mirror');
            const text = args.join(' ');
            await safeSendText(sock, msg.key.remoteJid, `${text} | ${text.split('').reverse().join('')}`);
        },
        
        countwords: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text to count words');
            const text = args.join(' ');
            const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
            const charCount = text.length;
            await safeSendText(sock, msg.key.remoteJid, `📊 Word count: ${wordCount}\nCharacter count: ${charCount}`);
        },
        
        countup: async (sock, msg, args) => {
            const num = Math.min(parseInt(args[0]) || 5, 10); // Limit to 10 to prevent spam
            const countdown = Array.from({length: num}, (_, i) => i + 1).join('\n');
            await safeSendText(sock, msg.key.remoteJid, countdown);
        },
        
        countdown: async (sock, msg, args) => {
            const num = Math.min(parseInt(args[0]) || 5, 10); // Limit to 10 to prevent spam
            const countdown = Array.from({length: num}, (_, i) => num - i).join('\n');
            await safeSendText(sock, msg.key.remoteJid, countdown);
        },
        
        yesno: async (sock, msg) => {
            const responses = ['Yes', 'No', 'Maybe', 'Absolutely!', 'Definitely not'];
            await safeSendText(sock, msg.key.remoteJid, responses[Math.floor(Math.random() * responses.length)]);
        },
        
        poll: async (sock, msg, args) => {
            if (args.length < 2) {
                return await safeSendText(sock, msg.key.remoteJid, 'Usage: .poll [question] | [option1] | [option2] | ...');
            }
            const fullText = args.join(' ');
            const parts = fullText.split('|').map(part => part.trim());
            const question = parts[0];
            const options = parts.slice(1);
            
            let pollMessage = `📊 *Poll:* ${question}\n\n`;
            options.forEach((option, index) => {
                pollMessage += `${index + 1}. ${option}\n`;
            });
            pollMessage += "\nRespond with the option number to vote!";
            
            await safeSendText(sock, msg.key.remoteJid, pollMessage);
        },
        
        alphabet: async (sock, msg) => {
            await safeSendText(sock, msg.key.remoteJid, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
        },
        
        randomcase: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text');
            const text = args.join(' ').split('').map(c => Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()).join('');
            await safeSendText(sock, msg.key.remoteJid, text);
        },
        
        piglatin: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text to convert');
            const words = args.map(word => {
                if (word.length === 1) return word + 'ay';
                return word.slice(1) + word[0] + 'ay';
            });
            await safeSendText(sock, msg.key.remoteJid, words.join(' '));
        },
        
        wink: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '😉'),
        
        hug2: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '🫂 *Virtual hug sent*'),
        
        dice2: async (sock, msg) => {
            const dice1 = Math.floor(Math.random() * 6) + 1;
            const dice2 = Math.floor(Math.random() * 6) + 1;
            await safeSendText(sock, msg.key.remoteJid, `🎲 You rolled: ${dice1} and ${dice2} (Total: ${dice1 + dice2})`);
        },
        
        weekday: async (sock, msg) => {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[new Date().getDay()];
            await safeSendText(sock, msg.key.remoteJid, `Today is ${today}`);
        },
        
        month: async (sock, msg) => {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const month = months[new Date().getMonth()];
            await safeSendText(sock, msg.key.remoteJid, `Current month is ${month}`);
        },
        
        cooltext: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide some text');
            await safeSendText(sock, msg.key.remoteJid, `★彡 ${args.join(' ')} 彡★`);
        },
        
        wave: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '👋'),
        
        hack: async (sock, msg, args) => {
            if (!args.length) return await safeSendText(sock, msg.key.remoteJid, 'Please provide a target to "hack"');
            const target = args.join(' ');
            await safeSendText(sock, msg.key.remoteJid, `🕵️ Initiating fake hack on ${target}...\n\n[▓▓▓▓▓▓▓▓▓▓] 100%\n\nJust kidding! This is just a fun command 😄`);
        },
        
        high5: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '✋ High five!'),
        
        cheer: async (sock, msg) => await safeSendText(sock, msg.key.remoteJid, '📣 Let\'s go! You can do it! 🎉'),
        
        dateformat: async (sock, msg, args) => {
            const format = args[0] || 'YYYY-MM-DD';
            try {
                const formattedDate = moment().format(format);
                await safeSendText(sock, msg.key.remoteJid, `Date: ${formattedDate}`);
            } catch (err) {
                await safeSendText(sock, msg.key.remoteJid, 'Invalid date format');
            }
        }
    }
};