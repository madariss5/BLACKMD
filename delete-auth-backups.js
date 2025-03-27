/**
 * Script to delete all auth_info_baileys_backup folders
 */

const fs = require('fs');
const path = require('path');

console.log('Starting cleanup of auth_info_baileys_backup folders...');

// Get all directories in the current folder
const directories = fs.readdirSync('.', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => name.startsWith('auth_info_baileys_backup'));

console.log(`Found ${directories.length} backup directories to delete.`);

let deletedCount = 0;
let errorCount = 0;

// Delete each directory
for (const dir of directories) {
    try {
        console.log(`Deleting ${dir}...`);
        deleteDirectory(dir);
        deletedCount++;
    } catch (error) {
        console.error(`Error deleting ${dir}: ${error.message}`);
        errorCount++;
    }
}

console.log('\nCleanup Summary:');
console.log(`- Total directories found: ${directories.length}`);
console.log(`- Successfully deleted: ${deletedCount}`);
console.log(`- Failed to delete: ${errorCount}`);

if (deletedCount === directories.length) {
    console.log('\n✅ All auth_info_baileys_backup folders have been deleted successfully.');
} else {
    console.log('\n⚠️ Some folders could not be deleted. Please check the errors above.');
}

/**
 * Recursively deletes a directory and all its contents
 * @param {string} dirPath - The path to the directory to delete
 */
function deleteDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                // Recursive call for directories
                deleteDirectory(curPath);
            } else {
                // Delete file
                fs.unlinkSync(curPath);
            }
        });
        // Delete empty directory
        fs.rmdirSync(dirPath);
    }
}