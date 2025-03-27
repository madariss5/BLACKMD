
module.exports = async (sock, message, args) => {
  const choices = ['rock', 'paper', 'scissors'];
  const botChoice = choices[Math.floor(Math.random() * choices.length)];
  const userChoice = args[0]?.toLowerCase();

  if (!choices.includes(userChoice)) {
    return await sock.sendMessage(message.key.remoteJid, { 
      text: '❌ Please choose rock, paper, or scissors!' 
    });
  }

  let result;
  if (userChoice === botChoice) {
    result = "It's a tie!";
  } else if (
    (userChoice === 'rock' && botChoice === 'scissors') ||
    (userChoice === 'paper' && botChoice === 'rock') ||
    (userChoice === 'scissors' && botChoice === 'paper')
  ) {
    result = 'You win! 🎉';
  } else {
    result = 'Bot wins! 🤖';
  }

  await sock.sendMessage(message.key.remoteJid, {
    text: `You chose: ${userChoice}\nBot chose: ${botChoice}\n\n${result}`
  });
};
