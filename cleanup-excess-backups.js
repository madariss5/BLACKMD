/**
 * Cleanup Excess Backups
 * Removes excessive backup directories to improve performance
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for better console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(color + message + colors.reset);
}

/**
 * Find all auth backup directories
 */
function findBackupDirectories() {
    const results = [];
    
    // Check for different types of backup directories
    const patterns = [
        'auth_info_baileys_backup_',
        'auth_info_baileys_backup/'
    ];
    
    const rootFiles = fs.readdirSync('.');
    
    // Find directories matching backup patterns
    patterns.forEach(pattern => {
        const backups = rootFiles.filter(file => 
            file.startsWith(pattern) && fs.statSync(path.join('.', file)).isDirectory()
        );
        results.push(...backups);
    });
    
    // Also check inside auth_info_baileys_backup for nested backups
    if (fs.existsSync('./auth_info_baileys_backup')) {
        const nestedFiles = fs.readdirSync('./auth_info_baileys_backup');
        const nestedBackups = nestedFiles.filter(file => 
            file.startsWith('backup_') && 
            fs.statSync(path.join('./auth_info_baileys_backup', file)).isDirectory()
        ).map(file => path.join('auth_info_baileys_backup', file));
        
        results.push(...nestedBackups);
    }
    
    return results;
}

/**
 * Safely remove a directory and its contents
 */
function removeDirectory(dir) {
    try {
        if (!fs.existsSync(dir)) return true;
        
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
                removeDirectory(itemPath);
            } else {
                fs.unlinkSync(itemPath);
            }
        }
        
        fs.rmdirSync(dir);
        return true;
    } catch (error) {
        log(`Error deleting ${dir}: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Main cleanup function
 */
function cleanupExcessBackups() {
    log('Searching for backup directories...', colors.blue);
    const backups = findBackupDirectories();
    
    log(`Found ${backups.length} backup directories:`, colors.yellow);
    backups.forEach(dir => {
        log(`  - ${dir}`, colors.cyan);
    });
    
    // Keep only the 3 most recent backups based on naming/timestamps
    backups.sort(); // Sort alphabetically, which works since timestamps are in the names
    
    const keep = backups.slice(-3); // Keep the 3 most recent
    const remove = backups.slice(0, -3); // Remove the rest
    
    log(`\nKeeping ${keep.length} most recent backups:`, colors.green);
    keep.forEach(dir => {
        log(`  - ${dir}`, colors.green);
    });
    
    log(`\nRemoving ${remove.length} older backups:`, colors.yellow);
    let removedCount = 0;
    
    for (const dir of remove) {
        log(`  - Removing: ${dir}`, colors.yellow);
        if (removeDirectory(dir)) {
            log(`    ✓ Removed successfully`, colors.green);
            removedCount++;
        } else {
            log(`    ✗ Failed to remove`, colors.red);
        }
    }
    
    log(`\nCleanup summary:`, colors.blue);
    log(`  - Total backups found: ${backups.length}`, colors.cyan);
    log(`  - Backups removed: ${removedCount}`, colors.cyan);
    log(`  - Backups kept: ${keep.length}`, colors.cyan);
    
    log('\nBackup cleanup completed!', colors.green);
}

// Run the cleanup
cleanupExcessBackups();