import {
  app, BrowserWindow, ipcMain, screen, Tray, Menu,
  globalShortcut, shell, nativeImage, clipboard, powerMonitor,
} from 'electron'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { startAppMonitor } = require('./appMonitor.cjs') as {
  startAppMonitor: (getWindow: () => BrowserWindow | null, intervalMs?: number) => () => void
}

// ==================== 常量 ====================
const WINDOW_WIDTH = 700
const WINDOW_HEIGHT = 500
const COLLAPSED_WIDTH = 216 // 收起后只显示桌宠
const COLLAPSED_HEIGHT = 232

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuiting = false
let stopAppMonitor: (() => void) | null = null
let idleMonitorTimer: ReturnType<typeof setInterval> | null = null
let windowDrag:
  | { offsetX: number; offsetY: number; width: number; height: number }
  | null = null
let windowDragTimer: ReturnType<typeof setInterval> | null = null
let panelOpen = false

interface WindowState {
  x: number
  y: number
}

type PanelAnchor = 'left' | 'right'

function appMonitorStatePath(): string {
  return path.join(app.getPath('userData'), 'focuspet-app-monitor.json')
}

function appStatePath(): string {
  return path.join(app.getPath('userData'), 'focuspet-state.json')
}

function windowStatePath(): string {
  return path.join(app.getPath('userData'), 'focuspet-window-state.json')
}

function readJsonFile(file: string): unknown {
  try {
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (err) {
    console.error('[FocusPet] Failed to read state:', err)
    return null
  }
}

function writeJsonFile(file: string, state: unknown): boolean {
  try {
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('[FocusPet] Failed to write state:', err)
    return false
  }
}

function loadAppMonitorState(): unknown {
  return readJsonFile(appMonitorStatePath())
}

function saveAppMonitorState(state: unknown): boolean {
  return writeJsonFile(appMonitorStatePath(), state)
}

function getDefaultCollapsedPosition(): WindowState {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  return {
    x: Math.max(0, sw - COLLAPSED_WIDTH - 20),
    y: Math.max(0, sh - COLLAPSED_HEIGHT - 40),
  }
}

function clampWindowPosition(x: number, y: number, width: number, height: number): WindowState {
  const display = screen.getDisplayMatching({ x, y, width, height })
  const area = display.workArea
  return {
    x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(y, area.y + area.height - height)),
  }
}

function loadWindowState(): WindowState {
  const state = readJsonFile(windowStatePath()) as Partial<WindowState> | null
  if (typeof state?.x !== 'number' || typeof state?.y !== 'number') {
    return getDefaultCollapsedPosition()
  }
  return clampWindowPosition(state.x, state.y, COLLAPSED_WIDTH, COLLAPSED_HEIGHT)
}

function saveWindowStateFromBounds(): void {
  if (!mainWindow) return
  const b = mainWindow.getBounds()
  writeJsonFile(windowStatePath(), { x: b.x, y: b.y })
}

function expectedWindowSize(): { width: number; height: number } {
  return panelOpen
    ? { width: WINDOW_WIDTH, height: WINDOW_HEIGHT }
    : { width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT }
}

function enforceWindowSize(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const expected = expectedWindowSize()
  const b = mainWindow.getBounds()
  if (b.width === expected.width && b.height === expected.height) return
  const pos = clampWindowPosition(b.x, b.y, expected.width, expected.height)
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: expected.width, height: expected.height })
}

function stopWindowDrag(): void {
  if (windowDragTimer) {
    clearInterval(windowDragTimer)
    windowDragTimer = null
  }
  windowDrag = null
  saveWindowStateFromBounds()
}

function positionCollapsedWindow(): void {
  if (!mainWindow) return
  panelOpen = false
  const saved = loadWindowState()
  const pos = clampWindowPosition(saved.x, saved.y, COLLAPSED_WIDTH, COLLAPSED_HEIGHT)
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT })
}

function resetWindowPosition(): void {
  if (!mainWindow) return
  panelOpen = false
  const pos = getDefaultCollapsedPosition()
  writeJsonFile(windowStatePath(), pos)
  mainWindow.show()
  mainWindow.setAlwaysOnTop(true)
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT })
}

function getDiagnostics(): Record<string, unknown> {
  return {
    appVersion: app.getVersion(),
    platform: process.platform,
    userDataPath: app.getPath('userData'),
    panelOpen,
    windowBounds: mainWindow?.getBounds() ?? null,
    expectedWindowSize: expectedWindowSize(),
    displayCount: screen.getAllDisplays().length,
    stateFiles: {
      appState: appStatePath(),
      appMonitorState: appMonitorStatePath(),
      windowState: windowStatePath(),
    },
    savedWindowState: readJsonFile(windowStatePath()),
    appMonitorState: readJsonFile(appMonitorStatePath()),
    systemIdleSeconds: powerMonitor.getSystemIdleTime(),
    timestamp: new Date().toISOString(),
  }
}

function copyDiagnostics(): void {
  clipboard.writeText(JSON.stringify(getDiagnostics(), null, 2))
}

function openPanel(): void {
  if (!mainWindow) return
  panelOpen = true
  const b = mainWindow.getBounds()
  const display = screen.getDisplayMatching(b)
  const centerX = b.x + b.width / 2
  const anchor: PanelAnchor = centerX < display.workArea.x + display.workArea.width / 2 ? 'left' : 'right'
  const targetX = anchor === 'left' ? b.x : b.x + b.width - WINDOW_WIDTH
  const pos = clampWindowPosition(targetX, b.y, WINDOW_WIDTH, WINDOW_HEIGHT)
  mainWindow.show()
  mainWindow.setAlwaysOnTop(true)
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: WINDOW_WIDTH, height: WINDOW_HEIGHT })
  mainWindow.webContents.send('panel-anchor', anchor)
  mainWindow.webContents.send('action', 'open-panel')
}

// ==================== 主窗口 ====================
function createWindow(): void {
  const pos = loadWindowState()

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: pos.x,
    y: pos.y,

    // ====== 桌宠核心配置 ======
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    resizable: false,
    minimizable: true,
    maximizable: false,

    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  })

  // 加载页面
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', positionCollapsedWindow)
  mainWindow.on('resize', enforceWindowSize)
  mainWindow.on('blur', stopWindowDrag)
  mainWindow.on('hide', stopWindowDrag)

  // 默认不穿透（Canvas 区域由 CSS pointer-events 控制）
  mainWindow.setIgnoreMouseEvents(false)

  // 窗口关闭 = 隐藏
  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on('closed', () => { mainWindow = null })
}

// ==================== 系统托盘 ====================
function createTray(): void {
  // 用 16x16 纯色图标（避免找不到图标文件时崩溃）
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 FocusPet',
      click: () => {
        mainWindow?.show()
        mainWindow?.setAlwaysOnTop(true)
        positionCollapsedWindow()
      },
    },
    {
      label: '打开面板',
      click: openPanel,
    },
    {
      label: '重置桌宠位置',
      click: resetWindowPosition,
    },
    {
      label: '开始专注',
      click: () => {
        openPanel()
        mainWindow?.webContents.send('action', 'start-focus')
      },
    },
    { type: 'separator' },
    {
      label: '置顶: 开启',
      type: 'checkbox',
      checked: true,
      click: (mi) => {
        mainWindow?.setAlwaysOnTop(mi.checked)
        mi.label = `置顶: ${mi.checked ? '开启' : '关闭'}`
      },
    },
    {
      label: '鼠标穿透: 关闭',
      type: 'checkbox',
      checked: false,
      click: (mi) => {
        mainWindow?.setIgnoreMouseEvents(mi.checked, { forward: true })
      },
    },
    {
      label: '复制诊断信息',
      click: copyDiagnostics,
    },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (mi) =>
        app.setLoginItemSettings({ openAtLogin: mi.checked, openAsHidden: true }),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuiting = true
        app.quit()
      },
    },
  ])

  tray.setToolTip('FocusPet - 专注伴侣')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show()
  })
}

// ==================== 全局快捷键 ====================
function registerShortcuts(): void {
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    mainWindow?.webContents.send('action', 'toggle-focus')
  })
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show()
  })
}

function startSystemIdleMonitor(): void {
  if (idleMonitorTimer) clearInterval(idleMonitorTimer)
  idleMonitorTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('system-idle', {
      seconds: powerMonitor.getSystemIdleTime(),
      timestamp: Date.now(),
    })
  }, 5000)
}

// ==================== IPC 通信 ====================
function registerIpc(): void {
  ipcMain.on('set-ignore-mouse-events', (_, ignore: boolean) => {
    mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.on('window-collapse', () => {
    positionCollapsedWindow()
  })

  ipcMain.on('window-expand', () => {
    openPanel()
  })

  ipcMain.handle('window-reset-position', () => {
    resetWindowPosition()
    return true
  })

  ipcMain.handle('diagnostics-get', () => getDiagnostics())

  ipcMain.handle('diagnostics-copy', () => {
    copyDiagnostics()
    return true
  })

  ipcMain.on('window-move-start', () => {
    mainWindow?.setIgnoreMouseEvents(false)
  })

  ipcMain.on('window-drag-start', (_, point: { screenX: number; screenY: number }) => {
    if (!mainWindow) return
    const b = mainWindow.getBounds()
    windowDrag = {
      offsetX: b.x - point.screenX,
      offsetY: b.y - point.screenY,
      width: b.width,
      height: b.height,
    }
    mainWindow.setIgnoreMouseEvents(false)
    if (windowDragTimer) clearInterval(windowDragTimer)
    windowDragTimer = setInterval(() => {
      if (!mainWindow || !windowDrag) return
      const cursor = screen.getCursorScreenPoint()
      const pos = clampWindowPosition(
        Math.round(cursor.x + windowDrag.offsetX),
        Math.round(cursor.y + windowDrag.offsetY),
        windowDrag.width,
        windowDrag.height,
      )
      mainWindow.setBounds({ x: pos.x, y: pos.y, width: windowDrag.width, height: windowDrag.height })
    }, 16)
  })

  ipcMain.on('window-drag-end', () => {
    stopWindowDrag()
  })

  ipcMain.handle('get-user-data-path', () => app.getPath('userData'))
  ipcMain.handle('app-load-state', () => readJsonFile(appStatePath()))
  ipcMain.handle('app-save-state', (_, state: unknown) => writeJsonFile(appStatePath(), state))
  ipcMain.handle('app-monitor-load-state', () => loadAppMonitorState())
  ipcMain.handle('app-monitor-save-state', (_, state: unknown) => saveAppMonitorState(state))
  ipcMain.on('open-external', (_, url: string) => shell.openExternal(url))
  ipcMain.on('set-always-on-top', (_, flag: boolean) =>
    mainWindow?.setAlwaysOnTop(flag)
  )
}

// ==================== 生命周期 ====================
app.whenReady().then(() => {
  registerIpc()
  createWindow()
  createTray()
  registerShortcuts()
  stopAppMonitor = startAppMonitor(() => mainWindow)
  startSystemIdleMonitor()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => { isQuiting = true })
app.on('will-quit', () => {
  stopAppMonitor?.()
  if (idleMonitorTimer) clearInterval(idleMonitorTimer)
  globalShortcut.unregisterAll()
})
