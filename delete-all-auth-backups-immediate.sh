#!/bin/bash

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== BLACKSKY-MD Auth Backup Immediate Deletion ===${NC}"
echo -e "${YELLOW}This script will immediately delete ALL auth backup directories${NC}"
echo -e "${YELLOW}WARNING: This operation cannot be undone!${NC}"
echo ""

# Count remaining backup directories
COUNT=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | wc -l)
echo -e "${BLUE}Found ${COUNT} auth backup directories to delete${NC}"

if [ $COUNT -eq 0 ]; then
    echo -e "${GREEN}No auth backup directories found. Nothing to delete.${NC}"
    exit 0
fi

echo -e "${YELLOW}Starting delete operation...${NC}"

# Use a direct shell command to delete all matching directories at once
# The '&' at the end runs the operation in the background
echo -e "${YELLOW}Running delete command in the background...${NC}"
sh -c 'rm -rf ./auth_info_baileys_backup_*' &

echo -e "${GREEN}Delete command started in the background.${NC}"
echo -e "${YELLOW}This will take some time to complete. Please be patient.${NC}"
echo -e "${YELLOW}You can continue using the terminal while the deletion happens.${NC}"
echo ""
echo -e "${BLUE}To check progress, periodically run:${NC}"
echo -e "${GREEN}find . -maxdepth 1 -type d -name \"auth_info_baileys_backup*\" | wc -l${NC}"