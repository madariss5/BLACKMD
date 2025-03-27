/**
 * Direct Heroku Helper Utility
 * This module directly uses CREDS_DATA as raw JSON instead of base64/compressed format
 * To be used in conjunction with direct-creds-helper.js
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const zlib = require('zlib');
const gunzip = promisify(zlib.gunzip);

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
  return !!process.env.RAILWAY_STATIC_URL;
}

/**
 * Check if running on any cloud platform
 * @returns {boolean} Whether running on a cloud platform
 */
function isCloudPlatform() {
  return isHeroku() || isRailway();
}

/**
 * Check if credentials data exists in environment
 * @returns {boolean} Whether credentials data exists
 */
function hasCredsData() {
  return !!process.env.CREDS_DATA;
}

/**
 * Initialize auth directory with credentials from environment if needed
 * @returns {Promise<boolean>} Success status
 */
async function initializeAuthFromEnv() {
  try {
    // Check prerequisites
    if (!isCloudPlatform()) {
      console.log('Not running on a cloud platform, skipping credentials initialization');
      return false;
    }

    if (!hasCredsData()) {
      console.log('No CREDS_DATA found in environment variables');
      return false;
    }

    // Create auth directory if it doesn't exist
    const AUTH_DIR = path.join(process.cwd(), 'auth_info_baileys');
    await mkdir(AUTH_DIR, { recursive: true });

    const credsPath = path.join(AUTH_DIR, 'creds.json');
    console.log(`Setting up WhatsApp credentials at ${credsPath}`);

    // Get credentials from environment variable
    let credsData = process.env.CREDS_DATA;
    
    try {
      // Try to parse it directly first (it might be uncompressed JSON)
      JSON.parse(credsData);
      console.log('Found direct JSON credentials');
    } catch (e) {
      // Not valid JSON, try to decode base64 and decompress
      try {
        console.log('Attempting to decompress base64 credentials...');
        const buffer = Buffer.from(credsData, 'base64');
        const decompressed = await gunzip(buffer);
        credsData = decompressed.toString('utf8');
        
        // Validate the decompressed data is valid JSON
        JSON.parse(credsData);
        console.log('Successfully decompressed credentials');
      } catch (decompressError) {
        console.error('Failed to decompress credentials:', decompressError.message);
        return false;
      }
    }

    // Write credentials to file
    await writeFile(credsPath, credsData, 'utf8');
    console.log('WhatsApp credentials initialized successfully');
    
    return true;
  } catch (error) {
    console.error('Error initializing credentials:', error.message);
    return false;
  }
}

module.exports = {
  isHeroku,
  isRailway,
  isCloudPlatform,
  hasCredsData,
  initializeAuthFromEnv
};