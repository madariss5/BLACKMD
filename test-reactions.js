/**
 * Test script for reaction GIFs
 * This script tests all the reaction commands and their associated GIFs
 */

const fs = require('fs');
const path = require('path');

// Path to reaction GIFs directory
const ASSETS_DIR = path.join(process.cwd(), 'attached_assets');

// Define all reaction commands to test
const REACTION_COMMANDS = [
    // Self-reactions
    'smile', 'happy', 'dance', 'cry', 'blush', 'laugh',
    
    // Target-reactions
    'hug', 'pat', 'kiss', 'cuddle', 'wave', 'wink', 'poke', 'slap', 
    'bonk', 'bite', 'punch', 'highfive', 'yeet', 'kill',
    
    // New reaction commands
    'fuck', 'horny',
    
    // Additional reactions
    'angry', 'bored', 'confused', 'cool', 'scared', 'shy', 'sleepy', 
    'surprised', 'tired', 'disgusted', 'excited', 'facepalm', 'greedy', 
    'hungry', 'jealous', 'nervous', 'panic', 'proud', 'sad', 'shock'
];

// Check if all GIFs exist and they're not symlinks
function checkReactionGifs() {
    console.log('Checking reaction GIFs...\n');
    console.log('================================');
    
    let allPassed = true;
    let notFoundCount = 0;
    let symlinkCount = 0;
    
    for (const command of REACTION_COMMANDS) {
        const gifPath = path.join(ASSETS_DIR, `${command}.gif`);
        let status = '✅'; // Default: success
        let details = '';
        
        if (!fs.existsSync(gifPath)) {
            status = '❌';
            details = 'Not found!';
            notFoundCount++;
            allPassed = false;
        } else {
            try {
                const stats = fs.lstatSync(gifPath);
                if (stats.isSymbolicLink()) {
                    const linkTarget = fs.readlinkSync(gifPath);
                    status = '⚠️';
                    details = `Symlink to ${linkTarget}`;
                    symlinkCount++;
                    allPassed = false;
                } else {
                    // Check file size
                    if (stats.size < 5000) {
                        status = '⚠️';
                        details = `Small file (${stats.size} bytes)`;
                        allPassed = false;
                    } else {
                        details = `${Math.round(stats.size / 1024)} KB`;
                    }
                }
            } catch (err) {
                status = '❓';
                details = `Error: ${err.message}`;
                allPassed = false;
            }
        }
        
        console.log(`${status} ${command.padEnd(10)} - ${details}`);
    }
    
    console.log('================================');
    console.log(`Total commands: ${REACTION_COMMANDS.length}`);
    console.log(`Missing GIFs: ${notFoundCount}`);
    console.log(`Symlinked GIFs: ${symlinkCount}`);
    
    if (allPassed) {
        console.log('\n✅ All reaction GIFs are present and unique!');
    } else {
        console.log('\n⚠️ Some reaction GIFs need attention.');
    }
}

// Run the check
checkReactionGifs();