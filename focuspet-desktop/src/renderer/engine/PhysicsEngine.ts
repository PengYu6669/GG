/**
 * PhysicsEngine — 2D 物理引擎（重力 / 碰撞 / 拖拽惯性）
 */

export interface PhysicsBody {
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  isDragging: boolean
}

export class PhysicsEngine {
  private body: PhysicsBody
  gravity = 0.5
  bounceDamping = 0.3
  friction = 0.92
  dragInertia = 1.8 // 松手惯性系数
  maxSpeedX = 12
  maxSpeedY = 14
  private groundY: number
  private screenWidth: number

  // 拖拽状态
  private dragOffsetX = 0
  private dragOffsetY = 0
  private lastDragX = 0
  private lastDragY = 0

  constructor(body: PhysicsBody, groundY?: number, screenWidth?: number) {
    this.body = body
    this.groundY = groundY ?? window.innerHeight - 40
    this.screenWidth = screenWidth ?? window.innerWidth
  }

  updateBounds(): void {
    this.groundY = window.innerHeight - 40
    this.screenWidth = window.innerWidth
    this.keepInBounds()
  }

  getBody(): PhysicsBody { return this.body }

  startDrag(mouseX: number, mouseY: number): void {
    this.body.isDragging = true
    this.dragOffsetX = this.body.x - mouseX
    this.dragOffsetY = this.body.y - mouseY
    this.lastDragX = mouseX
    this.lastDragY = mouseY
    this.body.vx = 0
    this.body.vy = 0
  }

  updateDrag(mouseX: number, mouseY: number): void {
    if (!this.body.isDragging) return
    this.body.x = mouseX + this.dragOffsetX
    this.body.y = mouseY + this.dragOffsetY
    this.body.vx = (mouseX - this.lastDragX)
    this.body.vy = (mouseY - this.lastDragY)
    this.lastDragX = mouseX
    this.lastDragY = mouseY
  }

  endDrag(): void {
    this.body.isDragging = false
    // 施加拖拽惯性
    this.body.vx *= this.dragInertia
    this.body.vy *= this.dragInertia
    this.clampVelocity()
  }

  /** 施加一个力（用于点击弹跳等） */
  applyForce(fx: number, fy: number): void {
    this.body.vx += fx
    this.body.vy += fy
    this.clampVelocity()
  }

  isOnGround(): boolean {
    return this.body.y + this.body.height >= this.groundY - 1
  }

  update(): void {
    if (this.body.isDragging) return

    // 重力
    this.body.vy += this.gravity
    this.clampVelocity()

    // Euler 积分
    this.body.x += this.body.vx
    this.body.y += this.body.vy

    // 天花板，防止连续点击或拖拽甩出窗口后回不来
    if (this.body.y < 0) {
      this.body.y = 0
      this.body.vy = Math.abs(this.body.vy) * this.bounceDamping
    }

    // 地面碰撞
    const groundY = this.groundY
    if (this.body.y + this.body.height > groundY) {
      this.body.y = groundY - this.body.height
      this.body.vy = -this.body.vy * this.bounceDamping
      this.body.vx *= this.friction
      if (Math.abs(this.body.vy) < 0.6) this.body.vy = 0
    }

    // 左墙
    if (this.body.x < 0) {
      this.body.x = 0
      this.body.vx = -this.body.vx * this.bounceDamping
    }
    // 右墙
    if (this.body.x + this.body.width > this.screenWidth) {
      this.body.x = this.screenWidth - this.body.width
      this.body.vx = -this.body.vx * this.bounceDamping
    }

    // 地面摩擦力
    const onGround = this.body.y + this.body.height >= groundY - 1
    if (onGround) {
      this.body.vx *= this.friction
      if (Math.abs(this.body.vx) < 0.1) this.body.vx = 0
    }
  }

  keepInBounds(): void {
    if (this.body.x < 0) this.body.x = 0
    if (this.body.x + this.body.width > this.screenWidth) {
      this.body.x = Math.max(0, this.screenWidth - this.body.width)
    }
    if (this.body.y < 0) this.body.y = 0
    if (this.body.y + this.body.height > this.groundY) {
      this.body.y = this.groundY - this.body.height
    }
  }

  private clampVelocity(): void {
    this.body.vx = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, this.body.vx))
    this.body.vy = Math.max(-this.maxSpeedY, Math.min(this.maxSpeedY, this.body.vy))
  }
}
