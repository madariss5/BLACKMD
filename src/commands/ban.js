const { isOwner } = require('../utils/permissions');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'ban',
  category: 'owner',
  desc: 'Ban a user from using the bot',
  isOwner: true,
  async handle(sock, message, args) {
    try {
      const remoteJid = message.key.remoteJid;
      const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;

      if (!mentioned || mentioned.length === 0) {
        return await sock.sendMessage(remoteJid, { text: '❌ Tag a user to ban' });
      }

      const userToBan = mentioned[0];
      const bannedUsersPath = path.join(process.cwd(), 'data', 'banned_users.json');

      // Load or create banned users list
      let bannedUsers = [];
      if (fs.existsSync(bannedUsersPath)) {
        bannedUsers = JSON.parse(fs.readFileSync(bannedUsersPath));
      }

      // Add user to banned list if not already banned
      if (!bannedUsers.includes(userToBan)) {
        bannedUsers.push(userToBan);
        fs.writeFileSync(bannedUsersPath, JSON.stringify(bannedUsers, null, 2));
        await sock.sendMessage(remoteJid, { text: `✅ User @${userToBan.split('@')[0]} has been banned`, mentions: [userToBan] });
      } else {
        await sock.sendMessage(remoteJid, { text: `❌ User @${userToBan.split('@')[0]} is already banned`, mentions: [userToBan] });
      }
    } catch (err) {
      console.error('Error in ban command:', err);
      await sock.sendMessage(remoteJid, { text: '❌ Error executing ban command' });
    }
  }
};