/**
 * Automatic Backup Cleanup Script
 * Runs via a cron job to ensure only one backup directory exists
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Running automatic backup cleanup...');

try {
    // Ensure primary backup dir exists
    const mainBackupDir = path.join(process.cwd(), 'auth_info_baileys_backup');
    if (!fs.existsSync(mainBackupDir)) {
        fs.mkdirSync(mainBackupDir, { recursive: true });
    }
    
    // Delete all timestamped backup directories
    execSync('find . -maxdepth 1 -type d -name "auth_info_baileys_backup_*" -exec rm -rf {} \\;', { stdio: 'pipe' });
    console.log('Removed all timestamped backup directories');
    
    console.log('Automatic backup cleanup completed successfully');
} catch (error) {
    console.error('Error during automatic backup cleanup:', error.message);
}
