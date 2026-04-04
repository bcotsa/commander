import { PlayerTile } from './PlayerTile'
import type { Player } from '@/types/game-state'
import { useUiStore } from '@/store/ui-store'

interface PlayerGridProps {
  players: Player[]
  currentTurnPlayerId: string | null
  currentPhase: import('@/types/game-state').TurnPhase
  onLifeDelta: (playerId: string, delta: number) => void
  onDrawCard: (playerId: string) => void
  onMoveCard: (playerId: string, from: import('@/types/game-state').ZoneName, to: import('@/types/game-state').ZoneName, cardId: string) => void
  onToggleTapped: (playerId: string, cardId: string) => void
  onPlayLand: (playerId: string, cardId: string) => void
  onCastCommander: (playerId: string, cardId: string) => void
  onCastPermanent: (playerId: string, cardId: string) => void
}

// Grid layout classes by player count
const GRID_CLASSES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2',
  4: 'grid-cols-2',
  5: 'grid-cols-2',
  6: 'grid-cols-2',
}

export function PlayerGrid({ players, currentTurnPlayerId, currentPhase, onLifeDelta, onDrawCard, onMoveCard, onToggleTapped, onPlayLand, onCastCommander, onCastPermanent }: PlayerGridProps) {
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
            currentPhase={currentPhase}
            rotated={rotated}
            onLifeDelta={(delta) => onLifeDelta(player.id, delta)}
            onDrawCard={() => onDrawCard(player.id)}
            onMoveCard={(from, to, cardId) => onMoveCard(player.id, from, to, cardId)}
            onToggleTapped={(cardId) => onToggleTapped(player.id, cardId)}
            onPlayLand={(cardId) => onPlayLand(player.id, cardId)}
            onCastCommander={(cardId) => onCastCommander(player.id, cardId)}
            onCastPermanent={(cardId) => onCastPermanent(player.id, cardId)}
            onOpenDamage={() => openModal('commanderDamage', player.id)}
            onOpenCounters={() => openModal('counters', player.id)}
          />
        )
      })}
    </div>
  )
}
