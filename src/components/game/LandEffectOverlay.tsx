import type { LandEffectChoiceState, Player } from '@/types/game-state'

interface LandEffectOverlayProps {
  choice: LandEffectChoiceState
  players: Player[]
  myPlayerId: string
  canControlAllPlayers: boolean
  onChooseLand: (cardId: string) => void
  onChoosePlayer: (playerId: string) => void
}

export function LandEffectOverlay({
  choice,
  players,
  myPlayerId,
  canControlAllPlayers,
  onChooseLand,
  onChoosePlayer,
}: LandEffectOverlayProps) {
  const actingPlayer = players.find(player => player.id === choice.playerId) ?? null
  const canControl = canControlAllPlayers || choice.playerId === myPlayerId
  const actingPlayerLands = actingPlayer?.zones.lands ?? []
  const selectablePlayers = players

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">{choice.sourceName}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {choice.effect === 'bounce_land'
                ? `${actingPlayer?.name ?? 'Player'} must return a land they control to hand.`
                : `${actingPlayer?.name ?? 'Player'} must choose a graveyard to exile.`}
            </p>
          </div>

          {choice.effect === 'bounce_land' ? (
            <div className="mt-5 grid gap-2">
              {actingPlayerLands.map(card => (
                <button
                  key={card.instanceId}
                  type="button"
                  onClick={() => onChooseLand(card.instanceId)}
                  disabled={!canControl}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-left text-sm text-white transition-colors enabled:hover:bg-slate-800 disabled:opacity-40"
                >
                  {card.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid gap-2">
              {selectablePlayers.map(player => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onChoosePlayer(player.id)}
                  disabled={!canControl}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-left text-sm text-white transition-colors enabled:hover:bg-slate-800 disabled:opacity-40"
                >
                  {player.name} • {player.zones.graveyard.length} card{player.zones.graveyard.length === 1 ? '' : 's'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
