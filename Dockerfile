FROM node:16

# Set environment variables
ENV NODE_ENV=production
ENV NODE_VERSION=16.20.0

# Create app directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    g++ \
    build-essential \
    python3-dev \
    python3 \
    python3-pip \
    pkg-config

# Create symlink for python and upgrade pip
RUN ln -sf /usr/bin/python3 /usr/bin/python && \
    pip3 install --upgrade pip setuptools wheel

# Copy package files and rename our special Heroku package.json
COPY package-heroku.json ./package.json
COPY package-lock.json ./

# Install app dependencies
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
ENV YOUTUBE_DL_SKIP_DOWNLOAD=1

# Install node-fetch first to fix the postinstall script issue
RUN npm install node-fetch@2 --no-save && \
    # Create a simple patch for the youtube-dl-exec postinstall script
    mkdir -p /tmp/patches && \
    echo "const fetch = require('node-fetch');" > /tmp/patches/fetch-patch.js && \
    # Install other dependencies
    npm install --production --no-package-lock

# Copy app source code
COPY . .

# Install Python requirements (using pip directly to avoid TOML parsing issues)
RUN pip3 install trafilatura twilio --no-cache-dir

# Expose port for web server
EXPOSE $PORT

# Start the application
CMD ["node", "src/index.js"]