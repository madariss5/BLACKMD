/**
 * Debug Messages Handler
 * Provides enhanced visibility into message flow through the system
 */

const logger = require('./utils/logger');

class MessageDebugger {
    constructor() {
        this.initialized = false;
        this.messageFlow = [];
        this.maxMessages = 100;
        this.enableConsoleOutput = true; // Set to true for increased visibility
        this.trackBotMessages = true;    // Specifically track bot messages
        this.showRawMessageData = true;  // Show detailed message data
    }

    /**
     * Initialize the message debugger
     */
    initialize() {
        if (this.initialized) return;
        
        logger.info('[MessageDebug] Setting up message debugger');
        
        // Initialize the message flow tracking
        this.messageFlow = [];
        this.initialized = true;
        
        logger.info('[MessageDebug] Message debugger set up successfully');
    }

    /**
     * Track an incoming message
     * @param {Object} message The message object
     * @param {string} stage The processing stage
     */
    trackIncomingMessage(message, stage) {
        if (!this.initialized) this.initialize();
        
        try {
            const fromMe = message?.key?.fromMe || false;
            const messageId = message?.key?.id || 'unknown';
            const jid = message?.key?.remoteJid || 'unknown';
            
            // Extract text content
            const textContent = message?.message?.conversation || 
                              message?.message?.extendedTextMessage?.text || 
                              'No text content';
            
            // Message types
            const messageTypes = message?.message ? Object.keys(message?.message) : [];
            
            // Create flow record
            const record = {
                timestamp: new Date().toISOString(),
                stage,
                messageId,
                fromMe,
                jid,
                textContent,
                messageTypes,
                raw: this.showRawMessageData ? message : null
            };
            
            // Add to flow tracking
            this.messageFlow.unshift(record);
            
            // Limit size
            if (this.messageFlow.length > this.maxMessages) {
                this.messageFlow = this.messageFlow.slice(0, this.maxMessages);
            }
            
            // Log to console if enabled
            if (this.enableConsoleOutput) {
                // Always log bot messages and specific stages
                if (fromMe || stage === 'preProcess' || stage === 'finalResult') {
                    console.log(`\n[MessageDebug] 📋 TRACKING ${fromMe ? 'BOT' : 'USER'} MESSAGE - Stage: ${stage}`);
                    console.log(`[MessageDebug] ID: ${messageId}`);
                    console.log(`[MessageDebug] JID: ${jid}`);
                    console.log(`[MessageDebug] Content: ${textContent}`);
                    console.log(`[MessageDebug] Types: ${messageTypes.join(', ')}`);
                    console.log(`[MessageDebug] Processing Time: ${record.timestamp}`);
                    
                    // Extra detailed logging for bot messages
                    if (fromMe && this.trackBotMessages) {
                        console.log('\n======== BOT MESSAGE DETAILED DEBUG ========');
                        if (textContent.startsWith('.') || textContent.startsWith('!') || textContent.startsWith('#')) {
                            console.log('👉 BOT MESSAGE CONTAINS COMMAND - SPECIAL TRACKING ACTIVE');
                        }
                        console.log('============================================\n');
                    }
                }
            }
            
            // Log to proper logger for searchable records
            if (fromMe) {
                logger.info(`[MessageDebug] 🤖 Bot message at ${stage}: ${textContent} (ID: ${messageId})`);
            } else {
                logger.debug(`[MessageDebug] Message at ${stage}: ${textContent} (ID: ${messageId})`);
            }
            
        } catch (error) {
            logger.error(`[MessageDebug] Error tracking message: ${error.message}`);
        }
    }
    
    /**
     * Track outgoing message
     * @param {string} jid Destination JID
     * @param {Object} content Message content
     */
    trackOutgoingMessage(jid, content) {
        if (!this.initialized) this.initialize();
        
        try {
            // Extract text if possible
            let textContent = 'Non-text content';
            
            if (typeof content === 'string') {
                textContent = content;
            } else if (content && typeof content === 'object') {
                if (content.text) {
                    textContent = content.text;
                } else if (content.caption) {
                    textContent = `[Media with caption]: ${content.caption}`;
                } else if (content.mimetype) {
                    textContent = `[Media]: ${content.mimetype}`;
                }
            }
            
            // Create record
            const record = {
                timestamp: new Date().toISOString(),
                stage: 'outgoing',
                messageId: `out-${Date.now()}`,
                fromMe: true,
                jid,
                textContent,
                messageTypes: ['outgoing'],
                raw: this.showRawMessageData ? content : null
            };
            
            // Add to flow tracking
            this.messageFlow.unshift(record);
            
            // Limit size
            if (this.messageFlow.length > this.maxMessages) {
                this.messageFlow = this.messageFlow.slice(0, this.maxMessages);
            }
            
            // Log to console if enabled
            if (this.enableConsoleOutput) {
                console.log('\n[MessageDebug] 📤 TRACKING OUTGOING MESSAGE');
                console.log(`[MessageDebug] To: ${jid}`);
                console.log(`[MessageDebug] Content: ${textContent}`);
                console.log(`[MessageDebug] Time: ${record.timestamp}`);
                
                // Special tracking for command responses
                if (textContent.includes('Command') || textContent.includes('command')) {
                    console.log('\n======== COMMAND RESPONSE DEBUG ========');
                    console.log(`RESPONSE: ${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}`);
                    console.log('========================================\n');
                }
            }
            
            // Log to proper logger
            logger.info(`[MessageDebug] 📤 Outgoing message to ${jid}: ${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}`);
            
        } catch (error) {
            logger.error(`[MessageDebug] Error tracking outgoing message: ${error.message}`);
        }
    }
    
    /**
     * Get a summary of recent message flow
     * @param {number} count Number of messages to retrieve
     * @returns {Array} Recent message flow records
     */
    getRecentFlow(count = 10) {
        return this.messageFlow.slice(0, count);
    }
    
    /**
     * Find messages in the flow by ID
     * @param {string} messageId Message ID to find
     * @returns {Array} Matching message flow records
     */
    findMessageById(messageId) {
        return this.messageFlow.filter(record => record.messageId === messageId);
    }
    
    /**
     * Find messages containing specific text
     * @param {string} text Text to search for
     * @returns {Array} Matching message flow records
     */
    findMessagesByContent(text) {
        return this.messageFlow.filter(record => 
            record.textContent && record.textContent.includes(text)
        );
    }
    
    /**
     * Find messages from a specific JID
     * @param {string} jid JID to filter by
     * @returns {Array} Matching message flow records
     */
    findMessagesByJid(jid) {
        return this.messageFlow.filter(record => record.jid === jid);
    }
    
    /**
     * Find bot messages (fromMe = true)
     * @returns {Array} Bot message flow records
     */
    findBotMessages() {
        return this.messageFlow.filter(record => record.fromMe === true);
    }
    
    /**
     * Find user messages (fromMe = false)
     * @returns {Array} User message flow records
     */
    findUserMessages() {
        return this.messageFlow.filter(record => record.fromMe === false);
    }
    
    /**
     * Print a flow summary to console
     * @param {number} count Number of messages to show
     */
    printFlowSummary(count = 10) {
        console.log('\n===== MESSAGE FLOW SUMMARY =====');
        const recentMessages = this.getRecentFlow(count);
        
        recentMessages.forEach((record, index) => {
            console.log(`[${index + 1}] ${record.fromMe ? 'BOT' : 'USER'} at ${record.stage}: ${record.textContent.substring(0, 30)}${record.textContent.length > 30 ? '...' : ''}`);
        });
        
        console.log('================================\n');
    }
}

// Create a singleton instance
const messageDebugger = new MessageDebugger();

// Set up message debugger with a WhatsApp socket
function setupMessageDebugger(sock) {
    if (!sock) {
        logger.error('[MessageDebug] Cannot set up message debugger: no socket provided');
        return false;
    }
    
    // Initialize the debugger
    messageDebugger.initialize();
    
    // Hook into message upsert events
    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (!messages || !Array.isArray(messages)) return;
        
        for (const message of messages) {
            try {
                messageDebugger.trackIncomingMessage(message, 'initial_receipt');
            } catch (error) {
                logger.error(`[MessageDebug] Error tracking message: ${error.message}`);
            }
        }
    });
    
    // Intercept the sock.sendMessage function to track outgoing messages
    const originalSendMessage = sock.sendMessage;
    sock.sendMessage = async function(jid, content, options = {}) {
        try {
            // Track the outgoing message first
            messageDebugger.trackOutgoingMessage(jid, content);
            
            // Call the original function
            return await originalSendMessage.call(sock, jid, content, options);
        } catch (error) {
            logger.error(`[MessageDebug] Error in sendMessage override: ${error.message}`);
            // Still call the original function if our override fails
            return await originalSendMessage.call(sock, jid, content, options);
        }
    };
    
    logger.info('[MessageDebug] Message debugger set up successfully');
    return true;
}

// Export the instance and setup function
module.exports = {
    MessageDebugger,
    messageDebugger,
    setupMessageDebugger
};