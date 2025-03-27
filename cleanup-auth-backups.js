/**
 * Cleanup Auth Backups Script
 * Deletes all authentication backup folders while preserving the current session
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const rimraf = require('util').promisify(require('child_process').exec);

// Promisify fs functions
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const mkdir = util.promisify(fs.mkdir);
const copyFile = util.promisify(fs.copyFile);

// Define the main auth directory and backup directories
const MAIN_AUTH_DIR = 'auth_info_baileys';
const BACKUP_DIRS = [
    'auth_info_baileys_backup',
    'backups',
    'data/session_backups'
];

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
 * Creates a safe backup of the current auth directory
 */
async function createSafeBackup() {
    try {
        // Ensure main auth directory exists
        if (!fs.existsSync(MAIN_AUTH_DIR)) {
            log(`Main auth directory '${MAIN_AUTH_DIR}' does not exist. Nothing to backup.`, colors.yellow);
            return false;
        }

        // Create a timestamp
        const timestamp = Date.now();
        const safeBackupDir = `${MAIN_AUTH_DIR}_safe_backup_${timestamp}`;

        // Create safe backup directory
        await mkdir(safeBackupDir, { recursive: true });
        log(`Created safe backup directory: ${safeBackupDir}`, colors.blue);

        // Copy all files from main auth directory to safe backup
        const files = await readdir(MAIN_AUTH_DIR);
        let copyCount = 0;

        for (const file of files) {
            const srcPath = path.join(MAIN_AUTH_DIR, file);
            const destPath = path.join(safeBackupDir, file);

            try {
                const fileStat = await stat(srcPath);
                
                if (fileStat.isFile()) {
                    await copyFile(srcPath, destPath);
                    copyCount++;
                }
            } catch (err) {
                log(`Error copying ${file}: ${err.message}`, colors.red);
            }
        }

        log(`Safe backup complete: ${copyCount} files copied to ${safeBackupDir}`, colors.green);
        return safeBackupDir;
    } catch (error) {
        log(`Error creating safe backup: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Find all auth backup directories that match a pattern
 */
async function findAuthBackupDirectories() {
    try {
        // Get all directories from current directory
        const { stdout } = await rimraf('find . -type d -name "auth_info_baileys_backup*" -o -name "backups" -o -name "session_backups"');
        
        // Split the output into an array of directories
        const foundDirs = stdout.trim().split('\n').filter(Boolean);
        
        // Log the found directories
        log(`Found ${foundDirs.length} backup directories`, colors.blue);
        foundDirs.forEach(dir => log(`- ${dir}`, colors.cyan));
        
        return foundDirs;
    } catch (error) {
        log(`Error finding backup directories: ${error.message}`, colors.red);
        return [];
    }
}

/**
 * Deletes auth backup directories
 */
async function deleteAuthBackups() {
    try {
        // Find all auth backup directories
        const backupDirs = await findAuthBackupDirectories();
        
        if (backupDirs.length === 0) {
            log('No backup directories found to delete.', colors.yellow);
            return;
        }
        
        // Ask for confirmation
        log('');
        log('WARNING: This will delete all auth backup directories.', colors.yellow);
        log('Please make sure the bot is NOT running before continuing.', colors.yellow);
        log('');
        
        // Delete each directory
        let deleteCount = 0;
        for (const dir of backupDirs) {
            try {
                // Skip the safe backup we just created
                if (dir.includes('safe_backup')) {
                    log(`Skipping safe backup: ${dir}`, colors.blue);
                    continue;
                }
                
                log(`Deleting ${dir}...`, colors.magenta);
                await rimraf(`rm -rf "${dir}"`);
                deleteCount++;
                log(`Deleted ${dir}`, colors.green);
            } catch (deleteErr) {
                log(`Error deleting ${dir}: ${deleteErr.message}`, colors.red);
            }
        }
        
        log(`Successfully deleted ${deleteCount} backup directories`, colors.green);
        
        // Also clean the data/session_backups directory if it exists
        if (fs.existsSync('data/session_backups')) {
            try {
                const backupFiles = await readdir('data/session_backups');
                const credBackups = backupFiles.filter(file => file.startsWith('creds_backup_') || file === 'latest_creds.json');
                
                if (credBackups.length > 0) {
                    log(`Found ${credBackups.length} credential backup files in data/session_backups`, colors.blue);
                    
                    for (const file of credBackups) {
                        const filePath = path.join('data/session_backups', file);
                        fs.unlinkSync(filePath);
                        log(`Deleted ${filePath}`, colors.green);
                    }
                }
            } catch (err) {
                log(`Error cleaning data/session_backups: ${err.message}`, colors.red);
            }
        }
        
    } catch (error) {
        log(`Error deleting auth backups: ${error.message}`, colors.red);
    }
}

/**
 * Main function
 */
async function main() {
    try {
        log('== BLACKSKY-MD Auth Backup Cleanup ==', colors.cyan);
        log('This script will delete all authentication backup directories', colors.yellow);
        log('');
        
        // First create a safe backup
        log('Creating a safe backup of current auth data...', colors.blue);
        const safeBackup = await createSafeBackup();
        
        if (!safeBackup) {
            log('Failed to create a safe backup. Exiting.', colors.red);
            return;
        }
        
        // Delete all auth backups
        log('');
        log('Proceeding to delete auth backups...', colors.blue);
        await deleteAuthBackups();
        
        log('');
        log('Auth backup cleanup completed!', colors.green);
        log(`A safe backup was created at: ${safeBackup}`, colors.green);
        log('You can delete this safe backup later if the bot continues working correctly.', colors.yellow);
        
    } catch (error) {
        log(`Fatal error: ${error.message}`, colors.red);
    }
}

// Run the main function
main().catch(err => {
    log(`Unhandled error: ${err.message}`, colors.red);
    process.exit(1);
});