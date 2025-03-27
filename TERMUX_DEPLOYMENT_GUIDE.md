# Blacksky-MD WhatsApp Bot - Termux Deployment Guide

This guide will help you deploy the Blacksky-MD WhatsApp Bot on Android using Termux for 24/7 operation.

## Prerequisites

1. **Android device** with [Termux](https://f-droid.org/en/packages/com.termux/) installed from F-Droid
2. **[Termux:Boot](https://f-droid.org/en/packages/com.termux.boot/)** app (optional, for auto-start on device boot)
3. Internet connection

## Step 1: Install Required Packages

Open Termux and run the following commands:

```bash
# Update packages
pkg update -y
pkg upgrade -y

# Install required packages
pkg install -y nodejs-lts git ffmpeg python openssl yarn

# Verify installations
node -v
npm -v
git --version
ffmpeg -version
python --version
```

## Step 2: Clone the Repository

```bash
# Go to home directory
cd ~

# Clone the repository
git clone https://github.com/yourusername/Blacksky-Md.git

# Enter the project directory
cd Blacksky-Md
```

## Step 3: Install Dependencies

```bash
# Install NPM dependencies
npm install
```

## Step 4: PM2 Installation and Setup (24/7 Operation)

```bash
# Make the setup script executable
chmod +x termux-pm2-setup.sh

# Run the PM2 setup script
./termux-pm2-setup.sh
```

This will:
- Install PM2 globally
- Configure PM2 for the WhatsApp bot
- Start the bot with PM2
- Set up startup scripts

## Step 5: Setup Auto-Start (Optional)

To make the bot start automatically when your device reboots:

1. Install the Termux:Boot app from F-Droid
2. Open Termux:Boot once after installation
3. Run the following commands in Termux:

```bash
# Create Termux boot directory
mkdir -p ~/.termux/boot/

# Copy the boot script to the correct location
cp ~/Blacksky-Md/termux-boot.sh ~/.termux/boot/
```

## Managing the Bot

Use the provided service script for easy management:

```bash
# Make service script executable
chmod +x termux-pm2-service.sh

# Start the bot
./termux-pm2-service.sh start

# Stop the bot
./termux-pm2-service.sh stop

# Restart the bot
./termux-pm2-service.sh restart

# Check bot status
./termux-pm2-service.sh status

# View real-time logs
./termux-pm2-service.sh logs

# Monitor CPU and memory usage
./termux-pm2-service.sh monit
```

## Updating the Bot

To update the bot to the latest version:

```bash
# Navigate to the bot directory
cd ~/Blacksky-Md

# Pull the latest changes
git pull

# Install any new dependencies
npm install

# Restart the bot with PM2
pm2 restart blacksky-md
```

## Troubleshooting

### Bot crashes or doesn't start

Check the logs for errors:

```bash
pm2 logs blacksky-md
```

### PM2 memory issues

Adjust memory limit in `ecosystem.config.js` if needed.

### WhatsApp connection issues

1. Delete the auth directory and restart:

```bash
rm -rf auth_info_baileys
pm2 restart blacksky-md
```

2. Then scan the QR code to reconnect.

### Device storage space issues

Clear old logs and temporary files:

```bash
rm -rf logs/*.log
rm -rf temp/*
```

## Important Notes

1. **Battery optimization**: Disable battery optimization for Termux in Android settings for better reliability.
2. **Internet connection**: The bot requires a stable internet connection to function properly.
3. **Resource usage**: Monitor your device's memory usage, especially on devices with limited RAM.

## Advanced Configuration

You can modify the PM2 configuration in `ecosystem.config.js` to adjust:

- Memory limits
- Restart behavior
- Watch patterns
- Log settings

## Support

If you encounter any issues, please:
1. Check the logs using `pm2 logs blacksky-md`
2. Open an issue on GitHub with the log output and a description of your problem