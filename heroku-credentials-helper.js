/**
 * Enhanced Heroku Credentials Helper
 * 
 * This script helps export WhatsApp credentials for Heroku deployment
 * It now includes enhanced backup and restore capabilities
 * 
 * Instructions:
 * 1. Run the bot locally (npm start)
 * 2. After connecting to WhatsApp, run this script:
 *    node heroku-credentials-helper.js
 * 3. Copy the output string and add it as CREDS_DATA environment variable in Heroku
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const zlib = require('zlib');
const gzip = promisify(zlib.gzip);

const AUTH_FOLDER = './auth_info_baileys';
const CREDS_FILE = path.join(AUTH_FOLDER, 'creds.json');

async function compressCredsData() {
  try {
    // Check if credentials file exists
    if (!fs.existsSync(CREDS_FILE)) {
      console.error('Error: Credentials file not found!');
      console.error(`Please run the bot first and connect to WhatsApp before running this script.`);
      process.exit(1);
    }

    // Read credentials file
    console.log('Reading WhatsApp credentials...');
    const credsData = await readFile(CREDS_FILE, 'utf8');
    
    // Parse to validate JSON
    const credsJson = JSON.parse(credsData);
    console.log('Credentials loaded successfully');
    console.log('Details:');
    console.log(`- Device ID: ${credsJson.me?.id?.split(':')[0] || 'Unknown'}`);
    console.log(`- Name: ${credsJson.me?.name || 'Unknown'}`);
    console.log(`- Platform: ${credsJson.platform || 'Unknown'}`);
    
    // Compress the data
    console.log('Compressing credentials...');
    const compressed = await gzip(credsData);
    
    // Convert to base64
    const base64Data = compressed.toString('base64');
    console.log('Compression complete!');
    console.log(`Original size: ${credsData.length} bytes`);
    console.log(`Compressed size: ${compressed.length} bytes`);
    console.log(`Base64 size: ${base64Data.length} bytes`);
    
    console.log('\n----- HEROKU CREDENTIALS -----');
    console.log('Add this as CREDS_DATA in your Heroku environment variables:');
    console.log(base64Data);
    console.log('-------------------------------\n');
    
    console.log('Instructions:');
    console.log('1. Copy the entire string above');
    console.log('2. Go to your Heroku app dashboard → Settings → Config Vars');
    console.log('3. Add a new config var with KEY="CREDS_DATA" and VALUE=<the string you copied>');
    console.log('4. Redeploy your application');
    
  } catch (error) {
    console.error('Error generating credentials:', error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('Heroku Credentials Helper');
  console.log('------------------------');
  
  await compressCredsData();
}

main().catch(err => {
  console.error('Unexpected error:', err);
});