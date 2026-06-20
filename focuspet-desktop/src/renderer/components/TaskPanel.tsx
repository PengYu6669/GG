import { useState } from 'react'
import { Plus, Trash2, CheckCircle2, Circle, Flag, ClipboardList, ClipboardPaste, Sparkles } from 'lucide-react'
import { usePetStore, type Task } from '../stores/usePetStore'

const priorityColors: Record<Task['priority'], string> = {
  high: '#F472B6',
  medium: '#FBBF24',
  low: '#A1A1AA',
}

export default function TaskPanel() {
  const { tasks, addTask, importTasks, updateTask, breakDownTask, completeTask, deleteTask } = usePetStore()
  const [newName, setNewName] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('medium')
  const [view, setView] = useState<'scheduled' | 'unscheduled' | 'all' | 'done'>('scheduled')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [estimatedPomos, setEstimatedPomos] = useState(1)

  const filteredTasks = tasks.filter(t => {
    if (view === 'done') return t.status === 'done'
    if (view === 'scheduled') return t.status !== 'done' && !!t.startAt
    if (view === 'unscheduled') return t.status !== 'done' && !t.startAt
    return true
  }).sort((a, b) => (a.startAt ?? Number.MAX_SAFE_INTEGER) - (b.startAt ?? Number.MAX_SAFE_INTEGER))

  const handleAdd = () => {
    if (!newName.trim()) return
    addTask({
      name: newName.trim(),
      estimatedPomos,
      completedPomos: 0,
      priority,
      status: 'todo',
      startAt: startTime ? atToday(startTime) : undefined,
      endAt: endTime ? atToday(endTime) : undefined,
      reminderAt: startTime ? atToday(startTime) : undefined,
    })
    setNewName('')
    setStartTime('')
    setEndTime('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  const handlePasteImport = async () => {
    const text = await navigator.clipboard?.readText().catch(() => '')
    if (!text?.trim()) return
    const count = importTasks(text)
    if (count > 0) {
      setImportText('')
      setImportOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      {/* 添加任务 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="添加新任务..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#A78BFA]/50 transition-colors"
        />
        {/* 优先级切换 */}
        <button
          onClick={() => setPriority(p => p === 'high' ? 'medium' : p === 'medium' ? 'low' : 'high')}
          className="px-2 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          title={`优先级: ${priority}`}
        >
          <Flag size={14} color={priorityColors[priority]} fill={priorityColors[priority]} />
        </button>
        <button
          onClick={() => setImportOpen(v => !v)}
          className="px-2 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/45 hover:text-white/75 transition-colors"
          title="批量导入"
        >
          <ClipboardList size={14} />
        </button>
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="px-3 py-2 bg-[#A78BFA]/20 hover:bg-[#A78BFA]/30 text-[#A78BFA] rounded-lg transition-colors disabled:opacity-30"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <input
          type="time"
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
          className="min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-[#A78BFA]/50"
        />
        <input
          type="time"
          value={endTime}
          onChange={e => setEndTime(e.target.value)}
          className="min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-[#A78BFA]/50"
        />
        <button
          onClick={() => setEstimatedPomos(p => p >= 4 ? 1 : p + 1)}
          className="px-2 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:bg-white/5 transition-colors"
          title="预计番茄数"
        >
          {estimatedPomos}🍅
        </button>
      </div>

      {importOpen && (
        <div className="space-y-2">
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={5}
            placeholder={'粘贴任务，每行一个：\n09:00-10:00 写日报 高\n提醒 15:30 回复邮件\n整理需求 !!!'}
            className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-[#A78BFA]/50 soft-scrollbar"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handlePasteImport}
              className="mr-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              title="从剪贴板导入"
            >
              <ClipboardPaste size={13} />
              粘贴导入
            </button>
            <button
              onClick={() => setImportOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-white/45 hover:text-white/75 hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                const count = importTasks(importText)
                if (count > 0) {
                  setImportText('')
                  setImportOpen(false)
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs text-[#34D399] bg-[#34D399]/10 hover:bg-[#34D399]/20 transition-colors"
            >
              导入
            </button>
          </div>
        </div>
      )}

      {/* 视图切换 */}
      <div className="grid grid-cols-4 gap-1 text-xs">
        {(['scheduled', 'unscheduled', 'all', 'done'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-2 py-1 rounded-md transition-colors ${
              view === v ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {v === 'scheduled' ? '日程' : v === 'unscheduled' ? '待排' : v === 'all' ? '全部' : '完成'}
          </button>
        ))}
      </div>

      {/* 任务列表 */}
      <div className="flex flex-col gap-1 max-h-52 overflow-y-auto soft-scrollbar">
        {filteredTasks.length === 0 && (
          <div className="text-center text-white/20 text-sm py-4">
            {view === 'done' ? '还没有完成的任务' : '还没有任务，添加一个吧'}
          </div>
        )}
        {filteredTasks.map(task => (
          <div
            key={task.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg group transition-colors ${
              task.status === 'done'
                ? 'bg-white/[0.02] text-white/30'
                : 'bg-white/[0.03] hover:bg-white/[0.06] text-white/80'
            }`}
          >
            {/* 完成按钮 */}
            <button
              onClick={() => completeTask(task.id)}
              className="shrink-0"
            >
              {task.status === 'done' ? (
                <CheckCircle2 size={18} className="text-[#34D399]" />
              ) : (
                <Circle size={18} className="text-white/20 hover:text-[#34D399] transition-colors" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <span className={`block text-sm truncate ${task.status === 'done' ? 'line-through' : ''}`}>
                {task.name}
              </span>
              <div className="flex items-center gap-2 text-[10px] text-white/25">
                <span>{formatTaskTime(task)}</span>
                {task.status !== 'done' && (
                  <button
                    onClick={() => updateTask(task.id, { estimatedPomos: task.estimatedPomos >= 4 ? 1 : task.estimatedPomos + 1 })}
                    className="hover:text-white/60"
                  >
                    {task.completedPomos}/{task.estimatedPomos}🍅
                  </button>
                )}
              </div>
            </div>

            {/* 优先级 */}
            <span className="shrink-0" style={{ color: priorityColors[task.priority] }}>
              <Flag size={10} fill={priorityColors[task.priority]} />
            </span>

            {task.status !== 'done' && (
              <button
                onClick={() => breakDownTask(task.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-white/20 hover:text-[#A78BFA] transition-all"
                title="AI 拆解任务"
              >
                <Sparkles size={14} />
              </button>
            )}

            {/* 删除 */}
            <button
              onClick={() => deleteTask(task.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-white/20 hover:text-[#F472B6] transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function atToday(value: string): number {
  const [h, m] = value.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

function formatClock(timestamp?: number): string {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatTaskTime(task: Task): string {
  if (task.startAt && task.endAt) return `${formatClock(task.startAt)}-${formatClock(task.endAt)}`
  if (task.reminderAt) return `提醒 ${formatClock(task.reminderAt)}`
  return '无时间段'
}
