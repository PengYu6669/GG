/**
 * SpriteAnimator — Canvas Spritesheet 帧动画渲染器
 *
 * 支持两种模式:
 *   1. Spritesheet 模式: 加载 pet.json + spritesheet.webp，从图集中切帧
 *   2. Procedural 模式: 纯 Canvas 程序化绘制几何精灵（无外部依赖）
 */

export interface AnimationDef {
  row: number
  frames: number[]  // 该动画使用的帧序号 (0-7)
  fps: number
}

export interface PetDefinition {
  name: string
  cellWidth: number   // 192
  cellHeight: number  // 208
  columns: number     // 8
  rows: number        // 9
  animations: Record<string, AnimationDef>
  spritesheetPath?: string
}

// 默认 FocusPet 动画定义
export const DEFAULT_PET_DEF: PetDefinition = {
  name: 'focuspet-procedural',
  cellWidth: 192,
  cellHeight: 208,
  columns: 8,
  rows: 9,
  animations: {
    idle:      { row: 0, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 6 },
    walkRight:{ row: 1, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 10 },
    walkLeft:  { row: 2, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 10 },
    focus:     { row: 3, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 4 },
    celebrate: { row: 4, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 12 },
    sad:       { row: 5, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 4 },
    angry:     { row: 6, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 8 },
    sleep:     { row: 7, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 3 },
    alert:     { row: 8, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 8 },
  },
}

export class SpriteAnimator {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private spriteSheet: HTMLImageElement | null = null
  private petDef: PetDefinition = DEFAULT_PET_DEF
  private mode: 'spritesheet' | 'procedural' = 'procedural'

  private currentAnimation = 'idle'
  private currentFrameIndex = 0
  private elapsed = 0
  private lastTime = 0
  private isLoaded = false

  // 眼睛跟随鼠标
  private eyeOffsetX = 0
  private eyeOffsetY = 0
  // 程序化动画的相位
  private phase = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.canvas.width = this.petDef.cellWidth
    this.canvas.height = this.petDef.cellHeight
  }

  /** 尝试加载 spritesheet，失败则使用程序化绘制 */
  async loadPet(petDef?: PetDefinition): Promise<void> {
    if (petDef) this.petDef = petDef

    if (this.petDef.spritesheetPath) {
      try {
        this.spriteSheet = await this.loadImage(this.petDef.spritesheetPath)

        // 根据实际图片尺寸自动计算格子大小
        const actualCW = Math.round(this.spriteSheet.naturalWidth / this.petDef.columns)
        const actualCH = Math.round(this.spriteSheet.naturalHeight / this.petDef.rows)
        this.petDef = { ...this.petDef, cellWidth: actualCW, cellHeight: actualCH }

        this.canvas.width = actualCW
        this.canvas.height = actualCH
        this.mode = 'spritesheet'
        console.log(
          `[SpriteAnimator] Spritesheet loaded: ${this.spriteSheet.naturalWidth}x${this.spriteSheet.naturalHeight}`,
          `→ cell ${actualCW}x${actualCH}`,
        )
      } catch {
        console.log('[SpriteAnimator] Spritesheet not found, using procedural mode')
        this.petDef = { ...this.petDef, cellWidth: 192, cellHeight: 208 }
        this.canvas.width = 192
        this.canvas.height = 208
        this.mode = 'procedural'
      }
    } else {
      this.canvas.width = this.petDef.cellWidth
      this.canvas.height = this.petDef.cellHeight
    }
    this.isLoaded = true
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  setAnimation(name: string): void {
    if (name !== this.currentAnimation && this.petDef.animations[name]) {
      this.currentAnimation = name
      this.currentFrameIndex = 0
      this.elapsed = 0
    }
  }

  getAnimation(): string { return this.currentAnimation }

  setEyeTarget(mouseX: number, mouseY: number): void {
    const rect = this.canvas.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height * 0.35
    const dx = mouseX - cx
    const dy = mouseY - cy
    const maxOffset = 5
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const clamp = Math.min(dist, maxOffset * 3) / dist
    this.eyeOffsetX = dx * clamp * (maxOffset / (maxOffset * 3))
    this.eyeOffsetY = dy * clamp * (maxOffset / (maxOffset * 3))
  }

  private debugFrameCount = 0
  private debugLogged = false

  render(timestamp: number): void {
    if (!this.isLoaded) {
      // 加载中：画红色占位，确认 Canvas 在工作
      if (this.debugFrameCount < 120) {
        this.ctx.fillStyle = 'rgba(255,0,0,0.3)'
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
        this.debugFrameCount++
      }
      return
    }

    if (!this.debugLogged) {
      console.log('[SpriteAnimator] Render start — mode:', this.mode,
        'canvas:', this.canvas.width, 'x', this.canvas.height,
        'petDef cell:', this.petDef.cellWidth, 'x', this.petDef.cellHeight,
        'spriteSheet:', this.spriteSheet?.naturalWidth, 'x', this.spriteSheet?.naturalHeight)
      this.debugLogged = true
    }

    if (this.mode === 'procedural') {
      this.renderProcedural(timestamp)
    } else {
      this.renderSpritesheet(timestamp)
    }
  }

  // ========== Spritesheet 模式 ==========
  private renderSpritesheet(timestamp: number): void {
    if (!this.spriteSheet) return
    const anim = this.petDef.animations[this.currentAnimation]
    if (!anim) return

    if (this.lastTime === 0) this.lastTime = timestamp
    const dt = (timestamp - this.lastTime) / 1000
    this.lastTime = timestamp

    this.elapsed += dt
    const frameDuration = 1 / anim.fps
    if (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration
      this.currentFrameIndex = (this.currentFrameIndex + 1) % anim.frames.length
    }

    const frameNumber = anim.frames[this.currentFrameIndex]
    const col = frameNumber % this.petDef.columns
    const row = anim.row
    const { cellWidth: w, cellHeight: h } = this.petDef

    this.ctx.clearRect(0, 0, w, h)
    this.ctx.drawImage(
      this.spriteSheet,
      col * w, row * h, w, h,
      0, 0, w, h,
    )
    this.drawEyeOverlay()
  }

  // ========== Procedural 模式 (程序化几何精灵) ==========
  private renderProcedural(timestamp: number): void {
    if (this.lastTime === 0) this.lastTime = timestamp
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1)
    this.lastTime = timestamp

    const anim = this.petDef.animations[this.currentAnimation]
    const fps = anim?.fps ?? 6
    this.elapsed += dt
    if (this.elapsed >= 1 / fps) {
      this.elapsed = 0
      this.currentFrameIndex = ((this.currentFrameIndex + 1) % (anim?.frames.length ?? 8))
    }
    this.phase += dt

    const { cellWidth: W, cellHeight: H } = this.petDef
    this.ctx.clearRect(0, 0, W, H)

    const animName = this.currentAnimation

    // 身体尺寸（帧间微调模拟呼吸）
    const breathScale = animName === 'idle'
      ? 1 + Math.sin(this.phase * 3) * 0.03
      : animName === 'sleep'
        ? 1 + Math.sin(this.phase * 1.5) * 0.05
        : 1

    const bw = 90 * breathScale
    const bh = 100 * breathScale
    const bx = (W - bw) / 2
    const by = H - bh - 10

    // —— 身体 ——
    this.ctx.fillStyle = '#2A2A3A'
    this.roundRect(bx, by, bw, bh, 20)
    this.ctx.fill()

    // 高光线（紫光接缝）
    this.ctx.strokeStyle = '#A78BFA'
    this.ctx.lineWidth = 1.5
    this.roundRect(bx, by, bw, bh, 20)
    this.ctx.stroke()

    // —— 头部 ——
    const headR = 40 * breathScale
    const hx = W / 2
    const hy = by - headR * 0.5

    this.ctx.fillStyle = '#2A2A3A'
    this.ctx.beginPath()
    this.ctx.arc(hx, hy, headR, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.strokeStyle = '#A78BFA'
    this.ctx.lineWidth = 1.5
    this.ctx.beginPath()
    this.ctx.arc(hx, hy, headR, 0, Math.PI * 2)
    this.ctx.stroke()

    // —— 眼睛 ——
    this.drawProceduralEyes(hx, hy, animName)

    // —— 耳朵/天线 ——
    this.ctx.fillStyle = '#3A3A4A'
    // 左耳
    this.ctx.beginPath()
    this.ctx.ellipse(hx - 22, hy - 35, 10, 18, -0.3, 0, Math.PI * 2)
    this.ctx.fill()
    // 右耳
    this.ctx.beginPath()
    this.ctx.ellipse(hx + 22, hy - 35, 10, 18, 0.3, 0, Math.PI * 2)
    this.ctx.fill()

    // —— 腿部（根据动画变化） ——
    this.drawProceduralLegs(bx, by, bw, bh, animName)

    // —— 表情附加（嘴巴、眉毛等） ——
    this.drawProceduralExpression(hx, hy, headR, animName)

    // —— 情绪特效 ——
    if (animName === 'angry') this.drawAngerMarks(hx, hy)
    if (animName === 'sad') this.drawTearDrops(hx, hy, headR)
    if (animName === 'celebrate') this.drawSparkles(hx, hy)
  }

  private drawProceduralEyes(hx: number, hy: number, anim: string): void {
    const ex = this.eyeOffsetX
    const ey = this.eyeOffsetY

    if (anim === 'sleep') {
      // 闭眼 = 横线
      this.ctx.strokeStyle = '#A78BFA'
      this.ctx.lineWidth = 3
      ;[-14, 14].forEach(ox => {
        this.ctx.beginPath()
        this.ctx.moveTo(hx + ox - 8, hy - 5)
        this.ctx.lineTo(hx + ox + 8, hy - 5)
        this.ctx.stroke()
      })
      return
    }

    if (anim === 'angry') {
      // 怒眼 = 倒V
      this.ctx.strokeStyle = '#F472B6'
      this.ctx.lineWidth = 2.5
      ;[-14, 14].forEach(ox => {
        this.ctx.beginPath()
        this.ctx.moveTo(hx + ox - 8, hy - 5 + 4)
        this.ctx.lineTo(hx + ox, hy - 5 - 4)
        this.ctx.lineTo(hx + ox + 8, hy - 5 + 4)
        this.ctx.stroke()
      })
      return
    }

    // 正常 / 开心 / 专注 眼睛
    const eyeColor = anim === 'focus' ? '#34D399' : '#A78BFA'
    ;[-14, 14].forEach(ox => {
      // 眼白
      this.ctx.fillStyle = '#FFFFFF'
      this.ctx.beginPath()
      this.ctx.ellipse(hx + ox + ex, hy - 5 + ey, 10, 11, 0, 0, Math.PI * 2)
      this.ctx.fill()
      // 瞳孔
      this.ctx.fillStyle = eyeColor
      this.ctx.beginPath()
      this.ctx.arc(hx + ox + ex * 1.5, hy - 5 + ey * 1.5, 5, 0, Math.PI * 2)
      this.ctx.fill()
      // 高光
      this.ctx.fillStyle = '#FFFFFF'
      this.ctx.beginPath()
      this.ctx.arc(hx + ox + ex * 1.5 + 2, hy - 5 + ey * 1.5 - 2, 2, 0, Math.PI * 2)
      this.ctx.fill()

      // 开心时眼睛弯成月牙
      if (anim === 'celebrate') {
        this.ctx.fillStyle = '#2A2A3A'
        this.ctx.beginPath()
        this.ctx.ellipse(hx + ox + ex, hy - 5 + ey + 3, 10, 4, 0, 0, Math.PI)
        this.ctx.fill()
      }
    })
  }

  private drawProceduralLegs(bx: number, by: number, bw: number, bh: number, anim: string): void {
    this.ctx.fillStyle = '#3A3A4A'
    const legW = 18, legH = 25

    if (anim === 'walkRight' || anim === 'walkLeft') {
      // 交替迈步
      const alt = Math.sin(this.phase * 10) * 12
      // 左腿
      this.roundRect(bx + 18, by + bh - legH + alt, legW, legH - Math.abs(alt) * 0.5, 8)
      this.ctx.fill()
      // 右腿
      this.roundRect(bx + bw - 18 - legW, by + bh - legH - alt, legW, legH + Math.abs(alt) * 0.5, 8)
      this.ctx.fill()
    } else if (anim === 'jump' || anim === 'celebrate') {
      // 双腿并拢
      this.roundRect(bx + 25, by + bh - 15, 18, 18, 8)
      this.ctx.fill()
      this.roundRect(bx + bw - 43, by + bh - 15, 18, 18, 8)
      this.ctx.fill()
    } else {
      // 站姿
      this.roundRect(bx + 18, by + bh - legH, legW, legH, 8)
      this.ctx.fill()
      this.roundRect(bx + bw - 18 - legW, by + bh - legH, legW, legH, 8)
      this.ctx.fill()
    }
  }

  private drawProceduralExpression(
    hx: number, hy: number, headR: number, anim: string
  ): void {
    // 嘴巴
    this.ctx.strokeStyle = '#A78BFA'
    this.ctx.lineWidth = 2

    if (anim === 'celebrate') {
      // 大笑
      this.ctx.beginPath()
      this.ctx.arc(hx, hy + 8, 12, 0, Math.PI)
      this.ctx.stroke()
    } else if (anim === 'sad') {
      // 撇嘴
      this.ctx.beginPath()
      this.ctx.arc(hx, hy + 28, 12, Math.PI, 0)
      this.ctx.stroke()
    } else if (anim === 'angry') {
      // 咬牙
      this.ctx.beginPath()
      this.ctx.moveTo(hx - 10, hy + 10)
      this.ctx.lineTo(hx + 10, hy + 10)
      this.ctx.stroke()
    } else if (anim === 'focus') {
      // 专注 = 小圆嘴
      this.ctx.fillStyle = '#1A1A2A'
      this.ctx.beginPath()
      this.ctx.arc(hx, hy + 10, 4, 0, Math.PI * 2)
      this.ctx.fill()
    } else {
      // 微小弧度
      this.ctx.beginPath()
      this.ctx.arc(hx, hy + 8, 8, 0.1, Math.PI - 0.1)
      this.ctx.stroke()
    }
  }

  private drawAngerMarks(hx: number, hy: number): void {
    // 额头青筋
    this.ctx.strokeStyle = '#F472B6'
    this.ctx.lineWidth = 1.5
    for (let i = -1; i <= 1; i += 2) {
      this.ctx.beginPath()
      const bx = hx + i * 20
      this.ctx.moveTo(bx - 8, hy - 28)
      this.ctx.lineTo(bx, hy - 34)
      this.ctx.lineTo(bx + 8, hy - 28)
      this.ctx.stroke()
    }
  }

  private drawTearDrops(hx: number, hy: number, headR: number): void {
    this.ctx.fillStyle = 'rgba(120,160,255,0.7)'
    ;[-16, 16].forEach(ox => {
      const ty = hy + headR * 0.3 + Math.sin(this.phase * 2 + ox) * 3
      this.ctx.beginPath()
      this.ctx.ellipse(hx + ox, ty, 3, 6, 0, 0, Math.PI * 2)
      this.ctx.fill()
    })
  }

  private drawSparkles(hx: number, hy: number): void {
    this.ctx.fillStyle = '#FBBF24'
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + this.phase * 3
      const dist = 30 + Math.sin(this.phase * 5 + i) * 15
      const sx = hx + Math.cos(angle) * dist
      const sy = hy - 40 + Math.sin(angle) * dist * 0.5
      const size = 3 + Math.sin(this.phase * 8 + i) * 2
      this.ctx.beginPath()
      this.ctx.arc(sx, sy, size, 0, Math.PI * 2)
      this.ctx.fill()
    }
  }

  // ========== 眼睛 Overlay ==========
  private drawEyeOverlay(): void {
    if (!['idle', 'focus', 'alert'].includes(this.currentAnimation)) return
    this.ctx.fillStyle = 'rgba(255,255,255,0.6)'
    this.ctx.beginPath()
    this.ctx.arc(60 + this.eyeOffsetX, 55 + this.eyeOffsetY, 3, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.beginPath()
    this.ctx.arc(130 + this.eyeOffsetX, 55 + this.eyeOffsetY, 3, 0, Math.PI * 2)
    this.ctx.fill()
  }

  // ========== 工具方法 ==========
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath()
    this.ctx.moveTo(x + r, y)
    this.ctx.lineTo(x + w - r, y)
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    this.ctx.lineTo(x + w, y + h - r)
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    this.ctx.lineTo(x + r, y + h)
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    this.ctx.lineTo(x, y + r)
    this.ctx.quadraticCurveTo(x, y, x + r, y)
    this.ctx.closePath()
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect()
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
  }
}
