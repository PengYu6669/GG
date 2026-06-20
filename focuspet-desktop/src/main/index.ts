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
const WINDOW_WIDTH = 760
const WINDOW_HEIGHT = 540
const COLLAPSED_WIDTH = 216 // 收起后只保留桌宠主体，透明区默认鼠标穿透
const BUBBLE_WIDTH = 380
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
let autoMousePassthrough = true
let bubbleVisible = false

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

function loadLocalEnv(): void {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  try {
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/)
      if (!match) continue
      const key = match[1]
      const value = match[2].replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch (err) {
    console.error('[FocusPet] Failed to load .env:', err)
  }
}

type AiBreakdownTask = {
  name: string
  priority: 'high' | 'medium' | 'low'
  estimatedPomos: number
  startAt?: number
  endAt?: number
}

type AiAppReviewPayload = {
  taskName?: string
  app: string
  title: string
  domain?: string
  url?: string
  contextKind?: string
}

type ChatMessage = { role: 'system' | 'user'; content: string }

async function requestDeepSeekJson(messages: ChatMessage[]): Promise<{ ok: boolean; text?: string; error?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return { ok: false, error: '缺少 DEEPSEEK_API_KEY，先配置后再用 AI 功能。' }
  }

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return { ok: false, error: `DeepSeek 请求失败：${response.status}${detail ? ` ${detail.slice(0, 80)}` : ''}` }
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content
  return text ? { ok: true, text } : { ok: false, error: 'DeepSeek 没有返回可用结果。' }
}

async function breakDownTaskWithAI(task: AiBreakdownTask): Promise<{ ok: boolean; tasks?: string[]; error?: string }> {
  const result = await requestDeepSeekJson([
    {
      role: 'system',
      content: '你是 ADHD 友好的任务拆解助手。只输出 JSON，不要 Markdown。格式：{"tasks":["步骤"]}。把任务拆成 5 到 8 个具体、可开始、可验证的小步骤，每一步不超过 24 个中文字符。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: task.name,
        priority: task.priority,
        estimatedPomos: task.estimatedPomos,
        startAt: task.startAt ? new Date(task.startAt).toISOString() : null,
        endAt: task.endAt ? new Date(task.endAt).toISOString() : null,
      }),
    },
  ])
  if (!result.ok || !result.text) return { ok: false, error: result.error ?? 'AI 拆解失败。' }
  const text = stripJsonFence(result.text)
  if (!text) return { ok: false, error: 'AI 没有返回可用结果。' }
  const parsed = JSON.parse(text) as { tasks?: string[] }
  const tasks = (parsed.tasks ?? []).map(item => String(item).trim()).filter(Boolean).slice(0, 8)
  if (tasks.length === 0) return { ok: false, error: 'AI 没有拆出任务。' }
  return { ok: true, tasks }
}

async function reviewAppWithAI(payload: AiAppReviewPayload): Promise<{ ok: boolean; rule?: 'allow' | 'block' | 'neutral'; reason?: string; error?: string }> {
  const result = await requestDeepSeekJson([
    {
      role: 'system',
      content: '你是专注应用分类器。判断当前应用/网站对当前任务是否应该放行。只输出 JSON，格式：{"rule":"allow|block|neutral","reason":"原因"}。规则：开发、学习、文档、AI 助手、GitHub 通常 allow；游戏、短视频、社交娱乐、购物通常 block；证据不足 neutral。',
    },
    {
      role: 'user',
      content: JSON.stringify(payload),
    },
  ])
  if (!result.ok || !result.text) return { ok: false, error: result.error ?? '智能评审失败。' }
  const text = stripJsonFence(result.text)
  const parsed = JSON.parse(text) as { rule?: 'allow' | 'block' | 'neutral'; reason?: string }
  if (!parsed.rule) return { ok: false, error: '智能评审结果无效。' }
  return { ok: true, rule: parsed.rule, reason: parsed.reason ?? '' }
}

function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
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
    : { width: bubbleVisible ? BUBBLE_WIDTH : COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT }
}

function resizeWindowToExpectedSize(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const expected = expectedWindowSize()
  const b = mainWindow.getBounds()
  if (b.width === expected.width && b.height === expected.height) return
  const display = screen.getDisplayMatching(b)
  const centerX = b.x + b.width / 2
  const keepRightEdge = centerX >= display.workArea.x + display.workArea.width / 2
  const nextX = keepRightEdge ? b.x + b.width - expected.width : b.x
  const pos = clampWindowPosition(nextX, b.y, expected.width, expected.height)
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: expected.width, height: expected.height })
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
  if (!panelOpen && autoMousePassthrough) {
    mainWindow?.setIgnoreMouseEvents(true, { forward: true })
  }
  saveWindowStateFromBounds()
}

function positionCollapsedWindow(): void {
  if (!mainWindow) return
  panelOpen = false
  bubbleVisible = false
  const saved = loadWindowState()
  const pos = clampWindowPosition(saved.x, saved.y, COLLAPSED_WIDTH, COLLAPSED_HEIGHT)
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT })
  if (autoMousePassthrough) mainWindow.setIgnoreMouseEvents(true, { forward: true })
}

function resetWindowPosition(): void {
  if (!mainWindow) return
  panelOpen = false
  bubbleVisible = false
  const pos = getDefaultCollapsedPosition()
  writeJsonFile(windowStatePath(), pos)
  mainWindow.show()
  mainWindow.setAlwaysOnTop(true)
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT })
  if (autoMousePassthrough) mainWindow.setIgnoreMouseEvents(true, { forward: true })
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
  bubbleVisible = false
  mainWindow.setIgnoreMouseEvents(false)
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
  if (autoMousePassthrough) mainWindow.setIgnoreMouseEvents(true, { forward: true })

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
    autoMousePassthrough = ignore
    mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.on('window-collapse', () => {
    positionCollapsedWindow()
  })

  ipcMain.on('window-expand', () => {
    openPanel()
  })

  ipcMain.on('window-bubble-visible', (_, visible: boolean) => {
    bubbleVisible = visible
    if (!panelOpen) resizeWindowToExpectedSize()
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
      moveDraggedWindow(screen.getCursorScreenPoint())
    }, 8)
  })

  ipcMain.on('window-drag-move', (_, point: { screenX: number; screenY: number }) => {
    moveDraggedWindow(point)
  })

  function moveDraggedWindow(point: { x?: number; y?: number; screenX?: number; screenY?: number }): void {
    if (!mainWindow || !windowDrag) return
    const screenX = typeof point.screenX === 'number' ? point.screenX : point.x ?? 0
    const screenY = typeof point.screenY === 'number' ? point.screenY : point.y ?? 0
    const pos = clampWindowPosition(
      Math.round(screenX + windowDrag.offsetX),
      Math.round(screenY + windowDrag.offsetY),
      windowDrag.width,
      windowDrag.height,
    )
    mainWindow.setBounds({ x: pos.x, y: pos.y, width: windowDrag.width, height: windowDrag.height })
  }

  ipcMain.on('window-drag-end', () => {
    stopWindowDrag()
  })

  ipcMain.handle('get-user-data-path', () => app.getPath('userData'))
  ipcMain.handle('app-load-state', () => readJsonFile(appStatePath()))
  ipcMain.handle('app-save-state', (_, state: unknown) => writeJsonFile(appStatePath(), state))
  ipcMain.handle('app-monitor-load-state', () => loadAppMonitorState())
  ipcMain.handle('app-monitor-save-state', (_, state: unknown) => saveAppMonitorState(state))
  ipcMain.handle('task-ai-breakdown', async (_, task: AiBreakdownTask) => {
    try {
      return await breakDownTaskWithAI(task)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'AI 拆解失败。' }
    }
  })
  ipcMain.handle('app-ai-review', async (_, payload: AiAppReviewPayload) => {
    try {
      return await reviewAppWithAI(payload)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : '智能评审失败。' }
    }
  })
  ipcMain.on('open-external', (_, url: string) => shell.openExternal(url))
  ipcMain.on('set-always-on-top', (_, flag: boolean) =>
    mainWindow?.setAlwaysOnTop(flag)
  )
}

// ==================== 生命周期 ====================
app.whenReady().then(() => {
  loadLocalEnv()
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
