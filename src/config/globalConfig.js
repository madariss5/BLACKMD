/**
 * Global Runtime Configuration
 * This module maintains runtime configuration that can be modified during bot execution
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class GlobalConfig extends EventEmitter {
    constructor() {
        super();
        this._config = {
            prefix: process.env.BOT_PREFIX || '.',
            owner: '4915561048015',
            version: '1.0.0',
            name: process.env.BOT_NAME || '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻'
        };
    }

    get prefix() {
        return this._config.prefix;
    }

    set prefix(newPrefix) {
        if (typeof newPrefix !== 'string' || newPrefix.length === 0) {
            throw new Error('Invalid prefix');
        }
        const oldPrefix = this._config.prefix;
        this._config.prefix = newPrefix;
        this.emit('prefixChanged', { oldPrefix, newPrefix });
        logger.info(`Bot prefix changed from ${oldPrefix} to ${newPrefix}`);
    }

    get owner() {
        return this._config.owner;
    }

    get version() {
        return this._config.version;
    }

    get name() {
        return this._config.name;
    }

    toJSON() {
        return { ...this._config };
    }
}

// Export singleton instance
const globalConfig = new GlobalConfig();
module.exports = globalConfig;
