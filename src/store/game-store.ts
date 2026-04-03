import { create } from 'zustand'
import type { GameState, ActionPayload } from '@/types/game-state'
import { gameReducer, createInitialGameState } from '@/lib/game-reducer'

interface GameStore {
  state: GameState
  hostId: string | null
  myPlayerId: string | null
  isHost: boolean

  // Set the entire state (from Supabase sync)
  setState: (state: GameState) => void

  // Apply an action locally (optimistic)
  dispatch: (action: ActionPayload) => void

  // Set identity info after joining
  setIdentity: (hostId: string, myPlayerId: string) => void

  // Reset to blank state
  reset: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialGameState(''),
  hostId: null,
  myPlayerId: null,
  isHost: false,

  setState: (state) => set({ state }),

  dispatch: (action) => {
    const next = gameReducer(get().state, action)
    set({ state: next })
  },

  setIdentity: (hostId, myPlayerId) =>
    set({ hostId, myPlayerId, isHost: hostId === myPlayerId }),

  reset: () =>
    set({ state: createInitialGameState(''), hostId: null, myPlayerId: null, isHost: false }),
}))
