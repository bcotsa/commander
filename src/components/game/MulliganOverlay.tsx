import { CardPreview } from '@/components/ui/CardPreview'
import type { GameCard, Player } from '@/types/game-state'

function mulliganBottomCount(player: Player): number {
  return Math.max(0, player.mulligansTaken - 1)
}

function mulliganBottomsRemaining(player: Player): number {
  if (!player.hasKeptOpeningHand) return 0
  const targetHandSize = 7 - mulliganBottomCount(player)
  return Math.max(0, player.zones.hand.length - targetHandSize)
}

function MulliganCard({
  card,
  selectable,
  onClick,
}: {
  card: GameCard
  selectable: boolean
  onClick: () => void
}) {
  const content = card.imageUri ? (
    <img
      src={card.imageUri}
      alt={card.name}
      className={`aspect-[5/7] w-full rounded-lg object-cover shadow-lg transition ${selectable ? 'cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-amber-400' : ''}`}
      loading="lazy"
    />
  ) : (
    <div className={`flex aspect-[5/7] w-full items-end rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-200 ${selectable ? 'cursor-pointer hover:border-amber-400' : ''}`}>
      {card.name}
    </div>
  )

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable}
      className="w-20 flex-shrink-0 text-left disabled:cursor-default"
    >
      {card.imageUri ? (
        <CardPreview imageUri={card.imageUri} name={card.name}>
          {content}
        </CardPreview>
      ) : content}
    </button>
  )
}

interface MulliganOverlayProps {
  players: Player[]
  myPlayerId: string
  canControlAllPlayers: boolean
  onKeep: (playerId: string) => void
  onMulligan: (playerId: string) => void
  onBottomCard: (playerId: string, cardId: string) => void
}

export function MulliganOverlay({
  players,
  myPlayerId,
  canControlAllPlayers,
  onKeep,
  onMulligan,
  onBottomCard,
}: MulliganOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-sm">
      <div className="flex h-full flex-col p-4">
        <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Opening Hands</h2>
              <p className="mt-1 text-sm text-slate-400">
                First mulligan is free. After that, use London mulligan and put one extra card on the bottom for each additional mulligan.
              </p>
            </div>
            <div className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
              Start of Game
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {players.map(player => {
              const canControlPlayer = canControlAllPlayers || player.id === myPlayerId
              const bottomsRemaining = mulliganBottomsRemaining(player)
              const bottomedCards = mulliganBottomCount(player) - bottomsRemaining
              const canKeep = canControlPlayer && !player.hasKeptOpeningHand
              const canMulligan = canControlPlayer && !player.hasKeptOpeningHand
              const waitingOnBottoms = player.hasKeptOpeningHand && bottomsRemaining > 0
              const ready = player.hasKeptOpeningHand && bottomsRemaining === 0

              return (
                <section key={player.id} className={`rounded-2xl border p-3 ${canControlPlayer ? 'border-violet-600/60 bg-slate-900' : 'border-slate-700 bg-slate-950/70'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{player.name || `Player ${player.seat + 1}`}</h3>
                        {canControlPlayer && (
                          <span className="rounded-full bg-violet-600/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-200">
                            {canControlAllPlayers && player.id !== myPlayerId ? 'Host Control' : 'You'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Mulligans taken: {player.mulligansTaken} • Cards to bottom: {mulliganBottomCount(player)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {ready && (
                        <span className="rounded-full bg-emerald-600/20 px-2 py-1 text-xs text-emerald-200">Ready</span>
                      )}
                      {waitingOnBottoms && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs text-amber-200">
                          Bottom {bottomsRemaining}
                        </span>
                      )}
                      {!player.hasKeptOpeningHand && (
                        <>
                          <button
                            type="button"
                            onClick={() => onMulligan(player.id)}
                            disabled={!canMulligan}
                            className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-medium text-white transition-colors enabled:hover:bg-slate-600 disabled:opacity-40"
                          >
                            Mulligan
                          </button>
                          <button
                            type="button"
                            onClick={() => onKeep(player.id)}
                            disabled={!canKeep}
                            className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition-colors enabled:hover:bg-emerald-600 disabled:opacity-40"
                          >
                            Keep
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {waitingOnBottoms && (
                    <p className="mt-3 text-xs text-amber-200">
                      Click {bottomsRemaining === 1 ? 'one card' : `${bottomsRemaining} cards`} to put on the bottom of the library.
                      {bottomedCards > 0 ? ` Bottomed so far: ${bottomedCards}.` : ''}
                    </p>
                  )}

                  {!player.hasKeptOpeningHand && (
                    <p className="mt-3 text-xs text-slate-500">
                      {player.mulligansTaken === 0
                        ? 'You may take one free mulligan and still keep 7.'
                        : `If you keep this hand, you will bottom ${mulliganBottomCount(player)} card${mulliganBottomCount(player) === 1 ? '' : 's'}.`}
                    </p>
                  )}

                  <div className="mt-3 flex gap-0 overflow-x-auto pb-1">
                    {player.zones.hand.map(card => (
                      <MulliganCard
                        key={card.instanceId}
                        card={card}
                        selectable={canControlPlayer && waitingOnBottoms}
                        onClick={() => onBottomCard(player.id, card.instanceId)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
