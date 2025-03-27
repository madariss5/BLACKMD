/**
 * Complete Backup Disabler for BlackskyMD
 * This script aggressively modifies all backup-related code to ensure only one backup is kept
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const { execSync } = require('child_process');

// Promisify fs functions
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const access = util.promisify(fs.access);
const stat = util.promisify(fs.stat);
const mkdir = util.promisify(fs.mkdir);
const readdir = util.promisify(fs.readdir);

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

// Check if a file exists
async function fileExists(filePath) {
    try {
        await access(filePath, fs.constants.F_OK);
        return true;
    } catch (error) {
        return false;
    }
}

// Ensure a directory exists
async function ensureDirectory(dirPath) {
    try {
        await access(dirPath, fs.constants.F_OK);
    } catch (error) {
        await mkdir(dirPath, { recursive: true });
    }
}

// Delete a directory recursively
function deleteDirectory(dir) {
    try {
        execSync(`rm -rf "${dir}"`, { stdio: 'ignore' });
        return true;
    } catch (error) {
        log(`Error deleting directory ${dir}: ${error.message}`, colors.red);
        return false;
    }
}

// Find all auth backup directories
async function findBackupDirectories() {
    try {
        // Use faster approach with exec
        const output = execSync('find . -type d -name "auth_info_baileys_backup_*" -o -name "auth_info_baileys_backup"', { encoding: 'utf8' });
        return output.trim().split('\n').filter(Boolean);
    } catch (error) {
        log(`Error finding backup directories: ${error.message}`, colors.red);
        return [];
    }
}

// 1. Completely replace the backupManager.js file
async function replaceBackupManager() {
    try {
        const backupManagerPath = './src/utils/backupManager.js';
        
        if (!(await fileExists(backupManagerPath))) {
            log(`Backup manager file not found at: ${backupManagerPath}`, colors.yellow);
            return false;
        }
        
        log(`Completely replacing backup manager: ${backupManagerPath}`, colors.blue);
        
        // Read the file
        const content = await readFile(backupManagerPath, 'utf8');
        
        // Create a backup
        await writeFile(`${backupManagerPath}.original_backup`, content, 'utf8');
        log(`Created backup at: ${backupManagerPath}.original_backup`, colors.green);
        
        // Create a completely new implementation
        const newContent = `/**
 * Single Backup Manager for WhatsApp Session Credentials
 * Heavily modified to only keep a single backup 
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Generate a random session ID to identify this session
const SESSION_ID = crypto.randomBytes(4).toString('hex');
logger.info(\`Session ID: \${SESSION_ID}\`);

// Max backups limited to 1
const MAX_BACKUPS = 1;

/**
 * Create a backup of the current WhatsApp session
 * @param {Object} creds - The credentials object from Baileys
 * @returns {Promise<boolean>} - Success status
 */
async function createBackup(creds) {
    try {
        // Single backup directory
        const backupDir = path.join(process.cwd(), 'auth_info_baileys_backup');
        
        // Ensure the backup directory exists
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        // Remove any previous backups
        const backupFiles = fs.readdirSync(backupDir);
        for (const file of backupFiles) {
            try {
                fs.unlinkSync(path.join(backupDir, file));
            } catch (error) {
                logger.warn(\`Failed to remove old backup file: \${file}\`);
            }
        }
        
        // Write the new credentials
        const credsPath = path.join(backupDir, 'creds.json');
        fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
        
        logger.info(\`Created single backup at: \${backupDir}\`);
        
        // Remove other backup folders
        try {
            const output = execSync('find . -maxdepth 1 -type d -name "auth_info_baileys_backup_*" | xargs rm -rf', { stdio: 'pipe' });
            logger.info('Removed other backup folders');
        } catch (error) {
            logger.warn('No other backup folders to remove');
        }
        
        return true;
    } catch (error) {
        logger.error(\`Failed to create backup: \${error.message}\`);
        return false;
    }
}

/**
 * Calculate a checksum for data verification
 * @param {string} data - Data to hash
 * @returns {string} - SHA-256 hash
 */
function calculateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Clean up old backup files to prevent excessive storage use
 * Modified to only keep one backup
 */
async function cleanupOldBackups() {
    try {
        logger.info('Cleaning up backup directories...');
        
        // Use exec for faster deletion
        execSync('find . -maxdepth 1 -type d -name "auth_info_baileys_backup_*" | xargs rm -rf', { stdio: 'pipe' });
        
        logger.info('Backup cleanup complete - kept only one backup');
        return true;
    } catch (error) {
        logger.error(\`Error cleaning up backups: \${error.message}\`);
        return false;
    }
}

/**
 * Restore credentials from available backups
 * @returns {Promise<Object|null>} - Restored credentials or null if not found
 */
async function restoreBackup() {
    try {
        // Primary backup location
        const backupDir = path.join(process.cwd(), 'auth_info_baileys_backup');
        const credsPath = path.join(backupDir, 'creds.json');
        
        if (fs.existsSync(credsPath)) {
            const data = fs.readFileSync(credsPath, 'utf8');
            return JSON.parse(data);
        }
        
        // No backup found
        logger.warn('No backups found to restore');
        return null;
    } catch (error) {
        logger.error(\`Failed to restore backup: \${error.message}\`);
        return null;
    }
}

/**
 * Set up automatic scheduled backups
 * @param {Function} getCredsFunction - Function that returns current credentials
 */
function setupScheduledBackups(getCredsFunction) {
    if (!getCredsFunction || typeof getCredsFunction !== 'function') {
        logger.error('Invalid credentials function provided for scheduled backups');
        return false;
    }
    
    // Create one backup at the start of the session instead of a recurring schedule
    // Using immediate function execution instead of top-level await
    (async () => {
        try {
            const creds = await getCredsFunction();
            if (creds) {
                await createBackup(creds);
                logger.info('Initial session backup completed successfully');
            }
        } catch (error) {
            logger.error('Initial session backup failed:', error);
        }
    })();
    
    logger.info('Created single backup for this session (no recurring backups)');
    return true;
}

module.exports = {
    createBackup,
    restoreBackup,
    setupScheduledBackups,
    cleanupOldBackups,
    SESSION_ID
};
`;
        
        // Save the new file
        await writeFile(backupManagerPath, newContent, 'utf8');
        log(`Successfully replaced backup manager`, colors.green);
        
        return true;
    } catch (error) {
        log(`Error replacing backup manager: ${error.message}`, colors.red);
        return false;
    }
}

// 2. Modify session manager to create only one backup
async function modifySessionManager() {
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
        await writeFile(`${sessionManagerPath}.original_backup`, content, 'utf8');
        log(`Created backup at: ${sessionManagerPath}.original_backup`, colors.green);
        
        // Modify backupSession method to skip creating backups when session issues occur
        let modified = content;
        
        if (content.includes('backupSession')) {
            modified = content.replace(
                /async backupSession\s*\([^)]*\)\s*{[\s\S]*?}/g,
                `async backupSession(reason = 'routine') {
        // Limit backups to one per day, regardless of reason
        if (this.lastBackupTime && (Date.now() - this.lastBackupTime < 86400000)) {
            logger.info('Skipping backup creation - already created one in the last 24 hours');
            return false;
        }
        
        try {
            const creds = this.getCredentials();
            if (!creds) {
                logger.warn('No credentials available to backup');
                return false;
            }
            
            // Use the backupManager to create a single backup
            const success = await backupManager.createBackup(creds);
            
            if (success) {
                this.lastBackupTime = Date.now();
                logger.info(\`Session backup completed successfully (reason: \${reason})\`);
                
                // Clean up any other backups
                await backupManager.cleanupOldBackups();
            }
            
            return success;
        } catch (error) {
            logger.error(\`Failed to backup session: \${error.message}\`);
            return false;
        }
    }`
            );
            
            log('Modified backupSession method to limit backups', colors.green);
        }
        
        // Modify startScheduledBackups to only run once per day
        if (modified.includes('startScheduledBackups')) {
            modified = modified.replace(
                /startScheduledBackups\s*\([^)]*\)\s*{[\s\S]*?}/g,
                `startScheduledBackups() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
        }
        
        // Once per day backup (24 hours)
        this.backupInterval = 86400000;
        
        this.backupTimer = setInterval(async () => {
            await this.backupSession('scheduled');
        }, this.backupInterval);
        
        logger.info(\`Scheduled backups set up (interval: \${this.backupInterval / 60000} minutes)\`);
    }`
            );
            
            log('Modified scheduled backups to run once per day', colors.green);
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

// 3. Clean up all but one backup directory
async function cleanupAllBackups() {
    try {
        log('Finding all backup directories...', colors.blue);
        const backups = await findBackupDirectories();
        
        if (backups.length === 0) {
            log('No backup directories found.', colors.yellow);
            return true;
        }
        
        log(`Found ${backups.length} backup directories.`, colors.yellow);
        
        // Keep only the main backup directory, delete all timestamped ones
        const mainBackupDir = './auth_info_baileys_backup';
        
        // Ensure main backup dir exists
        await ensureDirectory(mainBackupDir);
        
        // Delete all timestamped backup directories
        let deletedCount = 0;
        for (const dir of backups) {
            if (dir !== mainBackupDir) {
                log(`Deleting: ${dir}`, colors.yellow);
                if (deleteDirectory(dir)) {
                    deletedCount++;
                }
            }
        }
        
        log(`\nCleanup summary:`, colors.blue);
        log(`  - Total backup directories found: ${backups.length}`, colors.cyan);
        log(`  - Directories deleted: ${deletedCount}`, colors.cyan);
        log(`  - Kept only: ${mainBackupDir}`, colors.green);
        
        return true;
    } catch (error) {
        log(`Error cleaning up backups: ${error.message}`, colors.red);
        return false;
    }
}

// 4. Setup cron job to run the cleanup script regularly
async function setupAutomaticCleanup() {
    try {
        const cleanupScriptPath = './auto-cleanup-backups.js';
        
        log(`Creating automatic cleanup script: ${cleanupScriptPath}`, colors.blue);
        
        const scriptContent = `/**
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
`;
        
        // Save the script
        await writeFile(cleanupScriptPath, scriptContent, 'utf8');
        log(`Created automatic cleanup script: ${cleanupScriptPath}`, colors.green);
        
        // Modify index.js to run the script hourly
        const indexPath = './src/index.js';
        if (await fileExists(indexPath)) {
            const indexContent = await readFile(indexPath, 'utf8');
            
            if (indexContent.includes('setupBackupCleanup')) {
                const modifiedIndex = indexContent.replace(
                    /function setupBackupCleanup\(\) {[\s\S]*?}/g,
                    `function setupBackupCleanup() {
    logger.info('Setting up aggressive backup cleanup (runs hourly)');
    
    try {
        // Schedule backup cleanup to run every hour
        cron.schedule('0 * * * *', () => {
            try {
                logger.info('Running hourly backup cleanup...');
                
                // Run the cleanup script
                const output = execSync('node auto-cleanup-backups.js').toString();
                logger.info('Backup cleanup completed successfully');
                
                if (process.env.DEBUG_MODE === 'true') {
                    logger.debug(output);
                }
            } catch (error) {
                logger.error('Error during hourly backup cleanup:', error);
            }
        });
        
        // Also run the cleanup immediately
        setTimeout(() => {
            try {
                logger.info('Running initial backup cleanup...');
                const output = execSync('node auto-cleanup-backups.js').toString();
                logger.info('Initial backup cleanup completed');
            } catch (error) {
                logger.error('Error during initial backup cleanup:', error);
            }
        }, 60 * 1000); // Run 1 minute after startup
        
        logger.success('Backup cleanup scheduler initialized');
    } catch (error) {
        logger.error('Failed to set up backup cleanup:', error);
    }
}`
                );
                
                await writeFile(indexPath, modifiedIndex, 'utf8');
                log('Modified index.js to run backup cleanup hourly', colors.green);
            }
        }
        
        return true;
    } catch (error) {
        log(`Error setting up automatic cleanup: ${error.message}`, colors.red);
        return false;
    }
}

// 5. Setup the single backup directory
async function setupSingleBackupDirectory() {
    try {
        const mainBackupDir = './auth_info_baileys_backup';
        
        // Create the directory if it doesn't exist
        await ensureDirectory(mainBackupDir);
        
        // Copy creds.json from auth_info_baileys to the backup dir if it exists
        const credsPath = './auth_info_baileys/creds.json';
        const backupCredsPath = path.join(mainBackupDir, 'creds.json');
        
        if (await fileExists(credsPath)) {
            log('Copying current credentials to backup directory', colors.blue);
            const credsData = await readFile(credsPath, 'utf8');
            await writeFile(backupCredsPath, credsData, 'utf8');
            log('Created backup of current credentials', colors.green);
        }
        
        return true;
    } catch (error) {
        log(`Error setting up backup directory: ${error.message}`, colors.red);
        return false;
    }
}

// Main function
async function main() {
    try {
        log('== BLACKSKY-MD Comprehensive Backup Manager ==', colors.cyan);
        log('This script completely rewrites the backup system to use a single backup directory', colors.yellow);
        log('');
        
        // 1. Replace the backup manager with a simplified version
        await replaceBackupManager();
        
        // 2. Modify session manager to limit backup creation
        await modifySessionManager();
        
        // 3. Clean up all existing backup directories except one
        await cleanupAllBackups();
        
        // 4. Set up automatic hourly cleanup
        await setupAutomaticCleanup();
        
        // 5. Set up the single backup directory
        await setupSingleBackupDirectory();
        
        log('');
        log('Comprehensive backup management completed!', colors.green);
        log('The bot will now only maintain a single backup folder (auth_info_baileys_backup).', colors.green);
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