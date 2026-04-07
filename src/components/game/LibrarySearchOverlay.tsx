import type { LibrarySearchChoiceState, Player } from '@/types/game-state'

interface LibrarySearchOverlayProps {
  choice: LibrarySearchChoiceState
  players: Player[]
  myPlayerId: string
  canControlAllPlayers: boolean
  onChoose: (targetCardId?: string) => void
}

export function LibrarySearchOverlay({
  choice,
  players,
  myPlayerId,
  canControlAllPlayers,
  onChoose,
}: LibrarySearchOverlayProps) {
  const canControl = canControlAllPlayers || choice.playerId === myPlayerId
  const player = players.find(entry => entry.id === choice.playerId) ?? null
  const matchingCards = (player?.zones.library ?? []).filter(card => {
    const lowerTypeLine = card.typeLine.toLowerCase()
    if (!lowerTypeLine.includes('basic') || !lowerTypeLine.includes('land')) return false
    if (!choice.basicLandTypes || choice.basicLandTypes.length === 0) return true
    return choice.basicLandTypes.some(type => lowerTypeLine.includes(type))
  })

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">{choice.sourceName}</div>
          <div className="text-sm text-slate-400">
            Choose a basic land to put onto the battlefield tapped.
          </div>
        </div>

        <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
          {matchingCards.map(card => (
            <button
              key={card.instanceId}
              type="button"
              onClick={() => canControl && onChoose(card.instanceId)}
              disabled={!canControl}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-200 transition-colors enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {card.name}
            </button>
          ))}
          {matchingCards.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500">
              No valid basic lands in library.
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => canControl && onChoose(undefined)}
            disabled={!canControl}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 transition-colors enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Shuffle
          </button>
        </div>
      </div>
    </div>
  )
}
