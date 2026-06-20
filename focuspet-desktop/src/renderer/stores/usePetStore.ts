import { create } from 'zustand'

export interface Task {
  id: string
  name: string
  estimatedPomos: number
  completedPomos: number
  priority: 'high' | 'medium' | 'low'
  status: 'todo' | 'doing' | 'done'
  createdAt: number
  deadline?: number
  startAt?: number
  endAt?: number
  reminderAt?: number
  remindedAt?: number
  overdueRemindedAt?: number
}

export interface FocusSession {
  id: string
  taskId: string
  plannedDuration: number
  actualDuration: number
  distractions: number
  score: number
  driftSeconds: number
  blockedSeconds: number
  neutralSeconds: number
  longestDriftSeconds: number
  pullbackCount: number
  recoveryCount: number
  microStart: boolean
  events: FocusEvent[]
  startedAt: number
  endedAt?: number
}

export interface FocusEvent {
  id: string
  type: 'drift' | 'blocked' | 'checkin' | 'pause' | 'resume' | 'abandon' | 'complete' | 'start' | 'switch' | 'pullback' | 'recover' | 'micro-extend'
  app?: string
  title?: string
  timestamp: number
  note?: string
  rule?: AppRule
  seconds?: number
  level?: number
}

export type AppRule = 'allow' | 'block' | 'neutral'

export interface ForegroundAppSnapshot {
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
  rule: AppRule
}

export interface AppUsageEntry {
  app: string
  title: string
  seconds: number
  rule: AppRule
  lastSeenAt: number
}

export interface FocusTelemetry {
  score: number
  driftSeconds: number
  blockedSeconds: number
  neutralSeconds: number
  allowSeconds: number
  longestDriftSeconds: number
  currentDriftStartedAt: number | null
  currentDriftSeconds: number
  workflowSwitches: number
  riskSwitches: number
  totalSwitches: number
  pullbackCount: number
  recoveryCount: number
  lastPullbackAt: number
  lastRecoveredAt: number
  lastRiskStartedAt: number | null
  microStart: boolean
  lastAppKey: string
  lastRule: AppRule
  lastUpdatedAt: number
}

export interface AppMonitorState {
  allowlistApps: string[]
  blocklistApps: string[]
  allowTitleKeywords: string[]
  blockTitleKeywords: string[]
  allowDomains: string[]
  blockDomains: string[]
  emergencyUntil: number
  appUsage: Record<string, AppUsageEntry>
  savedAt: number
}

export interface PersistedAppState {
  petName: string
  stardust: number
  tasks: Task[]
  focusHistory: FocusSession[]
  focusDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  completedPomoCount: number
  savedAt: number
}

export type TimerMode = 'idle' | 'focus' | 'shortBreak' | 'longBreak'
export type FocusProfile = 'programming' | 'writing' | 'study' | 'strict'

interface PetStore {
  // 桌宠
  petName: string
  stardust: number

  // 专注
  focusActive: boolean
  timerMode: TimerMode
  focusRemaining: number      // 剩余秒数
  focusDuration: number       // 计划时长 (分钟)
  focusStartedAt: number
  shortBreakDuration: number
  longBreakDuration: number
  completedPomoCount: number
  currentTaskId: string | null
  distractionCount: number

  // 应用状态
  currentApp: ForegroundAppSnapshot | null
  appUsage: Record<string, AppUsageEntry>
  focusTelemetry: FocusTelemetry
  allowlistApps: string[]
  blocklistApps: string[]
  allowTitleKeywords: string[]
  blockTitleKeywords: string[]
  allowDomains: string[]
  blockDomains: string[]
  focusProfile: FocusProfile | null
  emergencyUntil: number

  // 任务
  tasks: Task[]
  focusHistory: FocusSession[]
  focusEvents: FocusEvent[]

  // 操作
  setPetName: (name: string) => void
  addStardust: (amount: number) => void
  startFocus: (taskId: string | null, durationMin: number, options?: { microStart?: boolean }) => void
  setFocusDuration: (minutes: number) => void
  setBreakDurations: (shortMinutes: number, longMinutes: number) => void
  startBreak: (mode: 'shortBreak' | 'longBreak', durationMin?: number) => void
  completeBreak: () => void
  pauseFocus: () => void
  resumeFocus: () => void
  tickFocus: (remaining: number) => void
  completeFocus: () => void
  abandonFocus: () => void
  addDistraction: () => void
  addFocusEvent: (event: Omit<FocusEvent, 'id' | 'timestamp'> & { timestamp?: number }) => void
  recordPullback: (level: number, reason: 'blocked' | 'drift', message: string) => void
  extendFocus: (minutes: number) => void
  activateEmergencyUse: (minutes?: number) => void
  clearEmergencyUse: () => void
  recordForegroundApp: (info: Omit<ForegroundAppSnapshot, 'rule'>) => ForegroundAppSnapshot
  resetFocusTelemetry: () => void
  setAppRules: (rules: Pick<AppMonitorState, 'allowlistApps' | 'blocklistApps' | 'allowTitleKeywords' | 'blockTitleKeywords' | 'allowDomains' | 'blockDomains'>) => void
  applyFocusProfile: (profile: FocusProfile) => void
  hydrateAppMonitor: (state: Partial<AppMonitorState> | null) => void
  exportAppMonitorState: () => AppMonitorState
  hydrateAppState: (state: Partial<PersistedAppState> | null) => void
  exportAppState: () => PersistedAppState
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void
  importTasks: (text: string) => number
  updateTask: (id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>) => void
  breakDownTask: (id: string) => number
  completeTask: (id: string) => void
  deleteTask: (id: string) => void
}

const generateId = () => Math.random().toString(36).slice(2, 10)

const DEFAULT_ALLOWLIST = [
  'code',
  'visual studio code',
  'cursor',
  'codex',
  'windsurf',
  'trae',
  'webstorm',
  'intellij',
  'pycharm',
  'idea',
  'jetbrains',
  'github desktop',
  'claude',
  'doubao',
  '豆包',
  'kimi',
  'moonshot',
  'chatgpt',
  'openai',
  'node',
  'powershell',
  'terminal',
  'iterm2',
  'warp',
  'cmd',
  'bash',
  'zsh',
]

const DEFAULT_BLOCKLIST = [
  'steam',
  'douyin',
  '抖音',
  'tiktok',
  'bilibili',
  'wechatappex',
  'radiumwmpf',
]

const DEFAULT_ALLOW_TITLE_KEYWORDS = [
  'claude',
  '豆包',
  'doubao',
  'kimi',
  'moonshot',
  'chatgpt',
  'openai',
  'vscode',
  'visual studio code',
  'codex',
  'cursor',
  'windsurf',
  'trae',
  'jetbrains',
  'github',
  'docs',
  'document',
  '文档',
]

const DEFAULT_ALLOW_DOMAINS = [
  'github.com',
  'stackoverflow.com',
  'developer.mozilla.org',
  'localhost',
  '127.0.0.1',
  'openai.com',
  'anthropic.com',
  'kimi.com',
  'moonshot.cn',
  'chatgpt.com',
  'claude.ai',
  'doubao.com',
  'doubao.com.cn',
]

const DEFAULT_BLOCK_TITLE_KEYWORDS = [
  'bilibili',
  '抖音',
  'douyin',
  'tiktok',
  'steam',
  'shorts',
  '小红书',
  '微博',
]

const DEFAULT_BLOCK_DOMAINS = [
  'douyin.com',
  'tiktok.com',
  'bilibili.com',
  'youtube.com',
  'xiaohongshu.com',
  'weibo.com',
]

type AppRuleSet = Pick<AppMonitorState, 'allowlistApps' | 'blocklistApps' | 'allowTitleKeywords' | 'blockTitleKeywords' | 'allowDomains' | 'blockDomains'>

const FOCUS_PROFILES: Record<FocusProfile, AppRuleSet> = {
  programming: {
      allowlistApps: ['code', 'visual studio code', 'cursor', 'codex', 'windsurf', 'trae', 'webstorm', 'intellij', 'pycharm', 'idea', 'jetbrains', 'terminal', 'powershell', 'iterm2', 'warp', 'node', 'git', 'github desktop', 'claude', 'doubao', '豆包', 'kimi', 'moonshot'],
      blocklistApps: ['douyin', '抖音', 'tiktok', 'bilibili', 'steam', 'wechatappex', 'radiumwmpf'],
      allowTitleKeywords: ['github', 'docs', 'documentation', 'localhost', '127.0.0.1', 'vscode', 'cursor', 'codex', 'windsurf', 'trae', 'jetbrains', 'claude', '豆包', 'kimi', 'moonshot', 'chatgpt', 'api', 'stack overflow'],
      blockTitleKeywords: ['抖音', 'douyin', 'tiktok', 'bilibili', 'shorts', 'steam', '小红书'],
      allowDomains: ['github.com', 'stackoverflow.com', 'developer.mozilla.org', 'localhost', '127.0.0.1', 'kimi.com', 'moonshot.cn', 'chatgpt.com', 'claude.ai'],
      blockDomains: ['douyin.com', 'tiktok.com', 'bilibili.com', 'youtube.com', 'xiaohongshu.com'],
  },
  writing: {
    allowlistApps: ['word', 'notion', 'obsidian', 'typora', 'claude', 'doubao', '豆包', 'kimi', 'moonshot', 'chrome', 'edge', 'safari'],
      blocklistApps: ['douyin', '抖音', 'tiktok', 'bilibili', 'steam'],
    allowTitleKeywords: ['文档', 'document', 'docs', 'notion', 'obsidian', 'claude', '豆包', 'kimi', 'moonshot', '稿', '写作'],
      blockTitleKeywords: ['抖音', 'douyin', 'tiktok', 'bilibili', 'shorts', '小红书', '微博'],
      allowDomains: ['docs.google.com', 'notion.so', 'yuque.com', 'feishu.cn', 'kimi.com', 'moonshot.cn', 'chatgpt.com', 'claude.ai'],
      blockDomains: ['douyin.com', 'tiktok.com', 'bilibili.com', 'youtube.com', 'xiaohongshu.com', 'weibo.com'],
  },
  study: {
    allowlistApps: ['chrome', 'edge', 'safari', 'pdf', 'acrobat', 'word', 'obsidian', 'notion', 'claude', 'doubao', '豆包', 'kimi', 'moonshot'],
      blocklistApps: ['douyin', '抖音', 'tiktok', 'bilibili', 'steam'],
      allowTitleKeywords: ['course', '课程', 'pdf', 'docs', '文档', '论文', 'paper', 'github', 'wikipedia'],
      blockTitleKeywords: ['抖音', 'douyin', 'tiktok', 'shorts', 'steam', '游戏'],
      allowDomains: ['wikipedia.org', 'coursera.org', 'edx.org', 'bilibili.com', 'github.com', 'kimi.com', 'moonshot.cn', 'chatgpt.com', 'claude.ai'],
      blockDomains: ['douyin.com', 'tiktok.com', 'youtube.com', 'xiaohongshu.com'],
  },
  strict: {
    allowlistApps: ['code', 'visual studio code', 'cursor', 'codex', 'windsurf', 'trae', 'webstorm', 'intellij', 'pycharm', 'idea', 'jetbrains', 'terminal', 'powershell', 'iterm2', 'word', 'notion', 'obsidian', 'claude', 'doubao', '豆包', 'kimi', 'moonshot'],
      blocklistApps: ['douyin', '抖音', 'tiktok', 'bilibili', 'steam', 'wechatappex', 'radiumwmpf', 'chrome', 'edge'],
    allowTitleKeywords: ['github', 'docs', 'localhost', '127.0.0.1', '文档', 'document', 'claude', '豆包', 'kimi', 'moonshot'],
      blockTitleKeywords: ['抖音', 'douyin', 'tiktok', 'bilibili', 'shorts', 'youtube', '小红书', '微博', 'steam', '购物'],
      allowDomains: ['github.com', 'developer.mozilla.org', 'localhost', '127.0.0.1', 'kimi.com', 'moonshot.cn', 'chatgpt.com', 'claude.ai'],
      blockDomains: ['douyin.com', 'tiktok.com', 'bilibili.com', 'youtube.com', 'xiaohongshu.com', 'weibo.com'],
  },
}

const normalizeAppName = (name: string) => name.trim().toLowerCase()
const defaultTelemetry = (): FocusTelemetry => ({
  score: 100,
  driftSeconds: 0,
  blockedSeconds: 0,
  neutralSeconds: 0,
  allowSeconds: 0,
  longestDriftSeconds: 0,
  currentDriftStartedAt: null,
  currentDriftSeconds: 0,
  workflowSwitches: 0,
  riskSwitches: 0,
  totalSwitches: 0,
  pullbackCount: 0,
  recoveryCount: 0,
  lastPullbackAt: 0,
  lastRecoveredAt: 0,
  lastRiskStartedAt: null,
  microStart: false,
  lastAppKey: '',
  lastRule: 'neutral',
  lastUpdatedAt: Date.now(),
})

const uniqueCleanList = (items: string[]) =>
  Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))

const classifyApp = (
  app: string,
  title: string,
  domain: string,
  allowlist: string[],
  blocklist: string[],
  allowTitleKeywords: string[],
  blockTitleKeywords: string[],
  allowDomains: string[],
  blockDomains: string[],
): AppRule => {
  const normalized = normalizeAppName(app)
  const normalizedTitle = normalizeAppName(title)
  const normalizedDomain = normalizeAppName(domain).replace(/^www\./, '')
  if (normalizedDomain && blockDomains.some(item => normalizedDomain === normalizeAppName(item) || normalizedDomain.endsWith(`.${normalizeAppName(item)}`))) return 'block'
  if (normalizedDomain && allowDomains.some(item => normalizedDomain === normalizeAppName(item) || normalizedDomain.endsWith(`.${normalizeAppName(item)}`))) return 'allow'
  if (/\b(kimi|moonshot|claude|chatgpt|openai|doubao|豆包)\b/.test(`${normalizedTitle} ${normalizedDomain}`)) return 'allow'
  if (blockTitleKeywords.some(item => normalizedTitle.includes(normalizeAppName(item)))) return 'block'
  if (allowTitleKeywords.some(item => normalizedTitle.includes(normalizeAppName(item)))) return 'allow'
  if (blocklist.some(item => normalized.includes(normalizeAppName(item)))) return 'block'
  if (allowlist.some(item => normalized.includes(normalizeAppName(item)))) return 'allow'
  if (!normalized || normalized === 'unknown') return 'neutral'
  return 'neutral'
}

export const usePetStore = create<PetStore>((set, get) => ({
  petName: '小灵',
  stardust: 0,
  focusActive: false,
  timerMode: 'idle',
  focusRemaining: 0,
  focusDuration: 25,
  focusStartedAt: 0,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  completedPomoCount: 0,
  currentTaskId: null,
  distractionCount: 0,
  currentApp: null,
  appUsage: {},
  focusTelemetry: defaultTelemetry(),
  allowlistApps: DEFAULT_ALLOWLIST,
  blocklistApps: DEFAULT_BLOCKLIST,
  allowTitleKeywords: DEFAULT_ALLOW_TITLE_KEYWORDS,
  blockTitleKeywords: DEFAULT_BLOCK_TITLE_KEYWORDS,
  allowDomains: DEFAULT_ALLOW_DOMAINS,
  blockDomains: DEFAULT_BLOCK_DOMAINS,
  focusProfile: null,
  emergencyUntil: 0,
  tasks: [],
  focusHistory: [],
  focusEvents: [],

  setPetName: (name) => set({ petName: name }),
  addStardust: (amount) => set(s => ({ stardust: s.stardust + amount })),

  startFocus: (taskId, durationMin, options) => {
    const telemetry = defaultTelemetry()
    telemetry.microStart = !!options?.microStart
    const now = Date.now()
    set({
      focusActive: true,
      timerMode: 'focus',
      focusRemaining: durationMin * 60,
      focusDuration: durationMin,
      focusStartedAt: now,
      currentTaskId: taskId,
      distractionCount: 0,
      focusTelemetry: telemetry,
      focusEvents: [{ id: generateId(), type: 'start', timestamp: now, note: options?.microStart ? 'micro-start' : 'focus' }],
    })
  },

  setFocusDuration: (minutes) =>
    set({ focusDuration: Math.max(5, Math.min(120, minutes)) }),

  setBreakDurations: (shortMinutes, longMinutes) =>
    set({
      shortBreakDuration: Math.max(1, Math.min(30, shortMinutes)),
      longBreakDuration: Math.max(5, Math.min(60, longMinutes)),
    }),

  pauseFocus: () => {
    get().addFocusEvent({ type: 'pause' })
    set({ focusActive: false })
  },
  resumeFocus: () => {
    get().addFocusEvent({ type: 'resume' })
    set({ focusActive: true })
  },

  tickFocus: (remaining) => set({ focusRemaining: remaining }),

  completeFocus: () => {
    const s = get()
    const session: FocusSession = {
      id: generateId(),
      taskId: s.currentTaskId ?? '',
      plannedDuration: s.focusDuration,
      actualDuration: s.focusDuration - Math.floor(s.focusRemaining / 60),
      distractions: s.distractionCount,
      score: Math.round(s.focusTelemetry.score),
      driftSeconds: s.focusTelemetry.driftSeconds,
      blockedSeconds: s.focusTelemetry.blockedSeconds,
      neutralSeconds: s.focusTelemetry.neutralSeconds,
      longestDriftSeconds: s.focusTelemetry.longestDriftSeconds,
      pullbackCount: s.focusTelemetry.pullbackCount,
      recoveryCount: s.focusTelemetry.recoveryCount,
      microStart: s.focusTelemetry.microStart,
      events: [...s.focusEvents, { id: generateId(), type: 'complete', timestamp: Date.now() }],
      startedAt: Date.now() - (s.focusDuration * 60 - s.focusRemaining) * 1000,
      endedAt: Date.now(),
    }
    const stardustEarned = Math.floor(s.focusDuration / 5) * 5
    set(s2 => ({
      focusActive: false,
      timerMode: 'idle',
      focusRemaining: 0,
      focusStartedAt: 0,
      currentTaskId: null,
      distractionCount: 0,
      focusEvents: [],
      stardust: s2.stardust + stardustEarned,
      completedPomoCount: s2.completedPomoCount + 1,
      focusHistory: [...s2.focusHistory, session],
    }))
  },

  startBreak: (mode, durationMin) =>
    set(s => ({
      focusActive: true,
      timerMode: mode,
      focusRemaining: (durationMin ?? (mode === 'longBreak' ? s.longBreakDuration : s.shortBreakDuration)) * 60,
    })),

  completeBreak: () =>
    set({
      focusActive: false,
      timerMode: 'idle',
      focusRemaining: 0,
      focusStartedAt: 0,
    }),

  abandonFocus: () => {
    get().addFocusEvent({ type: 'abandon' })
    set({
      focusActive: false,
      timerMode: 'idle',
      focusRemaining: 0,
      currentTaskId: null,
      distractionCount: 0,
    })
  },

  addDistraction: () => {
    const app = get().currentApp
    get().addFocusEvent({
      type: app?.rule === 'block' ? 'blocked' : 'drift',
      app: app?.app,
      title: app?.title,
    })
    set(s => ({ distractionCount: s.distractionCount + 1 }))
  },

  addFocusEvent: (event) =>
    set(s => ({
      focusEvents: [
        ...s.focusEvents,
        { ...event, id: generateId(), timestamp: event.timestamp ?? Date.now() },
      ],
    })),

  recordPullback: (level, reason, message) => {
    get().addFocusEvent({ type: 'pullback', level, note: `${reason}:${message}` })
    set(s => ({
      focusTelemetry: {
        ...s.focusTelemetry,
        pullbackCount: s.focusTelemetry.pullbackCount + 1,
        lastPullbackAt: Date.now(),
      },
    }))
  },

  extendFocus: (minutes) => {
    get().addFocusEvent({ type: 'micro-extend', seconds: minutes * 60 })
    set(s => ({
      focusRemaining: s.focusRemaining + minutes * 60,
      focusDuration: s.focusDuration + minutes,
    }))
  },

  activateEmergencyUse: (minutes = 3) =>
    set({ emergencyUntil: Date.now() + minutes * 60 * 1000 }),

  clearEmergencyUse: () => set({ emergencyUntil: 0 }),

  recordForegroundApp: (info) => {
    const s = get()
    const now = info.timestamp || Date.now()
    const app = info.app || 'unknown'
    const rule = classifyApp(
      app,
      info.title,
      info.domain ?? '',
      s.allowlistApps,
      s.blocklistApps,
      s.allowTitleKeywords,
      s.blockTitleKeywords,
      s.allowDomains,
      s.blockDomains,
    )
    const snapshot: ForegroundAppSnapshot = { ...info, app, timestamp: now, rule }

    if (normalizeAppName(app).includes('focuspet')) return snapshot

    set(state => {
      const previous = state.currentApp
      const usage = { ...state.appUsage }
      const telemetry = { ...state.focusTelemetry }
      const previousApp = previous?.app || app
      const currentKey = normalizeAppName(app)
      const elapsed = previous
        ? Math.max(0, Math.min(10, Math.round((now - previous.timestamp) / 1000)))
        : 0

      if (previousApp && elapsed > 0) {
        const key = normalizeAppName(previousApp)
        const existing = usage[key]
        usage[key] = {
          app: previousApp,
          title: previous?.title ?? '',
          seconds: (existing?.seconds ?? 0) + elapsed,
          rule: previous?.rule ?? 'neutral',
          lastSeenAt: now,
        }
      }

      if (telemetry.lastAppKey && telemetry.lastAppKey !== currentKey) {
        telemetry.totalSwitches += 1
        if (state.focusActive) {
          get().addFocusEvent({
            type: 'switch',
            app,
            title: info.title,
            rule,
          })
        }
        if (telemetry.lastRule === 'allow' && rule === 'allow') {
          telemetry.workflowSwitches += 1
        } else if (rule !== 'allow' || telemetry.lastRule !== 'allow') {
          telemetry.riskSwitches += 1
        }
      }

      if (rule === 'allow') {
        telemetry.score = Math.min(100, telemetry.score + (state.focusActive ? 2 : 1))
        telemetry.allowSeconds += elapsed
        if (state.focusActive && telemetry.lastRule !== 'allow' && telemetry.lastRule !== 'neutral') {
          telemetry.recoveryCount += 1
          telemetry.lastRecoveredAt = now
          get().addFocusEvent({ type: 'recover', app, title: info.title, seconds: elapsed })
        }
        telemetry.currentDriftStartedAt = null
        telemetry.currentDriftSeconds = 0
        telemetry.driftSeconds = Math.max(0, telemetry.driftSeconds - elapsed * 2)
        telemetry.blockedSeconds = Math.max(0, telemetry.blockedSeconds - elapsed)
      } else if (rule === 'neutral') {
        telemetry.neutralSeconds += elapsed
        telemetry.driftSeconds += elapsed
        telemetry.currentDriftStartedAt = telemetry.currentDriftStartedAt ?? now
        telemetry.currentDriftSeconds += elapsed
        telemetry.longestDriftSeconds = Math.max(telemetry.longestDriftSeconds, telemetry.currentDriftSeconds)
        if (state.focusActive && telemetry.driftSeconds > 20) {
          telemetry.score = Math.max(0, telemetry.score - 1)
        }
      } else {
        telemetry.blockedSeconds += elapsed
        telemetry.lastRiskStartedAt = telemetry.lastRiskStartedAt ?? now
        telemetry.currentDriftStartedAt = telemetry.currentDriftStartedAt ?? now
        telemetry.currentDriftSeconds += elapsed
        telemetry.longestDriftSeconds = Math.max(telemetry.longestDriftSeconds, telemetry.currentDriftSeconds)
        telemetry.score = Math.max(0, telemetry.score - (state.focusActive ? 4 : 2))
      }

      if (state.focusActive && telemetry.riskSwitches > 6) {
        telemetry.score = Math.max(0, telemetry.score - 1)
      }

      telemetry.lastAppKey = currentKey
      telemetry.lastRule = rule
      telemetry.lastUpdatedAt = now

      return { currentApp: snapshot, appUsage: usage, focusTelemetry: telemetry }
    })

    return snapshot
  },

  resetFocusTelemetry: () => set({ focusTelemetry: defaultTelemetry() }),

  setAppRules: (rules) =>
    set({
      allowlistApps: uniqueCleanList(rules.allowlistApps),
      blocklistApps: uniqueCleanList(rules.blocklistApps),
      allowTitleKeywords: uniqueCleanList(rules.allowTitleKeywords),
      blockTitleKeywords: uniqueCleanList(rules.blockTitleKeywords),
      allowDomains: uniqueCleanList(rules.allowDomains),
      blockDomains: uniqueCleanList(rules.blockDomains),
      focusProfile: null,
    }),

  applyFocusProfile: (profile) => {
    const rules = FOCUS_PROFILES[profile]
    set({
      allowlistApps: uniqueCleanList([...DEFAULT_ALLOWLIST, ...rules.allowlistApps]),
      blocklistApps: uniqueCleanList([...DEFAULT_BLOCKLIST, ...rules.blocklistApps]),
      allowTitleKeywords: uniqueCleanList([...DEFAULT_ALLOW_TITLE_KEYWORDS, ...rules.allowTitleKeywords]),
      blockTitleKeywords: uniqueCleanList([...DEFAULT_BLOCK_TITLE_KEYWORDS, ...rules.blockTitleKeywords]),
      allowDomains: uniqueCleanList([...DEFAULT_ALLOW_DOMAINS, ...rules.allowDomains]),
      blockDomains: uniqueCleanList([...DEFAULT_BLOCK_DOMAINS, ...rules.blockDomains]),
      focusProfile: profile,
    })
  },

  hydrateAppMonitor: (state) => {
    if (!state) return
    set({
      allowlistApps: uniqueCleanList([...(state.allowlistApps ?? []), ...DEFAULT_ALLOWLIST]),
      blocklistApps: uniqueCleanList([...(state.blocklistApps ?? []), ...DEFAULT_BLOCKLIST]),
      allowTitleKeywords: uniqueCleanList([...(state.allowTitleKeywords ?? []), ...DEFAULT_ALLOW_TITLE_KEYWORDS]),
      blockTitleKeywords: uniqueCleanList([...(state.blockTitleKeywords ?? []), ...DEFAULT_BLOCK_TITLE_KEYWORDS]),
      allowDomains: uniqueCleanList([...(state.allowDomains ?? []), ...DEFAULT_ALLOW_DOMAINS]),
      blockDomains: uniqueCleanList([...(state.blockDomains ?? []), ...DEFAULT_BLOCK_DOMAINS]),
      focusProfile: (state as Partial<AppMonitorState> & { focusProfile?: FocusProfile | null }).focusProfile ?? null,
      emergencyUntil: state.emergencyUntil ?? 0,
      appUsage: state.appUsage ?? {},
    })
  },

  exportAppMonitorState: () => {
    const s = get()
    return {
      allowlistApps: s.allowlistApps,
      blocklistApps: s.blocklistApps,
      allowTitleKeywords: s.allowTitleKeywords,
      blockTitleKeywords: s.blockTitleKeywords,
      allowDomains: s.allowDomains,
      blockDomains: s.blockDomains,
      focusProfile: s.focusProfile,
      emergencyUntil: s.emergencyUntil,
      appUsage: s.appUsage,
      savedAt: Date.now(),
    }
  },

  hydrateAppState: (state) => {
    if (!state) return
    set({
      petName: state.petName ?? '小灵',
      stardust: state.stardust ?? 0,
      tasks: state.tasks ?? [],
      focusHistory: state.focusHistory ?? [],
      focusDuration: state.focusDuration ?? 25,
      shortBreakDuration: state.shortBreakDuration ?? 5,
      longBreakDuration: state.longBreakDuration ?? 15,
      completedPomoCount: state.completedPomoCount ?? 0,
    })
  },

  exportAppState: () => {
    const s = get()
    return {
      petName: s.petName,
      stardust: s.stardust,
      tasks: s.tasks,
      focusHistory: s.focusHistory,
      focusDuration: s.focusDuration,
      shortBreakDuration: s.shortBreakDuration,
      longBreakDuration: s.longBreakDuration,
      completedPomoCount: s.completedPomoCount,
      savedAt: Date.now(),
    }
  },

  addTask: (task) =>
    set(s => ({
      tasks: [
        ...s.tasks,
        { ...task, id: generateId(), createdAt: Date.now() },
      ],
    })),

  importTasks: (text) => {
    const lines = text
      .split(/\r?\n/)
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
    const tasks = lines.map(line => parseImportedTask(line))
    set(s => ({
      tasks: [
        ...s.tasks,
        ...tasks.map(task => ({ ...task, id: generateId(), createdAt: Date.now() })),
      ],
    }))
    return tasks.length
  },

  updateTask: (id, patch) =>
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t),
    })),

  breakDownTask: (id) => {
    const parent = get().tasks.find(t => t.id === id)
    if (!parent) return 0
    const subtasks = createTemplateSubtasks(parent)
    set(s => ({
      tasks: [
        ...s.tasks,
        ...subtasks.map((task, index) => ({
          ...task,
          id: generateId(),
          createdAt: Date.now() + index,
        })),
      ],
    }))
    return subtasks.length
  },

  completeTask: (id) =>
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id ? { ...t, status: 'done' as const } : t
      ),
    })),

  deleteTask: (id) =>
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),
}))

function parseImportedTask(line: string): Omit<Task, 'id' | 'createdAt'> {
  const timeRange = line.match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/)
  const singleTime = line.match(/(?:提醒|@)\s*(\d{1,2}:\d{2})/)
  const priority = line.includes('!!!') || line.includes('高') ? 'high'
    : line.includes('低') ? 'low'
      : 'medium'
  const cleanName = line
    .replace(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/, '')
    .replace(/(?:提醒|@)\s*\d{1,2}:\d{2}/, '')
    .replace(/[!！]{1,3}/g, '')
    .replace(/\b高\b|\b中\b|\b低\b/g, '')
    .trim()

  const today = new Date()
  const atToday = (value: string) => {
    const [h, m] = value.split(':').map(Number)
    const d = new Date(today)
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }

  return {
    name: cleanName || line,
    estimatedPomos: 1,
    completedPomos: 0,
    priority,
    status: 'todo',
    startAt: timeRange ? atToday(timeRange[1]) : undefined,
    endAt: timeRange ? atToday(timeRange[2]) : undefined,
    reminderAt: singleTime ? atToday(singleTime[1]) : timeRange ? atToday(timeRange[1]) : undefined,
  }
}

function createTemplateSubtasks(task: Task): Array<Omit<Task, 'id' | 'createdAt'>> {
  const base = task.name.replace(/^拆解[:：]\s*/, '').trim()
  const priority = task.priority
  return [
    `明确「${base}」的完成标准`,
    `打开相关资料/项目文件`,
    `写下下一步最小动作`,
    `完成 10 分钟可验证推进`,
    `收尾并记录卡点`,
  ].map((name, index) => ({
    name,
    estimatedPomos: index === 3 ? 1 : 0,
    completedPomos: 0,
    priority,
    status: 'todo',
    startAt: undefined,
    endAt: undefined,
    reminderAt: undefined,
  }))
}
