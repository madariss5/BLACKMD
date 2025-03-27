#!/data/data/com.termux/files/usr/bin/bash

# Simple startup script for Termux without PM2
# Use this if you prefer not to use PM2

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Blacksky-MD WhatsApp Bot - Termux Starter ===${NC}"

# Check if running in Termux
if [ ! -d "/data/data/com.termux" ]; then
  echo -e "${RED}Error: This script should be run in Termux on Android${NC}"
  exit 1
fi

# Ensure log directory exists
mkdir -p logs

# Get current timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Start the bot in the background with output redirection
echo -e "${YELLOW}Starting Blacksky-MD WhatsApp bot...${NC}"
echo -e "${YELLOW}Logs will be saved to logs/bot_${TIMESTAMP}.log${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop this script, but the bot will continue running${NC}"
echo -e "${YELLOW}To stop the bot, you need to run 'killall node' or restart Termux${NC}"

# Start the bot in the background
nohup node src/index.js > "logs/bot_${TIMESTAMP}.log" 2>&1 &

# Wait a bit and show the bot is running
sleep 3
echo -e "${GREEN}Bot started successfully with PID: $!${NC}"
echo -e "${BLUE}You can close this terminal and the bot will continue running${NC}"
echo -e "${BLUE}To view logs, run: cat logs/bot_${TIMESTAMP}.log${NC}"