
const fs = require('fs');
const path = require('path');

async function sendCredsFile(sock, ownerJid) {
    try {
        const credsPath = path.join(process.cwd(), 'auth_info_baileys', 'creds.json');
        const credsContent = fs.readFileSync(credsPath);
        
        await sock.sendMessage(ownerJid, { 
            document: credsContent,
            mimetype: 'application/json',
            fileName: 'creds.json'
        });
        
        console.log('Credentials file sent successfully');
        return true;
    } catch (error) {
        console.error('Error sending credentials:', error);
        return false;
    }
}

module.exports = { sendCredsFile };
