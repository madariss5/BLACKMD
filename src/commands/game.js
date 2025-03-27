/**
 * Game Commands Module for WhatsApp Bot
 * Contains interactive games and fun activities
 */

const { safeSendText, safeSendImage } = require('../utils/jidHelper');
const { getRandomInt } = require('../utils/mathUtils');
const logger = require('../utils/logger');

module.exports = {
  category: 'game',
  commands: {
    // Existing commands
    tictactoe: async (sock, message, args) => {
      // Implementation for tic tac toe game
      await safeSendText(sock, message.key.remoteJid, '⭕ Tic Tac Toe: Game currently in development. Challenge a friend soon!');
    },

    quiz: async (sock, message, args) => {
      // Implementation for quiz game
      const quizQuestions = [
        { question: "What is the capital of France?", answer: "Paris" },
        { question: "What is the largest planet in our solar system?", answer: "Jupiter" },
        { question: "How many sides does a hexagon have?", answer: "6" }
      ];
      const randomQ = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
      await safeSendText(sock, message.key.remoteJid, `❓ Quiz: ${randomQ.question}\n\nType your answer using .answer [your answer]`);
    },

    answer: async (sock, message, args) => {
      const userAnswer = args.join(" ");
      await safeSendText(sock, message.key.remoteJid, `📝 You answered: ${userAnswer}\n\nUse .quiz for a new question!`);
    },

    truth: async (sock, message, args) => {
      const truths = [
        "What's the most embarrassing thing you've ever done?",
        "What's your biggest fear?",
        "What's the wildest thing you've ever done?",
        "What's your most annoying habit?"
      ];
      await safeSendText(sock, message.key.remoteJid, `🔵 Truth: ${truths[Math.floor(Math.random() * truths.length)]}`);
    },

    dare: async (sock, message, args) => {
      const dares = [
        "Send the last photo you took",
        "Text your crush and say hi",
        "Call a friend and sing a song",
        "Do 10 push-ups right now"
      ];
      await safeSendText(sock, message.key.remoteJid, `🔴 Dare: ${dares[Math.floor(Math.random() * dares.length)]}`);
    },

    // New commands below
    hangman: async (sock, message, args) => {
      const words = ["javascript", "programming", "computer", "algorithm", "database"];
      const word = words[Math.floor(Math.random() * words.length)];
      const hint = word.replace(/[a-z]/gi, "_ ");
      await safeSendText(sock, message.key.remoteJid, `🎮 Hangman Game\n\nGuess this word: ${hint}\n\nUse .guess [letter] to play`);
    },
    
    guess: async (sock, message, args) => {
      if (!args[0]) return await safeSendText(sock, message.key.remoteJid, "Please provide a letter to guess");
      const letter = args[0].toLowerCase();
      await safeSendText(sock, message.key.remoteJid, `You guessed: ${letter}\n\nContinue guessing or use .hangman to start a new game`);
    },
    
    wordle: async (sock, message, args) => {
      const words = ["apple", "beach", "chair", "dance", "eagle"];
      const word = words[Math.floor(Math.random() * words.length)];
      await safeSendText(sock, message.key.remoteJid, `🎮 Wordle\n\nGuess the 5-letter word!\n\nUse .wordleguess [5-letter word] to play`);
    },
    
    wordleguess: async (sock, message, args) => {
      if (!args[0]) return await safeSendText(sock, message.key.remoteJid, "Please provide a 5-letter word");
      const guess = args[0].toLowerCase();
      if (guess.length !== 5) return await safeSendText(sock, message.key.remoteJid, "Please guess a 5-letter word");
      await safeSendText(sock, message.key.remoteJid, `Your guess: ${guess}\n\nContinue guessing or use .wordle to start a new game`);
    },
    
    riddle: async (sock, message, args) => {
      const riddles = [
        "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I? (echo)",
        "The more you take, the more you leave behind. What am I? (footsteps)",
        "What has keys but no locks, space but no room, and you can enter but not go in? (keyboard)"
      ];
      await safeSendText(sock, message.key.remoteJid, `🎮 Riddle: ${riddles[Math.floor(Math.random() * riddles.length)]}`);
    },
    
    rps: async (sock, message, args) => {
      const choices = ["rock", "paper", "scissors"];
      const botChoice = choices[Math.floor(Math.random() * choices.length)];
      const userChoice = args[0]?.toLowerCase();
      
      if (!choices.includes(userChoice)) {
        return await safeSendText(sock, message.key.remoteJid, "Please choose rock, paper, or scissors!");
      }
      
      let result;
      if (userChoice === botChoice) result = "Tie!";
      else if (
        (userChoice === "rock" && botChoice === "scissors") ||
        (userChoice === "paper" && botChoice === "rock") ||
        (userChoice === "scissors" && botChoice === "paper")
      ) result = "You win!";
      else result = "Bot wins!";
      
      await safeSendText(sock, message.key.remoteJid, `🎮 Rock-Paper-Scissors\nYou: ${userChoice}\nBot: ${botChoice}\nResult: ${result}`);
    },
    
    trivia: async (sock, message, args) => {
      const triviaQuestions = [
        "What is the largest ocean on Earth?",
        "Who painted the Mona Lisa?",
        "How many elements are in the periodic table?",
        "What's the smallest country in the world?"
      ];
      await safeSendText(sock, message.key.remoteJid, `🎮 Trivia: ${triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)]}`);
    },
    
    math: async (sock, message, args) => {
      const operations = ["+", "-", "*"];
      const num1 = Math.floor(Math.random() * 20) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      const operation = operations[Math.floor(Math.random() * operations.length)];
      let question = `${num1} ${operation} ${num2} = ?`;
      await safeSendText(sock, message.key.remoteJid, `🎮 Math Quiz: What is ${question}\n\nUse .solve [answer] to respond`);
    },
    
    solve: async (sock, message, args) => {
      if (!args[0]) return await safeSendText(sock, message.key.remoteJid, "Please provide your answer");
      const answer = args[0];
      await safeSendText(sock, message.key.remoteJid, `Your answer: ${answer}\n\nUse .math for a new question`);
    },
    
    scramble: async (sock, message, args) => {
      const words = ["banana", "computer", "elephant", "watermelon", "butterfly"];
      const original = words[Math.floor(Math.random() * words.length)];
      const scrambled = original.split('').sort(() => Math.random() - 0.5).join('');
      await safeSendText(sock, message.key.remoteJid, `🎮 Word Scramble\n\nUnscramble this word: ${scrambled}\n\nUse .unscramble [your answer] to play`);
    },
    
    unscramble: async (sock, message, args) => {
      if (!args[0]) return await safeSendText(sock, message.key.remoteJid, "Please provide your answer");
      const answer = args[0].toLowerCase();
      await safeSendText(sock, message.key.remoteJid, `Your answer: ${answer}\n\nUse .scramble for a new word`);
    },
    
    memory: async (sock, message, args) => {
      const sequence = [];
      for (let i = 0; i < 5; i++) {
        sequence.push(Math.floor(Math.random() * 10));
      }
      await safeSendText(sock, message.key.remoteJid, `🎮 Memory Game\n\nMemorize these numbers: ${sequence.join(' ')}\n\nMessage will disappear in 5 seconds...`);
      
      // In a real implementation, we would delete the message after 5 seconds and have the user recall
      setTimeout(async () => {
        try {
          await safeSendText(sock, message.key.remoteJid, `Time's up! What were the numbers? Use .recall [numbers] to answer`);
        } catch (error) {
          logger.error(`Error in memory game: ${error.message}`);
        }
      }, 5000);
    },
    
    recall: async (sock, message, args) => {
      if (args.length === 0) return await safeSendText(sock, message.key.remoteJid, "Please provide the sequence of numbers");
      const userSequence = args.join(' ');
      await safeSendText(sock, message.key.remoteJid, `Your answer: ${userSequence}\n\nUse .memory to play again`);
    },
    
    dice: async (sock, message, args) => {
      const sides = args[0] ? parseInt(args[0]) : 6;
      if (isNaN(sides) || sides < 1) return await safeSendText(sock, message.key.remoteJid, "Please provide a valid number of sides");
      const result = Math.floor(Math.random() * sides) + 1;
      await safeSendText(sock, message.key.remoteJid, `🎲 Dice Roll (${sides} sides): ${result}`);
    },
    
    spin: async (sock, message, args) => {
      const options = args.length > 0 ? args : ["red", "blue", "green", "yellow"];
      const result = options[Math.floor(Math.random() * options.length)];
      await safeSendText(sock, message.key.remoteJid, `🎮 Spin the Wheel: ${result}`);
    },
    
    flip: async (sock, message) => {
      const result = Math.random() < 0.5 ? "Heads" : "Tails";
      await safeSendText(sock, message.key.remoteJid, `🪙 Coin Flip: ${result}!`);
    },
    
    slot: async (sock, msg) => {
      const symbols = ["🍒", "🍊", "🍋", "🍇", "🍉", "7️⃣"];
      const result = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ];
      
      let resultMessage = `🎰 Slot Machine\n\n${result[0]} | ${result[1]} | ${result[2]}\n\n`;
      
      if (result[0] === result[1] && result[1] === result[2]) {
        resultMessage += "Jackpot! All three match! 🎉";
      } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
        resultMessage += "Two matching symbols! 🎉";
      } else {
        resultMessage += "No matches. Try again!";
      }
      
      await safeSendText(sock, msg.key.remoteJid, resultMessage);
    },
    
    numberguess: async (sock, message, args) => {
      const target = Math.floor(Math.random() * 100) + 1;
      await safeSendText(sock, message.key.remoteJid, `🎮 Number Guessing Game\n\nI'm thinking of a number between 1 and 100.\n\nUse .guess [number] to guess!`);
    },
    
    card: async (sock, message) => {
      const suits = ["♠️", "♥️", "♦️", "♣️"];
      const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      const value = values[Math.floor(Math.random() * values.length)];
      await safeSendText(sock, message.key.remoteJid, `🎮 Random Card: ${value}${suit}`);
    },
    
    deal: async (sock, message, args) => {
      const count = args[0] ? parseInt(args[0]) : 5;
      if (isNaN(count) || count < 1 || count > 10) return await safeSendText(sock, message.key.remoteJid, "Please provide a valid number between 1 and 10");
      
      const suits = ["♠️", "♥️", "♦️", "♣️"];
      const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      let hand = [];
      
      for (let i = 0; i < count; i++) {
        const suit = suits[Math.floor(Math.random() * suits.length)];
        const value = values[Math.floor(Math.random() * values.length)];
        hand.push(`${value}${suit}`);
      }
      
      await safeSendText(sock, message.key.remoteJid, `🎮 Your Hand: ${hand.join(' ')}`);
    },
    
    blackjack: async (sock, message) => {
      await safeSendText(sock, message.key.remoteJid, `🎮 Blackjack\n\nDealing cards...\n\nDealer shows: 7♠️\nYour hand: 10♥️ 8♣️\n\nType .hit to draw another card or .stand to keep your current hand.`);
    },
    
    hit: async (sock, message) => {
      const cards = ["A♠️", "10♥️", "K♦️", "9♣️", "3♥️"];
      const card = cards[Math.floor(Math.random() * cards.length)];
      await safeSendText(sock, message.key.remoteJid, `You drew: ${card}\n\nType .hit to draw again or .stand to keep your current hand.`);
    },
    
    stand: async (sock, message) => {
      await safeSendText(sock, message.key.remoteJid, `You decided to stand.\n\nDealer's hand: 7♠️ 10♣️\nTotal: 17\n\nYour final hand: 10♥️ 8♣️\nTotal: 18\n\nYou win! 🎉\n\nType .blackjack to play again.`);
    },
    
    roll: async (sock, message, args) => {
      const dice = args[0] || "1d6"; // Default to 1d6
      const [count, sides] = dice.toLowerCase().split('d').map(Number);
      
      if (isNaN(count) || isNaN(sides) || count < 1 || sides < 1 || count > 10) {
        return await safeSendText(sock, message.key.remoteJid, "Please use format: [count]d[sides] (e.g., 2d6, 1d20)");
      }
      
      let results = [];
      let total = 0;
      
      for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        results.push(roll);
        total += roll;
      }
      
      await safeSendText(sock, message.key.remoteJid, `🎲 Roll ${dice}: [${results.join(', ')}] = ${total}`);
    },
    
    rockpaperscissors: async (sock, message, args) => {
      if (!args[0]) return await safeSendText(sock, message.key.remoteJid, "Please choose rock, paper, or scissors");
      await safeSendText(sock, message.key.remoteJid, "Use .rps [choice] instead - it's the same game with a shorter command!");
    },
    
    factoid: async (sock, message) => {
      const facts = [
        "The shortest war in history was between Britain and Zanzibar in 1896. It lasted only 38 minutes.",
        "A group of flamingos is called a flamboyance.",
        "The heart of a blue whale is so big, a human could swim through its arteries.",
        "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly good to eat."
      ];
      await safeSendText(sock, message.key.remoteJid, `🎮 Random Fact: ${facts[Math.floor(Math.random() * facts.length)]}`);
    },
    
    wyr: async (sock, message) => {
      const questions = [
        "Would you rather be able to fly or be invisible?",
        "Would you rather live without music or without TV?",
        "Would you rather always be 10 minutes late or always be 20 minutes early?",
        "Would you rather have unlimited money or unlimited time?"
      ];
      await safeSendText(sock, message.key.remoteJid, `🎮 Would You Rather: ${questions[Math.floor(Math.random() * questions.length)]}`);
    },
    
    maze: async (sock, message) => {
      const mazeArt = `
🎮 ASCII Maze Game:

🟦🟦🟦🟦🟦🟦🟦🟦🟦
🟦⬜⬜⬜🟦⬜⬜⬜🟦
🟦🟦🟦⬜🟦⬜🟦⬜🟦
🟦⬜⬜⬜⬜⬜🟦⬜🟦
🟦⬜🟦🟦🟦🟦🟦⬜🟦
🟦⬜⬜⬜⬜⬜⬜⬜🟦
🟦🟦🟦🟦🟦🟦🟦⬜🟦
🟦⬜⬜⬜⬜⬜⬜⬜🟦
🟦🟦🟦🟦🟦🟦🟦🟦🟦

Start at the top left ⬜ and find your way to the bottom right!
`;
      await safeSendText(sock, message.key.remoteJid, mazeArt);
    },
    
    bingo: async (sock, message) => {
      let card = "🎮 BINGO Card\n\n";
      card += "B  I  N  G  O\n";
      
      for (let i = 0; i < 5; i++) {
        let row = [];
        for (let j = 0; j < 5; j++) {
          let num;
          if (i === 2 && j === 2) {
            num = "★"; // Free space
          } else {
            const min = j * 15 + 1;
            const max = (j + 1) * 15;
            num = Math.floor(Math.random() * (max - min + 1)) + min;
          }
          row.push(num.toString().padStart(2));
        }
        card += row.join(" ") + "\n";
      }
      
      await safeSendText(sock, message.key.remoteJid, card);
    },
    
    draw: async (sock, message) => {
      await safeSendText(sock, message.key.remoteJid, `🎨 Drawing Game\n\nI'll start with: 🏠\n\nAdd to the drawing by typing .add [emoji]`);
    },
    
    add: async (sock, message, args) => {
      if (!args[0]) return await safeSendText(sock, message.key.remoteJid, "Please provide an emoji to add to the drawing");
      await safeSendText(sock, message.key.remoteJid, `Added ${args[0]} to the drawing.\n\nCurrent drawing: 🏠${args[0]}\n\nKeep adding with .add [emoji]`);
    }
  }
};