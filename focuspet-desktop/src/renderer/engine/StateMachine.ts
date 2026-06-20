/**
 * StateMachine — 桌宠状态机
 *
 * 状态转换:
 *   idle ←→ walk (自动巡逻)
 *   idle → drag → air → idle (拖拽)
 *   idle → focus → celebrate | sad → idle (专注流程)
 *   sad → angry → idle (多次走神)
 *   any → sleep → alert → idle (长时间不动)
 */

export type PetState =
  | 'idle'
  | 'walkRight'
  | 'walkLeft'
  | 'wave'
  | 'drag'
  | 'air'
  | 'focus'
  | 'celebrate'
  | 'sad'
  | 'angry'
  | 'sleep'
  | 'alert'

export type PetEmotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'sleepy'
  | 'focused'

export interface PetStateContext {
  currentState: PetState
  previousState: PetState
  emotion: PetEmotion
  idleTimer: number          // 累计待机时间 (秒)
  walkDirection: 'right' | 'left'
  focusActive: boolean
  distractionCount: number   // 本次专注走神次数
  isLateNight: boolean       // 是否深夜
  nextIdleActionAt: number
}

export class StateMachine {
  private ctx: PetStateContext = {
    currentState: 'idle',
    previousState: 'idle',
    emotion: 'neutral',
    idleTimer: 0,
    walkDirection: 'right',
    focusActive: false,
    distractionCount: 0,
    isLateNight: false,
    nextIdleActionAt: 25 + Math.random() * 30,
  }

  // 状态变化回调
  private onChangeCallbacks: Array<(state: PetState, prev: PetState) => void> = []

  getState(): PetState { return this.ctx.currentState }
  getEmotion(): PetEmotion { return this.ctx.emotion }
  getContext(): Readonly<PetStateContext> { return this.ctx }

  onChange(cb: (state: PetState, prev: PetState) => void): void {
    this.onChangeCallbacks.push(cb)
  }

  private transition(newState: PetState): void {
    if (newState === this.ctx.currentState) return
    this.ctx.previousState = this.ctx.currentState
    this.ctx.currentState = newState
    this.onChangeCallbacks.forEach(cb => cb(newState, this.ctx.previousState))
  }

  // ========== 公开方法 ==========

  /** 每帧更新 (dt: 秒) */
  tick(dt: number): void {
    const s = this.ctx.currentState

    if (s === 'idle' || s === 'walkRight' || s === 'walkLeft' || s === 'wave') {
      this.ctx.idleTimer += dt

      // 深夜 → 睡觉
      if (this.ctx.isLateNight && this.ctx.idleTimer > 120 && s === 'idle') {
        this.transition('sleep')
        this.ctx.emotion = 'sleepy'
        return
      }

      if (!this.ctx.focusActive && s === 'idle' && this.ctx.idleTimer >= this.ctx.nextIdleActionAt) {
        this.playIdleAction()
      }
    }
  }

  private scheduleNextIdleAction(): void {
    this.ctx.idleTimer = 0
    this.ctx.nextIdleActionAt = 25 + Math.random() * 30
  }

  private playIdleAction(): void {
    this.scheduleNextIdleAction()
    const roll = Math.random()

    if (roll < 0.32) {
      this.transition('wave')
      this.ctx.emotion = 'happy'
      setTimeout(() => {
        if (this.ctx.currentState === 'wave' && !this.ctx.focusActive) this.transition('idle')
      }, 1800)
      return
    }

    if (roll < 0.57) {
      const direction = this.ctx.walkDirection === 'right' ? 'walkLeft' : 'walkRight'
      this.ctx.walkDirection = direction === 'walkRight' ? 'right' : 'left'
      this.transition(direction)
      this.ctx.emotion = 'neutral'
      setTimeout(() => {
        if ((this.ctx.currentState === 'walkRight' || this.ctx.currentState === 'walkLeft') && !this.ctx.focusActive) {
          this.transition('idle')
        }
      }, 1800 + Math.random() * 1200)
      return
    }

    if (roll < 0.75) {
      this.transition('alert')
      this.ctx.emotion = 'neutral'
      setTimeout(() => {
        if (this.ctx.currentState === 'alert' && !this.ctx.focusActive) this.transition('idle')
      }, 1800)
      return
    }

    if (roll < 0.9) {
      this.transition('celebrate')
      this.ctx.emotion = 'happy'
      setTimeout(() => {
        if (this.ctx.currentState === 'celebrate' && !this.ctx.focusActive) this.transition('idle')
      }, 1400)
      return
    }

    this.transition('sleep')
    this.ctx.emotion = 'sleepy'
    setTimeout(() => {
      if (this.ctx.currentState === 'sleep' && !this.ctx.focusActive) this.transition('idle')
    }, 4500)
  }

  /** 点击事件 */
  onClick(): void {
    this.scheduleNextIdleAction()
    if (this.ctx.currentState === 'sleep') {
      this.transition('wave')
      setTimeout(() => {
        if (this.ctx.currentState === 'wave') this.transition('idle')
      }, 2000)
      return
    }
    // 点击弹跳 → 短暂切换到 celebrate 再切回
    if (!['focus', 'drag', 'air'].includes(this.ctx.currentState)) {
      this.transition(Math.random() > 0.5 ? 'wave' : 'celebrate')
      this.ctx.emotion = 'happy'
      setTimeout(() => {
        if (this.ctx.currentState === 'celebrate' || this.ctx.currentState === 'wave')
          this.transition('idle')
      }, 1500)
    }
  }

  /** 开始拖拽 */
  onDragStart(): void {
    this.scheduleNextIdleAction()
    this.transition('drag')
  }

  /** 松手（有速度则进入 air 状态） */
  onDragEnd(vx: number, vy: number): void {
    if (Math.abs(vx) > 2 || Math.abs(vy) > 2) {
      this.transition('air')
    } else {
      this.transition('idle')
    }
  }

  /** 落地 */
  onLand(): void {
    if (this.ctx.currentState === 'air') {
      this.scheduleNextIdleAction()
      this.transition('idle')
    }
  }

  /** 开始专注 */
  startFocus(): void {
    this.ctx.focusActive = true
    this.scheduleNextIdleAction()
    this.ctx.distractionCount = 0
    this.ctx.emotion = 'focused'
    this.transition('focus')
  }

  /** 走神检测触发 */
  onDistraction(): void {
    if (!this.ctx.focusActive) return
    this.ctx.distractionCount++

    if (this.ctx.distractionCount >= 3) {
      this.transition('angry')
      this.ctx.emotion = 'angry'
    } else {
      this.transition('sad')
      this.ctx.emotion = 'sad'
      // 5 秒后恢复专注
      setTimeout(() => {
        if (this.ctx.currentState === 'sad' && this.ctx.focusActive)
          this.transition('focus')
      }, 5000)
    }
  }

  /** 专注期间回到允许应用 */
  onFocusAllowed(): void {
    if (!this.ctx.focusActive) return
    this.ctx.emotion = 'focused'
    if (this.ctx.currentState === 'alert' || this.ctx.currentState === 'sad') {
      this.transition('focus')
    }
  }

  /** 专注期间切到未知应用 */
  onFocusDrift(): void {
    if (!this.ctx.focusActive) return
    if (this.ctx.currentState === 'focus') {
      this.transition('alert')
    }
  }

  /** 非专注状态下的温和提醒 */
  nudge(): void {
    if (this.ctx.focusActive) return
    if (this.ctx.currentState === 'idle' || this.ctx.currentState === 'walkLeft' || this.ctx.currentState === 'walkRight') {
      this.scheduleNextIdleAction()
      this.transition('wave')
      setTimeout(() => {
        if (this.ctx.currentState === 'wave' && !this.ctx.focusActive) this.transition('idle')
      }, 3500)
    }
  }

  /** 专注完成 */
  completeFocus(): void {
    this.ctx.focusActive = false
    this.scheduleNextIdleAction()
    this.ctx.distractionCount = 0
    this.transition('celebrate')
    this.ctx.emotion = 'happy'
    setTimeout(() => {
      if (this.ctx.currentState === 'celebrate')
        this.transition('idle')
    }, 3000)
  }

  /** 结束专注（放弃） */
  abandonFocus(): void {
    this.ctx.focusActive = false
    this.scheduleNextIdleAction()
    this.ctx.distractionCount = 0
    this.transition('sad')
    this.ctx.emotion = 'sad'
    setTimeout(() => {
      if (this.ctx.currentState === 'sad')
        this.transition('idle')
    }, 4000)
  }

  /** 长时间不操作 → 睡觉 */
  setIdleSleep(): void {
    if (this.ctx.currentState === 'idle') {
      this.transition('sleep')
      this.ctx.emotion = 'sleepy'
    }
  }

  /** 从睡眠中被唤醒 */
  wakeUp(): void {
    if (this.ctx.currentState === 'sleep') {
      this.transition('alert')
      this.ctx.emotion = 'neutral'
      setTimeout(() => {
        if (this.ctx.currentState === 'alert')
          this.transition('idle')
      }, 2000)
    }
  }

  /** 认知校验弹窗 */
  showCheckIn(): void {
    if (!this.ctx.focusActive) return
    this.transition('alert')
  }

  /** 校验弹窗关闭 */
  dismissCheckIn(): void {
    if (this.ctx.currentState === 'alert' && this.ctx.focusActive) {
      this.transition('focus')
    }
  }
}
