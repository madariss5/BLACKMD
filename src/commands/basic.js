/**
 * Basic Command Module
 * Contains essential commands for basic bot functionality
 */

const logger = require('../utils/logger');
const os = require('os');
const { proto } = require('@whiskeysockets/baileys');
const { safeSendText, safeSendMessage, formatJidForLogging } = require('../utils/jidHelper');
const { languageManager } = require('../utils/language');

// Basic bot commands
const basicCommands = {
    /**
     * Ping command to check bot responsiveness
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    ping: async (sock, message) => {
        const start = Date.now();
        const reply = await safeSendText(sock, message.key.remoteJid, 'Pinging...');
        const responseTime = Date.now() - start;
        
        await safeSendText(
            sock, 
            message.key.remoteJid, 
            languageManager.getText('basic.ping_response', null, responseTime)
        );
    },
    
    /**
     * Help command to show available commands
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @param {Array} args Command arguments
     * @returns {Promise<void>}
     */
    help: async (sock, message, args) => {
        const commandRequested = args[0];
        const jid = message.key.remoteJid;
        
        if (commandRequested) {
            // Help for specific command
            await safeSendText(sock, jid, `Help for command: ${commandRequested}\nThis feature is still under development.`);
        } else {
            // General help
            const helpText = `${languageManager.getText('basic.help_title')}\n\n` +
                `${languageManager.getText('basic.help_description')}\n\n` +
                `• !ping - ${languageManager.getText('basic.ping_response', null, '')}\n` +
                `• !help - ${languageManager.getText('basic.help_title')}\n` +
                `• !info - ${languageManager.getText('basic.info_title')}\n\n` +
                `${languageManager.getText('menu.footer')}`;
            
            await safeSendText(sock, jid, helpText);
        }
    },
    
    /**
     * Info command to display bot information
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    info: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        // Calculate uptime
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;
        
        // Calculate memory usage
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        // Format info text
        const infoText = `*${languageManager.getText('basic.info_title')}*\n\n` +
            `*${languageManager.getText('basic.info_uptime', null, uptimeStr)}*\n` +
            `*${languageManager.getText('basic.info_memory', null, memoryUsageMB)}*\n` +
            `*Version:* 1.0.0\n` +
            `*Platform:* ${os.platform()} ${os.release()}\n` +
            `*Node.js:* ${process.version}\n`;
        
        await safeSendText(sock, jid, infoText);
    },
    
    /**
     * Echo command to repeat the message
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @param {Array} args Command arguments
     * @returns {Promise<void>}
     */
    echo: async (sock, message, args) => {
        const jid = message.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            await safeSendText(sock, jid, 'Please provide text to echo');
            return;
        }
        await safeSendText(sock, jid, text);
    },
    
    /**
     * About command to show bot information
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    about: async (sock, message) => {
        const jid = message.key.remoteJid;
        const aboutText = `*About BlackskyMD*\n\n` +
            `BlackskyMD is an advanced WhatsApp bot built with Node.js and Baileys.\n\n` +
            `*Features:*\n` +
            `• Multiple command categories\n` +
            `• Media processing\n` +
            `• Group management\n` +
            `• Fun commands\n` +
            `• And much more!\n\n` +
            `*Developed by:* Blacksky Team`;
        
        await safeSendText(sock, jid, aboutText);
    },
    
    /**
     * Language command to change language
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @param {Array} args Command arguments
     * @returns {Promise<void>}
     */
    language: async (sock, message, args) => {
        const jid = message.key.remoteJid;
        const lang = args[0];
        
        if (!lang) {
            const availableLanguages = languageManager.getAvailableLanguages().join(', ');
            await safeSendText(sock, jid, `Available languages: ${availableLanguages}\nUse !language [code] to change`);
            return;
        }
        
        if (languageManager.isLanguageSupported(lang)) {
            languageManager.setLanguage(lang);
            await safeSendText(sock, jid, `Language changed to: ${lang}`);
        } else {
            await safeSendText(sock, jid, `Language "${lang}" is not supported`);
        }
    },
    
    /**
     * Rules command to show chat rules
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    rules: async (sock, message) => {
        const jid = message.key.remoteJid;
        const rulesText = `*Chat Rules*\n\n` +
            `1. Be respectful to others\n` +
            `2. No spamming\n` +
            `3. No offensive content\n` +
            `4. Use appropriate commands\n` +
            `5. Have fun!`;
        
        await safeSendText(sock, jid, rulesText);
    },
    
    /**
     * Prefix command to show bot prefix
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    prefix: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `Current bot prefix is: !`);
    },
    
    /**
     * Invite command to get group link
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    invite: async (sock, message) => {
        const jid = message.key.remoteJid;
        // This would normally fetch the actual invite link
        await safeSendText(sock, jid, `Group invite link functionality is available in the group commands category.`);
    },
    
    /**
     * Support command to get support info
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    support: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Support Information*\n\nFor help with the bot, contact the administrator or visit our website at example.com`);
    },
    
    /**
     * Credit command to show credits
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    credits: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Credits*\n\nDeveloped by: Blacksky Team\nLibraries: Baileys, Node.js\nSpecial thanks to all contributors!`);
    },
    
    /**
     * Version command to show bot version
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    version: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Bot Version*\n\nVersion: 1.0.0\nBaileys: ${require('@whiskeysockets/baileys/package.json').version}\nNode.js: ${process.version}`);
    },
    
    /**
     * Uptime command to show bot uptime
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    uptime: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        await safeSendText(sock, jid, `*Bot Uptime*\n\nUptime: ${uptimeStr}`);
    },
    
    /**
     * Time command to show current time
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    time: async (sock, message) => {
        const jid = message.key.remoteJid;
        const now = new Date();
        await safeSendText(sock, jid, `*Current Time*\n\n${now.toLocaleString()}`);
    },
    
    /**
     * Hello command to greet user
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    hello: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `Hello there! How can I help you today?`);
    },
    
    /**
     * Hi command to greet user (alias)
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    hi: async (sock, message) => {
        await basicCommands.hello(sock, message);
    },
    
    /**
     * Menu command to show command menu
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    menu: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `The menu command has been moved to the system category. Please use !menu instead.`);
    },
    
    /**
     * Start command for new users
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    start: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Welcome to BlackskyMD!*\n\nTo get started, use the !help command to see available features or !menu to browse all commands.`);
    },
    
    /**
     * Feedback command to provide feedback
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @param {Array} args Command arguments
     * @returns {Promise<void>}
     */
    feedback: async (sock, message, args) => {
        const jid = message.key.remoteJid;
        const feedback = args.join(' ');
        
        if (!feedback) {
            await safeSendText(sock, jid, `Please provide your feedback after the command. Example: !feedback This bot is great!`);
            return;
        }
        
        // In a real implementation, this would store the feedback
        logger.info(`Feedback received from ${jid}: ${feedback}`);
        await safeSendText(sock, jid, `Thank you for your feedback! Your message has been recorded.`);
    },
    
    /**
     * Report command to report issues
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @param {Array} args Command arguments
     * @returns {Promise<void>}
     */
    report: async (sock, message, args) => {
        const jid = message.key.remoteJid;
        const report = args.join(' ');
        
        if (!report) {
            await safeSendText(sock, jid, `Please provide details about the issue after the command. Example: !report The weather command is not working`);
            return;
        }
        
        // In a real implementation, this would store the report
        logger.info(`Issue reported from ${jid}: ${report}`);
        await safeSendText(sock, jid, `Thank you for reporting this issue! It has been logged for our developers.`);
    },
    
    /**
     * Privacy command to show privacy policy
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    privacy: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Privacy Policy*\n\nThis bot respects your privacy. We do not store personal messages, only necessary data for functionality. Command usage is logged for debugging purposes only.`);
    },
    
    /**
     * Terms command to show terms of service
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    terms: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Terms of Service*\n\nBy using this bot, you agree to use it responsibly. Misuse or abuse of bot features may result in restricted access. The bot is provided as-is without warranties.`);
    },
    
    /**
     * Donate command to show donation info
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    donate: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Support the Development*\n\nIf you enjoy using this bot and want to support its development, please contact the administrators for donation information.`);
    },
    
    /**
     * Contact command to get contact info
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    contact: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Contact Information*\n\nFor support or inquiries, please contact the administrator through the !report command.`);
    },
    
    /**
     * Features command to list features
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    features: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        const featuresText = `*Bot Features*\n\n` +
            `• User commands\n` +
            `• Group management\n` +
            `• Media processing\n` +
            `• Fun and games\n` +
            `• Administrative tools\n` +
            `• Educational resources\n` +
            `• Utility functions\n` +
            `• And much more!\n\n` +
            `Use !menu to explore all features.`;
        
        await safeSendText(sock, jid, featuresText);
    },
    
    /**
     * Commands command to list available commands
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    commands: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `To see all available commands, please use the !menu command.`);
    },
    
    /**
     * Groups command to list joined groups
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    groups: async (sock, message) => {
        const jid = message.key.remoteJid;
        // This would normally list the groups
        await safeSendText(sock, jid, `This command has been moved to the admin category for security reasons.`);
    },
    
    /**
     * Usage command to show command usage
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @param {Array} args Command arguments
     * @returns {Promise<void>}
     */
    usage: async (sock, message, args) => {
        const jid = message.key.remoteJid;
        const commandName = args[0];
        
        if (!commandName) {
            await safeSendText(sock, jid, `Please specify a command name. Example: !usage ping`);
            return;
        }
        
        // In a real implementation, this would fetch actual usage info
        await safeSendText(sock, jid, `*Usage for ${commandName}*\n\nSyntax: !${commandName} [arguments]\nFor detailed help, check the command documentation.`);
    },
    
    /**
     * Faq command to show frequently asked questions
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    faq: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        const faqText = `*Frequently Asked Questions*\n\n` +
            `Q: How do I use the bot?\n` +
            `A: Start with !help or !menu to see available commands.\n\n` +
            `Q: Is the bot free to use?\n` +
            `A: Yes, the bot is free for everyone.\n\n` +
            `Q: How do I report issues?\n` +
            `A: Use the !report command to report problems.\n\n` +
            `Q: Can I add the bot to my group?\n` +
            `A: Contact the administrator for information about adding the bot to groups.`;
        
        await safeSendText(sock, jid, faqText);
    },
    
    /**
     * Invite command to invite bot to group
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    invite: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `To invite this bot to your group, please contact the bot administrator.`);
    },
    
    /**
     * Tutorial command to show bot tutorial
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    tutorial: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        const tutorialText = `*Bot Tutorial*\n\n` +
            `1. Use !menu to see all commands\n` +
            `2. Commands are organized by categories\n` +
            `3. Most commands follow the pattern: !command [arguments]\n` +
            `4. For help with a specific command, use !help [command]\n` +
            `5. Report any issues with !report`;
        
        await safeSendText(sock, jid, tutorialText);
    },
    
    /**
     * Guide command to show user guide
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    guide: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        const guideText = `*User Guide*\n\n` +
            `This bot has many features organized into categories:\n\n` +
            `• Basic commands: General functionality\n` +
            `• Fun commands: Entertainment\n` +
            `• Group commands: Group management\n` +
            `• Media commands: Media processing\n` +
            `• User commands: User-related features\n\n` +
            `Use !menu to explore all categories.`;
        
        await safeSendText(sock, jid, guideText);
    },
    
    /**
     * Updates command to show recent updates
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    updates: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        const updatesText = `*Recent Updates*\n\n` +
            `Version 1.0.0:\n` +
            `• Initial release\n` +
            `• Added basic commands\n` +
            `• Added group functionality\n` +
            `• Added media processing\n\n` +
            `Stay tuned for more updates!`;
        
        await safeSendText(sock, jid, updatesText);
    },
    
    /**
     * Changelog command to show changelog
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    changelog: async (sock, message) => {
        const jid = message.key.remoteJid;
        await basicCommands.updates(sock, message);
    },
    
    /**
     * Owner command to show owner info
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    owner: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Bot Owner*\n\nThis bot is owned and maintained by the Blacksky Team.`);
    },
    
    /**
     * Status command to show bot status
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    status: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const uptimeStr = `${hours}h ${minutes}m`;
        
        const statusText = `*Bot Status*\n\n` +
            `Status: Online\n` +
            `Uptime: ${uptimeStr}\n` +
            `Performance: Normal\n` +
            `Connection: Stable`;
        
        await safeSendText(sock, jid, statusText);
    },
    
    /**
     * Sourcecode command to show source code info
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    sourcecode: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*Source Code Information*\n\nThis bot is built using Node.js and the Baileys library. Contact the administrator for more information.`);
    },
    
    /**
     * Readme command to show readme
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    readme: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `*README*\n\nBlackskyMD is a WhatsApp bot built with Node.js and Baileys. It provides various commands and features for group management, media handling, and entertainment.`);
    },
    
    /**
     * List command to list available commands
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    list: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `To see a list of all available commands, please use the !menu command.`);
    },
    
    /**
     * Test command to test bot functionality
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    test: async (sock, message) => {
        const jid = message.key.remoteJid;
        await safeSendText(sock, jid, `Test successful! The bot is working properly.`);
    },
    
    /**
     * Server command to show server info
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    server: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        const serverInfo = {
            platform: os.platform(),
            type: os.type(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            memory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
            freemem: `${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB`,
        };
        
        const serverText = `*Server Information*\n\n` +
            `Platform: ${serverInfo.platform}\n` +
            `OS Type: ${serverInfo.type}\n` +
            `Architecture: ${serverInfo.arch}\n` +
            `Release: ${serverInfo.release}\n` +
            `CPUs: ${serverInfo.cpus}\n` +
            `Total Memory: ${serverInfo.memory}\n` +
            `Free Memory: ${serverInfo.freemem}`;
        
        await safeSendText(sock, jid, serverText);
    },
    
    /**
     * System command to show system info
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    system: async (sock, message) => {
        await basicCommands.server(sock, message);
    },
    
    /**
     * Node command to show node.js info
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    node: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        const nodeInfo = {
            version: process.version,
            modules: process.moduleLoadList.length,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        };
        
        const nodeText = `*Node.js Information*\n\n` +
            `Version: ${nodeInfo.version}\n` +
            `Platform: ${nodeInfo.platform}\n` +
            `Architecture: ${nodeInfo.arch}\n` +
            `Process ID: ${nodeInfo.pid}\n` +
            `Memory Usage: ${nodeInfo.memoryUsage} MB`;
        
        await safeSendText(sock, jid, nodeText);
    },
    
    /**
     * Js command to show JavaScript info
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    js: async (sock, message) => {
        await basicCommands.node(sock, message);
    },
    
    /**
     * Packages command to show installed packages
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    packages: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        // In a real implementation, this would list actual packages
        const packagesText = `*Installed Packages*\n\n` +
            `• @whiskeysockets/baileys\n` +
            `• express\n` +
            `• node-cache\n` +
            `• sharp\n` +
            `• and more...\n\n` +
            `Total: ${Object.keys(require('../../package.json').dependencies || {}).length} packages`;
        
        await safeSendText(sock, jid, packagesText);
    },
    
    /**
     * Dependencies command to show dependencies
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    dependencies: async (sock, message) => {
        await basicCommands.packages(sock, message);
    },
    
    /**
     * Libraries command to show libraries
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    libraries: async (sock, message) => {
        await basicCommands.packages(sock, message);
    },
    
    /**
     * Modules command to show modules
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    modules: async (sock, message) => {
        const jid = message.key.remoteJid;
        
        // In a real implementation, this would list actual modules
        const modulesText = `*Bot Modules*\n\n` +
            `• Basic\n` +
            `• Admin\n` +
            `• Group\n` +
            `• Media\n` +
            `• Fun\n` +
            `• User\n` +
            `• Educational\n` +
            `• Utility\n` +
            `• And more...`;
        
        await safeSendText(sock, jid, modulesText);
    },
    
    /**
     * Categories command to show command categories
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    categories: async (sock, message) => {
        await basicCommands.modules(sock, message);
    },
    
    /**
     * Lang command to show available languages
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    lang: async (sock, message) => {
        const jid = message.key.remoteJid;
        const languages = languageManager.getAvailableLanguages();
        
        let langText = `*Available Languages*\n\n`;
        languages.forEach(lang => {
            langText += `• ${lang}\n`;
        });
        
        langText += `\nUse !language [code] to change language.`;
        
        await safeSendText(sock, jid, langText);
    },
    
    /**
     * Languages command to show available languages (alias)
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @returns {Promise<void>}
     */
    languages: async (sock, message) => {
        await basicCommands.lang(sock, message);
    },
    
    /**
     * Translate command to translate text
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @param {Array} args Command arguments
     * @returns {Promise<void>}
     */
    translate: async (sock, message, args) => {
        const jid = message.key.remoteJid;
        
        if (args.length < 2) {
            await safeSendText(sock, jid, `*Usage:* !translate [language_code] [text]\nExample: !translate es Hello world`);
            return;
        }
        
        const targetLang = args[0];
        const text = args.slice(1).join(' ');
        
        // In a real implementation, this would use a translation API
        await safeSendText(sock, jid, `Translation feature is available in the utility commands category.`);
    },
    
    /**
     * Trans command (alias for translate)
     * @param {Object} sock WhatsApp socket
     * @param {Object} message Message object
     * @param {Array} args Command arguments
     * @returns {Promise<void>}
     */
    trans: async (sock, message, args) => {
        await basicCommands.translate(sock, message, args);
    }
};

module.exports = {
    commands: basicCommands,
    category: 'basic',
    async init() {
        try {
            logger.info('Initializing basic command handler...');

            if (!proto) {
                throw new Error('Baileys proto not initialized');
            }

            logger.info('Basic command handler initialized successfully');
            return true;
        } catch (err) {
            logger.error('Error initializing basic command handler:', err);
            throw err;
        }
    }
};