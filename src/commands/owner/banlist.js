/**
 * Banlist Command
 * Shows the list of users banned from using the bot
 */
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { isBotOwner } = require('../../utils/permissions');

// Commands object that will be exported
const commands = {
    banlist: async (sock, message, args) => {
        try {
            const remoteJid = message.key.remoteJid;
            
            // Enhanced sender identification for all contexts
            let senderJid;
            
            // ADDITIONAL DIAGNOSTIC: Log raw message
            logger.info(`RAW MESSAGE KEY: ${JSON.stringify(message.key)}`);
            
            // If message is from the bot itself, use the bot's ID
            if (message.key.fromMe) {
                senderJid = sock.user?.id;
                logger.info(`Message is from the bot itself (fromMe=true)`);
            }
            // Check if this is a group message by checking the remoteJid format
            else if (message.key.remoteJid.endsWith('@g.us')) {
                // For group messages, we need to use the participant field
                if (message.key.participant) {
                    senderJid = message.key.participant;
                    logger.info(`Group message with participant field: ${senderJid}`);
                } 
                // For some messages, participant might be in message.participant 
                else if (message.participant) {
                    senderJid = message.participant;
                    logger.info(`Group message with message.participant field: ${senderJid}`);
                }
                // Try looking in contextInfo if available
                else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
                    senderJid = message.message.extendedTextMessage.contextInfo.participant;
                    logger.info(`Group message with contextInfo participant: ${senderJid}`);
                }
                // If we still can't find the participant, use the owner number
                else {
                    // This is a fallback for testing - in production we'd need better handling
                    const ownerNumber = process.env.OWNER_NUMBER || '4915561048015';
                    senderJid = `${ownerNumber}@s.whatsapp.net`;
                    logger.info(`Group message without participant - using owner as fallback: ${senderJid}`);
                }
            } 
            // Otherwise use the remoteJid (direct message)
            else {
                senderJid = message.key.remoteJid;
                logger.info(`Direct message. Using remote JID: ${senderJid}`);
            }
            
            // Additional diagnostic logging
            logger.info(`Message properties: remoteJid=${message.key.remoteJid}, fromMe=${message.key.fromMe}`);
            logger.info(`Is group message: ${message.key.remoteJid.endsWith('@g.us')}`);
            if (message.key.participant) {
                logger.info(`Participant field present: ${message.key.participant}`);
            }
            
            // Get the owner number from environment or default
            const ownerNumber = process.env.OWNER_NUMBER || '4915561048015';
            
            // Check if sender is the bot owner using our enhanced utility
            // Pass the full message object for better context
            const isOwner = isBotOwner(senderJid, message);
            
            // Detailed logging for troubleshooting
            logger.info(`=== OWNER CHECK DEBUG (BANLIST) ===`);
            logger.info(`Owner Number from ENV: ${ownerNumber}`);
            logger.info(`Message remote JID: ${message.key.remoteJid}`);
            logger.info(`Message sender JID: ${senderJid}`);
            logger.info(`Is message fromMe: ${message.key.fromMe}`);
            logger.info(`Is in group: ${message.key.participant ? 'yes' : 'no'}`);
            logger.info(`Final owner check result: ${isOwner}`);
            logger.info(`========================`);
            
            // Reject non-owners
            if (!isOwner) {
                return await sock.sendMessage(remoteJid, { 
                    text: '❌ This command can only be used by the bot owner' 
                }, { quoted: message });
            }
            
            // Load banned users list
            const bannedUsersPath = path.join(process.cwd(), 'data', 'banned_users.json');
            
            // Check if the banned users file exists
            if (!fs.existsSync(bannedUsersPath)) {
                return await sock.sendMessage(remoteJid, { 
                    text: '📋 *Ban List*\n\nNo users are currently banned.' 
                });
            }
            
            // Load the banned users list
            const data = fs.readFileSync(bannedUsersPath, 'utf8');
            let bannedUsers = JSON.parse(data || '[]');
            
            // Check if there are any banned users
            if (!bannedUsers.length) {
                return await sock.sendMessage(remoteJid, { 
                    text: '📋 *Ban List*\n\nNo users are currently banned.' 
                });
            }
            
            // Format the list with user mentions
            let mentions = [];
            let formattedList = '📋 *Ban List*\n\n';
            
            bannedUsers.forEach((user, index) => {
                const userNumber = user.split('@')[0];
                formattedList += `${index + 1}. @${userNumber}\n`;
                mentions.push(user);
            });
            
            // Add count at the end
            formattedList += `\n*Total:* ${bannedUsers.length} user(s)`;
            
            // Send the list with mentions
            await sock.sendMessage(remoteJid, { 
                text: formattedList,
                mentions: mentions
            });
            
        } catch (err) {
            logger.error('Error in banlist command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: '❌ Error executing banlist command: ' + err.message 
            });
        }
    }
};

// Initialize function - can be async if needed
async function init() {
    logger.info('Banlist command initialized');
    return true;
}

// Export the module with standard structure
module.exports = {
    commands,
    init,
    category: 'owner'
};