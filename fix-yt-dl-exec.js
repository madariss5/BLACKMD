/**
 * Fix for youtube-dl-exec package's postinstall script
 * This script adds node-fetch to the postinstall script to ensure compatibility
 * with older Node.js versions that don't have native fetch support
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

/**
 * Find the youtube-dl-exec package directory
 */
function findYoutubeDlExecDir() {
    try {
        const nodeFetchPath = path.join('node_modules', 'youtube-dl-exec');
        if (fs.existsSync(nodeFetchPath)) {
            return nodeFetchPath;
        } else {
            log('youtube-dl-exec not found in node_modules', colors.yellow);
            return null;
        }
    } catch (error) {
        log(`Error finding youtube-dl-exec: ${error.message}`, colors.red);
        return null;
    }
}

/**
 * Install node-fetch dependency if needed
 */
function installNodeFetch() {
    try {
        log('Installing node-fetch v2...', colors.cyan);
        execSync('npm install node-fetch@2 --no-save', { stdio: 'inherit' });
        return true;
    } catch (error) {
        log(`Failed to install node-fetch: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Patch the postinstall script to use node-fetch
 */
function patchPostinstallScript(packageDir) {
    const postinstallPath = path.join(packageDir, 'scripts', 'postinstall.js');
    
    if (!fs.existsSync(postinstallPath)) {
        log(`Postinstall script not found at ${postinstallPath}`, colors.red);
        return false;
    }
    
    try {
        // Read the original file
        let content = fs.readFileSync(postinstallPath, 'utf8');
        
        // Check if already patched
        if (content.includes('node-fetch')) {
            log('Postinstall script already patched', colors.green);
            return true;
        }
        
        // Add node-fetch import at the top of the file
        const nodeFetchImport = "'use strict'\n\nconst fetch = require('node-fetch');\n";
        content = content.replace("'use strict'", nodeFetchImport);
        
        // Write the patched file
        fs.writeFileSync(postinstallPath, content);
        log('Successfully patched postinstall.js to use node-fetch', colors.green);
        
        return true;
    } catch (error) {
        log(`Error patching postinstall script: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Create an environment variable skip file to bypass download
 */
function createSkipDownloadFile(packageDir) {
    try {
        const envPath = path.join(packageDir, '.env');
        fs.writeFileSync(envPath, 'YOUTUBE_DL_SKIP_DOWNLOAD=1');
        log('Created .env file to skip download during install', colors.green);
        return true;
    } catch (error) {
        log(`Error creating skip download file: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    log('Starting youtube-dl-exec fix...', colors.cyan);
    
    // Find package directory
    const packageDir = findYoutubeDlExecDir();
    if (!packageDir) {
        log('Cannot proceed without youtube-dl-exec package', colors.red);
        return false;
    }
    
    // Install node-fetch
    if (!installNodeFetch()) {
        log('Failed to install node-fetch, trying to continue...', colors.yellow);
    }
    
    // Patch the postinstall script
    const patchSuccess = patchPostinstallScript(packageDir);
    
    // Create skip download file (optional fallback)
    const skipFileSuccess = createSkipDownloadFile(packageDir);
    
    if (patchSuccess) {
        log('youtube-dl-exec patch applied successfully!', colors.green);
        return true;
    } else {
        log('Failed to patch youtube-dl-exec', colors.red);
        return false;
    }
}

// Run the main function
main().then(success => {
    if (success) {
        log('Fix completed successfully', colors.green);
        process.exit(0);
    } else {
        log('Fix encountered errors', colors.red);
        process.exit(1);
    }
}).catch(error => {
    log(`Unhandled error: ${error.message}`, colors.red);
    process.exit(1);
});