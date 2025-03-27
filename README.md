# Blacksky-MD WhatsApp Bot

A sophisticated WhatsApp Multi-Device bot with advanced interactive and entertainment features, designed to provide users with engaging and dynamic communication experiences through intelligent design and modular architecture.

## Key Features

- **Advanced Command System:** Modular command architecture with 100+ built-in commands
- **Multi-Device Support:** Works on multiple devices simultaneously
- **Deployment Ready:** Optimized for Heroku, Railway, and other cloud platforms
- **User-Friendly Design:** Intuitive interface with multilingual support
- **Rich Media Support:** GIF reactions, stickers, YouTube downloads, and more

## Quick Deployment

### One-Click Heroku Deployment

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://dashboard.heroku.com/new-app?template=https://github.com/madariss5/BLACKMD)

For the best deployment experience, check out our [deployment guide](DEPLOYMENT.md) to ensure trouble-free setup.

## Detailed Deployment Options

### Deploying to Railway

1. Fork or clone this repository
2. Create a new project on [Railway](https://railway.app/)
3. Connect your GitHub repository to Railway
4. Railway will automatically detect the configuration and start the deployment
5. Once deployed, access the QR code at `https://your-app-name.railway.app/qr`

For detailed Railway deployment instructions, see [RAILWAY_DEPLOYMENT_GUIDE.md](RAILWAY_DEPLOYMENT_GUIDE.md).

### Manual Heroku Deployment

1. Fork or clone this repository
2. Create a new Heroku app
3. Connect your GitHub repository to Heroku
4. Add the necessary buildpacks in the following order:
   - heroku/nodejs
   - https://github.com/heroku/heroku-buildpack-apt
   - heroku/python
5. Deploy your app

For detailed Heroku deployment instructions, see [EASY_HEROKU_DEPLOY.md](EASY_HEROKU_DEPLOY.md).

## Required Environment Variables

Set the following environment variables in your platform's settings:

- `CREDS_DATA`: Your WhatsApp session credentials data (optional, can be generated at first run)
- `PLATFORM`: Set to "railway" if deploying on Railway, or "heroku" if deploying on Heroku
- `PORT`: Port for the web server (usually set automatically by the platform)
- `YOUTUBE_DL_SKIP_DOWNLOAD`: Set to "1" to avoid issues with youtube-dl binary downloads
- `YOUTUBE_DL_SKIP_PYTHON_CHECK`: Set to "1" to avoid Python requirement checks for youtube-dl

## Deployment Troubleshooting

If you encounter issues with deployment, especially related to youtube-dl-exec:

1. Run the included preparation script before deployment: `node prepare-for-deployment.js`
2. This script will:
   - Add the required environment variables
   - Patch postinstall scripts for compatibility
   - Fix the Procfile for cloud deployments
   - Add necessary fallback implementations

For complete deployment troubleshooting information, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Technical Details

This bot uses:
- Node.js for the main application
- Python for specialized processing (trafilatura, twilio)
- WhatsApp Multi-Device API through Baileys
- Advanced command handling system

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Install Python dependencies: `pip install -r requirements.txt`
4. Start the app: `npm start`