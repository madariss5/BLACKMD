/**
 * Heroku Console Helper
 * Enhanced console access and debugging tools for Heroku deployments
 */

const os = require('os');
const logger = require('./logger');

// Memory queue for debug logs (last 100 entries)
const debugLogs = [];
const MAX_LOGS = 100;

// Start time for uptime calculation
const startTime = Date.now();

/**
 * Initialize the Heroku console helper
 */
function initializeHerokuConsole() {
    if (!process.env.DYNO) {
        logger.info('Not running on Heroku, skipping console helper initialization');
        return;
    }

    logger.info('Initializing Heroku console helper...');
    
    // Log Heroku environment information on startup
    logHerokuEnvironment();
    
    // Set up periodic logging for long-running Heroku dynos
    setupPeriodicLogging();
    
    // Set up process error handlers
    setupErrorHandlers();
    
    // Expose a global access point for the console helper
    global.herokuConsole = {
        logDebug,
        getAllLogs,
        getStatus
    };
    
    logger.success('Heroku console helper initialized');
}

/**
 * Log Heroku environment information on startup
 */
function logHerokuEnvironment() {
    logger.info('======== HEROKU ENVIRONMENT =========');
    logger.info(`Dyno: ${process.env.DYNO || 'unknown'}`);
    logger.info(`App: ${process.env.HEROKU_APP_NAME || 'unknown'}`);
    logger.info(`Node: ${process.version}`);
    logger.info(`Memory: ${Math.round(os.totalmem() / (1024 * 1024))} MB total`);
    logger.info(`Platform: ${os.platform()} ${os.release()}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info('====================================');
    
    // Add these to the debug logs
    logDebug('environment', {
        dyno: process.env.DYNO,
        app: process.env.HEROKU_APP_NAME,
        node: process.version,
        memory: Math.round(os.totalmem() / (1024 * 1024)),
        platform: `${os.platform()} ${os.release()}`,
        environment: process.env.NODE_ENV
    });
}

/**
 * Set up periodic logging for long-running Heroku dynos
 */
function setupPeriodicLogging() {
    // Log memory usage every hour to help identify memory leaks
    setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));
        const heapTotalMB = Math.round(memoryUsage.heapTotal / (1024 * 1024));
        const rssMB = Math.round(memoryUsage.rss / (1024 * 1024));
        
        logger.info(`[HEROKU] Memory usage: RSS ${rssMB}MB, Heap ${heapUsedMB}/${heapTotalMB}MB`);
        logger.info(`[HEROKU] Uptime: ${Math.round((Date.now() - startTime) / (1000 * 60))} minutes`);
        
        // Store in debug logs
        logDebug('memoryUsage', {
            rss: rssMB,
            heapUsed: heapUsedMB,
            heapTotal: heapTotalMB,
            uptime: Math.round((Date.now() - startTime) / (1000 * 60))
        });
    }, 60 * 60 * 1000); // Every hour
}

/**
 * Set up process error handlers
 */
function setupErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        logger.error(`[HEROKU] Uncaught exception: ${err.message}`);
        logger.error(err.stack);
        
        // Store in debug logs
        logDebug('uncaughtException', {
            message: err.message,
            stack: err.stack
        });
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        logger.error(`[HEROKU] Unhandled promise rejection: ${reason}`);
        
        // Store in debug logs
        logDebug('unhandledRejection', {
            reason: String(reason)
        });
    });
    
    // Handle Heroku SIGTERM for graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('[HEROKU] Received SIGTERM signal, preparing for shutdown');
        
        // Store in debug logs
        logDebug('shutdown', {
            reason: 'SIGTERM',
            timestamp: new Date().toISOString()
        });
        
        // Allow some time for cleanup before exiting
        setTimeout(() => {
            logger.info('[HEROKU] Shutdown complete');
            process.exit(0);
        }, 1000);
    });
}

/**
 * Add a debug message to the memory queue
 * @param {string} type - Type of debug message
 * @param {string} message - Debug message content
 */
function logDebug(type, message) {
    // Add to the front, remove from the back if too many
    debugLogs.unshift({
        type,
        message,
        timestamp: new Date().toISOString()
    });
    
    // Ensure we don't exceed the maximum number of logs
    if (debugLogs.length > MAX_LOGS) {
        debugLogs.pop();
    }
}

/**
 * Get all debug logs from memory
 * @returns {Array} - Debug log entries
 */
function getAllLogs() {
    return debugLogs;
}

/**
 * Get current system status
 * @returns {Object} - Status information
 */
function getStatus() {
    return {
        uptime: Math.round((Date.now() - startTime) / 1000),
        memory: process.memoryUsage(),
        platform: os.platform(),
        node: process.version,
        timestamp: new Date().toISOString(),
        dyno: process.env.DYNO || 'unknown',
        app: process.env.HEROKU_APP_NAME || 'unknown'
    };
}

module.exports = {
    initializeHerokuConsole,
    logDebug,
    getAllLogs,
    getStatus
};