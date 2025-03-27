/**
 * Ultra Simplified Message Handler
 * Responds to every message with a fixed reply for debugging purposes
 */

const logger = require('./utils/logger');

// Export the simplified handler function
module.exports = async function setupSimplifiedHandler(sock) {
    logger.info('Setting up simplified message handler...');

    // Listen for message events
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Skip if not a notification
        if (type !== 'notify') return;
        
        logger.info(`[SIMPLE] Received message upsert: type=${type}, messages count=${messages?.length || 0}`);

        // Process each message
        for (const message of messages) {
            try {
                // Skip invalid messages
                if (!message || !message.key) continue;
                
                // Skip own messages
                if (message.key.fromMe) continue;

                const jid = message.key.remoteJid;
                logger.info(`[SIMPLE] Got message from JID: ${jid}`);

                // Log message details
                logger.info(`[SIMPLE] Message key: ${JSON.stringify(message.key)}`);
                logger.info(`[SIMPLE] Message type: ${message.message ? Object.keys(message.message).join(', ') : 'unknown'}`);

                // Direct message reply
                try {
                    await sock.sendMessage(jid, { text: '🤖 Bot is responding (simplified handler)' });
                    logger.info(`[SIMPLE] Simple reply sent to ${jid}`);
                } catch (error) {
                    logger.error(`[SIMPLE] Error sending simple reply: ${error.message}`);
                }
                
                // Disabled command processing to prevent duplicate execution
                const msgText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
                if (msgText.startsWith('.') || msgText.startsWith('!') || msgText.startsWith('#')) {
                    logger.info(`[SIMPLE] Command detected: ${msgText} but skipping processing (DISABLED)`);
                    
                    // Logging only - no message sending or command processing
                    logger.info(`[SIMPLE] Simplified handler command processing DISABLED to prevent duplicates`);
                }
            } catch (error) {
                logger.error(`[SIMPLE] Error in simplified handler: ${error.message}`);
            }
        }
    });

    logger.info('Simplified message handler setup complete');
    return true;
};