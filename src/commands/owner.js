const logger = require('../utils/logger');
const globalConfig = require('../config/globalConfig');
const os = require('os');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');
const { normalizeUserIdForBanSystem } = require('../utils/userDatabase');
const { formatPhoneForMention } = require('../utils/helpers');

// Save banned users to file for persistence
async function saveBannedUsers() {
    try {
        const bannedUsersFilePath = path.join(process.cwd(), 'data', 'banned_users.json');
        const bannedUsersDataPath = path.join(process.cwd(), 'data', 'banned_users_data.json');

        // Save basic banned users list (backward compatible)
        const bannedUsersArray = Array.from(global.bannedUsers || []);
        await fs.promises.writeFile(
            bannedUsersFilePath, 
            JSON.stringify(bannedUsersArray, null, 2),
            'utf8'
        );

        // Save extended ban data if available
        if (global.bannedUsersData && global.bannedUsersData.size > 0) {
            // Convert Map to Object for JSON serialization
            const bannedDataObj = {};
            global.bannedUsersData.forEach((data, userId) => {
                bannedDataObj[userId] = data;
            });

            await fs.promises.writeFile(
                bannedUsersDataPath,
                JSON.stringify(bannedDataObj, null, 2),
                'utf8'
            );

            logger.info(`Saved ${global.bannedUsersData.size} detailed ban records`);
        }

        logger.info(`Saved ${bannedUsersArray.length} banned users to file`);
        return true;
    } catch (err) {
        logger.error('Error saving banned users:', err);
        return false;
    }
}

// Load banned users from file
async function loadBannedUsers() {
    try {
        const bannedUsersFilePath = path.join(process.cwd(), 'data', 'banned_users.json');
        const bannedUsersDataPath = path.join(process.cwd(), 'data', 'banned_users_data.json');

        // Create empty banned users set if it doesn't exist
        if (!global.bannedUsers) {
            global.bannedUsers = new Set();
        }

        // Create empty banned users data map if it doesn't exist
        if (!global.bannedUsersData) {
            global.bannedUsersData = new Map();
        }

        // Load basic banned users list (backward compatible)
        if (fs.existsSync(bannedUsersFilePath)) {
            const data = await fs.promises.readFile(bannedUsersFilePath, 'utf8');
            const bannedUsersArray = JSON.parse(data);

            // Add each user to the set
            bannedUsersArray.forEach(userId => {
                global.bannedUsers.add(userId);
            });

            logger.info(`Loaded ${bannedUsersArray.length} banned users from file`);
        } else {
            logger.info('No banned users file found, creating empty list');
            await saveBannedUsers();
        }

        // Load extended ban data if available
        if (fs.existsSync(bannedUsersDataPath)) {
            const data = await fs.promises.readFile(bannedUsersDataPath, 'utf8');
            const bannedDataObj = JSON.parse(data);

            // Convert Object back to Map
            Object.entries(bannedDataObj).forEach(([userId, data]) => {
                global.bannedUsersData.set(userId, data);
            });

            logger.info(`Loaded ${Object.keys(bannedDataObj).length} detailed ban records`);
        } else {
            // Create default data entries for existing banned users without data
            if (global.bannedUsers.size > 0) {
                Array.from(global.bannedUsers).forEach(userId => {
                    if (!global.bannedUsersData.has(userId)) {
                        global.bannedUsersData.set(userId, {
                            jid: `${userId}@s.whatsapp.net`,
                            reason: 'No reason provided',
                            timestamp: Date.now(),
                            bannedBy: 'system',
                            originalJid: `${userId}@s.whatsapp.net`
                        });
                    }
                });

                // Save the newly created data
                await saveBannedUsers();
            }
        }

        return true;
    } catch (err) {
        logger.error('Error loading banned users:', err);
        // Initialize with empty structures to avoid further errors
        global.bannedUsers = new Set();
        global.bannedUsersData = new Map();
        return false;
    }
}

// Helper function to format time
function formatTime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// Format date for display
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Format relative time (e.g., "2 days ago")
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    // Convert to seconds
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) {
        return `${seconds} sec ago`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes} min ago`;
    } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        return `${hours} hr ago`;
    } else {
        const days = Math.floor(seconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
}

// Helper for the detailed ban list format
async function sendDetailedBanList(sock, remoteJid, bannedNumbers, bannedJids) {
    // This format shows full details for each banned user in separate messages
    // Start with a header message
    await safeSendMessage(sock, remoteJid, {
        text: `*📋 BANNED USERS - DETAILED VIEW*\n\nShowing details for ${bannedJids.length} banned user${bannedJids.length !== 1 ? 's' : ''}:`
    });

    // Wait a moment before sending the details
    await new Promise(resolve => setTimeout(resolve, 500));

    // Process each banned user with detailed info
    let index = 0;
    for (const userId of bannedNumbers) {
        index++;
        const jid = `${userId}@s.whatsapp.net`;
        const mentionData = formatPhoneForMention(jid);

        // Get detailed ban data if available
        let detailedInfo = '';
        let mentions = [jid];

        if (global.bannedUsersData && global.bannedUsersData.has(userId)) {
            const banData = global.bannedUsersData.get(userId);

            // Format the ban issuer as a mention if available
            let bannedByText = 'Unknown';
            if (banData.bannedBy) {
                const bannerJid = `${banData.bannedBy}@s.whatsapp.net`;
                bannedByText = `@${banData.bannedBy}`;
                mentions.push(bannerJid);
            }

            detailedInfo = `\n*Reason:* ${banData.reason}\n*Banned By:* ${bannedByText}\n*Date:* ${formatDate(banData.timestamp)}\n*Time Ago:* ${formatRelativeTime(banData.timestamp)}`;
        } else {
            detailedInfo = '\n*Details:* No additional information available';
        }

        // Send detailed info for this user with WhatsApp-style mentions
        await safeSendMessage(sock, remoteJid, {
            text: `*🚫 Banned User #${index}*\n\n*User:* ${mentionData.mention}${detailedInfo}`,
            mentions: mentions
        });

        // Small delay between messages to prevent rate limiting
        if (index < bannedNumbers.length) {
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
}

// Helper for the compact ban list format
async function sendCompactBanList(sock, remoteJid, bannedNumbers, bannedJids) {
    // This format is just a simple list of banned users
    let formattedText = `*📋 BANNED USERS - COMPACT VIEW*\n\n`;

    // Add each user with minimal information
    bannedJids.forEach((jid, index) => {
        const mentionData = formatPhoneForMention(jid);
        formattedText += `${index + 1}. ${mentionData.mention}\n`;
    });

    formattedText += `\n*Total:* ${bannedJids.length} banned user${bannedJids.length !== 1 ? 's' : ''}`;

    // Send the compact list
    await safeSendMessage(sock, remoteJid, {
        text: formattedText,
        mentions: bannedJids
    });
}

// Helper for the standard ban list format
async function sendStandardBanList(sock, remoteJid, bannedNumbers, bannedJids) {
    // This is a "middle ground" format with some details but not too verbose
    let formattedText = `*📋 BANNED USERS - STANDARD VIEW*\n\n`;

    // Create an array of all JIDs to mention (banned users + ban issuers)
    let allMentions = [...bannedJids];

    // Add each banned user with some details
    bannedJids.forEach((jid, index) => {
        const mentionData = formatPhoneForMention(jid);
        const userId = jid.split('@')[0];

        // Get ban reason, time, and issuer if available
        let reason = "Unknown reason";
        let timeAgo = "";
        let bannedBy = "";

        if (global.bannedUsersData && global.bannedUsersData.has(userId)) {
            const banData = global.bannedUsersData.get(userId);
            reason = banData.reason || "No reason provided";
            timeAgo = ` (${formatRelativeTime(banData.timestamp)})`;

            // Add the banner as a WhatsApp mention if available
            if (banData.bannedBy) {
                const bannerJid = `${banData.bannedBy}@s.whatsapp.net`;
                bannedBy = `\n   👮‍♂️ Banned by: @${banData.bannedBy}`;

                // Add to mentions if not already included
                if (!allMentions.includes(bannerJid)) {
                    allMentions.push(bannerJid);
                }
            }
        }

        formattedText += `${index + 1}. ${mentionData.mention}\n   📝 ${reason}${timeAgo}${bannedBy}\n\n`;
    });

    formattedText += `*Total:* ${bannedJids.length} banned user${bannedJids.length !== 1 ? 's' : ''}`;

    // Send the standard format list with all mentions
    await safeSendMessage(sock, remoteJid, {
        text: formattedText,
        mentions: allMentions
    });
}

// Helper for the detailed ban list format
async function sendDetailedBanList(sock, remoteJid, bannedNumbers, bannedJids) {
    // This format shows full details for each banned user in separate messages
    // Start with a header message
    await safeSendMessage(sock, remoteJid, {
        text: `*📋 BANNED USERS - DETAILED VIEW*\n\nShowing details for ${bannedJids.length} banned user${bannedJids.length !== 1 ? 's' : ''}:`
    });

    // Wait a moment before sending the details
    await new Promise(resolve => setTimeout(resolve, 500));

    // Process each banned user with detailed info
    let index = 0;
    for (const userId of bannedNumbers) {
        index++;
        const jid = `${userId}@s.whatsapp.net`;
        const mentionData = formatPhoneForMention(jid);

        // Get detailed ban data if available
        let detailedInfo = '';
        let mentions = [jid];

        if (global.bannedUsersData && global.bannedUsersData.has(userId)) {
            const banData = global.bannedUsersData.get(userId);

            // Format the ban issuer as a mention if available
            let bannedByText = 'Unknown';
            if (banData.bannedBy) {
                const bannerJid = `${banData.bannedBy}@s.whatsapp.net`;
                bannedByText = `@${banData.bannedBy}`;
                mentions.push(bannerJid);
            }

            detailedInfo = `\n*Reason:* ${banData.reason}\n*Banned By:* ${bannedByText}\n*Date:* ${formatDate(banData.timestamp)}\n*Time Ago:* ${formatRelativeTime(banData.timestamp)}`;
        } else {
            detailedInfo = '\n*Details:* No additional information available';
        }

        // Send detailed info for this user with WhatsApp-style mentions
        await safeSendMessage(sock, remoteJid, {
            text: `*🚫 Banned User #${index}*\n\n*User:* ${mentionData.mention}${detailedInfo}`,
            mentions: mentions
        });

        // Small delay between messages to prevent rate limiting
        if (index < bannedNumbers.length) {
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
}

// Helper for the compact ban list format
async function sendCompactBanList(sock, remoteJid, bannedNumbers, bannedJids) {
    // This format is just a simple list of banned users
    let formattedText = `*📋 BANNED USERS - COMPACT VIEW*\n\n`;

    // Add each user with minimal information
    bannedJids.forEach((jid, index) => {
        const mentionData = formatPhoneForMention(jid);
        formattedText += `${index + 1}. ${mentionData.mention}\n`;
    });

    formattedText += `\n*Total:* ${bannedJids.length} banned user${bannedJids.length !== 1 ? 's' : ''}`;

    // Send the compact list
    await safeSendMessage(sock, remoteJid, {
        text: formattedText,
        mentions: bannedJids
    });
}

// Helper for the standard ban list format
async function sendStandardBanList(sock, remoteJid, bannedNumbers, bannedJids) {
    // This is a "middle ground" format with some details but not too verbose
    let formattedText = `*📋 BANNED USERS - STANDARD VIEW*\n\n`;

    // Create an array of all JIDs to mention (banned users + ban issuers)
    let allMentions = [...bannedJids];

    // Add each banned user with some details
    bannedJids.forEach((jid, index) => {
        const mentionData = formatPhoneForMention(jid);
        const userId = jid.split('@')[0];

        // Get ban reason, time, and issuer if available
        let reason = "Unknown reason";
        let timeAgo = "";
        let bannedBy = "";

        if (global.bannedUsersData && global.bannedUsersData.has(userId)) {
            const banData = global.bannedUsersData.get(userId);
            reason = banData.reason || "No reason provided";
            timeAgo = ` (${formatRelativeTime(banData.timestamp)})`;

            // Add the banner as a WhatsApp mention if available
            if (banData.bannedBy) {
                const bannerJid = `${banData.bannedBy}@s.whatsapp.net`;
                bannedBy = `\n   👮‍♂️ Banned by: @${banData.bannedBy}`;

                // Add to mentions if not already included
                if (!allMentions.includes(bannerJid)) {
                    allMentions.push(bannerJid);
                }
            }
        }

        formattedText += `${index + 1}. ${mentionData.mention}\n   📝 ${reason}${timeAgo}${bannedBy}\n\n`;
    });

    formattedText += `*Total:* ${bannedJids.length} banned user${bannedJids.length !== 1 ? 's' : ''}`;

    // Send the standard format list with all mentions
    await safeSendMessage(sock, remoteJid, {
        text: formattedText,
        mentions: allMentions
    });
}

const ownerCommands = {
    /**
     * Set or change the owner number
     * @param {Object} sock - The WhatsApp socket
     * @param {Object} message - The message object
     * @param {Array<string>} args - Command arguments
     */
    async setlanguage(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const isGroup = remoteJid.includes('@g.us');
        const senderJid = message.key.participant || message.key.remoteJid;
        const lang = args[0]?.toLowerCase();

        try {
            // Check if sender is the bot owner
            const config = require('../config/config');
            const ownerNumber = config.owner.number;
            const senderId = senderJid.split('@')[0];

            // Debug logging for troubleshooting owner recognition
            console.log(`Owner check in setlanguage - senderId: ${senderId}, ownerNumber from config: ${ownerNumber}`);

            if (senderId !== ownerNumber) {
                const notOwnerMsg = lang === 'de' ? 
                    '❌ Nur der Bot-Besitzer kann die Sprache ändern.' : 
                    '❌ Only the bot owner can change the language.';
                await safeSendMessage(sock, remoteJid, { 
                    text: notOwnerMsg,
                    mentions: [senderJid] 
                });
                return;
            }

            if (!lang) {
                const noLangMsg = '⚠️ ' + (config.bot.language === 'de' ? 
                    'Bitte Sprachcode angeben (z.B. en, de)' : 
                    'Please specify language code (e.g., en, de)');
                await safeSendText(sock, remoteJid, noLangMsg);
                return;
            }

            // Get language manager
            const { languageManager } = require('../utils/language');

            // Check if language is supported
            if (!languageManager.isLanguageSupported(lang)) {
                const availableLangs = languageManager.getAvailableLanguages().join(', ');
                const langNotSupportedMsg = (config.bot.language === 'de' ? 
                    `❌ Sprache '${lang}' wird nicht unterstützt.\nVerfügbare Sprachen: ` : 
                    `❌ Language '${lang}' is not supported.\nAvailable languages: `) + availableLangs;

                await safeSendMessage(sock, remoteJid, {
                    text: langNotSupportedMsg
                });
                return;
            }

            // Update language in config and language manager
            config.bot.language = lang;

            // Set the language in the language manager
            const langSetSuccess = languageManager.setLanguage(lang);

            if (!langSetSuccess) {
                const errorMsg = lang === 'de' ? 
                    '❌ Fehler beim Ändern der Sprache. Bitte versuche es erneut.' : 
                    '❌ Error changing language. Please try again.';
                await safeSendText(sock, remoteJid, errorMsg);
                return;
            }

            // Try to save config changes
            try {
                const fs = require('fs').promises;
                const path = require('path');
                const configPath = path.join(process.cwd(), 'src', 'config', 'config.json');

                // Check if config file exists first
                const fsSync = require('fs');
                if (fsSync.existsSync(configPath)) {
                    await fs.writeFile(
                        configPath,
                        JSON.stringify({ ...config, bot: { ...config.bot, language: lang } }, null, 2)
                    );
                    logger.info(`Updated config file with new language: ${lang}`);
                } else {
                    logger.warn(`Config file not found at ${configPath}, skipping file update`);
                }
            } catch (configError) {
                logger.error('Error saving config file:', configError);
                // We continue anyway since the in-memory config is already updated
            }

            // Prepare success message based on language
            const successMessage = lang === 'de' ? 
                '✅ Bot-Sprache wurde auf Deutsch geändert' : 
                '✅ Bot language changed to: ' + lang;

            // Add group-specific message if in a group
            let finalMessage = successMessage;
            if (isGroup) {
                const groupAddition = lang === 'de' ? 
                    '\nDie Sprache wurde für alle Gruppen und Chats geändert.' : 
                    '\nLanguage has been changed for all groups and chats.';
                finalMessage += groupAddition;
            }

            await safeSendMessage(sock, remoteJid, { 
                text: finalMessage,
                mentions: isGroup ? [senderJid] : undefined
            });

            logger.info(`Bot language changed to: ${lang} by user ${senderId}`);
        } catch (err) {
            logger.error('Error setting language:', err);
            const errorMsg = lang === 'de' ? 
                '❌ Ein Fehler ist beim Ändern der Sprache aufgetreten' : 
                '❌ An error occurred while setting language';
            await safeSendText(sock, remoteJid, errorMsg);
        }
    },

    async setowner(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const currentJid = message.key.participant || message.key.remoteJid;
        const currentNumber = currentJid.split('@')[0];

        try {
            // Check if command is sent by the current owner or from the same number in .env
            const configOwnerNumber = process.env.OWNER_NUMBER?.replace(/[^0-9]/g, '') || '4915561048015';
            const senderNumber = currentJid.split('@')[0];
            
            // Debug log to troubleshoot owner verification
            console.log(`setowner command - senderNumber: ${senderNumber}, configOwnerNumber: ${configOwnerNumber}`);

            if (senderNumber !== configOwnerNumber) {
                console.log(`Owner check failed in setowner command - senderNumber: ${senderNumber} !== configOwnerNumber: ${configOwnerNumber}`);
                await safeSendText(sock, remoteJid, '❌ Only the current owner can change the owner number.');
                return;
            }

            if (!args || args.length === 0) {
                await safeSendText(sock, remoteJid, `
*Current Owner Number Settings*

Number: ${configOwnerNumber}

To change the owner number, use:
.setowner your_number

Example:
.setowner 123456789012

Note: Use your number in international format without any + sign, spaces, or dashes.
                `.trim());
                return;
            }

            // Get the new owner number from args
            const newOwnerNumber = args[0].replace(/[^0-9]/g, '');

            if (!newOwnerNumber || !/^\d+$/.test(newOwnerNumber)) {
                await safeSendText(sock, remoteJid, '❌ Invalid phone number format. Please provide numbers only, without + sign, spaces, or dashes.');
                return;
            }

            // Update the .env file
            const envPath = path.join(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
                try {
                    // Read the current .env file
                    let envContent = fs.readFileSync(envPath, 'utf8');

                    // Check if OWNER_NUMBER exists and update it
                    if (envContent.includes('OWNER_NUMBER=')) {
                        envContent = envContent.replace(
                            /OWNER_NUMBER=.*/,
                            `OWNER_NUMBER=${newOwnerNumber}`
                        );
                    } else {
                        // Add OWNER_NUMBER if it doesn't exist
                        envContent += `\nOWNER_NUMBER=${newOwnerNumber}\n`;
                    }

                    // Write back to .env file
                    fs.writeFileSync(envPath, envContent);

                    // Update the environment variable in current process
                    process.env.OWNER_NUMBER = newOwnerNumber;

                    await safeSendText(sock, remoteJid, `✅ Owner number successfully updated to ${newOwnerNumber}.\n\nChanges will take full effect after bot restart.`);

                    // Log the change
                    logger.info(`Owner number changed from ${configOwnerNumber} to ${newOwnerNumber}`);
                } catch (writeErr) {
                    logger.error('Error updating .env file:', writeErr);
                    await safeSendText(sock, remoteJid, '❌ Failed to update .env file. Check server logs for details.');
                }
            } else {
                // If .env doesn't exist, inform the user to update manually
                logger.warn('.env file not found, cannot update automatically');
                await safeSendText(sock, remoteJid, 
                    '⚠️ Could not find .env file. Please update your owner number manually:\n\n' +
                    '1. Create or edit your .env file\n' +
                    `2. Add or update this line: OWNER_NUMBER=${newOwnerNumber}\n` +
                    '3. Restart the bot'
                );
            }
        } catch (err) {
            logger.error('Error in setowner command:', err);
            await safeSendText(sock, remoteJid, '❌ An error occurred while setting owner number. Please check logs.');
        }
    },

    // System Management
    async restart(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        try {
            logger.info('Initiating bot restart...');
            await safeSendText(sock, remoteJid, '🔄 Restarting bot...\nPlease wait a moment.' );

            // Close all active connections
            await sock.logout();
            logger.info('WhatsApp connection closed');

            // Give time for messages to be sent
            setTimeout(() => {
                logger.info('Exiting process for restart');
                process.exit(0);
            }, 2000);
        } catch (err) {
            logger.error('Error during restart:', err);
            await safeSendText(sock, remoteJid, '❌ Error during restart. Please check logs.' );
        }
    },

    async shutdown(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        try {
            logger.info('Initiating bot shutdown...');
            await safeSendText(sock, remoteJid, '🛑 Shutting down bot...\nGoodbye!' );

            // Close all active connections
            await sock.logout();
            logger.info('WhatsApp connection closed');

            // Give time for messages to be sent
            setTimeout(() => {
                logger.info('Exiting process for shutdown');
                process.exit(0);
            }, 2000);
        } catch (err) {
            logger.error('Error during shutdown:', err);
            await safeSendText(sock, remoteJid, '❌ Error during shutdown. Please check logs.' );
        }
    },

    async maintenance(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        try {
            const mode = args[0]?.toLowerCase() === 'on';
            logger.info(`Setting maintenance mode to: ${mode}`);

            // Set maintenance mode in global config
            global.maintenanceMode = mode;

            await safeSendMessage(sock, remoteJid, { 
                text: `🛠️ Maintenance mode ${mode ? 'enabled' : 'disabled'}\n${mode ? 'Only owner commands will work.' : 'Normal operations resumed.'}` 
            });

            // Broadcast maintenance status to all active chats
            if (mode) {
                // TODO: Implement broadcast to active chats
                logger.info('Broadcasting maintenance mode status');
            }
        } catch (err) {
            logger.error('Error setting maintenance mode:', err);
            await safeSendText(sock, remoteJid, '❌ Error setting maintenance mode. Please check logs.' );
        }
    },

    // Bot Configuration
    async setname(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const name = args.join(' ');
        if (!name) {
            await safeSendText(sock, remoteJid, '⚠️ Please provide a name' );
            return;
        }

        try {
            // Set WhatsApp display name
            await sock.updateProfileName(name);
            logger.info(`Bot name changed to: ${name}`);
            await safeSendMessage(sock, remoteJid, { text: `✅ Bot name changed to: ${name}` });
        } catch (err) {
            logger.error('Error changing bot name:', err);
            await safeSendText(sock, remoteJid, '❌ Error changing bot name. Please try again.' );
        }
    },

    async setbio(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const bio = args.join(' ');
        if (!bio) {
            await safeSendText(sock, remoteJid, '⚠️ Please provide a bio' );
            return;
        }

        try {
            // Set WhatsApp status/bio
            await sock.updateProfileStatus(bio);
            logger.info(`Bot bio updated to: ${bio}`);
            await safeSendMessage(sock, remoteJid, { text: `✅ Bot bio updated to: ${bio}` });
        } catch (err) {
            logger.error('Error updating bot bio:', err);
            await safeSendText(sock, remoteJid, '❌ Error updating bot bio. Please try again.' );
        }
    },

    async setprefix(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const prefix = args[0];
        if (!prefix) {
            await safeSendText(sock, remoteJid, '⚠️ Please provide a prefix' );
            return;
        }

        try {
            // Update prefix using the global config
            globalConfig.prefix = prefix;
            logger.info(`Bot prefix changed to: ${prefix}`);
            await safeSendMessage(sock, remoteJid, { text: `✅ Prefix updated to: ${prefix}` });
        } catch (err) {
            logger.error('Error setting prefix:', err);
            await safeSendText(sock, remoteJid, '❌ Error updating prefix. Please try again.' );
        }
    },

    async setlanguage(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const lang = args[0]?.toLowerCase();

        try {
            if (!lang) {
                await safeSendText(sock, remoteJid, '⚠️ Please specify language code (e.g., en, de)' );
                return;
            }

            // Get reference to language manager
            const { languageManager } = require('../utils/language');
            const config = require('../config/config');

            // Check if language is supported
            if (!languageManager.isLanguageSupported(lang)) {
                const availableLangs = languageManager.getAvailableLanguages().join(', ');
                await safeSendMessage(sock, remoteJid, { 
                    text: `❌ Language '${lang}' is not supported.\nAvailable languages: ${availableLangs}` 
                });
                return;
            }

            // Update language in config
            config.bot.language = lang;

            // Use the appropriate translation to respond
            const response = languageManager.getText('system.language_changed', lang);
            await safeSendMessage(sock, remoteJid, { text: `✅ ${response}` });
            logger.info(`Bot language changed to: ${lang}`);
        } catch (err) {
            logger.error('Error setting language:', err);
            await safeSendText(sock, remoteJid, '❌ Error setting language. Please check logs.' );
        }
    },

    // Security Management

    async ban(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;
            const senderNumber = senderJid.split('@')[0];
            
            // Verify owner
            const ownerNumber = '4915561048015';
            if (senderNumber !== ownerNumber) {
                return await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by the owner' });
            }

            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (!mentioned || mentioned.length === 0) {
                return await sock.sendMessage(remoteJid, { text: '❌ Tag a user to ban' });
            }

            const userToBan = mentioned[0];
            const fs = require('fs');
            const path = require('path');
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
    },

    /**
     * Helper function to check if user is owner
     */
    isOwner: async function(sock, message) {
        try {
            const senderJid = message.key.participant || message.key.remoteJid;
            const remoteJid = message.key.remoteJid;
            
            // Get sender's number without @s.whatsapp.net
            const senderNumber = senderJid.split('@')[0];
            console.log(`Sender number (extracted): ${senderNumber}`);
            
            // Get owner number from environment variable
            const envOwnerNumber = process.env.OWNER_NUMBER;
            const fallbackOwnerNumber = '4915561048015';
            const ownerNumber = envOwnerNumber || fallbackOwnerNumber;
            
            console.log(`Owner number from env: ${envOwnerNumber || 'not set'}`);
            console.log(`Fallback owner number: ${fallbackOwnerNumber}`);
            console.log(`Using owner number: ${ownerNumber}`);
            
            // Check fromMe status
            const isFromMe = message.key.fromMe === true;
            console.log(`Message fromMe: ${isFromMe}`);
            
            // Check if sender is owner or message is from bot
            const isOwner = senderNumber === ownerNumber;
            console.log(`Sender is owner: ${isOwner}`);
            
            if (!isOwner && !isFromMe) {
                // Debug logging to troubleshoot owner recognition issues
                console.log(`Owner check failed - senderNumber: ${senderNumber} !== ownerNumber: ${ownerNumber}`);
                console.log(`==== END OWNER CHECK DEBUG (UNAUTHORIZED) ====\n`);
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by the owner' });
                return false;
            }
            
            console.log(`Owner authorization successful!`);
            console.log(`==== END OWNER CHECK DEBUG ====\n`);
            return true;
        } catch (err) {
            console.error('Error in owner check:', err);
            return false;
        }
    },
    async unban(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const senderJid = message.key.participant || message.key.remoteJid;
        const senderNumber = senderJid.split('@')[0];

        try {
            // Check if user is mentioned in the message
            let targetJid = '';
            let targetNumber = '';
            let unbanReason = 'No specific reason';

            // Parse the command for target and optional reason

            // Parse the command for target and optional reason
            if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                // User mentioned someone
                targetJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                targetNumber = normalizeUserIdForBanSystem(targetJid);

                // Check if there's a reason after the mention in the message text
                const messageText = message.message?.extendedTextMessage?.text || '';
                const textAfterMention = messageText.split('@')[1];

                if (textAfterMention && textAfterMention.trim().length > 0) {
                    // Try to extract text after the mentioned number
                    const remainingText = textAfterMention.split(' ').slice(1).join(' ');
                    if (remainingText.trim().length > 0) {
                        unbanReason = remainingText.trim();
                    }
                } else if (args.length > 1) {
                    // If there are args after the mention command, use them as reason
                    unbanReason = args.slice(1).join(' ');
                }
            } else if (args && args.length > 0) {
                // Format: .unban phoneNumber reason
                targetNumber = normalizeUserIdForBanSystem(args[0]);
                targetJid = `${targetNumber}@s.whatsapp.net`;

                // If there are additional arguments, join them as the reason
                if (args.length > 1) {
                    unbanReason = args.slice(1).join(' ');
                }
            } else {
                // No target specified
                await safeSendText(sock, remoteJid, '⚠️ Please mention a user or specify a number to unban\n\nFormat: .unban @user reason\n.unban phone_number reason');
                return;
            }

            // Check if user was actually banned
            const wasBanned = global.bannedUsers && global.bannedUsers.has(targetNumber);

            // Get ban data if it exists
            let banData = null;
            if (global.bannedUsersData) {
                banData = global.bannedUsersData.get(targetNumber);
            }

            // Remove from banned users list
            if (global.bannedUsers) {
                global.bannedUsers.delete(targetNumber);
            }

            // Remove from enhanced ban data
            if (global.bannedUsersData) {
                global.bannedUsersData.delete(targetNumber);
            }

            // Save updated banned users list to file
            await saveBannedUsers();

            // Use the enhanced mention formatting
            const mentionData = formatPhoneForMention(targetJid);

            logger.info(`Unbanned user: ${targetNumber} (normalized from input) with reason: ${unbanReason}`);

            // Create a more detailed unban message
            let unbanMsg = `*✅ USER UNBANNED*\n\n*User:* ${mentionData.mention}\n*Unbanned By:* @${senderNumber}`;

            // Add ban details if available
            if (banData) {
                const banDate = new Date(banData.timestamp);
                const formattedBanDate = banDate.toLocaleString();
                unbanMsg += `\n*Original Ban Reason:* ${banData.reason}\n*Originally Banned On:* ${formattedBanDate}`;

                // Add who banned the user
                if (banData.bannedBy) {
                    unbanMsg += `\n*Originally Banned By:* @${banData.bannedBy}`;
                }
            }

            // Add unban reason and current time
            const unbanDate = new Date();
            const formattedUnbanDate = unbanDate.toLocaleString();
            unbanMsg += `\n*Unban Reason:* ${unbanReason}\n*Unbanned At:* ${formattedUnbanDate}`;

            // Send with proper mention format using WhatsApp-compliant mentions
            const mentions = [targetJid, senderJid];
            // Add the original banner to mentions if available
            if (banData && banData.bannedBy) {
                const bannerJid = `${banData.bannedBy}@s.whatsapp.net`;
                if (bannerJid !== senderJid) {
                    mentions.push(bannerJid);
                }
            }

            await safeSendMessage(sock, remoteJid, { 
                text: unbanMsg, 
                mentions: mentions
            });

            // Send a direct message to the unbanned user with an explanation if in group
            if (remoteJid.includes('@g.us')) {
                try {
                    await safeSendMessage(sock, targetJid, {
                        text: `*✅ NOTICE: YOU HAVE BEEN UNBANNED*\n\n*From:* ${remoteJid.split('@')[0]}\n*Reason:* ${unbanReason}\n*Unbanned By:* @${senderNumber}\n*Time:* ${formattedUnbanDate}`,
                        mentions: [senderJid]
                    });
                } catch (dmErr) {
                    // Failed to send direct message, but continue with the unban
                    logger.debug(`Failed to send unban notification DM to ${targetNumber}: ${dmErr.message}`);
                }
            }

            // If user wasn't actually banned, add a note about it
            if (!wasBanned) {
                setTimeout(async () => {
                    await safeSendText(sock, remoteJid, '⚠️ Note: This user was not on the ban list, but the unban operation was still processed.');
                }, 500);
            }
        } catch (err) {
            logger.error('Error unbanning user:', err);
            await safeSendText(sock, remoteJid, '❌ Error unbanning user. Please check logs.');
        }
    },

    async banlist(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const compact = args[0]?.toLowerCase() === 'compact';
        const detailed = args[0]?.toLowerCase() === 'detailed';

        try {
            if (!global.bannedUsers || global.bannedUsers.size === 0) {
                await safeSendText(sock, remoteJid, '📋 *No banned users*\n\nYour ban list is currently empty.');
                return;
            }

            // Get all banned numbers
            const bannedNumbers = Array.from(global.bannedUsers);
            const bannedJids = bannedNumbers.map(num => `${num}@s.whatsapp.net`);

            // Check if format is specified
            if (detailed) {
                // Detailed format (shows full ban details for each user)
                await sendDetailedBanList(sock, remoteJid, bannedNumbers, bannedJids);
            } else if (compact || bannedJids.length > 10) {
                // Compact format (just list of names with minimal details)
                await sendCompactBanList(sock, remoteJid, bannedNumbers, bannedJids); 
            } else {
                // Standard format (tabular with some details)
                await sendStandardBanList(sock, remoteJid, bannedNumbers, bannedJids);
            }

            // Add usage hint at the end for different formats
            setTimeout(async () => {
                await safeSendText(sock, remoteJid, 
                    'ℹ️ *Tip:* Use these options for different views:\n' +
                    '• `.banlist` - standard view\n' +
                    '• `.banlist compact` - simple list\n' +
                    '• `.banlist detailed` - full details'
                );
            }, 800);

            logger.info(`Displayed banned list with ${bannedJids.length} users (format: ${detailed ? 'detailed' : compact ? 'compact' : 'standard'})`);
        } catch (err) {
            logger.error('Error getting banned list:', err);
            await safeSendText(sock, remoteJid, '❌ Error getting banned list. Please check logs.');
        }
    },

    // Broadcast System
    async broadcast(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        try {
            const messageText = args.join(' ');
            if (!messageText) {
                await safeSendText(sock, remoteJid, '⚠️ Please provide a message to broadcast' );
                return;
            }

            logger.info('Starting broadcast to all chats');
            await safeSendText(sock, remoteJid, '📢 Starting broadcast...' );

            // Get all chats
            const chats = await sock.groupFetchAllParticipating();
            let successCount = 0;
            let failCount = 0;

            for (const [chatId, chat] of Object.entries(chats)) {
                try {
                    await safeSendMessage(sock, chatId, { text: `📢 *Broadcast Message*\n\n${messageText}` });
                    successCount++;
                } catch (err) {
                    logger.error(`Failed to broadcast to ${chatId}:`, err);
                    failCount++;
                }
            }

            await safeSendMessage(sock, remoteJid, { 
                text: `📢 Broadcast completed\n✅ Success: ${successCount}\n❌ Failed: ${failCount}` 
            });
        } catch (err) {
            logger.error('Error during broadcast:', err);
            await safeSendText(sock, remoteJid, '❌ Error during broadcast. Please check logs.' );
        }
    },

    // Server Information
    async serverinfo(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        try {
            // Get server information
            const { platform, uptime, cpus, totalmem, freemem } = os;
            const upTime = formatTime(uptime());
            const cpuModel = cpus()[0].model;
            const cpuCount = cpus().length;
            const memUsed = ((totalmem() - freemem()) / 1024 / 1024 / 1024).toFixed(2);
            const memTotal = (totalmem() / 1024 / 1024 / 1024).toFixed(2);
            const memPercent = ((totalmem() - freemem()) / totalmem() * 100).toFixed(2);
            const nodeVersion = process.version;

            const info = `*📊 Server Information*\n\n` +
                         `*OS:* ${platform()}\n` +
                         `*Uptime:* ${upTime}\n` +
                         `*CPU:* ${cpuModel}\n` +
                         `*CPU Cores:* ${cpuCount}\n` +
                         `*Memory:* ${memUsed}GB / ${memTotal}GB (${memPercent}%)\n` +
                         `*Node.js:* ${nodeVersion}`;

            await safeSendText(sock, remoteJid, info );
        } catch (err) {
            logger.error('Error getting server info:', err);
            await safeSendText(sock, remoteJid, '❌ Error getting server information.' );
        }
    },

    // Helper function for initialization
    async init() {
        logger.info('Initializing owner command handler...');

        // Load banned users from file during initialization
        await loadBannedUsers();

        return true;
    }
};

const commands = {
    // Add all owner commands here
    ban: async (sock, message, args) => {
        try {
            const remoteJid = message.key.remoteJid;
            const senderJid = message.key.participant || message.key.remoteJid;
            const senderNumber = senderJid.split('@')[0];
            
            // Verify owner
            const ownerNumber = '4915561048015';
            if (senderNumber !== ownerNumber) {
                return await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by the owner' });
            }

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
    },
    
    // Add other owner commands that were already in the file
    banlist: ownerCommands.banlist,
    broadcast: ownerCommands.broadcast,
    maintenance: ownerCommands.maintenance,
    restart: ownerCommands.restart,
    serverinfo: ownerCommands.serverinfo,
    setbio: ownerCommands.setbio,
    setlanguage: ownerCommands.setlanguage,
    setname: ownerCommands.setname,
    setowner: ownerCommands.setowner,
    setprefix: ownerCommands.setprefix,
    shutdown: ownerCommands.shutdown,
    unban: ownerCommands.unban
};

// Initialize module
async function init(sock) {
    try {
        logger.info('Initializing owner module...');
        // Load banned users during initialization
        await loadBannedUsers();
        return true;
    } catch (err) {
        logger.error('Error initializing owner module:', err);
        return false;
    }
}

module.exports = {
    commands,
    init,
    category: 'owner'
};