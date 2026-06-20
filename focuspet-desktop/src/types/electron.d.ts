export interface ForegroundAppInfo {
  app: string
  title: string
  pid: number
  path: string
  url?: string
  domain?: string
  context?: {
    kind: 'browser' | 'editor' | 'ai' | 'terminal' | 'dev-server' | 'generic'
    active: boolean
    summary: string
  }
  platform: string
  timestamp: number
}

export interface ElectronAPI {
  collapseWindow: () => void
  expandWindow: () => void
  resetWindowPosition: () => Promise<boolean>
  setIgnoreMouseEvents: (ignore: boolean) => void
  moveWindowStart: () => void
  startWindowDrag: (point: { screenX: number; screenY: number }) => void
  moveWindowDrag: (point: { screenX: number; screenY: number }) => void
  endWindowDrag: () => void
  getUserDataPath: () => Promise<string>
  getDiagnostics: () => Promise<unknown>
  copyDiagnostics: () => Promise<boolean>
  loadAppState: () => Promise<unknown>
  saveAppState: (state: unknown) => Promise<boolean>
  loadAppMonitorState: () => Promise<unknown>
  saveAppMonitorState: (state: unknown) => Promise<boolean>
  breakDownTaskWithAI: (task: {
    name: string
    priority: 'high' | 'medium' | 'low'
    estimatedPomos: number
    startAt?: number
    endAt?: number
  }) => Promise<{ ok: boolean; tasks?: string[]; error?: string }>
  reviewAppWithAI: (payload: {
    taskName?: string
    app: string
    title: string
    domain?: string
    url?: string
    contextKind?: string
  }) => Promise<{ ok: boolean; rule?: 'allow' | 'block' | 'neutral'; reason?: string; error?: string }>
  openExternal: (url: string) => void
  setAlwaysOnTop: (flag: boolean) => void
  platform: string
  onAction: (callback: (action: string) => void) => void
  onPanelAnchor: (callback: (anchor: 'left' | 'right') => void) => void
  onTimerTick: (callback: (remaining: number) => void) => void
  onTimerComplete: (callback: () => void) => void
  onForegroundApp: (callback: (info: ForegroundAppInfo) => void) => void
  onSystemIdle: (callback: (info: { seconds: number; timestamp: number }) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
