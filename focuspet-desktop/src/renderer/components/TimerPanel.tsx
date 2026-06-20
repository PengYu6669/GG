import { useEffect, useRef, useCallback } from 'react'
import { Play, Pause, StopCircle } from 'lucide-react'
import { usePetStore, type Task } from '../stores/usePetStore'
import { usePetEngine } from '../context/PetContext'

export default function TimerPanel() {
  const {
    focusActive, focusRemaining, focusDuration, timerMode,
    shortBreakDuration, longBreakDuration, completedPomoCount,
    setFocusDuration, setBreakDurations,
    startFocus, pauseFocus, resumeFocus,
    completeFocus, abandonFocus, currentTaskId, tasks,
    completeBreak,
  } = usePetStore()
  const { stateMachine: sm } = usePetEngine()

  const checkInTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // ====== 防走神：随机认知校验 ======
  useEffect(() => {
    if (!focusActive || timerMode !== 'focus') {
      clearTimeout(checkInTimerRef.current)
      return
    }
    const scheduleCheckIn = () => {
      const minDelay = 10 * 60 * 1000  // 10分钟
      const maxDelay = 15 * 60 * 1000  // 15分钟
      const delay = minDelay + Math.random() * (maxDelay - minDelay)
      checkInTimerRef.current = setTimeout(() => {
        const store = usePetStore.getState()
        if (!store.focusActive) return
        if (store.distractionCount >= 2) return // 最多2次
        sm.showCheckIn()
        window.dispatchEvent(new CustomEvent('pet-check-in'))
      }, delay)
    }
    scheduleCheckIn()
    return () => clearTimeout(checkInTimerRef.current)
  }, [focusActive, timerMode, sm])

  // ====== 操作 ======
  const handleStart = useCallback(() => {
    const store = usePetStore.getState()
    const task = pickFocusTask(store.tasks)
    const taskId = task?.id ?? null
    startFocus(taskId, focusDuration)
    sm.startFocus()
  }, [startFocus, focusDuration, sm])

  const handleMicroStart = useCallback((minutes: 2 | 5) => {
    const store = usePetStore.getState()
    const task = pickFocusTask(store.tasks)
    startFocus(task?.id ?? null, minutes, { microStart: true })
    sm.startFocus()
  }, [startFocus, sm])

  const handlePause = useCallback(() => {
    pauseFocus()
  }, [pauseFocus])

  const handleResume = useCallback(() => {
    resumeFocus()
  }, [resumeFocus])

  const handleAbandon = useCallback(() => {
    clearTimeout(checkInTimerRef.current)
    abandonFocus()
    sm.abandonFocus()
  }, [abandonFocus, sm])

  const handleSkipBreak = useCallback(() => {
    completeBreak()
    sm.wakeUp()
  }, [completeBreak, sm])

  // ====== UI ======
  const plannedSeconds = timerMode === 'shortBreak'
    ? shortBreakDuration * 60
    : timerMode === 'longBreak'
      ? longBreakDuration * 60
      : focusDuration * 60
  const totalSec = focusActive ? focusRemaining : plannedSeconds
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  const progress = focusActive
    ? (focusRemaining / plannedSeconds) * 100
    : 100

  const currentTask = tasks.find(t => t.id === currentTaskId)

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* 当前任务 */}
      {focusActive && timerMode === 'focus' && currentTask && (
        <div className="text-sm text-white/60">
          正在专注：<span className="text-white">{currentTask.name}</span>
        </div>
      )}
      {focusActive && timerMode !== 'focus' && (
        <div className="text-sm text-white/60">
          {timerMode === 'longBreak' ? '长休息' : '短休息'}：<span className="text-white">让脑子缓一缓</span>
        </div>
      )}

      {/* 环形进度条 */}
      <div className="relative w-44 h-44">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="6"
          />
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke={timerMode === 'focus' ? '#A78BFA' : '#34D399'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 42}`}
            strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        {/* 中央时间 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-mono font-bold text-white tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          <span className="text-xs text-white/40 mt-1">
            {timerModeLabel(timerMode, focusActive)}
          </span>
        </div>
      </div>

      {/* 时长调节 */}
      {!focusActive && timerMode === 'idle' && (
        <div className="flex items-center gap-2 text-white/70">
          <button
            onClick={() => setFocusDuration(focusDuration - 5)}
            className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 hover:text-white transition-colors text-xs"
          >
            -5
          </button>
          <span className="text-lg font-mono w-20 text-center tabular-nums">
            {focusDuration} 分钟
          </span>
          <button
            onClick={() => setFocusDuration(focusDuration + 5)}
            className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 hover:text-white transition-colors text-xs"
          >
            +5
          </button>
        </div>
      )}
      {!focusActive && timerMode === 'idle' && (
        <div className="text-center text-[11px] text-white/30 leading-relaxed">
          专注会在后台继续计时，并让桌宠根据应用状态轻轻拉回你。
        </div>
      )}
      {!focusActive && timerMode === 'idle' && (
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            onClick={() => handleMicroStart(2)}
            className="rounded-lg border border-[#34D399]/20 bg-[#34D399]/10 px-3 py-2 text-xs text-[#34D399] hover:bg-[#34D399]/20 transition-colors"
          >
            试 2 分钟
          </button>
          <button
            onClick={() => handleMicroStart(5)}
            className="rounded-lg border border-[#FBBF24]/20 bg-[#FBBF24]/10 px-3 py-2 text-xs text-[#FBBF24] hover:bg-[#FBBF24]/20 transition-colors"
          >
            试 5 分钟
          </button>
        </div>
      )}
      {!focusActive && (
        <div className="flex items-center gap-2 text-xs text-white/35">
          <span>已完成 {completedPomoCount} 轮</span>
          <button
            onClick={() => setBreakDurations(shortBreakDuration >= 15 ? 3 : shortBreakDuration + 1, longBreakDuration)}
            className="hover:text-white/65"
          >
            短休 {shortBreakDuration}m
          </button>
          <button
            onClick={() => setBreakDurations(shortBreakDuration, longBreakDuration >= 30 ? 10 : longBreakDuration + 5)}
            className="hover:text-white/65"
          >
            长休 {longBreakDuration}m
          </button>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="flex items-center gap-3">
        {!focusActive ? (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#A78BFA] hover:bg-[#8B6FE8] text-white rounded-xl font-medium transition-colors"
          >
            <Play size={16} fill="white" /> 开始专注
          </button>
        ) : focusActive && timerMode === 'focus' && focusRemaining > 0 ? (
          <>
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white/80 rounded-xl transition-colors"
            >
              <Pause size={16} /> 暂停
            </button>
            <button
              onClick={handleAbandon}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F472B6]/20 hover:bg-[#F472B6]/30 text-[#F472B6] rounded-xl transition-colors"
            >
              <StopCircle size={16} /> 放弃
            </button>
          </>
        ) : focusActive && timerMode !== 'focus' ? (
          <button
            onClick={handleSkipBreak}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white/80 rounded-xl transition-colors"
          >
            跳过休息
          </button>
        ) : null}
      </div>
    </div>
  )
}

function timerModeLabel(mode: string, active: boolean): string {
  if (!active) return '就绪'
  if (mode === 'shortBreak') return '短休息'
  if (mode === 'longBreak') return '长休息'
  return '专注中'
}

function pickFocusTask(tasks: Task[]): Task | undefined {
  const now = Date.now()
  const todoTasks = tasks.filter(t => t.status === 'todo')
  return todoTasks.find(t => t.startAt && t.endAt && t.startAt <= now && now <= t.endAt)
    ?? todoTasks
      .filter(t => t.startAt && t.startAt >= now)
      .sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0))[0]
    ?? todoTasks
      .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))[0]
}

function priorityWeight(priority: Task['priority']): number {
  if (priority === 'high') return 3
  if (priority === 'medium') return 2
  return 1
}
