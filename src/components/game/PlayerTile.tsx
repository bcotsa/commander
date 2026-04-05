import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ColorPips } from '@/components/ui/ColorPips'
import { CardPreview } from '@/components/ui/CardPreview'
import type { Player, GameCard, ZoneName, TurnPhase, CombatState } from '@/types/game-state'
import { canAutoPayManaCost, formatManaPool, getActivatedAbilities, getSimpleSpellDefinition } from '@/lib/card-rules'

function CardThumb({
  card,
  selected,
  onClick,
  buttonRef,
}: {
  card: GameCard
  selected?: boolean
  onClick?: () => void
  buttonRef?: (node: HTMLButtonElement | null) => void
}) {
  const inner = card.imageUri ? (
    <div className="relative">
      <img
        src={card.imageUri}
        alt={card.name}
        className={`aspect-[5/7] w-full rounded-lg object-cover shadow-lg transition-transform ${card.tapped ? 'rotate-90 scale-[0.86]' : ''} ${selected ? 'ring-2 ring-violet-400' : ''}`}
        loading="lazy"
      />
      {(card.power !== null || card.toughness !== null) && (
        <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-semibold text-white">
          {card.power ?? '?'} / {card.toughness ?? '?'}
        </div>
      )}
      {card.summoningSick && (
        <div className="absolute top-1 left-1 rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-semibold text-black">
          Sick
        </div>
      )}
    </div>
  ) : (
    <div className={`flex aspect-[5/7] w-full items-end rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-200 ${selected ? 'ring-2 ring-violet-400' : ''}`}>
      {card.name}
    </div>
  )

  if (!card.imageUri) return <button type="button" ref={buttonRef} onClick={onClick} className="w-20 flex-shrink-0 text-left">{inner}</button>

  return (
    <button type="button" ref={buttonRef} onClick={onClick} className="relative w-20 flex-shrink-0 text-left">
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
  registerCardRef,
}: {
  title: string
  cards: GameCard[]
  empty: string
  selectedCardId: string | null
  onSelect: (card: GameCard) => void
  registerCardRef: (cardId: string, node: HTMLButtonElement | null) => void
}) {
  return (
    <div className="mt-2">
      <div className="mb-0 text-[11px] uppercase tracking-wide leading-none text-slate-500">{title}</div>
      <div className="flex gap-0 overflow-x-auto pb-0">
        {cards.map(card => (
          <div key={card.instanceId} className="relative">
            <CardThumb
              card={card}
              selected={selectedCardId === card.instanceId}
              onClick={() => onSelect(card)}
              buttonRef={(node) => registerCardRef(card.instanceId, node)}
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
  allPlayers: Player[]
  isCurrentTurn: boolean
  isPriorityProxy?: boolean
  currentTurnPlayerId: string | null
  currentPhase: TurnPhase
  combat: CombatState
  rotated?: boolean
  onLifeDelta: (delta: number) => void
  onDrawCard: () => void
  onMoveCard: (from: ZoneName, to: ZoneName, cardId: string) => void
  onToggleTapped: (cardId: string) => void
  onActivateAbility: (cardId: string, abilityId: string) => void
  onPlayLand: (cardId: string) => void
  onCastCommander: (cardId: string) => void
  onCastPermanent: (cardId: string) => void
  onCastSpell: (cardId: string, targetCardId?: string, targetPlayerId?: string) => void
  onDeclareAttacker: (cardId: string, defendingPlayerId: string) => void
  onRemoveAttacker: (cardId: string) => void
  onAssignBlocker: (blockerId: string, attackerId: string) => void
  onRemoveBlocker: (blockerId: string, attackerId: string) => void
  onOpenDamage: () => void
  onOpenCounters: () => void
}

export function PlayerTile({
  player, allPlayers, isCurrentTurn, isPriorityProxy, currentTurnPlayerId, currentPhase, combat, rotated, onLifeDelta, onDrawCard, onMoveCard, onToggleTapped, onActivateAbility, onPlayLand, onCastCommander, onCastPermanent, onCastSpell, onDeclareAttacker, onRemoveAttacker, onAssignBlocker, onRemoveBlocker, onOpenDamage, onOpenCounters
}: PlayerTileProps) {
  const borderColor = isPriorityProxy ? 'border-emerald-500' : isCurrentTurn ? 'border-violet-500' : 'border-slate-700'
  const { library, hand, lands, battlefield, graveyard, exile, commandZone } = player.zones
  const [selected, setSelected] = useState<{ zone: ZoneName; card: GameCard } | null>(null)
  const [expandedZone, setExpandedZone] = useState<{ zone: 'graveyard' | 'exile'; title: string } | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const cardButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const selectedIsLand = selected ? selected.card.typeLine.toLowerCase().includes('land') : false
  const selectedIsPermanent = selected ? !selected.card.typeLine.toLowerCase().includes('instant') && !selected.card.typeLine.toLowerCase().includes('sorcery') : false
  const selectedIsCreature = selected ? selected.card.typeLine.toLowerCase().includes('creature') && selected.card.power !== null && selected.card.toughness !== null : false
  const selectedSpell = selected ? getSimpleSpellDefinition(selected.card) : null
  const selectedCanPay = selected ? canAutoPayManaCost(player.manaPool, [...lands, ...battlefield], selected.card.manaCost, player) : false
  const activatedAbilities = selected && (selected.zone === 'battlefield' || selected.zone === 'lands')
    ? getActivatedAbilities(selected.card, player)
    : []
  const activeAttack = selected ? combat.attackers.find(a => a.attackerId === selected.card.instanceId) : null
  const defendableAttacks = combat.attackers.filter(a => a.defendingPlayerId === player.id)
  const spellCardTargets = selectedSpell && selected
    ? allPlayers.flatMap(otherPlayer => otherPlayer.zones.battlefield.filter(card => {
        if (selectedSpell.target === 'battlefield_creature' || selectedSpell.target === 'creature_or_player') {
          return card.typeLine.toLowerCase().includes('creature')
        }
        if (selectedSpell.target === 'battlefield_nonland_permanent') {
          return !card.typeLine.toLowerCase().includes('land')
        }
        if (selectedSpell.target === 'battlefield_permanent') {
          return true
        }
        return false
      }).map(card => ({ player: otherPlayer, card })))
    : []
  const spellLandTargets = selectedSpell?.target === 'battlefield_permanent'
    ? allPlayers.flatMap(otherPlayer => otherPlayer.zones.lands.map(card => ({ player: otherPlayer, card })))
    : []
  const ownGraveyardCreatureTargets = selectedSpell?.target === 'own_graveyard_creature'
    ? graveyard.filter(card => card.typeLine.toLowerCase().includes('creature'))
    : []

  function registerCardRef(cardId: string, node: HTMLButtonElement | null) {
    cardButtonRefs.current[cardId] = node
  }

  useEffect(() => {
    if (!selected) {
      setMenuPosition(null)
      return
    }

    const updateMenuPosition = () => {
      const anchor = cardButtonRefs.current[selected.card.instanceId]
      if (!anchor) {
        setMenuPosition(null)
        return
      }

      const rect = anchor.getBoundingClientRect()
      const menuWidth = 220
      const desiredLeft = rect.left + rect.width / 2 - menuWidth / 2
      const clampedLeft = Math.min(Math.max(8, desiredLeft), window.innerWidth - menuWidth - 8)
      const showAbove = rect.top > 112
      const top = showAbove ? rect.top - 8 : rect.bottom + 8

      setMenuPosition({ top, left: clampedLeft })
    }

    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [selected])

  function renderSelectedCardActions(card: GameCard) {
    if (!selected || selected.card.instanceId !== card.instanceId) return null

    return (
      <div
        className="fixed z-[60] w-[220px] rounded-xl border border-violet-800 bg-slate-950/95 p-2 shadow-2xl"
        style={{
          top: menuPosition ? `${menuPosition.top}px` : undefined,
          left: menuPosition ? `${menuPosition.left}px` : undefined,
          transform: menuPosition && menuPosition.top > 100 ? 'translateY(-100%)' : undefined,
        }}
      >
        <div className="mb-1 truncate text-[10px] font-medium text-violet-200">{card.name}</div>
        <div className="flex flex-wrap gap-1">
          {(selected.zone === 'battlefield' || selected.zone === 'lands') && activatedAbilities.map(ability => (
            <button
              key={ability.id}
              onClick={() => {
                onActivateAbility(card.instanceId, ability.id)
                setSelected(null)
              }}
              className="rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-emerald-600"
            >
              {ability.label}
            </button>
          ))}
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
              disabled={!selectedCanPay}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cast
            </button>
          )}
          {selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && selectedSpell?.target === 'none' && (
            <button
              onClick={() => {
                onCastSpell(card.instanceId)
                setSelected(null)
              }}
              disabled={!selectedCanPay}
              className="rounded-md bg-sky-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cast Spell
            </button>
          )}
          {selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && selectedSpell?.target === 'creature_or_player' &&
            allPlayers.filter(otherPlayer => !otherPlayer.isEliminated).map(otherPlayer => (
              <button
                key={`player-${otherPlayer.id}`}
                onClick={() => {
                  onCastSpell(card.instanceId, undefined, otherPlayer.id)
                  setSelected(null)
                }}
                disabled={!selectedCanPay}
                className="rounded-md bg-sky-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Hit {otherPlayer.name || `P${otherPlayer.seat + 1}`}
              </button>
            ))}
          {selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && (selectedSpell?.target === 'battlefield_creature' || selectedSpell?.target === 'creature_or_player' || selectedSpell?.target === 'battlefield_nonland_permanent' || selectedSpell?.target === 'battlefield_permanent') &&
            [...spellCardTargets, ...spellLandTargets].map(({ player: targetPlayer, card: targetCard }) => (
              <button
                key={targetCard.instanceId}
                onClick={() => {
                  onCastSpell(card.instanceId, targetCard.instanceId)
                  setSelected(null)
                }}
                disabled={!selectedCanPay}
                className="rounded-md bg-sky-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {targetPlayer.name || `P${targetPlayer.seat + 1}`}: {targetCard.name}
              </button>
            ))}
          {selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && selectedSpell?.target === 'own_graveyard_creature' &&
            ownGraveyardCreatureTargets.map(targetCard => (
              <button
                key={targetCard.instanceId}
                onClick={() => {
                  onCastSpell(card.instanceId, targetCard.instanceId)
                  setSelected(null)
                }}
                disabled={!selectedCanPay}
                className="rounded-md bg-sky-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Return {targetCard.name}
              </button>
            ))}
          {selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && !selectedSpell && (
            <span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400">
              Spell not supported yet
            </span>
          )}
          {selected.zone === 'commandZone' && (
            <button
              onClick={() => {
                onCastCommander(card.instanceId)
                setSelected(null)
              }}
              disabled={!selectedCanPay}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cast Cmdr
            </button>
          )}
          {selected.zone === 'battlefield' && currentPhase === 'combat' && currentTurnPlayerId === player.id && selectedIsCreature && !card.tapped && !card.summoningSick && !activeAttack && (
            allPlayers
              .filter(p => p.id !== player.id && !p.isEliminated)
              .map(opponent => (
                <button
                  key={opponent.id}
                  onClick={() => {
                    onDeclareAttacker(card.instanceId, opponent.id)
                    setSelected(null)
                  }}
                  className="rounded-md bg-red-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-red-600"
                >
                  Attack {opponent.name || `P${opponent.seat + 1}`}
                </button>
              ))
          )}
          {selected.zone === 'battlefield' && currentPhase === 'combat' && currentTurnPlayerId === player.id && activeAttack && (
            <button
              onClick={() => {
                onRemoveAttacker(card.instanceId)
                setSelected(null)
              }}
              className="rounded-md bg-red-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-red-600"
            >
              Remove Attack
            </button>
          )}
          {selected.zone === 'battlefield' && currentPhase === 'combat' && currentTurnPlayerId !== player.id && selectedIsCreature &&
            defendableAttacks.map(attack => {
              const alreadyBlocking = attack.blockerIds.includes(card.instanceId)
              return (
                <button
                  key={attack.attackerId}
                  onClick={() => {
                    if (alreadyBlocking) {
                      onRemoveBlocker(card.instanceId, attack.attackerId)
                    } else {
                      onAssignBlocker(card.instanceId, attack.attackerId)
                    }
                    setSelected(null)
                  }}
                  className="rounded-md bg-blue-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-blue-600"
                >
                  {alreadyBlocking ? `Unblock ${attack.attackerName}` : `Block ${attack.attackerName}`}
                </button>
              )
            })}
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
          {selected.zone !== 'library' && selected.zone !== 'battlefield' && selected.zone !== 'lands' && (selected.zone !== 'hand' || selectedIsPermanent || selectedIsLand) && (
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
          {isPriorityProxy && (
            <span className="text-[10px] text-emerald-300 truncate">
              Host acting for this player
            </span>
          )}
          <span className="text-[10px] text-emerald-300 truncate">
            Mana: {formatManaPool(player.manaPool)}
          </span>
          {isCurrentTurn && (
            <span className="text-[10px] text-slate-500">
              {currentPhase.toUpperCase()} • Lands played: {player.landsPlayedThisTurn}/1
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 pt-1 text-[10px]">
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">Lib {library.length}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">Ld {lands.length}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">Fld {battlefield.length}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">Hand {hand.length}</span>
        </div>
        {player.commander && <ColorPips colors={player.commander.colorIdentity} />}
        {isCurrentTurn && (
          <span className="mt-1 text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">Turn</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-950/60">
        {/* Zones */}
        <div className="px-2 py-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide leading-none text-slate-500">Library</div>
            <button
              onClick={onDrawCard}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-slate-600"
            >
              Draw
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-violet-800/70 bg-violet-950/20 p-2">
              <div className="mb-0 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide leading-none text-violet-200">Command</span>
                <span className="text-sm font-semibold text-white">{commandZone.length}</span>
              </div>
              <div className="flex gap-0 overflow-x-auto pb-0">
                {commandZone.length > 0 ? (
                  commandZone.map(card => (
                    <div key={card.instanceId} className="relative w-16 flex-shrink-0">
                      <CardThumb
                        card={card}
                        selected={selected?.card.instanceId === card.instanceId}
                        onClick={() => setSelected({ zone: 'commandZone', card })}
                        buttonRef={(node) => registerCardRef(card.instanceId, node)}
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
            registerCardRef={registerCardRef}
          />

          <ZoneRow
            title="Lands"
            cards={lands}
            empty="No lands in play"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'lands', card })}
            registerCardRef={registerCardRef}
          />

          <ZoneRow
            title="Hand"
            cards={hand}
            empty="No cards in hand"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => setSelected({ zone: 'hand', card })}
            registerCardRef={registerCardRef}
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

      {selected && menuPosition && createPortal(
        <>
          <button
            type="button"
            aria-label="Close card actions"
            className="fixed inset-0 z-50 cursor-default bg-transparent"
            onClick={() => setSelected(null)}
          />
          {renderSelectedCardActions(selected.card)}
        </>,
        document.body
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
