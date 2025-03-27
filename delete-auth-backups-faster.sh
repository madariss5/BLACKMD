#!/bin/bash

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Number of batches to delete and batch size
BATCH_COUNT=10
BATCH_SIZE=20

echo -e "${BLUE}=== BLACKSKY-MD Auth Backup Super Fast Cleanup ===${NC}"
echo -e "${YELLOW}This script will delete ${BATCH_COUNT} batches of ${BATCH_SIZE} directories each${NC}"
echo ""

# Initial count
INITIAL_COUNT=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | wc -l)
echo -e "${BLUE}Found ${INITIAL_COUNT} auth backup directories before cleanup${NC}"

# Process multiple batches
for ((i=1; i<=$BATCH_COUNT; i++)); do
    # Find and delete a batch of directories
    echo -e "${YELLOW}Processing batch ${i}/${BATCH_COUNT}...${NC}"
    find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | head -n $BATCH_SIZE | xargs rm -rf
    
    # Check remaining count
    REMAINING=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | wc -l)
    DELETED=$((INITIAL_COUNT - REMAINING))
    
    echo -e "${GREEN}Batch ${i} complete. Deleted ${DELETED} directories so far. ${REMAINING} remaining.${NC}"
    
    # Exit if all directories are deleted
    if [ $REMAINING -eq 0 ]; then
        echo -e "${GREEN}All auth backup directories have been deleted!${NC}"
        break
    fi
done

# Final status
FINAL_COUNT=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | wc -l)
echo ""
echo -e "${BLUE}Cleanup summary:${NC}"
echo -e "${GREEN}- Initial count: ${INITIAL_COUNT}${NC}"
echo -e "${GREEN}- Deleted: $((INITIAL_COUNT - FINAL_COUNT))${NC}"
echo -e "${YELLOW}- Remaining: ${FINAL_COUNT}${NC}"

if [ $FINAL_COUNT -gt 0 ]; then
    echo ""
    echo -e "${BLUE}Run this script again to delete more backup directories:${NC}"
    echo -e "${GREEN}./delete-auth-backups-faster.sh${NC}"
fi