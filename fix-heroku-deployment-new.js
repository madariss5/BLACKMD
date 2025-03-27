/**
 * Heroku Deployment Fix Script
 * 
 * This script helps fix common deployment issues and generates proper credentials
 * for Heroku deployment of BlackskyMD.
 */

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const { execSync } = require('child_process');

// Promisify zlib functions
const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);

// Constants
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
const BACKUP_DIR = path.join(__dirname, 'auth_backup_for_heroku');

// ANSI colors for nicer console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

/**
 * Ensures a directory exists, creating it if necessary
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (err) {
    await fs.mkdir(dirPath, { recursive: true });
    log(`Created directory: ${dirPath}`, colors.green);
  }
}

/**
 * Creates a backup of the auth directory
 */
async function backupAuthDirectory() {
  try {
    // Create backup directory
    await ensureDirectory(BACKUP_DIR);
    
    // Check if auth directory exists
    try {
      await fs.access(AUTH_DIR);
    } catch (err) {
      log(`Auth directory not found: ${AUTH_DIR}`, colors.red);
      return false;
    }
    
    // List files in auth directory
    const files = await fs.readdir(AUTH_DIR);
    if (files.length === 0) {
      log('Auth directory is empty. No files to backup.', colors.yellow);
      return false;
    }
    
    // Copy each file to backup directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubdir = path.join(BACKUP_DIR, `backup-${timestamp}`);
    await ensureDirectory(backupSubdir);
    
    let copyCount = 0;
    for (const file of files) {
      const sourcePath = path.join(AUTH_DIR, file);
      const destPath = path.join(backupSubdir, file);
      
      // Skip directories
      const stats = await fs.stat(sourcePath);
      if (stats.isDirectory()) continue;
      
      await fs.copyFile(sourcePath, destPath);
      copyCount++;
    }
    
    log(`✅ Successfully backed up ${copyCount} files to ${backupSubdir}`, colors.green);
    return true;
  } catch (error) {
    log(`Error backing up auth directory: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Generates Heroku credentials from current auth
 */
async function generateHerokuCredentials() {
  try {
    // Check if auth_info_baileys exists
    try {
      await fs.access(AUTH_DIR);
    } catch (err) {
      log('ERROR: auth_info_baileys directory not found!', colors.red);
      log('You must first start the bot and connect to WhatsApp.', colors.yellow);
      return null;
    }
    
    // Read all files in the auth_info_baileys directory
    const files = await fs.readdir(AUTH_DIR);
    if (files.length === 0) {
      log('ERROR: No credentials found!', colors.red);
      return null;
    }
    
    // Create an object with all file contents
    const creds = {};
    let credCount = 0;
    
    // Prioritize the creds.json file
    const credsJsonPath = path.join(AUTH_DIR, 'creds.json');
    try {
      const stats = await fs.stat(credsJsonPath);
      if (stats.isFile()) {
        const content = await fs.readFile(credsJsonPath, 'utf8');
        creds['creds.json'] = content;
        credCount++;
        log('✅ Successfully read creds.json', colors.green);
      }
    } catch (err) {
      log('⚠️ creds.json not found! Session may not work properly on Heroku.', colors.yellow);
    }
    
    // Add all other JSON files
    for (const file of files) {
      if (file.endsWith('.json') && file !== 'creds.json') {
        try {
          const filePath = path.join(AUTH_DIR, file);
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            const content = await fs.readFile(filePath, 'utf8');
            creds[file] = content;
            credCount++;
          }
        } catch (err) {
          log(`Skipping file ${file} due to error: ${err.message}`, colors.yellow);
        }
      }
    }
    
    log(`Total credential files processed: ${credCount}`, colors.blue);
    
    if (credCount === 0) {
      log('ERROR: No valid credential files found!', colors.red);
      return null;
    }
    
    // Compress the data
    const credsStr = JSON.stringify(creds);
    const compressed = await gzip(Buffer.from(credsStr, 'utf8'));
    
    // Convert to Base64
    const base64Data = compressed.toString('base64');
    
    // Additional sanity check - make sure the base64 string is valid
    try {
      const testBuffer = Buffer.from(base64Data, 'base64');
      if (testBuffer.length > 0) {
        log(`✅ Base64 encoding successful (${Math.round(base64Data.length / 1024)} KB)`, colors.green);
      }
    } catch (err) {
      log(`ERROR: Failed to validate Base64 encoding: ${err.message}`, colors.red);
      return null;
    }
    
    return base64Data;
  } catch (error) {
    log(`Error generating Heroku credentials: ${error.message}`, colors.red);
    return null;
  }
}

/**
 * Fix the Procfile configuration
 */
async function fixProcfile() {
  try {
    const procfilePath = path.join(__dirname, 'Procfile');
    
    // Check if Procfile exists
    let content = '';
    try {
      content = await fs.readFile(procfilePath, 'utf8');
    } catch (err) {
      log('Procfile not found, creating it...', colors.yellow);
    }
    
    // Check if Procfile has correct format
    if (!content.trim().startsWith('web:')) {
      const newContent = 'web: YOUTUBE_DL_SKIP_PYTHON_CHECK=1 node src/index.js';
      await fs.writeFile(procfilePath, newContent);
      log('✅ Fixed Procfile with correct web process definition', colors.green);
    } else {
      log('✅ Procfile already has correct format', colors.green);
    }
    
    return true;
  } catch (error) {
    log(`Error fixing Procfile: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Main function to fix Heroku deployment
 */
async function main() {
  log('\n==== BLACKSKY-MD HEROKU DEPLOYMENT FIX TOOL ====', colors.cyan);
  log(`Time: ${new Date().toISOString()}`);
  
  // 1. Backup auth directory first
  log('\n1. Creating backup of auth directory...', colors.blue);
  await backupAuthDirectory();
  
  // 2. Fix Procfile
  log('\n2. Checking and fixing Procfile...', colors.blue);
  await fixProcfile();
  
  // 3. Generate Heroku credentials
  log('\n3. Generating Heroku credentials...', colors.blue);
  const credsData = await generateHerokuCredentials();
  if (!credsData) {
    log('Could not generate credentials. Please make sure the bot is running and connected to WhatsApp.', colors.red);
    return;
  }
  
  // 4. Save credentials to file
  const backupFile = path.join(__dirname, 'heroku-creds-data.txt');
  await fs.writeFile(backupFile, credsData);
  log(`✅ Saved credentials to ${backupFile}`, colors.green);
  
  // 5. Show instructions
  log('\n==== DEPLOYMENT INSTRUCTIONS ====', colors.magenta);
  log('\n1. Add the following environment variables to your Heroku app:', colors.white);
  log('   In Heroku Dashboard: Settings → Config Vars → Add', colors.white);
  log('\n   Key: CREDS_DATA', colors.cyan);
  log('   Value: (The long string in the heroku-creds-data.txt file)', colors.cyan);
  log('\n   Key: PLATFORM', colors.cyan);
  log('   Value: heroku', colors.cyan);
  log('\n   Key: NODE_ENV', colors.cyan);
  log('   Value: production', colors.cyan);
  log('\n   Key: OWNER_NUMBER', colors.cyan);
  log('   Value: your_number (without + sign)', colors.cyan);
  
  log('\n2. Make sure you have the required buildpacks:', colors.white);
  log('   heroku buildpacks:add heroku/nodejs -a your-app-name', colors.cyan);
  log('   heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest -a your-app-name', colors.cyan);
  
  log('\n3. Deploy your app to Heroku again, then check the logs:', colors.white);
  log('   git push heroku main', colors.cyan);
  log('   heroku logs --tail -a your-app-name', colors.cyan);
  
  log('\n4. If the bot still does not start, try restarting the Heroku dyno:', colors.white);
  log('   heroku restart -a your-app-name', colors.cyan);
  
  log('\n==== END OF DEPLOYMENT FIX TOOL ====\n', colors.magenta);
}

// Run the main function
main().catch(err => {
  log(`Unhandled error: ${err.message}`, colors.red);
});