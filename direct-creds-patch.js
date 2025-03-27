/**
 * Direct Credentials Patch
 * 
 * This script patches the index.js file to use the direct-heroku-helper.js
 * for proper handling of non-base64 encoded CREDS_DATA
 */

const fs = require('fs');
const path = require('path');

// Paths
const INDEX_PATH = path.join(__dirname, 'src', 'index.js');
const BACKUP_PATH = path.join(__dirname, 'src', 'index.js.backup');

// Create backup
if (fs.existsSync(INDEX_PATH) && !fs.existsSync(BACKUP_PATH)) {
  console.log('Creating backup of index.js...');
  fs.copyFileSync(INDEX_PATH, BACKUP_PATH);
  console.log('✅ Backup created at', BACKUP_PATH);
}

// Read the index.js file
console.log('Reading index.js...');
const indexContent = fs.readFileSync(INDEX_PATH, 'utf8');

// Replace the herokuHelper import with direct-heroku-helper
const updatedContent = indexContent.replace(
  /const herokuHelper = require\(['"]\.\/utils\/herokuHelper['"]\);/,
  'const herokuHelper = require(\'../direct-heroku-helper\');'
);

// Write the updated file
console.log('Writing updated index.js...');
fs.writeFileSync(INDEX_PATH, updatedContent);
console.log('✅ Successfully patched index.js to use direct-heroku-helper.js');

console.log('\n======================================');
console.log('HEROKU DEPLOYMENT INSTRUCTIONS');
console.log('======================================');
console.log('1. Run the bot locally: npm start');
console.log('2. Scan the QR code with WhatsApp to authenticate');
console.log('3. Generate raw credentials: node direct-creds-helper.js');
console.log('4. Set up Heroku environment variables:');
console.log('   CREDS_DATA=<content of direct-creds-data.txt> (uncompressed JSON)');
console.log('   PLATFORM=heroku');
console.log('   NODE_ENV=production');
console.log('   OWNER_NUMBER=<your number>');
console.log('5. Deploy to Heroku');
console.log('   git push heroku main');
console.log('6. Monitor logs:');
console.log('   heroku logs --tail');
console.log('======================================');