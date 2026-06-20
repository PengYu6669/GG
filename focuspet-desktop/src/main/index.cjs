"use strict";
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, globalShortcut, shell, nativeImage, clipboard, powerMonitor } = require("electron");
const path = require("path");
const fs = require("fs");
const { startAppMonitor } = require("./appMonitor.cjs");

const WINDOW_WIDTH = 700;
const WINDOW_HEIGHT = 500;
const COLLAPSED_WIDTH = 216;
const COLLAPSED_HEIGHT = 232;
let mainWindow = null;
let tray = null;
let isQuiting = false;
let stopAppMonitor = null;
let idleMonitorTimer = null;
let windowDrag = null;
let windowDragTimer = null;
let panelOpen = false;

function appMonitorStatePath() {
  return path.join(app.getPath("userData"), "focuspet-app-monitor.json");
}

function appStatePath() {
  return path.join(app.getPath("userData"), "focuspet-state.json");
}

function windowStatePath() {
  return path.join(app.getPath("userData"), "focuspet-window-state.json");
}

function readJsonFile(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.error("[FocusPet] Failed to read state:", err);
    return null;
  }
}

function writeJsonFile(file, state) {
  try {
    fs.writeFileSync(file, JSON.stringify(state, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[FocusPet] Failed to write state:", err);
    return false;
  }
}

function loadAppMonitorState() {
  return readJsonFile(appMonitorStatePath());
}

function saveAppMonitorState(state) {
  return writeJsonFile(appMonitorStatePath(), state);
}

function getDefaultCollapsedPosition() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  return {
    x: Math.max(0, sw - COLLAPSED_WIDTH - 20),
    y: Math.max(0, sh - COLLAPSED_HEIGHT - 40),
  };
}

function clampWindowPosition(x, y, width, height) {
  const display = screen.getDisplayMatching({ x, y, width, height });
  const area = display.workArea;
  return {
    x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(y, area.y + area.height - height)),
  };
}

function loadWindowState() {
  const state = readJsonFile(windowStatePath());
  if (typeof state?.x !== "number" || typeof state?.y !== "number") {
    return getDefaultCollapsedPosition();
  }
  return clampWindowPosition(state.x, state.y, COLLAPSED_WIDTH, COLLAPSED_HEIGHT);
}

function saveWindowStateFromBounds() {
  if (!mainWindow) return;
  const b = mainWindow.getBounds();
  writeJsonFile(windowStatePath(), { x: b.x, y: b.y });
}

function expectedWindowSize() {
  return panelOpen
    ? { width: WINDOW_WIDTH, height: WINDOW_HEIGHT }
    : { width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT };
}

function enforceWindowSize() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const expected = expectedWindowSize();
  const b = mainWindow.getBounds();
  if (b.width === expected.width && b.height === expected.height) return;
  const pos = clampWindowPosition(b.x, b.y, expected.width, expected.height);
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: expected.width, height: expected.height });
}

function stopWindowDrag() {
  if (windowDragTimer) {
    clearInterval(windowDragTimer);
    windowDragTimer = null;
  }
  windowDrag = null;
  saveWindowStateFromBounds();
}

function positionCollapsedWindow() {
  if (!mainWindow) return;
  panelOpen = false;
  const saved = loadWindowState();
  const pos = clampWindowPosition(saved.x, saved.y, COLLAPSED_WIDTH, COLLAPSED_HEIGHT);
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT });
}

function resetWindowPosition() {
  if (!mainWindow) return;
  panelOpen = false;
  const pos = getDefaultCollapsedPosition();
  writeJsonFile(windowStatePath(), pos);
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true);
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT });
}

function getDiagnostics() {
  return {
    appVersion: app.getVersion(),
    platform: process.platform,
    userDataPath: app.getPath("userData"),
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
  };
}

function copyDiagnostics() {
  clipboard.writeText(JSON.stringify(getDiagnostics(), null, 2));
}

function openPanel() {
  if (!mainWindow) return;
  panelOpen = true;
  const b = mainWindow.getBounds();
  const display = screen.getDisplayMatching(b);
  const centerX = b.x + b.width / 2;
  const anchor = centerX < display.workArea.x + display.workArea.width / 2 ? "left" : "right";
  const targetX = anchor === "left" ? b.x : b.x + b.width - WINDOW_WIDTH;
  const pos = clampWindowPosition(targetX, b.y, WINDOW_WIDTH, WINDOW_HEIGHT);
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true);
  mainWindow.setBounds({ x: pos.x, y: pos.y, width: WINDOW_WIDTH, height: WINDOW_HEIGHT });
  mainWindow.webContents.send("panel-anchor", anchor);
  mainWindow.webContents.send("action", "open-panel");
}

function createWindow() {
  const pos = loadWindowState();
  console.log("[FocusPet] Creating window at", pos.x, "x", pos.y);
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH, height: WINDOW_HEIGHT,
    x: pos.x, y: pos.y,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: false, hasShadow: true, backgroundColor: "#00000000",
    resizable: false, minimizable: true, maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, "../../out/preload/index.js"),
      nodeIntegration: false, contextIsolation: true, webSecurity: false,
    },
  });
  console.log("[FocusPet] Window created:", mainWindow.getBounds());
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[FocusPet] Renderer loaded OK");
  });
  mainWindow.webContents.on("did-fail-load", (_, code, desc) => {
    console.error("[FocusPet] Renderer FAILED:", code, desc);
  });
  // 优先尝试 Vite dev server，否则加载构建产物
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  console.log("[FocusPet] Trying dev URL:", devUrl);
  mainWindow.loadURL(devUrl).catch(() => {
    const htmlPath = path.join(__dirname, "../../out/renderer/index.html");
    console.log("[FocusPet] Dev not available, loading file:", htmlPath);
    return mainWindow.loadFile(htmlPath);
  });
  mainWindow.webContents.openDevTools({ mode: "detach" });
  mainWindow.once("ready-to-show", positionCollapsedWindow);
  mainWindow.on("resize", enforceWindowSize);
  mainWindow.on("blur", stopWindowDrag);
  mainWindow.on("hide", stopWindowDrag);
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.on("close", (event) => {
    if (!isQuiting) { event.preventDefault(); mainWindow?.hide(); }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示 FocusPet", click: () => { mainWindow?.show(); mainWindow?.setAlwaysOnTop(true); positionCollapsedWindow(); } },
    { label: "打开面板", click: openPanel },
    { label: "重置桌宠位置", click: resetWindowPosition },
    { label: "开始专注", click: () => { openPanel(); mainWindow?.webContents.send("action", "start-focus"); } },
    { type: "separator" },
    { label: "置顶: 开启", type: "checkbox", checked: true, click: (mi) => { mainWindow?.setAlwaysOnTop(mi.checked); mi.label = `置顶: ${mi.checked ? "开启" : "关闭"}`; } },
    { label: "鼠标穿透: 关闭", type: "checkbox", checked: false, click: (mi) => { mainWindow?.setIgnoreMouseEvents(mi.checked, { forward: true }); } },
    { label: "复制诊断信息", click: copyDiagnostics },
    { type: "separator" },
    { label: "开机自启", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (mi) => app.setLoginItemSettings({ openAtLogin: mi.checked, openAsHidden: true }) },
    { type: "separator" },
    { label: "退出", click: () => { isQuiting = true; app.quit(); } },
  ]));
  tray.setToolTip("FocusPet - 专注伴侣");
  tray.on("click", () => { mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show(); });
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+F", () => { mainWindow?.webContents.send("action", "toggle-focus"); });
  globalShortcut.register("CommandOrControl+Shift+H", () => { mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show(); });
}

function startSystemIdleMonitor() {
  if (idleMonitorTimer) clearInterval(idleMonitorTimer);
  idleMonitorTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("system-idle", {
      seconds: powerMonitor.getSystemIdleTime(),
      timestamp: Date.now(),
    });
  }, 5000);
}

function registerIpc() {
  ipcMain.on("set-ignore-mouse-events", (_, ignore) => { mainWindow?.setIgnoreMouseEvents(ignore, { forward: true }); });
  ipcMain.on("window-collapse", positionCollapsedWindow);
  ipcMain.on("window-expand", openPanel);
  ipcMain.handle("window-reset-position", () => {
    resetWindowPosition();
    return true;
  });
  ipcMain.handle("diagnostics-get", () => getDiagnostics());
  ipcMain.handle("diagnostics-copy", () => {
    copyDiagnostics();
    return true;
  });
  ipcMain.on("window-move-start", () => { mainWindow?.setIgnoreMouseEvents(false); });
  ipcMain.on("window-drag-start", (_, point) => {
    if (!mainWindow) return;
    const b = mainWindow.getBounds();
    windowDrag = {
      offsetX: b.x - point.screenX,
      offsetY: b.y - point.screenY,
      width: b.width,
      height: b.height,
    };
    mainWindow.setIgnoreMouseEvents(false);
    if (windowDragTimer) clearInterval(windowDragTimer);
    windowDragTimer = setInterval(() => {
      if (!mainWindow || !windowDrag) return;
      const cursor = screen.getCursorScreenPoint();
      const pos = clampWindowPosition(
        Math.round(cursor.x + windowDrag.offsetX),
        Math.round(cursor.y + windowDrag.offsetY),
        windowDrag.width,
        windowDrag.height,
      );
      mainWindow.setBounds({ x: pos.x, y: pos.y, width: windowDrag.width, height: windowDrag.height });
    }, 16);
  });
  ipcMain.on("window-drag-end", () => {
    stopWindowDrag();
  });
  ipcMain.handle("get-user-data-path", () => app.getPath("userData"));
  ipcMain.handle("app-load-state", () => readJsonFile(appStatePath()));
  ipcMain.handle("app-save-state", (_, state) => writeJsonFile(appStatePath(), state));
  ipcMain.handle("app-monitor-load-state", () => loadAppMonitorState());
  ipcMain.handle("app-monitor-save-state", (_, state) => saveAppMonitorState(state));
  ipcMain.on("open-external", (_, url) => shell.openExternal(url));
  ipcMain.on("set-always-on-top", (_, flag) => mainWindow?.setAlwaysOnTop(flag));
}

app.whenReady().then(() => {
  registerIpc(); createWindow(); createTray(); registerShortcuts();
  stopAppMonitor = startAppMonitor(() => mainWindow);
  startSystemIdleMonitor();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("before-quit", () => { isQuiting = true; });
app.on("will-quit", () => {
  stopAppMonitor?.();
  if (idleMonitorTimer) clearInterval(idleMonitorTimer);
  globalShortcut.unregisterAll();
});
