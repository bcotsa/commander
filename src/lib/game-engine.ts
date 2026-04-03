import type { GameState } from '@/types/game-state'
import { gameReducer } from './game-reducer'

const COMMANDER_DAMAGE_THRESHOLD = 21
const POISON_THRESHOLD = 10

/**
 * After any state change, check all living players for elimination conditions.
 * Returns updated state with any newly-eliminated players flagged.
 */
export function checkEliminations(state: GameState): GameState {
  let next = state

  for (const player of state.players) {
    if (player.isEliminated) continue

    const deadByLife = player.life <= 0
    const deadByPoison = player.counters.poison >= POISON_THRESHOLD
    const deadByCommanderDamage = Object.values(player.commanderDamage).some(
      dmg => dmg >= COMMANDER_DAMAGE_THRESHOLD
    )

    if (deadByLife || deadByPoison || deadByCommanderDamage) {
      next = gameReducer(next, { type: 'PLAYER_ELIMINATE', playerId: player.id })
    }
  }

  return next
}

/**
 * Returns the ID of the winner if only one player remains, otherwise null.
 */
export function getWinner(state: GameState): string | null {
  const alive = state.players.filter(p => !p.isEliminated)
  if (state.players.length > 1 && alive.length === 1) return alive[0]!.id
  return null
}

/**
 * Returns a human-readable elimination reason for a player.
 */
export function eliminationReason(
  state: GameState,
  playerId: string
): string {
  const player = state.players.find(p => p.id === playerId)
  if (!player) return 'eliminated'

  if (player.counters.poison >= POISON_THRESHOLD) return 'poisoned out'
  if (player.life <= 0) return 'ran out of life'

  const damageSource = Object.entries(player.commanderDamage).find(
    ([, dmg]) => dmg >= COMMANDER_DAMAGE_THRESHOLD
  )
  if (damageSource) {
    const attacker = state.players.find(p => p.id === damageSource[0])
    return `killed by ${attacker?.name ?? 'commander damage'}`
  }

  return 'eliminated'
}
