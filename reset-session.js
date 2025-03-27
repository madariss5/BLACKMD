/**
 * WhatsApp Session Reset Utility
 * Creates a backup of the current session and resets it for a clean connection
 */

const fs = require('fs');
const path = require('path');

// Create backup of auth folder
function backupAuthFolder() {
    const authDir = './auth_info_baileys';
    const backupDir = `./auth_info_baileys_backup/manual_backup_${Date.now()}`;
    
    console.log(`Creating backup at ${backupDir}...`);
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync('./auth_info_baileys_backup')) {
        fs.mkdirSync('./auth_info_baileys_backup', { recursive: true });
    }
    
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Copy all files from auth dir to backup dir
    if (fs.existsSync(authDir)) {
        const files = fs.readdirSync(authDir);
        let copyCount = 0;
        
        for (const file of files) {
            const srcPath = path.join(authDir, file);
            const destPath = path.join(backupDir, file);
            
            if (fs.statSync(srcPath).isFile()) {
                fs.copyFileSync(srcPath, destPath);
                copyCount++;
            }
        }
        
        console.log(`Backup complete: ${copyCount} files copied to ${backupDir}`);
        return true;
    } else {
        console.log('Auth directory not found');
        return false;
    }
}

// Preserve only critical auth files and reset the rest
function resetSessionFiles() {
    const authDir = './auth_info_baileys';
    
    if (!fs.existsSync(authDir)) {
        console.log('Auth directory not found');
        return false;
    }
    
    // Only keep creds.json and delete problematic session files
    const files = fs.readdirSync(authDir);
    let deleteCount = 0;
    
    for (const file of files) {
        const filePath = path.join(authDir, file);
        
        // Keep only the essential creds file for persistent auth
        if (file !== 'creds.json' && fs.statSync(filePath).isFile()) {
            // Delete conflict-prone files like app-state-sync-keys and pre-keys
            if (file.includes('app-state-sync') || file.includes('pre-key')) {
                fs.unlinkSync(filePath);
                deleteCount++;
            }
        }
    }
    
    console.log(`Session reset complete: ${deleteCount} files cleaned up`);
    return true;
}

// Run the backup and reset
(async () => {
    console.log('Starting WhatsApp session reset...');
    
    const backupSuccess = backupAuthFolder();
    if (backupSuccess) {
        console.log('Backup completed successfully');
    } else {
        console.log('Backup failed, stopping reset process');
        process.exit(1);
    }
    
    const resetSuccess = resetSessionFiles();
    if (resetSuccess) {
        console.log('Session reset completed successfully');
        console.log('Please restart the bot to establish a fresh connection');
    } else {
        console.log('Session reset failed');
    }
})();
