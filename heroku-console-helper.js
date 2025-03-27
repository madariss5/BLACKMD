/**
 * Heroku Console Helper
 * 
 * This script creates a simple web-based console interface for your Heroku deployment
 * allowing you to see logs and run simple diagnostic commands remotely.
 * 
 * To use, deploy your app to Heroku, then navigate to:
 * https://your-heroku-app.herokuapp.com/console
 */

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create console router
const consoleRouter = express.Router();

// Basic authentication middleware
const basicAuth = (req, res, next) => {
  // Get owner number from environment or use a default
  const ownerNumber = process.env.OWNER_NUMBER || '123456789';
  
  // Create a simple PIN based on the owner number (last 4 digits)
  const pin = ownerNumber.slice(-4);
  
  // Get credentials from request
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Heroku Console"');
    return res.status(401).send('Authentication required');
  }
  
  // Get base64 encoded credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');
  
  // Simple auth: username must be "admin" and password must match PIN
  if (username === 'admin' && password === pin) {
    return next();
  }
  
  res.setHeader('WWW-Authenticate', 'Basic realm="Heroku Console"');
  return res.status(401).send('Invalid credentials');
};

// GET route for console interface
consoleRouter.get('/', basicAuth, (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>BlackskyMD Heroku Console</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
        color: #333;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: 20px;
      }
      h1 {
        color: #2c3e50;
        margin-bottom: 20px;
      }
      .panel {
        background-color: #fff;
        border-radius: 5px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .panel h2 {
        margin-top: 0;
        color: #3498db;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
      }
      pre {
        background-color: #2c3e50;
        color: #ecf0f1;
        padding: 15px;
        border-radius: 5px;
        overflow-x: auto;
        white-space: pre-wrap;
        font-family: monospace;
      }
      .status-ok {
        color: #27ae60;
        font-weight: bold;
      }
      .status-warning {
        color: #f39c12;
        font-weight: bold;
      }
      .status-error {
        color: #e74c3c;
        font-weight: bold;
      }
      .btn {
        display: inline-block;
        background-color: #3498db;
        color: white;
        padding: 8px 15px;
        text-decoration: none;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-size: 14px;
        margin-right: 10px;
        margin-bottom: 10px;
      }
      .btn:hover {
        background-color: #2980b9;
      }
      .btn-danger {
        background-color: #e74c3c;
      }
      .btn-danger:hover {
        background-color: #c0392b;
      }
      .btn-success {
        background-color: #27ae60;
      }
      .btn-success:hover {
        background-color: #219955;
      }
      .btn-warning {
        background-color: #f39c12;
      }
      .btn-warning:hover {
        background-color: #d68910;
      }
      form {
        margin-bottom: 20px;
      }
      input[type="text"] {
        padding: 8px;
        width: 70%;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }
      @media (max-width: 600px) {
        .container {
          padding: 10px;
        }
        .panel {
          padding: 15px;
        }
        input[type="text"] {
          width: 60%;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>BlackskyMD Heroku Console</h1>
      
      <div class="panel">
        <h2>System Status</h2>
        <p><strong>Node Version:</strong> ${process.version}</p>
        <p><strong>Platform:</strong> ${process.platform}</p>
        <p><strong>Uptime:</strong> ${Math.floor(process.uptime() / 60)} minutes</p>
        <p><strong>Memory Usage:</strong> ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'Not set'}</p>
        <p><strong>WhatsApp Connection:</strong> <span id="whatsapp-status">Checking...</span></p>
        
        <div>
          <button class="btn" onclick="location.reload()">Refresh Status</button>
          <a class="btn btn-warning" href="/console/logs">View Logs</a>
          <a class="btn btn-success" href="/console/status">Check WhatsApp Status</a>
          <a class="btn btn-danger" href="/console/restart" onclick="return confirm('Are you sure you want to restart the WhatsApp connection?')">Restart WhatsApp</a>
        </div>
      </div>
      
      <div class="panel">
        <h2>Environment Variables</h2>
        <pre id="env-vars">Loading...</pre>
      </div>
      
      <div class="panel">
        <h2>Command Console</h2>
        <form action="/console/run" method="post">
          <input type="text" name="command" placeholder="Enter command (e.g., 'ls -la')">
          <button type="submit" class="btn">Run</button>
        </form>
        <pre id="command-output">No command output yet. Run a command to see results.</pre>
      </div>
      
      <div class="panel">
        <h2>Auth Directory Status</h2>
        <pre id="auth-status">Loading...</pre>
        <button class="btn" onclick="checkAuthStatus()">Check Auth Status</button>
      </div>
    </div>
    
    <script>
      // Function to fetch and display environment variables
      function loadEnvVars() {
        fetch('/console/env')
          .then(response => response.text())
          .then(data => {
            document.getElementById('env-vars').textContent = data;
          })
          .catch(err => {
            document.getElementById('env-vars').textContent = 'Error loading environment variables: ' + err.message;
          });
      }
      
      // Function to check WhatsApp status
      function checkWhatsAppStatus() {
        fetch('/console/status')
          .then(response => response.json())
          .then(data => {
            const statusElement = document.getElementById('whatsapp-status');
            if (data.connected) {
              statusElement.textContent = 'Connected ✓';
              statusElement.className = 'status-ok';
            } else {
              statusElement.textContent = 'Disconnected ✗';
              statusElement.className = 'status-error';
            }
          })
          .catch(err => {
            const statusElement = document.getElementById('whatsapp-status');
            statusElement.textContent = 'Error checking status';
            statusElement.className = 'status-warning';
          });
      }
      
      // Function to check auth directory status
      function checkAuthStatus() {
        fetch('/console/auth-status')
          .then(response => response.text())
          .then(data => {
            document.getElementById('auth-status').textContent = data;
          })
          .catch(err => {
            document.getElementById('auth-status').textContent = 'Error checking auth status: ' + err.message;
          });
      }
      
      // Load data when page loads
      window.onload = function() {
        loadEnvVars();
        checkWhatsAppStatus();
        checkAuthStatus();
        
        // Check for command output in URL
        const urlParams = new URLSearchParams(window.location.search);
        const output = urlParams.get('output');
        if (output) {
          document.getElementById('command-output').textContent = decodeURIComponent(output);
        }
      };
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// GET route for logs
consoleRouter.get('/logs', basicAuth, (req, res) => {
  const logPath = path.join(process.cwd(), 'logs', 'whatsapp.log');
  
  if (fs.existsSync(logPath)) {
    // Get the last 100 lines of the log file
    exec(`tail -n 100 ${logPath}`, (error, stdout, stderr) => {
      if (error) {
        return res.send(`Error reading logs: ${error.message}\n\n${stderr}`);
      }
      
      res.send(`<pre>${stdout}</pre><a href="/console">Back to Console</a>`);
    });
  } else {
    // Try to find any log files
    exec('find . -name "*.log" | xargs tail -n 20', (error, stdout, stderr) => {
      if (error || !stdout) {
        return res.send(`No log files found. Error: ${error ? error.message : 'Unknown'}\n\n${stderr}`);
      }
      
      res.send(`<pre>${stdout}</pre><a href="/console">Back to Console</a>`);
    });
  }
});

// GET route for environment variables
consoleRouter.get('/env', basicAuth, (req, res) => {
  const env = process.env;
  let envText = '';
  
  // Filter sensitive information
  for (const key in env) {
    if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN') || key.includes('PASS') || key.includes('CREDS')) {
      envText += `${key}=<SENSITIVE>\n`;
    } else {
      envText += `${key}=${env[key]}\n`;
    }
  }
  
  res.send(envText);
});

// GET route for WhatsApp status
consoleRouter.get('/status', basicAuth, (req, res) => {
  // Check if we can access the WhatsApp connection
  try {
    // Try to find the WhatsApp status from the global scope
    let status = { connected: false, message: 'Unable to determine connection status' };
    
    // If global.whatsapp exists, use it
    if (global.whatsapp && global.whatsapp.isConnected) {
      status = { 
        connected: global.whatsapp.isConnected(),
        user: global.whatsapp.user || null
      };
    }
    
    // If global.sock exists, use it
    if (global.sock && global.sock.user) {
      status = { 
        connected: true,
        user: global.sock.user
      };
    }
    
    res.json(status);
  } catch (error) {
    res.json({
      connected: false,
      error: error.message
    });
  }
});

// POST route for running commands
consoleRouter.post('/run', basicAuth, (req, res) => {
  const command = req.body.command;
  
  // Security check - prevent certain dangerous commands
  const dangerousCommands = ['rm', 'mkfs', 'dd', '>', '|'];
  if (dangerousCommands.some(cmd => command.includes(cmd))) {
    return res.redirect(`/console?output=${encodeURIComponent('Command not allowed for security reasons')}`);
  }
  
  // Execute the command
  exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    const output = error ? `Error: ${error.message}\n\n${stderr}` : stdout;
    res.redirect(`/console?output=${encodeURIComponent(output)}`);
  });
});

// GET route for auth directory status
consoleRouter.get('/auth-status', basicAuth, (req, res) => {
  const authDir = process.env.AUTH_DIR || 'auth_info_baileys';
  const authPath = path.join(process.cwd(), authDir);
  
  let output = `Auth Directory: ${authPath}\n\n`;
  
  try {
    if (!fs.existsSync(authPath)) {
      output += `Directory does not exist!\n`;
    } else {
      const files = fs.readdirSync(authPath);
      output += `Directory exists with ${files.length} files/directories:\n\n`;
      
      files.forEach(file => {
        const filePath = path.join(authPath, file);
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        const fileSizeFormatted = fileSize > 1024 
          ? `${(fileSize / 1024).toFixed(2)} KB` 
          : `${fileSize} bytes`;
        
        output += `${file} (${fileSizeFormatted})\n`;
        
        // If it's creds.json, check if it's valid JSON
        if (file === 'creds.json') {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            JSON.parse(content);
            output += `  ✓ Valid JSON format\n`;
          } catch (jsonError) {
            output += `  ✗ Invalid JSON format: ${jsonError.message}\n`;
          }
        }
      });
    }
  } catch (error) {
    output += `Error reading auth directory: ${error.message}`;
  }
  
  res.send(output);
});

// GET route for restarting WhatsApp connection
consoleRouter.get('/restart', basicAuth, (req, res) => {
  // Attempt to restart the WhatsApp connection
  try {
    if (global.restartConnection && typeof global.restartConnection === 'function') {
      global.restartConnection();
      res.send('<h3>WhatsApp connection restart initiated</h3><p>Please wait a few seconds...</p><a href="/console">Back to Console</a>');
    } else {
      res.send('<h3>Unable to restart connection</h3><p>The restart function is not available.</p><a href="/console">Back to Console</a>');
    }
  } catch (error) {
    res.send(`<h3>Error restarting connection</h3><p>${error.message}</p><a href="/console">Back to Console</a>`);
  }
});

// Export the router
module.exports = consoleRouter;

// If this file is run directly, print instructions
if (require.main === module) {
  console.log('Heroku Console Helper');
  console.log('---------------------');
  console.log('This module provides a web console for Heroku deployments.');
  console.log('To use it, you need to integrate it into your Express app:');
  console.log('\n1. Import it in your main app file:');
  console.log('   const consoleRouter = require(\'./heroku-console-helper\');');
  console.log('\n2. Add it to your Express app:');
  console.log('   app.use(\'/console\', consoleRouter);');
  console.log('\n3. Make sure your app has body-parser middleware.');
}