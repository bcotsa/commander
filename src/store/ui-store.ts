import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DiceRoll } from '@/lib/dice'

type ModalType = 'cardLookup' | 'diceRoller' | 'gameLog' | 'turnOrder' | 'commanderDamage' | 'counters' | null

interface UiStore {
  // Active modal
  activeModal: ModalType
  modalTargetPlayerId: string | null
  openModal: (modal: ModalType, targetPlayerId?: string) => void
  closeModal: () => void

  // Active bottom tab
  activeTab: 'life' | 'damage' | 'counters' | 'tools'
  setActiveTab: (tab: UiStore['activeTab']) => void

  // Theme
  darkMode: boolean
  toggleDarkMode: () => void

  // Dice history
  diceHistory: DiceRoll[]
  addDiceRoll: (roll: DiceRoll) => void

  // Toast
  toast: string | undefined
  showToast: (msg: string) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      activeModal: null,
      modalTargetPlayerId: null,
      openModal: (modal, targetPlayerId) =>
        set({ activeModal: modal, modalTargetPlayerId: targetPlayerId ?? null }),
      closeModal: () => set({ activeModal: null, modalTargetPlayerId: null }),

      activeTab: 'life',
      setActiveTab: (tab) => set({ activeTab: tab }),

      darkMode: true,
      toggleDarkMode: () => set({ darkMode: !get().darkMode }),

      diceHistory: [],
      addDiceRoll: (roll) =>
        set({ diceHistory: [roll, ...get().diceHistory].slice(0, 20) }),

      toast: undefined,
      showToast: (msg) => {
        set({ toast: msg })
        setTimeout(() => set({ toast: undefined }), 3000)
      },
    }),
    {
      name: 'commander-ui',
      partialize: (s) => ({ darkMode: s.darkMode }),
    }
  )
)
