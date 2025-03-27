/**
 * Test menu command full execution
 */

// Import the menu module
const menuModule = require('./src/commands/menu');
const logger = require('./src/utils/logger');

// Mock socket and message objects
const mockSock = {
    sendMessage: (jid, content) => {
        console.log(`\n======= MENU OUTPUT =======`);
        console.log(content.text);
        console.log(`==========================\n`);
        return Promise.resolve({ status: 1 });
    }
};

const mockMessage = {
    key: {
        remoteJid: '123456789@s.whatsapp.net'
    }
};

// Helper to check the menu command
async function testMenuCommand() {
    console.log("===== TESTING FULL MENU COMMAND =====");
    
    // Extract the menu command function
    const menuCommand = menuModule.commands.menu;
    
    // Verify it's a function
    if (typeof menuCommand !== 'function') {
        console.error("Error: menu command is not a function");
        return false;
    }
    
    console.log("Menu command is a function, executing...");
    
    try {
        // Execute the menu command
        await menuCommand(mockSock, mockMessage, []);
        return true;
    } catch (err) {
        console.error("Error executing menu command:", err);
        return false;
    }
}

// Run the test
testMenuCommand().then(result => {
    console.log(`Menu command test ${result ? 'completed successfully' : 'failed'}`);
    process.exit(0);
}).catch(err => {
    console.error("Unhandled error in test:", err);
    process.exit(1);
});