import { Modal } from '@/components/ui/Modal'
import { useLongPress } from '@/hooks/useLongPress'
import type { Player } from '@/types/game-state'

interface CommanderDamageModalProps {
  open: boolean
  onClose: () => void
  targetPlayer: Player | null
  allPlayers: Player[]
  onDamage: (fromId: string, toId: string, delta: number) => void
}

function DamageCell({ value, onDelta }: { value: number; onDelta: (d: number) => void }) {
  const inc = useLongPress({ onPress: () => onDelta(1), onLongPress: () => onDelta(5) })
  const dec = useLongPress({ onPress: () => onDelta(-1), onLongPress: () => onDelta(-5) })

  const isLethal = value >= 21

  return (
    <div className={`flex items-center gap-2 ${isLethal ? 'text-red-400' : 'text-white'}`}>
      <button {...dec} className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-800 flex items-center justify-center text-lg">−</button>
      <span className={`w-10 text-center font-bold text-xl tabular-nums ${isLethal ? 'text-red-400' : ''}`}>{value}</span>
      <button {...inc} className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-800 flex items-center justify-center text-lg">+</button>
      {isLethal && <span className="text-xs text-red-400 font-medium">LETHAL</span>}
    </div>
  )
}

export function CommanderDamageModal({ open, onClose, targetPlayer, allPlayers, onDamage }: CommanderDamageModalProps) {
  if (!targetPlayer) return null

  const attackers = allPlayers.filter(p => p.id !== targetPlayer.id && !p.isEliminated)

  return (
    <Modal open={open} onClose={onClose} title={`Commander Damage → ${targetPlayer.name || 'Player'}`}>
      <div className="p-5 flex flex-col gap-4">
        {attackers.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-4">No other players</p>
        )}
        {attackers.map(attacker => {
          const dmg = targetPlayer.commanderDamage[attacker.id] ?? 0
          return (
            <div key={attacker.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{attacker.name || `P${attacker.seat + 1}`}</div>
                {attacker.commander && (
                  <div className="text-xs text-slate-400 truncate">{attacker.commander.name}</div>
                )}
              </div>
              <DamageCell
                value={dmg}
                onDelta={(d) => onDamage(attacker.id, targetPlayer.id, d)}
              />
            </div>
          )
        })}
        <p className="text-xs text-slate-500 text-center mt-2">21+ damage from one commander = elimination</p>
      </div>
    </Modal>
  )
}
