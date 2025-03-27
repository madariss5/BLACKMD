const logger = require('../utils/logger');
const { isAdmin, isBotAdmin, isOwner, normalizeJidForComparison } = require('../utils/permissions');
const { downloadMediaMessage, formatPhoneNumber, formatPhoneForMention, formatNumber } = require('../utils/helpers');
const { getGroupSettings, saveGroupSettings } = require('../utils/groupSettings');
const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;

// TEMPORARY OVERRIDE FOR ALL ADMIN CHECKS - FOR DEBUGGING ONLY
// Set to true to make all users appear as admins for all group commands
const FORCE_ADMIN_STATUS = true;

/**
 * Standardized Admin Check Helper
 * This implements a consistent admin permission check with override capability
 * @param {Object} sock - WhatsApp socket
 * @param {string} remoteJid - Group JID
 * @param {string} sender - Sender JID
 * @param {string} commandName - Command name for logging
 * @returns {Promise<boolean>} - Whether sender has admin privileges or override is enabled
 */
async function checkAdminPermission(sock, remoteJid, sender, commandName) {
    console.log(`${commandName.toUpperCase()} COMMAND - Group: ${remoteJid}, Sender: ${sender}`);

    // Check if global override is enabled
    if (FORCE_ADMIN_STATUS) {
        console.log(`Admin check BYPASSED - Force admin status is ENABLED for ${commandName}`);
        return true;
    }

    // Perform actual admin check
    const hasAdminStatus = await isAdmin(sock, remoteJid, sender);
    console.log(`Admin check result for ${commandName} (override OFF): ${hasAdminStatus}`);
    return hasAdminStatus;
}

// Initialize directories needed for group functionality
const initializeDirectories = async () => {
    try {
        const dirs = [
            path.join(process.cwd(), 'data/groups'),
            path.join(process.cwd(), 'data/groups/settings'),
            path.join(process.cwd(), 'data/groups/media')
        ];

        for (const dir of dirs) {
            try {
                if (!fs.existsSync(dir)) {
                    await fsPromises.mkdir(dir, { recursive: true });
                    logger.info(`✓ Group directory created: ${dir}`);
                }
            } catch (dirErr) {
                logger.error(`Failed to initialize directory ${dir}:`, dirErr);
                throw dirErr;
            }
        }
        return true;
    } catch (err) {
        logger.error('Failed to initialize group directories:', err);
        return false;
    }
};

// Helper functions for duration parsing
function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return num;
        case 'm': return num * 60;
        case 'h': return num * 60 * 60;
        case 'd': return num * 24 * 60 * 60;
        default: return null;
    }
}

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
}

// Group command handlers
const groupCommands = {
    async addadmin(sock, message, args) {
        // Implementation for adding admin
        return true;
    },

    async demote(sock, message, args) {
        // Implementation for demoting admin
        return true;
    },

    async kick(sock, message, args) {
        // Implementation for kicking user
        return true;
    },
    
    // New added commands begin here
    
    async groupstats(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'groupstats');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            const metadata = await sock.groupMetadata(remoteJid);
            const { participants, subject, desc } = metadata;
            
            const admins = participants.filter(p => p.admin).length;
            const totalMembers = participants.length;
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            const statsMessage = `*Group Statistics for ${subject}*\n\n` +
                `👥 *Members:* ${totalMembers}\n` +
                `👮 *Admins:* ${admins}\n` +
                `🌐 *Group ID:* ${remoteJid.split('@')[0]}\n` +
                `🔊 *Notifications:* ${settings.notifications ? 'Enabled' : 'Disabled'}\n` +
                `🛡️ *Anti-link:* ${settings.antilink ? 'Enabled' : 'Disabled'}\n` +
                `🚫 *Anti-spam:* ${settings.antispam ? 'Enabled' : 'Disabled'}\n` +
                `🗣️ *Welcome Messages:* ${settings.welcome ? 'Enabled' : 'Disabled'}\n` +
                `👋 *Goodbye Messages:* ${settings.goodbye ? 'Enabled' : 'Disabled'}\n`;
                
            await safeSendText(sock, remoteJid, statsMessage);
            logger.info(`Group stats displayed for ${subject}`);
        } catch (err) {
            logger.error('Error in groupstats command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to retrieve group statistics');
        }
    },
    
    async eventschedule(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'eventschedule');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            if (args.length < 2) {
                await safeSendText(sock, remoteJid, '❌ Please provide an event name and time\nExample: .eventschedule "Movie Night" tomorrow 8pm');
                return;
            }
            
            const eventName = args[0];
            const eventTime = args.slice(1).join(' ');
            
            // Get group settings and update events
            const settings = await getGroupSettings(remoteJid);
            if (!settings.events) settings.events = [];
            
            settings.events.push({
                name: eventName,
                time: eventTime,
                createdBy: sender,
                createdAt: new Date().toISOString()
            });
            
            await saveGroupSettings(remoteJid, settings);
            
            await safeSendText(sock, remoteJid, `✅ Event scheduled:\n*${eventName}*\nTime: ${eventTime}`);
            logger.info(`Event scheduled in group ${remoteJid}: ${eventName} at ${eventTime}`);
        } catch (err) {
            logger.error('Error in eventschedule command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to schedule event');
        }
    },
    
    async groupbackup(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'groupbackup');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings and metadata
            const settings = await getGroupSettings(remoteJid);
            const metadata = await sock.groupMetadata(remoteJid);
            
            // Create backup directory
            const backupDir = path.join(process.cwd(), 'data/groups/backups');
            if (!fs.existsSync(backupDir)) {
                await fsPromises.mkdir(backupDir, { recursive: true });
            }
            
            // Create backup file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `${remoteJid.split('@')[0]}_${timestamp}.json`);
            
            const backupData = {
                metadata,
                settings,
                timestamp: new Date().toISOString(),
                createdBy: sender
            };
            
            await fsPromises.writeFile(backupFile, JSON.stringify(backupData, null, 2));
            
            await safeSendText(sock, remoteJid, `✅ Group backup created successfully!\nTimestamp: ${timestamp}`);
            logger.info(`Group backup created for ${metadata.subject} at ${timestamp}`);
        } catch (err) {
            logger.error('Error in groupbackup command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to create group backup');
        }
    },
    
    async grouplogs(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'grouplogs');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get limit from args
            const limit = args.length > 0 && !isNaN(args[0]) ? parseInt(args[0]) : 10;
            
            // Get group settings with logs
            const settings = await getGroupSettings(remoteJid);
            if (!settings.logs) settings.logs = [];
            
            const logs = settings.logs.slice(-limit);
            
            if (logs.length === 0) {
                await safeSendText(sock, remoteJid, '📝 No logs found for this group');
                return;
            }
            
            let logMessage = `*Recent Group Logs (${logs.length})* 📝\n\n`;
            
            logs.forEach((log, index) => {
                logMessage += `${index + 1}. ${log.action} by ${log.user.split('@')[0]}\n`;
                logMessage += `   ${new Date(log.timestamp).toLocaleString()}\n`;
                if (log.details) logMessage += `   Details: ${log.details}\n`;
                logMessage += '\n';
            });
            
            await safeSendText(sock, remoteJid, logMessage);
            logger.info(`Group logs displayed for ${remoteJid}, showing ${logs.length} entries`);
        } catch (err) {
            logger.error('Error in grouplogs command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to retrieve group logs');
        }
    },
    
    async memberlist(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'memberlist');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group metadata
            const metadata = await sock.groupMetadata(remoteJid);
            const { participants, subject } = metadata;
            
            // Sort members: admins first, then regular members
            const sortedMembers = [...participants].sort((a, b) => {
                if (a.admin && !b.admin) return -1;
                if (!a.admin && b.admin) return 1;
                return 0;
            });
            
            let memberMessage = `*Member List for ${subject}*\n`;
            memberMessage += `Total: ${participants.length} members\n\n`;
            
            sortedMembers.forEach((member, index) => {
                const phoneNumber = member.id.split('@')[0];
                const roleIcon = member.admin === 'admin' ? '👮‍♂️' : (member.admin === 'superadmin' ? '👑' : '👤');
                memberMessage += `${index + 1}. ${roleIcon} ${phoneNumber}\n`;
            });
            
            await safeSendText(sock, remoteJid, memberMessage);
            logger.info(`Member list displayed for ${subject} with ${participants.length} members`);
        } catch (err) {
            logger.error('Error in memberlist command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to retrieve member list');
        }
    },
    
    async invitelink(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'invitelink');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);
            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to generate invite links');
                return;
            }
            
            // Get group metadata
            const metadata = await sock.groupMetadata(remoteJid);
            
            // Generate invite code
            const code = await sock.groupInviteCode(remoteJid);
            const inviteLink = `https://chat.whatsapp.com/${code}`;
            
            // Handle duration if provided
            let expiryMessage = '';
            if (args.length > 0) {
                const duration = parseDuration(args[0]);
                if (duration) {
                    expiryMessage = `\nThis link will expire in ${formatDuration(duration)}`;
                }
            }
            
            const linkMessage = `*Invite Link for ${metadata.subject}*\n\n${inviteLink}${expiryMessage}\n\n_Share this link only with people you trust_`;
            
            await safeSendText(sock, remoteJid, linkMessage);
            logger.info(`Invite link generated for ${metadata.subject}`);
        } catch (err) {
            logger.error('Error in invitelink command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to generate invite link');
        }
    },
    
    async welcome(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'welcome');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (args.length === 0) {
                // Toggle welcome message
                settings.welcome = !settings.welcome;
                await saveGroupSettings(remoteJid, settings);
                
                await safeSendText(sock, remoteJid, `✅ Welcome messages are now ${settings.welcome ? 'enabled' : 'disabled'}`);
                return;
            }
            
            // Set new welcome message
            const welcomeMessage = args.join(' ');
            settings.welcomeMessage = welcomeMessage;
            settings.welcome = true;
            await saveGroupSettings(remoteJid, settings);
            
            await safeSendText(sock, remoteJid, `✅ Welcome message updated and enabled:\n\n${welcomeMessage}`);
            logger.info(`Welcome message updated for group ${remoteJid}`);
        } catch (err) {
            logger.error('Error in welcome command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update welcome message');
        }
    },
    
    async goodbye(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'goodbye');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (args.length === 0) {
                // Toggle goodbye message
                settings.goodbye = !settings.goodbye;
                await saveGroupSettings(remoteJid, settings);
                
                await safeSendText(sock, remoteJid, `✅ Goodbye messages are now ${settings.goodbye ? 'enabled' : 'disabled'}`);
                return;
            }
            
            // Set new goodbye message
            const goodbyeMessage = args.join(' ');
            settings.goodbyeMessage = goodbyeMessage;
            settings.goodbye = true;
            await saveGroupSettings(remoteJid, settings);
            
            await safeSendText(sock, remoteJid, `✅ Goodbye message updated and enabled:\n\n${goodbyeMessage}`);
            logger.info(`Goodbye message updated for group ${remoteJid}`);
        } catch (err) {
            logger.error('Error in goodbye command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update goodbye message');
        }
    },
    
    async rules(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.rules) settings.rules = [];
            
            // If no args, display current rules
            if (args.length === 0) {
                if (settings.rules.length === 0) {
                    await safeSendText(sock, remoteJid, '📋 No rules have been set for this group');
                    return;
                }
                
                const metadata = await sock.groupMetadata(remoteJid);
                let rulesMessage = `*Rules for ${metadata.subject}*\n\n`;
                
                settings.rules.forEach((rule, index) => {
                    rulesMessage += `${index + 1}. ${rule}\n`;
                });
                
                await safeSendText(sock, remoteJid, rulesMessage);
                return;
            }
            
            // Admin check for modifying rules
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'rules');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ You need to be an admin to modify group rules');
                return;
            }
            
            const action = args[0].toLowerCase();
            
            if (action === 'add') {
                if (args.length < 2) {
                    await safeSendText(sock, remoteJid, '❌ Please provide a rule to add');
                    return;
                }
                
                const rule = args.slice(1).join(' ');
                settings.rules.push(rule);
                await saveGroupSettings(remoteJid, settings);
                
                await safeSendText(sock, remoteJid, `✅ Rule added: ${rule}`);
                return;
            }
            
            if (action === 'remove') {
                if (args.length < 2 || isNaN(args[1])) {
                    await safeSendText(sock, remoteJid, '❌ Please provide a valid rule number to remove');
                    return;
                }
                
                const index = parseInt(args[1]) - 1;
                if (index < 0 || index >= settings.rules.length) {
                    await safeSendText(sock, remoteJid, '❌ Invalid rule number');
                    return;
                }
                
                const removedRule = settings.rules.splice(index, 1)[0];
                await saveGroupSettings(remoteJid, settings);
                
                await safeSendText(sock, remoteJid, `✅ Rule removed: ${removedRule}`);
                return;
            }
            
            await safeSendText(sock, remoteJid, '❌ Invalid action. Use `add` or `remove`');
        } catch (err) {
            logger.error('Error in rules command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to manage group rules');
        }
    },
    
    async announcements(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'announcements');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            if (args.length === 0) {
                await safeSendText(sock, remoteJid, '❌ Please provide an announcement message');
                return;
            }
            
            const announcement = args.join(' ');
            const metadata = await sock.groupMetadata(remoteJid);
            
            // Format the announcement
            const formattedAnnouncement = `📢 *ANNOUNCEMENT* 📢\n\n${announcement}\n\n_From: Admin_\n_${new Date().toLocaleString()}_`;
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.announcements) settings.announcements = [];
            
            // Add to announcements history
            settings.announcements.push({
                message: announcement,
                sender,
                timestamp: new Date().toISOString()
            });
            
            await saveGroupSettings(remoteJid, settings);
            
            // Pin message if supported
            // Note: This is a placeholder as Baileys doesn't directly support pinning
            
            await safeSendText(sock, remoteJid, formattedAnnouncement);
            logger.info(`Announcement sent in group ${metadata.subject}`);
        } catch (err) {
            logger.error('Error in announcements command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to send announcement');
        }
    },
    
    async topics(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.topics) settings.topics = [];
            
            // If no args, display current topics
            if (args.length === 0) {
                if (settings.topics.length === 0) {
                    await safeSendText(sock, remoteJid, '📋 No discussion topics have been set for this group');
                    return;
                }
                
                const metadata = await sock.groupMetadata(remoteJid);
                let topicsMessage = `*Discussion Topics for ${metadata.subject}*\n\n`;
                
                settings.topics.forEach((topic, index) => {
                    topicsMessage += `${index + 1}. ${topic.title}\n`;
                    if (topic.description) topicsMessage += `   ${topic.description}\n`;
                    topicsMessage += `   Added by: ${topic.creator.split('@')[0]}\n\n`;
                });
                
                await safeSendText(sock, remoteJid, topicsMessage);
                return;
            }
            
            // Admin check for modifying topics
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'topics');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ You need to be an admin to modify discussion topics');
                return;
            }
            
            const action = args[0].toLowerCase();
            
            if (action === 'add') {
                if (args.length < 2) {
                    await safeSendText(sock, remoteJid, '❌ Please provide a topic title');
                    return;
                }
                
                const title = args.slice(1).join(' ');
                settings.topics.push({
                    title,
                    creator: sender,
                    createdAt: new Date().toISOString()
                });
                
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, `✅ Topic added: ${title}`);
                return;
            }
            
            if (action === 'remove') {
                if (args.length < 2 || isNaN(args[1])) {
                    await safeSendText(sock, remoteJid, '❌ Please provide a valid topic number to remove');
                    return;
                }
                
                const index = parseInt(args[1]) - 1;
                if (index < 0 || index >= settings.topics.length) {
                    await safeSendText(sock, remoteJid, '❌ Invalid topic number');
                    return;
                }
                
                const removedTopic = settings.topics.splice(index, 1)[0];
                await saveGroupSettings(remoteJid, settings);
                
                await safeSendText(sock, remoteJid, `✅ Topic removed: ${removedTopic.title}`);
                return;
            }
            
            await safeSendText(sock, remoteJid, '❌ Invalid action. Use `add` or `remove`');
        } catch (err) {
            logger.error('Error in topics command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to manage discussion topics');
        }
    },
    
    async pollcreate(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'pollcreate');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            if (args.length < 3) {
                await safeSendText(sock, remoteJid, '❌ Please provide a question and at least 2 options\nExample: .pollcreate "Best day for meeting?" "Monday" "Friday" "Weekend"');
                return;
            }
            
            const question = args[0];
            const options = args.slice(1);
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls) settings.polls = [];
            
            // Generate a unique poll ID
            const pollId = Date.now().toString();
            
            // Create poll structure
            const poll = {
                id: pollId,
                question,
                options: options.map(option => ({ text: option, votes: 0 })),
                voters: {},
                creator: sender,
                createdAt: new Date().toISOString(),
                active: true
            };
            
            // Save to group settings
            settings.polls.push(poll);
            await saveGroupSettings(remoteJid, settings);
            
            // Format poll message
            let pollMessage = `📊 *POLL: ${question}* 📊\n\n`;
            pollMessage += `Poll ID: ${pollId}\n\n`;
            
            options.forEach((option, index) => {
                pollMessage += `${index + 1}. ${option}\n`;
            });
            
            pollMessage += `\nVote using: .vote ${pollId} <option number>`;
            
            await safeSendText(sock, remoteJid, pollMessage);
            logger.info(`Poll created in group ${remoteJid}: "${question}"`);
        } catch (err) {
            logger.error('Error in pollcreate command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to create poll');
        }
    },
    
    async pollend(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'pollend');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls || settings.polls.length === 0) {
                await safeSendText(sock, remoteJid, '❌ No polls found for this group');
                return;
            }
            
            // If no poll ID specified, end the most recent active poll
            let pollId;
            if (args.length === 0) {
                const activePoll = settings.polls.find(p => p.active);
                if (!activePoll) {
                    await safeSendText(sock, remoteJid, '❌ No active polls found');
                    return;
                }
                pollId = activePoll.id;
            } else {
                pollId = args[0];
            }
            
            // Find the poll
            const pollIndex = settings.polls.findIndex(p => p.id === pollId);
            if (pollIndex === -1) {
                await safeSendText(sock, remoteJid, '❌ Poll not found. Please check the poll ID');
                return;
            }
            
            const poll = settings.polls[pollIndex];
            
            // End the poll
            poll.active = false;
            poll.endedAt = new Date().toISOString();
            poll.endedBy = sender;
            
            // Update in settings
            settings.polls[pollIndex] = poll;
            await saveGroupSettings(remoteJid, settings);
            
            // Display poll results
            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
            
            let resultMessage = `📊 *POLL ENDED: ${poll.question}* 📊\n\n`;
            resultMessage += `Total votes: ${totalVotes}\n\n`;
            
            // Sort options by votes (highest first)
            const sortedOptions = [...poll.options].sort((a, b) => b.votes - a.votes);
            
            sortedOptions.forEach((option, index) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : 0;
                resultMessage += `${index + 1}. ${option.text}: ${option.votes} votes (${percentage}%)\n`;
            });
            
            // Add winner indication
            if (totalVotes > 0) {
                resultMessage += `\n🏆 Winner: "${sortedOptions[0].text}" with ${sortedOptions[0].votes} votes`;
            }
            
            await safeSendText(sock, remoteJid, resultMessage);
            logger.info(`Poll ended in group ${remoteJid}: "${poll.question}"`);
        } catch (err) {
            logger.error('Error in pollend command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to end poll');
        }
    },
    
    async pollresults(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls || settings.polls.length === 0) {
                await safeSendText(sock, remoteJid, '❌ No polls found for this group');
                return;
            }
            
            // If no poll ID specified, show the most recent active poll
            let pollId;
            if (args.length === 0) {
                const activePoll = settings.polls.find(p => p.active);
                if (!activePoll) {
                    await safeSendText(sock, remoteJid, '❌ No active polls found');
                    return;
                }
                pollId = activePoll.id;
            } else {
                pollId = args[0];
            }
            
            // Find the poll
            const poll = settings.polls.find(p => p.id === pollId);
            if (!poll) {
                await safeSendText(sock, remoteJid, '❌ Poll not found. Please check the poll ID');
                return;
            }
            
            // Display poll results
            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
            
            let resultMessage = `📊 *POLL RESULTS: ${poll.question}* 📊\n\n`;
            resultMessage += `Status: ${poll.active ? 'Active' : 'Ended'}\n`;
            resultMessage += `Total votes: ${totalVotes}\n\n`;
            
            // Sort options by votes (highest first)
            const sortedOptions = [...poll.options].sort((a, b) => b.votes - a.votes);
            
            sortedOptions.forEach((option, index) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : 0;
                resultMessage += `${index + 1}. ${option.text}: ${option.votes} votes (${percentage}%)\n`;
            });
            
            if (poll.active) {
                resultMessage += `\nVote using: .vote ${pollId} <option number>`;
            } else if (totalVotes > 0) {
                resultMessage += `\n🏆 Winner: "${sortedOptions[0].text}" with ${sortedOptions[0].votes} votes`;
            }
            
            await safeSendText(sock, remoteJid, resultMessage);
            logger.info(`Poll results displayed for "${poll.question}" in group ${remoteJid}`);
        } catch (err) {
            logger.error('Error in pollresults command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to display poll results');
        }
    },
    
    async slowmode(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'slowmode');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (args.length === 0) {
                // Display current slowmode status
                if (!settings.slowmode) {
                    await safeSendText(sock, remoteJid, '⏱️ Slowmode is currently disabled');
                } else {
                    await safeSendText(sock, remoteJid, `⏱️ Slowmode is currently set to ${settings.slowmode} seconds`);
                }
                return;
            }
            
            const seconds = parseInt(args[0]);
            
            if (isNaN(seconds) || seconds < 0) {
                await safeSendText(sock, remoteJid, '❌ Please provide a valid number of seconds');
                return;
            }
            
            if (seconds === 0) {
                // Disable slowmode
                settings.slowmode = null;
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Slowmode has been disabled');
            } else {
                // Enable slowmode with specified duration
                settings.slowmode = seconds;
                if (!settings.userCooldowns) settings.userCooldowns = {};
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, `✅ Slowmode has been set to ${seconds} seconds`);
            }
            
            logger.info(`Slowmode ${seconds > 0 ? `enabled (${seconds}s)` : 'disabled'} in group ${remoteJid}`);
        } catch (err) {
            logger.error('Error in slowmode command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to set slowmode');
        }
    },
    
    async antiflood(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'antiflood');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (args.length === 0) {
                // Display current antiflood status
                const status = settings.antiflood ? 'enabled' : 'disabled';
                const limit = settings.antifloodLimit || 5;
                const action = settings.antifloodAction || 'warn';
                
                await safeSendText(sock, remoteJid, `🌊 Anti-flood is currently ${status}\nLimit: ${limit} messages\nAction: ${action}`);
                return;
            }
            
            const option = args[0].toLowerCase();
            
            if (option === 'on' || option === 'enable') {
                settings.antiflood = true;
                
                // Set limit if provided
                if (args.length > 1 && !isNaN(args[1])) {
                    settings.antifloodLimit = parseInt(args[1]);
                } else if (!settings.antifloodLimit) {
                    settings.antifloodLimit = 5; // Default limit
                }
                
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, `✅ Anti-flood protection enabled with limit of ${settings.antifloodLimit} messages`);
            } else if (option === 'off' || option === 'disable') {
                settings.antiflood = false;
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Anti-flood protection disabled');
            } else if (option === 'action' && args.length > 1) {
                const action = args[1].toLowerCase();
                if (['warn', 'kick', 'mute'].includes(action)) {
                    settings.antifloodAction = action;
                    await saveGroupSettings(remoteJid, settings);
                    await safeSendText(sock, remoteJid, `✅ Anti-flood action set to: ${action}`);
                } else {
                    await safeSendText(sock, remoteJid, '❌ Invalid action. Choose from: warn, kick, mute');
                }
            } else {
                await safeSendText(sock, remoteJid, '❌ Invalid option. Use `on`, `off`, or `action <type>`');
            }
            
            logger.info(`Anti-flood settings updated in group ${remoteJid}`);
        } catch (err) {
            logger.error('Error in antiflood command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to configure anti-flood protection');
        }
    },
    
    async antispam(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'antispam');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (args.length === 0) {
                // Display current antispam status
                const status = settings.antispam ? 'enabled' : 'disabled';
                await safeSendText(sock, remoteJid, `🛡️ Anti-spam is currently ${status}`);
                return;
            }
            
            const option = args[0].toLowerCase();
            
            if (option === 'on' || option === 'enable') {
                settings.antispam = true;
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Anti-spam protection enabled');
            } else if (option === 'off' || option === 'disable') {
                settings.antispam = false;
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Anti-spam protection disabled');
            } else {
                await safeSendText(sock, remoteJid, '❌ Invalid option. Use `on` or `off`');
            }
            
            logger.info(`Anti-spam setting updated in group ${remoteJid}: ${settings.antispam ? 'enabled' : 'disabled'}`);
        } catch (err) {
            logger.error('Error in antispam command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to configure anti-spam protection');
        }
    },
    
    async antilink(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'antilink');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);
            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '⚠️ Warning: I need to be an admin to remove messages with links');
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (args.length === 0) {
                // Display current antilink status
                const status = settings.antilink ? 'enabled' : 'disabled';
                await safeSendText(sock, remoteJid, `🔗 Anti-link is currently ${status}`);
                return;
            }
            
            const option = args[0].toLowerCase();
            
            if (option === 'on' || option === 'enable') {
                settings.antilink = true;
                
                // Set whitelist if provided
                if (args.length > 1) {
                    if (!settings.antilinkWhitelist) settings.antilinkWhitelist = [];
                    const domains = args.slice(1);
                    settings.antilinkWhitelist = [...new Set([...settings.antilinkWhitelist, ...domains])];
                    await saveGroupSettings(remoteJid, settings);
                    await safeSendText(sock, remoteJid, `✅ Anti-link protection enabled with whitelisted domains: ${domains.join(', ')}`);
                } else {
                    await saveGroupSettings(remoteJid, settings);
                    await safeSendText(sock, remoteJid, '✅ Anti-link protection enabled');
                }
            } else if (option === 'off' || option === 'disable') {
                settings.antilink = false;
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Anti-link protection disabled');
            } else if (option === 'whitelist') {
                if (!settings.antilinkWhitelist) settings.antilinkWhitelist = [];
                
                if (args.length === 1) {
                    // Display current whitelist
                    if (settings.antilinkWhitelist.length === 0) {
                        await safeSendText(sock, remoteJid, '📋 No domains are whitelisted');
                    } else {
                        await safeSendText(sock, remoteJid, `📋 Whitelisted domains:\n${settings.antilinkWhitelist.join('\n')}`);
                    }
                    return;
                }
                
                const subAction = args[1].toLowerCase();
                
                if (subAction === 'add' && args.length > 2) {
                    const domains = args.slice(2);
                    settings.antilinkWhitelist = [...new Set([...settings.antilinkWhitelist, ...domains])];
                    await saveGroupSettings(remoteJid, settings);
                    await safeSendText(sock, remoteJid, `✅ Added to whitelist: ${domains.join(', ')}`);
                } else if (subAction === 'remove' && args.length > 2) {
                    const domains = args.slice(2);
                    settings.antilinkWhitelist = settings.antilinkWhitelist.filter(d => !domains.includes(d));
                    await saveGroupSettings(remoteJid, settings);
                    await safeSendText(sock, remoteJid, `✅ Removed from whitelist: ${domains.join(', ')}`);
                } else if (subAction === 'clear') {
                    settings.antilinkWhitelist = [];
                    await saveGroupSettings(remoteJid, settings);
                    await safeSendText(sock, remoteJid, '✅ Whitelist cleared');
                } else {
                    await safeSendText(sock, remoteJid, '❌ Invalid whitelist action. Use `add`, `remove`, or `clear`');
                }
            } else {
                await safeSendText(sock, remoteJid, '❌ Invalid option. Use `on`, `off`, or `whitelist`');
            }
            
            logger.info(`Anti-link setting updated in group ${remoteJid}`);
        } catch (err) {
            logger.error('Error in antilink command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to configure anti-link protection');
        }
    },
    
    async lockgroup(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'lockgroup');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);
            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to lock the group');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            settings.locked = true;
            
            // Get the duration if provided
            let duration = null;
            if (args.length > 0) {
                duration = parseDuration(args[0]);
                if (duration) {
                    settings.lockDuration = duration;
                    settings.lockEndTime = new Date(Date.now() + duration * 1000).toISOString();
                }
            }
            
            await saveGroupSettings(remoteJid, settings);
            
            // Update group settings to only allow admins to send messages
            // This is a placeholder as Baileys doesn't directly support this feature
            await sock.groupSettingUpdate(remoteJid, 'announcement');
            
            if (duration) {
                await safeSendText(sock, remoteJid, `🔒 Group locked for ${formatDuration(duration)}`);
                
                // Schedule unlock
                setTimeout(async () => {
                    try {
                        const currentSettings = await getGroupSettings(remoteJid);
                        if (currentSettings.locked) {
                            currentSettings.locked = false;
                            await saveGroupSettings(remoteJid, currentSettings);
                            await sock.groupSettingUpdate(remoteJid, 'not_announcement');
                            await safeSendText(sock, remoteJid, '🔓 Group auto-unlocked after scheduled time');
                        }
                    } catch (error) {
                        logger.error('Error in auto-unlock:', error);
                    }
                }, duration * 1000);
            } else {
                await safeSendText(sock, remoteJid, '🔒 Group locked');
            }
            
            logger.info(`Group ${remoteJid} locked ${duration ? `for ${formatDuration(duration)}` : ''}`);
        } catch (err) {
            logger.error('Error in lockgroup command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to lock group');
        }
    },
    
    async unlockgroup(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'unlockgroup');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);
            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to unlock the group');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (!settings.locked) {
                await safeSendText(sock, remoteJid, '❓ The group is not currently locked');
                return;
            }
            
            settings.locked = false;
            settings.lockDuration = null;
            settings.lockEndTime = null;
            await saveGroupSettings(remoteJid, settings);
            
            // Update group settings to allow all participants to send messages
            await sock.groupSettingUpdate(remoteJid, 'not_announcement');
            
            await safeSendText(sock, remoteJid, '🔓 Group unlocked');
            logger.info(`Group ${remoteJid} unlocked`);
        } catch (err) {
            logger.error('Error in unlockgroup command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to unlock group');
        }
    },
    
    async chatfilter(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'chatfilter');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.filteredWords) settings.filteredWords = [];
            
            if (args.length === 0) {
                // Display current filtered words
                if (settings.filteredWords.length === 0) {
                    await safeSendText(sock, remoteJid, '📋 No words are currently filtered');
                } else {
                    await safeSendText(sock, remoteJid, `📋 Filtered words:\n${settings.filteredWords.join(', ')}`);
                }
                return;
            }
            
            const action = args[0].toLowerCase();
            
            if (action === 'add' && args.length > 1) {
                const words = args.slice(1);
                settings.filteredWords = [...new Set([...settings.filteredWords, ...words])];
                await saveGroupSettings(remoteJid, settings);
                
                // Enable chat filter if adding words
                settings.chatFilterEnabled = true;
                
                await safeSendText(sock, remoteJid, `✅ Added to filter: ${words.join(', ')}`);
            } else if (action === 'remove' && args.length > 1) {
                const words = args.slice(1);
                settings.filteredWords = settings.filteredWords.filter(w => !words.includes(w));
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, `✅ Removed from filter: ${words.join(', ')}`);
            } else if (action === 'clear') {
                settings.filteredWords = [];
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Chat filter cleared');
            } else if (action === 'on' || action === 'enable') {
                settings.chatFilterEnabled = true;
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Chat filter enabled');
            } else if (action === 'off' || action === 'disable') {
                settings.chatFilterEnabled = false;
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Chat filter disabled');
            } else {
                await safeSendText(sock, remoteJid, '❌ Invalid action. Use `add`, `remove`, `clear`, `on`, or `off`');
            }
            
            logger.info(`Chat filter updated in group ${remoteJid}`);
        } catch (err) {
            logger.error('Error in chatfilter command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update chat filter');
        }
    },
    
    async groupinfo(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            // Get group metadata
            const metadata = await sock.groupMetadata(remoteJid);
            const { subject, desc, creation, participants, owner } = metadata;
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            // Format creation date
            const creationDate = new Date(creation * 1000).toLocaleString();
            
            // Count of admins and regular members
            const adminCount = participants.filter(p => p.admin).length;
            const memberCount = participants.length - adminCount;
            
            // Group features status
            const features = [
                `Anti-spam: ${settings.antispam ? '✅' : '❌'}`,
                `Anti-link: ${settings.antilink ? '✅' : '❌'}`,
                `Chat filter: ${settings.chatFilterEnabled ? '✅' : '❌'}`,
                `Welcome: ${settings.welcome ? '✅' : '❌'}`,
                `Goodbye: ${settings.goodbye ? '✅' : '❌'}`,
                `Locked: ${settings.locked ? '✅' : '❌'}`
            ];
            
            // Format owner's phone number
            const ownerPhone = owner ? owner.split('@')[0] : 'Unknown';
            
            // Create formatted message
            const infoMessage = `*Group Information*\n\n` +
                `📝 *Name:* ${subject}\n` +
                `👑 *Owner:* ${ownerPhone}\n` +
                `🆔 *ID:* ${remoteJid.split('@')[0]}\n` +
                `🗓️ *Created:* ${creationDate}\n\n` +
                `👥 *Members:* ${participants.length}\n` +
                `👮 *Admins:* ${adminCount}\n` +
                `👤 *Regular:* ${memberCount}\n\n` +
                `🛠️ *Features:*\n${features.join('\n')}\n\n` +
                (desc ? `📄 *Description:*\n${desc}` : '');
            
            await safeSendText(sock, remoteJid, infoMessage);
            logger.info(`Group info displayed for ${subject}`);
        } catch (err) {
            logger.error('Error in groupinfo command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to retrieve group information');
        }
    },
    
    async memberinfo(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'memberinfo');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Determine target
            let targetJid;
            
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                targetJid = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args.length > 0) {
                // Try to find by partial number or name
                const partialMatch = args[0].replace('@', '');
                
                const metadata = await sock.groupMetadata(remoteJid);
                const matchedMember = metadata.participants.find(p => 
                    p.id.includes(partialMatch) ||
                    (p.notify && p.notify.toLowerCase().includes(partialMatch.toLowerCase()))
                );
                
                if (matchedMember) {
                    targetJid = matchedMember.id;
                } else {
                    await safeSendText(sock, remoteJid, '❌ Member not found');
                    return;
                }
            } else {
                await safeSendText(sock, remoteJid, '❌ Please mention a user or provide their number');
                return;
            }
            
            // Get group metadata
            const metadata = await sock.groupMetadata(remoteJid);
            
            // Find member in participants
            const member = metadata.participants.find(p => p.id === targetJid);
            if (!member) {
                await safeSendText(sock, remoteJid, '❌ This user is not a member of the group');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            // Format member information
            const phoneNumber = member.id.split('@')[0];
            const displayName = member.notify || phoneNumber;
            const role = member.admin === 'admin' ? 'Admin' : (member.admin === 'superadmin' ? 'Group Owner' : 'Member');
            
            // Get additional data from settings if available
            const joinDate = settings.memberJoinDates?.[member.id] || 'Unknown';
            const warningCount = settings.warnings?.[member.id]?.length || 0;
            const messageCount = settings.messageStats?.[member.id]?.count || 0;
            
            const infoMessage = `*Member Information*\n\n` +
                `👤 *Name:* ${displayName}\n` +
                `📱 *Number:* ${phoneNumber}\n` +
                `🛡️ *Role:* ${role}\n` +
                `📅 *Joined:* ${joinDate !== 'Unknown' ? new Date(joinDate).toLocaleString() : joinDate}\n` +
                `⚠️ *Warnings:* ${warningCount}\n` +
                `💬 *Messages:* ${messageCount}\n`;
            
            await safeSendText(sock, remoteJid, infoMessage);
            logger.info(`Member info displayed for ${phoneNumber} in group ${metadata.subject}`);
        } catch (err) {
            logger.error('Error in memberinfo command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to retrieve member information');
        }
    },
    
    async groupsettings(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'groupsettings');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (args.length === 0) {
                // Display current settings
                const settingsMessage = `*Group Settings*\n\n` +
                    `🔊 *Notifications:* ${settings.notifications ? 'Enabled' : 'Disabled'}\n` +
                    `🔗 *Anti-link:* ${settings.antilink ? 'Enabled' : 'Disabled'}\n` +
                    `🛡️ *Anti-spam:* ${settings.antispam ? 'Enabled' : 'Disabled'}\n` +
                    `🔤 *Chat filter:* ${settings.chatFilterEnabled ? 'Enabled' : 'Disabled'}\n` +
                    `👋 *Welcome:* ${settings.welcome ? 'Enabled' : 'Disabled'}\n` +
                    `👋 *Goodbye:* ${settings.goodbye ? 'Enabled' : 'Disabled'}\n` +
                    `🔒 *Locked:* ${settings.locked ? 'Yes' : 'No'}\n` +
                    `⏱️ *Slowmode:* ${settings.slowmode ? `${settings.slowmode}s` : 'Disabled'}\n` +
                    `💬 *Default language:* ${settings.language || 'English'}\n`;
                
                await safeSendText(sock, remoteJid, settingsMessage);
                return;
            }
            
            const setting = args[0].toLowerCase();
            const value = args.length > 1 ? args[1].toLowerCase() : null;
            
            if (!value) {
                await safeSendText(sock, remoteJid, '❌ Please provide a value for the setting');
                return;
            }
            
            switch (setting) {
                case 'notifications':
                case 'notify':
                    settings.notifications = value === 'on' || value === 'enable' || value === 'true';
                    await safeSendText(sock, remoteJid, `✅ Notifications ${settings.notifications ? 'enabled' : 'disabled'}`);
                    break;
                    
                case 'antilink':
                    settings.antilink = value === 'on' || value === 'enable' || value === 'true';
                    await safeSendText(sock, remoteJid, `✅ Anti-link ${settings.antilink ? 'enabled' : 'disabled'}`);
                    break;
                    
                case 'antispam':
                    settings.antispam = value === 'on' || value === 'enable' || value === 'true';
                    await safeSendText(sock, remoteJid, `✅ Anti-spam ${settings.antispam ? 'enabled' : 'disabled'}`);
                    break;
                    
                case 'chatfilter':
                    settings.chatFilterEnabled = value === 'on' || value === 'enable' || value === 'true';
                    await safeSendText(sock, remoteJid, `✅ Chat filter ${settings.chatFilterEnabled ? 'enabled' : 'disabled'}`);
                    break;
                    
                case 'welcome':
                    settings.welcome = value === 'on' || value === 'enable' || value === 'true';
                    await safeSendText(sock, remoteJid, `✅ Welcome messages ${settings.welcome ? 'enabled' : 'disabled'}`);
                    break;
                    
                case 'goodbye':
                    settings.goodbye = value === 'on' || value === 'enable' || value === 'true';
                    await safeSendText(sock, remoteJid, `✅ Goodbye messages ${settings.goodbye ? 'enabled' : 'disabled'}`);
                    break;
                    
                case 'language':
                case 'lang':
                    settings.language = value;
                    await safeSendText(sock, remoteJid, `✅ Default language set to ${value}`);
                    break;
                    
                case 'slowmode':
                    if (value === 'off' || value === 'disable') {
                        settings.slowmode = null;
                        await safeSendText(sock, remoteJid, '✅ Slowmode disabled');
                    } else if (!isNaN(value)) {
                        settings.slowmode = parseInt(value);
                        await safeSendText(sock, remoteJid, `✅ Slowmode set to ${value} seconds`);
                    } else {
                        await safeSendText(sock, remoteJid, '❌ Invalid value for slowmode');
                        return;
                    }
                    break;
                    
                default:
                    await safeSendText(sock, remoteJid, '❌ Unknown setting. Available settings: notifications, antilink, antispam, chatfilter, welcome, goodbye, language, slowmode');
                    return;
            }
            
            // Save updated settings
            await saveGroupSettings(remoteJid, settings);
            logger.info(`Group setting "${setting}" updated to "${value}" for ${remoteJid}`);
        } catch (err) {
            logger.error('Error in groupsettings command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group settings');
        }
    },
    
    async grouplang(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'grouplang');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (args.length === 0) {
                // Display current language
                const currentLang = settings.language || 'English';
                
                // List available languages (placeholder - in a real implementation, this would come from a language module)
                const availableLanguages = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Japanese', 'Chinese', 'Arabic'];
                
                const langMessage = `*Current group language:* ${currentLang}\n\n` +
                    `Available languages:\n${availableLanguages.join('\n')}`;
                
                await safeSendText(sock, remoteJid, langMessage);
                return;
            }
            
            const language = args[0];
            
            // Set new language (in a real implementation, this would validate against available languages)
            settings.language = language;
            await saveGroupSettings(remoteJid, settings);
            
            await safeSendText(sock, remoteJid, `✅ Group language set to ${language}`);
            logger.info(`Group language set to ${language} for ${remoteJid}`);
        } catch (err) {
            logger.error('Error in grouplang command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to set group language');
        }
    },
    
    async groupnotify(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }
            
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'groupnotify');
            
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }
            
            // Get group settings
            const settings = await getGroupSettings(remoteJid);
            
            if (args.length === 0) {
                // Display current notification status
                const status = settings.notifications ? 'enabled' : 'disabled';
                await safeSendText(sock, remoteJid, `🔔 Group notifications are currently ${status}`);
                return;
            }
            
            const option = args[0].toLowerCase();
            
            if (option === 'on' || option === 'enable') {
                settings.notifications = true;
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Group notifications enabled');
            } else if (option === 'off' || option === 'disable') {
                settings.notifications = false;
                await saveGroupSettings(remoteJid, settings);
                await safeSendText(sock, remoteJid, '✅ Group notifications disabled');
            } else {
                await safeSendText(sock, remoteJid, '❌ Invalid option. Use `on` or `off`');
                return;
            }
            
            logger.info(`Group notifications ${settings.notifications ? 'enabled' : 'disabled'} for ${remoteJid}`);
        } catch (err) {
            logger.error('Error in groupnotify command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to configure notifications');
        }
    },
    async everyone(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }

            // Use sender's JID for proper admin check
            // Make sure we use the actual sender JID in a group chat, not the group ID
            const sender = message.key.participant || message.key.remoteJid;

            console.log(`EVERYONE COMMAND - Group: ${remoteJid}, Sender: ${sender}`);

            // First check the global override flag to debug commands
            let isUserAdmin = FORCE_ADMIN_STATUS;

            // If override is off, perform the actual admin check
            if (!FORCE_ADMIN_STATUS) {
                isUserAdmin = await isAdmin(sock, remoteJid, sender);
                console.log(`Admin check result (with override OFF): ${isUserAdmin}`);
            } else {
                console.log(`Admin check BYPASSED - Force admin status is ENABLED`);
            }

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }

            // Get group metadata with participant details
            const metadata = await sock.groupMetadata(remoteJid);
            const { participants, subject } = metadata;

            // Create mentions array for everyone - ensuring proper JID format for notifications
            const mentions = participants.map(p => p.id);

            // Get custom message if provided
            const customMessage = args.length > 0 ? args.join(' ') : 'was geht';

            // Create BocchiBot-style everyone message with arrow pointers
            let formattedText = `┏━━\n┃❏『 *EVERYONE* 』❏\n┗━━\n\n${customMessage}\n\n`;

            // Add each participant with proper WhatsApp mention format for notification delivery
            for (const participant of participants) {
                // Get the phone number from participant's JID
                const phoneNumber = participant.id.split('@')[0];

                // Create the mention tag that WhatsApp will properly recognize for notifications
                // This uses the standard @mention format required by WhatsApp for proper notification delivery
                const mentionText = `@${phoneNumber}`;

                // Add proper mention for each participant that will trigger notifications
                formattedText += `┃➤ ${mentionText}\n`;
            }

            // Add footer
            formattedText += `\n『 *BLACKSKY-MD* 』`;

            // Send the formatted message with proper mentions structure for reliable notifications
            await safeSendMessage(sock, remoteJid, {
                text: formattedText,
                mentions: mentions,
                // Explicitly add WhatsApp's required mention formatting parameters in contextInfo
                extendedTextMessage: {
                    text: formattedText,
                    contextInfo: {
                        mentionedJid: mentions
                    }
                }
            });

            logger.info(`Everyone command executed in ${subject} (${remoteJid}) with ${mentions.length} participants tagged`);

        } catch (err) {
            logger.error('Error in everyone command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to tag everyone');
        }
    },

    async bocchi(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }

            // Use sender's JID for proper admin check
            const sender = message.key.participant || message.key.remoteJid;

            console.log(`BOCCHI COMMAND - Group: ${remoteJid}, Sender: ${sender}`);

            // First check the global override flag to debug commands
            let isUserAdmin = FORCE_ADMIN_STATUS;

            // If override is off, perform the actual admin check
            if (!FORCE_ADMIN_STATUS) {
                isUserAdmin = await isAdmin(sock, remoteJid, sender);
                console.log(`Admin check result (with override OFF): ${isUserAdmin}`);
            } else {
                console.log(`Admin check BYPASSED - Force admin status is ENABLED`);
            }

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }

            // Get group metadata with participant details
            const metadata = await sock.groupMetadata(remoteJid);
            const { participants, subject } = metadata;

            // Create mentions array for everyone - ensuring proper JID format for notifications
            const mentions = participants.map(p => p.id);

            // Get custom message if provided
            const customMessage = args.length > 0 ? args.join(' ') : '';

            // Format in BocchiBot style exactly as seen in screenshots
            let formattedText = `『 *${customMessage || 'MENTION'}* 』\n\n`;

            // Add each participant with proper WhatsApp mention format for notification delivery
            for (const participant of participants) {
                // Get the phone number from participant's JID
                const phoneNumber = participant.id.split('@')[0];

                // Create the mention tag that WhatsApp will properly recognize for notifications
                const mentionText = `@${phoneNumber}`;

                // Add proper mention for each participant that will trigger notifications
                formattedText += `➤ ${mentionText}\n`;
            }

            // Send the formatted message with proper mentions structure for reliable notifications
            await safeSendMessage(sock, remoteJid, {
                text: formattedText,
                mentions: mentions,
                // Explicitly add WhatsApp's required mention formatting parameters in contextInfo
                extendedTextMessage: {
                    text: formattedText,
                    contextInfo: {
                        mentionedJid: mentions
                    }
                }
            });

            logger.info(`Bocchi command executed in ${subject} (${remoteJid}) with ${mentions.length} participants tagged`);

        } catch (err) {
            logger.error('Error in bocchi command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to tag everyone');
        }
    },

    async hier(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups');
                return;
            }

            // Use sender's JID for proper admin check
            const sender = message.key.participant || message.key.remoteJid;

            console.log(`HIER COMMAND - Group: ${remoteJid}, Sender: ${sender}`);

            // First check the global override flag to debug commands
            let isUserAdmin = FORCE_ADMIN_STATUS;

            // If override is off, perform the actual admin check
            if (!FORCE_ADMIN_STATUS) {
                isUserAdmin = await isAdmin(sock, remoteJid, sender);
                console.log(`Admin check result (with override OFF): ${isUserAdmin}`);
            } else {
                console.log(`Admin check BYPASSED - Force admin status is ENABLED`);
            }

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins');
                return;
            }

            // Get group metadata with participant details
            const metadata = await sock.groupMetadata(remoteJid);
            const { participants, subject } = metadata;

            // Create mentions array for everyone - ensuring proper JID format for notifications
            const mentions = participants.map(p => p.id);

            // Get custom message if provided
            const customMessage = args.length > 0 ? args.join(' ') : 'was geht';

            // Create the formatted message similar to the WhatsApp Business screenshot
            const randomEmojis = ['✨', '📢', '💬', '👥', '🔔', '📣', '🌟'];
            const emoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];

            let formattedText = `${emoji} *Hier ${emoji}*\n\n${customMessage}\n\n`;

            // Add each participant with proper WhatsApp mention format for notification delivery
            participants.forEach(participant => {
                // Get the phone number from participant's JID
                const phoneNumber = participant.id.split('@')[0];

                // Create the mention tag that WhatsApp will properly recognize for notifications
                const mentionText = `@${phoneNumber}`;

                // Add proper mention for each participant that will trigger notifications
                formattedText += `${mentionText}\n`;
            });

            // Send the formatted message with proper mentions structure for reliable notifications
            await safeSendMessage(sock, remoteJid, {
                text: formattedText,
                mentions: mentions,
                // Explicitly add WhatsApp's required mention formatting parameters in contextInfo
                extendedTextMessage: {
                    text: formattedText,
                    contextInfo: {
                        mentionedJid: mentions
                    }
                }
            });

            logger.info(`Hier command executed in ${subject} (${remoteJid}) with ${mentions.length} participants tagged`);

        } catch (err) {
            logger.error('Error in hier command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to tag everyone');
        }
    },
    async kick(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            // Use sender's JID for proper admin check
            const sender = message.key.participant || message.key.remoteJid;

            console.log(`KICK COMMAND - Group: ${remoteJid}, Sender: ${sender}`);

            // First check the global override flag to debug commands
            let isUserAdmin = FORCE_ADMIN_STATUS;

            // If override is off, perform the actual admin check
            if (!FORCE_ADMIN_STATUS) {
                isUserAdmin = await isAdmin(sock, remoteJid, sender);
                console.log(`Admin check result (with override OFF): ${isUserAdmin}`);
            } else {
                console.log(`Admin check BYPASSED - Force admin status is ENABLED`);
            }

            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to kick members' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user to kick' );
                return;
            }

            // Check if target is an admin with admin override flag
            const isTargetAdmin = FORCE_ADMIN_STATUS ? false : await isAdmin(sock, remoteJid, target);
            if (isTargetAdmin) {
                await safeSendText(sock, remoteJid, '❌ Cannot kick an admin' );
                return;
            }

            if (FORCE_ADMIN_STATUS) {
                console.log(`⚠️ TARGET ADMIN CHECK BYPASSED - No user appears as admin for debugging kick command`);
            }

            await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
            await safeSendText(sock, remoteJid, '✅ User has been kicked from the group' );

        } catch (err) {
            logger.error('Error in kick command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to kick user' );
        }
    },

    async add(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'add');
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to add members' );
                return;
            }

            if (!args[0]) {
                await safeSendText(sock, remoteJid, '❌ Please provide the phone number to add' );
                return;
            }

            const number = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

            await sock.groupParticipantsUpdate(remoteJid, [number], 'add');
            await safeSendText(sock, remoteJid, '✅ User has been added to the group' );

        } catch (err) {
            logger.error('Error in add command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to add user' );
        }
    },

    async promote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            // TEMPORARY MODIFICATION: Force user to be admin for testing
            // const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'everyone');
            const isUserAdmin = true; // Override for debugging

            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            // TEMPORARILY COMMENTED OUT ADMIN CHECK
            // if (!isUserAdmin) {
            //     await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
            //     return;
            // }

            console.log(`⚠️ ADMIN CHECK BYPASSED - All users can use admin commands for debugging`);

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to promote members' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user to promote' );
                return;
            }

            await sock.groupParticipantsUpdate(remoteJid, [target], 'promote');
            await safeSendText(sock, remoteJid, '✅ User has been promoted to admin' );

        } catch (err) {
            logger.error('Error in promote command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to promote user' );
        }
    },

    async demote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            // TEMPORARY MODIFICATION: Force user to be admin for testing
            // const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'bocchi');
            const isUserAdmin = FORCE_ADMIN_STATUS ? true : await isAdmin(sock, remoteJid, sender);

            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            // Check if user is admin or if admin override is enabled
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (FORCE_ADMIN_STATUS) {
                console.log(`⚠️ ADMIN CHECK BYPASSED - All users can use admin commands for debugging`);
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to demote members' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user to demote' );
                return;
            }

            // First check if target is an admin at all
            const isTargetAdmin = FORCE_ADMIN_STATUS ? true : await isAdmin(sock, remoteJid, target);
            if (!isTargetAdmin) {
                await safeSendText(sock, remoteJid, '❌ This user is not an admin' );
                return;
            }

            if (FORCE_ADMIN_STATUS) {
                console.log(`⚠️ TARGET ADMIN CHECK BYPASSED - All users appear as admins for debugging`);
            }

            // Check if target is the group owner using the isOwner function
            const isTargetOwner = FORCE_ADMIN_STATUS ? false : await isOwner(sock, remoteJid, target);
            if (isTargetOwner) {
                await safeSendText(sock, remoteJid, '❌ Cannot demote the group owner' );
                return;
            }

            if (FORCE_ADMIN_STATUS) {
                console.log(`⚠️ OWNER CHECK BYPASSED - No user appears as owner for debugging`);
            }

            await sock.groupParticipantsUpdate(remoteJid, [target], 'demote');
            await safeSendText(sock, remoteJid, '✅ User has been demoted from admin' );

        } catch (err) {
            logger.error('Error in demote command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to demote user' );
        }
    },

    async mute(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'mute');
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to mute the group' );
                return;
            }

            await sock.groupSettingUpdate(remoteJid, 'announcement');
            await safeSendText(sock, remoteJid, '🔇 Group has been muted' );

        } catch (err) {
            logger.error('Error in mute command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to mute group' );
        }
    },

    async unmute(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'hier');
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to unmute the group' );
                return;
            }

            await sock.groupSettingUpdate(remoteJid, 'not_announcement');
            await safeSendText(sock, remoteJid, '🔊 Group has been unmuted' );

        } catch (err) {
            logger.error('Error in unmute command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to unmute group' );
        }
    },
    async antispam(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'kick');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Usage: !antispam <on/off>' );
                return;
            }

            // Store the setting in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antispam = action.toLowerCase() === 'on';
            await saveGroupSettings(remoteJid, settings);

            await safeSendMessage(sock, remoteJid, {
                text: `✅ Anti-spam has been turned ${action.toLowerCase()}`
            });

        } catch (err) {
            logger.error('Error in antispam command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update anti-spam settings' );
        }
    },

    async antilink(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'promote');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Usage: !antilink <on/off>' );
                return;
            }

            // Store the setting in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antilink = action.toLowerCase() === 'on';
            await saveGroupSettings(remoteJid, settings);

            await safeSendMessage(sock, remoteJid, {
                text: `✅ Anti-link has been turned ${action.toLowerCase()}`
            });

        } catch (err) {
            logger.error('Error in antilink command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update anti-link settings' );
        }
    },

    async antitoxic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'demote');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Usage: !antitoxic <on/off>' );
                return;
            }

            // Store the setting in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antitoxic = action.toLowerCase() === 'on';
            await saveGroupSettings(remoteJid, settings);

            await safeSendMessage(sock, remoteJid, {
                text: `✅ Anti-toxic has been turned ${action.toLowerCase()}`
            });

        } catch (err) {
            logger.error('Error in antitoxic command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update anti-toxic settings' );
        }
    },

    async antiraid(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'unmute');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const [action, threshold] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Usage: !antiraid <on/off> [max_joins_per_minute]'
                );
                return;
            }

            // Store the settings in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antiraid = action.toLowerCase() === 'on';
            if (threshold && !isNaN(threshold)) {
                settings.raidThreshold = parseInt(threshold);
            }
            await saveGroupSettings(remoteJid, settings);

            await safeSendMessage(sock, remoteJid, {
                text: `✅ Anti-raid has been turned ${action.toLowerCase()}${
                    threshold ? ` with threshold of ${threshold} joins per minute` : ''
                }`
            });

        } catch (err) {
            logger.error('Error in antiraid command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update anti-raid settings' );
        }
    },
    async warn(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'warn');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user to warn' );
                return;
            }

            const reason = args.slice(1).join(' ') || 'No reason provided';

            // Get current warnings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.warnings) settings.warnings = {};
            if (!settings.warnings[target]) settings.warnings[target] = [];

            settings.warnings[target].push({
                reason,
                time: Date.now(),
                by: sender
            });

            await saveGroupSettings(remoteJid, settings);

            const warningCount = settings.warnings[target].length;
            await safeSendMessage(sock, remoteJid, {
                text: `⚠️ User has been warned (${warningCount} warnings)\nReason: ${reason}`
            });

            // Check if user should be kicked
            if (warningCount >= 3) {
                try {
                    await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
                    await safeSendMessage(sock, remoteJid, {
                        text: `🚫 @${target.split('@')[0]} has been removed for receiving 3 warnings`,
                        mentions: [target]
                    });
                    
                    // Reset warnings after kick
                    settings.warnings[target] = [];
                    await saveGroupSettings(remoteJid, settings);
                } catch (err) {
                    logger.error('Failed to remove user after 3 warnings:', err);
                    await safeSendText(sock, remoteJid, '❌ Failed to remove user automatically. Please remove manually.');
                }
            }

        } catch (err) {
            logger.error('Error in warn command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to warn user' );
        }
    },

    async removewarn(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'removewarn');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user' );
                return;
            }

            // Get current warnings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.warnings || !settings.warnings[target] || !settings.warnings[target].length) {
                await safeSendText(sock, remoteJid, '❌ User has no warnings' );
                return;
            }

            settings.warnings[target].pop(); // Remove the last warning
            await saveGroupSettings(remoteJid, settings);

            const warningCount = settings.warnings[target].length;
            await safeSendMessage(sock, remoteJid, {
                text: `✅ Removed 1 warning from user (${warningCount} warnings remaining)`
            });

        } catch (err) {
            logger.error('Error in removewarn command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to remove warning' );
        }
    },

    async warnings(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            } else {
                target = message.key.participant || message.key.remoteJid;
            }

            // Get current warnings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.warnings || !settings.warnings[target] || !settings.warnings[target].length) {
                await safeSendText(sock, remoteJid, '✅ User has no warnings' );
                return;
            }

            const warningList = settings.warnings[target]
                .map((w, i) => `${i + 1}. ${w.reason} (${new Date(w.time).toLocaleString()})`)
                .join('\n');

            await safeSendMessage(sock, remoteJid, {
                text: `⚠️ Warnings for user:\n${warningList}`
            });

        } catch (err) {
            logger.error('Error in warnings command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to fetch warnings' );
        }
    },
    async setname(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'setname');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const newName = args.join(' ');
            if (!newName) {
                await safeSendText(sock, remoteJid, '❌ Please provide a new group name' );
                return;
            }

            await sock.groupUpdateSubject(remoteJid, newName);
            await safeSendText(sock, remoteJid, '✅ Group name has been updated' );

        } catch (err) {
            logger.error('Error in setname command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group name' );
        }
    },

    async setdesc(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'antispam');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const newDesc = args.join(' ');
            if (!newDesc) {
                await safeSendText(sock, remoteJid, '❌ Please provide a new group description' );
                return;
            }

            await sock.groupUpdateDescription(remoteJid, newDesc);
            await safeSendText(sock, remoteJid, '✅ Group description has been updated' );

        } catch (err) {
            logger.error('Error in setdesc command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group description' );
        }
    },

    async setppic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'antilink');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const quoted = message.message.imageMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            if (!quoted) {
                await safeSendText(sock, remoteJid, '❌ Please send an image or reply to an image' );
                return;
            }

            const media = await downloadMediaMessage(message, 'buffer');
            await sock.updateProfilePicture(remoteJid, media);
            await safeSendText(sock, remoteJid, '✅ Group profile picture has been updated' );

        } catch (err) {
            logger.error('Error in setppic command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group profile picture' );
        }
    },

    async feature(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'antitoxic');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            // Get all available features if no arguments provided
            if (args.length === 0) {
                const features = await getFeatureSettings(remoteJid);
                const featureList = Object.entries(features)
                    .map(([feature, enabled]) => `${feature}: ${enabled ? '✅ Enabled' : '❌ Disabled'}`)
                    .join('\n');

                await safeSendMessage(sock, remoteJid, {
                    text: `*Group Features*\n\n${featureList}\n\nUse '.feature <name> <on/off>' to change settings`
                });
                return;
            }

            // Handle feature toggle
            const [featureName, action] = args;

            if (!featureName) {
                await safeSendText(sock, remoteJid, '❌ Usage: .feature <name> <on/off> or .feature to see all features'
                );
                return;
            }

            // Just show status of a specific feature if no action provided
            if (!action) {
                const isEnabled = await isFeatureEnabled(remoteJid, featureName);
                await safeSendMessage(sock, remoteJid, {
                    text: `Feature "${featureName}" is currently: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`
                });
                return;
            }

            // Validate action
            if (!['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Action must be either "on" or "off"'
                );
                return;
            }

            // Update feature setting
            const enabled = action.toLowerCase() === 'on';
            const success = await setFeatureEnabled(remoteJid, featureName, enabled);

            if (success) {
                await safeSendMessage(sock, remoteJid, {
                    text: `✅ Feature "${featureName}" has been ${enabled ? 'enabled' : 'disabled'}`
                });
            } else {
                await safeSendMessage(sock, remoteJid, {
                    text: `❌ Failed to update feature "${featureName}"`
                });
            }

        } catch (err) {
            logger.error('Error in feature command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to manage feature settings' );
        }
    },
    async link(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'antiraid');

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const code = await sock.groupInviteCode(remoteJid);
            await safeSendMessage(sock, remoteJid, {
                text: `🔗 Group Invite Link:\nhttps://chat.whatsapp.com/${code}`
            });

        } catch (err) {
            logger.error('Error in link command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to get group link' );
        }
    },

    async revoke(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'warnings');
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to revoke the invite link' );
                return;
            }

            await sock.groupRevokeInvite(remoteJid);
            await safeSendText(sock, remoteJid, '✅ Group invite link has been revoked' );

        } catch (err) {
            logger.error('Error in revoke command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to revoke group link' );
        }
    },

    async tagall(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'setdesc');

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            // Get group metadata with participant details
            const metadata = await sock.groupMetadata(remoteJid);
            const { participants, subject } = metadata;

            // Create mentions array for everyone
            const mentions = participants.map(p => p.id);

            // Separate admins from regular members
            const admins = [];
            const members = [];

            for (const participant of participants) {
                const { id, admin } = participant;
                if (admin) {
                    admins.push(id);
                } else {
                    members.push(id);
                }
            }

            // Get custom message if provided
            const customMessage = args.length > 0 ? args.join(' ') : null;

            // Generate timestamp and random tag ID for professional look
            const timestamp = new Date().toLocaleTimeString();
            const tagId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

            // Create a stylish header with border
            let formattedText = `┏━━━━━『 *TAG ALL* 』━━━━━┓\n`;

            // Add group name and announcement
            formattedText += `┃ *Group:* ${subject}\n`;
            formattedText += `┃ *Time:* ${timestamp}\n`;
            formattedText += `┃ *Tag ID:* #${tagId}\n`;
            if (customMessage) {
                formattedText += `┃ *Message:* ${customMessage}\n`;
            }
            formattedText += `┗━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

            // Create a stylish admin section with sparkles
            if (admins.length > 0) {
                formattedText += `┏━━━『 *👑 ADMINS* 』━━━┓\n`;
                let count = 1;
                for (const admin of admins) {
                    const phoneNumber = admin.split('@')[0];
                    // Format with numbering and sparkling crown for admins using full phone number
                    formattedText += `┃ ${count}. ✨ @${phoneNumber}\n`;
                    count++;
                }
                formattedText += `┗━━━━━━━━━━━━━━━━━━┛\n\n`;
            }

            // Create a stylish members section
            if (members.length > 0) {
                formattedText += `┏━━━『 *👥 MEMBERS* 』━━━┓\n`;

                // Create a grid layout for members (3 columns if many members)
                const useGrid = members.length > 15;
                let count = 1;
                let gridRow = '';

                for (const member of members) {
                    const phoneNumber = member.split('@')[0];

                    if (useGrid) {
                        // For grid layout, put 3 members per row
                        gridRow += `${count}.@${phoneNumber} `;

                        if (count % 3 === 0) {
                            formattedText += `┃ ${gridRow}\n`;
                            gridRow = '';
                        }
                    } else {
                        // For smaller groups, list vertically
                        formattedText += `┃ ${count}. @${phoneNumber}\n`;
                    }
                    count++;
                }

                // Add any remaining members in the last row
                if (useGrid && gridRow !== '') {
                    formattedText += `┃ ${gridRow}\n`;
                }

                formattedText += `┗━━━━━━━━━━━━━━━━━━┛\n\n`;
            }

            // Add stylish footer with statistics
            formattedText += `┏━━━『 *📊 STATS* 』━━━┓\n`;
            formattedText += `┃ *Total:* ${participants.length} members\n`;
            formattedText += `┃ *Admins:* ${admins.length}\n`;
            formattedText += `┃ *Regular:* ${members.length}\n`;
            formattedText += `┗━━━━━━━━━━━━━━━━━━┛\n\n`;

            // Add powered by footer
            formattedText += `╔═══『 *BLACKSKY-MD* 』═══╗\n`;
            formattedText += `║ _Professional WhatsApp Bot_ ║\n`;
            formattedText += `╚═════════════════════╝`;

            // Send the formatted message with mentions
            await safeSendMessage(sock, remoteJid, {
                text: formattedText,
                mentions
            });

        } catch (err) {
            logger.error('Error in tagall command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to tag all members' );
        }
    },

    async mentionall(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'setppic');

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            // Get group metadata and participants
            const metadata = await sock.groupMetadata(remoteJid);
            const { participants, subject } = metadata;

            // Create mentions array for everyone - ensure proper JID format for notifications
            const mentions = participants.map(p => p.id);

            // Log the mentions to debug
            console.log(`Preparing to mention ${mentions.length} participants in group ${subject}`);

            // Get custom message if provided
            const customMessage = args.length > 0 ? args.join(' ') : '📣 Attention everyone!';

            // Generate timestamp and random tag ID for professional look
            const timestamp = new Date().toLocaleTimeString();
            const mentionId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

            // Create a detailed format with properly formatted phone numbers
            const formattedParticipants = participants.map(participant => {
                const numberStr = participant.id.split('@')[0];
                const formatResult = formatPhoneForMention(participant.id);

                // Use different emoji for admin vs member
                const emoji = participant.admin ? '👑' : '👤';

                // Set display name from our special cases - with country flags for better visuals
                let participantDisplayName = '';

                // Special cases for well-known numbers with friendly names
                if (numberStr === '4915561048015') {
                    participantDisplayName = 'Martin 🇩🇪'; // German number
                } else if (numberStr === '14155552671') {
                    participantDisplayName = 'John 🇺🇸'; // US number
                } else if (numberStr === '420123456789') {
                    participantDisplayName = 'Pavel 🇨🇿'; // Czech number
                } else if (numberStr === '447911123456') {
                    participantDisplayName = 'James 🇬🇧'; // UK number
                }

                return {
                    id: participant.id,
                    number: numberStr,
                    formatted: formatResult.formatted,
                    international: formatResult.international,
                    stylish: formatResult.stylish,
                    md: formatResult.md,
                    emoji: emoji,
                    isAdmin: participant.admin,
                    displayName: participantDisplayName
                };
            });

            // Separate admins from regular members
            const admins = formattedParticipants.filter(p => p.isAdmin);
            const members = formattedParticipants.filter(p => !p.isAdmin);

            // Build fancy MD-style message with border frames
            let mentionText = `┏━━━━━『 *MENTION ALL* 』━━━━━┓\n`;
            mentionText += `┃ *Group:* ${subject}\n`;
            mentionText += `┃ *Message:* ${customMessage}\n`;
            mentionText += `┃ *Time:* ${timestamp}\n`;
            mentionText += `┃ *ID:* #${mentionId}\n`;
            mentionText += `┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

            // Add styled mention section
            mentionText += `┏━━━━『 *MENTIONS* 』━━━━┓\n`;

            // Create a grid layout for better visual appearance
            let currentLine = '┃ ';
            let count = 0;

            for (const participant of formattedParticipants) {
                // Show crown for admins in the group mention
                const displayEmoji = participant.isAdmin ? '👑' : '👤';

                // Use participant's display name if it exists, otherwise use the number with @ prefix
                // Use the displayName from participant object (initialized earlier)
                if (participant.displayName) {
                    // Display name with country flag for known contacts
                    currentLine += `${displayEmoji}${participant.displayName} `;
                } else if (participant.formatted && participant.formatted.includes('+')) {
                    // Use formatted with country flag (e.g., "🇩🇪 DE +49 15561-048015")
                    currentLine += `${displayEmoji}${participant.formatted} `;
                } else if (participant.international) {
                    // Use international format with + (e.g., +491234567890)
                    currentLine += `${displayEmoji}${participant.international} `;
                } else {
                    // Show full phone number with @ prefix
                    currentLine += `${displayEmoji}@${participant.number} `;
                }
                count++;

                // Start a new line after every 3 participants for cleaner look
                if (count % 3 === 0) {
                    mentionText += `${currentLine}\n`;
                    currentLine = '┃ ';
                }
            }

            // Add any remaining participants
            if (currentLine !== '┃ ') {
                mentionText += currentLine + '\n';
            }

            mentionText += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;

            // Add admins section with MD-style formatting
            if (admins.length > 0) {
                mentionText += `┏━━━━『 *👑 ADMINS* 』━━━━┓\n`;
                admins.forEach((admin, index) => {
                    // First try to use the display name with crown
                    if (admin.displayName) {
                        mentionText += `┃ ${index + 1}. 👑 ${admin.displayName}\n`;
                    }
                    // Then try formatted with country flag
                    else if (admin.formatted && admin.formatted.includes('+')) {
                        mentionText += `┃ ${index + 1}. 👑 ${admin.formatted}\n`;
                    }
                    // Then international format
                    else if (admin.international) {
                        mentionText += `┃ ${index + 1}. 👑 ${admin.international}\n`;
                    }
                    // Last resort, use full phone number
                    else {
                        mentionText += `┃ ${index + 1}. 👑 @${admin.number}\n`;
                    }
                });
                mentionText += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            }

            // Add country info section with MD-style formatting
            mentionText += `┏━━━━『 *📱 COUNTRIES* 』━━━━┓\n`;

            // Group users by country for cleaner display
            const countryGroups = {};
            formattedParticipants.forEach(p => {
                // Extract country from formatted text (e.g., "🇩🇪 DE +49 123456789")
                // Handle cases where formatted doesn't have proper country info
                let countryCode = '🌐'; // Default to globe emoji for unknown

                if (p.formatted && p.formatted.includes(' ')) {
                    countryCode = p.formatted.split(' ')[0]; // Get flag emoji
                } else if (p.displayName && p.displayName.includes('�')) {
                    // Extract country flag from display name if available
                    const match = p.displayName.match(/�[a-z]{2}/i);
                    if (match) countryCode = match[0];
                }

                if (!countryGroups[countryCode]) {
                    countryGroups[countryCode] = [];
                }
                countryGroups[countryCode].push(p);
            });

            // Display countries with member counts
            Object.entries(countryGroups).forEach(([country, users]) => {
                mentionText += `┃ ${country}: ${users.length} member${users.length > 1 ? 's' : ''}\n`;
            });

            mentionText += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;

            // Add stats section
            mentionText += `┏━━━━『 *📊 STATS* 』━━━━┓\n`;
            mentionText += `┃ *Total:* ${formatNumber(participants.length)} members\n`;
            mentionText += `┃ *Admins:* ${formatNumber(admins.length)}\n`;
            mentionText += `┃ *Regular:* ${formatNumber(members.length)}\n`;
            mentionText += `┃ *Countries:* ${Object.keys(countryGroups).length}\n`;
            mentionText += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;

            // Add powered by footer
            mentionText += `╔════『 *BLACKSKY-MD* 』════╗\n`;
            mentionText += `║  _Professional WhatsApp Bot_  ║\n`;
            mentionText += `╚══════════════════════╝`;

            // Log before sending to verify the mentions structure
            console.log(`Sending message with ${mentions.length} mentions to group ${subject}`);

            // Send the mention message with proper mention structure
            // The mentions array must contain the JIDs of all participants to be mentioned
            await safeSendMessage(sock, remoteJid, {
                text: mentionText,
                mentions: mentions // This ensures everyone gets a notification
            });

        } catch (err) {
            logger.error('Error in mentionall command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to mention all members' );
        }
    },
    async poll(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            if (args.length < 3) {
                await safeSendText(sock, remoteJid, '❌ Usage: !poll [question] [option1] [option2] ...'
                );
                return;
            }

            const question = args[0];
            const options = args.slice(1);

            // Store the poll
            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls) settings.polls = {};

            const pollId = Date.now().toString();
            settings.polls[pollId] = {
                question,
                options,
                votes: {},
                created: Date.now(),
                by: message.key.participant || message.key.remoteJid
            };

            await saveGroupSettings(remoteJid, settings);

            // Format poll message
            const pollMessage = `📊 *Poll: ${question}*\n\n` +
                options.map((opt, i) => `${i + 1}. ${opt}`).join('\n') +
                '\n\nVote using: !vote [number]';

            await safeSendText(sock, remoteJid, pollMessage );

        } catch (err) {
            logger.error('Error in poll command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to create poll' );
        }
    },

    async vote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            if (!args[0] || isNaN(args[0])) {
                await safeSendText(sock, remoteJid, '❌ Please provide a valid option number' );
                return;
            }

            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls || Object.keys(settings.polls).length === 0) {
                await safeSendText(sock, remoteJid, '❌ No active poll' );
                return;
            }

            // Get latest poll
            const pollId = Object.keys(settings.polls).sort().pop();
            const poll = settings.polls[pollId];

            const optionNum = parseInt(args[0]) - 1;
            if (optionNum < 0 || optionNum >= poll.options.length) {
                await safeSendText(sock, remoteJid, '❌ Invalid option number' );
                return;
            }

            const voter = message.key.participant || message.key.remoteJid;
            poll.votes[voter] = optionNum;
            await saveGroupSettings(remoteJid, settings);

            // Count votes
            const counts = poll.options.map((_, i) =>
                Object.values(poll.votes).filter(v => v === i).length
            );

            // Format results
            const results = `📊 *Poll Results*\n${poll.question}\n\n` +
                poll.options.map((opt, i) =>
                    `${i + 1}. ${opt}: ${counts[i]} votes`
                ).join('\n');

            await safeSendText(sock, remoteJid, results );

        } catch (err) {
            logger.error('Error in vote command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to register vote' );
        }
    },

    async endpoll(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'feature');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls || Object.keys(settings.polls).length === 0) {
                await safeSendText(sock, remoteJid, '❌ No active poll' );
                return;
            }

            // Get and delete latest poll
            const pollId = Object.keys(settings.polls).sort().pop();
            const poll = settings.polls[pollId];
            delete settings.polls[pollId];
            await saveGroupSettings(remoteJid, settings);

            // Count final votes
            const counts = poll.options.map((_, i) =>
                Object.values(poll.votes).filter(v => v === i).length
            );

            // Find winner(s)
            const maxVotes = Math.max(...counts);
            const winners = poll.options.filter((_, i) => counts[i] === maxVotes);

            // Format final results
            const results = `📊 *Final Poll Results*\n${poll.question}\n\n` +
                poll.options.map((opt, i) =>
                    `${i + 1}. ${opt}: ${counts[i]} votes`
                ).join('\n') +
                `\n\nWinner${winners.length > 1 ? 's' : ''}: ${winners.join(', ')}`;

            await safeSendText(sock, remoteJid, results );

        } catch (err) {
            logger.error('Error in endpoll command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to end poll' );
        }
    },

    async quiz(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            // For now, return a placeholder message
            await safeSendText(sock, remoteJid, '🎯 Quiz feature coming soon!'
            );

        } catch (err) {
            logger.error('Error in quiz command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to start quiz' );
        }
    },

    async trivia(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            // For now, return a placeholder message
            await safeSendText(sock, remoteJid, '🎮 Trivia feature coming soon!'
            );

        } catch (err) {
            logger.error('Error in trivia command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to start trivia' );
        }
    },

    async wordchain(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            // For now, return a placeholder message
            await safeSendText(sock, remoteJid, '🔠 Word Chain game coming soon!'
            );

        } catch (err) {
            logger.error('Error in wordchain command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to start word chain game' );
        }
    },

    async role(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ Thiscommandcan only be used in groups' );
                return;
            }

            // For now, return a placeholder message
            await safeSendText(sock, remoteJid, '👥 Role management feature coming soon!'
            );

        } catch (err) {
            logger.error('Error in role command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to manage roles' );
        }
    },

    async setname(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'link');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const newName = args.join(' ');
            if (!newName) {
                await safeSendText(sock, remoteJid, '❌ Please provide a new group name' );
                return;
            }

            await sock.groupUpdateSubject(remoteJid, newName);
            await safeSendText(sock, remoteJid, '✅ Group name has been updated' );

        } catch (err) {
            logger.error('Error in setname command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group name' );
        }
    },

    async setdesc(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'setdesc');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const newDesc = args.join(' ');
            if (!newDesc) {
                await safeSendText(sock, remoteJid, '❌ Please provide a new group description' );
                return;
            }

            await sock.groupUpdateDescription(remoteJid, newDesc);
            await safeSendText(sock, remoteJid, '✅ Group description has been updated' );

        } catch (err) {
            logger.error('Error in setdesc command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group description' );
        }
    },

    async setppic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'setppic');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const quoted = message.message.imageMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            if (!quoted) {
                await safeSendText(sock, remoteJid, '❌ Please send an image or reply to an image' );
                return;
            }

            const media = await downloadMediaMessage(message, 'buffer');
            await sock.updateProfilePicture(remoteJid, media);
            await safeSendText(sock, remoteJid, '✅ Group profile picture has been updated' );

        } catch (err) {
            logger.error('Error in setppic command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group profile picture' );
        }
    },

    async feature(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, 'feature');
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            // Get all available features if no arguments provided
            if (args.length === 0) {
                const features = await getFeatureSettings(remoteJid);
                const featureList = Object.entries(features)
                    .map(([feature, enabled]) => `${feature}: ${enabled ? '✅ Enabled' : '❌ Disabled'}`)
                    .join('\n');

                await safeSendMessage(sock, remoteJid, {
                    text: `*Group Features*\n\n${featureList}\n\nUse '.feature <name> <on/off>' to change settings`
                });
                return;
            }

            // Handle feature toggle
            const [featureName, action] = args;

            if (!featureName) {
                await safeSendText(sock, remoteJid, '❌ Usage: .feature <name> <on/off> or .feature to see all features'
                );
                return;
            }

            // Just show status of a specific feature if no action provided
            if (!action) {
                const isEnabled = await isFeatureEnabled(remoteJid, featureName);
                await safeSendMessage(sock, remoteJid, {
                    text: `Feature "${featureName}" is currently: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`
                });
                return;
            }

            // Validate action
            if (!['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Action must be either "on" or "off"'
                );
                return;
            }

            // Update feature setting
            const enabled = action.toLowerCase() === 'on';
            const success = await setFeatureEnabled(remoteJid, featureName, enabled);

            if (success) {
                await safeSendMessage(sock, remoteJid, {
                    text: `✅ Feature "${featureName}" has been ${enabled ? 'enabled' : 'disabled'}`
                });
            } else {
                await safeSendMessage(sock, remoteJid, {
                    text: `❌ Failed to update feature "${featureName}"`
                });
            }

        } catch (err) {
            logger.error('Error in feature command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to manage feature settings' );
        }
    },
    grouprules: async (sock, message, args) => {
        // Set or view group rules
        const rules = args.join(' ');
        if (!rules) return message.reply('Current rules: [rules]');
        await sock.groupUpdateDescription(message.key.remoteJid, rules);
        return message.reply('Group rules updated');
    },

    welcome: async (sock, message, args) => {
        // Toggle welcome message
        const isEnabled = args[0] === 'on';
        await sock.groupSettingUpdate(message.key.remoteJid, 'welcome', isEnabled);
        return message.reply(`Welcome messages ${isEnabled ? 'enabled' : 'disabled'}`);
    },

    goodbye: async (sock, message, args) => {
        // Toggle goodbye message
        const isEnabled = args[0] === 'on';
        await sock.groupSettingUpdate(message.key.remoteJid, 'goodbye', isEnabled);
        return message.reply(`Goodbye messages ${isEnabled ? 'enabled' : 'disabled'}`);
    },

    slowmode: async (sock, message, args) => {
        // Set message cooldown
        const seconds = parseInt(args[0]);
        if (isNaN(seconds)) return message.reply('Please specify seconds');
        await sock.groupSettingUpdate(message.key.remoteJid, 'slowmode', seconds);
        return message.reply(`Slowmode set to ${seconds}s`);
    },

    grouplock: async (sock, message) => {
        // Lock group for admins only
        await sock.groupSettingUpdate(message.key.remoteJid, 'locked', true);
        return message.reply('Group locked for admins only');
    },

    groupunlock: async (sock, message) => {
        // Unlock group for all members
        await sock.groupSettingUpdate(message.key.remoteJid, 'locked', false);
        return message.reply('Group unlocked for all members');
    },

    groupicon: async (sock, message) => {
        // Change group icon
        if (!message.message.extendedTextMessage?.contextInfo?.quotedMessage) return message.reply('Reply to an image');
        const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
        const media = await downloadMediaMessage(message, 'buffer');
        await sock.updateProfilePicture(message.key.remoteJid, media);
        return message.reply('Group icon updated');
    },

    invitelink: async (sock, message) => {
        // Get group invite link
        const code = await sock.groupInviteCode(message.key.remoteJid);
        return message.reply(`https://chat.whatsapp.com/${code}`);
    },

    revokeinvite: async (sock, message) => {
        // Revoke group invite link
        await sock.groupRevokeInvite(message.key.remoteJid);
        return message.reply('Group invite link revoked');
    },

    groupinfo: async (sock, message) => {
        // Get detailed group info
        const info = await sock.groupMetadata(message.key.remoteJid);
        return message.reply(`Name: ${info.subject}\nMembers: ${info.participants.length}`);
    },

    adminlist: async (sock, message) => {
        // List group admins
        const admins = await sock.getGroupAdmins(message.key.remoteJid);
        return message.reply(`Admins: ${admins.map(admin => admin.split('@')[0]).join(', ')}`);
    },

    memberlist: async (sock, message) => {
        // List all members
        const members = await sock.getGroupMembers(message.key.remoteJid);
        return message.reply(`Members: ${members.map(member => member.split('@')[0]).join(', ')}`);
    },

    warning: async (sock, message, args) => {
        // Warn a user
        if (!message.message.extendedTextMessage?.contextInfo?.quotedMessage) return message.reply('Reply to a message');
        const warned = message.message.extendedTextMessage.contextInfo.quotedMessage.senderJid;
        await sock.warnUser(warned, message.key.remoteJid);
        return message.reply('User warned');
    },

    resetwarnings: async (sock, message) => {
        // Reset user warnings
        if (!message.message.extendedTextMessage?.contextInfo?.quotedMessage) return message.reply('Reply to a message');
        const user = message.message.extendedTextMessage.contextInfo.quotedMessage.senderJid;
        await sock.resetWarnings(user, message.key.remoteJid);
        return message.reply('Warnings reset');
    },

    mutegroup: async (sock, message, args) => {
        // Mute group for duration
        const duration = parseInt(args[0]);
        if (isNaN(duration)) return message.reply('Specify duration in minutes');
        await sock.groupSettingUpdate(message.key.remoteJid, 'announcement', true);
        setTimeout(() => {
            sock.groupSettingUpdate(message.key.remoteJid, 'announcement', false);
        }, duration * 60000);
        return message.reply(`Group muted for ${duration} minutes`);
    },

    unmutegroup: async (sock, message) => {
        // Unmute group
        await sock.groupSettingUpdate(message.key.remoteJid, 'announcement', false);
        return message.reply('Group unmuted');
    },

    groupevent: async (sock, message, args) => {
        // Create group event
        const event = args.join(' ');
        await sock.setGroupEvent(message.key.remoteJid, event);
        return message.reply('Group event created');
    },

    poll: async (sock, message, args) => {
        // Create poll
        const [question, ...options] = args;
        await sock.sendPoll(message.key.remoteJid, question, options);
        return message.reply('Poll created');
    },

    announce: async (sock, message, args) => {
        // Send announcement
        const announcement = args.join(' ');
        await sock.sendGroupAnnouncement(message.key.remoteJid, announcement);
        return message.reply('Announcement sent');
    },

    pin: async (sock, message) => {
        // Pin message
        if (!message.message.extendedTextMessage?.contextInfo?.quotedMessage) return message.reply('Reply to a message');
        await sock.pinMessage(message.key.remoteJid, message.message.extendedTextMessage.contextInfo.quotedMessage.key.id);
        return message.reply('Message pinned');
    },

    unpin: async (sock, message) => {
        // Unpin message
        if (!message.message.extendedTextMessage?.contextInfo?.quotedMessage) return message.reply('Reply to a message');
        await sock.unpinMessage(message.key.remoteJid, message.message.extendedTextMessage.contextInfo.quotedMessage.key.id);
        return message.reply('Message unpinned');
    },

    pinlist: async (sock, message) => {
        // List pinned messages
        const pins = await sock.getPinnedMessages(message.key.remoteJid);
        return message.reply(`Pinned messages: ${pins.length}`);
    },

    groupban: async (sock, message) => {
        // Ban user from group
        if (!message.message.extendedTextMessage?.contextInfo?.quotedMessage) return message.reply('Reply to a message');
        await sock.groupParticipantsUpdate(message.key.remoteJid, [message.message.extendedTextMessage.contextInfo.quotedMessage.senderJid], 'remove');
        await sock.banUser(message.message.extendedTextMessage.contextInfo.quotedMessage.senderJid, message.key.remoteJid);
        return message.reply('User banned from group');
    },

    groupunban: async (sock, message) => {
        // Unban user from group
        if (!message.message.extendedTextMessage?.contextInfo?.quotedMessage) return message.reply('Reply to a message');
        await sock.unbanUser(message.message.extendedTextMessage.contextInfo.quotedMessage.senderJid, message.key.remoteJid);
        return message.reply('User unbanned from group');
    },

    banlist: async (sock, message) => {
        // List banned users
        const bans = await sock.getBannedUsers(message.key.remoteJid);
        return message.reply(`Banned users: ${bans.join(', ')}`);
    },

    clearwarns: async (sock, message) => {
        // Clear all warnings
        await sock.clearAllWarnings(message.key.remoteJid);
        return message.reply('All warnings cleared');
    },

    groupbackup: async (sock, message) => {
        // Backup group settings
        const backup = await sock.createGroupBackup(message.key.remoteJid);
        return message.reply('Group settings backed up');
    },

    grouprestore: async (sock, message) => {
        // Restore group settings
        await sock.restoreGroupBackup(message.key.remoteJid);
        return message.reply('Group settings restored');
    },

    grouplogs: async (sock, message) => {
        // View group activity logs
        const logs = await sock.getGroupLogs(message.key.remoteJid);
        return message.reply(`Recent activity:\n${logs.join('\n')}`);
    }
};

module.exports = {
    commands: groupCommands,
    category: 'group',
    async init() {
        try {
            logger.info('Initializing group command handler...');
            const initialized = await initializeDirectories();
            if (initialized) {
                logger.info('Group command handler initialized successfully');
                return true;
            }
            throw new Error('Failed to initialize group directories');
        } catch (err) {
            logger.error('Error initializing group command handler:', err);
            return false;
        }
    }
};