/**
 * Direct Credentials Helper for Heroku
 * 
 * This script generates a non-compressed, non-base64 CREDS_DATA value
 * that directly matches the format in creds.json
 * 
 * Usage:
 * 1. Run the bot locally (npm start)
 * 2. After connecting to WhatsApp, run this script:
 *    node direct-creds-helper.js
 * 3. Copy the output string and add it as CREDS_DATA environment variable in Heroku
 */

const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
const CREDS_PATH = path.join(AUTH_DIR, 'creds.json');
const OUTPUT_FILE = path.join(__dirname, 'direct-creds-data.txt');

function getDirectCredsData() {
  try {
    console.log('Reading WhatsApp credentials from creds.json...');
    
    // Check if auth_info_baileys exists
    if (!fs.existsSync(AUTH_DIR)) {
      console.error('ERROR: auth_info_baileys directory not found!');
      console.error('You must first start the bot and connect to WhatsApp.');
      return null;
    }
    
    // Check if creds.json exists
    if (!fs.existsSync(CREDS_PATH)) {
      console.error('ERROR: creds.json not found!');
      console.error('You must first connect to WhatsApp to generate credentials.');
      return null;
    }
    
    // Read the creds.json file directly
    const credsContent = fs.readFileSync(CREDS_PATH, 'utf8');
    
    console.log('✅ Successfully read creds.json');
    console.log(`File size: ${Math.round(credsContent.length / 1024)} KB`);
    
    return credsContent;
  } catch (error) {
    console.error('Error reading credentials:', error);
    return null;
  }
}

function main() {
  const credsData = getDirectCredsData();
  
  if (!credsData) {
    console.error('Failed to get credentials data');
    process.exit(1);
  }
  
  // Save to file
  fs.writeFileSync(OUTPUT_FILE, credsData);
  console.log(`✅ Credentials data saved to ${OUTPUT_FILE}`);
  
  console.log('\n===========================================');
  console.log('IMPORTANT: For Heroku Deployment');
  console.log('===========================================');
  console.log('1. Set the following environment variable in Heroku:');
  console.log('   CREDS_DATA=<content of direct-creds-data.txt>');
  console.log('2. The content is in direct JSON format (not base64 encoded)');
  console.log('3. Ensure other required variables are set:');
  console.log('   - PLATFORM=heroku');
  console.log('   - NODE_ENV=production');
  console.log('   - OWNER_NUMBER=<your-number>');
  console.log('===========================================');
}

main();