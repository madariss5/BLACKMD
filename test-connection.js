/**
 * Simple WhatsApp Connection Test
 * This script tests the basic connection to WhatsApp
 * without any of the extra functionality
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Create auth directory if it doesn't exist
const AUTH_DIR = './auth_info_baileys';
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Configure logger to be more concise
const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true,
      ignore: 'hostname,pid'
    }
  }
});

// Connection configuration
const socketConfig = {
  printQRInTerminal: true,
  auth: undefined,  // Will be set after loading auth state
  logger: logger,
  browser: ['BlackskyMD', 'Chrome', '1.0.0']
};

async function connectToWhatsApp() {
  console.log('Starting WhatsApp connection test...');
  
  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  socketConfig.auth = state;
  
  // Create WhatsApp socket connection
  const sock = makeWASocket(socketConfig);
  
  // Handle connection events
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to:', lastDisconnect?.error?.message || 'unknown reason');
      
      if (shouldReconnect) {
        console.log('Reconnecting...');
        connectToWhatsApp();
      } else {
        console.log('Not reconnecting as user logged out');
      }
    } else if (connection === 'open') {
      console.log('Connection established successfully!');
      
      // Get own user info
      const userInfo = sock.user;
      console.log('Connected as:', userInfo.name || userInfo.id.split(':')[0]);
      
      // Stay alive for 60 seconds then exit
      console.log('Test successful. Will exit in 60 seconds...');
      setTimeout(() => {
        console.log('Test completed. Exiting...');
        process.exit(0);
      }, 60000);
    }
    
    if (qr) {
      console.log('QR code available. Please scan with your phone.');
    }
  });
  
  // Save credentials whenever auth updated
  sock.ev.on('creds.update', saveCreds);
  
  // Log messages (optional)
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      console.log('New message received:', m.messages[0].key.remoteJid);
    }
  });
  
  return sock;
}

// Start the connection
connectToWhatsApp().catch(err => {
  console.error('Error in WhatsApp connection:', err);
});

// Handle unexpected errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Test script running. Waiting for WhatsApp connection...');