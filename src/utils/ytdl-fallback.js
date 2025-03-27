/**
 * YouTube Download Fallback Module
 * 
 * This module provides alternative implementations for youtube-dl-exec functionality
 * to ensure media commands work even when youtube-dl binary fails to install.
 * 
 * It uses ytdl-core directly for audio/video download with some additional
 * metadata extraction capabilities.
 */

const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const yts = require('yt-search');
const logger = require('./logger');

/**
 * Get a YouTube video ID from various URL formats
 * @param {string} url - YouTube URL or video ID
 * @returns {string|null} - YouTube video ID or null if invalid
 */
function getVideoId(url) {
    if (!url) return null;
    
    // Already a video ID (11 characters)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }
    
    // Extract from URL
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    
    return match ? match[1] : null;
}

/**
 * Check if a URL is a valid YouTube URL
 * @param {string} url - URL to check
 * @returns {boolean} - Whether the URL is a valid YouTube URL
 */
function isYouTubeUrl(url) {
    if (!url) return false;
    
    const patterns = [
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/,
        /^[a-zA-Z0-9_-]{11}$/  // Direct video ID
    ];
    
    return patterns.some(pattern => pattern.test(url));
}

/**
 * Get video info using ytdl-core
 * @param {string} videoIdOrUrl - YouTube video ID or URL
 * @returns {Promise<Object>} - Video information
 */
async function getVideoInfo(videoIdOrUrl) {
    try {
        const videoId = getVideoId(videoIdOrUrl);
        if (!videoId) {
            throw new Error('Invalid YouTube URL or video ID');
        }
        
        const info = await ytdl.getInfo(videoId);
        
        // Format the info similar to youtube-dl-exec response
        return {
            videoDetails: info.videoDetails,
            formats: info.formats,
            title: info.videoDetails.title,
            description: info.videoDetails.shortDescription,
            duration: parseInt(info.videoDetails.lengthSeconds),
            upload_date: new Date(info.videoDetails.publishDate).toISOString().slice(0, 10).replace(/-/g, ''),
            uploader: info.videoDetails.author.name,
            uploader_url: info.videoDetails.author.channel_url,
            view_count: parseInt(info.videoDetails.viewCount),
            like_count: parseInt(info.videoDetails.likes || 0),
            thumbnail: info.videoDetails.thumbnails.length > 0 ? 
                info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url : null,
            _filename: `${info.videoDetails.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${videoId}`,
            webpage_url: `https://www.youtube.com/watch?v=${videoId}`,
            id: videoId,
            extractor: 'youtube',
            extractor_key: 'Youtube'
        };
    } catch (error) {
        logger.error(`Error getting video info: ${error.message}`);
        throw error;
    }
}

/**
 * Download a YouTube video to a file
 * @param {string} videoIdOrUrl - YouTube video ID or URL
 * @param {Object} options - Download options
 * @param {string} options.output - Output file path template
 * @param {string} options.quality - Video quality ('highest', 'lowest', or itag)
 * @param {string} options.format - Format to download ('mp4', 'mp3', etc.)
 * @returns {Promise<string>} - Path to the downloaded file
 */
async function downloadVideo(videoIdOrUrl, options = {}) {
    try {
        const videoId = getVideoId(videoIdOrUrl);
        if (!videoId) {
            throw new Error('Invalid YouTube URL or video ID');
        }
        
        // Get video info
        const info = await ytdl.getInfo(videoId);
        const videoTitle = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Determine output file path
        let outputPath = options.output;
        if (!outputPath) {
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const extension = options.format === 'mp3' ? 'mp3' : 'mp4';
            outputPath = path.join(tempDir, `${videoTitle}-${videoId}.${extension}`);
        }
        
        // Replace template tokens in output path
        outputPath = outputPath
            .replace('%(title)s', videoTitle)
            .replace('%(id)s', videoId)
            .replace('%(ext)s', options.format === 'mp3' ? 'mp3' : 'mp4');
        
        // Ensure directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Select format based on options
        let format;
        if (options.format === 'mp3' || options.audioOnly) {
            format = ytdl.filterFormats(info.formats, 'audioonly')[0];
        } else {
            const videoFormats = ytdl.filterFormats(info.formats, 'videoandaudio');
            if (options.quality === 'highest') {
                // Sort by quality (height) and bitrate
                videoFormats.sort((a, b) => {
                    return (b.qualityLabel?.match(/\d+/) || 0) - (a.qualityLabel?.match(/\d+/) || 0) || 
                           b.bitrate - a.bitrate;
                });
                format = videoFormats[0];
            } else if (options.quality === 'lowest') {
                videoFormats.sort((a, b) => {
                    return (a.qualityLabel?.match(/\d+/) || 0) - (b.qualityLabel?.match(/\d+/) || 0) || 
                           a.bitrate - b.bitrate;
                });
                format = videoFormats[0];
            } else if (typeof options.quality === 'number') {
                // Try to find by itag
                format = info.formats.find(f => f.itag === options.quality) || videoFormats[0];
            } else {
                // Default to highest quality
                videoFormats.sort((a, b) => b.bitrate - a.bitrate);
                format = videoFormats[0];
            }
        }
        
        if (!format) {
            throw new Error('No suitable format found');
        }
        
        // Download the video
        return new Promise((resolve, reject) => {
            const stream = ytdl.downloadFromInfo(info, { format });
            stream.pipe(fs.createWriteStream(outputPath));
            
            stream.on('end', () => {
                resolve(outputPath);
            });
            
            stream.on('error', (error) => {
                reject(error);
            });
        });
    } catch (error) {
        logger.error(`Error downloading video: ${error.message}`);
        throw error;
    }
}

/**
 * Search for YouTube videos
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results
 * @returns {Promise<Array>} - Search results
 */
async function searchVideos(query, options = {}) {
    try {
        const searchResults = await yts(query);
        
        let videos = searchResults.videos
            .slice(0, options.limit || 10)
            .map(video => ({
                title: video.title,
                id: video.videoId,
                url: video.url,
                duration: video.seconds,
                timestamp: video.timestamp,
                ago: video.ago,
                views: video.views,
                author: {
                    name: video.author.name,
                    url: video.author.url
                },
                thumbnail: video.thumbnail,
                description: video.description
            }));
            
        return videos;
    } catch (error) {
        logger.error(`Error searching videos: ${error.message}`);
        throw error;
    }
}

/**
 * Get available formats for a video
 * @param {string} videoIdOrUrl - YouTube video ID or URL
 * @returns {Promise<Array>} - Available formats
 */
async function getFormats(videoIdOrUrl) {
    try {
        const info = await ytdl.getInfo(videoIdOrUrl);
        return info.formats;
    } catch (error) {
        logger.error(`Error getting formats: ${error.message}`);
        throw error;
    }
}

/**
 * Download audio only from a YouTube video
 * @param {string} videoIdOrUrl - YouTube video ID or URL
 * @param {Object} options - Download options
 * @returns {Promise<string>} - Path to the downloaded audio file
 */
async function downloadAudio(videoIdOrUrl, options = {}) {
    try {
        return await downloadVideo(videoIdOrUrl, { 
            ...options,
            audioOnly: true, 
            format: 'mp3'
        });
    } catch (error) {
        logger.error(`Error downloading audio: ${error.message}`);
        throw error;
    }
}

/**
 * Create a youtube-dl-exec compatible API wrapper
 * Uses the same method signatures for easy substitution
 */
function createYoutubeDlExecCompat() {
    // Main function to handle youtube-dl command-style options
    const execWrapper = async (url, options = {}) => {
        try {
            // Get video info first
            const videoInfo = await getVideoInfo(url);
            
            // Handle download if output is specified
            if (options.output) {
                let format = 'mp4';
                let audioOnly = false;
                
                if (options.extractAudio) {
                    format = 'mp3';
                    audioOnly = true;
                }
                
                const outputPath = await downloadVideo(url, {
                    output: options.output,
                    format,
                    audioOnly,
                    quality: options.quality || 'highest'
                });
                
                // Add the output path to video info
                return {
                    ...videoInfo,
                    _filename: outputPath
                };
            }
            
            return videoInfo;
        } catch (error) {
            logger.error(`youtube-dl-exec compat error: ${error.message}`);
            throw error;
        }
    };
    
    // Add raw method
    execWrapper.raw = async (args = [], options = {}) => {
        try {
            // Extract URL from args (typically the last non-option argument)
            const url = args.find(arg => !arg.startsWith('-'));
            if (!url) {
                throw new Error('No URL provided in args');
            }
            
            // Map common youtube-dl arguments to our options
            const mappedOptions = {};
            
            if (args.includes('-x') || args.includes('--extract-audio')) {
                mappedOptions.extractAudio = true;
            }
            
            if (args.includes('-f') || args.includes('--format')) {
                const formatIndex = args.indexOf('-f') !== -1 ? 
                    args.indexOf('-f') + 1 : args.indexOf('--format') + 1;
                if (formatIndex < args.length) {
                    mappedOptions.quality = args[formatIndex];
                }
            }
            
            const outputIndex = args.indexOf('-o') !== -1 ? 
                args.indexOf('-o') + 1 : args.indexOf('--output') + 1;
            if (outputIndex < args.length) {
                mappedOptions.output = args[outputIndex];
            }
            
            return await execWrapper(url, mappedOptions);
        } catch (error) {
            logger.error(`youtube-dl-exec raw error: ${error.message}`);
            throw error;
        }
    };
    
    return execWrapper;
}

// Export a drop-in replacement for youtube-dl-exec
module.exports = createYoutubeDlExecCompat();

// Also export individual utility functions
module.exports.getVideoInfo = getVideoInfo;
module.exports.downloadVideo = downloadVideo;
module.exports.downloadAudio = downloadAudio;
module.exports.searchVideos = searchVideos;
module.exports.getFormats = getFormats;
module.exports.isYouTubeUrl = isYouTubeUrl;
module.exports.getVideoId = getVideoId;