import { useState } from 'react'
import { ColorPips } from '@/components/ui/ColorPips'
import { CardPreview } from '@/components/ui/CardPreview'
import type { Player, GameCard, ZoneName, TurnPhase } from '@/types/game-state'

function CardThumb({ card, selected, onClick }: { card: GameCard; selected?: boolean; onClick?: () => void }) {
  const inner = card.imageUri ? (
    <img
      src={card.imageUri}
      alt={card.name}
      className={`aspect-[5/7] w-full rounded-lg object-cover shadow-lg transition-transform ${card.tapped ? 'rotate-90 scale-[0.86]' : ''} ${selected ? 'ring-2 ring-violet-400' : ''}`}
      loading="lazy"
    />
  ) : (
    <div className={`flex aspect-[5/7] w-full items-end rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-200 ${selected ? 'ring-2 ring-violet-400' : ''}`}>
      {card.name}
    </div>
  )

  if (!card.imageUri) return <button type="button" onClick={onClick} className="w-20 flex-shrink-0 text-left">{inner}</button>

  return (
    <button type="button" onClick={onClick} className="relative w-20 flex-shrink-0 text-left">
      <CardPreview imageUri={card.imageUri} name={card.name}>
        {inner}
      </CardPreview>
    </button>
  )
}

function ZoneRow({
  title,
  cards,
  empty,
  selectedCardId,
  onSelect,
  renderCardActions,
}: {
  title: string
  cards: GameCard[]
  empty: string
  selectedCardId: string | null
  onSelect: (card: GameCard) => void
  renderCardActions?: (card: GameCard) => React.ReactNode
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cards.map(card => (
          <div key={card.instanceId} className="relative pt-14">
            {selectedCardId === card.instanceId && renderCardActions?.(card)}
            <CardThumb
              card={card}
              selected={selectedCardId === card.instanceId}
              onClick={() => onSelect(card)}
            />
          </div>
        ))}
        {cards.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-500">
            {empty}
          </div>
        )}
      </div>
    </div>
  )
}

function ZonePilePreview({
  title,
  cards,
  accentClass,
  onOpen,
}: {
  title: string
  cards: GameCard[]
  accentClass: string
  onOpen: () => void
}) {
  const topCards = cards.slice(-3)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative flex min-h-28 flex-col rounded-xl border bg-slate-900/70 p-2 text-left transition-colors hover:bg-slate-800/90 ${accentClass}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-slate-400">{title}</span>
        <span className="text-sm font-semibold text-white">{cards.length}</span>
      </div>
      <div className="relative mt-2 h-16">
        {topCards.length > 0 ? (
          topCards.map((card, index) => (
            <div
              key={card.instanceId}
              className="absolute top-0 w-12"
              style={{ left: `${index * 14}px`, zIndex: index + 1 }}
            >
              {card.imageUri ? (
                <img
                  src={card.imageUri}
                  alt={card.name}
                  className="aspect-[5/7] w-full rounded-md object-cover shadow-lg"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[5/7] w-full items-end rounded-md border border-slate-700 bg-slate-800 p-1 text-[9px] text-slate-200">
                  {card.name}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-700 text-[11px] text-slate-500">
            Empty
          </div>
        )}
      </div>
    </button>
  )
}

function FanOverlay({
  title,
  cards,
  onClose,
  onSelect,
}: {
  title: string
  cards: GameCard[]
  onClose: () => void
  onSelect: (card: GameCard) => void
}) {
  return (
    <div className="absolute inset-0 z-20 bg-slate-950/95 backdrop-blur-sm p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-slate-400">{cards.length} card{cards.length === 1 ? '' : 's'}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800"
        >
          Close
        </button>
      </div>

      <div className="mt-4 overflow-x-auto overflow-y-hidden pb-3">
        <div className="flex min-h-48 items-end px-3">
          {cards.length > 0 ? (
            cards.map((card, index) => (
              <button
                key={card.instanceId}
                type="button"
                onClick={() => onSelect(card)}
                className="-ml-8 first:ml-0 w-24 flex-shrink-0 text-left transition-transform hover:-translate-y-2"
                style={{ zIndex: index + 1 }}
              >
                <CardThumb card={card} />
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500">
              No cards here
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface PlayerTileProps {
  player: Player
  isCurrentTurn: boolean
  currentPhase: TurnPhase
  rotated?: boolean
  onLifeDelta: (delta: number) => void
  onDrawCard: () => void
  onMoveCard: (from: ZoneName, to: ZoneName, cardId: string) => void
  onToggleTapped: (cardId: string) => void
  onPlayLand: (cardId: string) => void
  onCastCommander: (cardId: string) => void
  onCastPermanent: (cardId: string) => void
  onOpenDamage: () => void
  onOpenCounters: () => void
}

export function PlayerTile({
  player, isCurrentTurn, currentPhase, rotated, onLifeDelta, onDrawCard, onMoveCard, onToggleTapped, onPlayLand, onCastCommander, onCastPermanent, onOpenDamage, onOpenCounters
}: PlayerTileProps) {
  const borderColor = isCurrentTurn ? 'border-violet-500' : 'border-slate-700'
  const { library, hand, lands, battlefield, graveyard, exile, commandZone } = player.zones
  const [selected, setSelected] = useState<{ zone: ZoneName; card: GameCard } | null>(null)
  const [expandedZone, setExpandedZone] = useState<{ zone: 'graveyard' | 'exile'; title: string } | null>(null)

  const selectedIsLand = selected ? selected.card.typeLine.toLowerCase().includes('land') : false
  const selectedIsPermanent = selected ? !selected.card.typeLine.toLowerCase().includes('instant') && !selected.card.typeLine.toLowerCase().includes('sorcery') : false

  function renderSelectedCardActions(card: GameCard) {
    if (!selected || selected.card.instanceId !== card.instanceId) return null

    return (
      <div className="absolute left-0 right-0 top-0 z-10 rounded-xl border border-violet-800 bg-slate-950/95 p-2 shadow-2xl">
        <div className="mb-1 truncate text-[10px] font-medium text-violet-200">{card.name}</div>
        <div className="flex flex-wrap gap-1">
          {selected.zone === 'hand' && selectedIsLand && (
            <button
              onClick={() => {
                onPlayLand(card.instanceId)
                setSelected(null)
              }}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
            >
              Play Land
            </button>
          )}
          {selected.zone === 'hand' && !selectedIsLand && selectedIsPermanent && (
            <button
              onClick={() => {
                onCastPermanent(card.instanceId)
                setSelected(null)
              }}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
            >
              Cast
            </button>
          )}
          {selected.zone === 'commandZone' && (
            <button
              onClick={() => {
                onCastCommander(card.instanceId)
                setSelected(null)
              }}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
            >
              Cast Cmdr
            </button>
          )}
          {(selected.zone === 'battlefield' || selected.zone === 'lands') && (
            <button
              onClick={() => {
                onToggleTapped(card.instanceId)
                setSelected(null)
              }}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
            >
              {card.tapped ? 'Untap' : 'Tap'}
            </button>
          )}
          {selected.zone !== 'library' && selected.zone !== 'battlefield' && selected.zone !== 'lands' && (
            <button
              onClick={() => {
                onMoveCard(selected.zone, 'battlefield', card.instanceId)
                setSelected(null)
              }}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
            >
              To Field
            </button>
          )}
          {selected.zone !== 'hand' && (
            <button
              onClick={() => {
                onMoveCard(selected.zone, 'hand', card.instanceId)
                setSelected(null)
              }}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
            >
              To Hand
            </button>
          )}
          {selected.zone !== 'graveyard' && (
            <button
              onClick={() => {
                onMoveCard(selected.zone, 'graveyard', card.instanceId)
                setSelected(null)
              }}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
            >
              Gy
            </button>
          )}
          {selected.zone !== 'exile' && (
            <button
              onClick={() => {
                onMoveCard(selected.zone, 'exile', card.instanceId)
                setSelected(null)
              }}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
            >
              Exile
            </button>
          )}
          <button
            onClick={() => setSelected(null)}
            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col border-2 ${borderColor} rounded-2xl overflow-hidden bg-slate-900 transition-colors`}
    >
      {/* Eliminated overlay */}
      {player.isEliminated && (
        <div className="absolute inset-0 bg-black/70 z-10 flex flex-col items-center justify-center gap-2">
          <span className="text-5xl">💀</span>
          <span className="text-slate-400 text-sm font-medium">Eliminated</span>
        </div>
      )}

      {/* Header */}
      <div className={`px-3 pt-2 pb-2 flex items-start gap-2 border-b border-slate-800 bg-slate-950/80 ${rotated ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/90 px-1.5 py-1 ${rotated ? 'rotate-180' : ''}`}>
          <button
            onClick={() => onLifeDelta(-1)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
            aria-label="Decrease life"
          >
            −
          </button>
          <div className="min-w-10 text-center text-2xl font-bold tabular-nums text-white">
            {player.life}
          </div>
          <button
            onClick={() => onLifeDelta(1)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-green-400"
            aria-label="Increase life"
          >
            +
          </button>
        </div>

        <div className="flex flex-col min-w-0 flex-1 pt-1">
          <span className="font-semibold text-sm truncate">{player.name || `Player ${player.seat + 1}`}</span>
          {player.commander && (
            <span className="text-xs text-slate-400 truncate">{player.commander.name}</span>
          )}
          {isCurrentTurn && (
            <span className="text-[10px] text-slate-500">
              {currentPhase.toUpperCase()} • Lands played: {player.landsPlayedThisTurn}/1
            </span>
          )}
        </div>
        {player.commander && <ColorPips colors={player.commander.colorIdentity} />}
        {isCurrentTurn && (
          <span className="mt-1 text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">Turn</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-950/60">
        {/* Zones */}
        <div className="px-2 py-2">
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
            <div className="rounded-lg bg-slate-800/90 p-2">
              <div className="text-slate-500 uppercase tracking-wide">Library</div>
              <div className="mt-1 text-sm font-semibold">{library.length}</div>
              <button
                onClick={onDrawCard}
                className="mt-2 rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
              >
                Draw
              </button>
            </div>
            <div className="rounded-lg bg-slate-800/90 p-2">
              <div className="text-slate-500 uppercase tracking-wide">Lands</div>
              <div className="mt-1 text-sm font-semibold">{lands.length}</div>
            </div>
            <div className="rounded-lg bg-slate-800/90 p-2">
              <div className="text-slate-500 uppercase tracking-wide">Battlefield</div>
              <div className="mt-1 text-sm font-semibold">{battlefield.length}</div>
            </div>
            <div className="rounded-lg bg-slate-800/90 p-2">
              <div className="text-slate-500 uppercase tracking-wide">Hand</div>
              <div className="mt-1 text-sm font-semibold">{hand.length}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-violet-800/70 bg-violet-950/20 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-violet-200">Command</span>
                <span className="text-sm font-semibold text-white">{commandZone.length}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {commandZone.length > 0 ? (
                  commandZone.map(card => (
                    <div key={card.instanceId} className="relative w-16 flex-shrink-0 pt-14">
                      {selected?.card.instanceId === card.instanceId && renderSelectedCardActions(card)}
                      <CardThumb
                        card={card}
                        selected={selected?.card.instanceId === card.instanceId}
                        onClick={() => setSelected({ zone: 'commandZone', card })}
                      />
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-700 px-2 py-4 text-[11px] text-slate-500">
                    Empty
                  </div>
                )}
              </div>
            </div>

            <ZonePilePreview
              title="Graveyard"
              cards={graveyard}
              accentClass="border-emerald-900/70"
              onOpen={() => setExpandedZone({ zone: 'graveyard', title: 'Graveyard' })}
            />

            <ZonePilePreview
              title="Exile"
              cards={exile}
              accentClass="border-amber-900/70"
              onOpen={() => setExpandedZone({ zone: 'exile', title: 'Exile' })}
            />
          </div>

          <ZoneRow
            title="Battlefield"
            cards={battlefield}
            empty="No permanents on battlefield"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'battlefield', card })}
            renderCardActions={renderSelectedCardActions}
          />

          <ZoneRow
            title="Lands"
            cards={lands}
            empty="No lands in play"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'lands', card })}
            renderCardActions={renderSelectedCardActions}
          />

          <ZoneRow
            title="Hand"
            cards={hand}
            empty="No cards in hand"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'hand', card })}
            renderCardActions={renderSelectedCardActions}
          />
        </div>
      </div>

      {expandedZone && (
        <FanOverlay
          title={expandedZone.title}
          cards={player.zones[expandedZone.zone]}
          onClose={() => setExpandedZone(null)}
          onSelect={(card) => {
            setSelected({ zone: expandedZone.zone, card })
            setExpandedZone(null)
          }}
        />
      )}

      {/* Status badges */}
      <div className="flex flex-wrap gap-1 px-2 py-1 border-t border-slate-800 bg-slate-950/90">
        {player.hasMonarch && (
          <span className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-600 px-1.5 py-0.5 rounded-full">👑 Monarch</span>
        )}
        {player.hasInitiative && (
          <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-600 px-1.5 py-0.5 rounded-full">⚔️ Initiative</span>
        )}
        {player.counters.poison > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${player.counters.poison >= 10 ? 'bg-green-500 text-white' : 'bg-green-900/40 text-green-400 border border-green-700'}`}>
            ☠️ {player.counters.poison}
          </span>
        )}
        {!player.isConnected && (
          <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">⚡ offline</span>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="flex border-t border-slate-700/50">
        <button
          onClick={onOpenDamage}
          className="flex-1 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors text-center"
        >
          ⚔️ Cmdr Dmg
        </button>
        <button
          onClick={onOpenCounters}
          className="flex-1 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors text-center border-l border-slate-700/50"
        >
          🔢 Counters
        </button>
      </div>
    </div>
  )
}
