import type { Player, StackItem } from '@/types/game-state'

interface StackPanelProps {
  stack: StackItem[]
  players: Player[]
  priorityPlayerId: string | null
  passedIds: string[]
}

function describeTarget(stackItem: StackItem, players: Player[]): string | null {
  if (stackItem.targetPlayerId) {
    return players.find(player => player.id === stackItem.targetPlayerId)?.name ?? null
  }

  if (!stackItem.targetCardId) return null

  for (const player of players) {
    const card =
      player.zones.battlefield.find(entry => entry.instanceId === stackItem.targetCardId) ??
      player.zones.lands.find(entry => entry.instanceId === stackItem.targetCardId) ??
      player.zones.graveyard.find(entry => entry.instanceId === stackItem.targetCardId)
    if (card) return card.name
  }

  return null
}

export function StackPanel({ stack, players, priorityPlayerId, passedIds }: StackPanelProps) {
  if (stack.length === 0) {
    return (
      <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2">
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stack</span>
          <span className="text-xs text-slate-500">Empty</span>
        </div>
      </div>
    )
  }

  const ordered = [...stack].reverse()
  const priorityPlayerName = priorityPlayerId
    ? players.find(player => player.id === priorityPlayerId)?.name ?? null
    : null

  return (
    <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Stack</span>
          <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-slate-400">
            {priorityPlayerName && <span>Priority: {priorityPlayerName}</span>}
            <span>Passed: {passedIds.length}</span>
          </div>
        </div>

        <div className="flex max-h-28 flex-col gap-2 overflow-y-auto">
          {ordered.map((stackItem, index) => {
            const target = describeTarget(stackItem, players)
            const isTop = index === 0
            return (
              <div
                key={stackItem.id}
                className={`rounded-lg border px-3 py-2 ${
                  isTop ? 'border-violet-700 bg-violet-950/30' : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-white">{stackItem.card.name}</span>
                  <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
                    {isTop ? 'Top' : `#${stack.length - index}`}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span>{stackItem.casterName || 'Player'}</span>
                  <span>{stackItem.kind}</span>
                  {target && <span>Target: {target}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
