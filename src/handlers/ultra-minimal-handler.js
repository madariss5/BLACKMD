/**
 * Ultra Minimal Message Handler
 * A bare-bones handler that responds to any message directly
 * Used to debug when the standard handler isn't working
 */

const logger = require('../utils/logger');
const { commandRegistry } = require('../core/commandRegistry');
const path = require('path');

module.exports = function setupUltraMinimalHandler(sock) {
    logger.info('[ULTRA] Setting up ultra-minimal message handler');
    
    // For tracking bot's own messages
    const botMessageIds = new Set();
    
    // Hook into message send events to track bot's own messages
    const originalSendMessage = sock.sendMessage;
    sock.sendMessage = async function(jid, content, options = {}) {
        try {
            // Call the original function
            const sentMessageInfo = await originalSendMessage.call(sock, jid, content, options);
            
            // If successful, add the message ID to our tracker
            if (sentMessageInfo && sentMessageInfo.key && sentMessageInfo.key.id) {
                const msgId = sentMessageInfo.key.id;
                botMessageIds.add(msgId);
                logger.info(`[ULTRA] Tracked outgoing message: ${msgId}`);
                
                // Clean up older IDs if we have too many
                if (botMessageIds.size > 100) {
                    // Convert to array, keep only most recent 50
                    const idsArray = Array.from(botMessageIds);
                    botMessageIds.clear();
                    for (let i = Math.max(0, idsArray.length - 50); i < idsArray.length; i++) {
                        botMessageIds.add(idsArray[i]);
                    }
                }
            }
            
            return sentMessageInfo;
        } catch (error) {
            logger.error(`[ULTRA] Error in send message override: ${error.message}`);
            // Still call the original function if our override fails
            return await originalSendMessage.call(sock, jid, content, options);
        }
    };
    
    // Direct message handler
    // Create a flag to disable command processing in ultra-minimal-handler
    // Set to false to prevent command duplication with the main handler
    const ultraHandlerEnabled = false;

    // Set global flag to make this available throughout the application
    global.ultraHandlerEnabled = ultraHandlerEnabled;

    // Log the status of the handler for debugging
    if (!ultraHandlerEnabled) {
        logger.info('[ULTRA] Ultra minimal handler loaded but DISABLED to prevent command duplication');
        console.log("🚫 ULTRA MINIMAL HANDLER DISABLED - Preventing command duplication");
    } else {
        logger.info('[ULTRA] Ultra minimal handler is ENABLED');
        console.log("✅ ULTRA MINIMAL HANDLER ENABLED");
    }

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Skip all command processing if handler disabled - ENFORCE STRICT DISABLE MODE
        const strictlyDisabled = true; // Force disable regardless of ultraHandlerEnabled flag
        
        if (!ultraHandlerEnabled || strictlyDisabled) {
            // Still track outgoing messages for IDs
            if (messages && Array.isArray(messages)) {
                for (const msg of messages) {
                    if (msg?.key?.fromMe) {
                        if (msg?.key?.id && !botMessageIds.has(msg.key.id)) {
                            botMessageIds.add(msg.key.id);
                            logger.info(`[ULTRA] Tracked outgoing message: ${msg.key.id}`);
                        }
                    }
                }
            }
            logger.info('[ULTRA] Ultra minimal handler disabled - skipping command processing (STRICT MODE)');
            return;
        }

        if (type !== 'notify') {
            logger.info(`[ULTRA] Received message type: ${type} - not handling`);
            return;
        }
        
        // Better incoming message indication at handler level
        logger.info(`[ULTRA] 📨 INCOMING: Received ${messages?.length || 0} messages of type: ${type}`);
        console.log("=================================================================");
        console.log(`📥 ULTRA HANDLER RECEIVED ${messages?.length || 0} MESSAGES (TYPE: ${type})`);
        console.log("=================================================================");
        console.log("SAMPLE MESSAGE CONTENT:", JSON.stringify(messages?.slice(0, 1), null, 2).substring(0, 500) + "...");
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            logger.warn('[ULTRA] ⚠️ No valid messages received');
            console.log("⚠️ NO VALID MESSAGES RECEIVED");
            return;
        }
        
        for (const msg of messages) {
            try {
                logger.info(`[ULTRA] 📝 Processing message: ${JSON.stringify(msg?.key || {})}`);
                console.log(`📝 PROCESSING MESSAGE: ${JSON.stringify(msg?.key || {})}`);
                
                if (!msg || !msg.key) {
                    logger.warn('[ULTRA] ⚠️ Invalid message structure');
                    console.log("⚠️ INVALID MESSAGE STRUCTURE");
                    continue;
                }
                
                // Process all messages, including those from ourselves
                if (msg.key.fromMe) {
                    logger.info('[ULTRA] 🤖 BOT SELF-MESSAGE DETECTED');
                    console.log("\n=================================================================");
                    console.log("🤖 BOT SELF-MESSAGE DETECTED (fromMe=true)");
                    console.log("✅ PROCESSING BOT'S OWN MESSAGE (not skipping)");
                    console.log("=================================================================\n");
                    
                    // Extract message content for better visibility of bot messages
                    const messageTypes = msg.message ? Object.keys(msg.message) : [];
                    const textContent = msg.message?.conversation || 
                                      msg.message?.extendedTextMessage?.text || 
                                      'No text content';
                    
                    console.log("\n=========================== BOT MESSAGE CONTENT ===========================");
                    console.log(`MESSAGE TEXT: ${textContent}`);
                    console.log(`MESSAGE TYPES: ${messageTypes.join(', ')}`);
                    console.log(`JID: ${msg.key.remoteJid}`);
                    console.log(`ID: ${msg.key.id}`);
                    console.log("==========================================================================\n");
                    
                    // Check if this is a message we've sent ourselves - tracked by our ID system
                    const isTrackedBotMessage = botMessageIds.has(msg.key.id);
                    if (isTrackedBotMessage) {
                        logger.info(`[ULTRA] This is a tracked bot message (ID: ${msg.key.id})`);
                        console.log(`[ULTRA] 🔍 THIS IS A TRACKED BOT MESSAGE WE SENT OURSELVES`);
                        
                        // Special processing for tracked bot messages
                        if (textContent.startsWith('.') || textContent.startsWith('!') || textContent.startsWith('#')) {
                            logger.info('[ULTRA] 🤖 Bot message contains a command - special handling active');
                            console.log('[ULTRA] 🤖 BOT MESSAGE CONTAINS A COMMAND - SPECIAL PROCESSING');
                        }
                    } else {
                        logger.info(`[ULTRA] This is an untracked bot message (ID: ${msg.key.id})`);
                        console.log(`[ULTRA] ⚠️ UNTRACKED BOT MESSAGE - MAY BE FROM ANOTHER SOURCE`);
                    }
                    
                    // We will continue processing this message
                }
                
                const jid = msg.key.remoteJid;
                const pushName = msg.pushName || 'Unknown';
                
                if (!msg.message) {
                    logger.warn(`[ULTRA] ⚠️ Message has no content: ${JSON.stringify(msg.key)}`);
                    console.log(`⚠️ MESSAGE HAS NO CONTENT: ${JSON.stringify(msg.key)}`);
                    continue;
                }
                
                // More detailed message content extraction
                const messageTypes = msg.message ? Object.keys(msg.message) : [];
                logger.info(`[ULTRA] 📋 Message types: ${messageTypes.join(', ')}`);
                console.log(`📋 MESSAGE TYPES: ${messageTypes.join(', ')}`);
                
                const text = msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text || 
                           (messageTypes.length > 0 ? `Message with type: ${messageTypes[0]}` : 'No text content');
                
                // Enhanced incoming message reporting
                logger.info(`[ULTRA] 📥 MESSAGE FROM ${pushName} (${jid}): ${text}`);
                
                // Extra visible in direct console log
                console.log("\n=================================================================");
                console.log(`📥 INCOMING MESSAGE: "${text}"`);
                console.log(`📤 FROM: ${pushName} (${jid})`);
                console.log(`📱 MESSAGE TYPES: ${messageTypes.join(', ')}`);
                console.log("=================================================================\n");
                
                // Check if it's a command (starts with ., !, or #)
                if (text.startsWith('.') || text.startsWith('!') || text.startsWith('#')) {
                    logger.info('[ULTRA] Command detected');
                    
                    const parts = text.slice(1).trim().split(' ');
                    const command = parts[0].toLowerCase();
                    const args = parts.slice(1);
                    
                    logger.info(`[ULTRA] Processing command: ${command} with args: ${JSON.stringify(args)}`);
                    
                    // First try to use commandRegistry - with enhanced debugging
                    try {
                        // More detailed debugging
                        logger.info(`[ULTRA] Command registry status - initialized: ${commandRegistry.initialized}, commands: ${commandRegistry.commands.size}`);
                        logger.info(`[ULTRA] Available command names: ${Array.from(commandRegistry.commands.keys()).join(', ')}`);
                        
                        if (commandRegistry && commandRegistry.commands) {
                            if (commandRegistry.commands.has(command)) {
                                logger.info(`[ULTRA] Command ${command} found in registry, handling with registry`);
                                
                                // Use command registry to handle the command - DIRECT EXECUTION
                                try {
                                    // Get command info directly from the registry
                                    const commandInfo = commandRegistry.commands.get(command);
                                    
                                    if (commandInfo && commandInfo.handler) {
                                        logger.info(`[ULTRA] Executing command handler directly for: ${command}`);
                                        
                                        // Execute the command handler directly to bypass any registry issues
                                        const messageObj = {
                                            key: {
                                                remoteJid: jid,
                                                fromMe: false,
                                                id: `cmd-${Date.now()}`
                                            },
                                            message: {
                                                conversation: text
                                            }
                                        };
                                        
                                        await commandInfo.handler(sock, messageObj, args);
                                        logger.info(`[ULTRA] Command ${command} executed directly with success`);
                                        continue; // Skip fallback handling
                                    } else {
                                        logger.warn(`[ULTRA] Command found in registry but handler missing for: ${command}`);
                                    }
                                } catch (directError) {
                                    logger.error(`[ULTRA] Error executing command handler directly: ${directError.message}`);
                                    
                                    // Try using the normal registry method as fallback
                                    logger.info(`[ULTRA] Falling back to registry handleCommand method`);
                                    const result = await commandRegistry.handleCommand(sock, jid, command, args.join(' '));
                                    
                                    if (result) {
                                        logger.info(`[ULTRA] Command ${command} handled successfully by registry method`);
                                        continue; // Skip fallback handling
                                    } else {
                                        logger.warn(`[ULTRA] Command registry failed to handle ${command}, falling back to built-in commands`);
                                    }
                                }
                            } else {
                                logger.warn(`[ULTRA] Command ${command} not found in registry`);
                                
                                // Special handling for menu command which is critical
                                if (command === 'menu') {
                                    try {
                                        logger.info(`[ULTRA] Attempting to load menu command module directly`);
                                        const menuModule = require('../commands/menu');
                                        if (menuModule && menuModule.commands && menuModule.commands.menu) {
                                            logger.info(`[ULTRA] Executing menu command directly via module`);
                                            const messageObj = {
                                                key: {
                                                    remoteJid: jid,
                                                    fromMe: false,
                                                    id: `cmd-${Date.now()}`
                                                },
                                                message: {
                                                    conversation: text
                                                }
                                            };
                                            
                                            await menuModule.commands.menu(sock, messageObj, args);
                                            logger.info(`[ULTRA] Menu command executed directly with success`);
                                            continue; // Skip fallback handling
                                        }
                                    } catch (menuError) {
                                        logger.error(`[ULTRA] Error executing menu module directly: ${menuError.message}`);
                                    }
                                }
                                
                                const registryCommands = Array.from(commandRegistry.commands.keys()).join(', ');
                                logger.info(`[ULTRA] Available commands in registry: ${registryCommands}`);
                            }
                        } else {
                            logger.error(`[ULTRA] Command registry is not properly initialized`);
                            
                            // Initialize command registry if needed
                            if (!commandRegistry.initialized) {
                                logger.info(`[ULTRA] Attempting to initialize command registry`);
                                try {
                                    const commandsDir = path.join(process.cwd(), 'src/commands');
                                    await commandRegistry.loadCommands(commandsDir);
                                    await commandRegistry.initializeModules(sock);
                                    logger.info(`[ULTRA] Command registry initialized with: ${commandRegistry.commands.size} commands`);
                                } catch (initError) {
                                    logger.error(`[ULTRA] Error initializing command registry: ${initError.message}`);
                                }
                            }
                        }
                    } catch (regError) {
                        logger.error(`[ULTRA] Error using command registry: ${regError.message}`);
                        logger.error(`[ULTRA] Error stack: ${regError.stack ? regError.stack.slice(0, 300) : 'No stack'}`);
                    }
                    
                    // Fallback: Handle a few basic commands directly
                    if (command === 'ping') {
                        await sock.sendMessage(jid, { text: 'Pong! ⚡' });
                        logger.info('[ULTRA] Responded to ping command');
                    }
                    else if (command === 'echo') {
                        const echoText = args.join(' ') || 'No echo text provided';
                        await sock.sendMessage(jid, { text: `🔄 Echo: ${echoText}` });
                        logger.info('[ULTRA] Responded to echo command');
                    }
                    else if (command === 'help') {
                        await sock.sendMessage(jid, { 
                            text: '*Available Commands*\n\n' +
                                  '.ping - Check bot response\n' +
                                  '.echo [text] - Repeat your text\n' +
                                  '.help - Show this help message\n' +
                                  '.menu - Show full command menu'
                        });
                        logger.info('[ULTRA] Responded to help command');
                    }
                    else if (command === 'menu') {
                        // Special menu command
                        try {
                            // Try to load menu command directly
                            const menuCommand = require('../commands/menu');
                            if (menuCommand && menuCommand.commands && menuCommand.commands.menu) {
                                await menuCommand.commands.menu(sock, msg, args);
                                logger.info('[ULTRA] Executed menu command successfully');
                            } else {
                                throw new Error('Menu command not properly structured');
                            }
                        } catch (menuError) {
                            logger.error(`[ULTRA] Error with menu command: ${menuError.message}`);
                            // Fallback menu
                            await sock.sendMessage(jid, { 
                                text: '*BLACKSKY BOT MENU*\n\nBasic Commands:\n• .ping\n• .help\n• .menu\n\nMore commands coming soon!'
                            });
                        }
                    }
                    else {
                        // Unknown command message
                        await sock.sendMessage(jid, { 
                            text: `Command not recognized: ${command}\nTry .help to see available commands.`
                        });
                        logger.info(`[ULTRA] Sent unknown command message for: ${command}`);
                    }
                }
            } catch (error) {
                logger.error(`[ULTRA] Error processing message: ${error.message}`);
                try {
                    await sock.sendMessage(msg.key.remoteJid, { 
                        text: `Error processing your message: ${error.message}`
                    });
                } catch (sendError) {
                    logger.error(`[ULTRA] Failed to send error message: ${sendError.message}`);
                }
            }
        }
    });
    
    logger.info('[ULTRA] Ultra-minimal message handler set up successfully');
    return true;
};