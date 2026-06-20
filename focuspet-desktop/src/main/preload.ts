import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  // 窗口控制
  collapseWindow: () => ipcRenderer.send('window-collapse'),
  expandWindow: () => ipcRenderer.send('window-expand'),
  resetWindowPosition: () => ipcRenderer.invoke('window-reset-position'),
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore),
  moveWindowStart: () => ipcRenderer.send('window-move-start'),
  startWindowDrag: (point: { screenX: number; screenY: number }) =>
    ipcRenderer.send('window-drag-start', point),
  moveWindowDrag: (point: { screenX: number; screenY: number }) =>
    ipcRenderer.send('window-drag-move', point),
  endWindowDrag: () => ipcRenderer.send('window-drag-end'),

  // 数据
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics-get'),
  copyDiagnostics: () => ipcRenderer.invoke('diagnostics-copy'),
  loadAppState: () => ipcRenderer.invoke('app-load-state'),
  saveAppState: (state: unknown) => ipcRenderer.invoke('app-save-state', state),
  loadAppMonitorState: () => ipcRenderer.invoke('app-monitor-load-state'),
  saveAppMonitorState: (state: unknown) => ipcRenderer.invoke('app-monitor-save-state', state),
  breakDownTaskWithAI: (task: {
    name: string
    priority: 'high' | 'medium' | 'low'
    estimatedPomos: number
    startAt?: number
    endAt?: number
  }) => ipcRenderer.invoke('task-ai-breakdown', task),
  reviewAppWithAI: (payload: {
    taskName?: string
    app: string
    title: string
    domain?: string
    url?: string
    contextKind?: string
  }) => ipcRenderer.invoke('app-ai-review', payload),

  // 系统
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.send('set-always-on-top', flag),
  platform: process.platform as string,

  // 主进程 → 渲染进程 消息
  onAction: (callback: (action: string) => void) => {
    ipcRenderer.on('action', (_, action) => callback(action))
  },
  onPanelAnchor: (callback: (anchor: 'left' | 'right') => void) => {
    ipcRenderer.on('panel-anchor', (_, anchor) => callback(anchor))
  },
  onTimerTick: (callback: (remaining: number) => void) => {
    ipcRenderer.on('timer-tick', (_, remaining) => callback(remaining))
  },
  onTimerComplete: (callback: () => void) => {
    ipcRenderer.on('timer-complete', () => callback())
  },
  onForegroundApp: (callback: (info: {
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
  }) => void) => {
    ipcRenderer.on('foreground-app', (_, info) => callback(info))
  },
  onSystemIdle: (callback: (info: { seconds: number; timestamp: number }) => void) => {
    ipcRenderer.on('system-idle', (_, info) => callback(info))
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
