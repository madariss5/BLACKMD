/**
 * Command Tester Script
 * Lists all commands loaded in the system 
 */

// Import all command modules
const commands = require('./src/commands');
console.log('\n=== LOADED COMMANDS IN THE SYSTEM ===');

// Check if owner commands include ban
const ownerCommands = require('./src/commands/owner');
console.log('\n=== OWNER COMMANDS ===');
console.log('Owner module type:', typeof ownerCommands);
console.log('Owner module keys:', Object.keys(ownerCommands));

if (ownerCommands.commands) {
    console.log('Owner commands:', Object.keys(ownerCommands.commands));
    console.log('Ban command exists:', ownerCommands.commands.ban ? '✓ YES' : '❌ NO');
} else {
    console.log('Owner commands not found in the expected format');
}

// Check all commands
console.log('\n=== ALL COMMANDS ===');
const allCommandNames = Object.keys(commands);
console.log(`Total commands loaded: ${allCommandNames.length}`);
console.log('Command list:', allCommandNames.sort().join(', '));
console.log('Ban command in global list:', allCommandNames.includes('ban') ? '✓ YES' : '❌ NO');

// Check command standardization
const { standardizeCommandModule } = require('./src/utils/commandAdapter');
console.log('\n=== STANDARDIZING OWNER COMMANDS ===');
const standardizedOwner = standardizeCommandModule(ownerCommands, 'owner');
console.log('Standardized owner commands:', Object.keys(standardizedOwner.commands));
console.log('Ban command in standardized list:', Object.keys(standardizedOwner.commands).includes('ban') ? '✓ YES' : '❌ NO');