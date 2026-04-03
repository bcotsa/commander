import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PlayerIdentity {
  id: string
  name: string
  setName: (name: string) => void
}

function generatePlayerId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`
}

export const usePlayerStore = create<PlayerIdentity>()(
  persist(
    (set) => ({
      id: generatePlayerId(),
      name: '',
      setName: (name) => set({ name }),
    }),
    { name: 'commander-player-identity' }
  )
)
