/**
 * Debug commands for testing menu functionality
 */

const fs = require('fs').promises;
const fs2 = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const { exec: execCallback } = require('child_process');
const exec = util.promisify(execCallback);
const logger = require('../utils/logger');
const { safeSendText, safeSendMessage } = require('../utils/jidHelper');

// Debug command to test category loading and command structure
async function inspectModules(sock, message) {
    try {
        const result = [];
        result.push('📋 *DEBUG: Module Inspection*\n');
        
        // Find command modules directly
        const commandsPath = path.join(process.cwd(), 'src/commands');
        const files = await fs.readdir(commandsPath);
        
        // Counters
        let totalFiles = 0;
        let totalModulesWithCommands = 0;
        let totalModulesWithCategory = 0;
        let categoryCounts = {};
        
        for (const file of files) {
            if (file.endsWith('.js') && !file.includes('index')) {
                totalFiles++;
                const filePath = path.join(commandsPath, file);
                try {
                    // Require the module
                    const module = require(filePath);
                    const fileName = file.replace('.js', '');
                    
                    // Check if module has commands
                    const hasCommands = module.commands && typeof module.commands === 'object';
                    if (hasCommands) totalModulesWithCommands++;
                    
                    // Check if module has category
                    const category = module.category ? module.category : 'none';
                    if (module.category) totalModulesWithCategory++;
                    
                    // Count commands by category
                    if (!categoryCounts[category]) categoryCounts[category] = 0;
                    
                    if (hasCommands) {
                        const cmdCount = Object.keys(module.commands).length;
                        categoryCounts[category] += cmdCount;
                        
                        // Add module details to result
                        result.push(`📁 *${fileName}*`);
                        result.push(`  Category: ${category}`);
                        result.push(`  Commands: ${cmdCount}`);
                        
                        // If it's the group module, list all commands
                        if (category === 'group') {
                            result.push(`  Group commands: ${Object.keys(module.commands).join(', ')}`);
                        }
                        
                        result.push('');
                    }
                } catch (err) {
                    result.push(`⚠️ Error loading ${file}: ${err.message}`);
                }
            }
        }
        
        // Summary
        result.push('📊 *Summary*');
        result.push(`Total JS files: ${totalFiles}`);
        result.push(`Modules with commands: ${totalModulesWithCommands}`);
        result.push(`Modules with category: ${totalModulesWithCategory}`);
        result.push('\n📊 *Commands by Category*');
        
        for (const [category, count] of Object.entries(categoryCounts)) {
            result.push(`${category}: ${count} commands`);
        }
        
        // Send the result
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in inspectModules:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// System Information Commands
async function getSystemInfo(sock, message) {
    try {
        const sysInfo = {
            platform: os.platform(),
            architecture: os.arch(),
            hostname: os.hostname(),
            release: os.release(),
            uptime: formatUptime(os.uptime()),
            totalMem: formatBytes(os.totalmem()),
            freeMem: formatBytes(os.freemem()),
            cpus: os.cpus().length
        };
        
        const result = [
            '🖥️ *System Information*',
            '',
            `*Platform:* ${sysInfo.platform}`,
            `*Architecture:* ${sysInfo.architecture}`,
            `*Hostname:* ${sysInfo.hostname}`,
            `*OS Release:* ${sysInfo.release}`,
            `*Uptime:* ${sysInfo.uptime}`,
            `*Memory:* ${sysInfo.freeMem} free of ${sysInfo.totalMem}`,
            `*CPUs:* ${sysInfo.cpus} cores`
        ];
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in getSystemInfo:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function getNodeInfo(sock, message) {
    try {
        const result = [
            '🟢 *Node.js Information*',
            '',
            `*Version:* ${process.version}`,
            `*Architecture:* ${process.arch}`,
            `*Platform:* ${process.platform}`,
            `*PID:* ${process.pid}`,
            `*Uptime:* ${formatUptime(process.uptime())}`,
            `*Execution Path:* ${process.execPath}`,
            `*Working Directory:* ${process.cwd()}`
        ];
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in getNodeInfo:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function getMemoryUsage(sock, message) {
    try {
        const memoryUsage = process.memoryUsage();
        
        const result = [
            '💾 *Memory Usage*',
            '',
            `*RSS:* ${formatBytes(memoryUsage.rss)}`,
            `*Heap Total:* ${formatBytes(memoryUsage.heapTotal)}`,
            `*Heap Used:* ${formatBytes(memoryUsage.heapUsed)}`,
            `*External:* ${formatBytes(memoryUsage.external)}`,
            `*Array Buffers:* ${formatBytes(memoryUsage.arrayBuffers || 0)}`
        ];
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in getMemoryUsage:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function listEnvVars(sock, message) {
    try {
        const env = process.env;
        const safeEnv = {};
        
        // Filter out sensitive information
        Object.keys(env).forEach(key => {
            if (!key.includes('TOKEN') && 
                !key.includes('KEY') && 
                !key.includes('SECRET') && 
                !key.includes('PASS')) {
                safeEnv[key] = env[key];
            }
        });
        
        let result = ['🔐 *Environment Variables (Non-sensitive)*', ''];
        
        Object.entries(safeEnv).slice(0, 15).forEach(([key, value]) => {
            // Truncate long values
            const displayValue = value.length > 50 ? value.substring(0, 47) + '...' : value;
            result.push(`*${key}:* ${displayValue}`);
        });
        
        if (Object.keys(safeEnv).length > 15) {
            result.push(`\n... and ${Object.keys(safeEnv).length - 15} more variables`);
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in listEnvVars:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// File System Debug Commands
async function listDirectory(sock, message, args) {
    try {
        let dirPath = args[0] || '.';
        dirPath = path.resolve(process.cwd(), dirPath);
        
        // Check if path exists
        try {
            await fs.access(dirPath);
        } catch (err) {
            await safeSendText(sock, message.key.remoteJid, `❌ Path does not exist: ${dirPath}`);
            return false;
        }
        
        // Check if it's a directory
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            await safeSendText(sock, message.key.remoteJid, `❌ Not a directory: ${dirPath}`);
            return false;
        }
        
        // List directory contents
        const files = await fs.readdir(dirPath);
        const fileDetails = await Promise.all(files.map(async file => {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            return {
                name: file,
                size: formatBytes(stats.size),
                isDirectory: stats.isDirectory(),
                modified: stats.mtime.toLocaleString()
            };
        }));
        
        // Format results
        let result = [`📂 *Directory: ${dirPath}*`, ''];
        result.push(`Total Items: ${fileDetails.length}`);
        result.push('');
        
        // Sort directories first, then files
        fileDetails.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        fileDetails.forEach(file => {
            const icon = file.isDirectory ? '📁' : '📄';
            result.push(`${icon} *${file.name}*`);
            result.push(`  Size: ${file.size}`);
            result.push(`  Modified: ${file.modified}`);
            result.push('');
        });
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in listDirectory:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function readFile(sock, message, args) {
    try {
        if (!args[0]) {
            await safeSendText(sock, message.key.remoteJid, '❌ Please specify a file path');
            return false;
        }
        
        let filePath = args[0];
        filePath = path.resolve(process.cwd(), filePath);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (err) {
            await safeSendText(sock, message.key.remoteJid, `❌ File does not exist: ${filePath}`);
            return false;
        }
        
        // Check if it's a file
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            await safeSendText(sock, message.key.remoteJid, `❌ Not a file: ${filePath}`);
            return false;
        }
        
        // Check if file is too large
        if (stats.size > 50000) { // Limit to 50KB
            await safeSendText(sock, message.key.remoteJid, `❌ File too large: ${formatBytes(stats.size)}`);
            return false;
        }
        
        // Read file
        const content = await fs.readFile(filePath, 'utf8');
        
        // Format with file info
        let result = [`📄 *File: ${path.basename(filePath)}*`, ''];
        result.push(`Path: ${filePath}`);
        result.push(`Size: ${formatBytes(stats.size)}`);
        result.push(`Modified: ${stats.mtime.toLocaleString()}`);
        result.push('');
        result.push('*Content:*');
        result.push('```');
        result.push(content.substring(0, 2000)); // Limit content length
        result.push('```');
        
        if (content.length > 2000) {
            result.push(`\n... file truncated (${formatBytes(stats.size)} total)`);
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in readFile:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function fileInfo(sock, message, args) {
    try {
        if (!args[0]) {
            await safeSendText(sock, message.key.remoteJid, '❌ Please specify a file path');
            return false;
        }
        
        let filePath = args[0];
        filePath = path.resolve(process.cwd(), filePath);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (err) {
            await safeSendText(sock, message.key.remoteJid, `❌ File does not exist: ${filePath}`);
            return false;
        }
        
        // Get file stats
        const stats = await fs.stat(filePath);
        
        // Format with file info
        let result = [`📄 *File Information*`, ''];
        result.push(`Name: ${path.basename(filePath)}`);
        result.push(`Path: ${filePath}`);
        result.push(`Size: ${formatBytes(stats.size)}`);
        result.push(`Created: ${stats.birthtime.toLocaleString()}`);
        result.push(`Modified: ${stats.mtime.toLocaleString()}`);
        result.push(`Accessed: ${stats.atime.toLocaleString()}`);
        result.push(`Type: ${stats.isDirectory() ? 'Directory' : stats.isFile() ? 'File' : 'Other'}`);
        result.push(`Mode: ${stats.mode.toString(8)}`);
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in fileInfo:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// Network Debug Commands
async function checkConnection(sock, message) {
    try {
        let result = ['🌐 *Connection Check*', ''];
        
        // Check internet connection
        try {
            const internetCheck = await exec('ping -c 1 8.8.8.8');
            result.push('*Internet Connection:* ✅ Available');
            
            // Extract ping time
            const pingMatch = internetCheck.stdout.match(/time=(\d+\.\d+) ms/);
            if (pingMatch) {
                result.push(`*Ping Time:* ${pingMatch[1]} ms`);
            }
        } catch (err) {
            result.push('*Internet Connection:* ❌ Unavailable');
        }
        
        // Get network interfaces
        const ifaces = os.networkInterfaces();
        result.push('\n*Network Interfaces:*');
        
        for (const [name, addresses] of Object.entries(ifaces)) {
            result.push(`\n*${name}:*`);
            
            if (addresses) {
                addresses.forEach(addr => {
                    result.push(`  Address: ${addr.address}`);
                    result.push(`  Family: IPv${addr.family.substring(2)}`);
                    result.push(`  MAC: ${addr.mac}`);
                    result.push(`  Internal: ${addr.internal ? 'Yes' : 'No'}`);
                    result.push('');
                });
            }
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in checkConnection:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function pingHost(sock, message, args) {
    try {
        const host = args[0] || '8.8.8.8';
        
        let result = [`🔄 *Pinging ${host}*`, ''];
        
        try {
            const { stdout } = await exec(`ping -c 4 ${host}`);
            result.push('```');
            result.push(stdout);
            result.push('```');
        } catch (err) {
            result.push(`❌ Failed to ping ${host}`);
            if (err.stderr) {
                result.push('```');
                result.push(err.stderr);
                result.push('```');
            }
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in pingHost:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// Process Debug Commands
async function listProcesses(sock, message) {
    try {
        let result = ['⚙️ *Running Processes*', ''];
        
        try {
            // Get top CPU and memory processes
            const { stdout } = await exec('ps aux --sort=-%cpu,%mem | head -11');
            result.push('```');
            result.push(stdout);
            result.push('```');
        } catch (err) {
            result.push('❌ Failed to get process list');
            if (err.stderr) {
                result.push(err.stderr);
            }
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in listProcesses:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function getDiskSpace(sock, message) {
    try {
        let result = ['💽 *Disk Space Usage*', ''];
        
        try {
            const { stdout } = await exec('df -h');
            result.push('```');
            result.push(stdout);
            result.push('```');
        } catch (err) {
            result.push('❌ Failed to get disk space info');
            if (err.stderr) {
                result.push(err.stderr);
            }
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in getDiskSpace:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// WhatsApp Debug Commands
async function getConnectionInfo(sock, message) {
    try {
        let result = ['📱 *WhatsApp Connection Info*', ''];
        
        // Check if connected
        const connected = sock.user ? true : false;
        result.push(`*Connected:* ${connected ? '✅' : '❌'}`);
        
        // User information
        if (connected && sock.user) {
            result.push(`*User:* ${sock.user.name || 'Unknown'}`);
            result.push(`*JID:* ${sock.user.id || 'Unknown'}`);
            result.push(`*Phone:* +${sock.user.id?.split('@')[0] || 'Unknown'}`);
        }
        
        result.push('\n*Connection Details:*');
        try {
            // Additional connection info if available
            if (sock.ws) {
                result.push(`*WebSocket:* ${sock.ws.readyState === 1 ? 'Connected' : 'Disconnected'}`);
            }
            
            // Get platform info if available
            if (sock.authState && sock.authState.creds) {
                result.push(`*Platform:* ${sock.authState.creds.platform || 'Unknown'}`);
            }
        } catch (err) {
            result.push(`*Error getting details:* ${err.message}`);
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in getConnectionInfo:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function listGroups(sock, message) {
    try {
        let result = ['👥 *WhatsApp Groups*', ''];
        
        // Get all chats
        const chats = await sock.groupFetchAllParticipating();
        const groups = Object.values(chats);
        
        if (groups.length === 0) {
            result.push('No groups found.');
        } else {
            result.push(`Found ${groups.length} groups:`);
            result.push('');
            
            groups.forEach((group, i) => {
                const groupName = group.subject || 'Unknown Group';
                const memberCount = group.participants ? group.participants.length : 'Unknown';
                
                result.push(`${i+1}. *${groupName}*`);
                result.push(`   Members: ${memberCount}`);
                result.push(`   ID: ${group.id}`);
                
                // Get creation info if available
                if (group.creation) {
                    const creationDate = new Date(group.creation * 1000);
                    result.push(`   Created: ${creationDate.toLocaleString()}`);
                }
                
                result.push('');
            });
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in listGroups:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function getDeviceInfo(sock, message) {
    try {
        let result = ['📱 *Device Information*', ''];
        
        if (sock.user) {
            result.push(`*Phone:* +${sock.user.id.split('@')[0]}`);
        }
        
        // Get connection info
        try {
            const platform = sock.authState?.creds?.platform || 'Unknown';
            const device = sock.authState?.creds?.device_manufacturer || 'Unknown';
            const model = sock.authState?.creds?.device_model || 'Unknown';
            const osVersion = sock.authState?.creds?.os_version || 'Unknown';
            const phoneBrand = sock.authState?.creds?.phone_wa_name || 'Unknown';
            
            result.push(`*Platform:* ${platform}`);
            result.push(`*Device:* ${device}`);
            result.push(`*Model:* ${model}`);
            result.push(`*OS Version:* ${osVersion}`);
            result.push(`*WhatsApp Name:* ${phoneBrand}`);
        } catch (err) {
            result.push(`*Error getting device info:* ${err.message}`);
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in getDeviceInfo:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function testMessage(sock, message, args) {
    try {
        const target = message.key.remoteJid;
        const text = args.join(' ') || 'Test message';
        
        await safeSendText(sock, target, `*Test Message*\n\n${text}`);
        return true;
    } catch (err) {
        logger.error('Error in testMessage:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function mentionDebug(sock, message, args) {
    try {
        const target = message.key.remoteJid;
        
        // Check if group
        if (!target.endsWith('@g.us')) {
            await safeSendText(sock, target, '❌ This command can only be used in groups');
            return false;
        }
        
        // Get group metadata
        const metadata = await sock.groupMetadata(target);
        const participants = metadata.participants;
        
        // Create mentions
        const mentions = participants.map(p => p.id);
        
        // Prepare message
        let text = '*Mention Debug*\n\n';
        
        participants.forEach(p => {
            const jid = p.id;
            const shortJid = jid.split('@')[0];
            text += `@${shortJid}\n`;
        });
        
        // Send with mentions
        await safeSendMessage(sock, target, {
            text,
            mentions,
            extendedTextMessage: {
                text,
                contextInfo: {
                    mentionedJid: mentions
                }
            }
        });
        
        return true;
    } catch (err) {
        logger.error('Error in mentionDebug:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// Module Debug Commands
async function listPackages(sock, message) {
    try {
        let result = ['📦 *Installed Node.js Packages*', ''];
        
        // Try to read package.json
        try {
            const packagePath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
            
            if (packageJson.dependencies) {
                const dependencies = Object.entries(packageJson.dependencies);
                result.push(`*Dependencies (${dependencies.length}):*`);
                
                dependencies.forEach(([name, version]) => {
                    result.push(`${name}: ${version}`);
                });
            } else {
                result.push('No dependencies found in package.json');
            }
            
            if (packageJson.devDependencies) {
                const devDependencies = Object.entries(packageJson.devDependencies);
                result.push(`\n*Dev Dependencies (${devDependencies.length}):*`);
                
                devDependencies.forEach(([name, version]) => {
                    result.push(`${name}: ${version}`);
                });
            }
        } catch (err) {
            result.push(`❌ Error reading package.json: ${err.message}`);
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in listPackages:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function checkVersion(sock, message) {
    try {
        let result = ['🔄 *Version Check*', ''];
        
        try {
            // Check Node.js
            result.push(`*Node.js:* ${process.version}`);
            
            // Check NPM if available
            try {
                const { stdout: npmVersion } = await exec('npm --version');
                result.push(`*NPM:* ${npmVersion.trim()}`);
            } catch (err) {
                result.push('*NPM:* Not found');
            }
            
            // Check Baileys
            try {
                const baileys = require('@whiskeysockets/baileys/package.json');
                result.push(`*Baileys:* ${baileys.version}`);
            } catch (err) {
                result.push('*Baileys:* Not found');
            }
            
            // Check bot version from package.json
            try {
                const packagePath = path.join(process.cwd(), 'package.json');
                const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
                result.push(`*Bot Version:* ${packageJson.version || 'Unknown'}`);
            } catch (err) {
                result.push('*Bot Version:* Unknown');
            }
        } catch (err) {
            result.push(`❌ Error checking versions: ${err.message}`);
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in checkVersion:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function checkModules(sock, message) {
    try {
        let result = ['🧩 *Module Check*', ''];
        
        // Check for important modules
        const modulesToCheck = [
            '@whiskeysockets/baileys',
            'express',
            'node-fetch',
            'pino',
            'qrcode-terminal',
            'ws'
        ];
        
        for (const moduleName of modulesToCheck) {
            try {
                const modulePackage = require(`${moduleName}/package.json`);
                result.push(`*${moduleName}:* ✅ (${modulePackage.version})`);
            } catch (err) {
                result.push(`*${moduleName}:* ❌ Not found or error`);
            }
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in checkModules:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// Command Registry Debugger
async function inspectCommand(sock, message, args) {
    try {
        if (!args[0]) {
            await safeSendText(sock, message.key.remoteJid, '❌ Please specify a command to inspect');
            return false;
        }
        
        const commandName = args[0].toLowerCase();
        let result = [`🔍 *Command Inspection: ${commandName}*`, ''];
        
        // Find the command in all modules
        const commandsPath = path.join(process.cwd(), 'src/commands');
        const files = await fs.readdir(commandsPath);
        
        let found = false;
        
        for (const file of files) {
            if (file.endsWith('.js') && !file.includes('index')) {
                const filePath = path.join(commandsPath, file);
                try {
                    // Require the module
                    const module = require(filePath);
                    const fileName = file.replace('.js', '');
                    
                    // Check if module has commands
                    if (module.commands && typeof module.commands === 'object') {
                        // Check if command exists in this module
                        if (module.commands[commandName] || 
                            (module.commands.hasOwnProperty(commandName) && module.commands[commandName] === null)) {
                            found = true;
                            
                            result.push(`*Found in module:* ${fileName}`);
                            result.push(`*Category:* ${module.category || 'None'}`);
                            
                            // Get command function info
                            const commandFunction = module.commands[commandName];
                            if (commandFunction) {
                                result.push(`*Type:* ${typeof commandFunction}`);
                                result.push(`*Function code length:* ${commandFunction.toString().length} characters`);
                                result.push(`*Parameters:* ${commandFunction.length}`);
                                result.push(`*Is async:* ${commandFunction.constructor.name === 'AsyncFunction'}`);
                            } else {
                                result.push(`*Type:* null or undefined`);
                            }
                            
                            break;
                        }
                    }
                } catch (err) {
                    // Silently ignore module loading errors
                }
            }
        }
        
        if (!found) {
            result.push('❌ Command not found in any module');
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in inspectCommand:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function listCategories(sock, message) {
    try {
        let result = ['📋 *Command Categories*', ''];
        
        // Find all categories
        const commandsPath = path.join(process.cwd(), 'src/commands');
        const files = await fs.readdir(commandsPath);
        
        const categories = new Map();
        
        for (const file of files) {
            if (file.endsWith('.js') && !file.includes('index')) {
                const filePath = path.join(commandsPath, file);
                try {
                    // Require the module
                    const module = require(filePath);
                    const fileName = file.replace('.js', '');
                    
                    // Check if module has category
                    if (module.category) {
                        if (!categories.has(module.category)) {
                            categories.set(module.category, []);
                        }
                        
                        categories.get(module.category).push(fileName);
                    }
                } catch (err) {
                    // Silently ignore module loading errors
                }
            }
        }
        
        // Sort categories by name
        const sortedCategories = Array.from(categories.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        
        result.push(`Found ${sortedCategories.length} categories:`);
        result.push('');
        
        sortedCategories.forEach(([category, modules]) => {
            result.push(`*${category}*`);
            result.push(`Modules: ${modules.join(', ')}`);
            result.push('');
        });
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in listCategories:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// Performance monitoring
async function memoryMonitor(sock, message) {
    try {
        let result = ['📊 *Memory Monitor*', ''];
        
        // Get initial memory usage
        const initialMemory = process.memoryUsage();
        
        // Run garbage collector if available
        if (global.gc) {
            global.gc();
            result.push('*Garbage Collection:* ✅ Triggered');
        } else {
            result.push('*Garbage Collection:* ❌ Not available');
        }
        
        // Get memory after GC
        const currentMemory = process.memoryUsage();
        
        result.push('\n*Memory Usage:*');
        result.push(`RSS: ${formatBytes(currentMemory.rss)}`);
        result.push(`Heap Total: ${formatBytes(currentMemory.heapTotal)}`);
        result.push(`Heap Used: ${formatBytes(currentMemory.heapUsed)}`);
        result.push(`External: ${formatBytes(currentMemory.external)}`);
        
        // Show difference if GC was run
        if (global.gc) {
            const heapDiff = initialMemory.heapUsed - currentMemory.heapUsed;
            result.push(`\n*Memory Freed:* ${formatBytes(heapDiff)}`);
        }
        
        // Memory limits
        result.push('\n*Memory Limits:*');
        
        // Get memory limit from Node.js
        const memoryLimit = process.memoryUsage().heapTotal;
        result.push(`Heap Limit: ${formatBytes(memoryLimit)}`);
        
        // Calculate percentage used
        const percentUsed = (currentMemory.heapUsed / memoryLimit * 100).toFixed(2);
        result.push(`Usage: ${percentUsed}% of available heap`);
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in memoryMonitor:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function processInfo(sock, message) {
    try {
        let result = ['🔄 *Process Information*', ''];
        
        result.push(`*PID:* ${process.pid}`);
        result.push(`*Parent PID:* ${process.ppid}`);
        result.push(`*Node.js Version:* ${process.version}`);
        result.push(`*Architecture:* ${process.arch}`);
        result.push(`*Platform:* ${process.platform}`);
        
        const uptime = process.uptime();
        result.push(`*Uptime:* ${formatUptime(uptime)}`);
        
        // Process arguments
        result.push('\n*Process Arguments:*');
        process.argv.forEach((arg, i) => {
            result.push(`${i}: ${arg}`);
        });
        
        // Current directory
        result.push(`\n*Current Directory:* ${process.cwd()}`);
        
        // Environment
        result.push('\n*Environment:* ' + process.env.NODE_ENV || 'Not set');
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in processInfo:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// Log And Error Debugging
async function showLogs(sock, message, args) {
    try {
        const count = args[0] ? parseInt(args[0]) : 50;
        const validCount = isNaN(count) ? 50 : Math.min(Math.max(count, 10), 100);
        
        let result = [`📜 *Last ${validCount} Log Lines*`, ''];
        
        try {
            // Use tail to get the last N lines
            const { stdout } = await exec(`tail -n ${validCount} logs/bot.log`);
            
            result.push('```');
            result.push(stdout);
            result.push('```');
        } catch (err) {
            result.push('❌ Failed to read logs');
            result.push(`Error: ${err.message}`);
            
            // Try to check if log file exists
            try {
                await fs.access('logs/bot.log');
                result.push('Log file exists but could not be read');
            } catch (accessErr) {
                result.push('Log file does not exist at logs/bot.log');
            }
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in showLogs:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function showErrors(sock, message, args) {
    try {
        const count = args[0] ? parseInt(args[0]) : 50;
        const validCount = isNaN(count) ? 50 : Math.min(Math.max(count, 10), 100);
        
        let result = [`⚠️ *Last ${validCount} Error Log Lines*`, ''];
        
        try {
            // Use grep to filter only error messages and get the last N lines
            const { stdout } = await exec(`grep -i "error\\|warn\\|exception" logs/bot.log | tail -n ${validCount}`);
            
            if (stdout.trim()) {
                result.push('```');
                result.push(stdout);
                result.push('```');
            } else {
                result.push('No error logs found');
            }
        } catch (err) {
            result.push('❌ Failed to read error logs');
            result.push(`Error: ${err.message}`);
            
            // Check if grep failed because there are no matches
            if (err.stderr && err.stderr.includes('No such file or directory')) {
                result.push('Log file does not exist');
            }
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in showErrors:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function createDebugLog(sock, message, args) {
    try {
        const note = args.join(' ') || 'Debug log created';
        
        let result = ['🔍 *Debug Log Created*', ''];
        
        // Collect system information
        const systemInfo = {
            platform: os.platform(),
            release: os.release(),
            arch: os.arch(),
            memory: formatBytes(os.totalmem()),
            freeMemory: formatBytes(os.freemem()),
            node: process.version,
            timestamp: new Date().toISOString(),
            uptime: formatUptime(process.uptime()),
            processMemory: formatBytes(process.memoryUsage().heapUsed),
            note: note
        };
        
        // Format log
        const logEntry = `[DEBUG LOG] ${systemInfo.timestamp}\n` +
            `Note: ${systemInfo.note}\n` +
            `Node: ${systemInfo.node}\n` +
            `Platform: ${systemInfo.platform} ${systemInfo.release} (${systemInfo.arch})\n` +
            `Memory: ${systemInfo.freeMemory} free of ${systemInfo.memory}\n` +
            `Process Memory: ${systemInfo.processMemory}\n` +
            `Uptime: ${systemInfo.uptime}\n`;
        
        // Write to log
        logger.debug(logEntry);
        
        result.push(`Debug log created with timestamp: ${systemInfo.timestamp}`);
        result.push(`Note: ${systemInfo.note}`);
        result.push('Entry has been written to the log file');
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in createDebugLog:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function listLogFiles(sock, message) {
    try {
        let result = ['📋 *Log Files*', ''];
        
        try {
            // Check if logs directory exists
            await fs.access('logs');
            
            // List files in logs directory
            const files = await fs.readdir('logs');
            
            if (files.length === 0) {
                result.push('No log files found');
            } else {
                result.push(`Found ${files.length} log files:`);
                result.push('');
                
                // Get stats for each file
                const fileDetails = await Promise.all(files.map(async file => {
                    const filePath = path.join('logs', file);
                    const stats = await fs.stat(filePath);
                    return {
                        name: file,
                        size: formatBytes(stats.size),
                        modified: stats.mtime.toLocaleString()
                    };
                }));
                
                // Sort by modification time (newest first)
                fileDetails.sort((a, b) => {
                    return new Date(b.modified) - new Date(a.modified);
                });
                
                fileDetails.forEach(file => {
                    result.push(`*${file.name}*`);
                    result.push(`  Size: ${file.size}`);
                    result.push(`  Modified: ${file.modified}`);
                    result.push('');
                });
            }
        } catch (err) {
            result.push(`❌ Error: ${err.message}`);
            result.push('Log directory may not exist');
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in listLogFiles:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// Configuration Debugging
async function checkConfig(sock, message) {
    try {
        let result = ['⚙️ *Configuration Check*', ''];
        
        try {
            // Check for .env file
            const hasEnv = fs2.existsSync('.env');
            result.push(`*.env file:* ${hasEnv ? '✅ Found' : '❌ Not found'}`);
            
            if (hasEnv) {
                // Count variables in .env (don't show values)
                const envContent = await fs.readFile('.env', 'utf8');
                const envLines = envContent.split('\n').filter(line => 
                    line.trim() && !line.trim().startsWith('#') && line.includes('=')
                );
                result.push(`     Variables: ${envLines.length}`);
            }
            
            // Check for config files
            const configFiles = [
                'config.js',
                'config.json',
                'settings.js',
                'settings.json'
            ];
            
            result.push('\n*Config Files:*');
            
            for (const file of configFiles) {
                const exists = fs2.existsSync(file);
                result.push(`*${file}:* ${exists ? '✅ Found' : '❌ Not found'}`);
            }
            
            // Check package.json
            const pkgExists = fs2.existsSync('package.json');
            result.push(`\n*package.json:* ${pkgExists ? '✅ Found' : '❌ Not found'}`);
            
            if (pkgExists) {
                const pkgContent = JSON.parse(await fs.readFile('package.json', 'utf8'));
                result.push(`     Name: ${pkgContent.name || 'Not set'}`);
                result.push(`     Version: ${pkgContent.version || 'Not set'}`);
                result.push(`     Dependencies: ${Object.keys(pkgContent.dependencies || {}).length}`);
                result.push(`     Scripts: ${Object.keys(pkgContent.scripts || {}).length}`);
            }
        } catch (err) {
            result.push(`❌ Error checking configs: ${err.message}`);
        }
        
        await safeSendText(sock, message.key.remoteJid, result.join('\n'));
        return true;
    } catch (err) {
        logger.error('Error in checkConfig:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

// Testing Functions
async function echo(sock, message, args) {
    try {
        const text = args.join(' ') || 'Echo test';
        await safeSendText(sock, message.key.remoteJid, text);
        return true;
    } catch (err) {
        logger.error('Error in echo:', err);
        await safeSendText(sock, message.key.remoteJid, `❌ Error: ${err.message}`);
        return false;
    }
}

async function testError(sock, message) {
    try {
        throw new Error('This is a test error');
    } catch (err) {
        logger.error('Test error triggered:', err);
        await safeSendText(sock, message.key.remoteJid, `✅ Error logged successfully: ${err.message}`);
        return true;
    }
}

// Utility functions
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

module.exports = {
    name: 'debug',
    category: 'debug',
    description: 'Debug commands for development and testing',
    commands: {
        // Original command
        inspect: inspectModules,
        
        // System Information Commands
        sysinfo: getSystemInfo,
        nodeinfo: getNodeInfo,
        memory: getMemoryUsage,
        env: listEnvVars,
        
        // File System Debug Commands
        ls: listDirectory,
        dir: listDirectory,
        cat: readFile,
        fileinfo: fileInfo,
        
        // Network Debug Commands
        connection: checkConnection,
        ping: pingHost,
        
        // Process Debug Commands
        ps: listProcesses,
        top: listProcesses,
        disk: getDiskSpace,
        diskspace: getDiskSpace,
        
        // WhatsApp Debug Commands
        connection_info: getConnectionInfo,
        groups: listGroups,
        device: getDeviceInfo,
        testmsg: testMessage,
        mention: mentionDebug,
        
        // Module Debug Commands
        packages: listPackages,
        version: checkVersion,
        modules: checkModules,
        
        // Command Registry Debugger
        command: inspectCommand,
        categories: listCategories,
        
        // Performance monitoring
        memmonitor: memoryMonitor,
        process: processInfo,
        
        // Log And Error Debugging
        logs: showLogs,
        errors: showErrors,
        debuglog: createDebugLog,
        logfiles: listLogFiles,
        
        // Configuration Debugging
        config: checkConfig,
        
        // Testing Functions
        echo: echo,
        testerror: testError,
        
        // Aliases for common commands
        stat: fileInfo,
        netstat: checkConnection,
        df: getDiskSpace,
        free: getMemoryUsage,
        uptime: processInfo,
        tail: showLogs,
        grep: showErrors,
        find: listDirectory,
        info: getSystemInfo,
        status: getConnectionInfo,
        check: checkConfig,
        test: testMessage,
        catfile: readFile,
        lsdir: listDirectory,
        showfile: readFile,
        showdir: listDirectory,
        meminfo: memoryMonitor,
        sysstat: getSystemInfo,
        procinfo: processInfo,
        showconfig: checkConfig,
        showlogs: showLogs,
        showerrors: showErrors,
        memstat: memoryMonitor
    }
};