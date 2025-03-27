/**
 * Command Module Adapter
 * Helps standardize different command module formats for compatibility
 */

/**
 * Standardize command module to the modern format
 * @param {Object} module - The command module to standardize
 * @param {string} moduleName - Name of the module (for logging)
 * @returns {Object} - Standardized module with commands property
 */
function standardizeCommandModule(module, moduleName) {
    console.log(`\n[ADAPTER DEBUG] =========== BEGIN MODULE ${moduleName} ===========`);
    
    if (!module) {
        console.log(`[ADAPTER DEBUG] Module is null or undefined, returning empty commands object`);
        return { commands: {} };
    }
    
    console.log(`[ADAPTER DEBUG] Module type: ${typeof module}`);
    console.log(`[ADAPTER DEBUG] Module keys: ${Object.keys(module).join(', ')}`);
    console.log(`[ADAPTER DEBUG] Module has commands?: ${module.commands ? 'YES' : 'NO'}`);
    console.log(`[ADAPTER DEBUG] Module has category?: ${module.category ? 'YES: ' + module.category : 'NO'}`);
    
    // If module already has commands property in the right format, return it directly
    if (module.commands && typeof module.commands === 'object') {
        console.log(`[ADAPTER DEBUG] Module has commands object with keys: ${Object.keys(module.commands).join(', ')}`);
        console.log(`[ADAPTER DEBUG] Using existing commands structure`);
        return module;
    }
    
    const commands = {};
    
    // Case 1: Legacy format - module is directly an object with command handlers as properties
    if (typeof module === 'object') {
        console.log(`[ADAPTER DEBUG] Processing legacy format - object with command handlers`);
        // Convert direct properties to commands
        for (const [key, handler] of Object.entries(module)) {
            if (key === 'init' || key === 'config' || key === 'category') {
                console.log(`[ADAPTER DEBUG] Skipping special key: ${key}`);
                continue;
            }
            
            if (typeof handler === 'function') {
                commands[key] = handler;
                console.log(`[ADAPTER DEBUG] Added function as command: ${key}`);
            } else if (handler && typeof handler.execute === 'function') {
                commands[key] = handler.execute;
                console.log(`[ADAPTER DEBUG] Added execute function as command: ${key}`);
            }
        }
    }
    
    // Case 2: The module exports a single function
    if (typeof module === 'function') {
        // Use the filename (without extension) as the command name
        const commandName = moduleName.replace(/\.js$/i, '').split('/').pop().toLowerCase();
        commands[commandName] = module;
        console.log(`[ADAPTER DEBUG] Module is a function, created command: ${commandName}`);
    }
    
    console.log(`[ADAPTER DEBUG] Final extracted commands: ${Object.keys(commands).join(', ')}`);
    console.log(`[ADAPTER DEBUG] Total command count: ${Object.keys(commands).length}`);
    
    // Create a standardized module object
    const moduleCategory = module.category || getDefaultCategory(moduleName);
    console.log(`[ADAPTER DEBUG] Using category: ${moduleCategory} (module.category=${module.category}, default=${getDefaultCategory(moduleName)})`);
    
    const standardizedModule = { 
        commands, 
        standardized: true,
        category: moduleCategory
    };
    
    // Copy over any init functions or config if present
    if (typeof module.init === 'function') {
        standardizedModule.init = module.init;
    }
    
    if (module.config) {
        standardizedModule.config = module.config;
    }
    
    return standardizedModule;
}

/**
 * Get a default category for a module based on its file path
 * @param {string} moduleName - The module's file path
 * @returns {string} - A default category
 */
function getDefaultCategory(moduleName) {
    // Extract the directory name as category
    const parts = moduleName.split('/');
    if (parts.length >= 2) {
        return parts[parts.length - 2]; // Parent directory name
    }
    return 'misc'; // Default category
}

/**
 * Get all commands from a standardized module
 * @param {Object} module - The command module
 * @param {string} moduleName - Name of the module
 * @returns {Object} - Object containing all commands
 */
function extractCommands(module, moduleName) {
    const standardized = standardizeCommandModule(module, moduleName);
    return standardized.commands || {};
}

/**
 * Count valid commands in a module
 * @param {Object} module - The command module
 * @param {string} moduleName - Name of the module
 * @returns {number} - Number of valid commands
 */
function countCommands(module, moduleName) {
    return Object.keys(extractCommands(module, moduleName)).length;
}

/**
 * Create a skeleton command module structure for new modules
 * @param {string} commandName - The primary command name
 * @param {string} category - The command category
 * @returns {string} - JavaScript code for the module
 */
function createCommandModuleTemplate(commandName, category = 'misc') {
    return `/**
 * ${commandName.charAt(0).toUpperCase() + commandName.slice(1)} Command Module
 * Category: ${category}
 */

/**
 * Execute the ${commandName} command
 * @param {Object} sock - The WhatsApp socket connection
 * @param {Object} message - The message object
 * @param {Array} args - Command arguments
 */
async function ${commandName}Command(sock, message, args) {
    // Get the chat ID
    const jid = message.key.remoteJid;
    
    // Send a response
    await sock.sendMessage(jid, { text: "Hello! This is the ${commandName} command." });
}

// Export command module with standard structure
module.exports = {
    // Define commands that this module provides
    commands: {
        ${commandName}: ${commandName}Command
    },
    
    // Optional: Category for organizing commands
    category: "${category}"
};
`;
}

module.exports = {
    standardizeCommandModule,
    extractCommands,
    countCommands,
    createCommandModuleTemplate,
    getDefaultCategory
};