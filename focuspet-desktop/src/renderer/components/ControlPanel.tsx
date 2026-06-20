import { useEffect, useState, useCallback } from 'react'
import { Timer, ListFilter, BarChart3, Minimize2 } from 'lucide-react'
import TimerPanel from './TimerPanel'
import TaskPanel from './TaskPanel'
import { usePetStore, type Task } from '../stores/usePetStore'

type Tab = 'timer' | 'tasks' | 'stats'

export default function ControlPanel({
  anchor,
  onClose,
  onAppMonitorChange,
}: {
  anchor: 'left' | 'right'
  onClose: () => void
  onAppMonitorChange: () => void
}) {
  const [tab, setTab] = useState<Tab>('timer')
  const { stardust, focusActive } = usePetStore()

  return (
    <>
      {/* 控制面板 */}
      <div
        className={`absolute z-[100] ${anchor === 'left' ? 'left-[234px]' : 'right-3'} top-3 bottom-3 w-80 bg-[#0F0F13]/95 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden`}
        style={{ pointerEvents: 'auto' }}
        onMouseEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
      >
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <span className="text-sm font-bold text-white">FocusPet</span>
          <div className="flex items-center gap-1">
            {/* 星尘 */}
            <span className="text-xs text-[#FBBF24] font-mono mr-2">
              ⭐ {stardust}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white/80 transition-colors"
              title="收起面板"
            >
              <Minimize2 size={14} />
            </button>
          </div>
        </div>

        {/* Tab 导航 */}
        <div className="flex border-b border-white/5 shrink-0">
          {([
            ['timer', Timer, '计时'],
            ['tasks', ListFilter, '任务'],
            ['stats', BarChart3, '统计'],
          ] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs transition-colors ${
                tab === key
                  ? 'text-[#A78BFA] border-b-2 border-[#A78BFA]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-4 soft-scrollbar">
          {tab === 'timer' && <TimerPanel />}
          {tab === 'tasks' && <TaskPanel />}
          {tab === 'stats' && <StatsPanel onAppMonitorChange={onAppMonitorChange} />}
        </div>

        {/* 状态栏 */}
        {focusActive && (
          <div className="px-4 py-2 border-t border-white/5 text-xs text-[#A78BFA] text-center animate-pulse shrink-0">
            🔒 专注模式已开启
          </div>
        )}
      </div>
    </>
  )
}

/** 统计面板 */
function StatsPanel({ onAppMonitorChange }: { onAppMonitorChange: () => void }) {
  const {
    focusHistory, tasks, stardust, currentApp, appUsage, focusTelemetry, currentTaskId,
    allowlistApps, blocklistApps, allowTitleKeywords, blockTitleKeywords,
    allowDomains, blockDomains,
    focusProfile, emergencyUntil, activateEmergencyUse, clearEmergencyUse, setAppRules,
    applyFocusProfile,
  } = usePetStore()
  const [editingRules, setEditingRules] = useState(false)
  const [allowAppsText, setAllowAppsText] = useState(() => allowlistApps.join('\n'))
  const [blockAppsText, setBlockAppsText] = useState(() => blocklistApps.join('\n'))
  const [allowTitleText, setAllowTitleText] = useState(() => allowTitleKeywords.join('\n'))
  const [blockTitleText, setBlockTitleText] = useState(() => blockTitleKeywords.join('\n'))
  const [allowDomainsText, setAllowDomainsText] = useState(() => allowDomains.join('\n'))
  const [blockDomainsText, setBlockDomainsText] = useState(() => blockDomains.join('\n'))

  useEffect(() => {
    if (editingRules) return
    setAllowAppsText(allowlistApps.join('\n'))
    setBlockAppsText(blocklistApps.join('\n'))
    setAllowTitleText(allowTitleKeywords.join('\n'))
    setBlockTitleText(blockTitleKeywords.join('\n'))
    setAllowDomainsText(allowDomains.join('\n'))
    setBlockDomainsText(blockDomains.join('\n'))
  }, [allowlistApps, blocklistApps, allowTitleKeywords, blockTitleKeywords, allowDomains, blockDomains, editingRules])
  const today = new Date().toDateString()
  const todaySessions = focusHistory.filter(
    s => new Date(s.startedAt).toDateString() === today
  )
  const todayMinutes = Math.floor(
    todaySessions.reduce((sum, s) => sum + (s.actualDuration || 0), 0)
  )
  const todayTasks = tasks.filter(t => t.status === 'done').length
  const streak = calcStreak(focusHistory)
  const appRows = Object.values(appUsage)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5)
  const emergencyActive = Date.now() < emergencyUntil
  const emergencyLeft = emergencyActive ? Math.ceil((emergencyUntil - Date.now()) / 1000) : 0
  const weekRollup = calcRecentRollup(focusHistory, 7)
  const todayRollup = calcRecentRollup(focusHistory, 1)
  const currentTask = tasks.find(t => t.id === currentTaskId)
  const taskRuntime = getTaskRuntimeState(currentTask, currentApp)

  const persistRules = useCallback((rules: {
    allowlistApps: string[]
    blocklistApps: string[]
    allowTitleKeywords: string[]
    blockTitleKeywords: string[]
    allowDomains: string[]
    blockDomains: string[]
  }) => {
    setAppRules(rules)
    onAppMonitorChange()
  }, [setAppRules, onAppMonitorChange])

  const saveRules = useCallback(() => {
    persistRules({
      allowlistApps: textToList(allowAppsText),
      blocklistApps: textToList(blockAppsText),
      allowTitleKeywords: textToList(allowTitleText),
      blockTitleKeywords: textToList(blockTitleText),
      allowDomains: textToList(allowDomainsText),
      blockDomains: textToList(blockDomainsText),
    })
    setEditingRules(false)
  }, [
    allowAppsText,
    blockAppsText,
    allowTitleText,
    blockTitleText,
    allowDomainsText,
    blockDomainsText,
    persistRules,
  ])

  const addCurrentRule = useCallback((target: 'app' | 'domain', rule: 'allow' | 'block') => {
    const value = target === 'app' ? currentApp?.app : currentApp?.domain
    if (!value) return
    const next = {
      allowlistApps: [...allowlistApps],
      blocklistApps: [...blocklistApps],
      allowTitleKeywords: [...allowTitleKeywords],
      blockTitleKeywords: [...blockTitleKeywords],
      allowDomains: [...allowDomains],
      blockDomains: [...blockDomains],
    }
    if (target === 'app') {
      const list = rule === 'allow' ? next.allowlistApps : next.blocklistApps
      if (!list.some(item => item.toLowerCase() === value.toLowerCase())) list.push(value)
    } else {
      const list = rule === 'allow' ? next.allowDomains : next.blockDomains
      if (!list.some(item => item.toLowerCase() === value.toLowerCase())) list.push(value)
    }
    persistRules(next)
  }, [
    currentApp,
    allowlistApps,
    blocklistApps,
    allowTitleKeywords,
    blockTitleKeywords,
    allowDomains,
    blockDomains,
    persistRules,
  ])

  const handleCopyDiagnostics = useCallback(() => {
    window.electronAPI?.copyDiagnostics()
  }, [])

  const handleResetPosition = useCallback(() => {
    window.electronAPI?.resetWindowPosition()
  }, [])

  const applyProfile = useCallback((profile: 'programming' | 'writing' | 'study' | 'strict') => {
    applyFocusProfile(profile)
    onAppMonitorChange()
    setEditingRules(false)
  }, [applyFocusProfile, onAppMonitorChange])

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="今日专注" value={`${todayMinutes} 分钟`} color="#A78BFA" />
        <StatCard label="今日任务" value={`${todayTasks} 个`} color="#34D399" />
        <StatCard label="连续天数" value={`${streak} 天`} color="#FBBF24" />
        <StatCard label="总星尘" value={`${stardust}`} color="#F472B6" />
      </div>

      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/40">专注评分</span>
          <span className="text-sm font-mono font-bold" style={{ color: scoreColor(focusTelemetry.score) }}>
            {Math.round(focusTelemetry.score)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, focusTelemetry.score))}%`,
              background: scoreColor(focusTelemetry.score),
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] text-white/35">
          <span>漂移 {formatDuration(focusTelemetry.driftSeconds)}</span>
          <span>风险 {focusTelemetry.riskSwitches}</span>
          <span>切换 {focusTelemetry.workflowSwitches}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] text-white/35">
          <span>拉回 {focusTelemetry.pullbackCount}</span>
          <span>恢复 {focusTelemetry.recoveryCount}</span>
          <span>最长 {formatDuration(focusTelemetry.longestDriftSeconds)}</span>
        </div>
      </div>

      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/40">趋势</span>
          <span className="text-[10px] text-white/25">今日 / 7天</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px] text-white/50">
          <div>
            <div className="text-white/25">专注</div>
            <div>{todayRollup.minutes}m / {weekRollup.minutes}m</div>
          </div>
          <div>
            <div className="text-white/25">拉回</div>
            <div>{todayRollup.pullbacks} / {weekRollup.pullbacks}</div>
          </div>
          <div>
            <div className="text-white/25">均分</div>
            <div>{todayRollup.avgScore} / {weekRollup.avgScore}</div>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/40">专注模板</span>
          <span className="text-[10px] text-white/25">{focusProfile ? profileLabel(focusProfile) : '自定义'}</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {([
            ['programming', '编程'],
            ['writing', '写作'],
            ['study', '学习'],
            ['strict', '严格'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => applyProfile(key)}
              className={`px-2 py-1.5 rounded-lg text-xs transition-colors ${
                focusProfile === key
                  ? 'bg-[#A78BFA]/20 text-[#A78BFA]'
                  : 'bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white/75'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-white/40">轻量锁</div>
            <div className="text-xs text-white/60 mt-1">
              {emergencyActive ? `紧急使用剩余 ${formatDuration(emergencyLeft)}` : '持续走神时展开面板拉回'}
            </div>
          </div>
          <button
            onClick={() => emergencyActive ? clearEmergencyUse() : activateEmergencyUse(3)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              emergencyActive
                ? 'text-[#F472B6] bg-[#F472B6]/10 hover:bg-[#F472B6]/20'
                : 'text-[#FBBF24] bg-[#FBBF24]/10 hover:bg-[#FBBF24]/20'
            }`}
          >
            {emergencyActive ? '结束' : '紧急3分'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs text-white/40 font-medium">当前应用</h4>
          <button
            onClick={() => setEditingRules(v => !v)}
            className="text-xs text-white/35 hover:text-white/70 transition-colors"
          >
            规则
          </button>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/80 truncate">
              {currentApp?.app ?? '未检测到'}
            </span>
            <span
              className="text-xs font-mono shrink-0"
              style={{ color: ruleColor(currentApp?.rule ?? 'neutral') }}
            >
              {ruleLabel(currentApp?.rule ?? 'neutral')}
            </span>
          </div>
          {currentApp?.title && (
            <div className="text-xs text-white/30 mt-1 truncate">{currentApp.title}</div>
          )}
          {currentApp?.domain && (
            <div className="text-xs text-white/30 mt-1 truncate">{currentApp.domain}</div>
          )}
          {currentApp?.context?.summary && (
            <div className="text-[10px] text-white/25 mt-1 truncate">
              {contextLabel(currentApp.context.kind)} · {currentApp.context.summary}
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-white/25">
            <span>PID {currentApp?.pid || '-'}</span>
            <span className="text-right">{currentApp?.timestamp ? formatClock(currentApp.timestamp) : '等待检测'}</span>
          </div>
          {currentApp?.path && (
            <div className="mt-1 truncate text-[10px] text-white/20" title={currentApp.path}>
              {currentApp.path}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-1">
            <button
              onClick={() => addCurrentRule('app', 'allow')}
              disabled={!currentApp?.app}
              className="rounded-lg bg-[#34D399]/10 px-2 py-1 text-[11px] text-[#34D399] hover:bg-[#34D399]/20 disabled:opacity-30"
            >
              允许应用
            </button>
            <button
              onClick={() => addCurrentRule('app', 'block')}
              disabled={!currentApp?.app}
              className="rounded-lg bg-[#F472B6]/10 px-2 py-1 text-[11px] text-[#F472B6] hover:bg-[#F472B6]/20 disabled:opacity-30"
            >
              拉黑应用
            </button>
            <button
              onClick={() => addCurrentRule('domain', 'allow')}
              disabled={!currentApp?.domain}
              className="rounded-lg bg-[#34D399]/10 px-2 py-1 text-[11px] text-[#34D399] hover:bg-[#34D399]/20 disabled:opacity-30"
            >
              允许域名
            </button>
            <button
              onClick={() => addCurrentRule('domain', 'block')}
              disabled={!currentApp?.domain}
              className="rounded-lg bg-[#F472B6]/10 px-2 py-1 text-[11px] text-[#F472B6] hover:bg-[#F472B6]/20 disabled:opacity-30"
            >
              拉黑域名
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/40">任务状态</span>
          <span className="text-[10px]" style={{ color: taskRuntime.color }}>{taskRuntime.label}</span>
        </div>
        <div className="mt-1 truncate text-xs text-white/55">
          {currentTask?.name ?? '未绑定任务'}
        </div>
        <div className="mt-1 text-[10px] text-white/25 leading-relaxed">
          {taskRuntime.detail}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleResetPosition}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-white/45 hover:bg-white/[0.07] hover:text-white/75"
        >
          重置位置
        </button>
        <button
          onClick={handleCopyDiagnostics}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-white/45 hover:bg-white/[0.07] hover:text-white/75"
        >
          复制诊断
        </button>
      </div>

      {editingRules && (
        <div className="space-y-3">
          <RuleEditor label="白名单应用" value={allowAppsText} onChange={setAllowAppsText} />
          <RuleEditor label="黑名单应用" value={blockAppsText} onChange={setBlockAppsText} />
          <RuleEditor label="白名单标题关键词" value={allowTitleText} onChange={setAllowTitleText} />
          <RuleEditor label="黑名单标题关键词" value={blockTitleText} onChange={setBlockTitleText} />
          <RuleEditor label="白名单域名" value={allowDomainsText} onChange={setAllowDomainsText} />
          <RuleEditor label="黑名单域名" value={blockDomainsText} onChange={setBlockDomainsText} />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditingRules(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-white/45 hover:text-white/75 hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              onClick={saveRules}
              className="px-3 py-1.5 rounded-lg text-xs text-[#34D399] bg-[#34D399]/10 hover:bg-[#34D399]/20 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs text-white/40 font-medium">应用状态</h4>
        {appRows.map(app => (
          <div key={`${app.app}:${app.title}`} className="grid grid-cols-[1fr_auto] gap-2 text-xs text-white/60">
            <div className="min-w-0">
              <div className="truncate">{app.app}</div>
              {app.title && <div className="truncate text-[10px] text-white/25">{app.title}</div>}
            </div>
            <div className="text-right shrink-0">
              <div style={{ color: ruleColor(app.rule) }}>{formatDuration(app.seconds)}</div>
              <div className="text-[10px] text-white/25">{ruleLabel(app.rule)}</div>
            </div>
          </div>
        ))}
        {appRows.length === 0 && (
          <div className="text-center text-white/20 text-sm py-3">正在收集应用状态</div>
        )}
      </div>

      {/* 最近专注记录 */}
      <div className="space-y-2">
        <h4 className="text-xs text-white/40 font-medium">最近专注</h4>
        {focusHistory.slice(-5).reverse().map(s => (
          <div key={s.id} className="rounded-lg bg-white/[0.025] border border-white/[0.05] px-3 py-2">
            <div className="flex justify-between text-xs text-white/65">
              <span>{new Date(s.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>{s.actualDuration || s.plannedDuration} 分钟</span>
              <span style={{ color: scoreColor(s.score ?? 100) }}>{s.score ?? 100}</span>
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-white/30">
              <span>{s.distractions > 0 ? `走神 ${s.distractions} 次` : '全神贯注'}</span>
              <span>漂移 {formatDuration(s.driftSeconds ?? 0)}</span>
              <span>拉回 {s.pullbackCount ?? 0}</span>
            </div>
          </div>
        ))}
        {focusHistory.length === 0 && (
          <div className="text-center text-white/20 text-sm py-4">还没有专注记录</div>
        )}
      </div>
    </div>
  )
}

function RuleEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-xs text-white/35 mb-1">{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 py-1.5 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-[#A78BFA]/50 soft-scrollbar"
      />
    </label>
  )
}

function textToList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function ruleLabel(rule: 'allow' | 'block' | 'neutral'): string {
  if (rule === 'allow') return '白名单'
  if (rule === 'block') return '黑名单'
  return '观察'
}

function ruleColor(rule: 'allow' | 'block' | 'neutral'): string {
  if (rule === 'allow') return '#34D399'
  if (rule === 'block') return '#F472B6'
  return '#FBBF24'
}

function profileLabel(profile: string): string {
  if (profile === 'programming') return '编程'
  if (profile === 'writing') return '写作'
  if (profile === 'study') return '学习'
  if (profile === 'strict') return '严格'
  return '自定义'
}

function contextLabel(kind: string): string {
  if (kind === 'browser') return '浏览器'
  if (kind === 'editor') return '编辑器'
  if (kind === 'ai') return 'AI'
  if (kind === 'terminal') return '终端'
  if (kind === 'dev-server') return '本地服务'
  return '应用'
}

function getTaskRuntimeState(task: Task | undefined, app: ReturnType<typeof usePetStore.getState>['currentApp']) {
  if (!task) return { label: '未开始', color: '#A1A1AA', detail: '开始专注后会绑定当前任务。' }
  if (!app) return { label: '等待检测', color: '#FBBF24', detail: '还没有收到前台应用状态。' }
  const contextCount = (task.expectedApps?.length ?? 0) + (task.expectedDomains?.length ?? 0) + (task.expectedKeywords?.length ?? 0)
  const kind = app.context?.kind
  if (kind === 'ai' || kind === 'terminal' || kind === 'dev-server') {
    return { label: '任务可能在跑', color: '#34D399', detail: `${contextLabel(kind)}：${app.context?.summary ?? app.title}` }
  }
  if (contextCount > 0 && app.rule === 'allow') {
    return { label: '工作范围匹配', color: '#34D399', detail: '当前应用/网站适合这个任务。' }
  }
  if (contextCount > 0 && app.rule === 'neutral') {
    return { label: '待确认', color: '#FBBF24', detail: '当前应用不在这个任务的工作范围里。' }
  }
  if (app.rule === 'block') {
    return { label: '风险中', color: '#F472B6', detail: '当前应用命中黑名单。' }
  }
  return { label: '观察中', color: '#FBBF24', detail: '当前应用还没有明确归类。' }
}

function calcRecentRollup(history: Array<{ startedAt: number; actualDuration: number; plannedDuration: number; score?: number; pullbackCount?: number }>, days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000
  const rows = history.filter(item => item.startedAt >= since)
  const minutes = Math.round(rows.reduce((sum, item) => sum + (item.actualDuration || item.plannedDuration || 0), 0))
  const pullbacks = rows.reduce((sum, item) => sum + (item.pullbackCount ?? 0), 0)
  const avgScore = rows.length ? Math.round(rows.reduce((sum, item) => sum + (item.score ?? 100), 0) / rows.length) : 0
  return { minutes, pullbacks, avgScore }
}

function scoreColor(score: number): string {
  if (score >= 80) return '#34D399'
  if (score >= 60) return '#FBBF24'
  return '#F472B6'
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  )
}

function calcStreak(history: { startedAt: number }[]): number {
  if (history.length === 0) return 0
  const days = new Set(history.map(h => new Date(h.startedAt).toDateString()))
  let streak = 0
  const d = new Date()
  while (days.has(d.toDateString())) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}
