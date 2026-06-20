import { useCallback, useEffect, useRef, useState } from 'react'
import { PetProvider } from './context/PetContext'
import PetWindow from './components/PetWindow'
import ControlPanel from './components/ControlPanel'
import { usePetEngine } from './context/PetContext'
import { AppMonitorState, PersistedAppState, usePetStore } from './stores/usePetStore'

type PetBubbleState = { message: string }

export default function App() {
  return (
    <PetProvider>
      <FocusPetApp />
    </PetProvider>
  )
}

function FocusPetApp() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelAnchor, setPanelAnchor] = useState<'left' | 'right'>('right')
  const [petBubble, setPetBubble] = useState<PetBubbleState | null>(null)
  const { stateMachine: sm } = usePetEngine()
  const lastBlockedAtRef = useRef(0)
  const lastBubbleAtRef = useRef(0)
  const pullbackLevelRef = useRef(0)
  const lastPullbackAtRef = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mealReminderRef = useRef<Record<string, boolean>>({})
  const lastIdlePromptAtRef = useRef(0)
  const idleGraceUntilRef = useRef(0)

  const openPanel = useCallback(() => {
    setPanelOpen(true)
    window.electronAPI?.expandWindow()
  }, [])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    window.electronAPI?.collapseWindow()
  }, [])

  useEffect(() => {
    window.electronAPI?.onAction((action) => {
      if (action === 'open-panel' || action === 'start-focus' || action === 'toggle-focus') {
        setPanelOpen(true)
      }
    })
    window.electronAPI?.onPanelAnchor((anchor) => setPanelAnchor(anchor))
  }, [])

  useEffect(() => {
    window.electronAPI?.loadAppState().then((state) => {
      usePetStore.getState().hydrateAppState(state as Partial<PersistedAppState> | null)
    }).catch(() => {})
    window.electronAPI?.loadAppMonitorState().then((state) => {
      usePetStore.getState().hydrateAppMonitor(state as Partial<AppMonitorState> | null)
    }).catch(() => {})
  }, [])

  const scheduleSaveAppState = useCallback(() => {
    if (!window.electronAPI) return
    if (stateSaveTimerRef.current) clearTimeout(stateSaveTimerRef.current)
    stateSaveTimerRef.current = setTimeout(() => {
      window.electronAPI?.saveAppState(usePetStore.getState().exportAppState())
    }, 600)
  }, [])

  useEffect(() => {
    let lastSnapshot = ''
    const unsubscribe = usePetStore.subscribe((state) => {
      const snapshot = JSON.stringify({
        petName: state.petName,
        stardust: state.stardust,
        focusDuration: state.focusDuration,
        shortBreakDuration: state.shortBreakDuration,
        longBreakDuration: state.longBreakDuration,
        completedPomoCount: state.completedPomoCount,
        tasks: state.tasks,
        focusHistory: state.focusHistory,
      })
      if (snapshot === lastSnapshot) return
      lastSnapshot = snapshot
      scheduleSaveAppState()
    })
    return unsubscribe
  }, [scheduleSaveAppState])

  const scheduleSaveAppMonitor = useCallback(() => {
    if (!window.electronAPI) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      window.electronAPI?.saveAppMonitorState(usePetStore.getState().exportAppMonitorState())
    }, 1000)
  }, [])

  const showPetBubble = useCallback((message: string, cooldownMs = 12000) => {
    const now = Date.now()
    if (now - lastBubbleAtRef.current < cooldownMs) return
    lastBubbleAtRef.current = now
    setPetBubble({ message })
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current)
    bubbleTimerRef.current = setTimeout(() => setPetBubble(null), 3800)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PetBubbleState>).detail
      if (!detail?.message) return
      showPetBubble(detail.message, 0)
    }
    window.addEventListener('pet-bubble', handler)
    return () => window.removeEventListener('pet-bubble', handler)
  }, [showPetBubble])

  useEffect(() => {
    const handler = () => {
      const store = usePetStore.getState()
      if (!store.focusActive || store.timerMode !== 'focus') return
      const task = store.tasks.find(t => t.id === store.currentTaskId)
      const taskName = task?.name ?? '当前任务'
      sm.nudge()
      showPetBubble(`还在「${taskName}」这条线上吗？`, 0)
    }
    window.addEventListener('pet-check-in', handler)
    return () => window.removeEventListener('pet-check-in', handler)
  }, [sm, showPetBubble])

  const showPullbackBubble = useCallback((reason: 'blocked' | 'drift') => {
    const now = Date.now()
    if (now - lastPullbackAtRef.current > 3 * 60 * 1000) {
      pullbackLevelRef.current = 0
    }
    if (now - lastPullbackAtRef.current < 10000) return

    const store = usePetStore.getState()
    const task = store.tasks.find(t => t.id === store.currentTaskId)
      ?? store.tasks.find(t => t.status === 'todo' && t.startAt && t.startAt <= now && (!t.endAt || now <= t.endAt))
      ?? store.tasks.find(t => t.status === 'todo')
    const taskName = task?.name ?? '当前任务'
    const level = Math.min(3, pullbackLevelRef.current)
    const messages = reason === 'blocked'
      ? [
          '这个应用容易把时间吃掉，先回来一下？',
          `先回到「${taskName}」，我陪你盯住这一轮。`,
          `给自己 10 秒：打开和「${taskName}」有关的窗口。`,
          '如果已经很难拉回，先短休 3 分钟也可以。',
        ]
      : [
          '我有点看不出这是不是任务相关，要不要确认一下？',
          `现在的锚点是「${taskName}」，先回到它。`,
          `10 秒落地动作：写一句、点开文件，或把下一步打出来。`,
          '一直漂的话，可能不是懒，是脑子累了，短休一下。',
        ]
    pullbackLevelRef.current = level + 1
    lastPullbackAtRef.current = now
    store.recordPullback(level + 1, reason, messages[level])
    sm.nudge()
    showPetBubble(messages[level], 5000)
  }, [sm, showPetBubble])

  useEffect(() => {
    window.electronAPI?.onForegroundApp((info) => {
      const store = usePetStore.getState()
      const snapshot = store.recordForegroundApp(info)
      scheduleSaveAppMonitor()
      const telemetry = usePetStore.getState().focusTelemetry

      if (!store.focusActive) {
        if (snapshot.rule === 'block' && telemetry.blockedSeconds > 12) {
          sm.nudge()
          showPetBubble('这个有点容易刷久，要回来吗？')
        }
        return
      }
      if (snapshot.rule === 'allow') {
        pullbackLevelRef.current = 0
        sm.onFocusAllowed()
        return
      }
      if (snapshot.rule === 'block') {
        if (Date.now() < store.emergencyUntil) {
          showPetBubble('紧急使用中，我先帮你记着时间。', 12000)
          return
        }
        const now = Date.now()
        if (now - lastBlockedAtRef.current > 15000) {
          lastBlockedAtRef.current = now
          store.addDistraction()
          sm.onDistraction()
          showPullbackBubble('blocked')
        }
        return
      }
      if (telemetry.driftSeconds > 20 || telemetry.score < 70) {
        sm.onFocusDrift()
        showPullbackBubble('drift')
      }
    })
  }, [sm, scheduleSaveAppMonitor, showPetBubble, showPullbackBubble])

  useEffect(() => {
    window.electronAPI?.onSystemIdle((idle) => {
      const store = usePetStore.getState()
      if (!store.focusActive || store.timerMode !== 'focus') return
      const now = Date.now()
      if (now < idleGraceUntilRef.current) return
      if (idle.seconds < getIdlePromptThreshold(store.currentApp)) return
      if (now - lastIdlePromptAtRef.current < 2 * 60 * 1000) return

      const task = store.tasks.find(t => t.id === store.currentTaskId)
      const taskName = task?.name ?? '当前任务'
      lastIdlePromptAtRef.current = now
      store.recordPullback(1, 'drift', `idle:${idle.seconds}s`)
      sm.onFocusDrift()
      idleGraceUntilRef.current = now + 90 * 1000
      showPetBubble(`像是在等结果。回来瞄一眼「${taskName}」？`, 0)
    })
  }, [sm, showPetBubble])

  useEffect(() => {
    const timer = setInterval(() => {
      const store = usePetStore.getState()
      const now = Date.now()

      if (!store.focusActive) {
        const meal = getMealReminder(new Date(now))
        if (meal && !mealReminderRef.current[meal.key]) {
          mealReminderRef.current[meal.key] = true
          sm.nudge()
          showPetBubble(meal.message, 30000)
          return
        }
      }

      if (store.focusActive) return

      const dueTask = store.tasks.find(task =>
        task.status !== 'done' &&
        task.reminderAt &&
        task.reminderAt <= now &&
        !task.remindedAt
      )
      if (dueTask) {
        store.updateTask(dueTask.id, { remindedAt: now })
        sm.nudge()
        showPetBubble(`该做「${dueTask.name}」啦`, 5000)
        return
      }

      const overdueTask = store.tasks.find(task =>
        task.status !== 'done' &&
        task.endAt &&
        task.endAt + 60 * 1000 <= now &&
        !task.overdueRemindedAt
      )
      if (overdueTask) {
        store.updateTask(overdueTask.id, { overdueRemindedAt: now })
        sm.nudge()
        showPetBubble(`「${overdueTask.name}」到时间了，收个尾？`, 5000)
      }
    }, 30000)

    return () => clearInterval(timer)
  }, [sm, showPetBubble])

  useEffect(() => {
    const unsubscribe = usePetStore.subscribe((state, prev) => {
      if (state.focusHistory.length > prev.focusHistory.length) {
        const session = state.focusHistory[state.focusHistory.length - 1]
        const minutes = Math.max(1, Math.round(session.actualDuration || session.plannedDuration))
        const task = state.tasks.find(t => t.id === session.taskId)
        const praise = minutes >= 25
          ? `漂亮，刚刚稳住了 ${minutes} 分钟。起来走两步，眼睛也放松一下。`
          : `不错，先启动起来就很重要。${task ? `「${task.name}」已经推进了一点。` : '继续小步走。'}`
        showPetBubble(praise, 0)
      }
    })
    return unsubscribe
  }, [sm, showPetBubble])

  useEffect(() => {
    const timer = setInterval(() => {
      const store = usePetStore.getState()
      if (!store.focusActive || store.focusRemaining <= 0) return

      const next = store.focusRemaining - 1
      if (next > 0) {
        store.tickFocus(next)
        return
      }

      if (store.timerMode === 'focus') {
        const taskId = store.currentTaskId
        const task = store.tasks.find(t => t.id === taskId)
        const taskName = task?.name ?? '这个任务'
        const wasMicroStart = store.focusTelemetry.microStart
        store.completeFocus()
        sm.completeFocus()

        if (wasMicroStart) {
          showPetBubble(`${store.focusDuration} 分钟试完啦，要给「${taskName}」续杯吗？`, 0)
          return
        }

        const nextCount = store.completedPomoCount + 1
        const breakMode = nextCount % 4 === 0 ? 'longBreak' : 'shortBreak'
        setTimeout(() => {
          usePetStore.getState().startBreak(breakMode)
        }, 1200)
        return
      }

      store.completeBreak()
      sm.wakeUp()
    }, 1000)

    return () => clearInterval(timer)
  }, [sm, showPetBubble])

  return (
    <div className="w-full h-full bg-transparent">
      <PetWindow onOpenPanel={openPanel} bubble={petBubble} />
      {panelOpen && <ControlPanel anchor={panelAnchor} onClose={closePanel} onAppMonitorChange={scheduleSaveAppMonitor} />}
    </div>
  )
}

function getMealReminder(now: Date): { key: string; message: string } | null {
  const hour = now.getHours()
  const minute = now.getMinutes()
  const date = now.toDateString()
  const total = hour * 60 + minute
  if (total >= 11 * 60 + 45 && total <= 12 * 60 + 45) {
    return { key: `${date}-lunch`, message: '到饭点啦，先吃饭或者点个外卖？别靠意志力硬撑。' }
  }
  if (total >= 18 * 60 && total <= 19 * 60) {
    return { key: `${date}-dinner`, message: '晚饭时间到了，给自己补点能量吧。' }
  }
  return null
}

function getIdlePromptThreshold(app: ReturnType<typeof usePetStore.getState>['currentApp']): number {
  if (!app || app.rule === 'block') return 45
  const kind = app.context?.kind
  if (kind === 'ai' || kind === 'terminal' || kind === 'dev-server') return 75
  if (kind === 'editor') return 120
  if (kind === 'browser' && app.rule === 'allow') return 120
  if (app.rule === 'allow') return 150
  return 60
}
