/**
 * Enhanced Heroku Monitoring Tool for BlackskyMD
 * 
 * This script provides detailed diagnostics and monitoring for Heroku deployments.
 * Run it from the command line or access it through the web interface.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ANSI colors for nice terminal output
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
 * Check if we're running on Heroku
 */
function isHeroku() {
  return process.env.PLATFORM === 'heroku' || !!process.env.DYNO;
}

/**
 * Get information about the Heroku environment
 */
function getHerokuInfo() {
  if (!isHeroku()) {
    return {
      isHeroku: false,
      message: 'Not running on Heroku'
    };
  }

  return {
    isHeroku: true,
    dyno: process.env.DYNO || 'unknown',
    appName: process.env.HEROKU_APP_NAME || 'unknown',
    dynoSize: process.env.DYNO_SIZE || 'unknown',
    region: process.env.HEROKU_REGION || 'unknown',
    nodeEnv: process.env.NODE_ENV || 'unknown',
    stack: process.env.STACK || 'unknown',
    owner: process.env.OWNER_NUMBER || 'not set',
    haveCreds: !!process.env.CREDS_DATA,
    port: process.env.PORT || '(default)'
  };
}

/**
 * Check port status
 */
function checkPortStatus() {
  if (!isHeroku()) {
    return {
      ok: false,
      message: 'Not running on Heroku'
    };
  }

  const port = process.env.PORT;
  if (!port) {
    return {
      ok: false,
      message: 'PORT environment variable not set'
    };
  }

  // More complex check would require actually binding to the port,
  // but that might interfere with the running server

  return {
    ok: true,
    port: port,
    message: `PORT is set to ${port}`
  };
}

/**
 * Check the auth directory
 */
function checkAuthDirectory() {
  const authDir = process.env.AUTH_DIR || 'auth_info_baileys';
  const authPath = path.join(process.cwd(), authDir);
  
  let result = {
    exists: false,
    path: authPath,
    files: [],
    hasCredsJson: false,
    fileCount: 0,
    errors: []
  };
  
  try {
    if (!fs.existsSync(authPath)) {
      result.errors.push('Auth directory does not exist');
      return result;
    }
    
    result.exists = true;
    const files = fs.readdirSync(authPath);
    result.fileCount = files.length;
    
    for (const file of files) {
      const filePath = path.join(authPath, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          const fileInfo = {
            name: file,
            size: stats.size,
            modified: stats.mtime
          };
          
          if (file === 'creds.json') {
            result.hasCredsJson = true;
            try {
              // Check if it's valid JSON
              const content = fs.readFileSync(filePath, 'utf8');
              JSON.parse(content);
              fileInfo.validJson = true;
            } catch (e) {
              fileInfo.validJson = false;
              fileInfo.jsonError = e.message;
              result.errors.push(`creds.json is not valid JSON: ${e.message}`);
            }
          }
          
          result.files.push(fileInfo);
        }
      } catch (err) {
        result.errors.push(`Error accessing file ${file}: ${err.message}`);
      }
    }
    
    if (!result.hasCredsJson) {
      result.errors.push('creds.json is missing');
    }
    
  } catch (error) {
    result.errors.push(`Error checking auth directory: ${error.message}`);
  }
  
  return result;
}

/**
 * Perform basic credential data verification
 */
function checkCredsData() {
  const credsData = process.env.CREDS_DATA;
  
  if (!credsData) {
    return {
      exists: false,
      valid: false,
      message: 'CREDS_DATA environment variable not set'
    };
  }
  
  // Very basic validation - just check if it looks like base64
  try {
    const regex = /^[A-Za-z0-9+\/=]+$/;
    const isValidBase64 = regex.test(credsData);
    
    if (!isValidBase64) {
      return {
        exists: true,
        valid: false,
        message: 'CREDS_DATA does not appear to be valid base64 encoded data'
      };
    }
    
    // Check if it's of a reasonable length
    if (credsData.length < 100) {
      return {
        exists: true,
        valid: false,
        message: 'CREDS_DATA is too short to be valid credentials'
      };
    }
    
    return {
      exists: true,
      valid: true,
      length: credsData.length,
      sizeKB: Math.round(credsData.length / 1024),
      message: 'CREDS_DATA exists and appears to be valid'
    };
  } catch (error) {
    return {
      exists: true,
      valid: false,
      message: `Error validating CREDS_DATA: ${error.message}`
    };
  }
}

/**
 * Check if a WhatsApp connection is active
 */
function checkWhatsAppConnection() {
  // We'd need to check if the WhatsApp connection is active
  // This requires access to the running instance
  
  // For a standalone script, we can only check indicators
  const authResult = checkAuthDirectory();
  const credsResult = checkCredsData();
  
  return {
    authDirectory: authResult.exists && authResult.hasCredsJson,
    credsData: credsResult.valid,
    likelyConnected: authResult.exists && authResult.hasCredsJson && credsResult.valid,
    issues: [
      ...authResult.errors,
      credsResult.valid ? null : credsResult.message
    ].filter(Boolean)
  };
}

/**
 * Get system resources usage
 */
function getSystemResources() {
  const memoryUsage = process.memoryUsage();
  
  return {
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
      total: Math.round(os.totalmem() / 1024 / 1024 * 100) / 100,
      free: Math.round(os.freemem() / 1024 / 1024 * 100) / 100
    },
    cpu: os.cpus(),
    loadAvg: os.loadavg()
  };
}

/**
 * Run all diagnostics and display results
 */
function runAllDiagnostics() {
  const herokuInfo = getHerokuInfo();
  const portStatus = checkPortStatus();
  const authDirStatus = checkAuthDirectory();
  const credsStatus = checkCredsData();
  const connectionStatus = checkWhatsAppConnection();
  const systemResources = getSystemResources();
  
  log('\n==== BLACKSKY-MD HEROKU MONITOR ====', colors.cyan);
  log(`Time: ${new Date().toISOString()}`);
  log(`Node.js: ${process.version}`);
  log('----------------------------------', colors.cyan);
  
  // Heroku status
  log('\n[Heroku Environment]', colors.magenta);
  if (herokuInfo.isHeroku) {
    log(`✓ Running on Heroku`, colors.green);
    log(`  App Name: ${herokuInfo.appName}`);
    log(`  Dyno: ${herokuInfo.dyno}`);
    log(`  Region: ${herokuInfo.region}`);
    log(`  Node Environment: ${herokuInfo.nodeEnv}`);
    log(`  Owner Number: ${herokuInfo.owner}`);
    
    if (herokuInfo.haveCreds) {
      log(`  CREDS_DATA: ✓ Set`, colors.green);
    } else {
      log(`  CREDS_DATA: ✗ Not set`, colors.red);
    }
    
    log(`  PORT: ${herokuInfo.port}`);
  } else {
    log(`✗ Not running on Heroku`, colors.yellow);
  }
  
  // Port status
  log('\n[Port Configuration]', colors.magenta);
  if (portStatus.ok) {
    log(`✓ ${portStatus.message}`, colors.green);
  } else {
    log(`✗ ${portStatus.message}`, colors.red);
  }
  
  // Auth directory
  log('\n[Auth Directory Status]', colors.magenta);
  if (authDirStatus.exists) {
    log(`✓ Auth directory exists: ${authDirStatus.path}`, colors.green);
    log(`  Total files: ${authDirStatus.fileCount}`);
    
    if (authDirStatus.hasCredsJson) {
      const credsFile = authDirStatus.files.find(f => f.name === 'creds.json');
      if (credsFile.validJson) {
        log(`  creds.json: ✓ Valid (${Math.round(credsFile.size / 1024 * 100) / 100} KB)`, colors.green);
      } else {
        log(`  creds.json: ✗ Invalid JSON format - ${credsFile.jsonError}`, colors.red);
      }
    } else {
      log(`  creds.json: ✗ Missing`, colors.red);
    }
    
    if (authDirStatus.errors.length > 0) {
      log('\n  Errors:', colors.red);
      authDirStatus.errors.forEach(err => {
        log(`  - ${err}`, colors.red);
      });
    }
  } else {
    log(`✗ Auth directory does not exist: ${authDirStatus.path}`, colors.red);
  }
  
  // Credentials data
  log('\n[CREDS_DATA Status]', colors.magenta);
  if (credsStatus.exists) {
    if (credsStatus.valid) {
      log(`✓ ${credsStatus.message} (${credsStatus.sizeKB} KB)`, colors.green);
    } else {
      log(`✗ ${credsStatus.message}`, colors.red);
    }
  } else {
    log(`✗ ${credsStatus.message}`, colors.red);
  }
  
  // WhatsApp connection
  log('\n[WhatsApp Connection Status]', colors.magenta);
  if (connectionStatus.likelyConnected) {
    log(`✓ Configuration looks good for WhatsApp connection`, colors.green);
  } else {
    log(`✗ Configuration has issues that may prevent WhatsApp connection`, colors.red);
    connectionStatus.issues.forEach(issue => {
      log(`  - ${issue}`, colors.red);
    });
  }
  
  // System resources
  log('\n[System Resources]', colors.magenta);
  log(`  Uptime: ${Math.floor(systemResources.uptime / 60)} minutes`);
  log(`  Memory Usage:`);
  log(`    - RSS: ${systemResources.memory.rss} MB`);
  log(`    - Heap Used: ${systemResources.memory.heapUsed} MB`);
  log(`    - Heap Total: ${systemResources.memory.heapTotal} MB`);
  
  // Overall status
  log('\n[Overall Status]', colors.magenta);
  const allGood = portStatus.ok && 
                 authDirStatus.exists && 
                 authDirStatus.hasCredsJson && 
                 credsStatus.valid && 
                 connectionStatus.likelyConnected;
                 
  if (allGood) {
    log(`✓ All checks passed! Configuration appears correct.`, colors.green);
  } else {
    log(`✗ Some checks failed. Review the issues above.`, colors.red);
  }
  
  // Helpful commands
  log('\n[Helpful Commands]', colors.magenta);
  log('  View logs:');
  log('    heroku logs --tail -a your-app-name', colors.cyan);
  log('  Restart app:');
  log('    heroku restart -a your-app-name', colors.cyan);
  log('  Generate new credentials:');
  log('    node fix-heroku-deployment-new.js', colors.cyan);
  log('  View web console:');
  log('    https://your-app-name.herokuapp.com/console', colors.cyan);
  
  log('\n==== END OF HEROKU MONITOR ====\n', colors.cyan);
  
  // Return full results for programmatic use
  return {
    herokuInfo,
    portStatus,
    authDirStatus,
    credsStatus,
    connectionStatus,
    systemResources,
    allGood
  };
}

// If this script is run directly from command line, run the diagnostics
if (require.main === module) {
  runAllDiagnostics();
}

// Export functions for use in other modules or web interface
module.exports = {
  isHeroku,
  getHerokuInfo,
  checkPortStatus,
  checkAuthDirectory,
  checkCredsData,
  checkWhatsAppConnection,
  getSystemResources,
  runAllDiagnostics
};