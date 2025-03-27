/**
 * Quick Start HTTP Server
 * 
 * This module provides a minimal HTTP server that starts immediately
 * to satisfy the port opening requirement, then the full server
 * functionality is added later.
 */

const express = require('express');
const http = require('http');
const logger = require('./logger');

// Global reference to server for later enhancement
let app = null;
let server = null;

/**
 * Start a minimal HTTP server immediately
 * @param {number} port - The port to listen on
 * @returns {Object} - The Express app and HTTP server
 */
function startMinimalServer(port = 5000) {
    // Create Express app if it doesn't exist
    if (!app) {
        app = express();
        
        // Simple root route that responds immediately
        app.get('/', (req, res) => {
            res.setHeader('Content-Type', 'text/html');
            res.write('<html><head><title>WhatsApp Bot Starting</title>');
            res.write('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
            res.write('<style>body{font-family:Arial,sans-serif;text-align:center;margin-top:50px;background-color:#f5f5f5;}');
            res.write('h1{color:#075e54;}');
            res.write('.container{max-width:500px;margin:0 auto;padding:20px;background-color:white;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}');
            res.write('.starting{color:#FFA500;font-size:20px;margin:20px 0;}');
            res.write('.loader{border:5px solid #f3f3f3;border-top:5px solid #075e54;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:20px auto;}');
            res.write('@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}');
            res.write('</style></head><body>');
            res.write('<div class="container">');
            res.write('<h1>BLACKSKY-MD WhatsApp Bot</h1>');
            res.write('<p class="starting">Starting up...</p>');
            res.write('<div class="loader"></div>');
            res.write('<p>The bot is initializing. Please wait while services are starting.</p>');
            res.write('<p>This page will refresh automatically in 5 seconds.</p>');
            res.write('<script>setTimeout(function() { window.location.reload(); }, 5000);</script>');
            res.write('</div>');
            res.write('</body></html>');
            res.end();
        });

        // Create HTTP server
        server = http.createServer(app);
        
        // Start listening on specified port
        server.listen(port, '0.0.0.0', () => {
            logger.info(`Quick-start HTTP server running on port ${port}`);
        });
    }
    
    return { app, server };
}

/**
 * Get the express app and server references
 * @returns {Object} - The Express app and HTTP server
 */
function getServerReferences() {
    return { app, server };
}

module.exports = {
    startMinimalServer,
    getServerReferences
};