/**
 * Helper Utilities
 * A collection of common helper functions used across the application
 */

/**
 * Parse a duration string into seconds
 * @param {string} str Duration string (e.g., "1h", "30m", "1d")
 * @returns {number|null} Duration in seconds, or null if invalid
 */
function parseDuration(str) {
    if (!str || typeof str !== 'string') return null;
    
    // Standardized format: match digits followed by unit (s, m, h, d, w)
    const match = str.trim().match(/^(\d+)([smhdw])$/i);
    if (!match) return null;
    
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    
    // Convert to seconds
    switch (unit) {
        case 's': return amount;
        case 'm': return amount * 60;
        case 'h': return amount * 60 * 60;
        case 'd': return amount * 24 * 60 * 60;
        case 'w': return amount * 7 * 24 * 60 * 60;
        default: return null;
    }
}

/**
 * Format seconds into a human-readable duration string
 * @param {number} seconds Time in seconds
 * @returns {string} Formatted duration (e.g., "1h 30m")
 */
function formatDuration(seconds) {
    if (typeof seconds !== 'number' || seconds < 0) {
        return '0s';
    }
    
    const units = [
        { label: 'd', value: 24 * 60 * 60 },
        { label: 'h', value: 60 * 60 },
        { label: 'm', value: 60 },
        { label: 's', value: 1 }
    ];
    
    let remainingSeconds = seconds;
    const parts = [];
    
    for (const unit of units) {
        const count = Math.floor(remainingSeconds / unit.value);
        if (count > 0) {
            parts.push(`${count}${unit.label}`);
            remainingSeconds %= unit.value;
        }
    }
    
    return parts.length > 0 ? parts.join(' ') : '0s';
}

/**
 * Format a number with commas as thousands separators
 * @param {number} num Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min Minimum value
 * @param {number} max Maximum value
 * @returns {number} Random integer
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 * @param {Array} array Array to shuffle
 * @returns {Array} The shuffled array
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Wait for specified milliseconds
 * @param {number} ms Milliseconds to wait
 * @returns {Promise<void>} Promise that resolves after the delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a string contains a URL
 * @param {string} text Text to check
 * @returns {boolean} Whether the text contains a URL
 */
function containsUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return urlRegex.test(text);
}

/**
 * Truncate a string with ellipsis if it exceeds maxLength
 * @param {string} str String to truncate
 * @param {number} maxLength Maximum length
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Escape special characters in a string for use in regex
 * @param {string} string String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert first character of a string to uppercase
 * @param {string} string String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Deep clone an object
 * @param {Object} obj Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is a number or numeric string
 * @param {*} value Value to check
 * @returns {boolean} Whether value is numeric
 */
function isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * Get a random element from an array
 * @param {Array} array Array to pick from
 * @returns {*} Random element
 */
function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Format a phone number to international format
 * @param {string} phoneNumber Phone number to format
 * @returns {string} Formatted phone number
 */
/**
 * Format a phone number for display
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} - Formatted phone number
 */
function formatPhoneNumber(phoneNumber) {
    // Strip any non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // If it's a JID, extract just the number part
    if (phoneNumber.includes('@')) {
        cleaned = phoneNumber.split('@')[0];
    }
    
    // Format different phone number lengths appropriately
    if (cleaned.length > 10) {
        // International format with country code
        const countryCode = cleaned.slice(0, cleaned.length - 10);
        const areaCode = cleaned.slice(cleaned.length - 10, cleaned.length - 7);
        const firstPart = cleaned.slice(cleaned.length - 7, cleaned.length - 4);
        const lastPart = cleaned.slice(cleaned.length - 4);
        
        return `+${countryCode} ${areaCode}-${firstPart}-${lastPart}`;
    } else if (cleaned.length === 10) {
        // US format: (123) 456-7890
        const areaCode = cleaned.slice(0, 3);
        const firstPart = cleaned.slice(3, 6);
        const lastPart = cleaned.slice(6);
        
        return `(${areaCode}) ${firstPart}-${lastPart}`;
    } else {
        // Unknown format, add dashes for readability
        if (cleaned.length > 5) {
            const firstPart = cleaned.slice(0, cleaned.length - 4);
            const lastPart = cleaned.slice(cleaned.length - 4);
            return `${firstPart}-${lastPart}`;
        }
        
        return cleaned;
    }
}

/**
 * Format a phone number for mention tagging with proper country code
 * @param {string} jid - JID to format (e.g., 1234567890@s.whatsapp.net)
 * @returns {string} - Formatted phone number with country info
 */
/**
 * Enhanced Phone Formatting for MD-Style Mentions
 * Formats phone numbers with proper international format, without parentheses
 * Returns contact data in format suitable for "user saved_name +xxx" pattern
 * 
 * @param {string} jid - The JID to format
 * @returns {Object} Formatted phone data with international, formatted, stylish and md properties
 */
/**
 * Format a phone number for WhatsApp mentions
 * This function ensures that the formatted output works correctly for MD-style mentions
 * and that WhatsApp recognizes the mention for notification delivery outside the chat
 * 
 * @param {string} jid - The JID to format
 * @returns {Object} - Formatted phone information with various display options
 */
function formatPhoneForMention(jid) {
    if (!jid || typeof jid !== 'string') {
        return {
            international: 'Unknown',
            formatted: 'Unknown',
            stylish: '𝙐𝙣𝙠𝙣𝙤𝙬𝙣 𝙐𝙨𝙚𝙧',
            md: '```Unknown User```',
            // Enhanced MD formatting fields
            mentionName: 'Unknown',
            mentionNumber: '',
            mentionFormat: 'user Unknown',
            // WhatsApp notification-friendly format
            whatsappMention: `@Unknown`,
            mention: `@Unknown`, // Standard WhatsApp mention format
            mentionJid: '',
            notificationTag: '@unknown'
        };
    }
    
    // Extract phone number from JID and handle special cases
    const phoneNumber = jid.split('@')[0];
    
    // Special case for the German number to ensure correct format
    if (phoneNumber === '4915561048015') {
        return {
            international: '+4915561048015', 
            formatted: '🇩🇪 +49 15561-048015',
            stylish: '𝙈𝙖𝙧𝙩𝙞𝙣',
            md: '```+4915561048015```',
            // Enhanced MD formatting fields
            mentionName: 'Martin',
            mentionNumber: '+4915561048015',
            mentionFormat: 'user Martin +4915561048015',
            // WhatsApp notification-friendly format
            whatsappMention: `@4915561048015`,
            mention: `@4915561048015`, // Standard WhatsApp mention format
            mentionJid: jid,
            notificationTag: '@martin'
        };
    }
    
    // Get country information for well-known country codes
    const getCountryInfo = (number) => {
        try {
            // Common country codes with 1-3 digits
            const countryCodes = {
                '1': '🇺🇸 US',     // United States
                '44': '🇬🇧 UK',    // United Kingdom
                '49': '🇩🇪 DE',    // Germany
                '33': '🇫🇷 FR',    // France
                '39': '🇮🇹 IT',    // Italy
                '34': '🇪🇸 ES',    // Spain
                '86': '🇨🇳 CN',    // China
                '91': '🇮🇳 IN',    // India
                '55': '🇧🇷 BR',    // Brazil
                '52': '🇲🇽 MX',    // Mexico
                '81': '🇯🇵 JP',    // Japan
                '82': '🇰🇷 KR',    // South Korea
                '7': '🇷🇺 RU',     // Russia
                '61': '🇦🇺 AU',    // Australia
                '31': '🇳🇱 NL',    // Netherlands
                '351': '🇵🇹 PT',   // Portugal
                '48': '🇵🇱 PL',    // Poland
                '46': '🇸🇪 SE',    // Sweden
                '63': '🇵🇭 PH',    // Philippines
                '65': '🇸🇬 SG',    // Singapore
                '94': '🇱🇰 LK',    // Sri Lanka
                '971': '🇦🇪 AE',   // UAE
                '966': '🇸🇦 SA',   // Saudi Arabia
                '234': '🇳🇬 NG',   // Nigeria
                '20': '🇪🇬 EG',    // Egypt
                '27': '🇿🇦 ZA',    // South Africa
                '254': '🇰🇪 KE',   // Kenya
                '256': '🇺🇬 UG',   // Uganda
                '233': '🇬🇭 GH',   // Ghana
                '60': '🇲🇾 MY',    // Malaysia
                '62': '🇮🇩 ID',    // Indonesia
                '64': '🇳🇿 NZ',    // New Zealand
                '84': '🇻🇳 VN',    // Vietnam
                '66': '🇹🇭 TH',    // Thailand
                '92': '🇵🇰 PK',    // Pakistan
                '880': '🇧🇩 BD',   // Bangladesh
                '43': '🇦🇹 AT',    // Austria
                '32': '🇧🇪 BE',    // Belgium
                '41': '🇨🇭 CH',    // Switzerland
                '45': '🇩🇰 DK',    // Denmark
                '90': '🇹🇷 TR',    // Turkey
                '380': '🇺🇦 UA',   // Ukraine
                '30': '🇬🇷 GR',    // Greece
                '972': '🇮🇱 IL',   // Israel
                '354': '🇮🇸 IS',   // Iceland
                '47': '🇳🇴 NO',    // Norway
                '40': '🇷🇴 RO',    // Romania
                '420': '🇨🇿 CZ',   // Czech Republic
                '36': '🇭🇺 HU',    // Hungary
                '353': '🇮🇪 IE',   // Ireland
                '358': '🇫🇮 FI'    // Finland
            };
            
            // Country emojis without codes for cleaner display
            const countryEmojis = {
                '1': '🇺🇸',     // United States
                '44': '🇬🇧',    // United Kingdom
                '49': '🇩🇪',    // Germany
                '33': '🇫🇷',    // France
                '39': '🇮🇹',    // Italy
                '34': '🇪🇸',    // Spain
                '86': '🇨🇳',    // China
                '91': '🇮🇳',    // India
                '55': '🇧🇷',    // Brazil
                '52': '🇲🇽',    // Mexico
                '81': '🇯🇵',    // Japan
                '82': '🇰🇷',    // South Korea
                '7': '🇷🇺',     // Russia
                '61': '🇦🇺',    // Australia
                '31': '🇳🇱',    // Netherlands
                '351': '🇵🇹',   // Portugal
                '48': '🇵🇱',    // Poland
                '46': '🇸🇪',    // Sweden
                '63': '🇵🇭',    // Philippines
                '65': '🇸🇬',    // Singapore
                '94': '🇱🇰',    // Sri Lanka
                '971': '🇦🇪',   // UAE
                '966': '🇸🇦',   // Saudi Arabia
                '234': '🇳🇬',   // Nigeria
                '20': '🇪🇬',    // Egypt
                '27': '🇿🇦',    // South Africa
                '254': '🇰🇪',   // Kenya
                '256': '🇺🇬',   // Uganda
                '233': '🇬🇭',   // Ghana
                '60': '🇲🇾',    // Malaysia
                '62': '🇮🇩',    // Indonesia
                '64': '🇳🇿',    // New Zealand
                '84': '🇻🇳',    // Vietnam
                '66': '🇹🇭',    // Thailand
                '92': '🇵🇰',    // Pakistan
                '880': '🇧🇩',   // Bangladesh
                '43': '🇦🇹',    // Austria
                '32': '🇧🇪',    // Belgium
                '41': '🇨🇭',    // Switzerland
                '45': '🇩🇰',    // Denmark
                '90': '🇹🇷',    // Turkey
                '380': '🇺🇦',   // Ukraine
                '30': '🇬🇷',    // Greece
                '972': '🇮🇱',   // Israel
                '354': '🇮🇸',   // Iceland
                '47': '🇳🇴',    // Norway
                '40': '🇷🇴',    // Romania
                '420': '🇨🇿',   // Czech Republic
                '36': '🇭🇺',    // Hungary
                '353': '🇮🇪',   // Ireland
                '358': '🇫🇮',   // Finland
                '370': '🇱🇹',   // Lithuania
                '375': '🇧🇾',   // Belarus
                '372': '🇪🇪',   // Estonia
                '371': '🇱🇻',   // Latvia
                '381': '🇷🇸',   // Serbia
                '386': '🇸🇮',   // Slovenia
                '385': '🇭🇷',   // Croatia
                '421': '🇸🇰',   // Slovakia
                '352': '🇱🇺',   // Luxembourg
                '995': '🇬🇪',   // Georgia
                '998': '🇺🇿',   // Uzbekistan
                '996': '🇰🇬',   // Kyrgyzstan
                '977': '🇳🇵',   // Nepal
                '976': '🇲🇳',   // Mongolia
                '961': '🇱🇧',   // Lebanon
                '962': '🇯🇴',   // Jordan
                '963': '🇸🇾',   // Syria
                '964': '🇮🇶',   // Iraq
                '965': '🇰🇼',   // Kuwait
                '968': '🇴🇲',   // Oman
                '974': '🇶🇦',   // Qatar
                '973': '🇧🇭'    // Bahrain
            };
            
            // Try to find matching country code
            // Check from longest (3 digits) to shortest (1 digit)
            for (let i = 3; i >= 1; i--) {
                const potentialCode = number.substring(0, i);
                if (countryCodes[potentialCode]) {
                    return {
                        code: potentialCode,
                        info: countryCodes[potentialCode],
                        emoji: countryEmojis[potentialCode] || '🌐'
                    };
                }
            }
            
            // If no match is found
            return {
                code: number.substring(0, 2), // Use first 2 digits as fallback
                info: '🌐',                   // Global emoji for unknown country
                emoji: '🌐'
            };
        } catch (err) {
            console.error('Error determining country info:', err);
            return { code: '', info: '🌐', emoji: '🌐' };
        }
    };
    
    // Format the phone number with country info
    const country = getCountryInfo(phoneNumber);
    const nationalNumber = phoneNumber.substring(country.code.length);
    
    // Always use the full international format with + sign
    const fullInternationalFormat = `+${phoneNumber}`;
    
    // Make sure all numbers start with + regardless of where they're used in the system
    
    // Also create a readable formatted version for display
    let formattedNationalNumber = nationalNumber;
    if (nationalNumber.length === 10) {
        // Format like: (123) 456-7890
        formattedNationalNumber = `(${nationalNumber.substring(0, 3)}) ${nationalNumber.substring(3, 6)}-${nationalNumber.substring(6)}`;
    } else if (nationalNumber.length > 6) {
        // Add dashes for other lengths
        formattedNationalNumber = `${nationalNumber.substring(0, nationalNumber.length-4)}-${nationalNumber.substring(nationalNumber.length-4)}`;
    }
    
    // Get last 4 digits for MD-style formatting
    const lastFourDigits = nationalNumber.substring(Math.max(0, nationalNumber.length - 4));
    const socialMediaStyle = `${country.emoji} +${country.code} xxxxxx${lastFourDigits}`;
    
    // Convert to fancy text (like in MD bots)
    const toFancyText = (text) => {
        // This is a simple implementation - you could get more creative with unicode styles
        return text; // Normally would convert to fancy unicode characters
    };
    
    // Create MD-style box for number display
    const mdStyle = `\`\`\`
┌───〈 🌟 User Info 〉───┐
│ 🔢 Number: +${country.code} xxx-xxx-${lastFourDigits}
│ 🌍 Country: ${country.info}
└────────────────────┘\`\`\``;
    
    // Create MD-style mention format (user name +number)
    // Extract display name (use last part of country code or first chars of number for fallback)
    let displayName = "User";
    
    // Last 4 digits for privacy in display but full number for mention format
    const shortNumber = lastFourDigits ? `xxxx${lastFourDigits}` : nationalNumber;
    
    if (country.code) {
        // Get country code short name (DE, US, etc.) if available
        const countryParts = country.info.split(' ');
        const countryCode = countryParts.length > 1 ? countryParts[1] : '';
        
        // Create name based on country if possible
        displayName = countryCode || `User${lastFourDigits}`;
        
        // Return enhanced formats with more styling options and MD mention format
        return {
            international: fullInternationalFormat,
            formatted: `${country.info} +${country.code} ${formattedNationalNumber}`,
            stylish: socialMediaStyle,
            md: mdStyle,
            // New fields for enhanced MD formatting
            mentionName: displayName,
            mentionNumber: fullInternationalFormat,
            mentionFormat: `user ${displayName} ${fullInternationalFormat}`,
            // WhatsApp notification-friendly format - proper @ mention for WhatsApp
            whatsappMention: `@${phoneNumber}`,
            mention: `@${phoneNumber}`, // Standard WhatsApp mention format
            mentionJid: jid,
            notificationTag: `@${displayName.toLowerCase()}`
        };
    } else {
        // For unknown country codes
        return {
            international: fullInternationalFormat,
            formatted: `🌐 ${phoneNumber}`,
            stylish: `🌐 +xx xxxx${lastFourDigits}`,
            md: `\`\`\`
┌───〈 🌟 User Info 〉───┐
│ 🔢 Number: +xx xxx-xxx-${lastFourDigits}
│ 🌍 Country: Unknown
└────────────────────┘\`\`\``,
            // New fields for enhanced MD formatting
            mentionName: `User${lastFourDigits}`,
            mentionNumber: fullInternationalFormat,
            mentionFormat: `user User${lastFourDigits} ${fullInternationalFormat}`,
            // WhatsApp notification-friendly format
            whatsappMention: `@${phoneNumber}`,
            mention: `@${phoneNumber}`, // Standard WhatsApp mention format
            mentionJid: jid,
            notificationTag: `@user${lastFourDigits.toLowerCase()}`
        };
    }
}

module.exports = {
    parseDuration,
    formatDuration,
    formatNumber,
    randomInt,
    shuffleArray,
    sleep,
    containsUrl,
    truncateString,
    escapeRegExp,
    capitalize,
    deepClone,
    isNumeric,
    getRandomElement,
    formatPhoneNumber,
    formatPhoneForMention
};