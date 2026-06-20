import { useEffect, useRef, useCallback } from 'react'
import { PetDefinition, SpriteAnimator } from '../engine/SpriteAnimator'
import { PhysicsEngine, PhysicsBody } from '../engine/PhysicsEngine'
import { PetState } from '../engine/StateMachine'
import { ParticleEmitter } from '../engine/ParticleEmitter'
import { usePetEngine } from '../context/PetContext'
import pigHeroSpritesheet from '../assets/pets/pixel-pig-hero/spritesheet.webp'

const stateToAnim: Record<PetState, string> = {
  idle: 'idle', walkRight: 'running-right', walkLeft: 'running-left',
  wave: 'waving',
  drag: 'idle', air: 'idle',
  focus: 'running', celebrate: 'jumping', sad: 'failed',
  angry: 'waiting', sleep: 'waiting', alert: 'review',
}

const pixelPigHeroPet: PetDefinition = {
  name: 'pixel-pig-hero',
  cellWidth: 192,
  cellHeight: 208,
  columns: 8,
  rows: 9,
  spritesheetPath: pigHeroSpritesheet,
  animations: {
    idle: { row: 0, frames: [0, 1, 2, 3, 4, 5], fps: 6 },
    'running-right': { row: 1, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 10 },
    'running-left': { row: 2, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 10 },
    waving: { row: 3, frames: [0, 1, 2, 3], fps: 7 },
    jumping: { row: 4, frames: [0, 1, 2, 3, 4], fps: 10 },
    failed: { row: 5, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 5 },
    waiting: { row: 6, frames: [0, 1, 2, 3, 4, 5], fps: 8 },
    running: { row: 7, frames: [0, 1, 2, 3, 4, 5], fps: 5 },
    review: { row: 8, frames: [0, 1, 2, 3, 4, 5], fps: 8 },
  },
}

const PET_X = 12
const PET_Y = 12
const PET_GROUND_Y = 220

export default function PetWindow({
  onOpenPanel,
  bubble,
  panelOpen = false,
}: {
  onOpenPanel: () => void
  bubble: { message: string } | null
  panelOpen?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const engine = usePetEngine()
  const { stateMachine: sm } = engine
  const rafRef = useRef<number>(0)
  const dragMovedRef = useRef(false)
  const draggingWindowRef = useRef(false)
  const lastClickBounceRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 粒子
    const particles = new ParticleEmitter()
    engine.particles = particles

    // 动画器
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const animator = new SpriteAnimator(canvas)
    engine.animator = animator
    animator.loadPet(pixelPigHeroPet).catch(err => {
      console.error('[PetWindow] loadPet failed:', err)
    })

    // 物理
    const body: PhysicsBody = {
      x: PET_X, y: PET_Y,
      vx: 0, vy: 0, width: 192, height: 208, isDragging: false,
    }
    const physics = new PhysicsEngine(body, PET_GROUND_Y, 216)
    engine.physics = physics

    // 状态 → 动画 + 粒子
    sm.onChange((newState) => {
      animator.setAnimation(stateToAnim[newState] ?? 'idle')
      const b = physics.getBody()
      if (newState === 'celebrate') particles.emit('stardust', b.x + 96, b.y + 60, 12)
      if (newState === 'angry') particles.emit('spark', b.x + 96, b.y + 30, 8)
      if (newState === 'sad') particles.emit('raindrop', b.x + 96, b.y, 5)
      if (newState === 'sleep') particles.emit('zzz', b.x + 120, b.y - 20, 3)
    })

    // 渲染循环
    const loop = (timestamp: number) => {
      if (sm.getState() !== 'drag') physics.update()
      const b = physics.getBody()
      if (sm.getState() === 'walkRight') {
        b.vx = Math.max(b.vx, 0.75)
      } else if (sm.getState() === 'walkLeft') {
        b.vx = Math.min(b.vx, -0.75)
        if (b.x <= 4) {
          b.x = 132
        }
      }
      const groundY = PET_GROUND_Y
      if (b.y + b.height >= groundY - 1 && sm.getState() === 'air') sm.onLand()

      canvas.style.transform = `translate(${b.x}px, ${b.y}px)`
      if (bubbleRef.current) {
        bubbleRef.current.style.transform = `translate(${Math.max(122, b.x + 148)}px, ${Math.max(6, b.y - 10)}px)`
      }
      if (sm.getState() === 'walkLeft') {
        canvas.style.transform = `translate(${b.x + b.width}px, ${b.y}px) scaleX(-1)`
      }

      animator.render(timestamp)
      sm.tick(0.016)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      particles.destroy()
      engine.animator = null
      engine.physics = null
      engine.particles = null
    }
  }, [])

  // ====== 鼠标 ======
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    window.electronAPI?.setIgnoreMouseEvents(false)
    dragMovedRef.current = false
    draggingWindowRef.current = true
    sm.onDragStart()
    const body = engine.physics?.getBody()
    if (body) {
      body.vx = 0
      body.vy = 0
      body.x = PET_X
      body.y = PET_Y
    }
    window.electronAPI?.startWindowDrag({ screenX: e.screenX, screenY: e.screenY })
  }, [sm, engine])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.buttons === 1 && draggingWindowRef.current) {
      dragMovedRef.current = true
      window.electronAPI?.moveWindowDrag({ screenX: e.screenX, screenY: e.screenY })
    }
    engine.animator?.setEyeTarget(e.clientX, e.clientY)
  }, [engine])

  const handleMouseUp = useCallback(() => {
    if (draggingWindowRef.current) {
      draggingWindowRef.current = false
      window.electronAPI?.endWindowDrag()
    }
    const body = engine.physics?.getBody()
    if (body) {
      body.x = PET_X
      body.y = PET_Y
      body.vx = 0
      body.vy = 0
    }
    sm.onDragEnd(0, 0)
  }, [sm, engine])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (dragMovedRef.current) return
    if (sm.getState() === 'drag' || sm.getState() === 'air') return
    const now = performance.now()
    if (now - lastClickBounceRef.current < 700) return
    sm.onClick()
    const body = engine.physics?.getBody()
    if (body && engine.physics?.isOnGround()) {
      lastClickBounceRef.current = now
      engine.physics.applyForce(0, -5)
    }
  }, [sm, engine])

  const handleOpenPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onOpenPanel()
  }, [onOpenPanel])

  const handleMouseLeaveCanvas = useCallback(() => {
    if (!draggingWindowRef.current && !panelOpen) {
      window.electronAPI?.setIgnoreMouseEvents(true)
    }
    handleMouseUp()
  }, [handleMouseUp, panelOpen])

  return (
    <div className="fixed inset-0 select-none" style={{ pointerEvents: 'none' }}>
      {bubble && (
        <div
          ref={bubbleRef}
          className="absolute z-[60] max-w-44 rounded-xl border border-black/15 bg-white/90 px-3 py-2 text-[13px] font-medium leading-snug text-black shadow-md backdrop-blur-md"
          style={{ pointerEvents: 'none' }}
        >
          <div>{bubble.message}</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="absolute z-50 cursor-grab active:cursor-grabbing"
        style={{
          pointerEvents: 'auto',
          width: '192px',
          height: '208px',
          imageRendering: 'pixelated',
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeaveCanvas}
        onClick={handleClick}
        onContextMenu={handleOpenPanel}
        onDoubleClick={handleOpenPanel}
      />
    </div>
  )
}
