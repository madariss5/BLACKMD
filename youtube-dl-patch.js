/**
 * Patch script for youtube-dl-exec postinstall issue
 * This patches the youtube-dl-exec postinstall script to use node-fetch
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Find the youtube-dl-exec postinstall script
 */
function findPostinstallScript() {
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'scripts', 'postinstall.js'),
    path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'scripts', 'postinstall.js')
  ];
  
  for (const scriptPath of possiblePaths) {
    if (fs.existsSync(scriptPath)) {
      return scriptPath;
    }
  }
  
  return null;
}

/**
 * Patch the postinstall script to use require('node-fetch')
 */
function patchPostinstallScript(scriptPath) {
  try {
    let content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check if already patched
    if (content.includes("const fetch = require('node-fetch')")) {
      log('Script already patched!', colors.yellow);
      return true;
    }
    
    // Add node-fetch at the top
    content = "const fetch = require('node-fetch');\n" + content;
    
    // Write back to file
    fs.writeFileSync(scriptPath, content);
    log(`✅ Successfully patched ${scriptPath}`, colors.green);
    return true;
  } catch (error) {
    log(`❌ Error patching script: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Create an environment variable file to skip binary download
 */
function createSkipDownloadFile() {
  const envFilePath = path.join(process.cwd(), '.env');
  try {
    let content = '';
    if (fs.existsSync(envFilePath)) {
      content = fs.readFileSync(envFilePath, 'utf8');
    }
    
    // Add skip download variables if not already there
    if (!content.includes('YOUTUBE_DL_SKIP_DOWNLOAD')) {
      content += '\nYOUTUBE_DL_SKIP_DOWNLOAD=1\n';
    }
    if (!content.includes('YOUTUBE_DL_SKIP_PYTHON_CHECK')) {
      content += 'YOUTUBE_DL_SKIP_PYTHON_CHECK=1\n';
    }
    
    fs.writeFileSync(envFilePath, content);
    log('✅ Added skip download variables to .env file', colors.green);
    return true;
  } catch (error) {
    log(`❌ Error creating .env file: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  log('\n== YOUTUBE-DL-EXEC PATCH TOOL ==', colors.cyan);
  
  // 1. Find the postinstall script
  log('1. Finding youtube-dl-exec postinstall script...', colors.blue);
  const scriptPath = findPostinstallScript();
  if (!scriptPath) {
    log('❌ Could not find youtube-dl-exec postinstall script', colors.red);
    log('Please run npm install first, then try again', colors.yellow);
    process.exit(1);
  }
  
  // 2. Patch the script
  log('2. Patching script to use node-fetch...', colors.blue);
  const patchSuccess = patchPostinstallScript(scriptPath);
  if (!patchSuccess) {
    log('❌ Failed to patch postinstall script', colors.red);
    process.exit(1);
  }
  
  // 3. Create skip download file
  log('3. Creating skip download environment variables...', colors.blue);
  createSkipDownloadFile();
  
  log('\n✅ Patch completed successfully!', colors.green);
  log('You can now run npm install without errors.', colors.green);
}

// Run the main function
main();