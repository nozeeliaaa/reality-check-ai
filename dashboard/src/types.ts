export interface ScanRecord {
  timestamp: string
  url: string
  probability: number
  confidence_level: 'High' | 'Moderate' | 'Low'
  explanation: string
  screenshot?: string  // base64 data URL from chrome.tabs.captureVisibleTab
}

export type FilterOption = 'all' | 'high' | 'moderate' | 'low'

export type Platform =
  | 'Instagram'
  | 'X / Twitter'
  | 'LinkedIn'
  | 'Facebook'
  | 'Reddit'
  | 'TikTok'
  | 'Unknown'
