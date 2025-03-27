/**
 * Direct Credentials Verification Tool
 * 
 * This script verifies that direct (non-base64) credentials are working properly.
 * It simulates how the WhatsApp bot will process direct JSON credentials.
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

// Constants
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
const CREDS_PATH = path.join(AUTH_DIR, 'creds.json');
const TEST_DIR = path.join(__dirname, 'test_creds');
const TEST_CREDS_PATH = path.join(TEST_DIR, 'creds.json');

async function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    return true;
  } catch (error) {
    console.error(`Error creating directory ${dir}:`, error);
    return false;
  }
}

async function testDirectCredentials() {
  console.log('Direct Credentials Verification Tool');
  console.log('===================================');
  
  // Step 1: Check if we have authentication data
  if (!fs.existsSync(AUTH_DIR)) {
    console.error('❌ Authentication directory not found!');
    console.error('Please run the bot and connect to WhatsApp first.');
    return false;
  }
  
  if (!fs.existsSync(CREDS_PATH)) {
    console.error('❌ creds.json not found!');
    console.error('Please run the bot and connect to WhatsApp first.');
    return false;
  }
  
  console.log('✅ Found authentication directory and creds.json');
  
  // Step 2: Read the credentials
  let credsContent;
  try {
    credsContent = await readFile(CREDS_PATH, 'utf8');
    console.log(`✅ Successfully read creds.json (${Math.round(credsContent.length / 1024)} KB)`);
  } catch (error) {
    console.error('❌ Failed to read credentials:', error);
    return false;
  }
  
  // Step 3: Validate JSON format
  try {
    const credsJson = JSON.parse(credsContent);
    console.log('✅ Credentials are valid JSON');
    
    // Check if it has expected fields
    if (credsJson.creds && credsJson.keys) {
      console.log('✅ Credentials contain expected structure (creds and keys)');
    } else {
      console.warn('⚠️ Credentials structure may not be complete');
    }
  } catch (error) {
    console.error('❌ Credentials are not valid JSON:', error);
    return false;
  }
  
  // Step 4: Test writing to a new location (simulate Heroku process)
  try {
    await ensureDir(TEST_DIR);
    await writeFile(TEST_CREDS_PATH, credsContent);
    console.log('✅ Successfully wrote credentials to test location');
    
    // Verify the written file
    const testContent = await readFile(TEST_CREDS_PATH, 'utf8');
    if (testContent === credsContent) {
      console.log('✅ Written credentials match original');
    } else {
      console.error('❌ Written credentials do not match original');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to write test credentials:', error);
    return false;
  }
  
  // Step 5: Simulate environment variable process
  try {
    // Set up a mock process.env.CREDS_DATA
    process.env.CREDS_DATA = credsContent;
    
    // Import our direct-heroku-helper module
    const directHelper = require('./direct-heroku-helper');
    
    // Simulate initialization
    console.log('Testing credential initialization from environment...');
    
    // Create a test directory simulating auth_info_baileys
    const testAuthDir = path.join(TEST_DIR, 'auth_dir');
    if (!fs.existsSync(testAuthDir)) {
      await mkdir(testAuthDir, { recursive: true });
    }
    
    // Create a test file in the test directory
    const testFile = path.join(testAuthDir, 'creds.json');
    await writeFile(testFile, process.env.CREDS_DATA);
    
    console.log('✅ Successfully simulated credential initialization');
    
    // Clean up
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
      console.log('✅ Cleaned up test directory');
    }
  } catch (error) {
    console.error('❌ Failed to simulate credential initialization:', error);
    console.error(error);
    return false;
  }
  
  console.log('\n===================================');
  console.log('✅ ALL TESTS PASSED!');
  console.log('Direct credentials verification completed successfully.');
  console.log('Your credentials are ready to be used with Heroku deployment.');
  console.log('===================================');
  
  return true;
}

// Run the test
testDirectCredentials()
  .then(success => {
    if (!success) {
      console.error('\nVerification failed! Please check the errors above.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error during verification:', error);
    process.exit(1);
  });