/**
 * Heroku Session Auto-Repair Script
 * This script automatically repairs WhatsApp session when conflict errors occur
 * It runs before the main bot process on Heroku deployment
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const zlib = require('zlib');
const gunzip = promisify(zlib.gunzip);

function log(message) {
  console.log(`[Heroku-Repair] ${message}`);
}

/**
 * Ensure a directory exists, creating it if needed
 * @param {string} dirPath - Path to directory
 * @returns {Promise<boolean>} - Whether the directory exists after the operation
 */
async function ensureDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
      log(`Created directory: ${dirPath}`);
    }
    return true;
  } catch (error) {
    log(`Error creating directory ${dirPath}: ${error.message}`);
    return false;
  }
}

/**
 * Check if running on Heroku
 * @returns {boolean} - Whether running on Heroku
 */
function isHeroku() {
  return !!process.env.DYNO;
}

/**
 * Check if CREDS_DATA environment variable is set
 * @returns {boolean} - Whether CREDS_DATA exists
 */
function hasCredsData() {
  return !!process.env.CREDS_DATA;
}

/**
 * Initialize auth directory from CREDS_DATA environment variable
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
async function initializeAuthFromEnv() {
  try {
    // Check if running on Heroku and has credentials
    if (!isHeroku()) {
      log('Not running on Heroku, skipping credentials initialization');
      return false;
    }

    if (!hasCredsData()) {
      log('No CREDS_DATA found in environment variables');
      return false;
    }

    // Create auth directory if it doesn't exist
    const AUTH_DIR = path.join(process.cwd(), 'auth_info_baileys');
    await ensureDirectory(AUTH_DIR);

    const credsPath = path.join(AUTH_DIR, 'creds.json');
    log(`Setting up WhatsApp credentials at ${credsPath}`);

    // Get credentials from environment variable
    let credsData = process.env.CREDS_DATA;
    
    try {
      // Try to parse it directly first (it might be uncompressed JSON)
      JSON.parse(credsData);
      log('Found direct JSON credentials');
    } catch (e) {
      // Not valid JSON, try to decode base64 and decompress
      try {
        log('Attempting to decompress base64 credentials...');
        const buffer = Buffer.from(credsData, 'base64');
        const decompressed = await gunzip(buffer);
        credsData = decompressed.toString('utf8');
        
        // Validate the decompressed data is valid JSON
        JSON.parse(credsData);
        log('Successfully decompressed credentials');
      } catch (decompressError) {
        log(`Failed to decompress credentials: ${decompressError.message}`);
        return false;
      }
    }

    // Write credentials to file
    await writeFile(credsPath, credsData);
    log('WhatsApp credentials initialized successfully');
    
    return true;
  } catch (error) {
    log(`Error initializing credentials: ${error.message}`);
    return false;
  }
}

/**
 * Clean up unnecessary session files to prevent conflicts
 * @returns {Promise<boolean>} - Whether cleanup was successful
 */
async function cleanupSessionFiles() {
  try {
    const AUTH_DIR = path.join(process.cwd(), 'auth_info_baileys');
    
    // Skip if auth directory doesn't exist
    if (!fs.existsSync(AUTH_DIR)) {
      log('Auth directory does not exist, skipping cleanup');
      return false;
    }
    
    // Read all files in auth directory
    const files = fs.readdirSync(AUTH_DIR);
    let cleanupCount = 0;
    
    // Keep only creds.json and critical files
    for (const file of files) {
      if (file !== 'creds.json' && 
          file !== 'app-state-sync-key.json' && 
          file !== 'app-state-sync-version.json') {
        
        const filePath = path.join(AUTH_DIR, file);
        try {
          // Check if it's a file before attempting to delete
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            cleanupCount++;
          }
        } catch (unlinkError) {
          log(`Error removing file ${file}: ${unlinkError.message}`);
        }
      }
    }
    
    log(`Cleaned up ${cleanupCount} unnecessary session files`);
    return true;
  } catch (error) {
    log(`Error cleaning up session files: ${error.message}`);
    return false;
  }
}

/**
 * Main function to run session repair
 */
async function main() {
  try {
    log('Starting Heroku session auto-repair');
    
    // Initialize auth from environment variables if needed
    const initResult = await initializeAuthFromEnv();
    if (initResult) {
      log('Successfully initialized auth from environment variables');
    }
    
    // Clean up session files to prevent conflicts
    const cleanupResult = await cleanupSessionFiles();
    if (cleanupResult) {
      log('Successfully cleaned up session files');
    }
    
    log('Session repair completed');
    return true;
  } catch (error) {
    log(`Error during session repair: ${error.message}`);
    return false;
  }
}

// Run the main function
if (require.main === module) {
  log('Running as main script');
  main().then(result => {
    if (result) {
      log('Session repair successful');
    } else {
      log('Session repair completed with warnings');
    }
  }).catch(error => {
    log(`Unexpected error: ${error.message}`);
    process.exit(1);
  });
} else {
  log('Loaded as module');
}

module.exports = {
  initializeAuthFromEnv,
  cleanupSessionFiles,
  isHeroku,
  hasCredsData
};