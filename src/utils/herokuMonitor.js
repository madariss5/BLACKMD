/**
 * Heroku Monitoring Utility
 * Provides specialized monitoring and status reporting for Heroku deployments
 */

const os = require('os');
const fs = require('fs');
const logger = require('./logger');

// Configuration
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // Check memory every 5 minutes
const MEMORY_WARNING_THRESHOLD = 0.85; // 85% of memory limit

function startHerokuMonitoring(connectionManager) {
    if (!process.env.DYNO) {
        logger.info('Not running on Heroku, skipping Heroku monitoring');
        return;
    }
    
    logger.info('Starting Heroku-optimized monitoring services');
    
    // Monitor WhatsApp connection status
    monitorConnectionStatus(connectionManager);
    
    // Monitor memory usage to prevent OOM crashes
    monitorMemoryUsage();
    
    // Log dyno information once on startup
    logDynoInformation();
    
    return {
        getHealthStatus: () => getHealthStatus(connectionManager)
    };
}

/**
 * Monitor WhatsApp connection status
 * @param {Object} connectionManager - WhatsApp connection manager
 */
function monitorConnectionStatus(connectionManager) {
    // Check connection every 30 minutes
    setInterval(() => {
        try {
            const status = connectionManager.getStatus 
                ? connectionManager.getStatus() 
                : { 
                    isConnected: connectionManager.getConnectionStatus 
                        ? connectionManager.getConnectionStatus() === 'connected' 
                        : connectionManager.user !== undefined 
                };
            
            if (status.isConnected) {
                logger.info('[Heroku Monitor] WhatsApp connection status: Connected');
            } else {
                logger.warn('[Heroku Monitor] WhatsApp connection status: Disconnected');
                
                // Log to a file for historical tracking
                const date = new Date().toISOString();
                fs.appendFileSync('connection-monitor.log', `${date} - Disconnected\n`);
                
                // Trigger reconnection if needed
                if (connectionManager.connect) {
                    logger.info('[Heroku Monitor] Attempting to reconnect WhatsApp');
                    connectionManager.connect().catch(err => {
                        logger.error('[Heroku Monitor] Reconnection failed:', err);
                    });
                }
            }
        } catch (error) {
            logger.error('[Heroku Monitor] Error checking connection status:', error);
        }
    }, 30 * 60 * 1000); // Every 30 minutes
}

/**
 * Monitor memory usage to prevent OOM crashes
 */
function monitorMemoryUsage() {
    setInterval(() => {
        try {
            const memoryUsage = process.memoryUsage();
            const rssInMB = memoryUsage.rss / 1024 / 1024;
            const heapUsedInMB = memoryUsage.heapUsed / 1024 / 1024;
            const heapTotalInMB = memoryUsage.heapTotal / 1024 / 1024;
            
            // Get Heroku dyno memory limit
            // Free dyno: 512MB, Hobby: 512MB, Standard-1X: 512MB, Standard-2X: 1024MB
            const dynoType = process.env.DYNO ? process.env.DYNO.split('.')[0] : 'unknown';
            let memoryLimit = 512; // Default to 512MB
            
            if (dynoType.includes('2X')) {
                memoryLimit = 1024;
            } else if (dynoType.includes('performance')) {
                memoryLimit = 14336; // Performance-L: 14GB
            }
            
            const memoryUsagePercent = rssInMB / memoryLimit;
            
            logger.info(`[Heroku Monitor] Memory usage: RSS ${rssInMB.toFixed(1)}MB, Heap ${heapUsedInMB.toFixed(1)}/${heapTotalInMB.toFixed(1)}MB (${(memoryUsagePercent * 100).toFixed(1)}% of ${memoryLimit}MB limit)`);
            
            // Warn if memory usage is high
            if (memoryUsagePercent > MEMORY_WARNING_THRESHOLD) {
                logger.warn(`[Heroku Monitor] HIGH MEMORY USAGE: ${(memoryUsagePercent * 100).toFixed(1)}% of dyno memory limit`);
                
                // If aggressive cleanup is enabled
                if (process.env.CLEANUP_LEVEL === 'aggressive') {
                    logger.info('[Heroku Monitor] Running aggressive cleanup due to high memory usage');
                    global.gc && global.gc(); // Force garbage collection if available
                    
                    // Try to run memory cleanup (auto-cleanup-backups.js)
                    try {
                        const { execSync } = require('child_process');
                        execSync('node auto-cleanup-backups.js');
                        logger.info('[Heroku Monitor] Executed backup cleanup to reduce memory usage');
                    } catch (err) {
                        logger.error('[Heroku Monitor] Failed to run backup cleanup:', err);
                    }
                }
            }
        } catch (error) {
            logger.error('[Heroku Monitor] Error checking memory usage:', error);
        }
    }, MEMORY_CHECK_INTERVAL);
}

/**
 * Log Heroku dyno information once on startup
 */
function logDynoInformation() {
    try {
        // Get dyno information
        const dyno = process.env.DYNO || 'unknown';
        const dynoType = dyno.split('.')[0] || 'unknown';
        const appName = process.env.HEROKU_APP_NAME || 'unknown';
        
        // Get system information
        const cpuCount = os.cpus().length;
        const totalMemoryMB = Math.round(os.totalmem() / 1024 / 1024);
        const freeMemoryMB = Math.round(os.freemem() / 1024 / 1024);
        const uptime = Math.round(os.uptime() / 60); // In minutes
        
        logger.info('========== Heroku Dyno Information ==========');
        logger.info(`App: ${appName}`);
        logger.info(`Dyno: ${dyno} (${dynoType})`);
        logger.info(`CPUs: ${cpuCount}`);
        logger.info(`Memory: ${totalMemoryMB}MB (${freeMemoryMB}MB free)`);
        logger.info(`System uptime: ${uptime} minutes`);
        logger.info(`Node.js version: ${process.version}`);
        logger.info(`Platform: ${os.platform()} ${os.release()}`);
        logger.info('==============================================');
    } catch (error) {
        logger.error('[Heroku Monitor] Error logging dyno information:', error);
    }
}

/**
 * Check if the bot is healthy
 * @param {Object} connectionManager - The WhatsApp connection manager
 * @returns {Object} Health status object
 */
function getHealthStatus(connectionManager) {
    try {
        const isConnected = connectionManager.getStatus 
            ? connectionManager.getStatus().isConnected 
            : (connectionManager.getConnectionStatus 
                ? connectionManager.getConnectionStatus() === 'connected' 
                : connectionManager.user !== undefined);
        
        const memoryUsage = process.memoryUsage();
        const rssInMB = Math.round(memoryUsage.rss / 1024 / 1024);
        const heapUsedInMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        const systemUptime = Math.round(os.uptime() / 60); // In minutes
        const processUptime = Math.round(process.uptime() / 60); // In minutes
        
        return {
            status: isConnected ? 'healthy' : 'disconnected',
            whatsapp: {
                connected: isConnected,
                user: connectionManager.user?.id || 'unknown'
            },
            system: {
                platform: os.platform(),
                cpus: os.cpus().length,
                memoryTotal: Math.round(os.totalmem() / 1024 / 1024),
                memoryFree: Math.round(os.freemem() / 1024 / 1024),
                systemUptime
            },
            process: {
                memory: {
                    rss: rssInMB,
                    heapUsed: heapUsedInMB,
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
                },
                uptime: processUptime,
                nodeVersion: process.version
            },
            heroku: {
                dyno: process.env.DYNO || 'unknown',
                app: process.env.HEROKU_APP_NAME || 'unknown'
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('[Heroku Monitor] Error getting health status:', error);
        return {
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    startHerokuMonitoring,
    getHealthStatus
};