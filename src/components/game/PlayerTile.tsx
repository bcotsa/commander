import { useState } from 'react'
import { ColorPips } from '@/components/ui/ColorPips'
import { CardPreview } from '@/components/ui/CardPreview'
import type { Player, GameCard, ZoneName } from '@/types/game-state'

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
    <button type="button" onClick={onClick} className="w-20 flex-shrink-0 text-left">
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
}: {
  title: string
  cards: GameCard[]
  empty: string
  selectedCardId: string | null
  onSelect: (card: GameCard) => void
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cards.map(card => (
          <CardThumb
            key={card.instanceId}
            card={card}
            selected={selectedCardId === card.instanceId}
            onClick={() => onSelect(card)}
          />
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

interface PlayerTileProps {
  player: Player
  isCurrentTurn: boolean
  rotated?: boolean
  onLifeDelta: (delta: number) => void
  onDrawCard: () => void
  onMoveCard: (from: ZoneName, to: ZoneName, cardId: string) => void
  onToggleTapped: (cardId: string) => void
  onOpenDamage: () => void
  onOpenCounters: () => void
}

export function PlayerTile({
  player, isCurrentTurn, rotated, onLifeDelta, onDrawCard, onMoveCard, onToggleTapped, onOpenDamage, onOpenCounters
}: PlayerTileProps) {
  const borderColor = isCurrentTurn ? 'border-violet-500' : 'border-slate-700'
  const { library, hand, battlefield, graveyard, exile, commandZone } = player.zones
  const [selected, setSelected] = useState<{ zone: ZoneName; card: GameCard } | null>(null)

  const zoneActions: Partial<Record<ZoneName, Array<{ label: string; to?: ZoneName; kind?: 'toggleTapped' }>>> = {
    hand: [
      { label: 'Battlefield', to: 'battlefield' },
      { label: 'Graveyard', to: 'graveyard' },
      { label: 'Exile', to: 'exile' },
    ],
    battlefield: [
      { label: selected?.card.tapped ? 'Untap' : 'Tap', kind: 'toggleTapped' },
      { label: 'Hand', to: 'hand' },
      { label: 'Graveyard', to: 'graveyard' },
      { label: 'Exile', to: 'exile' },
    ],
    graveyard: [
      { label: 'Hand', to: 'hand' },
      { label: 'Battlefield', to: 'battlefield' },
      { label: 'Exile', to: 'exile' },
    ],
    exile: [
      { label: 'Hand', to: 'hand' },
      { label: 'Battlefield', to: 'battlefield' },
      { label: 'Graveyard', to: 'graveyard' },
    ],
    commandZone: [
      { label: 'Battlefield', to: 'battlefield' },
      { label: 'Hand', to: 'hand' },
    ],
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
              <div className="text-slate-500 uppercase tracking-wide">Battlefield</div>
              <div className="mt-1 text-sm font-semibold">{battlefield.length}</div>
            </div>
            <div className="rounded-lg bg-slate-800/90 p-2">
              <div className="text-slate-500 uppercase tracking-wide">Graveyard</div>
              <div className="mt-1 text-sm font-semibold">{graveyard.length}</div>
            </div>
            <div className="rounded-lg bg-slate-800/90 p-2">
              <div className="text-slate-500 uppercase tracking-wide">Exile</div>
              <div className="mt-1 text-sm font-semibold">{exile.length}</div>
            </div>
            <div className="rounded-lg bg-slate-800/90 p-2">
              <div className="text-slate-500 uppercase tracking-wide">Command</div>
              <div className="mt-1 text-sm font-semibold">{commandZone.length}</div>
            </div>
            <div className="rounded-lg bg-slate-800/90 p-2">
              <div className="text-slate-500 uppercase tracking-wide">Hand</div>
              <div className="mt-1 text-sm font-semibold">{hand.length}</div>
            </div>
          </div>

          {selected && (
            <div className="mt-3 rounded-xl border border-violet-800 bg-violet-950/30 p-2">
              <div className="text-xs font-medium text-violet-200">{selected.card.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(zoneActions[selected.zone] ?? []).map(action => (
                  <button
                    key={action.label}
                    onClick={() => {
                      if (action.kind === 'toggleTapped') {
                        onToggleTapped(selected.card.instanceId)
                      } else if (action.to) {
                        onMoveCard(selected.zone, action.to, selected.card.instanceId)
                      }
                      setSelected(null)
                    }}
                    className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          <ZoneRow
            title="Command Zone"
            cards={commandZone}
            empty="No commander in command zone"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'commandZone', card })}
          />

          <ZoneRow
            title="Hand"
            cards={hand}
            empty="No cards in hand"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'hand', card })}
          />

          <ZoneRow
            title="Battlefield"
            cards={battlefield}
            empty="No permanents on battlefield"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'battlefield', card })}
          />

          <ZoneRow
            title="Graveyard"
            cards={graveyard}
            empty="No cards in graveyard"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'graveyard', card })}
          />

          <ZoneRow
            title="Exile"
            cards={exile}
            empty="No cards in exile"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'exile', card })}
          />
        </div>
      </div>

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
