// Reality Check AI — content.js
(function () {
  if (document.getElementById('rcai-badge')) return;

  // ─── Keep background service worker alive ─────────────────────────────
  let port;
  function connectPort() {
    port = chrome.runtime.connect({ name: 'rcai-keepalive' });
    port.onDisconnect.addListener(() => setTimeout(connectPort, 1000));
  }
  connectPort();

  // ─── Build badge DOM ───────────────────────────────────────────────────
  const badge = document.createElement('div');
  badge.id = 'rcai-badge';
  badge.innerHTML = `
    <div class="rcai-icon-zone">
      <span class="rcai-icon-symbol">◎</span>
    </div>
    <div class="rcai-body">
      <div class="rcai-top-row">
        <span class="rcai-brand">Reality Check AI</span>
        <button class="rcai-close" title="Dismiss">✕</button>
      </div>
      <div class="rcai-verdict">Scanning…</div>
      <div class="rcai-meter-row">
        <div class="rcai-bar-track"><div class="rcai-bar-fill"></div></div>
        <span class="rcai-percent">–</span>
      </div>
      <p class="rcai-explanation">Waiting for first scan result.</p>
    </div>
  `;
  document.body.appendChild(badge);

  badge.querySelector('.rcai-close').addEventListener('click', () => {
    badge.style.display = 'none';
  });

  // ─── Level config ──────────────────────────────────────────────────────
  const LEVEL_CONFIG = {
    High:     { symbol: '⚠',  verdict: 'AI Generated' },
    Moderate: { symbol: '?',  verdict: 'Possibly AI'  },
    Low:      { symbol: '✓',  verdict: 'Authentic'    },
  };

  // ─── Count-up animation for the score number ───────────────────────────
  function animateCount(el, target, duration) {
    const start     = parseInt(el.textContent) || 0;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (target - start) * eased) + '%';
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ─── Trigger CSS pop animations on verdict + score ─────────────────────
  function popElement(el) {
    el.classList.remove('rcai-updated');
    void el.offsetWidth;
    el.classList.add('rcai-updated');
    el.addEventListener('animationend', () => el.classList.remove('rcai-updated'), { once: true });
  }

  // ─── Update badge with scan result ─────────────────────────────────────
  const percentEl = badge.querySelector('.rcai-percent');
  const verdictEl = badge.querySelector('.rcai-verdict');

  function updateBadge({ ai_probability, confidence_level, explanation }) {
    const pct = Math.round(ai_probability * 100);
    const cfg = LEVEL_CONFIG[confidence_level] || { symbol: '◎', verdict: confidence_level };

    badge.dataset.level = confidence_level;
    badge.querySelector('.rcai-icon-symbol').textContent  = cfg.symbol;
    verdictEl.textContent                                 = cfg.verdict;
    badge.querySelector('.rcai-bar-fill').style.width     = `${pct}%`;
    badge.querySelector('.rcai-explanation').textContent  = explanation;
    badge.style.display = '';

    animateCount(percentEl, pct, 700);
    popElement(verdictEl);
    popElement(percentEl);

    if (confidence_level === 'Low') {
      badge.classList.remove('rcai-badge-flash');
      void badge.offsetWidth;
      badge.classList.add('rcai-badge-flash');
      badge.addEventListener('animationend', () => badge.classList.remove('rcai-badge-flash'), { once: true });
    }
  }

  // ─── Listen for messages from background.js ────────────────────────────
  // CHANGED: type is now SCAN_RESULT, data is in msg.data
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SCAN_RESULT') updateBadge(msg.data);
  });

  // ─── Restore last result on page load ──────────────────────────────────
  // CHANGED: reads from history array instead of latestScan
  chrome.storage.local.get('history', ({ history }) => {
    if (history && history.length > 0) updateBadge(history[0]);
  });

})();