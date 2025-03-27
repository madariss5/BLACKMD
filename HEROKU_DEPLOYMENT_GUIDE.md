# BLACKSKY-MD WhatsApp Bot - Enhanced Heroku Deployment Guide

This comprehensive guide will help you deploy the BLACKSKY-MD WhatsApp bot to Heroku with our enhanced session persistence, conflict resolution, and monitoring system.

## Features of This Enhanced Deployment

- ✅ **Session Persistence**: Keeps your WhatsApp connection alive in the cloud
- ✅ **Auto-Recovery**: Automatically handles WhatsApp session conflicts
- ✅ **Memory Optimization**: Prevents crashes due to Heroku memory limits
- ✅ **Enhanced Logging**: Detailed logs for troubleshooting
- ✅ **Health Monitoring**: Built-in system status reporting

## Prerequisites

1. A Heroku account
2. The Heroku CLI installed on your computer
3. Git installed on your computer
4. Node.js installed on your computer

## Step 1: Prepare Your Local Bot

First, make sure the bot runs correctly on your local machine:

```bash
# Install dependencies
npm install

# Start the bot locally
npm start
```

Scan the QR code with your WhatsApp to connect. Make sure the bot is working properly before proceeding.

## Step 2: Export WhatsApp Credentials (CRITICAL STEP)

After connecting your WhatsApp account locally, you need to export your credentials for Heroku:

```bash
# Make sure the bot is running and connected to WhatsApp first
# Then in a separate terminal window/tab, run:
node heroku-credentials-helper.js
```

The script will output a long string of characters. **Copy this entire string** - this is your encrypted WhatsApp session data that you'll need to set up in Heroku.

> ⚠️ IMPORTANT: If this step is skipped or done incorrectly, your bot will fail to connect on Heroku!

## Step 3: Create Your Heroku App

```bash
# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-bot-name --region us
```

You can choose your region (us, eu, etc.) based on your location for better performance.

## Step 4: Configure Essential Environment Variables

```bash
# Set your WhatsApp credentials
heroku config:set CREDS_DATA="paste-your-long-string-here" --app your-bot-name

# Set platform identifier for optimizations
heroku config:set PLATFORM=heroku --app your-bot-name

# Set production mode
heroku config:set NODE_ENV=production --app your-bot-name

# Set your phone number (used for owner commands)
heroku config:set OWNER_NUMBER=91xxxxxxxxxx --app your-bot-name
```

Replace `91xxxxxxxxxx` with your actual WhatsApp number including country code.

## Step 5: Deploy to Heroku

We recommend using the Container stack for better stability:

```bash
# Set container stack
heroku stack:set container --app your-bot-name

# Deploy the app
git add .
git commit -m "Ready for Heroku deployment with enhanced session handling"
git push heroku main
```

## Step 6: Scale Your Dyno and Monitor

```bash
# Start one web dyno
heroku ps:scale web=1 --app your-bot-name

# Check the logs
heroku logs --tail --app your-bot-name
```

## Advanced Configuration Options

### Memory Management

To enable aggressive memory management for Heroku's limited environment:

```bash
heroku config:set CLEANUP_LEVEL=aggressive --app your-bot-name
```

### Debug Mode

For more verbose logging:

```bash
heroku config:set DEBUG_MODE=true --app your-bot-name
```

### Keep Heroku Dyno Awake

To prevent Heroku from sleeping your dyno (free tier only):

1. Go to https://uptimerobot.com and create a free account
2. Add a new HTTP monitor pointing to `https://your-bot-name.herokuapp.com/`
3. Set check interval to 25 minutes

## Troubleshooting Common Issues

### 1. Session Conflicts

If you see "session conflict" errors in your logs:

```
Connection closed. Status code: 440, Reason: Stream Errored (conflict)
```

**Solution**: Our enhanced session repair system will automatically handle this. Wait for about 1-2 minutes for the auto-repair to complete. If the problem persists:

1. Check if your WhatsApp is connected elsewhere
2. Run the bot locally again, then generate a fresh CREDS_DATA
3. Update your Heroku config with the new value

### 2. Memory Limit Errors (R14)

If you see R14 errors in your Heroku logs:

**Solution**:
- Enable aggressive cleanup: `heroku config:set CLEANUP_LEVEL=aggressive`
- Or upgrade to Standard-1X or Standard-2X dyno: `heroku dyno:type standard-1x`

### 3. Cold Start Issues

If your bot takes a long time to start after periods of inactivity:

**Solution**:
- Upgrade to a Hobby or Standard dyno
- Use a service like UptimeRobot to ping your app regularly

## Accessing the Web Interface

Your bot includes a web interface for monitoring:

```
https://your-bot-name.herokuapp.com/
```

For QR code (if you need to reconnect):

```
https://your-bot-name.herokuapp.com/qr
```

## Need Help?

Check these resources:

1. Heroku logs: `heroku logs --tail --app your-bot-name`
2. Bot health endpoint: `https://your-bot-name.herokuapp.com/_health`
3. Run diagnostics: Send `.serverinfo` command to the bot on WhatsApp

---

Now your BLACKSKY-MD bot is ready for 24/7 operation on Heroku with enhanced stability! 🚀