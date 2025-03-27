#!/bin/bash

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to count auth backups
count_backups() {
    BACKUP_COUNT=$(find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | wc -l)
    echo -e "${BLUE}Found ${BACKUP_COUNT} auth backup directories${NC}"
}

# Function to display header
show_header() {
    clear
    echo -e "${CYAN}====================================================${NC}"
    echo -e "${CYAN}       BLACKSKY-MD AUTH BACKUP MANAGER ${NC}"
    echo -e "${CYAN}====================================================${NC}"
    echo ""
    count_backups
    echo ""
}

# Function to show main menu
show_menu() {
    show_header
    echo -e "${YELLOW}Available commands:${NC}"
    echo -e "${GREEN}1${NC}) Delete 20 backup directories (fast)"
    echo -e "${GREEN}2${NC}) Delete 100 backup directories (faster)"
    echo -e "${GREEN}3${NC}) Delete all backups in background (may take time)"
    echo -e "${GREEN}4${NC}) Run optimized cleanup in batches"
    echo -e "${GREEN}5${NC}) Disable auto-backups (prevent future excessive backups)"
    echo -e "${GREEN}6${NC}) Check auth backup count"
    echo -e "${GREEN}7${NC}) Create safe backup (if not already exists)"
    echo -e "${GREEN}8${NC}) Delete session backups in data directory"
    echo -e "${GREEN}9${NC}) Show README with instructions"
    echo -e "${RED}0${NC}) Exit"
    echo ""
    echo -e "${YELLOW}Enter your choice:${NC}"
}

# Function to delete 20 backup directories
delete_20_backups() {
    show_header
    echo -e "${YELLOW}Deleting 20 auth backup directories...${NC}"
    find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | head -n 20 | xargs rm -rf
    echo -e "${GREEN}Deleted 20 auth backup directories${NC}"
}

# Function to delete 100 backup directories
delete_100_backups() {
    show_header
    echo -e "${YELLOW}Deleting 100 auth backup directories...${NC}"
    for i in {1..5}; do
        echo -e "${BLUE}Batch $i of 5...${NC}"
        find . -maxdepth 1 -type d -name "auth_info_baileys_backup*" | grep -v "safe_backup" | head -n 20 | xargs rm -rf
    done
    echo -e "${GREEN}Deleted 100 auth backup directories${NC}"
}

# Function to delete all backups in background
delete_all_background() {
    show_header
    echo -e "${YELLOW}Starting background deletion of all auth backup directories...${NC}"
    echo -e "${YELLOW}This will run in the background and may take a long time.${NC}"
    sh -c 'rm -rf ./auth_info_baileys_backup_*' &
    echo -e "${GREEN}Delete command started in the background.${NC}"
}

# Function to run optimized cleanup
run_optimized_cleanup() {
    show_header
    echo -e "${YELLOW}Running optimized cleanup in batches...${NC}"
    ./delete-auth-backups-faster.sh
}

# Function to disable auto-backups
disable_auto_backups() {
    show_header
    echo -e "${YELLOW}Disabling automatic backups to prevent future issues...${NC}"
    node disable-auto-backups.js
}

# Function to create safe backup
create_safe_backup() {
    show_header
    
    # Check if a safe backup already exists
    SAFE_BACKUP_EXISTS=$(find . -maxdepth 1 -type d -name "auth_info_baileys_safe_backup*" | wc -l)
    
    if [ "$SAFE_BACKUP_EXISTS" -gt 0 ]; then
        echo -e "${YELLOW}A safe backup already exists:${NC}"
        find . -maxdepth 1 -type d -name "auth_info_baileys_safe_backup*"
        echo ""
        echo -e "${YELLOW}Do you want to create another one? (y/n)${NC}"
        read -r create_another
        
        if [[ "$create_another" != "y" && "$create_another" != "Y" ]]; then
            echo -e "${BLUE}Skipping safe backup creation${NC}"
            return
        fi
    fi
    
    # Create timestamp
    TIMESTAMP=$(date +%s)
    SAFE_BACKUP="auth_info_baileys_safe_backup_${TIMESTAMP}"
    
    # Check if auth directory exists
    if [ -d "auth_info_baileys" ]; then
        echo -e "${YELLOW}Creating safe backup from auth_info_baileys...${NC}"
        mkdir -p "$SAFE_BACKUP"
        cp -r auth_info_baileys/* "$SAFE_BACKUP"/ 2>/dev/null
        echo -e "${GREEN}Safe backup created at: $SAFE_BACKUP${NC}"
    else
        echo -e "${RED}Error: auth_info_baileys directory not found!${NC}"
    fi
}

# Function to delete session backups in data directory
delete_session_backups() {
    show_header
    echo -e "${YELLOW}Checking for session backups in data directory...${NC}"
    
    if [ -d "data/session_backups" ]; then
        BACKUP_FILES_COUNT=$(find ./data/session_backups -name "creds_backup_*.json" -o -name "latest_creds.json" 2>/dev/null | wc -l)
        
        if [ "$BACKUP_FILES_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}Found ${BACKUP_FILES_COUNT} session backup files. Deleting...${NC}"
            rm -f ./data/session_backups/creds_backup_*.json ./data/session_backups/latest_creds.json 2>/dev/null
            echo -e "${GREEN}Deleted session backup files${NC}"
        else
            echo -e "${YELLOW}No session backup files found.${NC}"
        fi
    else
        echo -e "${YELLOW}data/session_backups directory not found.${NC}"
    fi
    
    # Check backups directory
    if [ -d "backups" ]; then
        BACKUP_FILES_COUNT=$(find ./backups -name "creds_backup_*.json" -o -name "latest_creds.json" 2>/dev/null | wc -l)
        
        if [ "$BACKUP_FILES_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}Found ${BACKUP_FILES_COUNT} credential backup files in 'backups'. Deleting...${NC}"
            rm -f ./backups/creds_backup_*.json ./backups/latest_creds.json 2>/dev/null
            echo -e "${GREEN}Deleted backup files from 'backups' directory${NC}"
        else
            echo -e "${YELLOW}No backup files found in 'backups' directory.${NC}"
        fi
    else
        echo -e "${YELLOW}backups directory not found.${NC}"
    fi
}

# Function to show README
show_readme() {
    show_header
    if [ -f "README-AUTH-CLEANUP.md" ]; then
        echo -e "${YELLOW}=== README-AUTH-CLEANUP.md ===${NC}"
        cat README-AUTH-CLEANUP.md
    else
        echo -e "${RED}README-AUTH-CLEANUP.md not found!${NC}"
    fi
}

# Main loop
while true; do
    show_menu
    read -r choice
    
    case $choice in
        1)
            delete_20_backups
            ;;
        2)
            delete_100_backups
            ;;
        3)
            delete_all_background
            ;;
        4)
            run_optimized_cleanup
            ;;
        5)
            disable_auto_backups
            ;;
        6)
            show_header
            ;;
        7)
            create_safe_backup
            ;;
        8)
            delete_session_backups
            ;;
        9)
            show_readme
            ;;
        0)
            echo -e "${GREEN}Exiting...${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option. Please try again.${NC}"
            ;;
    esac
    
    echo ""
    echo -e "${YELLOW}Press Enter to continue...${NC}"
    read -r
done