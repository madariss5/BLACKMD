# Heroku Deployment Troubleshooting Guide

This guide provides solutions for common issues with running BlackskyMD on Heroku. Follow these steps if your bot is not connecting after deploying to Heroku.

## Quick Fixes

1. **Check Procfile Configuration**
   - Your Procfile must start with `web:` prefix
   - Correct format: `web: YOUTUBE_DL_SKIP_PYTHON_CHECK=1 node src/index.js`

2. **Check Required Environment Variables**
   ```
   CREDS_DATA=<your-whatsapp-credentials-base64>
   PLATFORM=heroku
   NODE_ENV=production
   OWNER_NUMBER=your-number-without-plus-sign
   ```

3. **Check Buildpacks**
   - Required buildpacks:
     - heroku/nodejs
     - https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest
     - heroku/python

## Advanced Troubleshooting

### Using the Web Console

We've added a web-based console to help you troubleshoot deployment issues. After deploying your bot to Heroku, visit:

```
https://your-app-name.herokuapp.com/console
```

The console requires authentication:
- Username: `admin`
- Password: Last 4 digits of your OWNER_NUMBER

The console provides:
- System status information
- WhatsApp connection status
- Environment variables overview
- Auth directory status
- Command execution capabilities

### Generating New CREDS_DATA

If your WhatsApp connection is failing, you may need to generate fresh credentials:

1. Run the bot locally first: `npm start`
2. Connect to WhatsApp by scanning the QR code
3. Run: `node fix-heroku-deployment-new.js`
4. Copy the data from `heroku-creds-data.txt`
5. In Heroku dashboard, update the CREDS_DATA environment variable

### Checking Logs

To view detailed logs and identify issues:

```
heroku logs --tail -a your-app-name
```

Common errors to look for:
- "Error initializing auth from environment" - CREDS_DATA issues
- "WhatsApp connection closed" - Authentication problems
- "Error while generating QR code" - Connection setup problems

### Manual Server Restart

If all else fails, try restarting the server:

```
heroku restart -a your-app-name
```

## API Routes Available

These routes can be useful for debugging:

- `/console` - Web console for advanced debugging
- `/qr` - Displays QR code when WhatsApp is connecting
- `/_health` - Simple health check endpoint
- `/railway` - Status information (works on Heroku too)

## Getting Support

If issues persist, try these resources:
- Check the HEROKU_DEPLOY_GUIDE.md file for detailed setup instructions
- Review the error logs using `heroku logs --tail`
- Create a local backup of your credentials with `node heroku-credentials-helper.js`

## Troubleshooting Scripts

These scripts can help diagnose and fix issues:
- `fix-heroku-deployment-new.js` - Fix common deployment issues and generate credentials
- `verify-heroku-deployment.js` - Check your configuration
- `heroku-console-helper.js` - Adds web console capabilities