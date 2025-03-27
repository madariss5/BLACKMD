/**
 * Enhanced Leveling System - Tracks user activity and manages level progression
 * Features multilingual support, optimized buffer handling, and modern design
 * Based on popular WhatsApp MD bots' best features
 */
const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const userDatabase = require('./userDatabase');
const logger = require('./logger');
const { isFeatureEnabled } = require('./groupSettings');
const { languageManager } = require('./language');
const config = require('../config/config');

// Try to register custom fonts if available
try {
    const fontPath = path.join(process.cwd(), 'assets', 'fonts');
    registerFont(path.join(fontPath, 'Poppins-Bold.ttf'), { family: 'Poppins', weight: 'bold' });
    registerFont(path.join(fontPath, 'Poppins-Medium.ttf'), { family: 'Poppins', weight: 'medium' });
    registerFont(path.join(fontPath, 'Poppins-Regular.ttf'), { family: 'Poppins' });
    logger.info('Custom fonts registered for level cards');
} catch (err) {
    logger.debug('Using default fonts for level cards:', err.message);
}

// Enhanced XP gain settings with more interaction types and better balanced rewards
const XP_SETTINGS = {
    message: { min: 15, max: 30 },
    command: { min: 20, max: 35 },
    media: { min: 25, max: 45 },
    voice: { min: 30, max: 60 },
    daily: { min: 150, max: 250 },
    reaction: { min: 5, max: 15 },
    groupChat: { min: 18, max: 35 },
    privateChat: { min: 12, max: 25 },
    sticker: { min: 10, max: 22 },
    game: { min: 40, max: 80 },
    quiz: { min: 60, max: 120 },
    poll: { min: 30, max: 50 },
    video: { min: 25, max: 50 },
    story: { min: 20, max: 40 },
    link: { min: 10, max: 30 },
    forwardedMessage: { min: 5, max: 10 }
};

// Enhanced rank titles with more tiers and interesting names
const RANK_TITLES = {
    '1-4': 'Novice',
    '5-9': 'Apprentice',
    '10-14': 'Adept',
    '15-19': 'Expert',
    '20-24': 'Specialist',
    '25-29': 'Veteran',
    '30-34': 'Elite',
    '35-39': 'Master',
    '40-44': 'Grandmaster',
    '45-49': 'Champion',
    '50-59': 'Legendary',
    '60-69': 'Mythical',
    '70-79': 'Heroic',
    '80-89': 'Divine',
    '90-99': 'Celestial',
    '100-119': 'Immortal',
    '120-149': 'Ascendant',
    '150-199': 'Transcendent',
    '200-249': 'Godlike',
    '250+': 'Omnipotent'
};

// Enhanced level milestone rewards with more tiers and better rewards
const LEVEL_MILESTONES = {
    5: { coins: 500, title: 'Consistent', description: 'Reached level 5', bonusXP: 100 },
    10: { coins: 1000, title: 'Dedicated', description: 'Reached level 10', bonusXP: 250 },
    15: { coins: 1500, title: 'Committed', description: 'Reached level 15', bonusXP: 400 },
    20: { coins: 2500, title: 'Expert', description: 'Reached level 20', bonusXP: 650 },
    25: { coins: 3000, title: 'Specialist', description: 'Reached level 25', bonusXP: 800 },
    30: { coins: 5000, title: 'Master', description: 'Reached level 30', bonusXP: 1000 },
    40: { coins: 7500, title: 'Grandmaster', description: 'Reached level 40', bonusXP: 1500 },
    50: { coins: 10000, title: 'Legend', description: 'Reached level 50', bonusXP: 2000 },
    75: { coins: 25000, title: 'Mythic', description: 'Reached level 75', bonusXP: 3500 },
    100: { coins: 50000, title: 'Immortal', description: 'Reached level 100', bonusXP: 5000 },
    150: { coins: 100000, title: 'Transcendent', description: 'Reached level 150', bonusXP: 10000 },
    200: { coins: 200000, title: 'Godlike', description: 'Reached level 200', bonusXP: 20000 }
};

// Anti-farming system with smart cooldowns
const xpCooldowns = new Map();
const groupXpCooldowns = new Map(); // Separate cooldown for group messages
const COOLDOWN_MS = 45 * 1000; // 45 second cooldown between XP gains (reduced from 60s)
const GROUP_COOLDOWN_MS = 25 * 1000; // 25 seconds cooldown for group XP (reduced from 30s)

// Improved formula settings for level calculation
const BASE_XP = 100;
const XP_MULTIPLIER = 1.4; // Slightly reduced to balance with increased XP gains

// Enhanced daily streak bonuses with incremental benefits
const STREAK_BONUSES = {
    3: { xpMultiplier: 1.2, coins: 100 },
    7: { xpMultiplier: 1.5, coins: 250 },
    14: { xpMultiplier: 1.8, coins: 500 },
    21: { xpMultiplier: 2.0, coins: 750 },
    30: { xpMultiplier: 2.2, coins: 1000 },
    45: { xpMultiplier: 2.5, coins: 1500 },
    60: { xpMultiplier: 2.8, coins: 2000 },
    90: { xpMultiplier: 3.0, coins: 3000 },
    120: { xpMultiplier: 3.2, coins: 4000 },
    180: { xpMultiplier: 3.5, coins: 6000 },
    365: { xpMultiplier: 4.0, coins: 10000 }
};

// Performance optimization cache settings
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes (increased from 5 minutes)

// LRU Cache implementation for level cards
class LRUCache {
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.keys = [];
    }

    has(key) {
        return this.cache.has(key);
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        
        // Move this key to the end of keys (most recently used)
        this.keys = this.keys.filter(k => k !== key);
        this.keys.push(key);
        
        return this.cache.get(key);
    }

    set(key, value) {
        // Add or update the value
        this.cache.set(key, value);
        
        // Remove key from keys array if it exists
        this.keys = this.keys.filter(k => k !== key);
        
        // Add key to the end (most recently used)
        this.keys.push(key);
        
        // Prune cache if it exceeds max size
        if (this.keys.length > this.maxSize) {
            const oldestKey = this.keys.shift();
            this.cache.delete(oldestKey);
            logger.debug(`Cache pruned, removed oldest key: ${oldestKey}`);
        }
    }

    delete(key) {
        this.cache.delete(key);
        this.keys = this.keys.filter(k => k !== key);
    }

    clear() {
        this.cache.clear();
        this.keys = [];
    }

    get size() {
        return this.cache.size;
    }
}

// Initialize LRU cache for level card buffers
const cardBufferCache = new LRUCache(20);

/**
 * Initialize a user's XP data
 * @param {string} userId User's unique identifier
 */
function initializeUser(userId) {
    const profile = userDatabase.getUserProfile(userId);
    
    if (!profile) {
        return userDatabase.initializeUserProfile(userId, { xp: 0, level: 1 });
    }
    
    if (profile.xp === undefined) {
        profile.xp = 0;
    }
    
    if (profile.level === undefined) {
        profile.level = calculateLevel(profile.xp);
    }
    
    return profile;
}

/**
 * Get user's level data
 * @param {string} userId User's unique identifier
 * @returns {Object} User's level data
 */
function getUserLevelData(userId) {
    const profile = userDatabase.getUserProfile(userId);
    
    if (!profile) {
        return initializeUser(userId);
    }
    
    return profile;
}

/**
 * Calculate user's level based on XP using a more sophisticated progression curve
 * @param {number} xp Total XP
 * @returns {number} Current level
 */
function calculateLevel(xp) {
    // Base case for new users
    if (xp < BASE_XP) return 1;
    
    // Enhanced level calculation with smoother progression
    // Uses a combination of tiered thresholds for early levels (more intuitive for users)
    // and a formula-based approach for higher levels (better scaling)
    
    // Early levels with fixed thresholds for simplicity and quick progression
    if (xp < 100) return 1;
    if (xp < 250) return 2;
    if (xp < 500) return 3;
    if (xp < 1000) return 4;
    if (xp < 2000) return 5;
    if (xp < 3500) return 6;
    if (xp < 5500) return 7;
    if (xp < 8000) return 8;
    if (xp < 11000) return 9;
    if (xp < 14500) return 10;
    if (xp < 18500) return 11;
    if (xp < 23000) return 12;
    if (xp < 28000) return 13;
    if (xp < 33500) return 14;
    if (xp < 39500) return 15;
    
    // For higher levels (16+), use a formula with diminishing returns
    // This creates a more balanced progression curve
    // The formula is designed to make each level progressively harder
    // but still achievable with consistent activity
    
    // Formula explanation:
    // We solve the formula: xp = BASE_XP * (level^2 - level) * XP_MULTIPLIER
    // for level, which gives us: level = (1 + sqrt(1 + 4*xp/(BASE_XP*XP_MULTIPLIER)))/2
    
    const formulaValue = (1 + Math.sqrt(1 + 4 * xp / (BASE_XP * XP_MULTIPLIER))) / 2;
    return Math.floor(formulaValue);
}

/**
 * Calculate XP required for a given level using a dynamic scaling formula
 * @param {number} level The level
 * @returns {number} XP required
 */
function calculateRequiredXP(level) {
    if (level <= 1) return BASE_XP;
    
    // Enhanced XP requirements with smoother scaling
    // This matches the thresholds used in calculateLevel for consistency
    
    // Early levels use fixed values for clear goals
    switch(level) {
        case 2: return 100;
        case 3: return 250;
        case 4: return 500;
        case 5: return 1000;
        case 6: return 2000;
        case 7: return 3500;
        case 8: return 5500;
        case 9: return 8000;
        case 10: return 11000;
        case 11: return 14500;
        case 12: return 18500;
        case 13: return 23000;
        case 14: return 28000;
        case 15: return 33500;
        case 16: return 39500;
    }
    
    // For higher levels (17+), use a quadratic formula
    // This creates a curve where levels get progressively harder
    // The formula: BASE_XP * (level^2 - level) * XP_MULTIPLIER
    
    return Math.floor(BASE_XP * (Math.pow(level, 2) - level) * XP_MULTIPLIER);
}

/**
 * Add XP to a user for an activity
 * @param {string} userId User's unique identifier 
 * @param {string} activityType Type of activity (message, command, media, voice, daily)
 * @param {string} groupJid Group JID (if in a group context)
 * @returns {Promise<Object|null>} Level up data if user leveled up, null otherwise
 */
async function addXP(userId, activityType = 'message', groupJid = null) {
    // If this is a group message, check if leveling is enabled for this group
    if (groupJid) {
        const levelingEnabled = await isFeatureEnabled(groupJid, 'leveling');
        if (!levelingEnabled) {
            logger.debug(`Leveling is disabled for group ${groupJid}, not adding XP`);
            return null;
        }
        
        // Use group-specific cooldown for group chats
        if (activityType === 'groupChat' || activityType === 'message') {
            const lastGroupUpdate = groupXpCooldowns.get(userId + groupJid);
            const now = Date.now();
            
            if (lastGroupUpdate && (now - lastGroupUpdate) < GROUP_COOLDOWN_MS) {
                return null;
            }
            
            // Set group cooldown
            groupXpCooldowns.set(userId + groupJid, now);
        }
    }
    
    // Check if on cooldown (except for special activity types)
    const noCooldownTypes = ['daily', 'command', 'game', 'quiz'];
    if (!noCooldownTypes.includes(activityType)) {
        const lastUpdate = xpCooldowns.get(userId);
        const now = Date.now();
        
        if (lastUpdate && (now - lastUpdate) < COOLDOWN_MS) {
            return null;
        }
        
        // Set cooldown
        xpCooldowns.set(userId, now);
    }
    
    // Get XP amount based on activity type
    const settings = XP_SETTINGS[activityType] || XP_SETTINGS.message;
    let xpAmount = Math.floor(Math.random() * (settings.max - settings.min + 1)) + settings.min;
    
    // Get user profile
    const profile = getUserLevelData(userId);
    
    // Apply streak multiplier for daily activity
    if (activityType === 'daily' && profile.dailyStreak) {
        // Find the highest applicable streak bonus
        let appliedMultiplier = 1.0;
        let streakBonus = 0;
        
        for (const days in STREAK_BONUSES) {
            if (profile.dailyStreak >= parseInt(days)) {
                appliedMultiplier = Math.max(appliedMultiplier, STREAK_BONUSES[days].xpMultiplier);
                streakBonus = Math.max(streakBonus, STREAK_BONUSES[days].coins);
            }
        }
        
        // Apply streak bonuses
        xpAmount = Math.floor(xpAmount * appliedMultiplier);
        
        // Add streak bonus coins if applicable
        if (streakBonus > 0) {
            profile.coins = (profile.coins || 0) + streakBonus;
            userDatabase.updateUserProfile(userId, { coins: profile.coins });
            logger.info(`User ${userId} received ${streakBonus} coins for ${profile.dailyStreak} day streak!`);
        }
    }
    
    // Apply level-specific multipliers
    if (profile.level >= 10) {
        // Small XP bonus for higher-level users (1% per level above 10)
        const levelBonus = 1 + ((profile.level - 10) * 0.01);
        xpAmount = Math.floor(xpAmount * levelBonus);
    }
    
    // Track activity for stats
    profile.activityStats = profile.activityStats || {};
    profile.activityStats[activityType] = (profile.activityStats[activityType] || 0) + 1;
    profile.activityStats.totalXpGained = (profile.activityStats.totalXpGained || 0) + xpAmount;
    userDatabase.updateUserProfile(userId, { activityStats: profile.activityStats });
    
    // Update user profile XP
    const oldLevel = profile.level;
    profile.xp += xpAmount;
    
    // Calculate new level
    const newLevel = calculateLevel(profile.xp);
    profile.level = newLevel;
    
    // Save changes
    userDatabase.updateUserProfile(userId, { xp: profile.xp, level: newLevel });
    
    // Check for level up
    if (newLevel > oldLevel) {
        // Calculate rewards for leveling up - enhanced coin formula
        let coinReward = Math.floor(50 * Math.pow(1.2, newLevel - 1));
        
        // Check for milestone rewards
        let milestoneReward = null;
        let achievementUnlocked = null;
        
        if (LEVEL_MILESTONES[newLevel]) {
            milestoneReward = LEVEL_MILESTONES[newLevel];
            coinReward += milestoneReward.coins;
            
            // Add milestone achievement if not already present
            if (Array.isArray(profile.achievements)) {
                if (!profile.achievements.includes(milestoneReward.title)) {
                    profile.achievements.push(milestoneReward.title);
                    userDatabase.updateUserProfile(userId, { achievements: profile.achievements });
                    achievementUnlocked = milestoneReward.title;
                }
            }
        }
        
        // Update rank title based on level - ensuring consistent rank calculation
        let rankTitle = 'Novice';
        for (const range in RANK_TITLES) {
            const [min, max] = range.split('-');
            // Parse as integers and handle the "+" case for max levels
            const minLevel = parseInt(min, 10);
            const maxLevel = max === '+' ? Infinity : parseInt(max, 10);
            
            if (newLevel >= minLevel && newLevel <= maxLevel) {
                rankTitle = RANK_TITLES[range];
                break;
            }
        }
        
        // Save rank title
        profile.rankTitle = rankTitle;
        
        // Add coins to user profile
        profile.coins = (profile.coins || 0) + coinReward;
        userDatabase.updateUserProfile(userId, { 
            coins: profile.coins, 
            rankTitle: rankTitle,
            totalLevelUps: (profile.totalLevelUps || 0) + 1
        });
        
        // Clear level card cache when user levels up to force regeneration
        if (cardBufferCache && cardBufferCache.has(userId)) {
            cardBufferCache.delete(userId);
            logger.debug(`Cleared level card cache for ${userId} due to level up`);
        }
        
        logger.info(`User ${userId} leveled up to level ${newLevel} and received ${coinReward} coins!`);
        
        return {
            oldLevel,
            newLevel,
            coinReward,
            totalXp: profile.xp,
            requiredXp: calculateRequiredXP(newLevel + 1),
            milestone: milestoneReward,
            achievement: achievementUnlocked,
            rankTitle: rankTitle
        };
    }
    
    return null;
}

/**
 * Set user's notification preference for level up messages
 * @param {string} userId User's unique identifier
 * @param {boolean} enabled Whether to show level up notifications
 */
function setLevelUpNotification(userId, enabled = true) {
    const profile = getUserLevelData(userId);
    profile.levelUpNotification = enabled;
    userDatabase.updateUserProfile(userId, { levelUpNotification: enabled });
}

/**
 * Check if user has level up notifications enabled
 * @param {string} userId User's unique identifier
 * @returns {boolean} Whether level up notifications are enabled
 */
function hasLevelUpNotificationEnabled(userId) {
    const profile = getUserLevelData(userId);
    // Default to true if not set
    return profile.levelUpNotification !== false;
}

/**
 * Get progress to next level with enhanced error handling
 * @param {string} userId User's unique identifier
 * @returns {Object} Progress data
 */
function getLevelProgress(userId) {
    try {
        // Get user profile with defensive error handling
        let profile = null;
        try {
            profile = getUserLevelData(userId);
        } catch (profileError) {
            logger.error(`Error getting user level data for ${userId}:`, profileError);
            // Use fallback default profile
            profile = { xp: 0, level: 1 };
        }
        
        // Validate profile to prevent NaN in calculations
        const currentLevel = typeof profile.level === 'number' ? profile.level : 1;
        const userXP = typeof profile.xp === 'number' ? profile.xp : 0;
        const nextLevel = currentLevel + 1;
        
        let currentLevelXP = 0;
        let nextLevelXP = 100;
        
        try {
            currentLevelXP = calculateRequiredXP(currentLevel);
            nextLevelXP = calculateRequiredXP(nextLevel);
        } catch (xpError) {
            logger.error(`Error calculating XP requirements for user ${userId}:`, xpError);
            // Continue with default values
        }
        
        // Handle edge cases to prevent NaN or Infinity
        const xpForCurrentLevel = Math.max(0, userXP - currentLevelXP);
        const xpRequiredForNextLevel = Math.max(1, nextLevelXP - currentLevelXP); // Prevent division by zero
        
        const progressPercent = Math.min(100, Math.floor((xpForCurrentLevel / xpRequiredForNextLevel) * 100));
        let progressBar = '░░░░░░░░░░░░░░░░░░░░ 0%';
        try {
            progressBar = createProgressBar(progressPercent);
        } catch (barError) {
            logger.error(`Error creating progress bar for user ${userId}:`, barError);
            // Continue with default progress bar
        }
        
        return {
            currentLevel,
            nextLevel,
            currentXP: userXP,
            requiredXP: nextLevelXP,
            neededXP: nextLevelXP - userXP,
            progressPercent,
            progressBar
        };
    } catch (error) {
        logger.error(`Critical error in getLevelProgress for user ${userId}:`, error);
        // Return default data that won't break profile display
        return {
            currentLevel: 1,
            nextLevel: 2,
            currentXP: 0,
            requiredXP: 100,
            neededXP: 100,
            progressPercent: 0,
            progressBar: '░░░░░░░░░░░░░░░░░░░░ 0%'
        };
    }
}

/**
 * Get leaderboard data sorted by XP with robust error handling
 * @param {number} limit Maximum number of users to return
 * @returns {Array} Sorted array of user data
 */
function getLeaderboard(limit = 10) {
    try {
        // Safely access userProfiles with error handling
        if (!userDatabase.userProfiles || typeof userDatabase.userProfiles.entries !== 'function') {
            logger.error('userProfiles is not a valid Map in getLeaderboard');
            return []; // Return empty array to prevent crashes
        }
        
        // Use a safer approach with error handling for individual entries
        const users = [];
        try {
            for (const [id, profile] of userDatabase.userProfiles.entries()) {
                if (!id) continue; // Skip entries with invalid IDs
                
                try {
                    // Validate profile data
                    const validProfile = {
                        id,
                        name: (profile && typeof profile.name === 'string') ? profile.name : 'User',
                        xp: (profile && typeof profile.xp === 'number') ? profile.xp : 0,
                        level: (profile && typeof profile.level === 'number') ? profile.level : 1
                    };
                    users.push(validProfile);
                } catch (profileError) {
                    logger.error(`Error processing profile for leaderboard (${id}):`, profileError);
                    // Add a safe default entry to maintain user's presence in leaderboard
                    users.push({ id, name: 'User', xp: 0, level: 1 });
                }
            }
        } catch (iterationError) {
            logger.error('Error iterating over userProfiles in getLeaderboard:', iterationError);
            return []; // Fall back to empty array if iteration fails
        }
        
        // Safe sorting with error handling
        try {
            return users
                .sort((a, b) => (b.xp || 0) - (a.xp || 0)) // Ensure values are numbers
                .slice(0, Math.max(1, Math.min(limit || 10, 1000))); // Ensure sensible limit bounds
        } catch (sortError) {
            logger.error('Error sorting leaderboard data:', sortError);
            return users.slice(0, Math.min(limit || 10, 1000)); // Return unsorted if sorting fails
        }
    } catch (error) {
        logger.error('Critical error in getLeaderboard:', error);
        return []; // Return empty array on critical failure
    }
}

/**
 * Create a progress bar string
 * @param {number} progress Progress percentage (0-100)
 * @param {number} length Length of progress bar
 * @returns {string} Progress bar string
 */
function createProgressBar(progress, length = 20) {
    const filledLength = Math.floor(length * (progress / 100));
    const emptyLength = length - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    return `${filled}${empty} ${progress}%`;
}

/**
 * Generate a level card image with enhanced error handling
 * @param {string} userId User ID
 * @param {Object} userData User data including name
 * @returns {Promise<string>} Path to generated image
 */
async function generateLevelCard(userId, userData) {
    try {
        // Get user data with error handling
        let profile = null;
        try {
            profile = getUserLevelData(userId);
        } catch (profileError) {
            logger.error(`Error getting user level data for level card generation (${userId}):`, profileError);
            // Use userData as fallback if available, otherwise create minimal profile
            profile = {
                level: userData?.level || 1,
                xp: userData?.xp || 0
            };
        }
        
        // Get level progress with error handling
        let progress = null;
        try {
            progress = getLevelProgress(userId);
        } catch (progressError) {
            logger.error(`Error getting level progress for level card generation (${userId}):`, progressError);
            // Create fallback progress data with consistent requiredXP
            const nextLevel = (profile.level || 1) + 1;
            const requiredXP = calculateRequiredXP(nextLevel);
            progress = {
                currentLevel: profile.level || 1,
                requiredXP: requiredXP,
                progressPercent: 0
            };
        }
        
        // Ensure temp directory exists
        try {
            const tempDir = path.join(process.cwd(), 'temp', 'user');
            await fs.mkdir(tempDir, { recursive: true });
            
            // Get rank information with error handling
            let rankInfo = { rank: 0, total: 0 };
            try {
                const leaderboard = getLeaderboard(1000);
                rankInfo.rank = leaderboard.findIndex(u => u.id === userId) + 1;
                rankInfo.total = leaderboard.length;
            } catch (rankError) {
                logger.error(`Error getting rank for level card (${userId}):`, rankError);
                // Continue with default rank info
            }
            
            // Get rank title from level
            let rankTitle = 'Novice';
            try {
                for (const range in RANK_TITLES) {
                    const [min, max] = range.split('-');
                    const minLevel = parseInt(min, 10);
                    const maxLevel = max === '+' ? Infinity : parseInt(max, 10);
                    
                    if (profile.level >= minLevel && profile.level <= maxLevel) {
                        rankTitle = RANK_TITLES[range];
                        break;
                    }
                }
            } catch (rankTitleError) {
                logger.error(`Error determining rank title (${userId}):`, rankTitleError);
                // Continue with default rank title
            }
            
            // Get current language
            const currentLang = config.bot.language || 'en';
            
            // Create canvas with modern dimensions
            const canvas = createCanvas(1000, 380);
            const ctx = canvas.getContext('2d');
            
            // Try to use our custom fonts
            const mainFont = 'Poppins';
            const fallbackFont = 'Arial, Helvetica, sans-serif';
            
            // Set up gradients and colors
            const primaryColor = '#5865f2'; // Discord blurple - can be customized later
            const secondaryColor = '#3b3f8c'; // Darker shade for depth
            const backgroundColor = '#2b2d31'; // Discord dark theme
            const textColor = '#ffffff';
            const subtextColor = '#a3a6aa';
            const darkAccentColor = '#1e1f22';
            
            // Modern card with rounded corners
            ctx.fillStyle = backgroundColor;
            ctx.beginPath();
            ctx.roundRect(0, 0, canvas.width, canvas.height, 20);
            ctx.fill();
            
            // Accent border with gradient (top of card)
            const borderGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            borderGradient.addColorStop(0, primaryColor);
            borderGradient.addColorStop(0.5, '#7b84fb'); // Lighter color in middle
            borderGradient.addColorStop(1, secondaryColor);
            
            ctx.fillStyle = borderGradient;
            ctx.fillRect(0, 0, canvas.width, 8);
            
            // Draw user info section background for contrast
            ctx.fillStyle = darkAccentColor;
            ctx.beginPath();
            ctx.roundRect(40, 40, canvas.width - 80, 120, 10);
            ctx.fill();
            
            // User name with attractive styling
            try {
                // Use custom font with fallback
                ctx.font = `bold 40px "${mainFont}", ${fallbackFont}`;
                ctx.fillStyle = textColor;
                const name = userData?.name || 'User';
                const wrappedName = wrapText(ctx, name, 500, 40);
                ctx.fillText(wrappedName, 60, 90);
            } catch (nameError) {
                logger.error(`Error rendering name for level card (${userId}):`, nameError);
                // Fallback to simple text with system font
                ctx.font = 'bold 40px sans-serif';
                ctx.fillText('User', 60, 90);
            }
            
            // Rank title with styling
            try {
                ctx.font = `24px "${mainFont}", ${fallbackFont}`;
                ctx.fillStyle = subtextColor;
                ctx.fillText(rankTitle, 60, 130);
            } catch (titleError) {
                logger.error(`Error rendering rank title (${userId}):`, titleError);
            }
            
            // Draw level badge - circular with number
            try {
                // Circle background for level
                const levelX = canvas.width - 120;
                const levelY = 100;
                const levelRadius = 50;
                
                // Glowing circle effect
                ctx.beginPath();
                ctx.arc(levelX, levelY, levelRadius + 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(88, 101, 242, 0.3)'; // Glowing effect
                ctx.fill();
                
                // Main circle
                ctx.beginPath();
                ctx.arc(levelX, levelY, levelRadius, 0, Math.PI * 2);
                ctx.fillStyle = primaryColor;
                ctx.fill();
                
                // Level number
                ctx.font = `bold 40px "${mainFont}", ${fallbackFont}`;
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(profile.level.toString(), levelX, levelY);
                
                // Reset text alignment
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
            } catch (levelBadgeError) {
                logger.error(`Error rendering level badge (${userId}):`, levelBadgeError);
            }
            
            // XP information section with translation
            try {
                const statsY = 200;
                ctx.font = `bold 28px "${mainFont}", ${fallbackFont}`;
                ctx.fillStyle = textColor;
                
                // Get translated labels
                const xpLabel = languageManager.getText('user.xp', currentLang) || 'XP';
                const rankLabel = languageManager.getText('user.rank', currentLang) || 'Rank';
                
                // Format XP with thousands separator
                const currentXP = profile.xp.toLocaleString();
                const requiredXP = progress.requiredXP.toLocaleString();
                
                // XP stats with colored numbers
                ctx.fillText(`${xpLabel}:`, 60, statsY);
                ctx.fillStyle = subtextColor;
                ctx.fillText(`${currentXP} / ${requiredXP}`, 60, statsY + 40);
                
                // Rank stats if available
                if (rankInfo.rank > 0) {
                    ctx.fillStyle = textColor;
                    ctx.fillText(`${rankLabel}:`, canvas.width - 300, statsY);
                    ctx.fillStyle = subtextColor;
                    ctx.fillText(`#${rankInfo.rank} / ${rankInfo.total}`, canvas.width - 300, statsY + 40);
                }
            } catch (xpError) {
                logger.error(`Error rendering XP stats (${userId}):`, xpError);
                // Fallback to simple English text
                ctx.fillText(`XP: ${profile.xp} / ${progress.requiredXP}`, 60, 200);
            }
            
            // Enhanced progress bar with custom styling
            try {
                const barY = 290;
                const barHeight = 30;
                const barWidth = canvas.width - 120;
                const barRadius = barHeight / 2;
                
                // Progress bar background with rounded corners
                ctx.fillStyle = darkAccentColor;
                ctx.beginPath();
                ctx.roundRect(60, barY, barWidth, barHeight, barRadius);
                ctx.fill();
                
                // Calculate progress
                const progressWidth = Math.max(barRadius * 2, (progress.progressPercent / 100) * barWidth);
                
                // Progress fill with gradient
                const progressGradient = ctx.createLinearGradient(60, 0, 60 + barWidth, 0);
                progressGradient.addColorStop(0, primaryColor);
                progressGradient.addColorStop(1, '#9b84fb'); // Purple tint at end
                
                ctx.fillStyle = progressGradient;
                ctx.beginPath();
                ctx.roundRect(60, barY, progressWidth, barHeight, barRadius);
                ctx.fill();
                
                // Percentage text on bar
                ctx.font = `bold 18px "${mainFont}", ${fallbackFont}`;
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.fillText(`${progress.progressPercent}%`, 60 + barWidth / 2, barY + barHeight / 2 + 6);
                ctx.textAlign = 'left';
            } catch (progressBarError) {
                logger.error(`Error rendering progress bar (${userId}):`, progressBarError);
            }
            
            // Additional rewards/stats section (bottom right corner)
            try {
                if (profile.coins !== undefined || profile.dailyStreak !== undefined) {
                    const statsY = 340;
                    ctx.font = `20px "${mainFont}", ${fallbackFont}`;
                    ctx.fillStyle = subtextColor;
                    
                    let statsText = '';
                    if (profile.coins !== undefined) {
                        statsText += `💰 ${profile.coins.toLocaleString()} coins`;
                    }
                    
                    if (profile.dailyStreak !== undefined && profile.dailyStreak > 0) {
                        if (statsText) statsText += '  •  ';
                        statsText += `🔥 ${profile.dailyStreak} day streak`;
                    }
                    
                    if (statsText) {
                        ctx.textAlign = 'right';
                        ctx.fillText(statsText, canvas.width - 60, statsY);
                        ctx.textAlign = 'left';
                    }
                }
            } catch (statsError) {
                logger.error(`Error rendering additional stats (${userId}):`, statsError);
            }
            
            // Save the image with improved quality
            try {
                // Create unique output path with timestamp to prevent caching issues
                const timestamp = Date.now();
                const outputPath = path.join(tempDir, `${userId.split('@')[0]}_level_${timestamp}.png`);
                
                // Generate high-quality PNG buffer with optimized settings
                const buffer = canvas.toBuffer('image/png', {
                    compressionLevel: 6,
                    filters: canvas.PNG_FILTER_NONE,
                    resolution: 96
                });
                
                // Save buffer to file
                await fs.writeFile(outputPath, buffer);
                
                // Store in cache for faster future access
                cardBufferCache.set(userId, {
                    buffer,
                    path: outputPath,
                    timestamp: timestamp,
                    expiry: timestamp + CACHE_DURATION_MS
                });
                
                logger.debug(`Generated modern level card for ${userId} (cache size: ${cardBufferCache.size})`);
                
                return outputPath;
            } catch (saveError) {
                logger.error(`Error saving level card image for ${userId}:`, saveError);
                return null;
            }
        } catch (dirError) {
            logger.error(`Error creating temp directory for level card (${userId}):`, dirError);
            return null;
        }
    } catch (error) {
        logger.error(`Critical error in generateLevelCard for ${userId}:`, error);
        return null;
    }
}

/**
 * Helper function to wrap text on canvas
 * @param {CanvasRenderingContext2D} ctx Canvas context
 * @param {string} text Text to wrap
 * @param {number} maxWidth Max width before wrapping
 * @param {number} fontSize Font size
 * @returns {string} Wrapped text
 */
function wrapText(ctx, text, maxWidth, fontSize) {
    // If text is short enough, return as is
    if (ctx.measureText(text).width < maxWidth) {
        return text;
    }
    
    // Otherwise, truncate with ellipsis
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    
    return truncated + '...';
}

// Initialize the module
(async () => {
    try {
        // Create temp directories if needed
        const tempDir = path.join(process.cwd(), 'temp', 'user');
        await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
        
        logger.info('Leveling system initialized');
    } catch (error) {
        logger.error('Error initializing leveling system:', error);
    }
})();

/**
 * Get the buffer for a level card image with LRU caching
 * @param {string} userId User ID
 * @param {Object} userData User data including name
 * @returns {Promise<{buffer: Buffer, path: string}|null>} Card buffer and path or null
 */
async function getLevelCardBuffer(userId, userData) {
    try {
        // Get current language for debug messages
        const currentLang = config.bot.language || 'en';
        
        // Check LRU cache first for optimal performance
        if (cardBufferCache.has(userId)) {
            const cached = cardBufferCache.get(userId);
            const now = Date.now();
            
            // Return cache if still valid
            if (cached && cached.expiry > now && cached.buffer) {
                logger.debug(`Using cached level card for ${userId} (${languageManager.getText('user.cache_hit', currentLang)})`);
                return {
                    buffer: cached.buffer,
                    path: cached.path,
                    cached: true
                };
            }
            
            // Remove expired cache entry
            cardBufferCache.delete(userId);
            logger.debug(`Cache expired for ${userId}, generating new card`);
        }
        
        // Generate new card
        const cardPath = await generateLevelCard(userId, userData);
        if (!cardPath) {
            logger.error(`Failed to generate level card for ${userId}`);
            return null;
        }
        
        // Read buffer directly with optimized error handling
        try {
            const buffer = await fs.readFile(cardPath);
            
            // Add to LRU cache for future requests
            cardBufferCache.set(userId, {
                buffer,
                path: cardPath,
                timestamp: Date.now(),
                expiry: Date.now() + CACHE_DURATION_MS
            });
            
            return { 
                buffer, 
                path: cardPath,
                cached: false
            };
        } catch (readErr) {
            logger.error(`Error reading level card buffer for ${userId}:`, readErr);
            return null;
        }
    } catch (error) {
        logger.error(`Error in getLevelCardBuffer for ${userId}:`, error);
        return null;
    }
}

/**
 * Get user rank title based on level
 * @param {number} level User level
 * @returns {string} Rank title
 */
function getRankTitle(level) {
    try {
        for (const range in RANK_TITLES) {
            const [min, max] = range.split('-');
            if ((max === '+' && level >= parseInt(min)) || 
                (level >= parseInt(min) && level <= parseInt(max))) {
                return RANK_TITLES[range];
            }
        }
        return 'Novice'; // Default rank
    } catch (error) {
        logger.error('Error getting rank title:', error);
        return 'Novice'; // Default on error
    }
}

/**
 * Calculate daily streak bonuses for a user
 * @param {string} userId User ID
 * @returns {Object} Streak bonus info
 */
function calculateStreakBonus(userId) {
    try {
        const profile = getUserLevelData(userId);
        if (!profile || !profile.dailyStreak) return { multiplier: 1.0, coins: 0 };
        
        let multiplier = 1.0;
        let coins = 0;
        
        // Find the highest applicable streak bonus
        for (const days in STREAK_BONUSES) {
            if (profile.dailyStreak >= parseInt(days)) {
                multiplier = Math.max(multiplier, STREAK_BONUSES[days].xpMultiplier);
                coins = Math.max(coins, STREAK_BONUSES[days].coins);
            }
        }
        
        return { multiplier, coins, streak: profile.dailyStreak };
    } catch (error) {
        logger.error(`Error calculating streak bonus for ${userId}:`, error);
        return { multiplier: 1.0, coins: 0, streak: 0 };
    }
}

/**
 * Get detailed stats for a user
 * @param {string} userId User ID
 * @returns {Object} Detailed user stats
 */
function getUserStats(userId) {
    try {
        const profile = getUserLevelData(userId);
        const progress = getLevelProgress(userId);
        const leaderboard = getLeaderboard(100);
        
        // Calculate rank
        const rank = leaderboard.findIndex(u => u.id === userId) + 1;
        
        // Get time statistics
        const registeredAt = profile.registeredAt ? new Date(profile.registeredAt) : new Date();
        const daysSinceRegistration = Math.floor((new Date() - registeredAt) / (1000 * 60 * 60 * 24));
        
        // Get activity stats
        const activityStats = profile.activityStats || {};
        
        // Calculate rewards earned
        const totalCoinsEarned = (activityStats.totalCoinsEarned || 0) + (profile.totalLevelUps || 0) * 50;
        
        // Get streak info
        const streakInfo = calculateStreakBonus(userId);
        
        return {
            userId,
            name: profile.name || 'User',
            level: profile.level || 1,
            xp: profile.xp || 0,
            rank: rank > 0 ? rank : 'Unranked',
            totalUsers: leaderboard.length,
            progress: progress.progressPercent,
            progressBar: progress.progressBar,
            coins: profile.coins || 0,
            rankTitle: profile.rankTitle || getRankTitle(profile.level || 1),
            achievements: profile.achievements || [],
            daysSinceRegistration,
            registeredAt: registeredAt.toISOString(),
            dailyStreak: profile.dailyStreak || 0,
            streakMultiplier: streakInfo.multiplier,
            nextStreakReward: getNextStreakReward(profile.dailyStreak || 0),
            activityStats: activityStats,
            totalMessages: activityStats.message || 0,
            totalCommands: activityStats.command || 0,
            totalXpGained: activityStats.totalXpGained || 0,
            totalCoinsEarned: totalCoinsEarned
        };
    } catch (error) {
        logger.error(`Error getting user stats for ${userId}:`, error);
        return {
            userId,
            name: 'User',
            level: 1,
            xp: 0,
            rank: 'Unranked',
            totalUsers: 0,
            progress: 0,
            progressBar: '░░░░░░░░░░░░░░░░░░░░ 0%',
            coins: 0,
            rankTitle: 'Novice',
            achievements: [],
            daysSinceRegistration: 0,
            registeredAt: new Date().toISOString(),
            dailyStreak: 0,
            streakMultiplier: 1.0,
            nextStreakReward: null,
            activityStats: {},
            totalMessages: 0,
            totalCommands: 0,
            totalXpGained: 0,
            totalCoinsEarned: 0
        };
    }
}

/**
 * Get the next available streak reward
 * @param {number} currentStreak Current daily streak
 * @returns {Object|null} Next streak reward info
 */
function getNextStreakReward(currentStreak) {
    // Sort streak days in ascending order
    const streakDays = Object.keys(STREAK_BONUSES)
        .map(days => parseInt(days))
        .sort((a, b) => a - b);
    
    // Find the next streak milestone
    for (const days of streakDays) {
        if (days > currentStreak) {
            return {
                daysNeeded: days,
                daysLeft: days - currentStreak,
                multiplier: STREAK_BONUSES[days].xpMultiplier,
                coins: STREAK_BONUSES[days].coins
            };
        }
    }
    
    // If we're past all milestones, return the highest one
    const highestStreak = streakDays[streakDays.length - 1];
    return {
        daysNeeded: highestStreak,
        alreadyMaxed: true,
        multiplier: STREAK_BONUSES[highestStreak].xpMultiplier,
        coins: STREAK_BONUSES[highestStreak].coins
    };
}

/**
 * Apply daily streak update
 * @param {string} userId User ID 
 * @returns {Object} Updated streak info
 */
function updateDailyStreak(userId) {
    try {
        const profile = getUserLevelData(userId);
        const now = new Date();
        const lastDaily = profile.lastDaily ? new Date(profile.lastDaily) : null;
        
        let streak = profile.dailyStreak || 0;
        let streakBroken = false;
        
        // If there's a previous daily claim, check if streak continues
        if (lastDaily) {
            // Get yesterday's date for comparison
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            
            // Check if last daily was claimed yesterday or today (same day multiple claims)
            if (lastDaily.toDateString() === yesterday.toDateString() || 
                lastDaily.toDateString() === now.toDateString()) {
                // Streak continues/maintained
                streak += 1;
            } else {
                // Streak broken - more than one day gap
                streak = 1;
                streakBroken = true;
            }
        } else {
            // First time claiming daily
            streak = 1;
        }
        
        // Update profile
        profile.dailyStreak = streak;
        profile.lastDaily = now.toISOString();
        userDatabase.updateUserProfile(userId, { 
            dailyStreak: streak, 
            lastDaily: profile.lastDaily 
        });
        
        return {
            streak,
            streakBroken,
            lastDaily: profile.lastDaily
        };
    } catch (error) {
        logger.error(`Error updating daily streak for ${userId}:`, error);
        return {
            streak: 1,
            streakBroken: false,
            lastDaily: new Date().toISOString()
        };
    }
}

module.exports = {
    initializeUser,
    getUserLevelData,
    calculateLevel,
    calculateRequiredXP, // Added this export
    addXP,
    setLevelUpNotification,
    hasLevelUpNotificationEnabled,
    getLevelProgress,
    getLeaderboard,
    createProgressBar,
    generateLevelCard,
    getLevelCardBuffer,
    getRankTitle,
    calculateStreakBonus,
    getUserStats,
    updateDailyStreak,
    getNextStreakReward,
    // Constants for external use
    RANK_TITLES,
    XP_SETTINGS,
    LEVEL_MILESTONES,
    STREAK_BONUSES
};