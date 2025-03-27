/**
 * Unban User Command
 * Allows the bot owner to unban a previously banned user
 */
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { isBotOwner } = require('../../utils/permissions');

// Commands object that will be exported
const commands = {
    unban: async (sock, message, args) => {
        try {
            const remoteJid = message.key.remoteJid;
            
            // Enhanced sender identification for all contexts
            let senderJid;
            
            // ADDITIONAL DIAGNOSTIC: Log raw message and message object
            logger.info(`RAW MESSAGE KEY: ${JSON.stringify(message.key)}`);
            
            // Log the participant field if it exists in any location
            if (message.key.participant) {
                logger.info(`Direct participant field: ${message.key.participant}`);
            }
            
            if (message.participant) {
                logger.info(`Root message.participant: ${message.participant}`);
            }
            
            // Check for contextInfo
            if (message.message?.extendedTextMessage?.contextInfo) {
                logger.info(`Has contextInfo: ${!!message.message.extendedTextMessage.contextInfo}`);
                if (message.message.extendedTextMessage.contextInfo.participant) {
                    logger.info(`ContextInfo participant: ${message.message.extendedTextMessage.contextInfo.participant}`);
                }
            }
            
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
            logger.info(`=== OWNER CHECK DEBUG (UNBAN) ===`);
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
            
            // Check if a user was mentioned
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            let userToUnban;
            let userToUnbanNumber;
            
            if (mentioned && mentioned.length > 0) {
                // User mentioned someone
                userToUnban = mentioned[0];
                userToUnbanNumber = userToUnban.split('@')[0];
            } else if (args.length > 0) {
                // User provided a number
                userToUnbanNumber = args[0].replace(/[^0-9]/g, '');
                userToUnban = `${userToUnbanNumber}@s.whatsapp.net`;
            } else {
                return await sock.sendMessage(remoteJid, { 
                    text: '❌ Tag a user to unban or provide their number. Usage: .unban @user or .unban 1234567890' 
                });
            }
            
            // Load banned users list
            const bannedUsersPath = path.join(process.cwd(), 'data', 'banned_users.json');
            
            // Check if the banned users file exists
            if (!fs.existsSync(bannedUsersPath)) {
                return await sock.sendMessage(remoteJid, { 
                    text: '⚠️ No banned users found' 
                });
            }
            
            // Load the banned users list
            const data = fs.readFileSync(bannedUsersPath, 'utf8');
            let bannedUsers = JSON.parse(data || '[]');
            
            // Check if the user is in the banned list
            const userIndex = bannedUsers.findIndex(u => u === userToUnban);
            if (userIndex === -1) {
                return await sock.sendMessage(remoteJid, { 
                    text: `⚠️ User @${userToUnbanNumber} is not in the ban list`,
                    mentions: [userToUnban]
                });
            }
            
            // Remove the user from the banned list
            bannedUsers.splice(userIndex, 1);
            
            // Save the updated list
            fs.writeFileSync(bannedUsersPath, JSON.stringify(bannedUsers, null, 2));
            
            // Update the global bannedUsers Set
            if (global.bannedUsers) {
                // Convert to normalized format for consistency with the global set
                const { normalizeUserIdForBanSystem } = require('../../utils/userDatabase');
                const normalizedUserId = normalizeUserIdForBanSystem(userToUnban);
                
                if (global.bannedUsers.has(normalizedUserId)) {
                    global.bannedUsers.delete(normalizedUserId);
                    logger.info(`Removed user ${userToUnbanNumber} from global.bannedUsers (${normalizedUserId})`);
                } else {
                    logger.warn(`User ${userToUnbanNumber} (${normalizedUserId}) not found in global.bannedUsers`);
                }
            } else {
                logger.warn('global.bannedUsers is not defined, user will remain unbanned after restart');
            }
            
            // Use the bot's jid or a default value for logging since we may not have actual sender info
            const unbannerInfo = message.key.fromMe ? 'bot' : 
                               (senderJid === `${ownerNumber}@s.whatsapp.net` ? 
                                ownerNumber : 'owner via group');
            logger.info(`User ${userToUnbanNumber} has been unbanned by ${unbannerInfo}`);
            
            // Send confirmation message
            await sock.sendMessage(remoteJid, { 
                text: `✅ User @${userToUnbanNumber} has been unbanned`,
                mentions: [userToUnban]
            });
            
        } catch (err) {
            logger.error('Error in unban command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: '❌ Error executing unban command: ' + err.message 
            });
        }
    }
};

// Initialize function - can be async if needed
async function init() {
    logger.info('Unban command initialized');
    return true;
}

// Export the module with standard structure
module.exports = {
    commands,
    init,
    category: 'owner'
};