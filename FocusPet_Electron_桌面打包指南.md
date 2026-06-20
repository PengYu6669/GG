# FocusPet Electron 桌面实现与打包指南

> 文档版本：v3.1  
> 最后更新：2026-06-20  
> 当前项目目录：`D:\Desktop\LianJie\focuspet-desktop`

---

## 1. 当前技术栈

| 层级 | 技术 |
|---|---|
| 桌面框架 | Electron 28 |
| 构建工具 | electron-vite |
| 前端 | React 18 + TypeScript |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS |
| 图标 | lucide-react |
| 桌宠渲染 | Canvas 2D spritesheet |
| 应用监测 | PowerShell / osascript |
| 持久化 | Electron `userData` JSON |
| 打包 | electron-builder |

---

## 2. 当前项目结构

```text
focuspet-desktop/
├── src/
│   ├── main/
│   │   ├── index.ts          # 构建用主进程入口
│   │   ├── index.cjs         # 当前 dev/package main 入口
│   │   ├── preload.ts        # contextBridge API
│   │   └── appMonitor.cjs    # 前台应用/URL/上下文监测
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── PetWindow.tsx
│   │   │   ├── ControlPanel.tsx
│   │   │   ├── TimerPanel.tsx
│   │   │   ├── TaskPanel.tsx
│   │   │   └── CheckInModal.tsx
│   │   ├── context/
│   │   │   └── PetContext.tsx
│   │   ├── engine/
│   │   │   ├── SpriteAnimator.ts
│   │   │   ├── PhysicsEngine.ts
│   │   │   ├── StateMachine.ts
│   │   │   └── ParticleEmitter.ts
│   │   ├── stores/
│   │   │   └── usePetStore.ts
│   │   └── assets/
│   │       └── pets/
│   └── types/
│       ├── electron.d.ts
│       └── assets.d.ts
├── docs/
│   ├── app-monitor-todo.md
│   └── product-next-todo.md
├── resources/
├── out/
├── package.json
└── electron.vite.config.ts
```

注意：当前 `package.json` 的 `main` 指向 `./src/main/index.cjs`，所以开发测试时主进程改动需要同步 `index.cjs`。`index.ts` 用于 electron-vite build 输出。

---

## 3. 开发命令

```bash
cd D:\Desktop\LianJie\focuspet-desktop
npm run dev
```

构建：

```bash
npm run build
```

打包：

```bash
npm run dist
npm run dist:win
npm run dist:mac
```

---

## 4. 当前窗口设计

### 4.1 窗口尺寸

当前主进程常量：

```ts
const WINDOW_WIDTH = 700
const WINDOW_HEIGHT = 500
const COLLAPSED_WIDTH = 216
const COLLAPSED_HEIGHT = 232
```

收起态只保留桌宠本体附近区域，减少占位。展开态显示控制面板。

### 4.2 关键 BrowserWindow 配置

当前窗口核心配置：

- `frame: false`
- `transparent: true`
- `alwaysOnTop: true`
- `skipTaskbar`：发布态可设为 `true`，当前 dev CJS 为 `false` 方便调试找回窗口
- `resizable: false`
- `backgroundColor: '#00000000'`
- `webSecurity: false`

当前 `src/main/index.cjs` 为方便测试还会：

- `skipTaskbar: false`：便于在开发阶段从任务栏找回窗口。
- `openDevTools({ mode: 'detach' })`：便于查看渲染日志。

正式打包前建议改回更安静的发布配置，例如关闭自动 DevTools，并按产品策略决定是否 `skipTaskbar: true`。

之前出现过宽高不断增长的问题，因此当前做了三层保护：

1. `resizable: false`
2. 展开/收起统一用 `setBounds`
3. `resize` 事件中强制恢复预期尺寸

### 4.3 拖拽策略

当前不再让 canvas 在大窗口中自由漂移，而是：

- 桌宠 canvas 固定在收起窗口内部。
- 拖拽桌宠时移动整个 Electron 透明窗口。
- 主进程通过 `screen.getCursorScreenPoint()` 驱动窗口位置。
- 松手后保存窗口位置。
- 窗口 blur/hide 时停止拖拽计时器，避免后台继续移动。

---

## 5. 面板展开策略

面板唤醒方式：

- 右键桌宠。
- 双击桌宠。
- 托盘菜单打开。

当前展开逻辑：

- 桌宠在屏幕左半边：面板向右展开。
- 桌宠在屏幕右半边：面板向左展开。

下一步建议：

- hover 桌宠后显示极小 `⋯` 按钮。
- 托盘增加“重置位置”。

---

## 6. 应用/网页监测

文件：`src/main/appMonitor.cjs`

当前能力：

- Windows 获取前台窗口标题、进程名、路径、pid。
- macOS 获取前台应用、窗口标题、pid。
- Windows Chrome/Edge 尝试通过 UIAutomation 获取地址栏 URL。
- macOS Chrome/Edge/Safari 尝试通过 AppleScript 获取当前 tab URL。
- 推断上下文：
  - browser
  - editor
  - ai
  - terminal
  - dev-server
  - generic

限制：

- Windows UIAutomation 读取 URL 可能受浏览器版本、语言、焦点状态影响。
- macOS 读取 URL 可能需要自动化权限。
- URL 获取失败时会降级到窗口标题关键词。

---

## 7. 持久化文件

当前使用 Electron `app.getPath('userData')` 下的 JSON：

- `focuspet-state.json`
  - 任务
  - 专注历史
  - 番茄钟时长
  - 星尘
- `focuspet-app-monitor.json`
  - 应用规则
  - 域名规则
  - 应用使用时长
  - 紧急使用状态
- `focuspet-window-state.json`
  - 桌宠窗口位置

---

## 8. 主要 IPC

preload 暴露的常用 API：

- `collapseWindow`
- `expandWindow`
- `startWindowDrag`
- `endWindowDrag`
- `loadAppState`
- `saveAppState`
- `loadAppMonitorState`
- `saveAppMonitorState`
- `onForegroundApp`
- `onAction`
- `onPanelAnchor`

尚未暴露但建议补充：

- `resetWindowPosition`：托盘和调试场景一键把桌宠放回默认位置。
- `getDiagnostics`：导出 userData 路径、窗口状态、监测权限状态，方便测试反馈。

---

## 9. 当前尚未实现的打包相关项

- 正式应用图标。
- Windows installer metadata 完善。
- macOS 签名/公证。
- Linux 支持。
- 自动更新。
- 崩溃日志。

---

## 10. 验证命令

类型检查：

```bash
npm exec tsc -- --noEmit --pretty false --target ES2020 --lib ES2020,DOM,DOM.Iterable --module ESNext --moduleResolution bundler --jsx react-jsx --strict --skipLibCheck src/main/index.ts src/main/preload.ts src/renderer/App.tsx src/renderer/components/PetWindow.tsx src/renderer/components/TaskPanel.tsx src/renderer/components/TimerPanel.tsx src/renderer/components/ControlPanel.tsx src/renderer/stores/usePetStore.ts src/renderer/context/PetContext.tsx src/renderer/engine/StateMachine.ts src/types/electron.d.ts src/types/assets.d.ts
```

构建：

```bash
npm run build
```

重启 dev：

```powershell
Get-Process | Where-Object { $_.ProcessName -eq 'electron' -and $_.Path -like 'D:\Desktop\LianJie\focuspet-desktop\*' } | Stop-Process -Force
Start-Process -FilePath npm.cmd -ArgumentList 'run','dev' -WorkingDirectory 'D:\Desktop\LianJie\focuspet-desktop' -WindowStyle Hidden
```

---

## 11. 下一步工程建议

1. 把 dev 入口从 `src/main/index.cjs` 收敛到构建产物入口，减少 TS/CJS 双维护。
2. 主进程计时器化或 wall-clock 校正，进一步减少渲染进程生命周期影响。
3. 浏览器 URL 识别抽成独立模块。
4. 增加“重置窗口位置”IPC。
5. 增加错误日志文件和“复制诊断信息”，便于用户测试反馈。
6. 正式发布前关闭自动 DevTools，并补充应用图标与安装包 metadata。
