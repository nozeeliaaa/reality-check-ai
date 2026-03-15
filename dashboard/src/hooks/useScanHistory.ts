import { useState, useEffect } from 'react'
import type { ScanRecord } from '../types'

export function useScanHistory() {
  const [history, setHistory] = useState<ScanRecord[]>([])

  useEffect(() => {
    // Load initial history from chrome.storage.local
    chrome.storage.local.get('history', (items) => {
      const stored = items['history'] as ScanRecord[] | undefined
      setHistory(stored ?? [])
    })

    // Subscribe to live updates so the dashboard reflects new scans immediately
    const handleChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local' && changes['history']) {
        const updated = changes['history'].newValue as ScanRecord[] | undefined
        setHistory(updated ?? [])
      }
    }

    chrome.storage.onChanged.addListener(handleChange)
    return () => chrome.storage.onChanged.removeListener(handleChange)
  }, [])

  const clearHistory = () => {
    chrome.storage.local.set({ history: [] })
    setHistory([])
  }

  return { history, clearHistory }
}
