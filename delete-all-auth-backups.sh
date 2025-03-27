#!/bin/bash

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== BLACKSKY-MD Auth Backup Mass Cleanup ===${NC}"
echo -e "${YELLOW}This script will delete ALL auth backup directories at once${NC}"
echo -e "${YELLOW}CAUTION: This operation cannot be undone!${NC}"
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
echo -e "${BLUE}Counting all auth backup directories (this may take a moment)...${NC}"

# Count the number of backup directories
BACKUP_COUNT=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "auth_info_baileys_safe_backup" | wc -l)

echo -e "${BLUE}Found ${BACKUP_COUNT} auth backup directories to delete${NC}"

# Check if there are any backups to delete
if [ "$BACKUP_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No auth backup directories found.${NC}"
else
    # Delete all backup directories
    echo -e "${YELLOW}Deleting all auth backup directories...${NC}"
    echo -e "${YELLOW}This may take some time, please be patient.${NC}"
    
    # Use find with xargs to delete all directories in parallel
    find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "auth_info_baileys_safe_backup" | xargs rm -rf
    
    echo -e "${GREEN}Successfully deleted ${BACKUP_COUNT} auth backup directories${NC}"
fi

# Handle other backup locations
echo ""
echo -e "${BLUE}Checking for other backup locations...${NC}"

# Check data/session_backups
if [ -d "data/session_backups" ]; then
    echo -e "${BLUE}Checking for session backups in data/session_backups...${NC}"
    
    # Count backup files
    BACKUP_FILES_COUNT=$(find ./data/session_backups -name "creds_backup_*.json" -o -name "latest_creds.json" 2>/dev/null | wc -l)
    
    if [ "$BACKUP_FILES_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}Found ${BACKUP_FILES_COUNT} session backup files. Deleting...${NC}"
        find ./data/session_backups -name "creds_backup_*.json" -o -name "latest_creds.json" -exec rm -f {} \;
        echo -e "${GREEN}Deleted session backup files${NC}"
    else
        echo -e "${YELLOW}No session backup files found.${NC}"
    fi
fi

# Check backups directory
if [ -d "backups" ]; then
    echo -e "${BLUE}Checking for backups in 'backups' directory...${NC}"
    
    # Count backup files
    BACKUP_FILES_COUNT=$(find ./backups -name "creds_backup_*.json" -o -name "latest_creds.json" 2>/dev/null | wc -l)
    
    if [ "$BACKUP_FILES_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}Found ${BACKUP_FILES_COUNT} credential backup files in 'backups'. Deleting...${NC}"
        find ./backups -name "creds_backup_*.json" -o -name "latest_creds.json" -exec rm -f {} \;
        echo -e "${GREEN}Deleted backup files from 'backups' directory${NC}"
    else
        echo -e "${YELLOW}No backup files found in 'backups' directory.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Auth backup cleanup completed!${NC}"
echo -e "${GREEN}A safe backup was created at: $(find . -maxdepth 1 -type d -name "auth_info_baileys_safe_backup*" | head -n 1)${NC}"
echo -e "${YELLOW}You can safely delete this safe backup later if the bot continues working correctly.${NC}"