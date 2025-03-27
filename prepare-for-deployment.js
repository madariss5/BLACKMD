/**
 * Deployment Preparation Script for Blacksky-MD
 * 
 * This script prepares the bot for deployment by:
 * 1. Skipping youtube-dl-exec downloads with environment variables
 * 2. Patching postinstall scripts to use node-fetch for compatibility
 * 3. Fixing any known deployment issues
 * 
 * Usage: node prepare-for-deployment.js
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
 * Run another local script
 */
function runScript(scriptPath) {
    try {
        log(`Running script: ${scriptPath}`, colors.cyan);
        execSync(`node ${scriptPath}`, { stdio: 'inherit' });
        return true;
    } catch (error) {
        log(`Error running script ${scriptPath}: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Create environment variables file
 */
function createEnvFile() {
    try {
        const envPath = '.env';
        const envContent = 'YOUTUBE_DL_SKIP_DOWNLOAD=1\nYOUTUBE_DL_SKIP_PYTHON_CHECK=1\n';
        
        // Don't overwrite if file exists
        if (fs.existsSync(envPath)) {
            let currentContent = fs.readFileSync(envPath, 'utf8');
            if (!currentContent.includes('YOUTUBE_DL_SKIP_DOWNLOAD')) {
                currentContent += '\n' + envContent;
                fs.writeFileSync(envPath, currentContent);
            }
        } else {
            fs.writeFileSync(envPath, envContent);
        }
        
        log('Environment variables file created/updated', colors.green);
        return true;
    } catch (error) {
        log(`Error creating environment file: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Verify the Procfile has been updated
 */
function verifyProcfile() {
    try {
        const procfilePath = 'Procfile';
        if (!fs.existsSync(procfilePath)) {
            log('Procfile not found, creating it', colors.yellow);
            fs.writeFileSync(procfilePath, 'web: YOUTUBE_DL_SKIP_PYTHON_CHECK=1 YOUTUBE_DL_SKIP_DOWNLOAD=1 npm install node-fetch@2 --no-save && node fix-yt-dl-exec.js && node src/index.js');
            return true;
        }
        
        const content = fs.readFileSync(procfilePath, 'utf8');
        if (!content.includes('YOUTUBE_DL_SKIP_DOWNLOAD') || !content.includes('fix-yt-dl-exec.js')) {
            log('Updating Procfile to include fix script', colors.yellow);
            fs.writeFileSync(procfilePath, 'web: YOUTUBE_DL_SKIP_PYTHON_CHECK=1 YOUTUBE_DL_SKIP_DOWNLOAD=1 npm install node-fetch@2 --no-save && node fix-yt-dl-exec.js && node src/index.js');
        }
        
        log('Procfile verified', colors.green);
        return true;
    } catch (error) {
        log(`Error verifying Procfile: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Add node-fetch to package dependencies
 */
function addNodeFetchToDependencies() {
    try {
        const packagePath = 'package.json';
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Add node-fetch if not already there
        if (!packageJson.dependencies['node-fetch']) {
            packageJson.dependencies['node-fetch'] = "^2.6.7";
            fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
            log('Added node-fetch to package.json dependencies', colors.green);
        } else {
            log('node-fetch already in dependencies', colors.green);
        }
        
        return true;
    } catch (error) {
        log(`Error adding node-fetch to dependencies: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    log('Starting deployment preparation...', colors.cyan);
    
    // Create environment file
    createEnvFile();
    
    // Verify Procfile
    verifyProcfile();
    
    // Add node-fetch to dependencies
    addNodeFetchToDependencies();
    
    // Run fix script
    if (fs.existsSync('fix-yt-dl-exec.js')) {
        runScript('fix-yt-dl-exec.js');
    } else {
        log('fix-yt-dl-exec.js not found, skipping', colors.yellow);
    }
    
    log('Deployment preparation completed!', colors.green);
    log('You can now deploy your bot with confidence.', colors.green);
}

// Run the main function
main().catch(error => {
    log(`Unhandled error: ${error.message}`, colors.red);
});