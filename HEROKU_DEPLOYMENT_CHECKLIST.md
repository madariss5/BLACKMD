# Heroku Deployment Checklist

Use this checklist to ensure all necessary components are properly configured for successful Heroku deployment.

## Configuration Files

- [x] **Procfile** - Verified with correct format: `web: YOUTUBE_DL_SKIP_PYTHON_CHECK=1 node src/index.js`
- [x] **heroku.yml** - Verified with correct Docker configuration
- [x] **Dockerfile** - Verified with all required dependencies and environment setup
- [x] **app.json** - Updated with correct description for CREDS_DATA (raw JSON format)
- [x] **package-heroku.json** - Verified with correct Node.js version and dependencies

## Credential Handling Tools

- [x] **direct-creds-helper.js** - Created to export creds.json in raw JSON format
- [x] **direct-heroku-helper.js** - Created to handle raw JSON credentials
- [x] **direct-creds-patch.js** - Created to patch the application to use direct credentials
- [x] **DIRECT_CREDS_GUIDE.md** - Created with detailed instructions

## Pre-Deployment Steps

1. [ ] Start the bot locally and authenticate with WhatsApp
   ```
   npm start
   ```

2. [ ] Generate WhatsApp credentials in raw JSON format
   ```
   node direct-creds-helper.js
   ```

3. [ ] Apply the direct credentials patch
   ```
   node direct-creds-patch.js
   ```

4. [ ] Commit your changes
   ```
   git add .
   git commit -m "Prepare for Heroku deployment with direct credentials"
   ```

## Heroku Setup

1. [ ] Create a new Heroku app (if you haven't already)
   ```
   heroku create your-app-name
   ```

2. [ ] Set required environment variables
   ```
   heroku config:set CREDS_DATA="$(cat direct-creds-data.txt)" -a your-app-name
   heroku config:set PLATFORM=heroku -a your-app-name
   heroku config:set NODE_ENV=production -a your-app-name
   heroku config:set OWNER_NUMBER=your-number-without-plus -a your-app-name
   heroku config:set BOT_NAME=YourBotName -a your-app-name
   heroku config:set PREFIX=! -a your-app-name
   ```

3. [ ] Set Heroku stack to container (if using Docker)
   ```
   heroku stack:set container -a your-app-name
   ```

## Deployment Options

Choose one of the following deployment methods:

### Option 1: Deploy with Git

```
git push heroku main
```

### Option 2: Deploy with Heroku Container Registry

```
heroku container:push web -a your-app-name
heroku container:release web -a your-app-name
```

### Option 3: Deploy via GitHub Integration

1. Connect your GitHub repository in the Heroku dashboard
2. Enable automatic deploys or manually deploy a specific branch

## Post-Deployment Verification

1. [ ] Check Heroku logs for errors
   ```
   heroku logs --tail -a your-app-name
   ```

2. [ ] Access the web console for diagnostic information
   ```
   https://your-app-name.herokuapp.com/console
   ```

3. [ ] Verify WhatsApp connection status via the diagnostic page
   ```
   https://your-app-name.herokuapp.com/status
   ```

## Troubleshooting Common Issues

- **Issue**: "Cannot read properties of undefined (reading 'endsWith')"
  **Solution**: Check the CREDS_DATA format; it should be raw JSON from creds.json

- **Issue**: "SyntaxError: Unexpected token in JSON at position X"
  **Solution**: Ensure CREDS_DATA contains valid JSON with no extra quotes or characters

- **Issue**: "Error: Not a WhatsApp account"
  **Solution**: Generate new credentials by scanning the QR code on your local machine

- **Issue**: Application crashes shortly after starting
  **Solution**: Check Heroku logs for specific errors and ensure all environment variables are set correctly

## Additional Resources

- [Heroku Dashboard](https://dashboard.heroku.com/apps)
- [Heroku CLI Documentation](https://devcenter.heroku.com/articles/heroku-cli)
- [WhatsApp MD Documentation](https://github.com/WhiskeySockets/Baileys)
- [Heroku Container Registry](https://devcenter.heroku.com/articles/container-registry-and-runtime)