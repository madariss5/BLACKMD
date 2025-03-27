#!/bin/bash

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Number of directories to delete per batch (increased for faster processing)
BATCH_SIZE=50

echo -e "${BLUE}=== BLACKSKY-MD Auth Backup Fast Cleanup ===${NC}"
echo -e "${YELLOW}This script deletes ${BATCH_SIZE} auth backup directories at a time${NC}"
echo ""

# Find auth backup directories (excluding safe backups)
echo -e "${BLUE}Finding auth backup directories...${NC}"
BACKUP_DIRS=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | head -n $BATCH_SIZE)
BACKUP_COUNT=$(echo "$BACKUP_DIRS" | grep -v "^$" | wc -l)

# Check if there are any backups to delete
if [ "$BACKUP_COUNT" -eq 0 ]; then
    echo -e "${GREEN}No more auth backup directories found. All cleanup complete!${NC}"
    exit 0
fi

echo -e "${BLUE}Found ${BACKUP_COUNT} auth backup directories to delete in this batch${NC}"
echo -e "${YELLOW}Deleting auth backup directories...${NC}"

# Simple counter for progress 
COUNTER=0

# Delete each directory
for dir in $BACKUP_DIRS; do
    rm -rf "$dir" 2>/dev/null
    COUNTER=$((COUNTER+1))
    # Only update the progress every 5 directories to reduce output
    if [ $((COUNTER % 5)) -eq 0 ]; then
        echo -ne "${YELLOW}Deleted ${COUNTER}/${BACKUP_COUNT} directories\r${NC}"
    fi
done

echo -e "\n${GREEN}Successfully deleted ${COUNTER} auth backup directories${NC}"

# Check if there are more directories to delete
REMAINING=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo -e "${YELLOW}There are still approximately ${REMAINING} auth backup directories remaining.${NC}"
    echo -e "${YELLOW}Run this script again to delete the next batch.${NC}"
fi

echo ""
echo -e "${BLUE}Command to run this script again:${NC}"
echo -e "${GREEN}./delete-auth-backups-fast.sh${NC}"