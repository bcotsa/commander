import { Modal } from '@/components/ui/Modal'
import { useLongPress } from '@/hooks/useLongPress'
import type { Player, PlayerCounters } from '@/types/game-state'

interface CountersModalProps {
  open: boolean
  onClose: () => void
  targetPlayer: Player | null
  allPlayers: Player[]
  onCounterChange: (playerId: string, counter: keyof PlayerCounters, delta: number) => void
  onSetMonarch: (playerId: string) => void
  onSetInitiative: (playerId: string) => void
}

const COUNTERS: { key: keyof PlayerCounters; label: string; icon: string; lethal?: number }[] = [
  { key: 'poison', label: 'Poison', icon: '☠️', lethal: 10 },
  { key: 'experience', label: 'Experience', icon: '⭐' },
  { key: 'energy', label: 'Energy', icon: '⚡' },
  { key: 'storm', label: 'Storm', icon: '🌩️' },
]

function CounterRow({
  label, icon, value, lethal, onDelta
}: { label: string; icon: string; value: number; lethal?: number; onDelta: (d: number) => void }) {
  const inc = useLongPress({ onPress: () => onDelta(1), onLongPress: () => onDelta(5) })
  const dec = useLongPress({ onPress: () => onDelta(-1), onLongPress: () => onDelta(-5) })
  const isLethal = lethal !== undefined && value >= lethal

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xl">{icon}</span>
      <span className={`flex-1 font-medium text-sm ${isLethal ? 'text-red-400' : ''}`}>
        {label} {isLethal && <span className="text-xs">(LETHAL)</span>}
      </span>
      <div className="flex items-center gap-2">
        <button {...dec} className="w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center font-bold">−</button>
        <span className={`w-8 text-center font-bold text-lg tabular-nums ${isLethal ? 'text-red-400' : ''}`}>{value}</span>
        <button {...inc} className="w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center font-bold">+</button>
      </div>
    </div>
  )
}

export function CountersModal({
  open, onClose, targetPlayer, allPlayers, onCounterChange, onSetMonarch, onSetInitiative
}: CountersModalProps) {
  if (!targetPlayer) return null

  return (
    <Modal open={open} onClose={onClose} title={`${targetPlayer.name || 'Player'} — Counters`}>
      <div className="p-5">
        <div className="divide-y divide-slate-700/50">
          {COUNTERS.map(c => (
            <CounterRow
              key={c.key}
              label={c.label}
              icon={c.icon}
              value={targetPlayer.counters[c.key]}
              lethal={c.lethal}
              onDelta={(d) => onCounterChange(targetPlayer.id, c.key, d)}
            />
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide">Tokens</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <span className="text-xl">👑</span> Monarch
                {targetPlayer.hasMonarch && <span className="text-xs text-yellow-400 font-medium">(current)</span>}
              </span>
              <div className="flex gap-2">
                {allPlayers.filter(p => !p.isEliminated).map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSetMonarch(p.id)}
                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${p.hasMonarch ? 'bg-yellow-500 text-black font-medium' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {p.name || `P${p.seat + 1}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <span className="text-xl">⚔️</span> Initiative
                {targetPlayer.hasInitiative && <span className="text-xs text-purple-400 font-medium">(current)</span>}
              </span>
              <div className="flex gap-2">
                {allPlayers.filter(p => !p.isEliminated).map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSetInitiative(p.id)}
                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${p.hasInitiative ? 'bg-purple-500 text-white font-medium' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {p.name || `P${p.seat + 1}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
