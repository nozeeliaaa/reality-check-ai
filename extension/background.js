// Reality Check AI — background.js
const EC2_URL = "http://52.91.49.146:8000";

// ─── Open onboarding on first install ─────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

// ─── Keep alive ────────────────────────────────────────────────────────────
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "rcai-keepalive") {
    port.onDisconnect.addListener(() => {});
  }
});

// ─── Site domain mapping ───────────────────────────────────────────────────
const SITE_DOMAINS = {
  facebook: ["facebook.com"],
  instagram: ["instagram.com"],
  twitter: ["twitter.com", "x.com"],
  linkedin: ["linkedin.com"],
  reddit: ["reddit.com"],
  tiktok: ["tiktok.com"],
};

async function isApprovedSite(url) {
  if (!url) return false;
  const data = await chrome.storage.local.get([
    "approvedSites",
    "onboardingComplete",
  ]);
  if (!data.onboardingComplete) return false;
  const approved = data.approvedSites || {};
  return Object.entries(SITE_DOMAINS).some(([site, domains]) => {
    return approved[site] && domains.some((domain) => url.includes(domain));
  });
}

// ─── Image processing in OffscreenCanvas ───────────────────────────────────

// Crop screenshot to remove browser chrome
// Removes top ~100px (address bar, tabs) and focuses on content
async function cropToContent(base64Image) {
  const response = await fetch(base64Image);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const fullWidth = bitmap.width;
  const fullHeight = bitmap.height;

  // Crop out browser chrome:
  // Top: skip ~80px for browser toolbar
  // Sides: skip ~10px
  // Bottom: skip ~10px
  const cropTop = 80;
  const cropSide = 10;
  const cropBottom = 10;

  const contentWidth = fullWidth - cropSide * 2;
  const contentHeight = fullHeight - cropTop - cropBottom;

  const canvas = new OffscreenCanvas(contentWidth, contentHeight);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    bitmap,
    cropSide,
    cropTop, // source x, y
    contentWidth,
    contentHeight, // source width, height
    0,
    0, // dest x, y
    contentWidth,
    contentHeight, // dest width, height
  );

  const croppedBlob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.92,
  });
  const buffer = await croppedBlob.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const b64 = btoa(String.fromCharCode(...uint8));

  return {
    base64: "data:image/jpeg;base64," + b64,
    width: contentWidth,
    height: contentHeight,
  };
}

// Find the largest image-like region in the content area
// Uses brightness variance to detect photo regions vs flat UI
async function findBestImageRegion(base64Image, contentWidth, contentHeight) {
  const response = await fetch(base64Image);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  // Divide page into a grid and score each cell by colour variance
  // High variance = likely a photo
  const cols = 3;
  const rows = 6;
  const cellW = Math.floor(contentWidth / cols);
  const cellH = Math.floor(contentHeight / rows);
  const minSize = 120; // minimum region size to consider

  let bestScore = 0;
  let bestRegion = null;

  const scanCanvas = new OffscreenCanvas(cellW, cellH);
  const scanCtx = scanCanvas.getContext("2d");

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW;
      const y = row * cellH;

      if (cellW < minSize || cellH < minSize) continue;

      scanCtx.clearRect(0, 0, cellW, cellH);
      scanCtx.drawImage(bitmap, x, y, cellW, cellH, 0, 0, cellW, cellH);

      const imageData = scanCtx.getImageData(0, 0, cellW, cellH);
      const pixels = imageData.data;

      // Calculate colour variance — high variance = photo content
      let rSum = 0,
        gSum = 0,
        bSum = 0;
      const pixelCount = pixels.length / 4;

      for (let i = 0; i < pixels.length; i += 4) {
        rSum += pixels[i];
        gSum += pixels[i + 1];
        bSum += pixels[i + 2];
      }

      const rMean = rSum / pixelCount;
      const gMean = gSum / pixelCount;
      const bMean = bSum / pixelCount;

      let variance = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        variance += Math.pow(pixels[i] - rMean, 2);
        variance += Math.pow(pixels[i + 1] - gMean, 2);
        variance += Math.pow(pixels[i + 2] - bMean, 2);
      }
      variance /= pixelCount * 3;

      // Also check saturation — UI elements tend to be low saturation
      let satSum = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] / 255;
        const g = pixels[i + 1] / 255;
        const b = pixels[i + 2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        satSum += max === 0 ? 0 : (max - min) / max;
      }
      const avgSat = satSum / pixelCount;

      // Combined score — weight variance more than saturation
      const score = variance * 0.7 + avgSat * 1000 * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestRegion = { x, y, width: cellW, height: cellH };
      }
    }
  }

  // If no good region found return the center of the page
  if (!bestRegion || bestScore < 200) {
    console.log("No clear image region found, using center crop");
    const size = Math.min(contentWidth, contentHeight, 600);
    bestRegion = {
      x: Math.floor((contentWidth - size) / 2),
      y: Math.floor((contentHeight - size) / 4),
      width: size,
      height: size,
    };
  }

  // Extract and resize the best region to 512x512 for API
  const outputSize = 512;
  const outputCanvas = new OffscreenCanvas(outputSize, outputSize);
  const outputCtx = outputCanvas.getContext("2d");

  outputCtx.drawImage(
    bitmap,
    bestRegion.x,
    bestRegion.y,
    bestRegion.width,
    bestRegion.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  const outputBlob = await outputCanvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.92,
  });
  const buffer = await outputBlob.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const b64 = btoa(String.fromCharCode(...uint8));

  console.log(
    `Best region: score=${bestScore.toFixed(0)} x=${bestRegion.x} y=${bestRegion.y}`,
  );

  return "data:image/jpeg;base64," + b64;
}

// ─── Hash comparison ───────────────────────────────────────────────────────
let lastScreenshotHash = null;

async function getImageHash(base64Image) {
  try {
    const response = await fetch(base64Image);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(16, 16);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, 16, 16);
    const imageData = ctx.getImageData(0, 0, 16, 16);
    const pixels = imageData.data;
    const grayscale = [];
    for (let i = 0; i < pixels.length; i += 4) {
      grayscale.push(
        Math.round(
          pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114,
        ),
      );
    }
    const mean = grayscale.reduce((a, b) => a + b, 0) / grayscale.length;
    return grayscale.map((p) => (p >= mean ? "1" : "0")).join("");
  } catch (e) {
    return null;
  }
}

function hammingDistance(h1, h2) {
  let d = 0;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] !== h2[i]) d++;
  }
  return d;
}

// ─── Main scan function ────────────────────────────────────────────────────
async function scanTab(tab) {
  if (!tab?.id || !tab?.url) return;

  const data = await chrome.storage.local.get([
    "scanning",
    "onboardingComplete",
  ]);
  if (!data.scanning || !data.onboardingComplete) {
    console.log("Scanning disabled or onboarding incomplete");
    return;
  }

  const approved = await isApprovedSite(tab.url);
  if (!approved) {
    console.log("Not approved:", tab.url);
    return;
  }

  try {
    // Capture full screenshot
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 85,
    });
    console.log("Screenshot captured");

    // Hash check — skip if content unchanged
    const currentHash = await getImageHash(screenshot);
    if (currentHash && lastScreenshotHash) {
      const distance = hammingDistance(currentHash, lastScreenshotHash);
      const similarity = 1 - distance / currentHash.length;
      if (similarity > 0.92) {
        console.log("Skipping — content unchanged");
        return;
      }
    }
    lastScreenshotHash = currentHash;

    // Step 1 — crop out browser chrome
    const {
      base64: croppedImage,
      width,
      height,
    } = await cropToContent(screenshot);
    console.log(`Cropped content area: ${width}x${height}`);

    // Step 2 — find best image region within content
    const regionImage = await findBestImageRegion(croppedImage, width, height);
    console.log("Image region extracted");

    // Step 3 — send to EC2
    console.log("Calling EC2...");
    const response = await fetch(`${EC2_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: regionImage,
        tab_url: tab.url,
      }),
    });

    if (!response.ok) {
      console.log("Backend error:", response.status);
      return;
    }

    const result = await response.json();
    console.log("Result:", result.confidence_level, result.ai_probability);

    // Send to content.js
    try {
      chrome.tabs.sendMessage(tab.id, {
        type: "SCAN_RESULT",
        data: result,
      });
    } catch (e) {
      console.log("Could not message tab");
    }

    // Save to history
    chrome.storage.local.get(["history"], (stored) => {
      const history = stored.history || [];
      history.unshift({
        timestamp: new Date().toISOString(),
        url: tab.url,
        probability: result.ai_probability,
        confidence_level: result.confidence_level,
        explanation: result.explanation,
      });
      chrome.storage.local.set({ history: history.slice(0, 200) });
    });
  } catch (err) {
    console.log("Scan error:", err.message);
  }
}

// ─── Message listener ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (
    ["SCROLL_SETTLED", "PAGE_LOADED", "NEW_CONTENT_LOADED"].includes(msg.type)
  ) {
    console.log("Received:", msg.type, "from:", sender.tab?.url);
    if (sender.tab) {
      scanTab(sender.tab);
    }
  }
});
