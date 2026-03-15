import { useState, useMemo } from 'react'
import { useScanHistory } from './hooks/useScanHistory'
import type { ScanRecord, FilterOption, Platform } from './types'
import './App.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<FilterOption, string> = {
  all: 'All Scans',
  high: 'High Risk',
  moderate: 'Moderate',
  low: 'Cleared',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getPlatform(url: string): Platform {
  if (url.includes('instagram.com')) return 'Instagram'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'X / Twitter'
  if (url.includes('linkedin.com')) return 'LinkedIn'
  if (url.includes('facebook.com')) return 'Facebook'
  if (url.includes('reddit.com')) return 'Reddit'
  if (url.includes('tiktok.com')) return 'TikTok'
  return 'Unknown'
}

function getConfidenceColor(level: ScanRecord['confidence_level']): string {
  switch (level) {
    case 'High':     return '#FF2D55'
    case 'Moderate': return '#FFB800'
    case 'Low':      return '#00E5A0'
  }
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.length > 44 ? u.pathname.slice(0, 44) + '…' : u.pathname
    return u.hostname + path
  } catch {
    return url.slice(0, 60)
  }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  history,
  activeFilter,
  onFilterChange,
  onClear,
  isScanning,
  onToggleScanning,
}: {
  history: ScanRecord[]
  activeFilter: FilterOption
  onFilterChange: (f: FilterOption) => void
  onClear: () => void
  isScanning: boolean
  onToggleScanning: () => void
}) {
  const high     = history.filter(r => r.confidence_level === 'High').length
  const moderate = history.filter(r => r.confidence_level === 'Moderate').length
  const low      = history.filter(r => r.confidence_level === 'Low').length

  const platformCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of history) {
      const p = getPlatform(r.url)
      map[p] = (map[p] ?? 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [history])

  const maxCount = platformCounts[0]?.[1] ?? 1

  const views: FilterOption[] = ['all', 'high', 'moderate', 'low']
  const navColors: Record<FilterOption, string> = {
    all: '#00D4FF', high: '#FF2D55', moderate: '#FFB800', low: '#00E5A0',
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="11.5" stroke="#00D4FF" strokeWidth="1" strokeOpacity="0.4" />
            <circle cx="13" cy="13" r="7" stroke="#00D4FF" strokeWidth="1" strokeOpacity="0.7" />
            <circle cx="13" cy="13" r="2.5" fill="#00D4FF" />
            <circle cx="13" cy="13" r="2.5" fill="#00D4FF" fillOpacity="0.5">
              <animate attributeName="r" values="2.5;5;2.5" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="fill-opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
        <div>
          <div className="sidebar-logo-text">
            Reality Check <span className="logo-ai">AI</span>
          </div>
          <div className="sidebar-logo-sub">Detection Dashboard</div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="sidebar-stats">
        <div className="sidebar-stat">
          <span className="sidebar-stat-value">{history.length}</span>
          <span className="sidebar-stat-label">Total Scans</span>
        </div>
        <div className="sidebar-stat sidebar-stat-high">
          <span className="sidebar-stat-value">{high}</span>
          <span className="sidebar-stat-label">High Risk</span>
        </div>
        <div className="sidebar-stat sidebar-stat-moderate">
          <span className="sidebar-stat-value">{moderate}</span>
          <span className="sidebar-stat-label">Moderate</span>
        </div>
        <div className="sidebar-stat sidebar-stat-low">
          <span className="sidebar-stat-value">{low}</span>
          <span className="sidebar-stat-label">Cleared</span>
        </div>
      </div>

      {/* Views */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Views</div>
        <nav className="sidebar-nav">
          {views.map(f => (
            <button
              key={f}
              className={`sidebar-nav-item${activeFilter === f ? ' active' : ''}`}
              onClick={() => onFilterChange(f)}
              style={activeFilter === f ? { '--nav-color': navColors[f] } as React.CSSProperties : undefined}
            >
              <span className="sidebar-nav-dot" style={{ background: navColors[f] }} />
              {FILTER_LABELS[f]}
            </button>
          ))}
        </nav>
      </div>

      {/* Actions */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Actions</div>
        <div className="sidebar-actions">
          <button className="sidebar-action sidebar-action-danger" onClick={onClear}>
            <span className="action-icon">✕</span>Clear History
          </button>
        </div>
      </div>

      {/* Platform breakdown */}
      {platformCounts.length > 0 && (
        <div className="sidebar-section sidebar-section-grow">
          <div className="sidebar-section-label">Platform Breakdown</div>
          <div className="platform-list">
            {platformCounts.map(([name, count]) => (
              <div key={name} className="platform-row">
                <span className="platform-name">{name}</span>
                <div className="platform-bar-wrap">
                  <div className="platform-bar" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="platform-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          className={`scanning-status${isScanning ? ' active' : ' paused'}`}
          onClick={onToggleScanning}
        >
          <span className="scanning-dot" />
          <span>{isScanning ? 'Scanning Active' : 'Scanning Paused'}</span>
        </button>
      </div>
    </aside>
  )
}

// ─── Scan Card ────────────────────────────────────────────────────────────────

function ScanCard({
  record,
  index,
  onClick,
}: {
  record: ScanRecord
  index: number
  onClick: () => void
}) {
  const color    = getConfidenceColor(record.confidence_level)
  const platform = getPlatform(record.url)
  const pct      = Math.round(record.probability * 100)

  return (
    <div
      className="scan-card"
      style={{ '--card-color': color, animationDelay: `${index * 50}ms` } as React.CSSProperties}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Corner tint */}
      <div className="scan-card-tint" />

      {/* Score */}
      <div className="scan-card-score" style={{ color }}>
        {pct}<span className="scan-card-pct">%</span>
      </div>

      {/* Body */}
      <div className="scan-card-body">
        <div className="scan-card-url">{formatUrl(record.url)}</div>
        <div className="scan-card-explanation">{record.explanation}</div>
        <div
          className="scan-card-badge"
          style={{ color, borderColor: `${color}45`, background: `${color}12` }}
        >
          {record.confidence_level.toUpperCase()}
        </div>
      </div>

      {/* Meta */}
      <div className="scan-card-meta">
        <span className="scan-card-platform">{platform}</span>
        <span className="scan-card-time">{timeAgo(record.timestamp)}</span>
      </div>

      {/* Screenshot thumbnail */}
      {record.screenshot ? (
        <div className="scan-card-thumb" style={{ borderColor: `${color}60` }}>
          <img src={record.screenshot} alt="Page capture" />
          <div
            className="scan-card-thumb-overlay"
            style={{ background: `linear-gradient(to bottom, transparent 50%, ${color}18 100%)` }}
          />
          <div className="scan-card-thumb-badge" style={{ color, borderColor: `${color}50`, background: `${color}18` }}>
            {pct}%
          </div>
        </div>
      ) : (
        <div className="scan-card-thumb scan-card-thumb-empty" style={{ borderColor: `${color}25` }}>
          <div className="scan-card-thumb-placeholder">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="3" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.3"/>
              <path d="M2 8h16" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.2"/>
              <circle cx="10" cy="12.5" r="1.5" fill="currentColor" fillOpacity="0.2"/>
            </svg>
            <span>No capture</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  record,
  onClose,
}: {
  record: ScanRecord
  onClose: () => void
}) {
  const color    = getConfidenceColor(record.confidence_level)
  const pct      = Math.round(record.probability * 100)
  const platform = getPlatform(record.url)

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <button className="detail-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Screenshot hero */}
        {record.screenshot ? (
          <div className="detail-hero">
            <img src={record.screenshot} alt="Page capture" className="detail-hero-img" />
            <div className="detail-hero-scan" style={{ '--color': color } as React.CSSProperties} />
            <div className="detail-hero-fade" />
            <div className="detail-hero-url">{formatUrl(record.url)}</div>
          </div>
        ) : (
          <div className="detail-hero detail-hero-empty">
            <div className="detail-hero-no-capture">No screenshot captured</div>
          </div>
        )}

        {/* Score */}
        <div className="detail-score-wrap">
          <span className="detail-score" style={{ color }}>{pct}</span>
          <span className="detail-score-unit" style={{ color }}>%</span>
        </div>

        {/* Bar */}
        <div className="detail-bar-track">
          <div
            className="detail-bar-fill"
            style={{ width: `${pct}%`, background: color, boxShadow: `0 0 16px ${color}70` }}
          />
        </div>

        {/* Badge */}
        <div
          className="detail-badge"
          style={{ color, borderColor: `${color}45`, background: `${color}12` }}
        >
          {record.confidence_level.toUpperCase()} CONFIDENCE
        </div>

        <div className="detail-divider" />

        <div className="detail-section">
          <span className="detail-label">Explanation</span>
          <p className="detail-text">{record.explanation}</p>
        </div>

        <div className="detail-divider" />

        <div className="detail-meta">
          <div className="detail-meta-row">
            <span className="detail-label">Platform</span>
            <span className="detail-value">{platform}</span>
          </div>
          <div className="detail-meta-row">
            <span className="detail-label">Timestamp</span>
            <span className="detail-value">{new Date(record.timestamp).toLocaleString()}</span>
          </div>
          <div className="detail-meta-row">
            <span className="detail-label">Raw Score</span>
            <span className="detail-value" style={{ color }}>{record.probability.toFixed(4)}</span>
          </div>
        </div>

        <div className="detail-divider" />

        <div className="detail-section">
          <span className="detail-label">Source URL</span>
          <a className="detail-url" href={record.url} target="_blank" rel="noreferrer">
            {record.url}
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { history, clearHistory } = useScanHistory()
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all')
  const [searchQuery, setSearchQuery]   = useState('')
  const [selected, setSelected]         = useState<ScanRecord | null>(null)
  const [isScanning, setIsScanning]     = useState(true)

  const filtered = useMemo(() => {
    return history.filter(r => {
      if (activeFilter !== 'all' && r.confidence_level.toLowerCase() !== activeFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return r.url.toLowerCase().includes(q) || r.explanation.toLowerCase().includes(q)
      }
      return true
    })
  }, [history, activeFilter, searchQuery])

  const filterCounts = useMemo(() => ({
    all:      history.length,
    high:     history.filter(r => r.confidence_level === 'High').length,
    moderate: history.filter(r => r.confidence_level === 'Moderate').length,
    low:      history.filter(r => r.confidence_level === 'Low').length,
  }), [history])

  function handleToggleScanning() {
    const next = !isScanning
    setIsScanning(next)
    chrome.storage.local.set({ scanning_paused: !next })
  }

  return (
    <div className="app">
      <Sidebar
        history={history}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onClear={clearHistory}
        isScanning={isScanning}
        onToggleScanning={handleToggleScanning}
      />

      <div className="main">
        {/* Top bar */}
        <div className="main-header">
          <h1 className="main-title">
            Scan <span className="main-title-accent">History</span>
          </h1>
          <div className="main-header-right">
            <div className={`scan-status-pill${isScanning ? ' active' : ''}`}>
              <span className="scan-status-dot" />
              {isScanning ? 'Scanning active' : 'Scanning paused'}
            </div>
            <button
              className={`pause-btn${isScanning ? '' : ' resume'}`}
              onClick={handleToggleScanning}
            >
              {isScanning ? '⏸ Pause Scanning' : '▶ Resume Scanning'}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="filter-bar">
          <div className="filter-tabs">
            {(['all', 'high', 'moderate', 'low'] as FilterOption[]).map(f => (
              <button
                key={f}
                className={`filter-tab filter-tab-${f}${activeFilter === f ? ' active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                <span className={`filter-dot filter-dot-${f}`} />
                {f === 'all' ? 'All' : f === 'low' ? 'Cleared' : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="filter-count">{filterCounts[f]}</span>
              </button>
            ))}
          </div>
          <input
            className="search-input"
            type="text"
            placeholder="⌕  Search URL or explanation…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Results bar */}
        <div className="results-bar">
          <span className="results-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          <span className="results-sort">Most recent first</span>
        </div>

        {/* Feed */}
        <main className="feed">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <p className="empty-title">No scans yet</p>
              <p className="empty-sub">
                Browse social media with Reality Check AI enabled,<br />
                or use Load Demo Data to preview the dashboard.
              </p>
            </div>
          ) : (
            filtered.map((record, i) => (
              <ScanCard
                key={`${record.timestamp}-${i}`}
                record={record}
                index={i}
                onClick={() => setSelected(record)}
              />
            ))
          )}
        </main>
      </div>

      {selected && (
        <DetailPanel record={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
