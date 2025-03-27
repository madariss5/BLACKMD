/**
 * Enhanced Message Logger for WhatsApp Messages
 * Logs both incoming and outgoing messages with specialized formatting
 */

const logger = require('./logger');

// Extract text content from various message types
function extractMessageText(msg) {
    if (!msg || !msg.message) {
        return 'No content';
    }
    
    // Handle common message types
    if (msg.message.conversation) {
        return msg.message.conversation;
    }
    
    if (msg.message.extendedTextMessage?.text) {
        return msg.message.extendedTextMessage.text;
    }
    
    if (msg.message.buttonsResponseMessage?.selectedButtonId) {
        return `Button: ${msg.message.buttonsResponseMessage.selectedButtonId}`;
    }
    
    if (msg.message.listResponseMessage?.title) {
        return `List: ${msg.message.listResponseMessage.title}`;
    }
    
    if (msg.message.audioMessage) {
        return `🎵 Audio message`;
    }
    
    if (msg.message.imageMessage) {
        const caption = msg.message.imageMessage.caption || '';
        return `🖼️ Image${caption ? ': ' + caption : ''}`;
    }
    
    if (msg.message.videoMessage) {
        const caption = msg.message.videoMessage.caption || '';
        return `🎥 Video${caption ? ': ' + caption : ''}`;
    }
    
    if (msg.message.stickerMessage) {
        return `🎭 Sticker`;
    }
    
    if (msg.message.documentMessage) {
        const filename = msg.message.documentMessage.fileName || '';
        return `📄 Document${filename ? ': ' + filename : ''}`;
    }
    
    if (msg.message.contactMessage) {
        const contact = msg.message.contactMessage.displayName || '';
        return `👤 Contact${contact ? ': ' + contact : ''}`;
    }
    
    if (msg.message.locationMessage) {
        return `📍 Location`;
    }
    
    // For unknown message types, show the keys
    const types = Object.keys(msg.message);
    return `Message with type(s): ${types.join(', ')}`;
}

// Format message content for logging
function formatMessageContent(content) {
    try {
        if (!content) return 'Empty content';
        
        let messageText = 'Unknown message format';
        
        if (content.text) {
            messageText = content.text;
        } else if (content.image) {
            messageText = `🖼️ Image${content.caption ? ': ' + content.caption : ''}`;
        } else if (content.video) {
            messageText = `🎥 Video${content.caption ? ': ' + content.caption : ''}`;
        } else if (content.audio) {
            messageText = `🎵 Audio`;
        } else if (content.sticker) {
            messageText = `🎭 Sticker`;
        } else if (content.document) {
            messageText = `📄 Document`;
        } else if (content.location) {
            messageText = `📍 Location`;
        } else if (content.contact) {
            messageText = `👤 Contact`;
        } else if (content.buttonsMessage || content.buttons) {
            messageText = `🔘 Button message${content.caption || content.text ? ': ' + (content.caption || content.text) : ''}`;
        } else if (content.listMessage) {
            messageText = `📋 List message${content.text ? ': ' + content.text : ''}`;
        } else {
            // Try to stringify the content for debugging
            const contentKeys = Object.keys(content).join(', ');
            messageText = `Message with keys: ${contentKeys}`;
        }
        
        return messageText;
    } catch (err) {
        return 'Error parsing message content';
    }
}

// Format JID for display
function formatJid(jid) {
    if (!jid) return 'Unknown JID';
    
    if (jid.includes('@g.us')) {
        return `Group: ${jid}`;
    } else if (jid.includes('@s.whatsapp.net')) {
        return `User: ${jid}`;
    }
    return jid;
}

/**
 * Setup enhanced message logging
 * @param {Object} sock The WhatsApp socket connection
 */
function setupMessageLogger(sock) {
    logger.info('[MessageLogger] Setting up enhanced message logging');
    
    // Message tracking system to link outgoing messages with their confirmations
    const messageTracker = new Map();
    const TRACKED_MESSAGE_TIMEOUT = 60 * 1000; // 60 seconds timeout
    
    // Periodically clean up old messages from the tracker
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        let count = 0;
        for (const [id, data] of messageTracker) {
            if (now - data.timestamp > TRACKED_MESSAGE_TIMEOUT) {
                messageTracker.delete(id);
                count++;
            }
        }
        if (count > 0) {
            logger.debug(`[MessageLogger] Cleaned up ${count} tracked messages`);
        }
    }, 30 * 1000); // Clean up every 30 seconds
    
    // Set up logging for outgoing messages (when they're sent)
    const originalSendMessage = sock.sendMessage;
    sock.sendMessage = async function(jid, content, options = {}) {
        try {
            // Log the outgoing message before sending
            const displayJid = formatJid(jid);
            const messageText = formatMessageContent(content);
            logger.info(`[MessageLogger] 📤 OUTGOING to ${displayJid}: ${messageText}`);
            
            // Call the original function
            const result = await originalSendMessage.call(sock, jid, content, options);
            
            // Track this message for later confirmation
            if (result && result.key && result.key.id) {
                const messageId = result.key.id;
                messageTracker.set(messageId, {
                    timestamp: Date.now(),
                    jid: jid,
                    content: messageText,
                    logged: false
                });
                logger.debug(`[MessageLogger] Tracked message ID: ${messageId.slice(0, 8)}...`);
            }
            
            return result;
        } catch (error) {
            logger.error(`[MessageLogger] Error in send logging: ${error.message}`);
            // Still call the original function even if our logging fails
            return await originalSendMessage.call(sock, jid, content, options);
        }
    };
    
    // Set up logging for incoming messages with enhanced visibility
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return;
        }
        
        // More visible incoming message indicator
        logger.info(`[MessageLogger] 📨 INCOMING MESSAGES (${messages.length}) - TYPE: ${type}`);
        console.log(`========== INCOMING MESSAGES (${messages.length}) ==========`);
        
        // Debug full message structure to console
        console.log("INCOMING RAW MESSAGE DATA:", JSON.stringify(messages, null, 2).substring(0, 800));
        
        // Process each message with enhanced visibility
        for (const msg of messages) {
            try {
                if (!msg || !msg.key) continue;
                
                const jid = msg.key.remoteJid;
                const messageId = msg.key.id;
                const fromMe = msg.key.fromMe;
                const sender = fromMe ? 'Me (Bot)' : (msg.pushName || 'Unknown');
                const text = extractMessageText(msg);
                
                // Print the message details with high visibility formatting
                if (fromMe) {
                    // This is a message from the bot - process and display ALL bot messages
                    const trackedMessage = messageTracker.get(messageId);
                    
                    // Make bot messages super visible regardless of tracking status
                    logger.info(`[MessageLogger] [BOT-MESSAGE] 🤖 BOT SAYS: ${text}`);
                    console.log("\n=================================================================");
                    console.log(`🤖 BOT MESSAGE: "${text}"`);
                    console.log(`📱 TO: ${jid}`);
                    console.log(`📋 MESSAGE TYPES: ${Object.keys(msg.message).join(', ')}`);
                    console.log("=================================================================\n");
                    
                    // Also update tracking info if available
                    if (trackedMessage) {
                        logger.info(`[MessageLogger] ✅ Tracked message confirmed: ${text}`);
                        trackedMessage.logged = true;
                    } else {
                        logger.info(`[MessageLogger] ℹ️ Untracked bot message (possibly from another device or auto-message)`);
                    }
                } else {
                    // Standard incoming message from someone else - make it very prominent
                    const logMessage = `[MessageLogger] 📥 INCOMING from ${sender} (${jid}): ${text}`;
                    logger.info(logMessage);
                    
                    // Extra-visible console log
                    console.log("========================================");
                    console.log(`📥 INCOMING MESSAGE:`);
                    console.log(`🧑 FROM: ${sender} (${jid})`);
                    console.log(`📝 TEXT: ${text}`);
                    console.log("========================================");
                    
                    // Add command detection with enhanced visibility
                    if (text && (text.startsWith('.') || text.startsWith('!') || text.startsWith('#'))) {
                        const command = text.slice(1).trim().split(' ')[0];
                        const commandArgs = text.slice(1).trim().split(' ').slice(1).join(' ');
                        logger.info(`[MessageLogger] 🤖 COMMAND DETECTED: ${command} ARGS: ${commandArgs}`);
                        console.log(`🤖 COMMAND DETECTED: ${command} ARGS: ${commandArgs}`);
                    }
                }
            } catch (error) {
                logger.error(`[MessageLogger] Error logging message: ${error.message}`);
                console.error("Error logging message:", error);
            }
        }
    });
    
    // Also log message receipts for better tracking
    sock.ev.on('message-receipt.update', (receipts) => {
        if (!receipts || !Array.isArray(receipts)) return;
        
        for (const receipt of receipts) {
            try {
                if (!receipt || !receipt.key || !receipt.key.id) continue;
                
                const messageId = receipt.key.id;
                const trackedMessage = messageTracker.get(messageId);
                
                if (trackedMessage) {
                    const receiptType = receipt.receipt?.type || 'unknown';
                    logger.debug(`[MessageLogger] [RECEIPT] Message ${messageId.slice(0, 8)}... received receipt: ${receiptType}`);
                }
            } catch (error) {
                logger.error(`[MessageLogger] Error processing receipt: ${error.message}`);
            }
        }
    });
    
    // Clean up on shutdown
    const cleanup = () => {
        clearInterval(cleanupInterval);
        logger.info('[MessageLogger] Cleaned up message tracker');
    };
    
    // Register cleanup handlers
    if (process && process.on) {
        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);
    }
    
    logger.info('[MessageLogger] Enhanced message logging set up successfully');
}

module.exports = {
    setupMessageLogger
};