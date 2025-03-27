/**
 * Test specific commands to verify their existence and operation
 */

// Import the command handler which processes all commands
const commandHandler = require('./src/core/commandHandler');
const logger = require('./src/utils/logger');

// Direct access to command modules for testing
const groupModule = require('./src/commands/group');
const groupNewModule = require('./src/commands/group_new');
const allCommands = require('./src/commands');

// Test function to examine a specific command module
function examineModule(moduleName, module) {
    console.log(`\n===== EXAMINING ${moduleName.toUpperCase()} MODULE =====`);
    console.log(`Module type: ${typeof module}`);
    console.log(`Module keys: ${Object.keys(module).join(', ')}`);
    
    // Check category
    if (module.category) {
        console.log(`Category: ${module.category}`);
    } else {
        console.log('NO CATEGORY DEFINED');
    }
    
    // Check commands object
    if (module.commands) {
        const commandKeys = Object.keys(module.commands);
        console.log(`Commands object found with ${commandKeys.length} keys`);
        console.log(`Command keys: ${commandKeys.join(', ')}`);
        
        // Check if commands are functions
        const functionCommands = commandKeys.filter(key => typeof module.commands[key] === 'function');
        console.log(`Function commands: ${functionCommands.length}`);
        console.log(`Function command keys: ${functionCommands.join(', ')}`);
    } else {
        console.log('NO COMMANDS OBJECT FOUND');
    }
}

// Test if a command exists in the merged commands object
function testCommandExistence(commandName, expectedModule) {
    console.log(`\n===== TESTING COMMAND: ${commandName} =====`);
    
    // Check in all commands
    const commandExists = typeof allCommands.commands[commandName] === 'function';
    console.log(`Command '${commandName}' exists in allCommands: ${commandExists}`);
    
    // Check source module
    if (expectedModule && expectedModule.commands) {
        const existsInModule = typeof expectedModule.commands[commandName] === 'function';
        console.log(`Command '${commandName}' exists in original module: ${existsInModule}`);
    }
    
    return commandExists;
}

// Test the group commands that should be available
function testGroupCommands() {
    console.log('\n===== TESTING GROUP COMMANDS =====');
    
    // Examine the modules directly
    examineModule('group', groupModule);
    examineModule('group_new', groupNewModule);
    
    // Test specific commands from each module
    console.log('\n--- GROUP COMMAND TESTS ---');
    const groupTestCommands = ['everyone', 'kick', 'promote', 'demote', 'antispam'];
    for (const cmd of groupTestCommands) {
        testCommandExistence(cmd, groupModule);
    }
    
    console.log('\n--- GROUP_NEW COMMAND TESTS ---');
    const groupNewTestCommands = ['pin', 'unpin', 'pins'];
    for (const cmd of groupNewTestCommands) {
        testCommandExistence(cmd, groupNewModule);
    }
    
    // List all commands mapped by commandHandler
    console.log('\n===== COMMAND HANDLER STATE =====');
    if (commandHandler.getCommandMap) {
        const cmdMap = commandHandler.getCommandMap();
        console.log(`Command map contains ${Object.keys(cmdMap).length} commands`);
        
        // Specifically check for group commands in the map
        const groupCmds = groupTestCommands.filter(cmd => cmdMap[cmd]);
        console.log(`Group commands in map: ${groupCmds.length}/${groupTestCommands.length}`);
        console.log(`Group commands found: ${groupCmds.join(', ')}`);
        
        // Check for group_new commands in the map
        const groupNewCmds = groupNewTestCommands.filter(cmd => cmdMap[cmd]);
        console.log(`Group_new commands in map: ${groupNewCmds.length}/${groupNewTestCommands.length}`);
        console.log(`Group_new commands found: ${groupNewCmds.join(', ')}`);
    } else {
        console.log('Command handler does not expose a getCommandMap method');
    }
}

// Run all tests
function runAllTests() {
    console.log('===== STARTING COMMAND TESTS =====');
    testGroupCommands();
    console.log('\n===== TESTS COMPLETED =====');
}

// Execute tests
runAllTests();