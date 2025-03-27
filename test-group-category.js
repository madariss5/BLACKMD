/**
 * Test script focused on the group.js module
 */

// Import the necessary modules
const groupModule = require('./src/commands/group');
const { standardizeCommandModule } = require('./src/utils/commandAdapter');
const logger = require('./src/utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Simple test of the group module
function testGroupModule() {
    console.log('===== TESTING GROUP MODULE =====');
    console.log('Group module type:', typeof groupModule);
    console.log('Group module keys:', Object.keys(groupModule));
    console.log('Group module category:', groupModule.category);
    console.log('Group commands type:', typeof groupModule.commands);
    console.log('Group commands keys:', Object.keys(groupModule.commands));
    console.log('Group commands count:', Object.keys(groupModule.commands).length);
    
    // Test standardization
    const standardized = standardizeCommandModule(groupModule, 'group');
    console.log('\nStandardized category:', standardized.category);
    console.log('Standardized commands count:', Object.keys(standardized.commands).length);
    
    return standardized;
}

// Test how menu's loadAllCommands would process group.js
async function testMenuLoadingOfGroup() {
    console.log('\n===== TESTING MENU LOADING OF GROUP COMMANDS =====');
    
    try {
        // Read the menu.js file to understand how it processes commands
        const menuJsPath = path.join(__dirname, 'src', 'commands', 'menu.js');
        const menuJsContent = await fs.readFile(menuJsPath, 'utf8');
        
        // Extract categoryEmojis and categoryNames for group
        const groupEmoji = '👥'; // Default emoji for group
        const groupName = 'Group Management'; // Default name for group
        
        console.log(`Group category emoji: ${groupEmoji}`);
        console.log(`Group category name: ${groupName}`);
        
        // Simulate the menu's command loading process for group.js
        const allCommands = {};
        const standardized = testGroupModule();
        
        // Use the same process as menu.js for loading commands
        if (standardized.commands) {
            const commandList = Object.keys(standardized.commands).filter(cmd => {
                return typeof standardized.commands[cmd] === 'function' && cmd !== 'init';
            });
            
            const category = standardized.category || 'group';
            
            console.log(`\nFiltered valid commands for '${category}': ${commandList.length}`);
            if (commandList.length > 0) {
                if (!allCommands[category]) {
                    allCommands[category] = [];
                }
                allCommands[category].push(...commandList);
                console.log(`Added ${commandList.length} commands to category '${category}'`);
            }
        }
        
        // Check the final result
        console.log('\n===== FINAL RESULT =====');
        for (const [category, commands] of Object.entries(allCommands)) {
            console.log(`Category '${category}' has ${commands.length} commands:`);
            console.log(commands);
        }
        
        return allCommands;
    } catch (error) {
        console.error('Error in testMenuLoadingOfGroup:', error);
        return {};
    }
}

// Run the test
async function runTest() {
    try {
        await testMenuLoadingOfGroup();
    } catch (error) {
        console.error('Test error:', error);
    }
}

runTest();