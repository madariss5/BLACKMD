/**
 * Disable Automatic Backups for BlackskyMD
 * This script modifies the relevant files to prevent excessive auto-backups
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// Promisify fs functions
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const access = util.promisify(fs.access);

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// Logging function
function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
    try {
        await access(filePath, fs.constants.F_OK);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Modify the backupManager.js file to disable frequent backups
 */
async function disableBackupManager() {
    try {
        const backupManagerPath = './src/utils/backupManager.js';
        
        if (!(await fileExists(backupManagerPath))) {
            log(`Backup manager file not found at: ${backupManagerPath}`, colors.yellow);
            return false;
        }
        
        log(`Modifying backup manager: ${backupManagerPath}`, colors.blue);
        
        // Read the file
        const content = await readFile(backupManagerPath, 'utf8');
        
        // Create a backup
        await writeFile(`${backupManagerPath}.backup`, content, 'utf8');
        log(`Created backup at: ${backupManagerPath}.backup`, colors.green);
        
        // Modify the backup interval (if applicable)
        let modified = content;
        
        // 1. Look for backup interval constant
        const intervalPattern = /(const\s+BACKUP_INTERVAL\s*=\s*)(\d+)/;
        if (intervalPattern.test(modified)) {
            // Set a higher value (24 hours instead of minutes)
            modified = modified.replace(intervalPattern, (match, p1, p2) => {
                log(`Found backup interval: ${p2}`, colors.yellow);
                // 24 hours in milliseconds
                return `${p1}86400000`;
            });
            log('Modified backup interval to 24 hours', colors.green);
        }
        
        // 2. Look for max backups constant
        const maxBackupsPattern = /(const\s+MAX_BACKUPS\s*=\s*)(\d+)/;
        if (maxBackupsPattern.test(modified)) {
            // Set a lower value (3 backups instead of many)
            modified = modified.replace(maxBackupsPattern, (match, p1, p2) => {
                log(`Found max backups: ${p2}`, colors.yellow);
                return `${p1}3`;
            });
            log('Modified max backups to 3', colors.green);
        }
        
        // 3. Look for MAX_BACKUPS_PER_DIR in cleanupOldBackups
        const maxBackupsPerDirPattern = /(const\s+MAX_BACKUPS_PER_DIR\s*=\s*)(\d+)/;
        if (maxBackupsPerDirPattern.test(modified)) {
            // Set a lower value (3 backups per directory)
            modified = modified.replace(maxBackupsPerDirPattern, (match, p1, p2) => {
                log(`Found max backups per dir: ${p2}`, colors.yellow);
                return `${p1}3`;
            });
            log('Modified max backups per directory to 3', colors.green);
        }
        
        // Save the modified file
        await writeFile(backupManagerPath, modified, 'utf8');
        log(`Successfully modified backup manager`, colors.green);
        
        return true;
    } catch (error) {
        log(`Error modifying backup manager: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Modify the sessionManager.js file to disable frequent backups
 */
async function disableSessionManager() {
    try {
        const sessionManagerPath = './src/core/sessionManager.js';
        
        if (!(await fileExists(sessionManagerPath))) {
            log(`Session manager file not found at: ${sessionManagerPath}`, colors.yellow);
            return false;
        }
        
        log(`Modifying session manager: ${sessionManagerPath}`, colors.blue);
        
        // Read the file
        const content = await readFile(sessionManagerPath, 'utf8');
        
        // Create a backup
        await writeFile(`${sessionManagerPath}.backup`, content, 'utf8');
        log(`Created backup at: ${sessionManagerPath}.backup`, colors.green);
        
        // Modify the backup interval and max backups
        let modified = content;
        
        // 1. Update default backup interval to daily (24 hours)
        const backupIntervalPattern = /(const\s+BACKUP_INTERVAL\s*=\s*)(\d+)/;
        if (backupIntervalPattern.test(modified)) {
            modified = modified.replace(backupIntervalPattern, (match, p1, p2) => {
                log(`Found backup interval: ${p2}`, colors.yellow);
                // 24 hours in milliseconds
                return `${p1}86400000`;
            });
            log('Modified backup interval to 24 hours', colors.green);
        }
        
        // 2. Update max backups to a low value
        const maxBackupsPattern = /(const\s+MAX_BACKUPS\s*=\s*)(\d+)/;
        if (maxBackupsPattern.test(modified)) {
            modified = modified.replace(maxBackupsPattern, (match, p1, p2) => {
                log(`Found max backups: ${p2}`, colors.yellow);
                return `${p1}3`;
            });
            log('Modified max backups to 3', colors.green);
        }
        
        // 3. Modify the startScheduledBackups method (if present)
        const startScheduledPattern = /(startScheduledBackups\s*\(\s*\)\s*\{[\s\S]*?this\.backupTimer\s*=\s*setInterval\s*\([\s\S]*?\}\s*,\s*)(this\.backupInterval)/;
        if (startScheduledPattern.test(modified)) {
            log('Found startScheduledBackups method', colors.yellow);
            
            // Replace with a slower interval
            modified = modified.replace(startScheduledPattern, (match, p1, p2) => {
                return `${p1}86400000 /* ${p2} - changed to 24h */`;
            });
            log('Modified scheduled backups to use 24-hour interval', colors.green);
        }
        
        // Save the modified file
        await writeFile(sessionManagerPath, modified, 'utf8');
        log(`Successfully modified session manager`, colors.green);
        
        return true;
    } catch (error) {
        log(`Error modifying session manager: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Modify connection.js to reduce automatic backups
 */
async function disableConnectionBackups() {
    try {
        // Check both potential locations
        const connectionPaths = [
            './src/core/connection.js',
            './src/core/connection-fixed.js'
        ];
        
        let connectionPath = null;
        for (const path of connectionPaths) {
            if (await fileExists(path)) {
                connectionPath = path;
                break;
            }
        }
        
        if (!connectionPath) {
            log('Connection file not found', colors.yellow);
            return false;
        }
        
        log(`Modifying connection file: ${connectionPath}`, colors.blue);
        
        // Read the file
        const content = await readFile(connectionPath, 'utf8');
        
        // Create a backup
        await writeFile(`${connectionPath}.backup`, content, 'utf8');
        log(`Created backup at: ${connectionPath}.backup`, colors.green);
        
        // Look for the backupCredentials method
        const backupCredsPattern = /(backupCredentials\s*\(\s*\)\s*\{[\s\S]*?)(\s*backupDirs\.forEach[\s\S]*?\}\s*\}\s*\}\s*catch[\s\S]*?\}\s*\})/;
        
        if (backupCredsPattern.test(content)) {
            log('Found backupCredentials method', colors.yellow);
            
            // Modify to only keep latest backup
            let modified = content.replace(backupCredsPattern, (match, p1, p2) => {
                return `${p1}
        // MODIFIED: Only create one backup in ./backups with timestamp
        try {
            const dir = './backups';
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const backupPath = path.join(dir, \`creds_backup_\${timestamp}.json\`);
            fs.copyFileSync(credsPath, backupPath);
            
            // Only keep the latest backup
            fs.copyFileSync(credsPath, path.join(dir, 'latest_creds.json'));
            
            logger.info(\`Backup saved to \${backupPath}\`);
            
            // Only keep 3 most recent backups
            const files = fs.readdirSync(dir);
            const backupFiles = files.filter(file => 
                file.startsWith('creds_backup_') && file.endsWith('.json')
            );
            
            if (backupFiles.length > 3) {
                // Sort by name (which includes timestamp)
                backupFiles.sort();
                
                // Remove oldest files, keeping 3
                const filesToRemove = backupFiles.slice(0, backupFiles.length - 3);
                
                for (const file of filesToRemove) {
                    fs.unlinkSync(path.join(dir, file));
                    logger.debug(\`Removed old backup: \${file}\`);
                }
            }
        } catch (error) {
            logger.error('Error creating credentials backup:', error);
        }`;
            });
            
            // Save the modified file
            await writeFile(connectionPath, modified, 'utf8');
            log(`Successfully modified connection backups`, colors.green);
            
            return true;
        } else {
            log('Could not find backupCredentials method', colors.yellow);
            return false;
        }
    } catch (error) {
        log(`Error modifying connection file: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    try {
        log('== BLACKSKY-MD Auto-Backup Disabler ==', colors.cyan);
        log('This script will modify the relevant files to prevent excessive auto-backups', colors.yellow);
        log('');
        
        // Disable backups in all relevant files
        await disableBackupManager();
        await disableSessionManager();
        await disableConnectionBackups();
        
        log('');
        log('Auto-backup modifications completed!', colors.green);
        log('The bot should now create far fewer backup files.', colors.green);
        log('');
        log('Note: You\'ll need to restart the bot for these changes to take effect.', colors.yellow);
        
    } catch (error) {
        log(`Fatal error: ${error.message}`, colors.red);
    }
}

// Run the main function
main().catch(err => {
    log(`Unhandled error: ${err.message}`, colors.red);
    process.exit(1);
});