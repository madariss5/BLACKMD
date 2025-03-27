/**
 * Heroku Deployment Preparation Script
 * 
 * This script automates the process of preparing your WhatsApp bot for Heroku deployment.
 * It performs the following steps:
 * 1. Generates direct credentials from creds.json
 * 2. Patches the application to use direct credentials
 * 3. Updates app.json with the correct credential format
 * 4. Verifies that all configurations are correct
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

// Constants
const CREDS_DIR = path.join(__dirname, 'auth_info_baileys');
const CREDS_PATH = path.join(CREDS_DIR, 'creds.json');
const OUTPUT_PATH = path.join(__dirname, 'direct-creds-data.txt');

// Helper function to execute scripts
function runScript(scriptPath) {
  console.log(`Running script: ${scriptPath}`);
  try {
    execSync(`node ${scriptPath}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Error running script ${scriptPath}:`, error.message);
    return false;
  }
}

// Main function
async function prepareForHeroku() {
  console.log('====================================');
  console.log('Heroku Deployment Preparation Script');
  console.log('====================================');
  
  // Step 1: Check if credentials exist
  if (!fs.existsSync(CREDS_DIR) || !fs.existsSync(CREDS_PATH)) {
    console.error('❌ WhatsApp credentials not found!');
    console.error('Please run the bot and connect to WhatsApp first.');
    console.error('Run: npm start');
    return false;
  }
  
  console.log('✅ Found WhatsApp credentials');
  
  // Step 2: Generate direct credentials
  console.log('\nGenerating direct credentials...');
  if (!runScript('./direct-creds-helper.js')) {
    console.error('❌ Failed to generate direct credentials');
    return false;
  }
  
  // Step 3: Apply patch for direct credentials
  console.log('\nApplying patch for direct credentials...');
  if (!runScript('./direct-creds-patch.js')) {
    console.error('❌ Failed to apply direct credentials patch');
    return false;
  }
  
  // Step 4: Update app.json
  console.log('\nUpdating app.json...');
  try {
    const appJsonPath = path.join(__dirname, 'app.json');
    let appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    
    if (appJson.env && appJson.env.CREDS_DATA) {
      appJson.env.CREDS_DATA.description = 'WhatsApp session credentials data (raw JSON format, direct content of creds.json)';
      await writeFile(appJsonPath, JSON.stringify(appJson, null, 2));
      console.log('✅ Successfully updated app.json');
    }
  } catch (error) {
    console.error('❌ Failed to update app.json:', error.message);
    console.error('This is not critical and can be ignored.');
  }
  
  // Step 5: Verify direct credentials
  console.log('\nVerifying direct credentials...');
  if (!runScript('./verify-direct-creds.js')) {
    console.error('❌ Verification failed');
    return false;
  }
  
  // Step 6: Print deployment instructions
  console.log('\n====================================');
  console.log('✅ PREPARATION COMPLETE!');
  console.log('====================================');
  console.log('\nYour WhatsApp bot is now ready for Heroku deployment!');
  console.log('\nFollow these steps to deploy:');
  console.log('\n1. Create a new Heroku app (if you haven\'t already):');
  console.log('   heroku create your-app-name');
  
  console.log('\n2. Set required environment variables:');
  console.log('   heroku config:set CREDS_DATA="$(cat direct-creds-data.txt)" -a your-app-name');
  console.log('   heroku config:set PLATFORM=heroku -a your-app-name');
  console.log('   heroku config:set NODE_ENV=production -a your-app-name');
  console.log('   heroku config:set OWNER_NUMBER=your-number-without-plus -a your-app-name');
  
  console.log('\n3. Deploy to Heroku:');
  console.log('   git add .');
  console.log('   git commit -m "Prepare for Heroku deployment"');
  console.log('   git push heroku main');
  
  console.log('\n4. Monitor your app:');
  console.log('   heroku logs --tail -a your-app-name');
  
  console.log('\nFor more detailed instructions, see:');
  console.log('HEROKU_DEPLOYMENT_CHECKLIST.md and DIRECT_CREDS_GUIDE.md');
  console.log('====================================');
  
  return true;
}

// Run the main function
prepareForHeroku()
  .then(success => {
    if (!success) {
      console.error('\nPreparation failed! Please check the errors above.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error during preparation:', error);
    process.exit(1);
  });