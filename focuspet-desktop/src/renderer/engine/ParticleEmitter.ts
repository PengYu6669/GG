/**
 * ParticleEmitter — 粒子特效发射器
 *
 * 支持类型: heart(爱心) / stardust(星尘) / spark(火花) / raindrop(雨滴) / zzz(困)
 */

export type ParticleType = 'heart' | 'stardust' | 'spark' | 'raindrop' | 'zzz'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number    // 剩余生命 (秒)
  maxLife: number
  size: number
  color: string
  type: ParticleType
  rotation: number
  rotationSpeed: number
}

export class ParticleEmitter {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private animationId: number | null = null
  private lastTime = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.ctx = this.canvas.getContext('2d')!
    document.body.appendChild(this.canvas)

    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth
      this.canvas.height = window.innerHeight
    })
  }

  /** 在指定位置发射粒子 */
  emit(type: ParticleType, x: number, y: number, count = 8): void {
    const colors: Record<ParticleType, string[]> = {
      heart: ['#F472B6', '#FB7185', '#FBBF24'],
      stardust: ['#A78BFA', '#C4B5FD', '#FBBF24', '#34D399'],
      spark: ['#F472B6', '#FBBF24', '#FB923C'],
      raindrop: ['#60A5FA', '#818CF8'],
      zzz: ['#A1A1AA', '#D4D4D8'],
    }

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const speed = 40 + Math.random() * 80

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 1 + Math.random() * 1.5,
        maxLife: 1 + Math.random() * 1.5,
        size: type === 'zzz' ? 8 + Math.random() * 6 : 4 + Math.random() * 8,
        color: colors[type][Math.floor(Math.random() * colors[type].length)],
        type,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 6,
      })
    }

    if (!this.animationId) this.startLoop()
  }

  private startLoop(): void {
    this.lastTime = performance.now()
    const loop = (ts: number) => {
      const dt = Math.min((ts - this.lastTime) / 1000, 0.1)
      this.lastTime = ts
      this.update(dt)
      if (this.particles.length > 0) {
        this.animationId = requestAnimationFrame(loop)
      } else {
        this.animationId = null
      }
    }
    this.animationId = requestAnimationFrame(loop)
  }

  private update(dt: number): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }

      // 物理
      p.vy += 30 * dt // 轻微重力
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.rotationSpeed * dt

      // 透明度
      const alpha = p.life / p.maxLife

      this.ctx.save()
      this.ctx.globalAlpha = alpha
      this.ctx.translate(p.x, p.y)
      this.ctx.rotate(p.rotation)

      switch (p.type) {
        case 'heart':
          this.drawHeart(p.size, p.color)
          break
        case 'stardust':
          this.drawStar(p.size, p.color)
          break
        case 'spark':
          this.drawSpark(p.size, p.color)
          break
        case 'raindrop':
          this.drawRaindrop(p.size, p.color)
          break
        case 'zzz':
          this.drawZzz(p.size, p.color, alpha)
          break
      }

      this.ctx.restore()
    }
  }

  // ====== 形状绘制 ======

  private drawHeart(size: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    const s = size / 20
    this.ctx.moveTo(0, -5 * s)
    this.ctx.bezierCurveTo(-10 * s, -15 * s, -20 * s, -2 * s, 0, 15 * s)
    this.ctx.bezierCurveTo(20 * s, -2 * s, 10 * s, -15 * s, 0, -5 * s)
    this.ctx.fill()
  }

  private drawStar(size: number, color: string): void {
    this.ctx.fillStyle = color
    const s = size / 2
    this.ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      this.ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s)
      const innerAngle = angle + Math.PI / 4
      this.ctx.lineTo(Math.cos(innerAngle) * s * 0.4, Math.sin(innerAngle) * s * 0.4)
    }
    this.ctx.closePath()
    this.ctx.fill()
  }

  private drawSpark(size: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
    this.ctx.fill()
  }

  private drawRaindrop(size: number, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.ellipse(0, 0, size / 3, size / 2, 0, 0, Math.PI * 2)
    this.ctx.fill()
  }

  private drawZzz(size: number, color: string, alpha: number): void {
    this.ctx.fillStyle = color
    this.ctx.font = `${size * 2}px sans-serif`
    this.ctx.fillText('Z', 0, 0)
  }

  destroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId)
    this.canvas.remove()
  }
}
