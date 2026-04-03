import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { rollDie, dieLabel } from '@/lib/dice'
import { useUiStore } from '@/store/ui-store'
import type { DieType, DiceRoll } from '@/lib/dice'

const DICE: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'coin']

interface DiceRollerModalProps {
  open: boolean
  onClose: () => void
  onBroadcastRoll?: (roll: DiceRoll) => void
}

export function DiceRollerModal({ open, onClose, onBroadcastRoll }: DiceRollerModalProps) {
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null)
  const [animating, setAnimating] = useState(false)
  const { diceHistory, addDiceRoll } = useUiStore()

  function handleRoll(die: DieType) {
    setAnimating(true)
    setTimeout(() => {
      const roll = rollDie(die)
      setLastRoll(roll)
      addDiceRoll(roll)
      onBroadcastRoll?.(roll)
      setAnimating(false)
    }, 200)
  }

  const resultDisplay = lastRoll
    ? typeof lastRoll.result === 'number'
      ? lastRoll.result.toString()
      : lastRoll.result
    : '—'

  const isCrit = lastRoll?.die === 'd20' && lastRoll.result === 20
  const isFail = lastRoll?.die === 'd20' && lastRoll.result === 1

  return (
    <Modal open={open} onClose={onClose} title="Dice Roller">
      <div className="p-5 flex flex-col gap-5">
        {/* Big result */}
        <div className="text-center py-4">
          <div className={`text-7xl font-black tabular-nums transition-all duration-200 ${animating ? 'scale-50 opacity-0' : 'scale-100 opacity-100'} ${isCrit ? 'text-yellow-400' : isFail ? 'text-red-400' : 'text-white'}`}>
            {resultDisplay}
          </div>
          {lastRoll && (
            <div className="text-slate-400 text-sm mt-1">
              {dieLabel(lastRoll.die)}
              {isCrit && <span className="ml-2 text-yellow-400 font-bold">CRITICAL!</span>}
              {isFail && <span className="ml-2 text-red-400 font-bold">FAIL!</span>}
            </div>
          )}
        </div>

        {/* Die buttons */}
        <div className="grid grid-cols-4 gap-2">
          {DICE.map(die => (
            <button
              key={die}
              onClick={() => handleRoll(die)}
              className="aspect-square bg-slate-700 hover:bg-violet-700 active:bg-violet-800 rounded-xl flex items-center justify-center font-bold text-sm transition-colors"
            >
              {dieLabel(die)}
            </button>
          ))}
        </div>

        {/* History */}
        {diceHistory.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">History</p>
            <div className="flex flex-wrap gap-1.5">
              {diceHistory.slice(0, 10).map((roll, i) => (
                <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-lg">
                  {dieLabel(roll.die)}: <span className="font-bold">{roll.result}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
