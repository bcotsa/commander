import type { Player, TriggerTargetChoiceState } from '@/types/game-state'

interface TriggerTargetOverlayProps {
  choice: TriggerTargetChoiceState
  players: Player[]
  myPlayerId: string
  canControlAllPlayers: boolean
  onChoose: (targetCardId: string) => void
}

export function TriggerTargetOverlay({
  choice,
  players,
  myPlayerId,
  canControlAllPlayers,
  onChoose,
}: TriggerTargetOverlayProps) {
  const canControl = canControlAllPlayers || choice.playerId === myPlayerId
  const targets = choice.targetType === 'battlefield_creature'
    ? players.flatMap(player =>
        player.zones.battlefield
          .filter(card => card.typeLine.toLowerCase().includes('creature'))
          .map(card => ({ player, card }))
      )
    : choice.targetType === 'token_you_control'
    ? players.flatMap(player => {
        if (player.id !== choice.playerId) return []
        return player.zones.battlefield
          .filter(card => card.isToken)
          .map(card => ({ player, card }))
      })
    : players.flatMap(player => {
        if (choice.targetType === 'own_graveyard_creature' && player.id !== choice.playerId) return []
        if (choice.targetType === 'opponent_graveyard_creature' && player.id === choice.playerId) return []
        return player.zones.graveyard
          .filter(card => card.typeLine.toLowerCase().includes('creature'))
          .map(card => ({ player, card }))
      })
  const targetLabel = choice.targetType === 'battlefield_creature'
    ? 'Choose a creature target for this trigger'
    : choice.targetType === 'token_you_control'
    ? 'Choose a token you control for this trigger'
    : 'Choose a graveyard creature target for this trigger'

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">{choice.sourceName}</div>
          <div className="text-sm text-slate-400">{targetLabel}</div>
        </div>

        <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
          {targets.map(({ player, card }) => (
            <button
              key={card.instanceId}
              type="button"
              onClick={() => canControl && onChoose(card.instanceId)}
              disabled={!canControl}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-200 transition-colors enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {player.name}: {card.name}
            </button>
          ))}
          {targets.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500">
              No targets available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
