// Reality Check AI — popup.js

function levelClass(level) {
  return (level || '').toLowerCase();
}

async function loadStats() {
  const { history = [] } = await chrome.storage.local.get(['history']);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = history.filter(s => new Date(s.timestamp) >= todayStart);

  document.getElementById('countTotal').textContent    = today.length;
  document.getElementById('countHigh').textContent     = today.filter(s => s.confidence_level === 'High').length;
  document.getElementById('countModerate').textContent = today.filter(s => s.confidence_level === 'Moderate').length;
  document.getElementById('countLow').textContent      = today.filter(s => s.confidence_level === 'Low').length;

  const latestScan = history[0];

  if (latestScan) {
    document.getElementById('noData').style.display = 'none';
    document.getElementById('scanData').style.display = '';

    const pct = Math.round(latestScan.probability * 100);
    const cls = levelClass(latestScan.confidence_level);

    const scoreBig = document.getElementById('scoreBig');
    scoreBig.textContent = `${pct}%`;
    scoreBig.className = `score-big ${cls}`;

    const badge = document.getElementById('confidenceBadge');
    badge.textContent = latestScan.confidence_level.toUpperCase();
    badge.className = `confidence-badge ${cls}`;

    document.getElementById('explanation').textContent = latestScan.explanation;

    const dot = document.getElementById('statusDot');
    dot.style.background = cls === 'high' ? '#FF2D55' : cls === 'moderate' ? '#FFB800' : '#00E5A0';
  }
}

// ── Toggle scanning ────────────────────────────────────────────────────────
let isScanning = true;

async function loadToggleState() {
  const { scanning } = await chrome.storage.local.get(['scanning']);
  isScanning = scanning !== false;
  updateToggleBtn();
}

function updateToggleBtn() {
  const btn = document.getElementById('toggleBtn');
  btn.textContent = isScanning ? 'Pause' : 'Resume';
  btn.className   = isScanning ? 'btn btn-secondary' : 'btn btn-secondary paused';
}

document.getElementById('toggleBtn').addEventListener('click', async () => {
  isScanning = !isScanning;
  await chrome.storage.local.set({ scanning: isScanning });
  updateToggleBtn();
});

// ── Open dashboard ─────────────────────────────────────────────────────────
document.getElementById('dashboardBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
});

// ── Test overlay ───────────────────────────────────────────────────────────
const TEST_DATA = {
  High:     { ai_probability: 0.91, confidence_level: 'High',     explanation: 'Strong AI indicators. Synthetic facial patterns and uniform skin texture detected.' },
  Moderate: { ai_probability: 0.55, confidence_level: 'Moderate', explanation: 'Some AI artifacts present but not conclusive. Lighting inconsistencies noted.' },
  Low:      { ai_probability: 0.07, confidence_level: 'Low',      explanation: 'No significant AI artifacts detected. Consistent with real photography.' },
};

document.querySelectorAll('.btn-test').forEach(btn => {
  btn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const data = TEST_DATA[btn.dataset.level];

    // Capture screenshot of the current tab before showing the overlay
    let screenshot;
    try {
      screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 65 });
    } catch (e) {
      console.log('Screenshot capture failed:', e.message);
    }

    // Push a real history record so dashboard + stats reflect this test
    const { history = [] } = await chrome.storage.local.get(['history']);
    history.unshift({
      timestamp: new Date().toISOString(),
      url: tab.url,
      probability: data.ai_probability,
      confidence_level: data.confidence_level,
      explanation: data.explanation,
      screenshot: screenshot,
    });
    await chrome.storage.local.set({ history: history.slice(0, 200) });

    // Show result on the in-page overlay badge
    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_RESULT', data });

    // Refresh popup stats immediately
    loadStats();
  });
});

// ── Live updates — re-render whenever history changes ──────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.history) loadStats();
});

// ── Init ───────────────────────────────────────────────────────────────────
loadStats();
loadToggleState();