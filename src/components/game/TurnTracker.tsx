import type { Player, TurnPhase } from '@/types/game-state'

interface TurnTrackerProps {
  players: Player[]
  turnOrder: string[]
  currentTurnIndex: number
  currentPhase: TurnPhase
  stackCount: number
  round: number
  onNextStep: () => void
  onResolveStack: () => void
  onResolveCombat: () => void
  isHost: boolean
}

const PHASE_LABELS: Record<TurnPhase, string> = {
  untap: 'Untap',
  upkeep: 'Upkeep',
  draw: 'Draw',
  main1: 'Main 1',
  combat: 'Combat',
  main2: 'Main 2',
  end: 'End',
}
const PHASE_ORDER: TurnPhase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end']

export function TurnTracker({ players, turnOrder, currentTurnIndex, currentPhase, stackCount, round, onNextStep, onResolveStack, onResolveCombat, isHost }: TurnTrackerProps) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))

  return (
    <div className="border-b border-slate-700 bg-slate-900/80 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 flex-shrink-0">R{round}</span>

        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {PHASE_ORDER.map(phase => {
            const isActive = phase === currentPhase
            return (
              <span
                key={phase}
                className={`flex-shrink-0 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {PHASE_LABELS[phase]}
              </span>
            )
          })}
        </div>

        <div className="flex gap-1.5 overflow-x-auto flex-1 justify-end no-scrollbar">
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
          stackCount > 0 ? (
            <button
              onClick={onResolveStack}
              className="flex-shrink-0 text-xs bg-violet-700 hover:bg-violet-600 text-white px-3 py-1.5 rounded-full transition-colors"
            >
              Resolve Top
            </button>
          ) : currentPhase === 'combat' ? (
            <button
              onClick={onResolveCombat}
              className="flex-shrink-0 text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-full transition-colors"
            >
              Resolve
            </button>
          ) : (
            <button
              onClick={onNextStep}
              className="flex-shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-full transition-colors"
            >
              Next →
            </button>
          )
        )}
      </div>
    </div>
  )
}
