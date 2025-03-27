# Easy Heroku Deployment Guide for BlackskyMD

This guide will help you deploy BlackskyMD WhatsApp bot to Heroku with minimal effort.

## Prerequisites

1. A Heroku account (free or paid)
2. WhatsApp installed on your phone
3. Basic knowledge of Heroku (or just follow this guide step by step)

## Preparation Steps

### 1. Clone or Fork the Repository

- Fork the repository to your GitHub account
- OR clone the repository using:
  ```
  git clone https://github.com/madariss5/BLACKMD.git
  cd BLACKMD
  ```

### 2. Generate WhatsApp Credentials

First, run the bot locally to generate credentials:

```bash
npm install
npm start
```

- Scan the QR code with WhatsApp
- After connecting, run:
  ```
  node direct-creds-helper.js
  ```
- This will generate a `direct-creds-data.txt` file with your credentials

### 3. Deploy to Heroku

You have two options for deploying to Heroku:

#### Option 1: One-Click Deploy (Easiest)

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/madariss5/BLACKMD)

- Click the "Deploy to Heroku" button above
- Fill in the required environment variables:
  - **CREDS_DATA**: Copy and paste the entire content from `direct-creds-data.txt`
  - **OWNER_NUMBER**: Your WhatsApp number without the + sign (e.g., 491234567890)
  - **PLATFORM**: Set to `heroku`
  - Leave the other settings at default values

#### Option 2: Manual Deployment

If you prefer to deploy manually:

1. Install Heroku CLI:
   ```
   npm install -g heroku
   ```

2. Login to Heroku:
   ```
   heroku login
   ```

3. Create a new Heroku app:
   ```
   heroku create your-app-name
   ```

4. Run the prepare script:
   ```
   node prepare-heroku-package.js
   ```

5. Set environment variables:
   ```
   heroku config:set CREDS_DATA="$(cat direct-creds-data.txt)" -a your-app-name
   heroku config:set OWNER_NUMBER="your-number-without-plus" -a your-app-name
   heroku config:set PLATFORM="heroku" -a your-app-name
   heroku config:set NODE_ENV="production" -a your-app-name
   ```

6. Add buildpacks:
   ```
   heroku buildpacks:add heroku/nodejs -a your-app-name
   heroku buildpacks:add https://github.com/heroku/heroku-buildpack-apt -a your-app-name
   heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest -a your-app-name
   heroku buildpacks:add heroku/python -a your-app-name
   ```

7. Push to Heroku:
   ```
   git push heroku main
   ```

## Troubleshooting

If you encounter any issues during deployment:

1. Check Heroku logs:
   ```
   heroku logs --tail -a your-app-name
   ```

2. Common issues:
   - **Missing environment variables**: Make sure all required variables are set
   - **Build failures**: The project now includes an Aptfile for system dependencies
   - **WhatsApp connection issues**: Verify your CREDS_DATA is correct and not expired

3. Use the troubleshooting tools:
   ```
   node verify-heroku-deployment.js
   ```

## Keeping Your Bot Online

For 24/7 uptime, consider:
- Upgrading to a paid Heroku plan
- Using Heroku's free eco dynos (limited but available)
- Setting up a ping service to prevent sleep

## Credits

- BlackskyMD WhatsApp Bot by madariss5
- Deployment simplification script by Replit.com Expert Software Developer

For any questions or issues, please open an issue on GitHub.