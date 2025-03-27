# Heroku Deployment Guide for BlackskyMD

This guide provides step-by-step instructions for deploying the BlackskyMD WhatsApp bot to Heroku.

## Prerequisites

Before you begin, make sure you have:

- A [Heroku account](https://signup.heroku.com/) (free tier available)
- [Git](https://git-scm.com/downloads) installed on your computer
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed (optional, but recommended)
- [Node.js](https://nodejs.org/) (version 16 or higher) installed

## Step 1: Prepare Your WhatsApp Session

Before deploying to Heroku, you need to authenticate with WhatsApp locally and generate credentials:

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/your-username/Blacksky-Md.git
   cd Blacksky-Md
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the bot locally** to generate WhatsApp credentials:
   ```bash
   npm start
   ```

4. **Scan the QR code** using your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Tap Menu or Settings and select WhatsApp Web/Desktop
   - Tap LINK A DEVICE and scan the QR code displayed in your terminal

5. **Wait for authentication to complete**. After successful authentication, the bot will start responding to commands.

## Step 2: Generate Credentials for Heroku

After successfully connecting to WhatsApp, you need to generate credentials for Heroku:

1. **Generate direct credentials**:
   ```bash
   node direct-creds-helper.js
   ```

   This will create a file named `direct-creds-data.txt` containing your WhatsApp credentials in raw JSON format.

2. **Apply the direct credentials patch** to ensure proper credential handling on Heroku:
   ```bash
   node direct-creds-patch.js
   ```

## Step 3: Create a Heroku App

1. **Login to Heroku** (if using Heroku CLI):
   ```bash
   heroku login
   ```

2. **Create a new Heroku app**:
   ```bash
   heroku create your-app-name
   ```
   Or create an app through the [Heroku Dashboard](https://dashboard.heroku.com/apps).

3. **Add required buildpacks**:
   ```bash
   heroku buildpacks:add heroku/nodejs -a your-app-name
   heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest -a your-app-name
   heroku buildpacks:add heroku/python -a your-app-name
   ```

   If using the Dashboard: Go to Settings → Add buildpack, and add each buildpack listed above.

## Step 4: Configure Environment Variables

1. **Set environment variables** using Heroku CLI:
   ```bash
   heroku config:set CREDS_DATA="$(cat direct-creds-data.txt)" -a your-app-name
   heroku config:set PLATFORM=heroku -a your-app-name
   heroku config:set NODE_ENV=production -a your-app-name
   heroku config:set OWNER_NUMBER=your-whatsapp-number -a your-app-name
   ```

   Or through the Heroku Dashboard:
   - Go to your app's Settings
   - Click "Reveal Config Vars"
   - Add the following key-value pairs:
     - `CREDS_DATA`: Content of `direct-creds-data.txt` (copy-paste the entire content)
     - `PLATFORM`: `heroku`
     - `NODE_ENV`: `production`
     - `OWNER_NUMBER`: Your WhatsApp number with country code (e.g., 1234567890)
     - `BOT_NAME`: (Optional) Custom name for your bot
     - `PREFIX`: (Optional) Command prefix (default: !)

## Step 5: Deploy to Heroku

### Option 1: Deploy using Git

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Prepare for Heroku deployment"
   ```

2. **Add Heroku remote**:
   ```bash
   heroku git:remote -a your-app-name
   ```

3. **Push to Heroku**:
   ```bash
   git push heroku main
   ```
   (or `git push heroku master` depending on your branch name)

### Option 2: Deploy using Heroku Dashboard

1. **Connect your GitHub repository** to Heroku:
   - Go to your app's "Deploy" tab
   - Choose "GitHub" as the deployment method
   - Connect to your GitHub repository
   - Enable automatic deploys (optional)
   - Click "Deploy Branch"

## Step 6: Verify Deployment

1. **Check app logs**:
   ```bash
   heroku logs --tail -a your-app-name
   ```

2. **Open your app**:
   ```bash
   heroku open -a your-app-name
   ```

   You should see a confirmation page that your bot is running.

## Step 7: Keep Your Bot Running

Heroku's free tier will put your app to sleep after 30 minutes of inactivity. To keep your bot active 24/7:

1. **Upgrade to a paid Heroku plan**, or
2. **Use a service like [UptimeRobot](https://uptimerobot.com/)** to ping your app every few minutes

## Common Issues and Troubleshooting

### Session Disconnected

If your WhatsApp session gets disconnected:

1. Generate new credentials locally
2. Run `node direct-creds-helper.js` again
3. Update the CREDS_DATA environment variable in Heroku
4. Restart your app with `heroku restart -a your-app-name`

### Deployment Failed

If deployment fails:

1. Check the logs with `heroku logs --tail -a your-app-name`
2. Ensure all required buildpacks are installed
3. Verify that your environment variables are set correctly
4. Run the verification script:
   ```bash
   node verify-heroku-deployment.js
   ```

### Memory Issues

If you're experiencing "R14 - Memory quota exceeded" errors:

1. Consider upgrading to a higher-tier dyno
2. Add the `OPTIMIZE_MEMORY=true` environment variable

## Advanced Configuration

### Change Bot Behavior

To customize your bot:

1. Edit `src/config.js` locally
2. Commit and push changes to Heroku
3. Or set environment variables to override specific settings

### Performance Tuning

For better performance on Heroku:

1. Set `DISABLE_STICKER_CREATION=true` to reduce memory usage
2. Set `DISABLE_GIF_CACHE=true` to reduce disk usage
3. Set `CONNECTION_RETRIES=3` to limit connection retry attempts

## Support and Resources

If you encounter any issues, please:

1. Check the [GitHub repository](https://github.com/your-username/Blacksky-Md) for open issues
2. Look for solutions in the `troubleshooting` directory
3. Run the appropriate fix scripts for common issues

## License

This project is licensed under the terms specified in the LICENSE file.