/**
 * Test script to debug menu's loadAllCommands function
 */

// Import the necessary modules
const fs = require('fs').promises;
const path = require('path');
const logger = require('./src/utils/logger');
const { standardizeCommandModule } = require('./src/utils/commandAdapter');

// Function to simulate menu's loadAllCommands
async function testLoadAllCommands() {
    console.log('===== TESTING MENU COMMAND LOADING =====');
    
    try {
        // Structure to store all commands by category
        const allCommands = {};
        let totalCommands = 0;
        
        // Track stats for debugging
        const categoryStats = {};
        
        // Get all JS files in the commands directory
        const commandDir = path.join(__dirname, 'src', 'commands');
        console.log(`Scanning directory: ${commandDir}`);
        
        const files = await fs.readdir(commandDir);
        console.log(`Found ${files.length} files in directory`);
        
        // Filter for JS files
        const jsFiles = files.filter(file => file.endsWith('.js') && !file.startsWith('._'));
        console.log(`Found ${jsFiles.length} JavaScript files`);
        
        // Process each command file
        for (const file of jsFiles) {
            const fileName = file;
            const filePath = path.join(commandDir, file);
            
            console.log(`\nProcessing file: ${fileName}`);
            
            try {
                // Load the module
                const commandModule = require(filePath);
                
                // Check if the module has a valid structure
                if (commandModule) {
                    console.log(`Module loaded successfully: ${typeof commandModule}`);
                    console.log(`Module keys: ${Object.keys(commandModule).join(', ')}`);
                    
                    // Get the category from the module
                    const category = commandModule.category || fileName.replace('.js', '');
                    console.log(`Category for ${fileName}: ${category}`);
                    
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
                    
                    // Standardize the module format
                    const standardized = standardizeCommandModule(commandModule, fileName);
                    
                    if (standardized.commands && typeof standardized.commands === 'object') {
                        console.log(`Commands object found with keys: ${Object.keys(standardized.commands).join(', ')}`);
                        
                        // Extract valid command functions
                        const commands = standardized.commands;
                        const commandList = Object.keys(commands).filter(cmd => {
                            try {
                                return typeof commands[cmd] === 'function' && cmd !== 'init';
                            } catch (e) {
                                console.error(`Error accessing command ${cmd} in ${file}:`, e);
                                return false;
                            }
                        });
                        
                        console.log(`Valid commands in ${fileName}: ${commandList.length}`);
                        
                        if (commandList.length > 0) {
                            if (!allCommands[category]) {
                                allCommands[category] = [];
                                console.log(`Created new category array for: ${category}`);
                            }
                            
                            allCommands[category].push(...commandList);
                            totalCommands += commandList.length;
                            categoryStats[category].commandCount += commandList.length;
                            console.log(`Added ${commandList.length} commands from ${category} (${fileName})`);
                            
                            // If this is the group category, list the specific commands
                            if (category === 'group') {
                                console.log(`GROUP COMMANDS: ${commandList.join(', ')}`);
                            }
                        } else {
                            console.log(`No valid commands found in ${fileName}`);
                        }
                    } else {
                        console.log(`Module in ${fileName} doesn't contain a valid commands object`);
                    }
                } else {
                    console.error(`Failed to load module: ${fileName}`);
                }
            } catch (err) {
                console.error(`Error loading commands from ${file}:`, err);
            }
        }
        
        // Print category statistics
        console.log('\n===== CATEGORY LOADING STATISTICS =====');
        for (const [category, stats] of Object.entries(categoryStats)) {
            console.log(`Category [${category}]: ${stats.commandCount} commands from ${stats.fileCount} files`);
            console.log(`Files: ${stats.files.join(', ')}`);
        }
        
        // Print all categories and their commands
        console.log('\n===== ALL COMMANDS BY CATEGORY =====');
        for (const [category, commands] of Object.entries(allCommands)) {
            console.log(`Category: ${category}, Commands: ${commands.length}`);
            if (commands.length > 0) {
                console.log(`  ${commands.join(', ')}`);
            }
            
            // Special focus on group and group_new categories
            if (category === 'group' || category === 'group_new') {
                console.log(`\n===> DETAIL FOR ${category.toUpperCase()} CATEGORY:`);
                console.log(`  Command count: ${commands.length}`);
                console.log(`  Commands: ${commands.join(', ')}`);
            }
        }
        
        console.log(`\nTotal commands loaded: ${totalCommands}`);
        console.log('===== END OF TEST =====');
        
        return { allCommands, totalCommands };
    } catch (err) {
        console.error('Error in testLoadAllCommands:', err);
        return { allCommands: {}, totalCommands: 0 };
    }
}

// Run the test
testLoadAllCommands().catch(console.error);