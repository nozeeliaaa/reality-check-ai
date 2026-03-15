// Reality Check AI — content.js
(function () {
  if (document.getElementById('rcai-badge')) return;

  // ─── Keep background service worker alive ─────────────────────────────
  let port;
  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: 'rcai-keepalive' });
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) return;
        setTimeout(connectPort, 1000);
      });
    } catch (e) {
      // Extension context invalidated
    }
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

  // ─── Safe body injection ───────────────────────────────────────────────
  function injectBadge() {
    if (document.body) {
      document.body.appendChild(badge);
    } else {
      setTimeout(injectBadge, 100);
    }
  }
  injectBadge();

  badge.querySelector('.rcai-close').addEventListener('click', () => {
    badge.style.display = 'none';
  });

  // ─── Level config ──────────────────────────────────────────────────────
  const LEVEL_CONFIG = {
    High:     { symbol: '⚠',  verdict: 'AI Generated' },
    Moderate: { symbol: '?',  verdict: 'Possibly AI'  },
    Low:      { symbol: '✓',  verdict: 'Authentic'    },
  };

  // ─── Count-up animation ────────────────────────────────────────────────
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

  // ─── Pop animations ────────────────────────────────────────────────────
  function popElement(el) {
    el.classList.remove('rcai-updated');
    void el.offsetWidth;
    el.classList.add('rcai-updated');
    el.addEventListener('animationend', () => el.classList.remove('rcai-updated'), { once: true });
  }

  // ─── Update badge ──────────────────────────────────────────────────────
  const percentEl = badge.querySelector('.rcai-percent');
  const verdictEl = badge.querySelector('.rcai-verdict');

  function updateBadge({ ai_probability, confidence_level, explanation }) {
    if (ai_probability === undefined || ai_probability === null) return;
    const pct = Math.round(ai_probability * 100);
    const cfg = LEVEL_CONFIG[confidence_level] || { symbol: '◎', verdict: confidence_level };

    badge.dataset.level = confidence_level;
    badge.querySelector('.rcai-icon-symbol').textContent = cfg.symbol;
    verdictEl.textContent                                = cfg.verdict;
    badge.querySelector('.rcai-bar-fill').style.width    = `${pct}%`;
    badge.querySelector('.rcai-explanation').textContent = explanation || '';
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

  // ─── Listen for messages ───────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SCAN_RESULT') updateBadge(msg.data);
  });

  // ─── Restore last result on page load ─────────────────────────────────
  chrome.storage.local.get('history', ({ history }) => {
    if (history && history.length > 0) updateBadge(history[0]);
  });

  // ─── Scroll detection ──────────────────────────────────────────────────
  let scrollTimer = null;
  let lastScanScrollY = -999;
  const SCROLL_THRESHOLD = 150;
  const SCROLL_SETTLE_DELAY = 600;

  window.addEventListener('scroll', () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const distance = Math.abs(window.scrollY - lastScanScrollY);
      if (distance >= SCROLL_THRESHOLD) {
        lastScanScrollY = window.scrollY;
        try {
          chrome.runtime.sendMessage({ type: 'SCROLL_SETTLED' });
        } catch (e) {}
      }
    }, SCROLL_SETTLE_DELAY);
  }, { passive: true });

  // ─── Initial page load scan ────────────────────────────────────────────
  setTimeout(() => {
    lastScanScrollY = window.scrollY;
    try {
      chrome.runtime.sendMessage({ type: 'PAGE_LOADED' });
    } catch (e) {}
  }, 1500);

  // ─── New content loaded via infinite scroll ────────────────────────────
  const observer = new MutationObserver((mutations) => {
    const hasNewImages = mutations.some(m =>
      Array.from(m.addedNodes).some(node =>
        node.nodeName === 'IMG' ||
        (node.querySelectorAll && node.querySelectorAll('img').length > 0)
      )
    );
    if (hasNewImages) {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        try {
          chrome.runtime.sendMessage({ type: 'NEW_CONTENT_LOADED' });
        } catch (e) {}
      }, 800);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
