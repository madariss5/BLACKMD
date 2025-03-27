#!/data/data/com.termux/files/usr/bin/bash

# Wait for the device to fully boot
sleep 30

# Navigate to bot directory
cd $HOME/Blacksky-Md

# Start PM2 and restore processes
pm2 resurrect

# Log the boot event
echo "$(date) - Bot started on device boot via PM2" >> logs/boot.log