// Reality Check AI — background.js
const EC2_URL = "http://52.91.49.146:8000";

// ─── In-memory scanning flag — updated immediately on storage change ──────
// Avoids the async storage read race that let captures slip through.
let scanningEnabled = false; // start false until we confirm state from storage

chrome.storage.local.get(["scanning", "onboardingComplete"], (data) => {
  scanningEnabled = data.onboardingComplete === true && data.scanning !== false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.scanning || changes.onboardingComplete) {
    chrome.storage.local.get(["scanning", "onboardingComplete"], (data) => {
      scanningEnabled = data.onboardingComplete === true && data.scanning !== false;
      console.log("Scanning state updated:", scanningEnabled);
    });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "rcai-keepalive") {
    port.onDisconnect.addListener(() => {});
  }
});

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

async function scanTab(tab) {
  if (!tab?.id || !tab?.url) return;

  // Synchronous in-memory check — blocks capture immediately if paused
  if (!scanningEnabled) {
    console.log("Scanning paused — skipping");
    return;
  }

  const approved = await isApprovedSite(tab.url);
  if (!approved) {
    console.log("Not approved:", tab.url);
    return;
  }

  try {
    // Use sender tab's windowId directly — this is the active tab
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 70,
    });
    console.log("Screenshot captured");

    const currentHash = await getImageHash(screenshot);
    if (currentHash && lastScreenshotHash) {
      const distance = hammingDistance(currentHash, lastScreenshotHash);
      const similarity = 1 - distance / currentHash.length;
      if (similarity > 0.92) {
        console.log("Skipping — unchanged");
        return;
      }
    }
    lastScreenshotHash = currentHash;

    console.log("Calling EC2...");
    const response = await fetch(`${EC2_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: screenshot, tab_url: tab.url }),
    });

    if (!response.ok) {
      console.log("Backend error:", response.status);
      return;
    }

    const result = await response.json();
    console.log("Result:", result.confidence_level, result.ai_probability);

    try {
      chrome.tabs.sendMessage(tab.id, { type: "SCAN_RESULT", data: result });
    } catch (e) {
      console.log("Could not message tab");
    }

    chrome.storage.local.get(["history"], (stored) => {
      const history = stored.history || [];
      history.unshift({
        timestamp: new Date().toISOString(),
        url: tab.url,
        probability: result.ai_probability,
        confidence_level: result.confidence_level,
        explanation: result.explanation,
        screenshot: screenshot,
      });
      chrome.storage.local.set({ history: history.slice(0, 200) });
    });
  } catch (err) {
    console.log("Scan error:", err.message);
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (
    ["SCROLL_SETTLED", "PAGE_LOADED", "NEW_CONTENT_LOADED"].includes(msg.type)
  ) {
    if (!scanningEnabled) return; // blocked synchronously — no capture at all
    console.log("Received:", msg.type, "from:", sender.tab?.url);
    if (sender.tab) {
      scanTab(sender.tab);
    }
  }
});
