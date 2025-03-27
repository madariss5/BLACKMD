#!/bin/bash

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Number of directories to delete per batch - smaller for better performance
BATCH_SIZE=20

echo -e "${BLUE}=== BLACKSKY-MD Auth Backup Batch Cleanup ===${NC}"
echo -e "${YELLOW}This script will delete up to ${BATCH_SIZE} auth backup directories at a time${NC}"
echo ""

# Create a safe backup first if it doesn't exist already
echo -e "${BLUE}Checking for existing safe backup...${NC}"
SAFE_BACKUP_EXISTS=$(find . -maxdepth 1 -type d -name "auth_info_baileys_safe_backup*" | wc -l)

if [ "$SAFE_BACKUP_EXISTS" -eq 0 ]; then
    TIMESTAMP=$(date +%s)
    SAFE_BACKUP="auth_info_baileys_safe_backup_${TIMESTAMP}"
    
    echo -e "${BLUE}Creating a safe backup of current auth data...${NC}"
    if [ -d "auth_info_baileys" ]; then
        mkdir -p "$SAFE_BACKUP"
        cp -r auth_info_baileys/* "$SAFE_BACKUP"/ 2>/dev/null
        echo -e "${GREEN}Safe backup created at: $SAFE_BACKUP${NC}"
    else
        echo -e "${YELLOW}Main auth directory 'auth_info_baileys' does not exist. Nothing to backup.${NC}"
    fi
else
    echo -e "${BLUE}Safe backup already exists. Skipping backup creation.${NC}"
fi

echo ""
echo -e "${BLUE}Finding all auth backup directories...${NC}"

# Find all auth backup directories (excluding our safe backup)
BACKUP_DIRS=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "auth_info_baileys_safe_backup" | head -n $BATCH_SIZE)
BACKUP_COUNT=$(echo "$BACKUP_DIRS" | grep -v "^$" | wc -l)

echo -e "${BLUE}Found ${BACKUP_COUNT} auth backup directories to delete in this batch${NC}"

# Check if there are any backups to delete
if [ "$BACKUP_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No more auth backup directories found.${NC}"
else
    # Delete directories in this batch
    echo -e "${YELLOW}Deleting auth backup directories (batch of ${BATCH_SIZE})...${NC}"
    
    for dir in $BACKUP_DIRS; do
        echo -e "${YELLOW}Deleting $dir...[0m"
        rm -rf "$dir"
        echo -e "${GREEN}Deleted $dir${NC}"
    done
    
    echo -e "${GREEN}Successfully deleted ${BACKUP_COUNT} auth backup directories${NC}"
    
    # Check if there might be more directories to delete
    REMAINING=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "auth_info_baileys_safe_backup" | wc -l)
    if [ "$REMAINING" -gt 0 ]; then
        echo -e "${YELLOW}There are still approximately ${REMAINING} auth backup directories remaining.${NC}"
        echo -e "${YELLOW}Run this script again to delete the next batch.${NC}"
    else
        echo -e "${GREEN}All auth backup directories have been deleted!${NC}"
    fi
fi

# Handle data/session_backups only when no more auth backups remain
if [ "$BACKUP_COUNT" -eq 0 ]; then
    if [ -d "data/session_backups" ]; then
        echo ""
        echo -e "${BLUE}Checking for session backups in data/session_backups...${NC}"
        
        # Count backup files
        BACKUP_FILES=$(find ./data/session_backups -name "creds_backup_*.json" -o -name "latest_creds.json" 2>/dev/null)
        BACKUP_FILES_COUNT=$(echo "$BACKUP_FILES" | grep -v "^$" | wc -l)
        
        if [ "$BACKUP_FILES_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}Found ${BACKUP_FILES_COUNT} session backup files. Deleting...${NC}"
            rm -f ./data/session_backups/creds_backup_*.json ./data/session_backups/latest_creds.json 2>/dev/null
            echo -e "${GREEN}Deleted session backup files${NC}"
        else
            echo -e "${YELLOW}No session backup files found.${NC}"
        fi
    fi

    # Check if backups directory exists
    if [ -d "backups" ]; then
        echo ""
        echo -e "${BLUE}Checking for backups in 'backups' directory...${NC}"
        
        # Count backup files
        BACKUP_FILES=$(find ./backups -name "creds_backup_*.json" -o -name "latest_creds.json" 2>/dev/null)
        BACKUP_FILES_COUNT=$(echo "$BACKUP_FILES" | grep -v "^$" | wc -l)
        
        if [ "$BACKUP_FILES_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}Found ${BACKUP_FILES_COUNT} credential backup files in 'backups'. Deleting...${NC}"
            rm -f ./backups/creds_backup_*.json ./backups/latest_creds.json 2>/dev/null
            echo -e "${GREEN}Deleted backup files from 'backups' directory${NC}"
        else
            echo -e "${YELLOW}No backup files found in 'backups' directory.${NC}"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}Auth backup cleanup completed!${NC}"
    echo -e "${YELLOW}You can safely delete the safe backup directory (auth_info_baileys_safe_backup*) if the bot continues working correctly.${NC}"
else
    echo ""
    echo -e "${YELLOW}Run this script again to delete more backup directories.${NC}"
fi