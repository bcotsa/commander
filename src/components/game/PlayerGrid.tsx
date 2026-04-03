import { PlayerTile } from './PlayerTile'
import type { Player } from '@/types/game-state'
import { useUiStore } from '@/store/ui-store'

interface PlayerGridProps {
  players: Player[]
  currentTurnPlayerId: string | null
  onLifeDelta: (playerId: string, delta: number) => void
}

// Grid layout classes by player count
const GRID_CLASSES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 grid-rows-2',
  3: 'grid-cols-2',
  4: 'grid-cols-2',
  5: 'grid-cols-2',
  6: 'grid-cols-2',
}

export function PlayerGrid({ players, currentTurnPlayerId, onLifeDelta }: PlayerGridProps) {
  const openModal = useUiStore(s => s.openModal)
  const count = players.length

  return (
    <div className={`grid ${GRID_CLASSES[count] ?? 'grid-cols-2'} gap-2 h-full p-2`}>
      {players.map((player, i) => {
        // Rotate top-half players so they face their side of the table
        const rotated = count >= 4 && i < Math.floor(count / 2)
        return (
          <PlayerTile
            key={player.id}
            player={player}
            isCurrentTurn={player.id === currentTurnPlayerId}
            rotated={rotated}
            onLifeDelta={(delta) => onLifeDelta(player.id, delta)}
            onOpenDamage={() => openModal('commanderDamage', player.id)}
            onOpenCounters={() => openModal('counters', player.id)}
          />
        )
      })}
    </div>
  )
}
