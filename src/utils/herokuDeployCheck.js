
const fs = require('fs');

function checkHerokuRequirements() {
  console.log('Checking Heroku deployment requirements...');
  
  const checks = {
    procfile: fs.existsSync('./Procfile'),
    herokuYml: fs.existsSync('./heroku.yml'),
    appJson: fs.existsSync('./app.json'),
    packageJson: fs.existsSync('./package-heroku.json'),
    credsHelper: fs.existsSync('./heroku-credentials-helper.js')
  };

  const missing = Object.entries(checks)
    .filter(([, exists]) => !exists)
    .map(([file]) => file);

  if (missing.length === 0) {
    console.log('✅ All required Heroku files present');
    return true;
  } else {
    console.error('❌ Missing required files:', missing.join(', '));
    return false;
  }
}

module.exports = { checkHerokuRequirements };
