/**
 * Complete WhatsApp Session Reset
 * - Creates a backup of all existing auth data
 * - Cleans out auth_info_baileys directory except for creds.json
 * - Fixes session conflict and encryption issues
 */

const fs = require('fs');
const path = require('path');

console.log('Starting complete WhatsApp session reset...');

// Create backup dir with timestamp
const timestamp = Date.now();
const backupDir = `./auth_info_baileys_backup/full_backup_${timestamp}`;

// Create backup directories
if (!fs.existsSync('./auth_info_baileys_backup')) {
    fs.mkdirSync('./auth_info_baileys_backup', { recursive: true });
}
fs.mkdirSync(backupDir, { recursive: true });

// Backup existing auth data
console.log('Creating complete backup of current auth data...');
if (fs.existsSync('./auth_info_baileys')) {
    const files = fs.readdirSync('./auth_info_baileys');
    let copyCount = 0;
    
    for (const file of files) {
        const srcPath = path.join('./auth_info_baileys', file);
        const destPath = path.join(backupDir, file);
        
        try {
            if (fs.statSync(srcPath).isFile()) {
                fs.copyFileSync(srcPath, destPath);
                copyCount++;
            }
        } catch (err) {
            console.error(`Error copying ${file}:`, err.message);
        }
    }
    
    console.log(`Backup complete: ${copyCount} files copied to ${backupDir}`);
} else {
    console.log('No auth directory found to backup');
}

// Reset auth info directory - only preserve creds.json and completely remove the rest
console.log('Resetting auth_info_baileys directory...');

if (fs.existsSync('./auth_info_baileys')) {
    // 1. Save creds.json if it exists
    let credsContent = null;
    const credsPath = path.join('./auth_info_baileys', 'creds.json');
    
    if (fs.existsSync(credsPath)) {
        try {
            credsContent = fs.readFileSync(credsPath, 'utf8');
            console.log('Preserved creds.json for session continuity');
        } catch (err) {
            console.error('Error reading creds.json:', err.message);
        }
    }
    
    // 2. Delete all files in the directory
    const files = fs.readdirSync('./auth_info_baileys');
    let deleteCount = 0;
    
    for (const file of files) {
        const filePath = path.join('./auth_info_baileys', file);
        try {
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
                deleteCount++;
            }
        } catch (err) {
            console.error(`Error deleting ${file}:`, err.message);
        }
    }
    
    console.log(`Deleted ${deleteCount} files from auth_info_baileys`);
    
    // 3. Restore creds.json if we had it
    if (credsContent) {
        try {
            fs.writeFileSync(credsPath, credsContent, 'utf8');
            console.log('Restored creds.json to auth_info_baileys directory');
        } catch (err) {
            console.error('Error restoring creds.json:', err.message);
        }
    }
} else {
    // Create the directory if it doesn't exist
    fs.mkdirSync('./auth_info_baileys', { recursive: true });
    console.log('Created fresh auth_info_baileys directory');
}

console.log('WhatsApp session reset completed successfully!');
console.log('Please restart the bot with the command:');
console.log('\nnpm run start\n');
console.log('The bot should now establish a fresh connection without decryption errors.');
