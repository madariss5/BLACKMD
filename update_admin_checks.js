/**
 * Script to update all isAdmin checks to use the checkAdminPermission helper
 */
const fs = require('fs');
const path = require('path');

// Path to the group.js file
const filePath = path.join(__dirname, 'src', 'commands', 'group.js');

// Read the file content
let content = fs.readFileSync(filePath, 'utf8');

// Get all command names
const commandRegex = /async\s+(\w+)\s*\(/g;
const commands = [];
let match;

while ((match = commandRegex.exec(content)) !== null) {
  commands.push(match[1]);
}

// Filter out duplicates
const uniqueCommands = [...new Set(commands)];
console.log(`Found ${uniqueCommands.length} unique commands`);

// For each command, replace the isAdmin check with checkAdminPermission
let replacementCount = 0;

for (const command of uniqueCommands) {
  // Skip commands that already use checkAdminPermission
  if (content.includes(`checkAdminPermission(sock, remoteJid, sender, '${command}')`)) {
    console.log(`Command '${command}' already using checkAdminPermission`);
    continue;
  }
  
  // Create a regex pattern to find the specific command's isAdmin check
  const pattern = new RegExp(
    `(async\\s+${command}\\s*\\([^]*?const\\s+sender\\s*=\\s*message\\.key\\.participant\\s*\\|\\|\\s*message\\.key\\.remoteJid;[^]*?)(const\\s+isUserAdmin\\s*=\\s*await\\s+isAdmin\\s*\\(\\s*sock\\s*,\\s*remoteJid\\s*,\\s*sender\\s*\\);)`,
    'g'
  );
  
  // Replacement string
  const replacement = `$1const isUserAdmin = await checkAdminPermission(sock, remoteJid, sender, '${command}');`;
  
  // Perform the replacement
  const newContent = content.replace(pattern, replacement);
  
  // If a replacement was made, update the content
  if (newContent !== content) {
    content = newContent;
    replacementCount++;
    console.log(`Updated command: ${command}`);
  }
}

// Write the updated content back to the file
if (replacementCount > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${replacementCount} commands in ${filePath}`);
} else {
  console.log('No replacements were made');
}
