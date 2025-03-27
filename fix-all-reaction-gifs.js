/**
 * Fix All Reaction GIFs
 * 
 * This script copies all GIFs from attached_assets or new_gifs to data/reaction_gifs
 * ensuring that each reaction command has the correct GIF file.
 * 
 * It also removes any symlinks, old files, and creates missing directories.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Define paths
const ATTACHED_ASSETS_DIR = path.join(process.cwd(), 'attached_assets');
const NEW_GIFS_DIR = path.join(process.cwd(), 'new_gifs');
const TARGET_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');

// Make sure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    console.log(`Created target directory: ${TARGET_DIR}`);
}

// Get a list of all GIFs in the source directories
function getSourceGifs() {
    const sources = {};

    // Try attached_assets first
    if (fs.existsSync(ATTACHED_ASSETS_DIR)) {
        const files = fs.readdirSync(ATTACHED_ASSETS_DIR);
        for (const file of files) {
            if (file.endsWith('.gif')) {
                sources[file] = path.join(ATTACHED_ASSETS_DIR, file);
            }
        }
    }

    // Check new_gifs directory for additional GIFs
    if (fs.existsSync(NEW_GIFS_DIR)) {
        const files = fs.readdirSync(NEW_GIFS_DIR);
        for (const file of files) {
            if (file.endsWith('.gif')) {
                // Prefer new_gifs versions over attached_assets versions
                sources[file] = path.join(NEW_GIFS_DIR, file);
            }
        }
    }

    return sources;
}

// Format file size for better readability
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Calculate file checksum for verification
function calculateChecksum(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('md5');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    } catch (err) {
        console.error(`Error calculating checksum for ${filePath}: ${err.message}`);
        return null;
    }
}

// Copy a file with verification
function copyWithVerification(sourcePath, targetPath) {
    try {
        // Remove any existing symlinks or files
        if (fs.existsSync(targetPath)) {
            const stats = fs.lstatSync(targetPath);
            if (stats.isSymbolicLink()) {
                fs.unlinkSync(targetPath);
                console.log(`Removed symlink: ${targetPath}`);
            } else {
                // Backup existing file with .old extension if not already backed up
                const backupPath = `${targetPath}.old`;
                if (!fs.existsSync(backupPath)) {
                    fs.copyFileSync(targetPath, backupPath);
                    console.log(`Backed up existing file: ${targetPath} → ${backupPath}`);
                }
                fs.unlinkSync(targetPath);
                console.log(`Removed existing file: ${targetPath}`);
            }
        }

        // Copy the file
        fs.copyFileSync(sourcePath, targetPath);
        
        // Verify the copy
        if (fs.existsSync(targetPath)) {
            const sourceSize = fs.statSync(sourcePath).size;
            const targetSize = fs.statSync(targetPath).size;
            const sourceChecksum = calculateChecksum(sourcePath);
            const targetChecksum = calculateChecksum(targetPath);
            
            const sizeMatch = sourceSize === targetSize;
            const checksumMatch = sourceChecksum === targetChecksum;
            
            const result = {
                success: sizeMatch && checksumMatch,
                sourcePath,
                targetPath,
                sourceSize: formatFileSize(sourceSize),
                targetSize: formatFileSize(targetSize),
                sizeMatch,
                checksumMatch
            };
            
            return result;
        } else {
            return { 
                success: false, 
                error: 'Target file does not exist after copy',
                sourcePath,
                targetPath
            };
        }
    } catch (err) {
        return { 
            success: false, 
            error: err.message,
            sourcePath,
            targetPath
        };
    }
}

// Main function to process all reaction GIFs
async function fixAllReactionGifs() {
    console.log('Starting Reaction GIF Fixer...');
    console.log(`Sources: ${ATTACHED_ASSETS_DIR}, ${NEW_GIFS_DIR}`);
    console.log(`Target: ${TARGET_DIR}`);
    
    const sourceGifs = getSourceGifs();
    console.log(`Found ${Object.keys(sourceGifs).length} source GIF files`);

    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    // Process each GIF file by directly copying from source to target with same name
    for (const [gifName, sourcePath] of Object.entries(sourceGifs)) {
        const targetPath = path.join(TARGET_DIR, gifName);
        console.log(`Processing ${gifName}...`);
        
        const result = copyWithVerification(sourcePath, targetPath);
        results.push({gifName, ...result});
        
        if (result.success) {
            console.log(`✅ Successfully copied ${gifName}: ${result.sourceSize} → ${result.targetSize}`);
            successCount++;
        } else {
            console.error(`❌ Failed to copy ${gifName}: ${result.error || 'Unknown error'}`);
            errorCount++;
        }
    }
    
    // Generate a report
    console.log('\n===== REACTION GIF FIX RESULTS =====');
    console.log(`Total GIFs processed: ${results.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('===================================\n');
    
    // Return detailed results
    return {
        total: results.length,
        success: successCount,
        errors: errorCount,
        details: results
    };
}

// Run the fix process
fixAllReactionGifs()
    .then(results => {
        if (results.errors === 0) {
            console.log('\n🎉 All GIFs were successfully fixed!');
            console.log('Restart the bot to apply these changes.');
        } else {
            console.log(`\n⚠️ Fixed ${results.success} GIFs, but encountered ${results.errors} errors.`);
            console.log('Review the log above for details.');
        }
    })
    .catch(err => {
        console.error('Fatal error running the GIF fixer:', err);
    });