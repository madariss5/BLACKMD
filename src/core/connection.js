/**
 * WhatsApp Connection Manager
 * Manages connections with enhanced reliability and auto-recovery
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys/lib/index');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const { ensureDirectoryExists } = require('../utils/fileUtils');

// Default connection settings
const DEFAULT_RECONNECT_INTERVAL = 3000; // 3 seconds
const MAX_RECONNECT_RETRIES = 10;
const RECONNECT_DECAY_FACTOR = 1.5; // Exponential backoff factor
const MAX_BACKUPS = 1; // Only keep one backup per session

/**
 * Connection manager for WhatsApp interactions
 */
class ConnectionManager {
    constructor(options = {}) {
        this.authDir = options.authDir || './auth_info_baileys';
        this.logLevel = options.logLevel || 'info';
        this.options = options;

        // Initialize backup tracking flag
        this.hasBackupBeenCreated = false;

        // Generate a unique but consistent instance ID to help with session conflicts
        // This format helps avoid session conflicts without generating a new ID on each restart
        const systemId = require('os').hostname().slice(0, 6);
        this.instanceId = `BLACKSKY-MD-${systemId}-${Math.random().toString(36).substr(2, 8)}`;

        // Store the instance ID in a file for consistency across restarts
        try {
            const instanceIdFile = path.join(process.cwd(), '.instance_id');
            if (fs.existsSync(instanceIdFile)) {
                this.instanceId = fs.readFileSync(instanceIdFile, 'utf8').trim();
                logger.info(`Using existing instance ID: ${this.instanceId}`);
            } else {
                fs.writeFileSync(instanceIdFile, this.instanceId);
                logger.info(`Created new instance ID: ${this.instanceId}`);
            }
        } catch (error) {
            logger.warn(`Could not persist instance ID: ${error.message}`);
        }

        this.sock = null;
        this.state = null;
        this.saveCreds = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectCount = 0;
        this.reconnectInterval = DEFAULT_RECONNECT_INTERVAL;
        this.reconnectTimer = null; // Store the reconnect timer for cancelation
        this.connectionEventHandlers = [];
        this.messageHandlers = [];
        this.wasConnected = false;

        // Connection monitoring vars
        this.lastMessageTimestamp = Date.now();
        this.heartbeatInterval = null;
        this.connectionMonitorInterval = null;
        this.pingTimeout = null;
        this.lastHeartbeatAck = null;
        this.monitoringLog = path.join(process.cwd(), 'connection-monitor.log');

        // Connection health metrics
        this.consecutiveFailedPings = 0;
        this.socketErrors = 0;
        this.pingLatency = null;
        this.connectionHealth = 100; // Health score (0-100)
        this.reconnectSuccess = 0;
        this.reconnectFailure = 0;
        this.lastActivityTimestamp = Date.now();

        // Ensure auth directory exists
        ensureDirectoryExists(this.authDir);

        this.logger = pino({ 
            level: this.logLevel,
            // Simplified logger without transport to avoid pino-pretty errors
            timestamp: () => `,"time":"${new Date().toISOString()}"`,
            formatters: {
                level: (label) => {
                    return { level: label.toUpperCase() };
                }
            }
        });

        logger.info(`Connection manager initialized with instance ID: ${this.instanceId}`);
    }

    /**
     * Initialize connection
     * @returns {Promise<Object>} WhatsApp socket connection
     */
    async connect() {
        if (this.isConnecting) {
            logger.warn('Connection attempt already in progress');
            return null;
        }

        this.isConnecting = true;
        logger.info('Initializing WhatsApp connection...');

        try {
            // Get latest Baileys version
            const { version } = await fetchLatestBaileysVersion();
            logger.info(`Using Baileys version: ${version.join('.')}`);

            // Load auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            this.state = state;
            this.saveCreds = saveCreds;

            // Create socket connection with unique instance id in browser info
            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: true,
                markOnlineOnConnect: this.options.markOnlineOnConnect !== false,
                logger: this.logger,
                browser: this.options.browser || [this.instanceId, 'Chrome', '4.0.0'],
                maxCachedMessages: 1000,
                msgRetryCounterCache: new NodeCache({ 
                    stdTTL: 300,
                    checkperiod: 60,
                    useClones: false
                }),
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,  // More frequent keep-alive for Heroku
                patchMessageBeforeSending: (message) => {
                    // Add slight delay to message sending to prevent connection drop
                    return new Promise(resolve => setTimeout(() => resolve(message), 100));
                },
                // Add additional options for better Heroku compatibility
                retryRequestDelayMs: 250,
                emitOwnEvents: false,
                fireInitQueries: true,
                shouldIgnoreJid: () => false,
                mobile: false
            });

            // Set up event handlers
            this.setupSocketHandlers();
            this.isConnecting = false;

            return this.sock;
        } catch (error) {
            logger.error('Failed to initialize connection:', error);
            this.isConnecting = false;

            if (this.reconnectCount < MAX_RECONNECT_RETRIES) {
                this.scheduleReconnect();
            } else {
                logger.error('Max reconnection attempts reached');
            }

            return null;
        }
    }

    /**
     * Set up event handlers for the socket
     */
    setupSocketHandlers() {
        if (!this.sock) return;

        // Handle connection events
        this.sock.ev.on('connection.update', async (update) => {
            try {
                await this.handleConnectionUpdate(update);
            } catch (error) {
                logger.error('Error in connection update handler:', error);
            }
        });

        // Save credentials on update
        this.sock.ev.on('creds.update', this.saveCreds);

        // Handle messages
        this.sock.ev.on('messages.upsert', (messages) => {
            this.handleIncomingMessages(messages);
        });
    }

    /**
     * Handle connection updates
     * @param {Object} update Connection update event
     * @returns {Promise<void>}
     */
    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        // Notify all registered event handlers
        this.notifyEventHandlers(update);

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom && 
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut);

            const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
            const statusCode = lastDisconnect?.error?.output?.statusCode || 'Unknown status';

            logger.warn(`Connection closed due to: ${errorMessage} (Code: ${statusCode})`);
            this.isConnected = false;

            // Reset backup creation flag when connection is closed
            // This ensures we'll create a new backup when we reconnect
            this.hasBackupBeenCreated = false;

            // Enhanced session conflict and decryption error detection
            const isConflict = lastDisconnect?.error?.output?.payload?.error === 'conflict' ||
                              errorMessage.includes('conflict') ||
                              statusCode === 440 ||
                              statusCode === DisconnectReason.connectionReplaced ||
                              errorMessage.includes('replaced') ||
                              errorMessage.includes('session');

            // Also treat decryption errors as session conflicts requiring reset
            const isDecryptionError = errorMessage.includes('decrypt') ||
                                     errorMessage.includes('encryption') ||
                                     errorMessage.includes('No session found') ||
                                     errorMessage.includes('Bad MAC');

            if (isConflict || isDecryptionError) {
                logger.warn(`Session issue detected: ${isConflict ? 'conflict' : 'decryption error'}`);

                // Create a backup of the current session before attempting to fix
                try {
                    await this.backupSession(true, 'session_repair'); // Force backup for session repair
                    logger.info('Created session backup before attempting session repair');

                    // For decryption errors, attempt to clean problematic session files
                    if (isDecryptionError) {
                        await this.repairSessionFiles();
                    }
                } catch (err) {
                    logger.error('Failed to create session backup:', err);
                }

                // Clear any existing reconnect attempts for this issue
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                }

                // Add a longer adaptive delay for resolution
                // The delay increases with each detection to prevent rapid reconnection attempts
                const conflictDelay = Math.min(10000 + (this.reconnectCount * 5000), 30000);

                logger.info(`Scheduling reconnection after session issue in ${conflictDelay/1000} seconds...`);

                // Store the timer so we can clear it if needed
                this.reconnectTimer = setTimeout(() => {
                    if (!this.isConnected && !this.isConnecting) {
                        logger.info('Attempting to reconnect after session repair...');
                        // Reset connection state for clean reconnection
                        this.sock = null;
                        this.connect();
                    }
                }, conflictDelay);
                return;
            }

            // Special handling for logout cases
            if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                logger.warn('Account logged out - preparing new session');

                try {
                    // First, backup the current session in case we need it later
                    await this.backupSession(true, 'logout'); // Force backup for logout
                    logger.info('Created auth backup before creating new session');

                    // Instead of repairing, we'll create a completely new session
                    // Delete all auth files to force a fresh start
                    try {
                        const authDir = this.authDir;

                        // Make sure the auth directory exists
                        if (fs.existsSync(authDir)) {
                            // Read all files in the directory
                            const files = fs.readdirSync(authDir);

                            // Delete each file
                            for (const file of files) {
                                const filePath = path.join(authDir, file);
                                if (fs.statSync(filePath).isFile()) {
                                    fs.unlinkSync(filePath);
                                    logger.debug(`Deleted auth file: ${file}`);
                                }
                            }

                            logger.info('Cleared auth directory for new session');
                        } else {
                            // Create the directory if it doesn't exist
                            fs.mkdirSync(authDir, { recursive: true });
                            logger.info('Created fresh auth directory for new session');
                        }
                    } catch (cleanError) {
                        logger.error('Error clearing auth directory:', cleanError);
                    }

                    // Force a reconnection attempt with a longer delay
                    setTimeout(() => {
                        this.reconnectCount = 0; // Reset counter for fresh start
                        logger.info('Connecting with fresh session after logout...');
                        this.connect();
                    }, 5000);
                } catch (error) {
                    logger.error('Failed to prepare for fresh session after logout:', error);

                    // Last resort attempt - try again with longer delay
                    setTimeout(() => {
                        logger.info('Making last resort reconnection attempt...');
                        this.connect();
                    }, 10000);
                }
            } 
            // Standard reconnection for other cases
            else if (shouldReconnect) {
                if (this.reconnectCount < MAX_RECONNECT_RETRIES) {
                    this.scheduleReconnect();
                } else {
                    logger.error('Max reconnection attempts reached');
                }
            } else {
                logger.error('Connection closed permanently - possibly invalid credentials');

                // Last resort attempt for persistent connection issues
                if (this.wasConnected && this.reconnectCount < 3) {
                    logger.info('Attempting emergency reconnection...');
                    setTimeout(() => this.connect(), 10000);
                }
            }
        } else if (connection === 'open') {
            logger.success('WhatsApp connection established successfully');
            this.isConnected = true;
            this.wasConnected = true;
            this.reconnectCount = 0;
            this.reconnectInterval = DEFAULT_RECONNECT_INTERVAL;

            // Reset health metrics on successful connection
            this.connectionHealth = 100;
            this.consecutiveFailedPings = 0;
            this.lastActivityTimestamp = Date.now();
            this.lastMessageTimestamp = Date.now();

            // Start connection monitoring
            this.startConnectionMonitoring();

            // Log connection status
            this.logConnectionStatus('Connection established');

            // Create a session backup after successful connection
            // Using a slight delay to ensure connection is fully established
            setTimeout(async () => {
                try {
                    logger.info('Creating post-connection session backup...');
                    await this.backupSession(false, 'post_connection');
                } catch (backupError) {
                    logger.warn('Error creating post-connection backup:', backupError);
                }
            }, 5000);


            // Send creds file to bot itself
            try {
                const { sendCredsFile } = require('../utils/sendCreds');
                const botNumber = this.sock.user.id.split(':')[0];
                const botJid = `${botNumber}@s.whatsapp.net`;
                await sendCredsFile(this.sock, botJid);
                logger.info('Credentials sent to bot');
            } catch (error) {
                logger.error('Error sending creds:', error);
            }
        }
    }

    /**
     * Handle incoming messages
     * @param {Object} messages Message update event
     */
    async handleIncomingMessages(messages) {
        // Enhanced message handling with batching
        const msgBatch = messages.messages || [];
        if (msgBatch.length === 0) return;

        // Group messages by chat for efficient processing
        const groupedMessages = msgBatch.reduce((acc, msg) => {
            const chatId = msg.key.remoteJid;
            if (!acc[chatId]) acc[chatId] = [];
            acc[chatId].push(msg);
            return acc;
        }, {});

        // Process each chat's messages in parallel
        await Promise.all(Object.entries(groupedMessages).map(async ([chatId, msgs]) => {
            try {
                // Process messages through all registered handlers
                await Promise.all(this.messageHandlers.map(handler => {
                    handler(msgs, this.sock);
                }));
            } catch (error) {
                logger.error(`Error processing messages for chat ${chatId}:`, error);
            }
        }));
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectCount++;

        // Apply exponential backoff
        const delay = this.reconnectInterval * Math.pow(RECONNECT_DECAY_FACTOR, this.reconnectCount - 1);
        const maxDelay = 60000; // Cap at 1 minute
        const reconnectDelay = Math.min(delay, maxDelay);

        logger.info(`Reconnecting in ${Math.round(reconnectDelay / 1000)}s (attempt ${this.reconnectCount}/${MAX_RECONNECT_RETRIES})`);

        // Store the timer so we can clear it if needed
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.isConnected && !this.isConnecting) {
                this.connect();
            }
        }, reconnectDelay);
    }

    /**
     * Register a connection event handler
     * @param {Function} handler Event handler function
     */
    onConnectionUpdate(handler) {
        if (typeof handler === 'function') {
            this.connectionEventHandlers.push(handler);
        }
    }

    /**
     * Register a message handler
     * @param {Function} handler Message handler function
     */
    onMessage(handler) {
        if (typeof handler === 'function') {
            this.messageHandlers.push(handler);
        }
    }

    /**
     * Notify all registered event handlers
     * @param {Object} update Connection update event
     */
    notifyEventHandlers(update) {
        this.connectionEventHandlers.forEach(handler => {
            try {
                handler(update, this.sock);
            } catch (error) {
                logger.error('Error in connection event handler:', error);
            }
        });
    }

    /**
     * Disconnect from WhatsApp
     */
    async disconnect() {
        // Stop connection monitoring first
        this.stopConnectionMonitoring();

        if (this.sock) {
            logger.info('Disconnecting from WhatsApp...');
            this.sock.end();
            this.sock = null;
            this.isConnected = false;
            this.logConnectionStatus('Disconnected');
        }
    }

    /**
     * Create a backup of the current session
     * @param {boolean} force - Whether to force backup creation regardless of flag
     * @param {string} reason - Reason for creating the backup
     * @returns {Promise<boolean>} Success status
     */
    async backupSession(force = false, reason = 'scheduled_backup') {
        // Skip backup if one has already been created since connecting
        // Unless force=true (for critical operations like logout)
        if (this.hasBackupBeenCreated && !force) {
            logger.info('Skipping backup creation - already created one since connecting');
            return true;
        }

        try {
            // Use a single backup directory without timestamp
            const singleBackupDir = path.join(process.cwd(), `${this.authDir}_backup_safe`);

            // Clean up previous safe backup if it exists
            if (fs.existsSync(singleBackupDir)) {
                try {
                    this.removeBackupDirectory(singleBackupDir);
                    logger.debug('Removed previous safe backup directory');
                } catch (removeError) {
                    logger.warn('Error removing previous safe backup:', removeError);
                }
            }

            // For critical reasons like session_repair or logout, create a named backup with reason
            let specialBackupDir = null;
            if (reason === 'session_repair' || reason === 'logout' || reason === 'advanced_recovery') {
                // Use a fixed name with the reason instead of timestamp
                specialBackupDir = path.join(process.cwd(), `${this.authDir}_backup_${reason}`);

                // Clean up the previous backup with this reason if it exists
                if (fs.existsSync(specialBackupDir)) {
                    try {
                        this.removeBackupDirectory(specialBackupDir);
                        logger.debug(`Removed previous ${reason} backup directory`);
                    } catch (removeError) {
                        logger.warn(`Error removing previous ${reason} backup:`, removeError);
                    }
                }

                logger.info(`Creating special backup at ${specialBackupDir} (Reason: ${reason})`);
                await this.createBackupDir(this.authDir, specialBackupDir);
            }

            // Always create/update the single backup directory
            logger.info(`Creating/updating safe backup at ${singleBackupDir}`);
            const success = await this.createBackupDir(this.authDir, singleBackupDir);

            if (success) {
                // Mark that a backup has been created since connecting
                this.hasBackupBeenCreated = true;

                // Create a timestamp file in the backup directory
                try {
                    const metadataPath = path.join(singleBackupDir, 'backup-info.json');
                    const metadata = {
                        timestamp: Date.now(),
                        date: new Date().toISOString(),
                        instanceId: this.instanceId,
                        reason: reason,
                        connectionHealth: this.connectionHealth || 100,
                        wasConnected: this.wasConnected
                    };

                    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
                    logger.debug('Created backup metadata file');
                } catch (metaError) {
                    logger.warn('Failed to create backup metadata:', metaError);
                }

                // Also create/update a backup in the standard backup dir
                try {
                    // Use a single backup directory with a fixed name
                    const coreBackupDir = path.join(process.cwd(), `${this.authDir}_backup`, 'current_backup');

                    // Remove existing directory if it exists
                    if (fs.existsSync(coreBackupDir)) {
                        this.removeBackupDirectory(coreBackupDir);
                    }

                    // Create the directory
                    ensureDirectoryExists(coreBackupDir);

                    // Only copy creds.json to the core backup
                    const credsPath = path.join(this.authDir, 'creds.json');
                    if (fs.existsSync(credsPath)) {
                        fs.copyFileSync(credsPath, path.join(coreBackupDir, 'creds.json'));
                        logger.debug('Core credentials backup created');
                    }
                } catch (coreBackupError) {
                    logger.warn('Failed to create core backup:', coreBackupError);
                }

                // Clean up any additional auth backups in the root directory
                // Keep only the necessary ones
                this.cleanupAuthBackupFolders(MAX_BACKUPS);

                logger.info(`Session backup completed successfully`);
                return true;
            } else {
                logger.error('Failed to create session backup');
                return false;
            }
        } catch (error) {
            logger.error('Error creating session backup:', error);
            return false;
        }
    }

    /**
     * Clean up old backup directories in the core backup location
     * @param {string} backupDir - Directory where the new backup was created
     * @param {number} maxBackups - Maximum number of backups to keep
     */
    cleanupOldBackups(backupDir, maxBackups = MAX_BACKUPS) {
        try {
            const backupRoot = path.dirname(backupDir);

            if (!fs.existsSync(backupRoot)) {
                return;
            }

            // Get all backup directories
            const dirs = fs.readdirSync(backupRoot)
                .filter(name => name.startsWith('backup_'))
                .map(name => ({
                    name,
                    path: path.join(backupRoot, name),
                    timestamp: parseInt(name.replace('backup_', '')) || 0
                }))
                .sort((a, b) => b.timestamp - a.timestamp); // Sort newest first

            // Keep only the newest maxBackups
            const toRemove = dirs.slice(maxBackups);

            for (const dir of toRemove) {
                this.removeBackupDirectory(dir.path);
            }

            if (toRemove.length > 0) {
                logger.info(`Cleaned up ${toRemove.length} old backup(s)`);
            }
        } catch (error) {
            logger.error('Error cleaning up old backups:', error);
        }
    }

    /**
     * Clean up auth_info_baileys_backup_* folders in the root directory
     * @param {number} maxBackups - Maximum number of backup folders to keep
     */
    cleanupAuthBackupFolders(maxBackups = MAX_BACKUPS) {
        try {
            const rootDir = process.cwd();

            // Get all auth backup folders in the root directory
            const authBackupPattern = `${this.authDir}_backup_`;
            const dirs = fs.readdirSync(rootDir)
                .filter(name => name.startsWith(authBackupPattern))
                .map(name => ({
                    name,
                    path: path.join(rootDir, name),
                    timestamp: parseInt(name.replace(authBackupPattern, '')) || 0
                }))
                .sort((a, b) => b.timestamp - a.timestamp); // Sort newest first

            // Keep only the newest maxBackups
            const toRemove = dirs.slice(maxBackups);

            for (const dir of toRemove) {
                this.removeBackupDirectory(dir.path);
            }

            if (toRemove.length > 0) {
                logger.info(`Cleaned up ${toRemove.length} auth backup folder(s)`);
            }
        } catch (error) {
            logger.error('Error cleaning up auth backup folders:', error);
        }
    }

    /**
     * Remove a backup directory and all its files
     * @param {string} dirPath Path to directory
     * @returns {boolean} Success status
     */
    removeBackupDirectory(dirPath) {
        try {
            if (!fs.existsSync(dirPath)) {
                return false;
            }

            // Get all files in directory
            const files = fs.readdirSync(dirPath);

            // Delete each file
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            }

            // Delete directory
            fs.rmdirSync(dirPath);
            return true;
        } catch (error) {
            logger.error(`Error removing backup directory ${dirPath}:`, error);
            return false;
        }
    }

    /**
     * Repair session files by removing problematic encryption keys
     * This is used to fix decryption errors and session conflicts
     * @returns {Promise<boolean>} Success status
     */
    async repairSessionFiles() {
        try {
            logger.info('Repairing session files to fix decryption issues...');

            const authDir = this.authDir;
            if (!fs.existsSync(authDir)) {
                logger.warn('Auth directory not found, cannot repair session');
                return false;
            }

            // Create a backup first before repairing - use the safe backup directory
            try {
                logger.info('Creating backup before session repair...');
                const safeBackupDir = path.join(process.cwd(), `${this.authDir}_backup_safe_repair`);

                // Clean up previous repair backup if it exists
                if (fs.existsSync(safeBackupDir)) {
                    try {
                        this.removeBackupDirectory(safeBackupDir);
                        logger.debug('Removed previous repair backup directory');
                    } catch (removeError) {
                        logger.warn('Error removing previous repair backup:', removeError);
                    }
                }

                await this.createBackupDir(authDir, safeBackupDir);
                logger.info(`Repair backup created at ${safeBackupDir}`);
            } catch (backupError) {
                logger.warn('Failed to create backup before repair:', backupError);
                // Continue with repair even if backup fails
            }

            // Only keep creds.json and delete problematic session files
            const files = fs.readdirSync(authDir);
            let deleteCount = 0;

            for (const file of files) {
                const filePath = path.join(authDir, file);

                // Keep only the essential creds file for persistent auth
                if (file !== 'creds.json' && fs.statSync(filePath).isFile()) {
                    // Delete conflict-prone files like app-state-sync-keys and pre-keys
                    if (file.includes('app-state-sync') || file.includes('pre-key') || 
                        file.includes('sender-key') || file.includes('session-')) {
                        fs.unlinkSync(filePath);
                        deleteCount++;
                    }
                }
            }

            logger.info(`Session repair complete: ${deleteCount} problematic files removed`);

            // Update repair attempt count for analytics
            this.sessionRepairAttempts = (this.sessionRepairAttempts || 0) + 1;

            return true;
        } catch (error) {
            logger.error('Error repairing session files:', error);
            return false;
        }
    }

    /**
     * Create a backup directory with session files
     * @param {string} sourceDir - Source directory to backup
     * @param {string} destDir - Destination directory for backup
     * @returns {Promise<boolean>} - Success status
     */
    async createBackupDir(sourceDir, destDir) {
        try {
            // Create destination directory if it doesn't exist
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            // Copy all files from source to destination
            const files = fs.readdirSync(sourceDir);
            let copyCount = 0;

            for (const file of files) {
                const srcPath = path.join(sourceDir, file);
                const destPath = path.join(destDir, file);

                if (fs.statSync(srcPath).isFile()) {
                    fs.copyFileSync(srcPath, destPath);
                    copyCount++;
                }
            }

            logger.info(`Backup created with ${copyCount} files copied to ${destDir}`);
            return true;
        } catch (error) {
            logger.error(`Error creating backup directory ${destDir}:`, error);
            return false;
        }
    }

    /**
     * Get connection status
     * @returns {Object} Connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            reconnectCount: this.reconnectCount,
            wasEverConnected: this.wasConnected,
            connectionHealth: this.connectionHealth,
            lastPingLatency: this.pingLatency,
            lastActivity: this.lastActivityTimestamp
        };
    }

    /**
     * Get detailed connection diagnostics
     * @returns {Object} Detailed connection diagnostics
     */
    getDiagnostics() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            reconnectCount: this.reconnectCount,
            wasEverConnected: this.wasConnected,
            reconnectSuccess: this.reconnectSuccess,
            reconnectFailure: this.reconnectFailure,
            socketErrors: this.socketErrors,
            consecutiveFailedPings: this.consecutiveFailedPings,
            connectionHealth: this.connectionHealth,
            pingLatency: this.pingLatency,
            lastMessageTimestamp: this.lastMessageTimestamp,
            lastActivityTimestamp: this.lastActivityTimestamp,
            instanceId: this.instanceId
        };
    }

    /**
     * Start connection monitoring with heartbeat mechanism
     */
    startConnectionMonitoring() {
        if (this.heartbeatInterval || this.connectionMonitorInterval) {
            // Already monitoring
            return;
        }

        logger.info('Starting connection monitoring with heartbeat...');

        // Start more frequent heartbeat for Heroku (every 15 seconds)
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 15000);

        // Monitor connection and trigger recovery if needed (check every minute)
        this.connectionMonitorInterval = setInterval(() => {
            this.checkConnectionHealth();
        }, 60000);

        // Update activity timestamp when messages are received
        const originalHandler = this.handleIncomingMessages.bind(this);
        this.handleIncomingMessages = (messages) => {
            this.lastActivityTimestamp = Date.now();
            this.lastMessageTimestamp = Date.now();
            // Update connection health based on activity
            this.updateConnectionHealth(+10); // Activity is a good sign

            // Call the original handler
            originalHandler(messages);
        };

        // Log start of monitoring
        this.logConnectionStatus('Connection monitoring started');
    }

    /**
     * Stop connection monitoring
     */
    stopConnectionMonitoring() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.connectionMonitorInterval) {
            clearInterval(this.connectionMonitorInterval);
            this.connectionMonitorInterval = null;
        }

        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }

        logger.info('Connection monitoring stopped');
        this.logConnectionStatus('Connection monitoring stopped');
    }

    /**
     * Send a heartbeat ping to verify connection
     */
    async sendHeartbeat() {
        if (!this.sock || !this.isConnected) {
            logger.debug('Cannot send heartbeat: not connected');
            return;
        }

        try {
            logger.debug('Sending connection heartbeat...');

            const pingStart = Date.now();

            // Set a timeout for ping response
            this.pingTimeout = setTimeout(() => {
                logger.warn('Heartbeat ping timed out after 10s');
                this.handlePingTimeout();
            }, 10000);

            // Use a reliable API call to check connection
            // Attempt to get user profile - this is a light operation that will succeed if the connection is active
            // We don't actually need the user profile info, just whether the call succeeds
            try {
                // Try getting a simple API response from the server
                await this.sock.profilePictureUrl(this.sock.user.id);
                const latency = Date.now() - pingStart;
                this.handlePingResponse(latency);
            } catch (apiError) {
                // Fallback to a more reliable but simpler test
                if (this.sock.user && this.sock.user.id) {
                    // Connection is still valid if we have user info
                    const latency = Date.now() - pingStart;
                    this.handlePingResponse(latency);
                } else {
                    // Can't determine user ID, connection may be broken
                    throw new Error("Cannot verify connection state: user ID unavailable");
                }
            }
        } catch (error) {
            logger.warn('Error sending heartbeat:', error.message);
            this.handlePingError(error);
        }
    }

    /**
     * Handle ping response (successful heartbeat)
     * @param {number} latency Ping latency in milliseconds
     */
    handlePingResponse(latency) {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }

        this.pingLatency = latency;
        this.lastHeartbeatAck = Date.now();
        this.consecutiveFailedPings = 0;

        // Update connection health
        let healthChange = 0;

        // Adjust health based on latency
        if (latency < 300) {
            healthChange = +5; // Fast connection
        } else if (latency < 1000) {
            healthChange = +2; // Average connection
        } else if (latency > 5000) {
            healthChange = -5; // Slow connection
        }

        this.updateConnectionHealth(healthChange);

        logger.debug(`Heartbeat acknowledged (latency: ${latency}ms)`);
        this.logConnectionStatus(`Heartbeat OK, latency: ${latency}ms`);
    }

    /**
     * Handle ping timeout (failed heartbeat)
     */
    handlePingTimeout() {
        this.pingTimeout = null;
        this.consecutiveFailedPings++;

        // Update health metrics
        this.socketErrors++;
        this.updateConnectionHealth(-15); // Ping timeout is a bad sign

        logger.warn(`Heartbeat ping timed out (failure #${this.consecutiveFailedPings})`);
        this.logConnectionStatus(`Heartbeat timed out (failure #${this.consecutiveFailedPings})`);

        // Immediately take action on first ping timeout in Heroku
        if (this.consecutiveFailedPings >= 1) {
            logger.warn('Heartbeat failure detected on Heroku, checking connection state...');

            // Force connection check with higher urgency on Heroku
            if (process.env.PLATFORM === 'heroku') {
                logger.info('Running on Heroku - applying more aggressive recovery');
                setTimeout(() => this.checkConnectionHealth(true), 1000);
            } else {
                this.checkConnectionHealth(true);
            }
        }
    }

    /**
     * Handle ping error
     * @param {Error} error Error object
     */
    handlePingError(error) {
        this.consecutiveFailedPings++;
        this.socketErrors++;

        // Update health metrics
        this.updateConnectionHealth(-10);

        logger.warn(`Heartbeat error (failure #${this.consecutiveFailedPings}): ${error.message}`);
        this.logConnectionStatus(`Heartbeat error: ${error.message}`);

        // If we have multiple failures, check connection state
        if (this.consecutiveFailedPings >= 2) {
            this.checkConnectionHealth(true);
        }
    }

    /**
     * Check overall connection health and take action if needed
     * @param {boolean} forced Whether this is a forced check
     */
    async checkConnectionHealth(forced = false) {
        const now = Date.now();
        const inactivityTime = now - this.lastActivityTimestamp;
        const messageInactivityTime = now - this.lastMessageTimestamp;

        // Log current status
        const statusMsg = `Connection health: ${this.connectionHealth}%, ` +
            `Last activity: ${Math.round(inactivityTime / 1000)}s ago, ` +
            `Last message: ${Math.round(messageInactivityTime / 60000)}min ago`;

        logger.debug(statusMsg);
        this.logConnectionStatus(statusMsg);

        // Check if we need to take action
        const needsAction = forced || 
            this.connectionHealth < 50 || // Health below threshold
            inactivityTime > 300000 || // No activity for 5+ minutes
            (this.isConnected && this.consecutiveFailedPings >= 3); // Multiple ping failures

        if (needsAction) {
            logger.warn('Connection health check indicates potential issues, validating connection...');

            // Attempt to validate the connection with a more thorough check
            const isValid = await this.validateConnection();

            if (!isValid && this.isConnected) {
                logger.warn('Connection validation failed, initiating recovery...');
                this.initiateConnectionRecovery();
            } else if (!isValid && !this.isConnected) {
                logger.warn('Connection is already marked as disconnected, attempting reconnect...');
                this.initiateConnectionRecovery();
            } else {
                logger.info('Connection validated successfully despite health metrics');
                this.updateConnectionHealth(+20); // Restore some health on successful validation
            }
        }
    }

    /**
     * Validate the connection with a definitive check
     * @returns {Promise<boolean>} Whether the connection is valid
     */
    async validateConnection() {
        if (!this.sock) {
            return false;
        }

        try {
            // Try multiple validation methods
            let connectionValid = false;

            // Method 1: Check if we have a valid user ID
            if (this.sock.user && this.sock.user.id) {
                logger.debug('User ID present, connection appears valid');
                connectionValid = true;
            }

            // Method 2: Try to get own profile picture (light API call)
            try {
                await this.sock.profilePictureUrl(this.sock.user.id);
                logger.debug('Successfully fetched profile picture, connection is valid');
                connectionValid = true;
            } catch (profileError) {
                logger.debug(`Failed to fetch profile picture: ${profileError.message}`);
            }

            // Method 3: Try to get connection state from WA state
            try {
                const connected = this.sock.ws && this.sock.ws.readyState === 1;
                if (connected) {
                    logger.debug('WebSocket connection is in OPEN state');
                    connectionValid = true;
                }
            } catch (wsError) {
                logger.debug(`WebSocket check failed: ${wsError.message}`);
            }

            if (connectionValid) {
                logger.info('Connection validation successful');
                return true;
            } else {
                logger.warn('Connection validation failed: No validation methods succeeded');
                return false;
            }
        } catch (error) {
            logger.warn(`Connection validation failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Initiate connection recovery procedure
     */
    async initiateConnectionRecovery() {
        logger.warn('Initiating connection recovery procedure...');
        this.logConnectionStatus('Initiating recovery');

        // Check if we're still in a valid state for reconnection
        const wasConnected = this.isConnected;
        this.isConnected = false;

        try {
            // Attempt to gracefully close connection if it exists
            if (this.sock) {
                try {
                    logger.info('Gracefully closing existing connection...');
                    this.sock.end();
                } catch (error) {
                    logger.warn(`Error closing connection: ${error.message}`);
                }
                this.sock = null;
            }

            // Wait a moment before reconnecting
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Make a reconnection attempt
            logger.info('Attempting to reestablish connection...');
            const result = await this.connect();

            if (result) {
                this.reconnectSuccess++;
                logger.success('Connection recovery successful');
                this.logConnectionStatus('Recovery successful');
                this.updateConnectionHealth(+30); // Significant health improvement
            } else {
                this.reconnectFailure++;
                logger.error('Connection recovery failed');
                this.logConnectionStatus('Recovery failed');

                // If we've tried too many times, reset the connection state completely
                if (this.reconnectFailure >= 3) {
                    logger.warn('Multiple recovery failures, will attempt advanced recovery');
                    this.attemptAdvancedRecovery();
                }
            }
        } catch (error) {
            this.reconnectFailure++;
            logger.error(`Error during connection recovery: ${error.message}`);
            this.logConnectionStatus(`Recovery error: ${error.message}`);
        }
    }

    /**
     * Attempt advanced recovery in case of persistent connection issues
     * This is a more aggressive recovery approach that recreates auth state
     */
    async attemptAdvancedRecovery() {
        logger.warn('Attempting advanced connection recovery...');
        this.logConnectionStatus('Attempting advanced recovery');

        try {
            // First create a backup (force in advanced recovery)
            await this.backupSession(true, 'advanced_recovery');

            // Reset the reconnect counter
            this.reconnectCount = 0;

            // Delay before reconnection
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Try connecting again
            const result = await this.connect();

            if (result) {
                logger.success('Advanced recovery successful');
                this.logConnectionStatus('Advanced recovery successful');
                this.updateConnectionHealth(+50); // Major health improvement
            } else {
                logger.error('Advanced recovery failed');
                this.logConnectionStatus('Advanced recovery failed');
            }
        } catch (error) {
            logger.error(`Error during advanced recovery: ${error.message}`);
            this.logConnectionStatus(`Advanced recovery error: ${error.message}`);
        }
    }

    /**
     * Update connection health score
     * @param {number} change Change to apply to health score
     */
    updateConnectionHealth(change) {
        this.connectionHealth = Math.max(0, Math.min(100, this.connectionHealth + change));
    }

    /**
     * Log connection status for monitoring
     * @param {string} message Status message
     */
    logConnectionStatus(message) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `${timestamp} [${this.instanceId}] ${message}\n`;

            fs.appendFileSync(this.monitoringLog, logEntry);
        } catch (error) {
            logger.warn(`Could not write to connection monitoring log: ${error.message}`);
        }
    }
}

// Create singleton instance
const connectionManager = new ConnectionManager();

module.exports = {
    ConnectionManager,
    connectionManager
};