import { createContext, useContext, useRef, type ReactNode } from 'react'
import { SpriteAnimator } from '../engine/SpriteAnimator'
import { PhysicsEngine } from '../engine/PhysicsEngine'
import { StateMachine } from '../engine/StateMachine'
import { ParticleEmitter } from '../engine/ParticleEmitter'

export interface PetEngineRefs {
  animator: SpriteAnimator | null
  physics: PhysicsEngine | null
  stateMachine: StateMachine
  particles: ParticleEmitter | null
}

const PetContext = createContext<PetEngineRefs | null>(null)

export function PetProvider({ children }: { children: ReactNode }) {
  const refs = useRef<PetEngineRefs>({
    animator: null,
    physics: null,
    stateMachine: new StateMachine(),
    particles: null,
  }).current!

  return <PetContext.Provider value={refs}>{children}</PetContext.Provider>
}

export function usePetEngine(): PetEngineRefs {
  const ctx = useContext(PetContext)
  if (!ctx) throw new Error('usePetEngine must be inside PetProvider')
  return ctx
}
