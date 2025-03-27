# Auth Backup Cleanup Guide

## Overview

This guide explains the auth backup cleanup process implemented to fix excessive auth backup directories in the BlackskyMD WhatsApp bot.

## Problem

The bot was creating too many auth backup directories (`auth_info_baileys_backup_*`), causing storage issues and potential performance problems.

## Solutions Implemented

1. **Created a safe backup** of the current auth directory to ensure no data loss
2. **Developed cleanup scripts** to delete excessive backup directories
3. **Disabled excessive auto-backups** in the codebase for future prevention

## Cleanup Scripts

### 1. Fast Batch Cleanup (Recommended)

The `delete-auth-backups-fast.sh` script deletes 50 auth backup directories at a time.

```bash
# Run the script multiple times until all backups are removed
./delete-auth-backups-fast.sh
```

### 2. One-Time Mass Cleanup (May timeout)

The `delete-all-auth-backups.sh` script attempts to delete all auth backup directories at once.

```bash
# This may timeout if there are too many directories
./delete-all-auth-backups.sh
```

### 3. Safe and Slow Cleanup

The `batch-delete-auth-backups.sh` script deletes 20 directories at a time with detailed output.

```bash
# Run multiple times to slowly remove backups
./batch-delete-auth-backups.sh
```

## Preventing Future Issues

The `disable-auto-backups.js` script has already modified the codebase to prevent excessive auto-backups:

1. Reduced backup frequency from minutes to 24 hours
2. Limited the maximum number of backups to 3
3. Modified cleanup routines to delete old backups

```bash
# Already executed - no need to run again
node disable-auto-backups.js
```

## After Cleanup

1. **Restart the bot** after cleanup is complete for changes to take effect
2. **Verify that no new excessive backup directories are created**
3. **After confirming successful operation, you can delete the safe backup directory**:
   ```bash
   # Only run after verifying the bot works correctly
   rm -rf auth_info_baileys_safe_backup_*
   ```

## Additional Information

- The original auth directory (`auth_info_baileys`) is preserved
- These changes only affect the backup mechanism, not the bot's functionality
- The bot should now create far fewer backup directories (max 3) with a 24-hour interval

## If Problems Persist

If you continue to see excessive auth backup directories being created:

1. Stop the bot
2. Run cleanup scripts again
3. Check error logs for any issues with the modified files
4. Restore original files from backups if needed (`.backup` extension)

## Files Modified

- `src/utils/backupManager.js`
- `src/core/sessionManager.js`
- `src/core/connection.js` (if applicable)

Backups of these files were created with the `.backup` extension.