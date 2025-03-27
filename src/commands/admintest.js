/**
 * Admin Test Command Module
 * This module is for testing the admin status detection in groups
 */

const { isBotAdmin, isAdmin } = require('../utils/permissions');
const logger = require('../utils/logger');

/**
 * Test if the bot is recognized as an admin in a group
 * @param {Object} sock - WhatsApp socket connection
 * @param {Object} message - Message object
 */
const admintest = async (sock, message) => {
    const jid = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;

    // Check if this is a group
    const isGroup = jid.endsWith('@g.us');
    if (!isGroup) {
        await sock.sendMessage(jid, { text: '❌ This command must be used in a group!' });
        return;
    }

    try {
        // Check bot admin status
        console.log(`\n==== ADMIN TEST COMMAND DEBUG ====`);
        console.log(`Testing admin status in group: ${jid}`);
        
        const botIsAdmin = await isBotAdmin(sock, jid);
        console.log(`Bot admin status result: ${botIsAdmin ? 'YES' : 'NO'}`);
        
        // Check if the sender is an admin
        const senderIsAdmin = await isAdmin(sock, jid, sender);
        console.log(`Sender admin status result: ${senderIsAdmin ? 'YES' : 'NO'}`);
        console.log(`==== END ADMIN TEST DEBUG ====\n`);
        
        // Send result to the group
        await sock.sendMessage(jid, { 
            text: `*Admin Test Results*\n\n` +
                  `🤖 Bot is admin: ${botIsAdmin ? '✅ YES' : '❌ NO'}\n` +
                  `👤 You are admin: ${senderIsAdmin ? '✅ YES' : '❌ NO'}\n\n` +
                  `Group ID: ${jid}\n` +
                  `Your ID: ${sender}`
        });
    } catch (err) {
        logger.error(`Error in admintest command:`, err);
        await sock.sendMessage(jid, { text: `❌ Error testing admin status: ${err.message}` });
    }
};

module.exports = {
    commands: {
        admintest
    },
    category: 'admin'
};