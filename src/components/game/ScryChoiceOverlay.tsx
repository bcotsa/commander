import { useEffect, useState } from 'react'
import { CardPreview } from '@/components/ui/CardPreview'
import type { GameCard, Player, ScryChoiceState } from '@/types/game-state'

interface ScryChoiceOverlayProps {
  choice: ScryChoiceState
  players: Player[]
  myPlayerId: string
  canControlAllPlayers: boolean
  onConfirm: (topCardIds: string[], bottomCardIds: string[]) => void
}

export function ScryChoiceOverlay({
  choice,
  players,
  myPlayerId,
  canControlAllPlayers,
  onConfirm,
}: ScryChoiceOverlayProps) {
  const choiceKey = choice.revealedCards.map(card => card.instanceId).join('|')
  const [topCardIds, setTopCardIds] = useState<string[]>(() => choice.revealedCards.map(card => card.instanceId))
  const [bottomCardIds, setBottomCardIds] = useState<string[]>([])
  const player = players.find(entry => entry.id === choice.playerId) ?? null
  const canControl = canControlAllPlayers || choice.playerId === myPlayerId
  const cardsById = new Map(choice.revealedCards.map(card => [card.instanceId, card]))

  useEffect(() => {
    setTopCardIds(choice.revealedCards.map(card => card.instanceId))
    setBottomCardIds([])
  }, [choiceKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const moveCard = (cardId: string, destination: 'top' | 'bottom') => {
    if (destination === 'top') {
      setBottomCardIds(ids => ids.filter(id => id !== cardId))
      setTopCardIds(ids => ids.includes(cardId) ? ids : [...ids, cardId])
      return
    }

    setTopCardIds(ids => ids.filter(id => id !== cardId))
    setBottomCardIds(ids => ids.includes(cardId) ? ids : [...ids, cardId])
  }

  const reorderCard = (zone: 'top' | 'bottom', cardId: string, delta: number) => {
    const setIds = zone === 'top' ? setTopCardIds : setBottomCardIds
    setIds(ids => {
      const currentIndex = ids.indexOf(cardId)
      const nextIndex = currentIndex + delta
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids
      const nextIds = [...ids]
      const [card] = nextIds.splice(currentIndex, 1)
      nextIds.splice(nextIndex, 0, card)
      return nextIds
    })
  }

  const topCards = topCardIds.map(id => cardsById.get(id)).filter((card): card is GameCard => Boolean(card))
  const bottomCards = bottomCardIds.map(id => cardsById.get(id)).filter((card): card is GameCard => Boolean(card))

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center p-4">
        <div className="w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">Scry {choice.amount}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {player?.name ?? 'Player'} is scrying with {choice.sourceName}. Put cards back on top in order, or move them to the bottom.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ScryPile
              title="Top of Library"
              helper="First card here will be drawn next."
              cards={topCards}
              canControl={canControl}
              emptyText="No cards will stay on top."
              moveLabel="Move to Bottom"
              onMove={(cardId) => moveCard(cardId, 'bottom')}
              onMoveUp={(cardId) => reorderCard('top', cardId, -1)}
              onMoveDown={(cardId) => reorderCard('top', cardId, 1)}
            />

            <ScryPile
              title="Bottom of Library"
              helper="Cards here go under the library in this order."
              cards={bottomCards}
              canControl={canControl}
              emptyText="No cards are going to the bottom."
              moveLabel="Move to Top"
              onMove={(cardId) => moveCard(cardId, 'top')}
              onMoveUp={(cardId) => reorderCard('bottom', cardId, -1)}
              onMoveDown={(cardId) => reorderCard('bottom', cardId, 1)}
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Revealed cards: {choice.revealedCards.length}
            </p>
            <button
              type="button"
              onClick={() => onConfirm(topCardIds, bottomCardIds)}
              disabled={!canControl}
              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors enabled:hover:bg-emerald-600 disabled:opacity-40"
            >
              Confirm Scry
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ScryPileProps {
  title: string
  helper: string
  cards: GameCard[]
  canControl: boolean
  emptyText: string
  moveLabel: string
  onMove: (cardId: string) => void
  onMoveUp: (cardId: string) => void
  onMoveDown: (cardId: string) => void
}

function ScryPile({
  title,
  helper,
  cards,
  canControl,
  emptyText,
  moveLabel,
  onMove,
  onMoveUp,
  onMoveDown,
}: ScryPileProps) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{cards.length}</span>
      </div>

      <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 px-3 py-6 text-center text-sm text-slate-500">
            {emptyText}
          </div>
        ) : (
          cards.map((card, index) => (
            <div key={card.instanceId} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-2">
              <span className="w-5 text-center text-xs font-semibold text-slate-500">{index + 1}</span>
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-800">
                {card.imageUri ? (
                  <CardPreview imageUri={card.imageUri} name={card.name}>
                    <img src={card.imageUri} alt={card.name} className="h-full w-full object-cover" />
                  </CardPreview>
                ) : (
                  <div className="flex h-full items-end p-1 text-[10px] text-slate-300">{card.name}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{card.name}</p>
                <p className="truncate text-xs text-slate-500">{card.typeLine}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMoveUp(card.instanceId)}
                  disabled={!canControl || index === 0}
                  className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 transition-colors enabled:hover:bg-slate-700 disabled:opacity-30"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDown(card.instanceId)}
                  disabled={!canControl || index === cards.length - 1}
                  className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 transition-colors enabled:hover:bg-slate-700 disabled:opacity-30"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => onMove(card.instanceId)}
                  disabled={!canControl}
                  className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-medium text-white transition-colors enabled:hover:bg-slate-600 disabled:opacity-30"
                >
                  {moveLabel}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
