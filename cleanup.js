/**
 * Cleanup script to remove auth backup directories
 */

const fs = require('fs');
const path = require('path');

// Get all directories in the current folder
const dirs = fs.readdirSync('.', { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name)
  .filter(name => name.startsWith('auth_info_baileys_backup'));

console.log(`Found ${dirs.length} auth backup directories to remove`);

// Remove directories one by one
let removedCount = 0;
dirs.forEach(dir => {
  try {
    // Use a recursive approach to delete nested files and directories
    function deleteFolderRecursive(directoryPath) {
      if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach(file => {
          const curPath = path.join(directoryPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            // Recursive call for directories
            deleteFolderRecursive(curPath);
          } else {
            // Delete file
            fs.unlinkSync(curPath);
          }
        });
        // Delete empty directory
        fs.rmdirSync(directoryPath);
      }
    }
    
    // Delete the directory
    deleteFolderRecursive(dir);
    removedCount++;
    
    // Log progress every 10 directories
    if (removedCount % 10 === 0) {
      console.log(`Removed ${removedCount} directories so far...`);
    }
  } catch (error) {
    console.error(`Error removing directory ${dir}:`, error.message);
  }
});

console.log(`Successfully removed ${removedCount} auth backup directories`);