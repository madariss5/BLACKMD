#!/bin/bash

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== BLACKSKY-MD Auth Backup Cleanup ===${NC}"
echo -e "${YELLOW}This script will delete all authentication backup directories${NC}"
echo ""

# Create a timestamp for backup
TIMESTAMP=$(date +%s)
SAFE_BACKUP="auth_info_baileys_safe_backup_${TIMESTAMP}"

# Create a safe backup first
echo -e "${BLUE}Creating a safe backup of current auth data...${NC}"
if [ -d "auth_info_baileys" ]; then
    mkdir -p "$SAFE_BACKUP"
    cp -r auth_info_baileys/* "$SAFE_BACKUP"/ 2>/dev/null
    echo -e "${GREEN}Safe backup created at: $SAFE_BACKUP${NC}"
else
    echo -e "${YELLOW}Main auth directory 'auth_info_baileys' does not exist. Nothing to backup.${NC}"
fi

echo ""
echo -e "${BLUE}Finding all auth backup directories...${NC}"

# Find all auth backup directories
BACKUP_DIRS=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "$SAFE_BACKUP")
BACKUP_COUNT=$(echo "$BACKUP_DIRS" | grep -v "^$" | wc -l)

echo -e "${BLUE}Found ${BACKUP_COUNT} auth backup directories${NC}"

# Check if there are any backups to delete
if [ "$BACKUP_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No auth backup directories found.${NC}"
else
    # Delete each backup directory
    echo -e "${YELLOW}Deleting auth backup directories...${NC}"
    
    for dir in $BACKUP_DIRS; do
        echo -e "${YELLOW}Deleting $dir...${NC}"
        rm -rf "$dir"
        echo -e "${GREEN}Deleted $dir${NC}"
    done
    
    echo -e "${GREEN}Successfully deleted ${BACKUP_COUNT} auth backup directories${NC}"
fi

# Handle session backups in data directory
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
echo -e "${GREEN}A safe backup was created at: $SAFE_BACKUP${NC}"
echo -e "${YELLOW}You can delete this safe backup later if the bot continues working correctly.${NC}"