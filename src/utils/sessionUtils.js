
const fs = require('fs');
const path = require('path');

const ensureSessionFolder = () => {
  const sessionFolder = path.join(process.cwd(), 'data', 'session_backups');
  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  }
  return sessionFolder;
};

const backupCredsFile = async (sock) => {
  try {
    const credsPath = path.join(process.cwd(), 'auth_info_baileys', 'creds.json');
    if (!fs.existsSync(credsPath)) {
      console.log('No creds.json found to backup');
      return;
    }

    const credsData = fs.readFileSync(credsPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(ensureSessionFolder(), `creds_${timestamp}.json`);
    
    fs.writeFileSync(backupPath, credsData);

    // Send to bot
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    await sock.sendMessage(botJid, { document: credsData, mimetype: 'application/json', fileName: 'creds.json' });
    
    console.log('Credentials backed up and sent to bot');
  } catch (error) {
    console.error('Error backing up credentials:', error);
  }
};

module.exports = {
  ensureSessionFolder,
  backupCredsFile
};
