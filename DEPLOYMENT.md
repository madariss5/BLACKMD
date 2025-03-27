# BlackskyMD Deployment Guide

This guide will help you successfully deploy BlackskyMD to platforms like Heroku, Railway, or other similar services.

## Preparing for Deployment

Before deploying, run the following preparation script to ensure all deployment-related issues are fixed:

```bash
node prepare-for-deployment.js
```

This script will:
1. Add environment variables to skip problematic downloads
2. Patch the youtube-dl-exec package to work with all Node.js versions
3. Verify your Procfile is correctly configured
4. Add necessary dependencies

## Deployment Steps

### Option 1: Local Preparation + Deploy

1. Run the preparation script: `node prepare-for-deployment.js`
2. Commit changes: `git add . && git commit -m "Prepare for deployment"`
3. Push to your deployment platform: `git push heroku main` (for Heroku)

### Option 2: Direct Deployment (Not Recommended)

If deploying directly from a repository or platform without local preparation:

1. Make sure your deployment includes the following environment variables:
   - `YOUTUBE_DL_SKIP_DOWNLOAD=1`
   - `YOUTUBE_DL_SKIP_PYTHON_CHECK=1`

2. Your Procfile should include the fix script:
   ```
   web: YOUTUBE_DL_SKIP_PYTHON_CHECK=1 YOUTUBE_DL_SKIP_DOWNLOAD=1 npm install node-fetch@2 --no-save && node fix-yt-dl-exec.js && node src/index.js
   ```

## Troubleshooting

If you encounter deployment errors related to youtube-dl-exec:

1. Check if environment variables are properly set
2. Verify that the fix-yt-dl-exec.js script exists in your deployment
3. Try rebuilding the deployment after adding the node-fetch dependency
4. For Heroku: `heroku restart` may be needed after first deployment

## Environment Variables

Set these variables in your deployment platform:

| Variable | Description |
|----------|-------------|
| YOUTUBE_DL_SKIP_DOWNLOAD | Skips youtube-dl binary download |
| YOUTUBE_DL_SKIP_PYTHON_CHECK | Skips Python requirement check |

## Notes on Media Commands

Some media commands that depend on youtube-dl may have limited functionality when deployed with these workarounds. Alternative implementations that don't rely on youtube-dl are available in the bot's media module.

For full functionality of all media commands, consider using a local deployment instead of a cloud deployment.