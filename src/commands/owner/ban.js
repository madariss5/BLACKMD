/**
 * Ban User Command
 * Allows the bot owner to ban a user from using the bot
 */
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { isBotOwner } = require('../../utils/permissions');

// Commands object that will be exported
const commands = {
    ban: async (sock, message, args) => {
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
            logger.info(`=== OWNER CHECK DEBUG (BAN) ===`);
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
            
            // DEEP DEBUG: Log the entire message structure for debugging mention issues
            console.log('=== FULL MESSAGE STRUCTURE DEBUG ===');
            console.log(JSON.stringify(message, null, 2));
            console.log('=== MESSAGE.MESSAGE DEBUG ===');
            console.log(JSON.stringify(message.message, null, 2));
            console.log('=== END MESSAGE DEBUG ===');
            
            // Enhanced mention detection with multiple paths
            let mentioned = [];
            
            // Method 1: Standard path
            if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                mentioned = message.message.extendedTextMessage.contextInfo.mentionedJid;
                console.log('Found mentions using standard path:', mentioned);
            }
            // Method 2: Direct message structure for some clients
            else if (message.mentionedJid) {
                mentioned = message.mentionedJid;
                console.log('Found mentions using message.mentionedJid:', mentioned);
            }
            // Method 3: Look in contextInfo at the top level
            else if (message.contextInfo?.mentionedJid) {
                mentioned = message.contextInfo.mentionedJid;
                console.log('Found mentions using message.contextInfo:', mentioned);
            }
            // Method 4: Parse mentions from the text (fallback)
            else {
                // Try to extract mentions from the text using regex
                const textContent = message.message?.conversation || 
                                   message.message?.extendedTextMessage?.text || '';
                
                // Match WhatsApp mention format: @1234567890
                const mentionRegex = /@(\d+)/g;
                let match;
                const mentionedNumbers = [];
                
                while ((match = mentionRegex.exec(textContent)) !== null) {
                    mentionedNumbers.push(match[1]);
                }
                
                // Convert to JID format
                if (mentionedNumbers.length > 0) {
                    mentioned = mentionedNumbers.map(num => `${num}@s.whatsapp.net`);
                    console.log('Extracted mentions from text:', mentioned);
                }
            }
            
            // Check if we have a direct number to ban instead of a mention
            if ((!mentioned || mentioned.length === 0) && args.length > 0) {
                // Check if first argument looks like a phone number
                const phoneNumber = args[0].replace(/[^0-9]/g, '');
                if (phoneNumber.length >= 10) {
                    console.log(`No mentions found, but found direct phone number: ${phoneNumber}`);
                    mentioned = [`${phoneNumber}@s.whatsapp.net`];
                }
            }
            
            if (!mentioned || mentioned.length === 0) {
                console.log('No mentions or phone numbers found');
                return await sock.sendMessage(remoteJid, { 
                    text: '❌ Please either tag a user or provide their phone number.\n\nUsage:\n.ban @user [reason]\n.ban 1234567890 [reason]' 
                });
            }
            
            const userToBan = mentioned[0];
            const userToBanNumber = userToBan.split('@')[0];
            const reason = args.slice(1).join(' ') || 'No reason provided';
            
            // Load or create banned users list
            const dataDir = path.join(process.cwd(), 'data');
            const bannedUsersPath = path.join(dataDir, 'banned_users.json');
            
            // Make sure data directory exists
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            // Load existing banned users or create new array
            let bannedUsers = [];
            if (fs.existsSync(bannedUsersPath)) {
                const data = fs.readFileSync(bannedUsersPath, 'utf8');
                bannedUsers = JSON.parse(data || '[]');
            }
            
            // Check if the user is already banned
            if (!bannedUsers.includes(userToBan)) {
                // Add the user to the banned list
                bannedUsers.push(userToBan);
                
                // Save the updated list
                fs.writeFileSync(bannedUsersPath, JSON.stringify(bannedUsers, null, 2));
                
                // Update the global bannedUsers Set
                if (global.bannedUsers) {
                    // Convert to normalized format for consistency with the global set
                    const { normalizeUserIdForBanSystem } = require('../../utils/userDatabase');
                    const normalizedUserId = normalizeUserIdForBanSystem(userToBan);
                    global.bannedUsers.add(normalizedUserId);
                    logger.info(`Added user ${userToBanNumber} to global.bannedUsers (${normalizedUserId})`);
                } else {
                    logger.warn('global.bannedUsers is not defined, user will be banned after restart');
                }
                
                // Use the bot's jid or a default value for logging since we may not have actual sender info
                const bannerInfo = message.key.fromMe ? 'bot' : 
                                 (senderJid === `${ownerNumber}@s.whatsapp.net` ? 
                                  ownerNumber : 'owner via group');
                logger.info(`User ${userToBanNumber} has been banned by ${bannerInfo}. Reason: ${reason}`);
                
                // Send confirmation message
                await sock.sendMessage(remoteJid, { 
                    text: `🚫 User @${userToBanNumber} has been banned\nReason: ${reason}`,
                    mentions: [userToBan]
                });
            } else {
                // User is already banned
                await sock.sendMessage(remoteJid, { 
                    text: `⚠️ User @${userToBanNumber} is already banned`,
                    mentions: [userToBan]
                });
            }
        } catch (err) {
            logger.error('Error in ban command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: '❌ Error executing ban command: ' + err.message 
            });
        }
    }
};

// Initialize function - can be async if needed
async function init() {
    logger.info('Ban command initialized');
    return true;
}

// Export the module with standard structure
module.exports = {
    commands,
    init,
    category: 'owner'
};