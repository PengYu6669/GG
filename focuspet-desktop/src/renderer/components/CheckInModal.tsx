import { usePetStore } from '../stores/usePetStore'
import { usePetEngine } from '../context/PetContext'

interface Props {
  open: boolean
  onClose: () => void
}

export default function CheckInModal({ open, onClose }: Props) {
  const { focusActive, currentTaskId, tasks, addDistraction, pauseFocus, abandonFocus } = usePetStore()
  const { stateMachine: sm } = usePetEngine()
  const currentTask = tasks.find(t => t.id === currentTaskId)

  if (!open || !focusActive) return null

  const handleStillFocused = () => {
    sm.dismissCheckIn()
    onClose()
  }

  const handleDistracted = () => {
    addDistraction()
    sm.onDistraction()
    pauseFocus()
    onClose()
  }

  const handleCompleted = () => {
    const store = usePetStore.getState()
    store.completeFocus()
    sm.completeFocus()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-[#1A1A24] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl animate-in"
        style={{
          animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        {/* 标题 */}
        <h2 className="text-lg font-bold text-white text-center mb-1">
          👋 嘿！还在专注吗？
        </h2>
        {currentTask && (
          <p className="text-sm text-white/50 text-center mb-5">
            你当前的任务是「{currentTask.name}」，进展如何？
          </p>
        )}

        {/* 选项 */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleStillFocused}
            className="w-full px-4 py-3 bg-[#34D399]/15 hover:bg-[#34D399]/25 text-[#34D399] rounded-xl font-medium transition-colors text-sm"
          >
            ✅ 还在专注
          </button>
          <button
            onClick={handleDistracted}
            className="w-full px-4 py-3 bg-[#FBBF24]/15 hover:bg-[#FBBF24]/25 text-[#FBBF24] rounded-xl font-medium transition-colors text-sm"
          >
            😅 有点分心
          </button>
          <button
            onClick={handleCompleted}
            className="w-full px-4 py-3 bg-[#A78BFA]/15 hover:bg-[#A78BFA]/25 text-[#A78BFA] rounded-xl font-medium transition-colors text-sm"
          >
            🎉 已经完成
          </button>
        </div>

        {/* 提示 */}
        <style>{`
          @keyframes popIn {
            from { opacity: 0; transform: scale(0.9) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  )
}
