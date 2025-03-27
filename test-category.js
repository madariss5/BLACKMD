/**
 * Script to test category assignment for group commands
 */

// Import the necessary modules
const groupCommands = require('./src/commands/group');
const { standardizeCommandModule } = require('./src/utils/commandAdapter');
const logger = require('./src/utils/logger');

// Function to test standardization of a module
function testStandardization(module, name) {
    console.log(`\n===== TESTING STANDARDIZATION OF ${name} =====`);
    
    // Print raw module properties
    console.log('Raw module keys:', Object.keys(module));
    console.log('Raw module category:', module.category);
    console.log('Raw module commands type:', typeof module.commands);
    console.log('Raw module commands keys:', module.commands ? Object.keys(module.commands) : 'N/A');
    
    // Standardize and check the result
    const standardized = standardizeCommandModule(module, name);
    console.log('\nStandardized module keys:', Object.keys(standardized));
    console.log('Standardized module category:', standardized.category);
    console.log('Standardized module commands type:', typeof standardized.commands);
    console.log('Standardized module command count:', 
                standardized.commands ? Object.keys(standardized.commands).length : 0);
    
    // Print some sample commands
    if (standardized.commands) {
        const commandKeys = Object.keys(standardized.commands);
        if (commandKeys.length > 0) {
            const sampleKeys = commandKeys.slice(0, Math.min(5, commandKeys.length));
            console.log('Sample command keys:', sampleKeys);
        }
    }
    
    console.log('========================================\n');
    return standardized;
}

// Main function
async function main() {
    try {
        // Test group commands standardization
        const standardizedGroup = testStandardization(groupCommands, 'group');
        
        // Count commands by type
        let functionCount = 0;
        let nonFunctionCount = 0;
        if (standardizedGroup.commands) {
            for (const key of Object.keys(standardizedGroup.commands)) {
                if (typeof standardizedGroup.commands[key] === 'function') {
                    functionCount++;
                } else {
                    nonFunctionCount++;
                    console.log(`Non-function command: ${key} (${typeof standardizedGroup.commands[key]})`);
                }
            }
        }
        console.log(`Function commands: ${functionCount}, Non-function commands: ${nonFunctionCount}`);
        
        // Simulate menu's loadAllCommands process with group commands
        console.log('\n===== SIMULATING MENU COMMAND LOADING =====');
        
        // Create a test structure
        const allCommands = {};
        const category = standardizedGroup.category || 'group';
        
        if (standardizedGroup.commands) {
            const commandList = Object.keys(standardizedGroup.commands).filter(cmd => {
                return typeof standardizedGroup.commands[cmd] === 'function' && cmd !== 'init';
            });
            
            console.log(`Found ${commandList.length} valid commands for category '${category}'`);
            
            if (commandList.length > 0) {
                if (!allCommands[category]) {
                    allCommands[category] = [];
                    console.log(`Created new category array for: ${category}`);
                }
                allCommands[category].push(...commandList);
                console.log(`Added ${commandList.length} commands to '${category}' category`);
            }
        }
        
        // Print the result
        console.log('\nFinal allCommands object categories:', Object.keys(allCommands));
        for (const cat in allCommands) {
            console.log(`Category '${cat}' has ${allCommands[cat].length} commands: ${allCommands[cat].join(', ')}`);
        }
        
    } catch (error) {
        console.error('Error in test:', error);
    }
}

// Run the test
main();