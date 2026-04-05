import { CardPreview } from '@/components/ui/CardPreview'
import type { ExploreChoiceState, Player } from '@/types/game-state'

interface ExploreChoiceOverlayProps {
  choice: ExploreChoiceState
  players: Player[]
  myPlayerId: string
  canControlAllPlayers: boolean
  onChoose: (putInGraveyard: boolean) => void
}

export function ExploreChoiceOverlay({
  choice,
  players,
  myPlayerId,
  canControlAllPlayers,
  onChoose,
}: ExploreChoiceOverlayProps) {
  const player = players.find(entry => entry.id === choice.playerId) ?? null
  const canControl = canControlAllPlayers || choice.playerId === myPlayerId
  const revealedCard = choice.revealedCard

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">Explore</h2>
            <p className="mt-1 text-sm text-slate-400">
              {player?.name ?? 'Player'} revealed {revealedCard.name}. Choose whether to leave it on top or put it into the graveyard.
            </p>
          </div>

          <div className="mt-5 flex justify-center">
            <div className="w-36">
              {revealedCard.imageUri ? (
                <CardPreview imageUri={revealedCard.imageUri} name={revealedCard.name}>
                  <img
                    src={revealedCard.imageUri}
                    alt={revealedCard.name}
                    className="aspect-[5/7] w-full rounded-xl object-cover shadow-lg"
                  />
                </CardPreview>
              ) : (
                <div className="flex aspect-[5/7] w-full items-end rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-slate-200">
                  {revealedCard.name}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => onChoose(false)}
              disabled={!canControl}
              className="flex-1 rounded-xl bg-slate-700 px-4 py-3 text-sm font-medium text-white transition-colors enabled:hover:bg-slate-600 disabled:opacity-40"
            >
              Leave on Top
            </button>
            <button
              type="button"
              onClick={() => onChoose(true)}
              disabled={!canControl}
              className="flex-1 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white transition-colors enabled:hover:bg-emerald-600 disabled:opacity-40"
            >
              Put in Graveyard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
