/**
 * Platform Helper Utility
 * Provides utilities for cloud deployments, including credential management
 * Supports Heroku, Railway, and other platforms
 */

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const logger = require('./logger');

const gunzip = util.promisify(zlib.gunzip);
const gzip = util.promisify(zlib.gzip);

/**
 * Check if running on Heroku
 * @returns {boolean} Whether running on Heroku
 */
function isHeroku() {
    return !!process.env.DYNO;
}

/**
 * Check if running on Railway
 * @returns {boolean} Whether running on Railway
 */
function isRailway() {
    return !!process.env.RAILWAY_SERVICE_ID;
}

/**
 * Check if running on any cloud platform
 * @returns {boolean} Whether running on a cloud platform
 */
function isCloudPlatform() {
    return isHeroku() || isRailway() || process.env.PLATFORM === 'cloud';
}

/**
 * Check if credentials data exists in environment
 * @returns {boolean} Whether credentials data exists
 */
function hasCredsData() {
    return !!process.env.CREDS_DATA && process.env.CREDS_DATA.length > 100;
}

/**
 * Initialize auth directory with credentials from environment if needed
 * @returns {Promise<boolean>} Success status
 */
async function initializeAuthFromEnv() {
    if (!hasCredsData()) {
        logger.info('No CREDS_DATA found in environment variables');
        return false;
    }

    try {
        // Determine the auth directory
        const authDir = process.env.AUTH_DIR || 'auth_info_baileys';
        const authDirPath = path.join(process.cwd(), authDir);

        // Ensure auth directory exists
        try {
            await fs.access(authDirPath);
        } catch (error) {
            logger.info(`Creating directory: ${authDirPath}`);
            await fs.mkdir(authDirPath, { recursive: true });
        }
        
        // Get base64 compressed data from environment
        const compressedData = process.env.CREDS_DATA;
        logger.info(`Found CREDS_DATA (${Math.round(compressedData.length / 1024)} KB)`);
        
        // Decode and decompress
        const compressedBuffer = Buffer.from(compressedData, 'base64');
        const decompressedBuffer = await gunzip(compressedBuffer);
        const credsData = JSON.parse(decompressedBuffer.toString('utf8'));
        
        // Write each credential file
        let fileCount = 0;
        for (const [filename, content] of Object.entries(credsData)) {
            const filePath = path.join(authDirPath, filename);
            await fs.writeFile(filePath, content);
            fileCount++;
        }
        
        logger.success(`Successfully restored ${fileCount} credential files from environment`);
        return true;
    } catch (error) {
        logger.error(`Error initializing auth from environment: ${error.message}`);
        return false;
    }
}

/**
 * Decompress credentials data
 * @param {string} data Compressed credentials data
 * @returns {Promise<string|object|null>} Decompressed data as string, object of files, or null if error
 */
async function decompressCredsData(data) {
    try {
        // Decode base64 and decompress
        const compressedBuffer = Buffer.from(data, 'base64');
        const decompressedBuffer = await gunzip(compressedBuffer);
        const decompressedData = decompressedBuffer.toString('utf8');
        
        // Try to parse as JSON (if it's file data)
        try {
            return JSON.parse(decompressedData);
        } catch (parseError) {
            // Return as plain string if not JSON
            return decompressedData;
        }
    } catch (error) {
        logger.error(`Error decompressing credentials data: ${error.message}`);
        return null;
    }
}

/**
 * Compress credentials data for transmission
 * @returns {Promise<string|null>} Compressed data as base64 string or null if error
 */
async function compressCredsData() {
    try {
        // Determine the auth directory
        const authDir = process.env.AUTH_DIR || 'auth_info_baileys';
        const authDirPath = path.join(process.cwd(), authDir);
        
        // Check if directory exists
        try {
            await fs.access(authDirPath);
        } catch (error) {
            logger.error(`Auth directory not found: ${authDirPath}`);
            return null;
        }
        
        // Read all files in auth directory
        const files = await fs.readdir(authDirPath);
        const credsData = {};
        
        // Process each file
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(authDirPath, file);
                credsData[file] = await fs.readFile(filePath, 'utf8');
            }
        }
        
        // Compress and encode
        const dataString = JSON.stringify(credsData);
        const compressedBuffer = await gzip(dataString);
        const base64Data = compressedBuffer.toString('base64');
        
        logger.info(`Compressed ${Object.keys(credsData).length} credential files (${Math.round(base64Data.length / 1024)} KB)`);
        return base64Data;
    } catch (error) {
        logger.error(`Error compressing credentials data: ${error.message}`);
        return null;
    }
}

/**
 * Get the current credentials as a compact string for transmission
 * @returns {Promise<string|null>} Credentials data or null if error
 */
async function getCredsForTransmission() {
    return await compressCredsData();
}

/**
 * Get Railway environment information
 * @returns {Object} Railway environment details
 */
function getRailwayEnvironmentInfo() {
    return {
        isRailway: isRailway(),
        serviceId: process.env.RAILWAY_SERVICE_ID || 'unknown',
        serviceName: process.env.RAILWAY_SERVICE_NAME || 'unknown',
        projectId: process.env.RAILWAY_PROJECT_ID || 'unknown',
        projectName: process.env.RAILWAY_PROJECT_NAME || 'unknown',
        environmentName: process.env.RAILWAY_ENVIRONMENT_NAME || 'unknown',
        staticUrl: process.env.RAILWAY_STATIC_URL || 'unknown'
    };
}

/**
 * Generate Railway deployment helper info for logs
 * @returns {string} Formatted info string
 */
function getRailwayDeploymentHelperInfo() {
    if (!isRailway()) {
        return 'Not running on Railway';
    }
    
    return `
Railway Deployment Helper
------------------------
Project: ${process.env.RAILWAY_PROJECT_NAME || 'unknown'} (${process.env.RAILWAY_PROJECT_ID || 'unknown'})
Service: ${process.env.RAILWAY_SERVICE_NAME || 'unknown'} (${process.env.RAILWAY_SERVICE_ID || 'unknown'})
Environment: ${process.env.RAILWAY_ENVIRONMENT_NAME || 'unknown'}
URL: ${process.env.RAILWAY_STATIC_URL || 'unknown'}

To save WhatsApp credentials, create a CREDS_DATA environment variable 
in your Railway project with the output of 'node heroku-credentials-helper.js'
from your local machine after connecting successfully.
`;
}

module.exports = {
    isHeroku,
    isRailway,
    isCloudPlatform,
    hasCredsData,
    initializeAuthFromEnv,
    decompressCredsData,
    compressCredsData,
    getCredsForTransmission,
    getRailwayEnvironmentInfo,
    getRailwayDeploymentHelperInfo
};