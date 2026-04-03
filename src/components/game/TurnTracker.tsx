import type { Player } from '@/types/game-state'

interface TurnTrackerProps {
  players: Player[]
  turnOrder: string[]
  currentTurnIndex: number
  round: number
  onNextTurn: () => void
  isHost: boolean
}

export function TurnTracker({ players, turnOrder, currentTurnIndex, round, onNextTurn, isHost }: TurnTrackerProps) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 border-b border-slate-700">
      <span className="text-xs text-slate-500 flex-shrink-0">R{round}</span>

      <div className="flex gap-1.5 overflow-x-auto flex-1 no-scrollbar">
        {turnOrder.map((pid, idx) => {
          const p = playerMap[pid]
          if (!p) return null
          const isCurrent = idx === currentTurnIndex
          return (
            <div
              key={pid}
              className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                isCurrent
                  ? 'bg-violet-600 text-white'
                  : p.isEliminated
                  ? 'bg-slate-800 text-slate-600 line-through'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {p.name || `P${p.seat + 1}`}
            </div>
          )
        })}
      </div>

      {isHost && (
        <button
          onClick={onNextTurn}
          className="flex-shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-full transition-colors"
        >
          Next →
        </button>
      )}
    </div>
  )
}
