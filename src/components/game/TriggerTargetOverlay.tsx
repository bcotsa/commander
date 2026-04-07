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
  const creatureTargets = players.flatMap(player =>
    player.zones.battlefield
      .filter(card => card.typeLine.toLowerCase().includes('creature'))
      .map(card => ({ player, card }))
  )

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">{choice.sourceName}</div>
          <div className="text-sm text-slate-400">Choose a creature target for this trigger</div>
        </div>

        <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
          {creatureTargets.map(({ player, card }) => (
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
          {creatureTargets.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500">
              No creature targets available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
