/**
 * Scheduled Backup Cleanup
 * Sets up an automatic backup cleaning process to run once per day
 */

const cron = require('node-cron');
const { execSync } = require('child_process');
const logger = require('./src/utils/logger');

// Check if module is being run directly or required
const isMainModule = require.main === module;

// Schedule the backup cleanup to run once daily
function scheduleBackupCleanup() {
    logger.info('Setting up scheduled backup cleanup (runs once daily)');
    
    // Schedule cleanup to run at 3:00 AM daily
    const job = cron.schedule('0 3 * * *', () => {
        try {
            logger.info('Running scheduled backup cleanup...');
            const output = execSync('node cleanup-excess-backups.js').toString();
            logger.info('Backup cleanup completed successfully');
            logger.debug(output);
        } catch (error) {
            logger.error('Error during scheduled backup cleanup:', error);
        }
    });
    
    logger.success('Backup cleanup scheduler initialized');
    return job;
}

// If this script is run directly, set up the scheduler
if (isMainModule) {
    const job = scheduleBackupCleanup();
    console.log('\nBackup cleanup scheduler is running in the background');
    console.log('Press Ctrl+C to stop the scheduler');
    
    // Keep the process running
    process.stdin.resume();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nStopping backup cleanup scheduler...');
        job.stop();
        console.log('Scheduler stopped');
        process.exit(0);
    });
} else {
    // Export for use in other modules
    module.exports = {
        scheduleBackupCleanup
    };
}