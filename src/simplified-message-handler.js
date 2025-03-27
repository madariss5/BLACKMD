const logger = require('./utils/logger');

async function executeCommand(handler, sock, msg) {
    if (!handler || !sock || !msg) {
        logger.error('Invalid parameters passed to executeCommand');
        return false;
    }
    try {
        const jid = msg.key.remoteJid;
        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

        if (!messageText.startsWith('.')) {
            return false;
        }

        const [command, ...args] = messageText.slice(1).trim().split(' ');
        logger.info(`Executing command: ${command} with args: ${args.join(' ')}`);

        if (handler[command]) {
            await handler[command](sock, msg, args);
            return true;
        } else {
            logger.info(`Unknown command: ${command}`);
            await sock.sendMessage(jid, { text: 'Unknown command. Use .help to see available commands.' });
            return false;
        }
    } catch (error) {
        logger.error('Error in executeCommand:', error);
        return false;
    }
}

async function handleIncomingMessage(sock, msg, handler) {
    if (!msg || !msg.key) return false;

    // Skip messages from the bot itself
    if (msg.key.fromMe) return false;

    try {
        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

        if (messageText.startsWith('.')) {
            logger.info(`Processing command message: ${messageText}`);
            return await executeCommand(handler, sock, msg);
        }
    } catch (error) {
        logger.error("Error handling message:", error);
    }
    return false;
}

module.exports = {
    executeCommand,
    handleIncomingMessage
};