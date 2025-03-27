/**
 * Helper Script to Prepare package.json for Heroku Deployment
 * This script copies package-heroku.json to package.json for deployment
 */

const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, 'package-heroku.json');
const targetFile = path.join(__dirname, 'package.json');

// Read the source file
try {
  console.log('Reading package-heroku.json...');
  const packageHeroku = fs.readFileSync(sourceFile, 'utf8');
  
  // Write to target file
  console.log('Writing to package.json...');
  fs.writeFileSync(targetFile, packageHeroku);
  
  console.log('✅ Successfully copied package-heroku.json to package.json');
  console.log('Your package.json is now ready for Heroku deployment!');
} catch (error) {
  console.error('❌ Error preparing package.json for Heroku:');
  console.error(error.message);
  process.exit(1);
}