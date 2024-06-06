const express = require('express');
const { chromium } = require('playwright');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const framesFolder = path.join(__dirname, 'frames');
const ffmpegPath = path.join(__dirname, 'ffmpeg.exe');

async function captureFrames() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Load the animation.html file
  const htmlFilePath = path.join(__dirname, 'animation.html');
  await page.goto(`file://${htmlFilePath}`);

  // Wait for the .container element to be present on the page
  await page.waitForSelector('.container');

  // Get the dimensions of the .container element
  const containerDimensions = await page.evaluate(() => {
    const container = document.querySelector('.container');
    const styles = window.getComputedStyle(container);
    return {
      width: parseInt(styles.width),
      height: parseInt(styles.height)
    };
  });

  // Ensure the frames folder exists
  await fs.mkdir(framesFolder, { recursive: true });

  for (let i = 0; i < 100; i++) {
    const framePath = path.join(framesFolder, `frame_${i}.png`);
    // Capture a screenshot of the .container element with its dynamic dimensions
    await page.screenshot({ path: framePath, clip: { x: 0, y: 0, width: containerDimensions.width, height: containerDimensions.height } });
    console.log(`Frame captured: ${framePath}`);
    await page.waitForTimeout(50);
  }

  await browser.close();
}

async function compileFramesToVideo() {
  return new Promise((resolve, reject) => {
    const outputVideoPath = path.join(__dirname, 'output.mp4');

    // Execute ffmpeg command to compile images into a video
    const command = `"${ffmpegPath}" -framerate 30 -i "${framesFolder}/frame_%d.png" -c:v libx264 -pix_fmt yuv420p "${outputVideoPath}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error compiling frames to video:', error);
        reject(error);
      } else {
        console.log('Video compilation successful:', stdout);
        resolve(outputVideoPath);
      }
    });
  });
}

app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>CSS Animation Frames Capture App</title>
  </head>
  <body>
    <h1>Welcome to the CSS=&gt;Video app!</h1>
    <p>
      <a href="https://localhost${PORT}/create">Click here to run conversion...</a>
    </p>
  </body>
  </html>`);
});

app.get('/capture', async (req, res) => {
  try {
    await captureFrames();
    const videoPath = await compileFramesToVideo();
    res.send(`Video compilation successful. You can download the video from <a href="${videoPath}">${videoPath}</a>`);
  } catch (error) {
    console.error('Error capturing frames:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
