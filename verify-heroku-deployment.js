/**
 * Heroku Deployment Verification Script
 * 
 * This script helps troubleshoot Heroku deployment issues for BlackskyMD
 * by checking critical configuration elements and providing specific guidance
 */

const fs = require('fs');
const path = require('path');

// Constants
const AUTH_DIR = process.env.AUTH_DIR || 'auth_info_baileys';
const DEFAULT_CREDS_PATH = path.join(process.cwd(), AUTH_DIR, 'creds.json');

// ANSI colors for nicer output
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
 * Verifies the Procfile configuration
 */
function checkProcfile() {
  try {
    const procfilePath = path.join(process.cwd(), 'Procfile');
    if (!fs.existsSync(procfilePath)) {
      log('❌ Procfile not found!', colors.red);
      log('   Create a Procfile with: web: node src/index.js', colors.yellow);
      return false;
    }

    const content = fs.readFileSync(procfilePath, 'utf8').trim();
    if (!content.startsWith('web:')) {
      log('❌ Procfile does not start with "web:"', colors.red);
      log('   Update Procfile to start with "web:" like: web: node src/index.js', colors.yellow);
      return false;
    }

    log('✅ Procfile configuration looks good', colors.green);
    return true;
  } catch (error) {
    log(`❌ Error checking Procfile: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Checks if CREDS_DATA environment variable exists and is valid
 */
function checkCredsData() {
  if (!process.env.CREDS_DATA) {
    log('❌ CREDS_DATA environment variable not found!', colors.red);
    log('   You need to provide WhatsApp session credentials via CREDS_DATA.', colors.yellow);
    log('   Run "node heroku-credentials-helper.js" locally to generate these credentials.', colors.yellow);
    return false;
  }

  // Basic validation of CREDS_DATA format
  const credsData = process.env.CREDS_DATA;
  if (credsData.length < 100) {
    log('❌ CREDS_DATA environment variable is too short to be valid!', colors.red);
    log('   The CREDS_DATA should be a long base64-encoded string.', colors.yellow);
    return false;
  }

  // Check if it looks like base64
  try {
    const buffer = Buffer.from(credsData, 'base64');
    if (buffer.toString('base64') !== credsData) {
      log('⚠️ CREDS_DATA doesn\'t appear to be valid base64 encoding', colors.yellow);
      return false;
    }
  } catch (error) {
    log('❌ Error validating CREDS_DATA: not a valid base64 string', colors.red);
    return false;
  }

  log('✅ CREDS_DATA environment variable exists and looks valid', colors.green);
  return true;
}

/**
 * Checks if required environment variables are present
 */
function checkRequiredEnvVars() {
  const required = [
    { name: 'PLATFORM', expected: 'heroku' },
    { name: 'NODE_ENV', expected: 'production' },
    { name: 'OWNER_NUMBER', expected: null }
  ];

  let allPresent = true;

  for (const variable of required) {
    const value = process.env[variable.name];
    if (!value) {
      log(`❌ Required environment variable ${variable.name} is missing!`, colors.red);
      allPresent = false;
      continue;
    }

    if (variable.expected && value !== variable.expected) {
      log(`⚠️ ${variable.name} should be "${variable.expected}" but is "${value}"`, colors.yellow);
    } else {
      log(`✅ ${variable.name} is set to ${value}`, colors.green);
    }
  }

  return allPresent;
}

/**
 * Checks for credentials within the auth directory
 */
function checkAuthDirectory() {
  try {
    const authDir = path.join(process.cwd(), AUTH_DIR);
    if (!fs.existsSync(authDir)) {
      log(`❌ Auth directory "${AUTH_DIR}" does not exist!`, colors.red);
      return false;
    }

    // Check if creds.json exists
    if (!fs.existsSync(DEFAULT_CREDS_PATH)) {
      log('❌ creds.json file not found in auth directory!', colors.red);
      return false;
    }

    // Count JSON files in auth directory
    const files = fs.readdirSync(authDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    log(`✅ Auth directory contains ${jsonFiles.length} JSON files`, colors.green);

    return true;
  } catch (error) {
    log(`❌ Error checking auth directory: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Check if port configuration is correct
 */
function checkPortConfiguration() {
  const port = process.env.PORT;
  if (!port) {
    log('⚠️ PORT environment variable not set by Heroku!', colors.yellow);
    log('   This is unusual. Heroku should automatically set the PORT.', colors.yellow);
    return false;
  }

  log(`✅ PORT environment variable set to ${port}`, colors.green);
  return true;
}

/**
 * Run all checks and summarize issues
 */
function runAllChecks() {
  log('\n==== BLACKSKY-MD HEROKU DEPLOYMENT VERIFICATION ====', colors.cyan);
  log(`Time: ${new Date().toISOString()}`);
  log(`Node.js: ${process.version}`);
  log('----------------------------------------------------', colors.cyan);

  const results = {
    procfile: checkProcfile(),
    credsData: checkCredsData(),
    envVars: checkRequiredEnvVars(),
    authDirectory: checkAuthDirectory(),
    portConfiguration: checkPortConfiguration()
  };

  log('\n==== VERIFICATION RESULTS ====', colors.magenta);

  const allPassed = Object.values(results).every(result => result === true);

  if (allPassed) {
    log('\n✅ All checks PASSED! Your configuration looks good.', colors.green);
    log('   If your bot is still not running, check the logs with:', colors.cyan);
    log('   heroku logs --tail -a your-app-name', colors.cyan);
  } else {
    log('\n⚠️ Some checks FAILED. Please fix the issues highlighted above.', colors.yellow);
    
    // Provide specific recommendations based on what failed
    if (!results.procfile) {
      log('\n→ Fix your Procfile to start with "web:" like:', colors.cyan);
      log('  web: node src/index.js', colors.white);
    }
    
    if (!results.credsData) {
      log('\n→ Generate and set the CREDS_DATA environment variable:', colors.cyan);
      log('  1. Run the bot locally with: npm start', colors.white);
      log('  2. Scan the QR code to connect to WhatsApp', colors.white);
      log('  3. Run: node heroku-credentials-helper.js', colors.white);
      log('  4. Copy the output and set as CREDS_DATA in Heroku dashboard', colors.white);
    }
    
    if (!results.envVars) {
      log('\n→ Set these required environment variables in Heroku dashboard:', colors.cyan);
      log('  PLATFORM=heroku', colors.white);
      log('  NODE_ENV=production', colors.white);
      log('  OWNER_NUMBER=your-whatsapp-number (without + sign)', colors.white);
    }
  }
  
  log('\n==== END OF VERIFICATION ====\n', colors.magenta);
}

// Run the checks
runAllChecks();