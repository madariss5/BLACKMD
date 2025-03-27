#!/data/data/com.termux/files/usr/bin/bash

# Termux PM2 Setup Script for Blacksky-MD WhatsApp Bot
# This script installs and configures PM2 for 24/7 operation on Termux

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Blacksky-MD WhatsApp Bot - PM2 Setup for Termux ===${NC}"
echo -e "${YELLOW}This script will set up PM2 for 24/7 operation on your Android device${NC}"
echo ""

# Check if running in Termux
if [ ! -d "/data/data/com.termux" ]; then
  echo -e "${RED}Error: This script should be run in Termux on Android${NC}"
  exit 1
fi

# Ensure we're in the right directory
if [ ! -f "src/index.js" ]; then
  echo -e "${RED}Error: Please run this script from the root directory of Blacksky-MD${NC}"
  exit 1
fi

# Check and install PM2 if needed
echo -e "${YELLOW}Checking for PM2 installation...${NC}"
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}PM2 not found. Installing PM2 globally...${NC}"
  npm install -g pm2
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install PM2. Please check your internet connection and try again.${NC}"
    exit 1
  fi
  echo -e "${GREEN}PM2 installed successfully!${NC}"
else
  echo -e "${GREEN}PM2 is already installed.${NC}"
fi

# Create log directory if it doesn't exist
mkdir -p logs

# Stop any existing PM2 processes for our app
echo -e "${YELLOW}Stopping any existing PM2 processes...${NC}"
pm2 stop blacksky-md 2>/dev/null
pm2 delete blacksky-md 2>/dev/null

# Start the bot with PM2
echo -e "${YELLOW}Starting Blacksky-MD with PM2...${NC}"
pm2 start ecosystem.config.js
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to start the bot with PM2. Please check the logs for errors.${NC}"
  exit 1
fi

# Save PM2 process list
echo -e "${YELLOW}Saving PM2 process list...${NC}"
pm2 save

# Set up PM2 to start on boot
echo -e "${YELLOW}Setting up PM2 to start on Termux boot...${NC}"

# Create or update Termux boot script
cat > termux-boot.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Wait for the device to fully boot
sleep 30

# Navigate to bot directory
cd $HOME/Blacksky-Md

# Start PM2 and restore processes
pm2 resurrect

# Log the boot event
echo "$(date) - Bot started on device boot via PM2" >> logs/boot.log
EOF

# Make boot script executable
chmod +x termux-boot.sh

# Instructions for Termux:boot
echo -e "${GREEN}PM2 setup completed successfully!${NC}"
echo -e "${YELLOW}------------------------------------------------${NC}"
echo -e "${YELLOW}IMPORTANT: To enable startup on boot, you need to:${NC}"
echo -e "${YELLOW}1. Install Termux:Boot app from F-Droid${NC}"
echo -e "${YELLOW}2. Open Termux:Boot app once after installation${NC}"
echo -e "${YELLOW}3. In Termux, run:${NC}"
echo -e "${BLUE}   mkdir -p ~/.termux/boot/${NC}"
echo -e "${BLUE}   cp $PWD/termux-boot.sh ~/.termux/boot/${NC}"
echo -e "${YELLOW}------------------------------------------------${NC}"
echo ""
echo -e "${BLUE}Current PM2 status:${NC}"
pm2 status

# Show logs command
echo ""
echo -e "${YELLOW}To view bot logs, use:${NC}"
echo -e "${BLUE}pm2 logs blacksky-md${NC}"
echo ""
echo -e "${YELLOW}To monitor the bot:${NC}"
echo -e "${BLUE}pm2 monit${NC}"