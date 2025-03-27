const fs = require('fs');
const https = require('https');
const path = require('path');

// Define the reaction GIFs to download
const reactions = [
  { name: 'angry', url: 'https://media.giphy.com/media/aNFT7eG2rIKK715uLk/giphy.gif' },
  { name: 'bored', url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif' },
  { name: 'confused', url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif' },
  { name: 'cool', url: 'https://media.giphy.com/media/LOcPt9gfuNOSI/giphy.gif' },
  { name: 'disgusted', url: 'https://media.giphy.com/media/dOl2LFw0RbTMc/giphy.gif' },
  { name: 'excited', url: 'https://media.giphy.com/media/MeIucAjPKoA120R7sN/giphy.gif' },
  { name: 'facepalm', url: 'https://media.giphy.com/media/TJawtKM6OCKkvwCIqX/giphy.gif' },
  { name: 'fuck', url: 'https://media.giphy.com/media/3o6ZtdZI1MbbyXz8lO/giphy.gif' },
  { name: 'greedy', url: 'https://media.giphy.com/media/67ThRZlYBvibtdF9JH/giphy.gif' },
  { name: 'horny', url: 'https://media.giphy.com/media/H4s7qjFZk486I/giphy.gif' },
  { name: 'hungry', url: 'https://media.giphy.com/media/XHLwEnMWWF9D2/giphy.gif' },
  { name: 'jealous', url: 'https://media.giphy.com/media/11AuX2bZ1RhzLW/giphy.gif' },
  { name: 'nervous', url: 'https://media.giphy.com/media/bEVKYB487Lqxy/giphy.gif' },
  { name: 'panic', url: 'https://media.giphy.com/media/P0UveJCYp89NK/giphy.gif' },
  { name: 'proud', url: 'https://media.giphy.com/media/5WJf1bLOxC3yE1STR9/giphy.gif' },
  { name: 'sad', url: 'https://media.giphy.com/media/ROF8OQvDmxytW/giphy.gif' },
  { name: 'scared', url: 'https://media.giphy.com/media/3o7TKqnN349PBUtGFO/giphy.gif' },
  { name: 'shock', url: 'https://media.giphy.com/media/6nWhy3ulBL7GSCvKw6/giphy.gif' },
  { name: 'shy', url: 'https://media.giphy.com/media/yl5elDtOmPNDDvQ1Pf/giphy.gif' },
  { name: 'sleepy', url: 'https://media.giphy.com/media/l0MYLraSJ4qyxTqJq/giphy.gif' },
  { name: 'surprised', url: 'https://media.giphy.com/media/3kHz1oN8NfxJJgVgvL/giphy.gif' },
  { name: 'tired', url: 'https://media.giphy.com/media/phJ6eMRFYI6CQ/giphy.gif' },
];

// Define the output directory
const outputDir = path.join(__dirname, 'new_gifs');

// Create directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Download function using promises
function downloadGif(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirect
      if (response.statusCode === 302 || response.statusCode === 301) {
        console.log(`Redirecting to: ${response.headers.location}`);
        return downloadGif(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }
      
      // Check if response is successful
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download: ${url}, Status Code: ${response.statusCode}`));
      }
      
      // Create write stream and save the file
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      // Handle completion and errors
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded: ${path.basename(outputPath)}`);
        resolve(outputPath);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file if there's an error
        reject(err);
      });
      
      response.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file if there's an error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Download all GIFs
async function downloadAllGifs() {
  console.log(`Downloading ${reactions.length} GIFs to: ${outputDir}`);
  
  // Process downloads sequentially to avoid rate limits
  for (const reaction of reactions) {
    const outputPath = path.join(outputDir, `${reaction.name}.gif`);
    try {
      await downloadGif(reaction.url, outputPath);
      
      // Verify file size
      const stats = fs.statSync(outputPath);
      if (stats.size < 5000) {
        console.warn(`Warning: ${reaction.name}.gif is very small (${stats.size} bytes). It might not be a valid GIF.`);
      }
    } catch (error) {
      console.error(`Error downloading ${reaction.name}.gif:`, error.message);
    }
  }
  
  console.log('Download completed!');
}

// Run the download
downloadAllGifs().catch(console.error);