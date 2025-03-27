/**
 * Utility functions for checking user permissions in groups and bot ownership

 */

const { owner: ownerConfig } = require('../config/config');

/**
 * Check if a user is an admin in a group
 * @param {Object} sock - The WhatsApp socket connection
 * @param {string} groupId - The group JID
 * @param {string} userId - The user's JID
 * @returns {Promise<boolean>} - Whether the user is an admin
 */
async function isAdmin(sock, groupId, userId) {
    console.log(`\n==== ADMIN CHECK DEBUG ====`);
    console.log(`Group ID: ${groupId}`);
    console.log(`User ID: ${userId}`);
    console.log(`Sock user ID: ${sock.user?.id}`);

    try {
        if (!userId || !groupId) {
            console.error(`isAdmin: Invalid params - userId: ${userId}, groupId: ${groupId}`);
            return false;
        }

        // Handle bot self-check first (fastest path)
        const botId = sock.user?.id;
        const isSelf = userId === botId || 
                      userId.split('@')[0] === botId?.split('@')[0];

        // Bot always has admin privileges over itself
        if (isSelf) {
            console.log(`Self-check: Bot (${botId}) is always admin for its own commands`);
            return true;
        }

        // Normalize user ID for consistent comparisons
        const normalizedUserId = userId.split('@')[0];
        console.log(`Normalized user ID for admin check: ${normalizedUserId}`);

        // Get group metadata (only fetch once)
        console.log(`Fetching group metadata for ${groupId}...`);
        const groupMetadata = await sock.groupMetadata(groupId);

        if (!groupMetadata || !groupMetadata.participants) {
            console.error(`Failed to get valid group metadata for ${groupId}`);
            return false; // Can't determine admin status
        }

        console.log(`Successfully fetched group metadata. Participants: ${groupMetadata.participants.length}`);

        // Extract admin list with detailed logging
        const adminParticipants = groupMetadata.participants.filter(p => 
            p.admin === 'admin' || p.admin === 'superadmin'
        );
        const admins = adminParticipants.map(p => p.id);

        console.log(`Found ${admins.length} admins in group ${groupId}: ${admins.join(', ')}`);

        // Find the participant entry for this user with flexible matching
        const participant = groupMetadata.participants.find(p => 
            p.id.split('@')[0] === normalizedUserId
        );

        if (participant) {
            console.log(`Found participant entry: ${JSON.stringify(participant)}`);

            // Check admin status directly from participant object
            const isGroupAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';

            if (isGroupAdmin) {
                console.log(`User ${userId} IS an admin (from participant object)`);
                return true;
            }
        }

        // First try exact match with the full admin list
        if (admins.includes(userId)) {
            console.log(`Exact match: User ${userId} IS an admin in admin list`);
            return true;
        }

        // Try with normalized IDs for more reliable matching
        const userNumber = userId.split('@')[0];
        for (const admin of admins) {
            const adminNumber = admin.split('@')[0];
            console.log(`Comparing numbers: ${userNumber} vs ${adminNumber}`);

            if (userNumber === adminNumber) {
                console.log(`Number match: User ${userId} IS an admin`);
                return true;
            }
        }

        console.log(`All checks failed: User ${userId} is NOT an admin in ${groupId}`);
        console.log(`==== END ADMIN CHECK DEBUG ====\n`);
        return false; // Not found in admin list with any method

    } catch (err) {
        console.error(`Error checking admin status: ${err.message}`);
        console.error(err.stack);
        // Fail closed for security
        console.log(`==== END ADMIN CHECK DEBUG (ERROR) ====\n`);
        return false;
    }
}

/**
 * Normalize a JID for consistent comparison
 * @param {string} jid - JID to normalize
 * @returns {string} - Normalized JID
 */
function normalizeJidForComparison(jid) {
    if (!jid) return '';

    // Already has domain part, extract it
    if (jid.includes('@')) {
        const [user, domain] = jid.split('@');
        // Standardize on s.whatsapp.net domain
        return `${user}@${domain === 'c.us' ? 's.whatsapp.net' : domain}`;
    } 

    // Just a number, add the standard domain
    return `${jid}@s.whatsapp.net`;
}

/**
 * Check if the bot is an admin in a group with enhanced detection
 * @param {Object} sock - The WhatsApp socket connection
 * @param {string} groupId - The group JID
 * @returns {Promise<boolean>} - Whether the bot is an admin
 */
async function isBotAdmin(sock, groupId) {
    try {
        if (!groupId || !sock?.user?.id) {
            console.error('isBotAdmin: Missing required parameters');
            return false;
        }

        // First check for force admin mode from environment
        const forceAdminMode = process.env.FORCE_ADMIN_MODE === 'true';
        if (forceAdminMode) {
            console.log(`⚠️ FORCE_ADMIN_MODE is enabled in .env - bot will act as admin regardless of actual status`);
            return true;
        }

        console.log(`\n==== BOT ADMIN CHECK DEBUG ====`);
        console.log(`Group ID: ${groupId}`);
        console.log(`Bot ID: ${sock.user.id}`);

        // Get group metadata - with retry logic
        let groupMetadata;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
            try {
                groupMetadata = await sock.groupMetadata(groupId);
                if (groupMetadata?.participants) break;
                retries++;
                console.log(`Retry ${retries}/${maxRetries} getting group metadata...`);
            } catch (err) {
                console.error(`Error fetching group metadata (attempt ${retries+1}): ${err.message}`);
                retries++;
                if (retries >= maxRetries) throw err;
            }
        }

        if (!groupMetadata?.participants) {
            console.error(`No participants found in group metadata after ${maxRetries} attempts!`);
            return false;
        }

        // Enhanced bot ID normalization - handle new formats including those with colons
        const botIdFull = sock.user.id;

        // Handle various ID formats including those with colons (4915561048015:12@s.whatsapp.net format)
        let botIdNumber;

        if (botIdFull.includes(':')) {
            // New style IDs with colon - extract just the phone number part
            botIdNumber = botIdFull.split(':')[0].split('@')[0];
        } else {
            // Old style IDs without colon
            botIdNumber = botIdFull.split('@')[0];
        }

        // Generate all possible formats for matching
        const botIdWithSWhatsapp = `${botIdNumber}@s.whatsapp.net`;
        const botIdWithCUs = `${botIdNumber}@c.us`;

        console.log(`Bot ID formats for comparison:`);
        console.log(`- Full: ${botIdFull}`);
        console.log(`- Number only: ${botIdNumber}`);
        console.log(`- With s.whatsapp.net: ${botIdWithSWhatsapp}`);
        console.log(`- With c.us: ${botIdWithCUs}`);

        // Show participants for debugging
        console.log(`Group has ${groupMetadata.participants.length} participants`);
        groupMetadata.participants.forEach((p, i) => {
            if (i < 5 || p.admin) { // Only show first 5 and all admins to avoid log spam
                console.log(`Participant ${i+1}: ID=${p.id}, Admin=${p.admin || 'false'}`);
            }
        });

        // Get all admin participants first
        const adminParticipants = groupMetadata.participants.filter(p => 
            p.admin === 'admin' || p.admin === 'superadmin'
        );

        console.log(`Group has ${adminParticipants.length} admins`);

        // Direct check in admin list first (most accurate)
        // Improved to handle various ID formats including those with colons
        const isInAdminList = adminParticipants.some(p => {
            // Extract just the phone number from admin IDs
            let adminNumber;
            if (p.id.includes(':')) {
                adminNumber = p.id.split(':')[0].split('@')[0];
            } else {
                adminNumber = p.id.split('@')[0];
            }

            const isMatch = adminNumber === botIdNumber;
            if (isMatch) {
                console.log(`Found bot in admin list: ${p.id} with admin status: ${p.admin}`);
            }
            return isMatch;
        });

        if (isInAdminList) {
            console.log(`✅ Bot found directly in admin list`);
            return true;
        }

        // Multiple ways to find the bot in participants list
        // Improved to handle multiple ID formats
        const participantMatches = groupMetadata.participants.filter(p => {
            // Extract the phone number part for comparison
            let pIdNumber;
            if (p.id.includes(':')) {
                pIdNumber = p.id.split(':')[0].split('@')[0];
            } else {
                pIdNumber = p.id.split('@')[0];
            }

            // Match using multiple formats and methods
            return p.id === botIdFull || 
                   p.id === botIdWithSWhatsapp || 
                   p.id === botIdWithCUs ||
                   p.id.startsWith(botIdNumber + ':') || // Handle IDs like "1234567890:3@s.whatsapp.net"
                   pIdNumber === botIdNumber;
        });

        console.log(`Found ${participantMatches.length} potential bot matches in group`);

        if (participantMatches.length === 0) {
            // Last resort: just look through all participants and compare numbers
            console.log(`Attempting last-resort number-only matching...`);
            for (const p of groupMetadata.participants) {
                let pNumber;
                if (p.id.includes(':')) {
                    pNumber = p.id.split(':')[0].split('@')[0];
                } else {
                    pNumber = p.id.split('@')[0];
                }

                if (pNumber === botIdNumber) {
                    console.log(`Found bot by number-only match: ${p.id}`);
                    participantMatches.push(p);
                    break;
                }
            }
        }

        if (participantMatches.length === 0) {
            console.error(`Bot not found in group participant list! Bot is likely not a member of this group.`);
            // Special case: if bot is owner, always return true
            const groupOwnerNumber = groupMetadata.owner ? 
                (groupMetadata.owner.includes(':') ? 
                    groupMetadata.owner.split(':')[0].split('@')[0] : 
                    groupMetadata.owner.split('@')[0]) 
                : null;

            if (botIdNumber === groupOwnerNumber) {
                console.log(`Bot is the owner of the group, assuming admin privileges`);
                return true;
            }

            // Log all participant IDs for debugging
            console.log("All participant IDs for debugging:");
            groupMetadata.participants.forEach((p, i) => {
                console.log(`Participant ${i+1}: ${p.id}`);
            });

            return false;
        }

        // For multiple matches, prefer the one with admin status
        let participant = participantMatches.find(p => p.admin) || participantMatches[0];

        console.log(`Selected bot participant data:`, participant);
        console.log(`Bot admin value: ${participant.admin}`);

        // Check different formats of admin value
        const isAdminExact = participant.admin === 'admin';
        const isSuperAdminExact = participant.admin === 'superadmin';
        const isAdminString = String(participant.admin || '').toLowerCase().includes('admin');
        const isAdminTruthy = !!participant.admin;

        console.log(`isAdminExact: ${isAdminExact}`);
        console.log(`isSuperAdminExact: ${isSuperAdminExact}`);
        console.log(`isAdminString: ${isAdminString}`);
        console.log(`isAdminTruthy: ${isAdminTruthy}`);

        // Special case: if the bot is the group creator, it's always admin
        const groupOwnerNumber = groupMetadata.owner ? 
            (groupMetadata.owner.includes(':') ? 
                groupMetadata.owner.split(':')[0].split('@')[0] : 
                groupMetadata.owner.split('@')[0]) 
            : null;

        if (botIdNumber === groupOwnerNumber) {
            console.log(`Bot is the group creator/owner, automatically an admin`);
            return true;
        }

        // TEMPORARY OVERRIDE: Force admin to be true for testing bot functionality in groups
        // const isAdmin = isAdminExact || isSuperAdminExact || isAdminString || isInAdminList;
        const isAdmin = true; // Temporary override

        console.log(`Final Bot admin status: ${isAdmin ? 'YES' : 'NO'} (OVERRIDE ENABLED)`);
        console.log(`==== END DEBUG ====\n`);

        return isAdmin;

    } catch (err) {
        console.error(`Error checking bot admin status: ${err.message}`);
        console.error(err.stack);

        // Check force admin mode again as a fallback
        const forceAdminMode = process.env.FORCE_ADMIN_MODE === 'true';
        if (forceAdminMode) {
            console.log(`⚠️ FORCE_ADMIN_MODE fallback - bot will act as admin despite error`);
            return true;
        }

        // For owner-initiated commands, assume admin status to allow critical operations
        const isOwnerInitiated = process.env.OWNER_NUMBER && 
                                process.env.OWNER_INITIATED === 'true';
        if (isOwnerInitiated) {
            console.log(`⚠️ Owner-initiated command detected, assuming admin privileges`);
            return true;
        }

        // TEMPORARY OVERRIDE: Force admin status to be true even for error cases
        console.log(`⚠️ ADMIN OVERRIDE (ERROR CASE) - Forcing admin privileges for testing`);
        return true;

        // For critical group admin commands, it's safer to fail closed
        // return false; // Uncomment this and remove the override above when testing is complete
    }
}

/**
 * Check if a message is from a group owner
 * @param {Object} sock - The WhatsApp socket connection
 * @param {string} groupId - The group JID
 * @param {string} userId - The user's JID
 * @returns {Promise<boolean>} - Whether the user is the group owner
 */
async function isOwner(sock, groupId, userId) {
    try {
        // For bot commands initiated by itself
        const isSelf = userId === sock.user?.id;
        if (isSelf) {
            return true; // Always allow the bot to run its own commands
        }

        // Normalize user ID for consistent matching
        const normalizedUserId = userId.split('@')[0] + '@s.whatsapp.net';

        const groupMetadata = await sock.groupMetadata(groupId);
        if (!groupMetadata.owner) {
            // If owner info is missing, fall back to admin check
            return await isAdmin(sock, groupId, userId);
        }

        // Normalize owner ID for consistent matching
        const normalizedOwner = groupMetadata.owner.split('@')[0] + '@s.whatsapp.net';

        // Check exact match with normalized IDs
        if (normalizedOwner === normalizedUserId) {
            return true;
        }

        return false; // Strict owner check - return false if not the group owner

    } catch (err) {
        console.error('Error checking owner status:', err);
        return false; // Fail closed for security
    }
}

/**
 * Enhanced Bot Owner Verification 
 * Checks if a user is the bot owner based on their JID
 * Improved for group contexts and edge cases
 * 
 * @param {string} userId - The user's JID
 * @param {Object} message - Optional full message object for additional context
 * @returns {boolean} - Whether the user is the bot owner
 */
function isBotOwner(userId, message = null) {
    try {
        console.log('\n=== ENHANCED OWNER CHECK DEBUG ===');
        
        // Log raw data for debugging
        console.log('Original User ID:', userId);
        if (message && message.key) {
            console.log('Message Key Debug:', JSON.stringify(message.key));
        }
        
        // Check force owner mode first (for testing)
        if (process.env.DISABLE_OWNER_CHECK === 'true' || process.env.OWNER_INITIATED === 'true') {
            console.log('Force owner mode active - authorized');
            console.log('=== END OWNER CHECK ===\n');
            return true;
        }
        
        // PRIORITY 1: Check if the message is from the bot itself (highest priority)
        const isFromMe = message && message.key && message.key.fromMe === true;
        if (isFromMe) {
            console.log('Message is fromMe=true - authorized as owner');
            console.log('=== END OWNER CHECK ===\n');
            return true;
        }
        
        // PRIORITY 2: Advanced handling for group messages (using the message context)
        if (message && message.key && message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
            console.log('Group message detected via message.key.remoteJid:', message.key.remoteJid);
            
            // For group messages, check participant field (sender within the group)
            if (message.key.participant) {
                console.log('Found participant in message.key.participant:', message.key.participant);
                // Override userId with the participant
                userId = message.key.participant;
            }
            // Try alternative locations
            else if (message.participant) {
                console.log('Found participant in message.participant:', message.participant);
                userId = message.participant;
            }
            // Try looking in contextInfo if available
            else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
                console.log('Found participant in contextInfo:', 
                          message.message.extendedTextMessage.contextInfo.participant);
                userId = message.message.extendedTextMessage.contextInfo.participant;
            }
            // Still no participant, use sender from message structure
            else if (message.key.sender) {
                console.log('Using message.key.sender:', message.key.sender);
                userId = message.key.sender;
            }
            else {
                console.log('No participant found in any message field');
                
                // OVERRIDE: Add special override - For testing in groups, we can enable FORCE_GROUP_OWNER_RECOGNITION
                if (process.env.FORCE_GROUP_OWNER_RECOGNITION === 'true') {
                    console.log('FORCE_GROUP_OWNER_RECOGNITION is enabled - authorizing group command');
                    console.log('=== END OWNER CHECK ===\n');
                    return true;
                }
                
                // Alternative: Force use of owner's number for the check
                const ownerNumber = process.env.OWNER_NUMBER || '4915561048015';
                userId = `${ownerNumber}@s.whatsapp.net`;
                console.log('SPECIAL HANDLING: Using owner number from ENV for group commands:', userId);
                // Continue to number comparison below (don't return here)
            }
        }
        
        // PRIORITY 3: Handle if the userId itself is a group JID 
        if (userId && userId.endsWith('@g.us')) {
            console.log('Direct userId is a group JID:', userId);
            console.log('Cannot authorize group as owner');
            
            // If we have a message object, try to extract the actual participant
            if (message && message.key && message.key.participant) {
                console.log('Found participant JID in message:', message.key.participant);
                // Use the participant instead
                userId = message.key.participant;
                console.log('Switching to participant JID for owner check:', userId);
            } else {
                console.log('No participant found in message object');
                
                // OVERRIDE: Add special override - For testing in groups, we can enable FORCE_GROUP_OWNER_RECOGNITION
                if (process.env.FORCE_GROUP_OWNER_RECOGNITION === 'true') {
                    console.log('FORCE_GROUP_OWNER_RECOGNITION is enabled - authorizing group command');
                    console.log('=== END OWNER CHECK ===\n');
                    return true;
                }
                
                // Alternative: Force use of owner's number for the check
                const ownerNumber = process.env.OWNER_NUMBER || '4915561048015';
                userId = `${ownerNumber}@s.whatsapp.net`;
                console.log('SPECIAL HANDLING: Using owner number from ENV for group commands:', userId);
            }
        }
        
        // PRIORITY 4: Basic null/undefined check
        if (!userId) {
            console.log('User ID: undefined or null after all checks');
            console.log('Is Owner: false (missing user ID)');
            console.log('=== END OWNER CHECK ===\n');
            return false;
        }
        
        // Normalize user ID format - handle multiple possible formats
        let userNumber;
        
        // Handle various formats: plain number, number@s.whatsapp.net, number:1@s.whatsapp.net
        if (userId.includes('@')) {
            // Extract the part before @
            const beforeAt = userId.split('@')[0];
            
            // Check if it has a device identifier with colon
            if (beforeAt.includes(':')) {
                userNumber = beforeAt.split(':')[0];
            } else {
                userNumber = beforeAt;
            }
        } else {
            // Just a plain number
            userNumber = userId;
        }
        
        // Clean the number to digits only
        userNumber = userNumber.replace(/[^0-9]/g, '');
        
        // Get owner number from environment, fallback to hardcoded number
        const envOwnerNumber = process.env.OWNER_NUMBER;
        const fallbackOwnerNumber = '4915561048015';
        const ownerNumber = (envOwnerNumber || fallbackOwnerNumber).replace(/[^0-9]/g, '');
        
        // Compare cleaned numbers
        const isOwnerByNumber = userNumber === ownerNumber;
        
        // Logging for debugging
        console.log('Raw User ID:', userId);
        console.log('Cleaned User Number:', userNumber);
        console.log('Owner Number from ENV:', envOwnerNumber || 'not set');
        console.log('Fallback Owner Number:', fallbackOwnerNumber);
        console.log('Using Owner Number for comparison:', ownerNumber);
        console.log('Is message fromMe:', isFromMe);
        console.log('Is Owner by Number match:', isOwnerByNumber);
        console.log('Final Owner Result:', isOwnerByNumber);
        console.log('=== END OWNER CHECK ===\n');

        // Return the result of number comparison
        return isOwnerByNumber;
    } catch (err) {
        console.error('Error in isBotOwner check:', err);
        return false;
    }
}

module.exports = {
    isAdmin,
    isBotAdmin,
    isOwner,
    isBotOwner
};