import { PlayerTile } from './PlayerTile'
import type { Player, CombatState } from '@/types/game-state'
import { useUiStore } from '@/store/ui-store'

interface PlayerGridProps {
  players: Player[]
  currentTurnPlayerId: string | null
  currentPhase: import('@/types/game-state').TurnPhase
  combat: CombatState
  onLifeDelta: (playerId: string, delta: number) => void
  onDrawCard: (playerId: string) => void
  onMoveCard: (playerId: string, from: import('@/types/game-state').ZoneName, to: import('@/types/game-state').ZoneName, cardId: string) => void
  onToggleTapped: (playerId: string, cardId: string) => void
  onPlayLand: (playerId: string, cardId: string) => void
  onCastCommander: (playerId: string, cardId: string) => void
  onCastPermanent: (playerId: string, cardId: string) => void
  onDeclareAttacker: (playerId: string, cardId: string, defendingPlayerId: string) => void
  onRemoveAttacker: (playerId: string, cardId: string) => void
  onAssignBlocker: (playerId: string, blockerId: string, attackerId: string) => void
  onRemoveBlocker: (playerId: string, blockerId: string, attackerId: string) => void
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

export function PlayerGrid({ players, currentTurnPlayerId, currentPhase, combat, onLifeDelta, onDrawCard, onMoveCard, onToggleTapped, onPlayLand, onCastCommander, onCastPermanent, onDeclareAttacker, onRemoveAttacker, onAssignBlocker, onRemoveBlocker }: PlayerGridProps) {
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
            allPlayers={players}
            isCurrentTurn={player.id === currentTurnPlayerId}
            currentTurnPlayerId={currentTurnPlayerId}
            currentPhase={currentPhase}
            combat={combat}
            rotated={rotated}
            onLifeDelta={(delta) => onLifeDelta(player.id, delta)}
            onDrawCard={() => onDrawCard(player.id)}
            onMoveCard={(from, to, cardId) => onMoveCard(player.id, from, to, cardId)}
            onToggleTapped={(cardId) => onToggleTapped(player.id, cardId)}
            onPlayLand={(cardId) => onPlayLand(player.id, cardId)}
            onCastCommander={(cardId) => onCastCommander(player.id, cardId)}
            onCastPermanent={(cardId) => onCastPermanent(player.id, cardId)}
            onDeclareAttacker={(cardId, defendingPlayerId) => onDeclareAttacker(player.id, cardId, defendingPlayerId)}
            onRemoveAttacker={(cardId) => onRemoveAttacker(player.id, cardId)}
            onAssignBlocker={(blockerId, attackerId) => onAssignBlocker(player.id, blockerId, attackerId)}
            onRemoveBlocker={(blockerId, attackerId) => onRemoveBlocker(player.id, blockerId, attackerId)}
            onOpenDamage={() => openModal('commanderDamage', player.id)}
            onOpenCounters={() => openModal('counters', player.id)}
          />
        )
      })}
    </div>
  )
}
