/**
 * Enhanced Reaction Commands for WhatsApp Bot
 * Sends animated GIFs with proper mention formatting
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { safeSendMessage, safeSendAnimatedGif } = require('../utils/jidHelper');
const { convertGifToMp4 } = require('../utils/gifConverter');

// Path to reaction GIFs directory
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');

// Define reaction GIF mapping
const REACTION_GIF_MAPPING = {
    // Self-reactions
    'smile': 'smile.gif',
    'happy': 'happy.gif',
    'dance': 'dance.gif',
    'cry': 'cry.gif',
    'blush': 'blush.gif',
    'laugh': 'laugh.gif',

    // Target-reactions
    'hug': 'hug.gif',
    'pat': 'pat.gif',
    'kiss': 'kiss.gif',
    'cuddle': 'cuddle.gif',
    'wave': 'wave.gif',
    'wink': 'wink.gif',
    'poke': 'poke.gif',
    'slap': 'slap.gif',
    'bonk': 'bonk.gif',
    'bite': 'bite.gif',
    'punch': 'punch.gif',
    'highfive': 'highfive.gif',
    'yeet': 'yeet.gif',
    'kill': 'kill.gif',

    // New reaction commands
    'fuck': 'fuck.gif',
    'horny': 'horny.gif',

    // Additional reactions
    'angry': 'angry.gif',
    'bored': 'bored.gif',
    'confused': 'confused.gif',
    'cool': 'cool.gif',
    'scared': 'scared.gif',
    'shy': 'shy.gif',
    'sleepy': 'sleepy.gif',
    'surprised': 'surprised.gif',
    'tired': 'tired.gif',
    'disgusted': 'disgusted.gif',
    'excited': 'excited.gif',
    'facepalm': 'facepalm.gif',
    'greedy': 'greedy.gif',
    'hungry': 'hungry.gif',
    'jealous': 'jealous.gif',
    'nervous': 'nervous.gif',
    'panic': 'panic.gif',
    'proud': 'proud.gif',
    'sad': 'sad.gif',
    'shock': 'shock.gif'
};

// Create reaction GIFs directory if it doesn't exist
function ensureDirectoriesExist() {
    if (!fs.existsSync(REACTIONS_DIR)) {
        try {
            fs.mkdirSync(REACTIONS_DIR, { recursive: true });
            logger.info(`Created reaction GIFs directory: ${REACTIONS_DIR}`);
        } catch (err) {
            logger.error(`Failed to create directory: ${err.message}`);
        }
    }
}

// Verify reaction GIFs exist
function verifyReactionGifs() {
    logger.info(`Using reaction GIFs from: ${REACTIONS_DIR}`);
    console.log(`Using reaction GIFs from: ${REACTIONS_DIR}`);

    Object.keys(commands).forEach(command => {
        if (command === 'init') return;

        const gifPath = path.join(REACTIONS_DIR, `${command}.gif`);
        if (fs.existsSync(gifPath)) {
            try {
                const stats = fs.statSync(gifPath);
                if (stats.size > 1024) {
                    logger.info(`✅ Verified ${command}.gif exists (${stats.size} bytes)`);
                } else {
                    logger.warn(`⚠️ GIF for ${command} is too small: ${stats.size} bytes`);
                }
            } catch (err) {
                logger.error(`Error checking GIF for ${command}: ${err.message}`);
            }
        } else {
            logger.warn(`❌ Missing GIF for ${command}`);
        }
    });
}

// Helper function to get user name from message
async function getUserName(sock, jid) {
    try {
        if (!jid) return "Someone";
        if (jid.endsWith('@g.us')) return "Group Chat";

        const phoneNumber = jid.split('@')[0];
        let name = null;

        if (sock.store && sock.store.contacts) {
            const contact = sock.store.contacts[jid];
            if (contact) {
                name = contact.name || contact.pushName;
            }
        }

        return name || `+${phoneNumber}`;
    } catch (err) {
        logger.error(`Error getting user name: ${err.message}`);
        return "User";
    }
}

// Enhanced function to handle mentions with improved reliability
const handleMention = (message) => {
    // First try to get mentions from extendedTextMessage which handles both quoted replies and @mentions
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        return message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    
    // Then check for quoted message participant (someone replied to a message)
    if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        return message.message.extendedTextMessage.contextInfo.participant;
    }
    
    // Then check message-level mentioned users array
    if (message.mentionedJid && message.mentionedJid.length > 0) {
        return message.mentionedJid[0];
    }

    // Check for any existing @ mentions in the message text
    const messageText = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        '';
    
    // Try to find @mention pattern in the text - this helps when the WhatsApp API doesn't properly parse mentions
    const mentionMatch = messageText.match(/@(\d+)/);
    if (mentionMatch && mentionMatch[1]) {
        return `${mentionMatch[1]}@s.whatsapp.net`;
    }
    
    // If in a group and no target specified, don't return sender (null means no target)
    if (message.key.remoteJid.endsWith('@g.us')) {
        return null;
    }
    
    // In private chat, if no specific mention, the target is the other person
    return message.key.remoteJid;
};


// Cache for GIF buffers to avoid redundant disk reads
const gifBufferCache = new Map();
const GIF_CACHE_LIFETIME = 300000; // 5 minutes

// Reaction message templates for ultra-fast performance
const REACTION_TEMPLATES = {
    'smile': '{sender} smiles 😊',
    'happy': '{sender} is happy 😄',
    'dance': '{sender} is dancing 💃',
    'cry': '{sender} is crying 😢',
    'blush': '{sender} is blushing 😳',
    'laugh': '{sender} is laughing 😂',
    'hug': '{sender} hugs {target} 🤗',
    'pat': '{sender} pats {target} 👋',
    'kiss': '{sender} kisses {target} 😘',
    'cuddle': '{sender} cuddles with {target} 🥰',
    'wave': '{sender} waves at {target} 👋',
    'wink': '{sender} winks at {target} 😉',
    'poke': '{sender} pokes {target} 👉',
    'slap': '{sender} slaps {target} 👋',
    'bonk': '{sender} bonks {target} 🔨',
    'bite': '{sender} bites {target} 😬',
    'punch': '{sender} punches {target} 👊',
    'highfive': '{sender} high fives {target} ✋',
    'yeet': '{sender} yeets {target} 🚀',
    'kill': '{sender} kills {target} 💀',

    // New reaction templates
    'fuck': '{sender} fucks {target} 🔞',
    'horny': '{sender} is feeling horny 🔞',

    // Additional reaction templates
    'angry': '{sender} is angry 😡',
    'bored': '{sender} is bored 😒',
    'confused': '{sender} is confused 🤔',
    'cool': '{sender} is looking cool 😎',
    'scared': '{sender} is scared 😱',
    'shy': '{sender} is feeling shy 🙈',
    'sleepy': '{sender} is sleepy 😴',
    'surprised': '{sender} is surprised 😲',
    'tired': '{sender} is tired 😩',
    'disgusted': '{sender} is disgusted 🤢',
    'excited': '{sender} is excited 🤩',
    'facepalm': '{sender} facepalms 🤦',
    'greedy': '{sender} is feeling greedy 🤑',
    'hungry': '{sender} is hungry 🍔',
    'jealous': '{sender} is jealous 😒',
    'nervous': '{sender} is nervous 😰',
    'panic': '{sender} is panicking 😱',
    'proud': '{sender} is proud 🥹',
    'sad': '{sender} is sad 😞',
    'shock': '{sender} is shocked 😱'
};

// Get GIF buffer with caching for fast performance
async function getGifBuffer(type) {
    const now = Date.now();
    const cacheKey = `reaction_${type}`;

    // Check cache first
    if (gifBufferCache.has(cacheKey)) {
        const cache = gifBufferCache.get(cacheKey);
        if (now - cache.timestamp < GIF_CACHE_LIFETIME) {
            return cache.buffer;
        }
    }

    // Cache miss, read from disk
    const gifPath = path.join(REACTIONS_DIR, `${type}.gif`);
    if (fs.existsSync(gifPath)) {
        try {
            const buffer = fs.readFileSync(gifPath);
            // Cache the buffer
            gifBufferCache.set(cacheKey, {
                buffer,
                timestamp: now
            });
            return buffer;
        } catch (err) {
            logger.error(`Error reading GIF: ${err.message}`);
            return null;
        }
    }
    return null;
}

// Ultra-optimized reaction command handler with advanced parallel processing
// Designed for <5ms initial response time
async function handleReaction(sock, message, reactionType, args, mentionedJid) {
    try {
        const startTime = process.hrtime.bigint();
        
        // Completely rewritten sender detection to ensure we always get the correct JID
        const isGroup = message.key.remoteJid.endsWith('@g.us');
        
        // Dump all possible sender identification fields for debugging
        console.log("==== SENDER DETECTION DEBUG ====");
        console.log("message.key:", JSON.stringify(message.key));
        console.log("message.participant:", message.participant);
        console.log("message.sender:", message.sender);
        console.log("message.pushName:", message.pushName);
        console.log("message.key.participant:", message.key.participant);
        console.log("message.key.fromMe:", message.key.fromMe);
        console.log("message.key.remoteJid:", message.key.remoteJid);
        console.log("message.key.id:", message.key.id);
        console.log("Is group chat:", isGroup);
        
        // Get the correct sender JID - This field should always contain the actual sender in groups
        let senderId = null;
        
        // In group chats, the participant field contains the sender's JID
        if (isGroup) {
            // First check 'key.participant' which is most reliable for groups
            if (message.key.participant) {
                senderId = message.key.participant;
            }
            // If that fails, try message-level participant
            else if (message.participant) {
                senderId = message.participant;
            }
            // Last resort fallbacks
            else if (message.sender) {
                senderId = message.sender;
            }
            else {
                // Something's wrong - log error and use a hardcoded sender as last resort
                console.log("⚠️ WARNING: Could not detect sender in group chat!");
                senderId = "4915561048015@s.whatsapp.net"; // Owner's JID as last resort
            }
        } else {
            // In private chats, the sender is the remote JID
            senderId = message.key.remoteJid;
        }
        
        console.log("FINAL SENDER ID:", senderId);
        console.log("===========================");
        
        const senderName = message.pushName || 'Someone';

        // Enhanced mention format - using '@user' format that triggers WhatsApp notifications
        // Ensure we extract just the number part for proper formatting
        const formattedSender = `@${senderId.split('@')[0]}`;

        // Get target from mentions or args with improved detection
        let targetId, targetName, formattedTarget;
        
        // Use multiple approaches to ensure we catch mentions reliably
        targetId = handleMention(message);
        
        if (targetId) {
            // Clean up the args from mentions to get any additional text
            targetName = args.join(' ').replace(/@\d+/g, '').trim() || 'them';
            // Format mention to match WhatsApp's official format
            formattedTarget = `@${targetId.split('@')[0]}`;
        } else {
            // No mention found, use args as name or default
            targetName = args.join(' ') || 'themselves';
            formattedTarget = targetName;
        }

        // Determine reaction message based on type - enhanced to ensure mentions are properly formatted
        let reactionMessage;
        const mentionsArray = [senderId];
        
        // Add target to mentions array if it exists
        if (targetId && targetId !== senderId) {
            mentionsArray.push(targetId);
        }
        
        // Create reaction message with proper WhatsApp mention format
        switch(reactionType) {
            // Self-reactions
            case 'smile': reactionMessage = `${formattedSender} smiles 😊`; break;
            case 'happy': reactionMessage = `${formattedSender} is happy 😄`; break;
            case 'dance': reactionMessage = `${formattedSender} is dancing 💃`; break;
            case 'cry': reactionMessage = `${formattedSender} is crying 😢`; break;
            case 'blush': reactionMessage = `${formattedSender} is blushing 😳`; break;
            case 'laugh': reactionMessage = `${formattedSender} is laughing 😂`; break;
            
            // Target reactions - for these, we ensure both sender and target are properly mentioned
            case 'hug': reactionMessage = `${formattedSender} hugs ${formattedTarget} 🤗`; break;
            case 'pat': reactionMessage = `${formattedSender} pats ${formattedTarget} 👋`; break;
            case 'kiss': reactionMessage = `${formattedSender} kisses ${formattedTarget} 😘`; break;
            case 'cuddle': reactionMessage = `${formattedSender} cuddles with ${formattedTarget} 🥰`; break;
            case 'wave': reactionMessage = `${formattedSender} waves at ${formattedTarget} 👋`; break;
            case 'wink': reactionMessage = `${formattedSender} winks at ${formattedTarget} 😉`; break;
            case 'poke': reactionMessage = `${formattedSender} pokes ${formattedTarget} 👉`; break;
            case 'slap': reactionMessage = `${formattedSender} slaps ${formattedTarget} 👋`; break;
            case 'bonk': reactionMessage = `${formattedSender} bonks ${formattedTarget} 🔨`; break;
            case 'bite': reactionMessage = `${formattedSender} bites ${formattedTarget} 😬`; break;
            case 'punch': reactionMessage = `${formattedSender} punches ${formattedTarget} 👊`; break;
            case 'highfive': reactionMessage = `${formattedSender} high fives ${formattedTarget} ✋`; break;
            case 'yeet': reactionMessage = `${formattedSender} yeets ${formattedTarget} 🚀`; break;
            case 'kill': reactionMessage = `${formattedSender} kills ${formattedTarget} 💀`; break;
            case 'fuck': reactionMessage = `${formattedSender} fucks ${formattedTarget} 🔞`; break;
            
            // Other emotions
            case 'horny': reactionMessage = `${formattedSender} is feeling horny 🔞`; break;
            case 'angry': reactionMessage = `${formattedSender} is angry 😡`; break;
            case 'bored': reactionMessage = `${formattedSender} is bored 😒`; break;
            case 'confused': reactionMessage = `${formattedSender} is confused 🤔`; break;
            case 'cool': reactionMessage = `${formattedSender} is looking cool 😎`; break;
            case 'scared': reactionMessage = `${formattedSender} is scared 😱`; break;
            case 'shy': reactionMessage = `${formattedSender} is feeling shy 🙈`; break;
            case 'sleepy': reactionMessage = `${formattedSender} is sleepy 😴`; break;
            case 'surprised': reactionMessage = `${formattedSender} is surprised 😲`; break;
            case 'tired': reactionMessage = `${formattedSender} is tired 😩`; break;
            case 'disgusted': reactionMessage = `${formattedSender} is disgusted 🤢`; break;
            case 'excited': reactionMessage = `${formattedSender} is excited 🤩`; break;
            case 'facepalm': reactionMessage = `${formattedSender} facepalms 🤦`; break;
            case 'greedy': reactionMessage = `${formattedSender} is feeling greedy 🤑`; break;
            case 'hungry': reactionMessage = `${formattedSender} is hungry 🍔`; break;
            case 'jealous': reactionMessage = `${formattedSender} is jealous 😒`; break;
            case 'nervous': reactionMessage = `${formattedSender} is nervous 😰`; break;
            case 'panic': reactionMessage = `${formattedSender} is panicking 😱`; break;
            case 'proud': reactionMessage = `${formattedSender} is proud 🥹`; break;
            case 'sad': reactionMessage = `${formattedSender} is sad 😞`; break;
            case 'shock': reactionMessage = `${formattedSender} is shocked 😱`; break;
            default: reactionMessage = `Unknown reaction: ${reactionType}`;
        }

        // Optimize GIF path determination
        const gifPath = path.join(process.cwd(), 'attached_assets', `${reactionType}.gif`);

        try {
            // Send text message with enhanced mention formatting
            // This format ensures mentions work like native WhatsApp mentions
            await sock.sendMessage(message.key.remoteJid, {
                text: reactionMessage,
                mentions: mentionsArray,  // Include both sender and target in mentions
            });

            // Process and send GIF if it exists
            if (fs.existsSync(gifPath)) {
                const gifBuffer = fs.readFileSync(gifPath);

                // Convert GIF to MP4 for better animation
                const videoBuffer = await convertGifToMp4(gifBuffer);

                if (videoBuffer) {
                    // Send as video with gifPlayback enabled for best compatibility
                    await sock.sendMessage(message.key.remoteJid, {
                        video: videoBuffer,
                        gifPlayback: true,
                        ptt: false,
                        mimetype: 'video/mp4'
                    });
                } else {
                    // Fallback to direct GIF sending if conversion fails
                    await safeSendAnimatedGif(sock, message.key.remoteJid, gifBuffer, "");
                }
            } else {
                // Log missing GIF but don't show error to user since text was already sent
                console.log(`GIF not found: ${gifPath}`);
            }
        } catch (error) {
            console.error("Error in reaction command:", error);
            
            // Try to send at least a text message if we haven't already
            try {
                await sock.sendMessage(message.key.remoteJid, { 
                    text: reactionMessage, 
                    mentions: mentionsArray 
                });
            } catch (fallbackError) {
                console.error("Even fallback failed:", fallbackError);
            }
        }

        return;

        // The following code is unreachable but kept for reference
        // Fire-and-forget immediate text response (<5ms target)


        // STAGE 2: BACKGROUND GIF PROCESSING (Non-blocking)
        // Start these operations after sending the text response
        setTimeout(async () => {
            try {
                // Get the GIF buffer (cached if available)
                const gifBuffer = await getGifBuffer(reactionType);

                if (gifBuffer) {
                    // Use our improved direct video approach for reliable animations
                    try {
                        // Convert GIF to MP4 for proper animation
                        const { convertGifToMp4 } = require('../utils/gifConverter');
                        const videoBuffer = await convertGifToMp4(gifBuffer);

                        if (videoBuffer) {
                            // Send as video with gifPlayback enabled - most reliable method
                            await safeSendMessage(sock, message.key.remoteJid, {
                                video: videoBuffer,
                                gifPlayback: true,
                                ptt: false,
                                mimetype: 'video/mp4'
                            });
                            logger.debug(`Successfully sent animated video for ${reactionType} reaction`);
                        } else {
                            // Fallback to standard GIF method
                            await safeSendAnimatedGif(sock, message.key.remoteJid, gifBuffer, "");
                            logger.debug(`Sent using fallback method for ${reactionType} reaction`);
                        }
                    } catch (mediaError) {
                        logger.error(`All methods failed for ${reactionType} reaction: ${mediaError.message}`);

                        // We already sent a text reaction, so this is just informational
                        logger.info(`Text-only reaction was sent for ${reactionType}`);
                    }
                }
            } catch (backgroundError) {
                logger.error(`Error in reaction GIF background processing: ${backgroundError.message}`);
            }
        }, 100); // Small delay to ensure text message gets priority

    } catch (error) {
        // Minimal error handling with no logging for better performance
        safeSendMessage(sock, message.key.remoteJid, { text: `❌ Error with reaction command` })
            .catch(() => {/* Silent catch */});
    }
}

// Command implementations
const commands = {
    hug: async (sock, message, args) => await handleReaction(sock, message, 'hug', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    pat: async (sock, message, args) => await handleReaction(sock, message, 'pat', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    kiss: async (sock, message, args) => await handleReaction(sock, message, 'kiss', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    cuddle: async (sock, message, args) => await handleReaction(sock, message, 'cuddle', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    smile: async (sock, message, args) => await handleReaction(sock, message, 'smile', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    happy: async (sock, message, args) => await handleReaction(sock, message, 'happy', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    wave: async (sock, message, args) => await handleReaction(sock, message, 'wave', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    dance: async (sock, message, args) => await handleReaction(sock, message, 'dance', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    cry: async (sock, message, args) => await handleReaction(sock, message, 'cry', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    blush: async (sock, message, args) => await handleReaction(sock, message, 'blush', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    laugh: async (sock, message, args) => await handleReaction(sock, message, 'laugh', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    wink: async (sock, message, args) => await handleReaction(sock, message, 'wink', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    poke: async (sock, message, args) => await handleReaction(sock, message, 'poke', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    slap: async (sock, message, args) => await handleReaction(sock, message, 'slap', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    bonk: async (sock, message, args) => await handleReaction(sock, message, 'bonk', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    bite: async (sock, message, args) => await handleReaction(sock, message, 'bite', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    punch: async (sock, message, args) => await handleReaction(sock, message, 'punch', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    highfive: async (sock, message, args) => await handleReaction(sock, message, 'highfive', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    yeet: async (sock, message, args) => await handleReaction(sock, message, 'yeet', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    kill: async (sock, message, args) => await handleReaction(sock, message, 'kill', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),

    // New reaction commands
    fuck: async (sock, message, args) => await handleReaction(sock, message, 'fuck', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    horny: async (sock, message, args) => await handleReaction(sock, message, 'horny', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),

    // Additional reaction commands
    angry: async (sock, message, args) => await handleReaction(sock, message, 'angry', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    bored: async (sock, message, args) => await handleReaction(sock, message, 'bored', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    confused: async (sock, message, args) => await handleReaction(sock, message, 'confused', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    cool: async (sock, message, args) => await handleReaction(sock, message, 'cool', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    scared: async (sock, message, args) => await handleReaction(sock, message, 'scared', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    shy: async (sock, message, args) => await handleReaction(sock, message, 'shy', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    sleepy: async (sock, message, args) => await handleReaction(sock, message, 'sleepy', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    surprised: async (sock, message, args) => await handleReaction(sock, message, 'surprised', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    tired: async (sock, message, args) => await handleReaction(sock, message, 'tired', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    disgusted: async (sock, message, args) => await handleReaction(sock, message, 'disgusted', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    excited: async (sock, message, args) => await handleReaction(sock, message, 'excited', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    facepalm: async (sock, message, args) => await handleReaction(sock, message, 'facepalm', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    greedy: async (sock, message, args) => await handleReaction(sock, message, 'greedy', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    hungry: async (sock, message, args) => await handleReaction(sock, message, 'hungry', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    jealous: async (sock, message, args) => await handleReaction(sock, message, 'jealous', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    nervous: async (sock, message, args) => await handleReaction(sock, message, 'nervous', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    panic: async (sock, message, args) => await handleReaction(sock, message, 'panic', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    proud: async (sock, message, args) => await handleReaction(sock, message, 'proud', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    sad: async (sock, message, args) => await handleReaction(sock, message, 'sad', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid),
    shock: async (sock, message, args) => await handleReaction(sock, message, 'shock', args, message.message?.extendedTextMessage?.contextInfo?.mentionedJid)
};

async function init() {
    try {
        logger.info('Initializing reactions module...');
        ensureDirectoriesExist();
        verifyReactionGifs();
        return true;
    } catch (err) {
        logger.error(`Error initializing reactions: ${err.message}`);
        return false;
    }
}

module.exports = {
    commands,
    init,
    category: 'reactions'
};