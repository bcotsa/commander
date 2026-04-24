import { getLegalTargetOptions, targetChoiceLabel } from '@/lib/targeting'
import type { Player, PendingTargetChoiceState, StackItem } from '@/types/game-state'

interface TriggerTargetOverlayProps {
  choice: PendingTargetChoiceState
  players: Player[]
  stack: StackItem[]
  myPlayerId: string
  canControlAllPlayers: boolean
  onChoose: (target: { targetCardId?: string; targetPlayerId?: string; targetStackItemId?: string }) => void
  onDismiss: () => void
}

export function TriggerTargetOverlay({
  choice,
  players,
  stack,
  myPlayerId,
  canControlAllPlayers,
  onChoose,
  onDismiss,
}: TriggerTargetOverlayProps) {
  const canControl = canControlAllPlayers || choice.playerId === myPlayerId
  const targets = getLegalTargetOptions(players, choice.targetType, choice.playerId, stack, choice.stackItemId)
  const targetLabel = targetChoiceLabel(choice.targetType)

  const chooserName = players.find(player => player.id === choice.playerId)?.name ?? 'Player'

  return (
    <div className="pointer-events-none fixed inset-x-3 top-20 z-[90] flex justify-center sm:inset-x-auto sm:right-4 sm:top-24 sm:block">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-300/40 bg-slate-950/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-md">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Pending Choice</div>
            <div className="mt-1 text-lg font-semibold text-white">{choice.sourceName}</div>
            <div className="text-sm text-slate-400">{targetLabel}</div>
            <div className="mt-1 text-xs text-slate-500">Chooser: {chooserName}</div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition-colors hover:border-amber-300/60 hover:text-white"
          >
            Hide
          </button>
        </div>

        <p className="mb-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-400">
          You can hide this picker to inspect the battlefield, then reopen it from the pending-choice banner.
        </p>

        <div className="grid max-h-[48vh] gap-2 overflow-y-auto pr-1">
          {targets.map(target => (
            target.kind === 'player' ? (
              <button
                key={target.player.id}
                type="button"
                onClick={() => canControl && onChoose({ targetPlayerId: target.player.id })}
                disabled={!canControl}
                className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-left text-sm text-slate-200 transition-colors enabled:hover:border-amber-300/60 enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-950 text-[10px] text-slate-500">
                  Player
                </span>
                <span>
                  <span className="block font-semibold text-white group-enabled:group-hover:text-amber-100">{target.player.name}</span>
                  <span className="block text-xs text-slate-400">Life {target.player.life}</span>
                </span>
              </button>
            ) : target.kind === 'stack' ? (
              <button
                key={target.stackItem.id}
                type="button"
                onClick={() => canControl && onChoose({ targetStackItemId: target.stackItem.id })}
                disabled={!canControl}
                className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-left text-sm text-slate-200 transition-colors enabled:hover:border-amber-300/60 enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {target.stackItem.card.imageUri ? (
                  <img
                    src={target.stackItem.card.imageUri}
                    alt=""
                    className="h-16 w-11 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-950 text-[10px] text-slate-500">
                    Stack
                  </span>
                )}
                <span>
                  <span className="block font-semibold text-white group-enabled:group-hover:text-amber-100">
                    {target.stackItem.abilityLabel ? `${target.stackItem.card.name} — ${target.stackItem.abilityLabel}` : target.stackItem.card.name}
                  </span>
                  <span className="block text-xs text-slate-400">{target.stackItem.casterName}</span>
                  <span className="block text-xs text-slate-500">{target.stackItem.kind}</span>
                </span>
              </button>
            ) : (
              <button
                key={target.card.instanceId}
                type="button"
                onClick={() => canControl && onChoose({ targetCardId: target.card.instanceId })}
                disabled={!canControl}
                className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-left text-sm text-slate-200 transition-colors enabled:hover:border-amber-300/60 enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {target.card.imageUri ? (
                  <img
                    src={target.card.imageUri}
                    alt=""
                    className="h-16 w-11 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-950 text-[10px] text-slate-500">
                    No art
                  </span>
                )}
                <span>
                  <span className="block font-semibold text-white group-enabled:group-hover:text-amber-100">{target.card.name}</span>
                  <span className="block text-xs text-slate-400">{target.player.name}</span>
                  <span className="block text-xs text-slate-500">{target.card.typeLine}</span>
                </span>
              </button>
            )
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
