/**
 * Heroku Deployment Fix Script
 * 
 * This script helps fix common deployment issues and generates proper credentials
 * for Heroku deployment of BlackskyMD.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const zlib = require('zlib');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const crypto = require('crypto');

// Define color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Log with colors for better readability
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

/**
 * Ensures a directory exists, creating it if necessary
 */
async function ensureDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
      log(`Created directory: ${dirPath}`, colors.green);
      return true;
    }
    return true;
  } catch (err) {
    log(`Error creating directory ${dirPath}: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Creates a backup of the auth directory
 */
async function backupAuthDirectory() {
  try {
    const AUTH_DIR = './auth_info_baileys';
    const BACKUP_DIR = './auth_info_baileys_backup_heroku';
    
    // Skip if auth directory doesn't exist
    if (!fs.existsSync(AUTH_DIR)) {
      log(`Auth directory not found at ${AUTH_DIR}. No backup needed.`, colors.yellow);
      return false;
    }
    
    // Ensure backup directory exists
    await ensureDirectory(BACKUP_DIR);
    
    // Copy creds.json if it exists
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const credsData = await readFile(credsPath, 'utf8');
      await writeFile(path.join(BACKUP_DIR, 'creds.json'), credsData, 'utf8');
      log('Auth credentials backed up successfully', colors.green);
      return true;
    } else {
      log('No creds.json found to backup', colors.yellow);
      return false;
    }
  } catch (err) {
    log(`Error backing up auth directory: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Generates Heroku credentials from current auth
 */
async function generateHerokuCredentials() {
  try {
    const AUTH_DIR = './auth_info_baileys';
    const CREDS_FILE = path.join(AUTH_DIR, 'creds.json');
    
    // Check if creds file exists
    if (!fs.existsSync(CREDS_FILE)) {
      log('Error: No credentials file found!', colors.red);
      log('Please run the bot first and connect to WhatsApp before generating Heroku credentials.', colors.yellow);
      return false;
    }
    
    // Read credentials
    log('Reading WhatsApp credentials...', colors.blue);
    const credsData = await readFile(CREDS_FILE, 'utf8');
    
    // Parse credentials to check validity
    try {
      const credsObj = JSON.parse(credsData);
      if (!credsObj || !credsObj.me || !credsObj.me.id) {
        log('Error: Invalid credentials data!', colors.red);
        return false;
      }
      
      // Log some info about the credentials
      log('Credentials loaded successfully', colors.green);
      log(`Device: ${credsObj.me?.id?.split(':')[0] || 'Unknown'}`, colors.cyan);
      log(`Name: ${credsObj.me?.name || 'Unknown'}`, colors.cyan);
    } catch (parseErr) {
      log(`Error parsing credentials: ${parseErr.message}`, colors.red);
      return false;
    }
    
    // Compress credentials for Heroku
    log('Compressing credentials for Heroku...', colors.blue);
    const compressed = await gzip(credsData);
    const base64Data = compressed.toString('base64');
    
    log('Credentials prepared successfully for Heroku', colors.green);
    log(`Original size: ${credsData.length} bytes`, colors.dim);
    log(`Compressed: ${compressed.length} bytes`, colors.dim);
    log(`Base64: ${base64Data.length} bytes`, colors.dim);
    
    // Output the credentials for Heroku
    log('\n===== HEROKU CREDENTIALS =====', colors.bright + colors.green);
    log('Add the following to your Heroku config vars:', colors.cyan);
    log('Variable name: CREDS_DATA', colors.yellow);
    log('Value:', colors.reset);
    console.log(base64Data);
    log('================================\n', colors.bright + colors.green);
    
    log('Instructions:', colors.cyan);
    log('1. Copy the entire string above', colors.reset);
    log('2. In your Heroku dashboard, go to Settings > Config Vars', colors.reset);
    log('3. Add a new config var with KEY="CREDS_DATA" and VALUE=<the string you copied>', colors.reset);
    log('4. Deploy your app to Heroku', colors.reset);
    log('5. Your bot should connect without showing a QR code', colors.reset);
    
    return true;
  } catch (err) {
    log(`Error generating Heroku credentials: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Fix the Procfile configuration
 */
async function fixProcfile() {
  try {
    const procfilePath = './Procfile';
    const correctContent = 'web: node src/index.js\n';
    
    // Check if Procfile exists
    if (fs.existsSync(procfilePath)) {
      const currentContent = await readFile(procfilePath, 'utf8');
      
      if (currentContent.trim() !== correctContent.trim()) {
        log('Updating Procfile with correct configuration...', colors.blue);
        await writeFile(procfilePath, correctContent, 'utf8');
        log('Procfile updated successfully', colors.green);
      } else {
        log('Procfile already has the correct configuration', colors.green);
      }
    } else {
      log('Creating Procfile with correct configuration...', colors.blue);
      await writeFile(procfilePath, correctContent, 'utf8');
      log('Procfile created successfully', colors.green);
    }
    
    return true;
  } catch (err) {
    log(`Error fixing Procfile: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Main function to fix Heroku deployment
 */
async function main() {
  log('\n========================================', colors.bright + colors.cyan);
  log('  BLACKSKY-MD HEROKU DEPLOYMENT FIXER  ', colors.bright + colors.white);
  log('========================================\n', colors.bright + colors.cyan);
  
  log('This script will help fix common issues with Heroku deployment', colors.reset);
  log('and generate the necessary credentials for smooth operation.\n', colors.reset);
  
  // Run the fixes
  await backupAuthDirectory();
  await generateHerokuCredentials();
  await fixProcfile();
  
  log('\nAll done! Your bot should now be ready for Heroku deployment.', colors.green);
  log('Remember to add the CREDS_DATA environment variable to your Heroku app!', colors.yellow);
}

// Run the main function
main().catch(err => {
  log(`Unexpected error: ${err.message}`, colors.red);
  process.exit(1);
});