#!/data/data/com.termux/files/usr/bin/bash

# Termux PM2 Service Manager for Blacksky-MD
# This script provides start, stop, restart, logs, and status functionality

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running in Termux
if [ ! -d "/data/data/com.termux" ]; then
  echo -e "${RED}Error: This script should be run in Termux on Android${NC}"
  exit 1
fi

# Ensure we're in the right directory
cd "$HOME/Blacksky-Md"
if [ ! -f "src/index.js" ]; then
  echo -e "${RED}Error: Blacksky-MD files not found${NC}"
  exit 1
fi

# Display help menu
show_help() {
  echo -e "${BLUE}=== Blacksky-MD PM2 Service Manager ===${NC}"
  echo "Usage: $0 [command]"
  echo ""
  echo "Commands:"
  echo "  start       Start the WhatsApp bot with PM2"
  echo "  stop        Stop the WhatsApp bot"
  echo "  restart     Restart the WhatsApp bot"
  echo "  status      Check bot status"
  echo "  logs        Show bot logs"
  echo "  monit       Monitor CPU/Memory usage"
  echo "  help        Show this help message"
  echo ""
}

# Check if PM2 is installed
check_pm2() {
  if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2 is not installed. Run termux-pm2-setup.sh first.${NC}"
    exit 1
  fi
}

# Process commands
case "$1" in
  start)
    check_pm2
    echo -e "${YELLOW}Starting Blacksky-MD WhatsApp bot...${NC}"
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}Bot started successfully!${NC}"
    pm2 status
    ;;
  stop)
    check_pm2
    echo -e "${YELLOW}Stopping Blacksky-MD WhatsApp bot...${NC}"
    pm2 stop blacksky-md
    echo -e "${GREEN}Bot stopped.${NC}"
    pm2 status
    ;;
  restart)
    check_pm2
    echo -e "${YELLOW}Restarting Blacksky-MD WhatsApp bot...${NC}"
    pm2 restart blacksky-md
    echo -e "${GREEN}Bot restarted.${NC}"
    pm2 status
    ;;
  status)
    check_pm2
    echo -e "${BLUE}Blacksky-MD WhatsApp Bot Status:${NC}"
    pm2 status
    ;;
  logs)
    check_pm2
    echo -e "${BLUE}Showing real-time logs (Ctrl+C to exit):${NC}"
    pm2 logs blacksky-md
    ;;
  monit)
    check_pm2
    echo -e "${BLUE}Starting PM2 monitoring interface...${NC}"
    pm2 monit
    ;;
  help|*)
    show_help
    ;;
esac