/**
 * Modern WhatsApp MD Bot Menu System
 */

const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Emoji mapping for categories
const categoryEmojis = {
    'owner': '👑',
    'basic': '🧩',
    'educational': '📚',
    'fun': '🎮',
    'group': '👥',
    'media': '📽️',
    'nsfw': '🔞',
    'reactions': '💫',
    'user': '👤',
    'user_extended': '👨‍💼',
    'utility': '🛠️',
    'group_new': '👥',
    'menu': '📋',
    'admin': '🛡️',
    'debug': '🔍',
    'fun_extended': '🎯',
    'termux': '📱',
    'system': '⚙️',
    'test': '🧪',
    'main': '🔝',
    'default': '📄'
};

// Pretty names for categories
const categoryNames = {
    'owner': 'Owner Commands',
    'owner_extended': 'Extended Owner Commands',
    'basic': 'Basic',
    'admin': 'Admin Commands',
    'debug': 'Debugging',
    'educational': 'Educational',
    'fun': 'Fun & Games',
    'fun_extended': 'More Fun & Games',
    'group': 'Group Management',
    'group_new': 'Group Advanced',
    'media': 'Media Tools',
    'nsfw': 'NSFW',
    'reactions': 'Reactions',
    'system': 'System',
    'termux': 'Termux',
    'test': 'Testing',
    'user': 'User Profile',
    'user_extended': 'Extended Profile',
    'utility': 'Utilities',
    'main': 'Main',
    'menu': 'Menu System',
    'default': 'Misc'
};

// Import necessary utilities
const { safeSendText, safeSendMessage, safeSendImage, safeSendGroupMessage } = require('../utils/jidHelper');

// Symbols for menu formatting
const symbols = {
    arrow: "➣",
    bullet: "•",
    star: "✦",
    dot: "·"
};

// Cache for command loading
// Enhanced caching system with retry and fallback mechanism
let commandCache = null;
let commandCacheTimestamp = 0;
let cacheLoadAttempts = 0;
const CACHE_LIFETIME = 300000; // 5 minutes in milliseconds
const MAX_CACHE_LOAD_ATTEMPTS = 3; // Maximum number of consecutive failed attempts before forcing cache refresh

// Load all commands from command files with caching
async function loadAllCommands() {
    try {
        // Check if we have a valid cache
        const now = Date.now();

        // Use cache if it exists and hasn't expired
        if (commandCache && now - commandCacheTimestamp < CACHE_LIFETIME) {
            logger.info('Using cached commands list');
            return commandCache;
        }

        // Cache expired or doesn't exist, perform fresh load with better error handling
        logger.info('Loading fresh commands list');

        const commandsPath = path.join(process.cwd(), 'src/commands');
        const allCommands = {};
        let totalCommands = 0;

        // Get command files directly from commands directory (non-recursive)
        let commandFiles = [];
        try {
            // First try to get all files in the main commands directory
            const entries = await fs.readdir(commandsPath, { withFileTypes: true });

            // Process each entry
            for (const entry of entries) {
                const fullPath = path.join(commandsPath, entry.name);

                if (entry.isFile() && entry.name.endsWith('.js')) {
                    // Add JS files directly
                    commandFiles.push(fullPath);
                } else if (entry.isDirectory()) {
                    // For directories, try to get JS files inside
                    try {
                        const subEntries = await fs.readdir(fullPath, { withFileTypes: true });
                        for (const subEntry of subEntries) {
                            if (subEntry.isFile() && subEntry.name.endsWith('.js')) {
                                commandFiles.push(path.join(fullPath, subEntry.name));
                            }
                        }
                    } catch (dirErr) {
                        logger.error(`Error reading subdirectory ${fullPath}:`, dirErr);
                    }
                }
            }

            logger.info(`Found ${commandFiles.length} potential command files`);
        } catch (err) {
            logger.error(`Error reading commands directory:`, err);
            // Still attempt to continue with any known files
        }

        // Fallback: If no files found, use the existing cache or create a minimal one
        if (commandFiles.length === 0) {
            logger.warn('No command files found, using fallback');
            if (commandCache) {
                return commandCache;
            } else {
                return {
                    allCommands: {
                        'basic': ['menu', 'help'],
                        'utility': ['ping']
                    },
                    totalCommands: 3
                };
            }
        }

        // Process each command file with error isolation
        logger.info(`=== Command Loading Debug Information ===`);
        logger.info(`Starting to process ${commandFiles.length} command files`);

        // Track category statistics
        const categoryStats = {};

        // Enhanced group commands debugging
        let groupFileFound = false;
        let groupNewFileFound = false;

        for (const file of commandFiles) {
            const fileName = path.basename(file);
            const dirName = path.basename(path.dirname(file));

            // Track special files for debugging
            if (fileName === 'group.js') {
                groupFileFound = true;
                console.log(`FOUND GROUP.JS: ${file}`);
            } else if (fileName === 'group_new.js') {
                groupNewFileFound = true;
                console.log(`FOUND GROUP_NEW.JS: ${file}`);
            }

            // Skip index.js and the current menu.js
            if (fileName === 'index.js' || fileName === 'menu.js') {
                logger.debug(`Skipping special file: ${fileName}`);
                continue;
            }

            logger.debug(`Processing command file: ${fileName} from directory: ${dirName}`);

            try {
                // Get module data with careful error handling
                const moduleData = require(file);

                // Check if module has a defined category
                const moduleCategory = moduleData.category;

                // Determine category from directory or filename or module definition
                let category = moduleCategory || path.basename(path.dirname(file));
                if (category === 'commands') {
                    category = path.basename(file, '.js');
                }

                // Enhanced debugging for group files
                if (fileName === 'group.js' || category === 'group') {
                    console.log(`GROUP FILE DEBUG: ${fileName} has category=${category}, moduleCategory=${moduleCategory}`);
                    console.log(`GROUP MODULE KEYS:`, Object.keys(moduleData));

                    if (moduleData.commands) {
                        console.log(`GROUP COMMANDS FOUND: ${Object.keys(moduleData.commands).length} commands`);
                        console.log(`FIRST FEW COMMANDS:`, Object.keys(moduleData.commands).slice(0, 5));
                    } else {
                        console.log(`WARNING: GROUP COMMANDS NOT FOUND IN MODULE`);
                    }
                }

                logger.debug(`Determined category for ${fileName}: ${category} ${moduleCategory ? '(from module.category)' : '(from path)'}`);

                // Get commands with proper validation
                let commands = moduleData.commands || moduleData;

                // Initialize category stats
                if (!categoryStats[category]) {
                    categoryStats[category] = {
                        fileCount: 0,
                        commandCount: 0,
                        files: []
                    };
                }
                categoryStats[category].fileCount++;
                categoryStats[category].files.push(fileName);

                if (typeof commands === 'object') {
                    // Filter valid commands with error checking
                    const commandList = Object.keys(commands).filter(cmd => {
                        try {
                            return typeof commands[cmd] === 'function' && cmd !== 'init';
                        } catch (e) {
                            logger.error(`Error accessing command ${cmd} in ${file}:`, e);
                            return false;
                        }
                    });

                    logger.debug(`File ${fileName} contains ${commandList.length} valid commands: ${commandList.join(', ')}`);

                    if (commandList.length > 0) {
                        if (!allCommands[category]) {
                            allCommands[category] = [];
                            logger.debug(`Created new category array for: ${category}`);
                        }

                        // Extra logging for group commands
                        if (category === 'group') {
                            console.log(`ADDING ${commandList.length} GROUP COMMANDS TO MENU:`, commandList);

                            // Make sure they're added to allCommands
                            if (!allCommands.group) {
                                allCommands.group = [];
                                console.log(`CREATED MISSING GROUP CATEGORY IN ALLCOMMANDS`);
                            }
                        }

                        allCommands[category].push(...commandList);
                        totalCommands += commandList.length;
                        categoryStats[category].commandCount += commandList.length;
                        logger.info(`Loaded ${commandList.length} commands from ${category} (${fileName})`);
                    } else {
                        logger.debug(`No valid commands found in ${fileName}`);
                    }
                } else {
                    logger.debug(`Module in ${fileName} doesn't contain a valid commands object`);
                }
            } catch (err) {
                logger.error(`Error loading commands from ${file}:`, err);
                if (fileName === 'group.js') {
                    console.error(`CRITICAL ERROR LOADING GROUP.JS:`, err);
                }
            }
        }

        // Report on group files specifically
        console.log(`GROUP FILES SUMMARY: group.js found=${groupFileFound}, group_new.js found=${groupNewFileFound}`);

        if (allCommands.group) {
            console.log(`FINAL GROUP COMMANDS COUNT: ${allCommands.group.length}`);
        } else {
            console.log(`WARNING: NO GROUP COMMANDS LOADED IN FINAL STRUCTURE`);

            // Add a forced group category entry if missing
            // This is for troubleshooting, to see if menu rendering works
            allCommands.group = ['everyone', 'kick', 'promote', 'demote', 'mute'];
            console.log(`ADDED FORCED GROUP COMMANDS FOR TESTING`);
        }

        // Log category statistics
        logger.info(`=== Category Loading Statistics ===`);
        for (const [category, stats] of Object.entries(categoryStats)) {
            logger.info(`Category [${category}]: ${stats.commandCount} commands from ${stats.fileCount} files`);
            logger.debug(`Category [${category}] files: ${stats.files.join(', ')}`);
        }

        // Also check the index.js for additional commands
        try {
            const indexCommands = require('./index').commands;
            if (indexCommands && typeof indexCommands === 'object') {
                const mainCommands = Object.keys(indexCommands).filter(cmd => {
                    try {
                        return typeof indexCommands[cmd] === 'function' && cmd !== 'init';
                    } catch (e) {
                        logger.error(`Error accessing command ${cmd} in index.js:`, e);
                        return false;
                    }
                });

                if (mainCommands.length > 0) {
                    if (!allCommands['main']) {
                        allCommands['main'] = [];
                    }
                    allCommands['main'].push(...mainCommands);
                    totalCommands += mainCommands.length;
                    logger.info(`Loaded ${mainCommands.length} commands from index.js`);
                }
            }
        } catch (err) {
            logger.error('Error loading commands from index.js:', err);
        }

        logger.info(`Total commands loaded: ${totalCommands} from ${Object.keys(allCommands).length} categories`);

        // Only update cache if we loaded some commands
        if (totalCommands > 0) {
            // Update cache
            commandCache = { allCommands, totalCommands };
            commandCacheTimestamp = now;
            cacheLoadAttempts = 0; // Reset counter on success
            logger.info(`Command cache updated successfully with ${totalCommands} commands`);
        } else {
            logger.warn(`Not updating command cache: found 0 commands (potential error)`);
            // Keep old cache if available
            if (!commandCache) {
                // If no cache exists, create minimal fallback
                logger.info(`Creating minimal fallback command cache`);
                commandCache = {
                    allCommands: {
                        'menu': ['menu', 'help'],
                        'basic': ['ping', 'info']
                    },
                    totalCommands: 4
                };
                commandCacheTimestamp = now;
            }
        }

        return commandCache;
    } catch (err) {
        logger.error('Error loading commands:', err);

        // When an error occurs, increment attempt counter
        cacheLoadAttempts++;

        // Fallback to existing cache if available
        if (commandCache) {
            logger.warn(`Using previous command cache as fallback after error (attempt ${cacheLoadAttempts})`);
            return commandCache;
        }

        // Create minimal fallback cache if no existing cache
        logger.info(`Creating minimal fallback command cache after error`);
        return {
            allCommands: {
                'menu': ['menu', 'help'],
                'basic': ['ping', 'info']
            },
            totalCommands: 4
        };
    }
}

// Cache for images and GIFs
const imageCache = new Map();
const IMAGE_CACHE_LIFETIME = 300000; // 5 minutes in milliseconds

/**
 * Optimized helper function to send menu message with image or GIF
 * Uses caching to avoid repeated filesystem access
 */
// Pre-buffer some common icons and images for ultra-fast access
const imageBuffer = {};

/**
 * Ultra-optimized helper function to send menu message with text-only responses
 * Avoids image loading completely for maximum speed and reliability
 */
async function sendMenuWithMedia(sock, jid, text) {
    try {
        // ULTRA-FAST OPTIMIZATION: Skip all image handling and go straight to text
        // This completely avoids the metadata error and provides instant responses

        // Send header text with emoji for a nice appearance without images
        const headerText = `*🤖 BLACKSKY-MD BOT*\n\n`;

        // Combine header and main text for a clean presentation
        await safeSendMessage(sock, jid, {
            text: headerText + text
        });

        logger.info(`Menu sent with ultra-fast text-only mode for maximum performance`);
        return true;
    } catch (err) {
        // Ultra-minimal error handling to ensure message is sent
        logger.error(`Error in sendMenuWithMedia: ${err.message}`);
        try {
            // Always fall back to bare text as ultimate reliability measure
            await safeSendText(sock, jid, text);
            logger.info(`Menu sent as text only (error fallback)`);
            return true;
        } catch (finalErr) {
            logger.error(`Critical failure sending menu: ${finalErr.message}`);
            return false;
        }
    }
}


// Added functionality moved to the top of the file

module.exports = {
    name: 'menu',
    category: 'system',
    description: 'Display list of available commands',
    commands: {
        menu: async (sock, message, args) => {
            try {
                // Load all commands dynamically from command files
                const { allCommands, totalCommands } = await loadAllCommands();

                // Debug: Log all categories and their commands
                console.log("\n=== DEBUG: MENU COMMAND CATEGORIES ===");
                const allCategories = Object.keys(allCommands);
                console.log(`ALL CATEGORIES (${allCategories.length}): ${allCategories.join(', ')}`);

                // Focus especially on group categories
                console.log("\n=== DETAILED DEBUG FOR GROUP CATEGORIES ===");
                const hasGroup = allCommands.hasOwnProperty('group');
                const hasGroupNew = allCommands.hasOwnProperty('group_new');
                console.log(`Has 'group' category: ${hasGroup}`);
                console.log(`Has 'group_new' category: ${hasGroupNew}`);

                // Log all categories and their commands
                for (const [category, commands] of Object.entries(allCommands)) {
                    console.log(`Category: ${category}, Commands: ${commands.length}`, commands);

                    // Specifically check for group category
                    if (category === 'group') {
                        console.log(`DETAIL: GROUP COMMANDS = ${commands.length} found: ${commands.join(', ')}`);
                    }
                    if (category === 'group_new') {
                        console.log(`DETAIL: GROUP_NEW COMMANDS = ${commands.length} found: ${commands.join(', ')}`);
                    }
                }
                console.log("=== END DEBUG ===");

                // Header for the menu
                let menuText = '🤖 *BLACKSKY BOT MENU* 🤖\n\n';

                // Log all available categories with more detail
                console.log("Available categories:", Object.keys(allCommands).join(", "));
                logger.info(`[Menu] Found ${Object.keys(allCommands).length} categories with commands`);

                // Debug: Check if we have emojis and names for all categories
                for (const category in allCommands) {
                    const hasEmoji = categoryEmojis[category] !== undefined;
                    const hasName = categoryNames[category] !== undefined;
                    if (!hasEmoji || !hasName) {
                        logger.warn(`[Menu] Category '${category}' missing ${!hasEmoji ? 'emoji' : ''}${(!hasEmoji && !hasName) ? ' and ' : ''}${!hasName ? 'name' : ''}`);
                    }
                }

                // Enhanced debugging: Log all available categories first
                console.log("=================== MENU CATEGORY DEBUG ===================");
                console.log("All emojis:", Object.keys(categoryEmojis).join(", "));
                console.log("All pretty names:", Object.keys(categoryNames).join(", "));
                console.log("All loaded categories:", Object.keys(allCommands).join(", "));
                console.log("==========================================================");

                // Use a predefined order for categories to ensure consistent display
                const orderedCategories = [
                    'owner', 'basic', 'utility', 'group', 'media',
                    'fun', 'fun_extended', 'reactions', 'user', 'user_extended',
                    'educational', 'nsfw', 'menu', 'group_new', 'admin',
                    'debug', 'termux', 'system', 'test', 'main'
                ];

                // Filter ordered categories to only include those with commands
                // If a category is found that isn't in our ordered list, we'll append it at the end
                const sortedCategories = [];

                // First add all predefined categories that exist in allCommands
                for (const category of orderedCategories) {
                    if (allCommands[category] && allCommands[category].length > 0) {
                        sortedCategories.push(category);
                    }
                }

                // Then add any categories that might exist but aren't in our predefined list
                for (const category of Object.keys(allCommands).sort()) {
                    if (!orderedCategories.includes(category) && allCommands[category] && allCommands[category].length > 0) {
                        sortedCategories.push(category);
                    }
                }

                console.log("Ordered categories:", sortedCategories.join(", "));

                // Add each category and its commands
                for (const category of sortedCategories) {
                    // Skip categories with no commands
                    if (!allCommands[category] || allCommands[category].length === 0) {
                        console.log(`Skipping empty category: ${category}`);
                        continue;
                    }

                    // Log category information for debugging
                    console.log(`Processing category: ${category} with ${allCommands[category].length} commands`);
                    logger.info(`[Menu] Processing category: ${category} with ${allCommands[category].length} commands`);

                    // Get the emoji and pretty name for this category with detailed logging
                    const emoji = categoryEmojis[category] || categoryEmojis['default'];
                    const prettyName = categoryNames[category] || category.toUpperCase();

                    console.log(`Category ${category}: Using emoji=${emoji}, name=${prettyName}`);

                    // Add category header with better formatting
                    menuText += `\n${emoji} *${prettyName.toUpperCase()} COMMANDS*\n`;

                    // Add each command in this category
                    for (const command of allCommands[category]) {
                        menuText += `• .${command}\n`;
                    }

                    menuText += '\n';
                }

                // Add footer
                menuText += `📌 Use *.help <command>* for details`;

                // Send the menu
                await safeSendMessage(sock, message.key.remoteJid, { text: menuText });
                logger.info(`Menu sent with ${totalCommands} commands from ${Object.keys(allCommands).length} categories`);
                return true;
            } catch (err) {
                logger.error('Menu command error:', err);
                try {
                    // Fallback to basic menu if dynamic loading fails
                    const basicMenuText = '🤖 *BLACKSKY BOT MENU* 🤖\n\n' +
                        '📚 *BASIC COMMANDS*\n' +
                        '• .menu - Show this menu\n' +
                        '• .help - Get command help\n' +
                        '• .ping - Check bot response\n\n' +
                        '📌 Use *.help <command>* for details\n\n' +
                        '⚠️ Full menu is currently unavailable';

                    await safeSendMessage(sock, message.key.remoteJid, { text: basicMenuText });
                    return true;
                } catch (fallbackErr) {
                    logger.error('Critical menu error:', fallbackErr);
                    return false;
                }
            }
        }
    }
};