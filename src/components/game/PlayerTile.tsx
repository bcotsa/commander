import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CastChoiceOverlay } from '@/components/game/CastChoiceOverlay'
import { ColorPips } from '@/components/ui/ColorPips'
import { CardPreview } from '@/components/ui/CardPreview'
import type { CastOptions, ColorSymbol, Player, GameCard, ZoneName, TurnPhase, CombatState } from '@/types/game-state'
import { canAutoPayManaCost, formatManaPool, getActivatedAbilities, getCastChoiceSpec, getPlaneswalkerAbilities, getSimpleSpellDefinition } from '@/lib/card-rules'
import { getTokenImageUri } from '@/lib/scryfall'

function CardThumb({
  card,
  count,
  selected,
  onClick,
  buttonRef,
}: {
  card: GameCard
  count?: number
  selected?: boolean
  onClick?: () => void
  buttonRef?: (node: HTMLButtonElement | null) => void
}) {
  const [resolvedImageUri, setResolvedImageUri] = useState(card.imageUri)

  useEffect(() => {
    let cancelled = false

    if (card.imageUri) {
      setResolvedImageUri(card.imageUri)
      return
    }

    if (!card.isToken || !card.tokenKey) {
      setResolvedImageUri('')
      return
    }

    void getTokenImageUri(card.tokenKey).then((imageUri) => {
      if (!cancelled) setResolvedImageUri(imageUri)
    })

    return () => {
      cancelled = true
    }
  }, [card.imageUri, card.isToken, card.tokenKey])

  const inner = resolvedImageUri ? (
    <div className="relative">
      <img
        src={resolvedImageUri}
        alt={card.name}
        className={`aspect-[5/7] w-full rounded-lg object-cover shadow-lg transition-transform ${card.tapped ? 'rotate-90 scale-[0.86]' : ''} ${selected ? 'ring-2 ring-violet-400' : ''}`}
        loading="lazy"
      />
      {(card.power !== null || card.toughness !== null) && (
        <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-semibold text-white">
          {(card.power ?? 0) + card.plusOneCounters - card.minusOneCounters} / {(card.toughness ?? 0) + card.plusOneCounters - card.minusOneCounters}
        </div>
      )}
      {card.plusOneCounters > 0 && (
        <div className="absolute top-1 right-1 rounded bg-emerald-500/90 px-1 py-0.5 text-[9px] font-semibold text-black">
          +{card.plusOneCounters}
        </div>
      )}
      {card.minusOneCounters > 0 && (
        <div className={`absolute rounded bg-rose-500/90 px-1 py-0.5 text-[9px] font-semibold text-white ${card.plusOneCounters > 0 ? 'top-6 right-1' : 'top-1 right-1'}`}>
          -{card.minusOneCounters}
        </div>
      )}
      {card.loyalty !== null && (
        <div className="absolute top-1 left-1 rounded bg-violet-500/90 px-1 py-0.5 text-[9px] font-semibold text-white">
          {card.loyalty}
        </div>
      )}
      {card.summoningSick && (
        <div className={`absolute rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-semibold text-black ${card.loyalty !== null ? 'top-7 left-1' : 'top-1 left-1'}`}>
          Sick
        </div>
      )}
      {count && count > 1 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/80 px-3 py-1 text-xl font-bold text-white shadow-lg">
            {count}
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className={`relative flex aspect-[5/7] w-full items-end rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-200 ${selected ? 'ring-2 ring-violet-400' : ''}`}>
      {card.name}
      {count && count > 1 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/80 px-3 py-1 text-xl font-bold text-white shadow-lg">
            {count}
          </div>
        </div>
      )}
    </div>
  )

  if (!resolvedImageUri) return <button type="button" ref={buttonRef} onClick={onClick} className="w-20 flex-shrink-0 text-left">{inner}</button>

  return (
    <button type="button" ref={buttonRef} onClick={onClick} className="relative w-20 flex-shrink-0 text-left">
      <CardPreview imageUri={resolvedImageUri} name={card.name}>
        {inner}
      </CardPreview>
    </button>
  )
}

function TokenManaAbilityOverlay({
  player,
  sourceCard,
  onCancel,
  onConfirm,
}: {
  player: Player
  sourceCard: GameCard
  onCancel: () => void
  onConfirm: (options: CastOptions) => void
}) {
  const availableColors: ColorSymbol[] = ['W', 'U', 'B', 'R', 'G']
  const untappedTokens = player.zones.battlefield.filter(card =>
    card.instanceId !== sourceCard.instanceId && card.isToken && !card.tapped
  )
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(untappedTokens[0] ? [untappedTokens[0].instanceId] : [])
  const [color, setColor] = useState<ColorSymbol>(availableColors[0] ?? 'G')
  const canConfirm = selectedCardIds.length > 0 && player.life >= 2 && !sourceCard.tapped

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">{sourceCard.name}</div>
          <div className="text-sm text-slate-400">
            Pay 2 life, tap Hazel, and tap any number of untapped tokens to add that much mana.
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-sm font-medium text-slate-200">Tokens to tap</div>
          <div className="grid max-h-52 gap-2 overflow-y-auto">
            {untappedTokens.map(token => {
              const checked = selectedCardIds.includes(token.instanceId)
              return (
                <label key={token.instanceId} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedCardIds(current =>
                        checked
                          ? current.filter(id => id !== token.instanceId)
                          : [...current, token.instanceId]
                      )
                    }}
                  />
                  <span>{token.name}</span>
                </label>
              )
            })}
            {untappedTokens.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500">
                No untapped tokens available
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-sm font-medium text-slate-200">Mana color for this first pass</div>
          <div className="flex flex-wrap gap-2">
            {availableColors.map(entry => (
              <button
                key={entry}
                type="button"
                onClick={() => setColor(entry)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  color === entry
                    ? 'border-emerald-400 bg-emerald-900/60 text-white'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {entry}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Adds {selectedCardIds.length} {color} mana. Mixed-color distribution can come next.
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {sourceCard.tapped ? 'Hazel is tapped' : player.life < 2 ? 'Not enough life to pay' : `${selectedCardIds.length} token${selectedCardIds.length === 1 ? '' : 's'} selected`}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm({
                selectedCardIds,
                manaColors: selectedCardIds.map(() => color),
              })}
              disabled={!canConfirm}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition-colors enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add Mana
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type ZoneDisplayCard = {
  key: string
  card: GameCard
  count: number
}

function getZoneDisplayCards(cards: GameCard[], collapseTokens = false): ZoneDisplayCard[] {
  if (!collapseTokens) {
    return cards.map(card => ({ key: card.instanceId, card, count: 1 }))
  }

  const display: ZoneDisplayCard[] = []
  const tokenGroups = new Map<string, ZoneDisplayCard>()

  for (const card of cards) {
    if (!card.isToken) {
      display.push({ key: card.instanceId, card, count: 1 })
      continue
    }

    const groupKey = `${card.tokenKey ?? card.name}:${card.tapped ? 't' : 'u'}`
    const existing = tokenGroups.get(groupKey)
    if (existing) {
      existing.count += 1
      continue
    }

    const nextGroup = {
      key: groupKey,
      card,
      count: 1,
    }
    tokenGroups.set(groupKey, nextGroup)
    display.push(nextGroup)
  }

  return display
}

function ZoneRow({
  title,
  cards,
  empty,
  selectedCardId,
  onSelect,
  registerCardRef,
  collapseTokens,
}: {
  title: string
  cards: GameCard[]
  empty: string
  selectedCardId: string | null
  onSelect: (card: GameCard) => void
  registerCardRef: (cardId: string, node: HTMLButtonElement | null) => void
  collapseTokens?: boolean
}) {
  const displayCards = getZoneDisplayCards(cards, collapseTokens)

  return (
    <div className="mt-2">
      <div className="mb-0 text-[11px] uppercase tracking-wide leading-none text-slate-500">{title}</div>
      <div className="flex gap-0 overflow-x-auto pb-0">
        {displayCards.map(({ key, card, count }) => (
          <div key={key} className="relative">
            <CardThumb
              card={card}
              count={count}
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
  canControlPlayer?: boolean
  isPriorityProxy?: boolean
  currentTurnPlayerId: string | null
  currentPhase: TurnPhase
  combat: CombatState
  rotated?: boolean
  onLifeDelta: (delta: number) => void
  onDrawCard: () => void
  onCardCounterChange: (cardId: string, counter: 'plusOne' | 'minusOne' | 'loyalty', delta: number) => void
  onMoveCard: (from: ZoneName, to: ZoneName, cardId: string) => void
  onToggleTapped: (cardId: string) => void
  onActivateAbility: (cardId: string, abilityId: string, targetCardId?: string, options?: CastOptions) => void
  onActivatePlaneswalkerAbility: (cardId: string, abilityId: string, targetCardId?: string, targetPlayerId?: string) => void
  onPlayLand: (cardId: string) => void
  onCastCommander: (cardId: string, options?: CastOptions) => void
  onCastPermanent: (cardId: string, options?: CastOptions) => void
  onCastSpell: (cardId: string, targetCardId?: string, targetPlayerId?: string, options?: CastOptions) => void
  onDeclareAttacker: (cardId: string, defendingPlayerId: string, defendingCardId?: string) => void
  onRemoveAttacker: (cardId: string) => void
  onAssignBlocker: (blockerId: string, attackerId: string) => void
  onRemoveBlocker: (blockerId: string, attackerId: string) => void
  onOpenDamage: () => void
  onOpenCounters: () => void
}

export function PlayerTile({
  player, allPlayers, isCurrentTurn, canControlPlayer, isPriorityProxy, currentTurnPlayerId, currentPhase, combat, rotated, onLifeDelta, onDrawCard, onCardCounterChange, onMoveCard, onToggleTapped, onActivateAbility, onActivatePlaneswalkerAbility, onPlayLand, onCastCommander, onCastPermanent, onCastSpell, onDeclareAttacker, onRemoveAttacker, onAssignBlocker, onRemoveBlocker, onOpenDamage, onOpenCounters
}: PlayerTileProps) {
  const looksLikeLand = (card: GameCard) => {
    if (card.typeLine.toLowerCase().includes('land')) return true
    const oracleText = (card.oracleText ?? '').toLowerCase()
    const hasManaAbility = /\{t\}:\s*add\b/i.test(oracleText)
    const hasLandLikeText =
      oracleText.includes('enters tapped')
      || oracleText.includes('enters the battlefield tapped')
      || oracleText.includes('cycling')
      || oracleText.includes('basic land card')
    return card.manaCost === null && hasManaAbility && hasLandLikeText && card.power === null && card.toughness === null && card.loyalty === null
  }

  const borderColor = isPriorityProxy ? 'border-emerald-500' : isCurrentTurn ? 'border-violet-500' : 'border-slate-700'
  const { library, hand, lands, battlefield, graveyard, exile, commandZone } = player.zones
  const [selected, setSelected] = useState<{ zone: ZoneName; card: GameCard } | null>(null)
  const [pendingCastCard, setPendingCastCard] = useState<{ zone: ZoneName; card: GameCard } | null>(null)
  const [pendingTokenManaAbility, setPendingTokenManaAbility] = useState<{ card: GameCard; abilityId: string } | null>(null)
  const [expandedZone, setExpandedZone] = useState<{ zone: 'graveyard' | 'exile'; title: string } | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const cardButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  function focusThisTile() {
    window.dispatchEvent(new CustomEvent('commander:tile-focus', { detail: { playerId: player.id } }))
  }

  function selectCard(zone: ZoneName, card: GameCard) {
    focusThisTile()
    setPendingCastCard(null)
    setPendingTokenManaAbility(null)
    setSelected({ zone, card })
  }

  function openCastChoice(zone: ZoneName, card: GameCard) {
    focusThisTile()
    setSelected({ zone, card })
    setPendingCastCard({ zone, card })
  }

  const selectedIsLand = selected ? looksLikeLand(selected.card) : false
  const selectedIsPermanent = selected ? !selected.card.typeLine.toLowerCase().includes('instant') && !selected.card.typeLine.toLowerCase().includes('sorcery') : false
  const selectedIsCreature = selected ? selected.card.typeLine.toLowerCase().includes('creature') && selected.card.power !== null && selected.card.toughness !== null : false
  const selectedIsPlaneswalker = selected ? selected.card.typeLine.toLowerCase().includes('planeswalker') : false
  const selectedSpell = selected ? getSimpleSpellDefinition(selected.card) : null
  const selectedCastChoiceSpec = selected && (selected.zone === 'hand' || selected.zone === 'commandZone')
    ? getCastChoiceSpec(selected.card, player)
    : null
  const selectedCanPay = selected ? canAutoPayManaCost(player.manaPool, [...lands, ...battlefield], selected.card.manaCost, player) : false
  const activatedAbilities = selected && (selected.zone === 'battlefield' || selected.zone === 'lands')
    ? getActivatedAbilities(selected.card, player)
    : []
  const planeswalkerAbilities = selected && selected.zone === 'battlefield' && selectedIsPlaneswalker
    ? getPlaneswalkerAbilities(selected.card)
    : []
  const ownBattlefieldCreatureTargets = player.zones.battlefield.filter(card => card.typeLine.toLowerCase().includes('creature'))
  const activeAttack = selected ? combat.attackers.find(a => a.attackerId === selected.card.instanceId) : null
  const defendableAttacks = combat.attackers.filter(a => a.defendingPlayerId === player.id)
  const spellCardTargets = selectedSpell && selected
    ? allPlayers.flatMap(otherPlayer => otherPlayer.zones.battlefield.filter(card => {
        if (selectedSpell.target === 'battlefield_creature') {
          return card.typeLine.toLowerCase().includes('creature')
        }
        if (selectedSpell.target === 'battlefield_creature_or_planeswalker') {
          return card.typeLine.toLowerCase().includes('creature') || card.typeLine.toLowerCase().includes('planeswalker')
        }
        if (selectedSpell.target === 'creature_or_player') {
          return card.typeLine.toLowerCase().includes('creature') || card.typeLine.toLowerCase().includes('planeswalker')
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
  const graveyardCreatureTargets = selectedSpell && (
    selectedSpell.target === 'own_graveyard_creature'
    || selectedSpell.target === 'any_graveyard_creature'
    || selectedSpell.target === 'opponent_graveyard_creature'
  )
    ? allPlayers.flatMap(otherPlayer => {
        if (selectedSpell.target === 'own_graveyard_creature' && otherPlayer.id !== player.id) return []
        if (selectedSpell.target === 'opponent_graveyard_creature' && otherPlayer.id === player.id) return []
        return otherPlayer.zones.graveyard
          .filter(card => card.typeLine.toLowerCase().includes('creature'))
          .map(card => ({ player: otherPlayer, card }))
      })
    : []

  function canPayActivatedAbility(ability: ReturnType<typeof getActivatedAbilities>[number]): boolean {
    if (!selected) return false
    if (ability.kind === 'add_mana_from_tapped_tokens') {
      return !selected.card.tapped && player.life >= ability.lifeCost && battlefield.some(entry => entry.isToken && !entry.tapped)
    }
    if (!ability.genericCost) return true
    return canAutoPayManaCost(
      player.manaPool,
      [...lands, ...battlefield].filter(entry => entry.instanceId !== selected.card.instanceId),
      `{${ability.genericCost}}`,
      player
    )
  }

  function registerCardRef(cardId: string, node: HTMLButtonElement | null) {
    cardButtonRefs.current[cardId] = node
  }

  useEffect(() => {
    const handleTileFocus = (event: Event) => {
      const detail = (event as CustomEvent<{ playerId?: string }>).detail
      if (detail?.playerId === player.id) return
      setSelected(null)
      setPendingCastCard(null)
      setPendingTokenManaAbility(null)
      setExpandedZone(null)
    }

    window.addEventListener('commander:tile-focus', handleTileFocus)
    return () => window.removeEventListener('commander:tile-focus', handleTileFocus)
  }, [player.id])

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
          {canControlPlayer && (selected.zone === 'battlefield' || selected.zone === 'lands') && activatedAbilities
            .filter(ability => ability.kind !== 'explore_target_creature' && ability.kind !== 'add_mana_from_tapped_tokens')
            .map(ability => (
            <button
              key={ability.id}
              onClick={() => {
                onActivateAbility(card.instanceId, ability.id)
                setSelected(null)
              }}
              disabled={!canPayActivatedAbility(ability)}
              className="rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ability.label}
            </button>
          ))}
          {canControlPlayer && (selected.zone === 'battlefield' || selected.zone === 'lands') && activatedAbilities
            .filter(ability => ability.kind === 'add_mana_from_tapped_tokens')
            .map(ability => (
              <button
                key={ability.id}
                onClick={() => {
                  setPendingTokenManaAbility({ card, abilityId: ability.id })
                  setSelected(null)
                }}
                disabled={!canPayActivatedAbility(ability)}
                className="rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ability.label}
              </button>
            ))}
          {canControlPlayer && (selected.zone === 'battlefield' || selected.zone === 'lands') && activatedAbilities
            .filter(ability => ability.kind === 'explore_target_creature')
            .flatMap(ability =>
              ownBattlefieldCreatureTargets.map(target => (
                <button
                  key={`${ability.id}-${target.instanceId}`}
                  onClick={() => {
                    onActivateAbility(card.instanceId, ability.id, target.instanceId)
                    setSelected(null)
                  }}
                  disabled={!canPayActivatedAbility(ability)}
                  className="rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Explore {target.name}
                </button>
              ))
            )}
          {canControlPlayer && selected.zone === 'hand' && selectedIsLand && (
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
          {canControlPlayer && selected.zone === 'hand' && !selectedIsLand && selectedIsPermanent && (
            <button
              onClick={() => {
                if (selectedCastChoiceSpec) {
                  openCastChoice(selected.zone, selected.card)
                } else {
                  onCastPermanent(card.instanceId)
                  setSelected(null)
                }
              }}
              disabled={!selectedCanPay}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedCastChoiceSpec ? 'Cast…' : 'Cast'}
            </button>
          )}
          {canControlPlayer && selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && !selectedCastChoiceSpec && selectedSpell?.target === 'none' && (
            <button
              onClick={() => {
                if (selectedCastChoiceSpec) {
                  openCastChoice(selected.zone, selected.card)
                } else {
                  onCastSpell(card.instanceId)
                  setSelected(null)
                }
              }}
              disabled={!selectedCanPay}
              className="rounded-md bg-sky-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedCastChoiceSpec ? 'Cast Spell…' : 'Cast Spell'}
            </button>
          )}
          {canControlPlayer && selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && selectedCastChoiceSpec && (
            <button
              onClick={() => openCastChoice(selected.zone, selected.card)}
              className="rounded-md bg-sky-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-sky-600"
            >
              Cast Spell…
            </button>
          )}
          {canControlPlayer && selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && !selectedCastChoiceSpec && selectedSpell && selectedSpell.target !== 'none' && (
            <button
              onClick={() => {
                onCastSpell(card.instanceId)
                setSelected(null)
              }}
              disabled={!selectedCanPay}
              className="rounded-md bg-amber-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cast, Choose Target
            </button>
          )}
          {canControlPlayer && selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && !selectedCastChoiceSpec && (selectedSpell?.target === 'creature_or_player' || selectedSpell?.target === 'player') &&
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
                {selectedSpell?.target === 'player' ? 'Target' : 'Hit'} {otherPlayer.name || `P${otherPlayer.seat + 1}`}
              </button>
            ))}
          {canControlPlayer && selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && !selectedCastChoiceSpec && (selectedSpell?.target === 'battlefield_creature' || selectedSpell?.target === 'creature_or_player' || selectedSpell?.target === 'battlefield_nonland_permanent' || selectedSpell?.target === 'battlefield_permanent') &&
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
          {canControlPlayer && selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && !selectedCastChoiceSpec &&
            (selectedSpell?.target === 'own_graveyard_creature' || selectedSpell?.target === 'any_graveyard_creature' || selectedSpell?.target === 'opponent_graveyard_creature') &&
            graveyardCreatureTargets.map(({ player: targetPlayer, card: targetCard }) => (
              <button
                key={targetCard.instanceId}
                onClick={() => {
                  onCastSpell(card.instanceId, targetCard.instanceId)
                  setSelected(null)
                }}
                disabled={!selectedCanPay}
                className="rounded-md bg-sky-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {targetPlayer.name}: {targetCard.name}
              </button>
            ))}
          {selected.zone === 'hand' && !selectedIsLand && !selectedIsPermanent && !selectedSpell && !selectedCastChoiceSpec && (
            <span className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400">
              Spell not supported yet
            </span>
          )}
          {canControlPlayer && selected.zone === 'commandZone' && (
            <button
              onClick={() => {
                if (selectedCastChoiceSpec) {
                  openCastChoice(selected.zone, selected.card)
                } else {
                  onCastCommander(card.instanceId)
                  setSelected(null)
                }
              }}
              disabled={!selectedCanPay}
              className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-medium text-white transition-colors enabled:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedCastChoiceSpec ? 'Cast Cmdr…' : 'Cast Cmdr'}
            </button>
          )}
          {canControlPlayer && selected.zone === 'battlefield' && currentPhase === 'combat' && currentTurnPlayerId === player.id && selectedIsCreature && !card.tapped && !card.summoningSick && !activeAttack && (
            allPlayers
              .filter(p => p.id !== player.id && !p.isEliminated)
              .flatMap(opponent => ([
                <button
                  key={opponent.id}
                  onClick={() => {
                    onDeclareAttacker(card.instanceId, opponent.id)
                    setSelected(null)
                  }}
                  className="rounded-md bg-red-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-red-600"
                >
                  Attack {opponent.name || `P${opponent.seat + 1}`}
                </button>,
                ...opponent.zones.battlefield
                  .filter(opponentCard => opponentCard.typeLine.toLowerCase().includes('planeswalker'))
                  .map(opponentCard => (
                    <button
                      key={`${opponent.id}-${opponentCard.instanceId}`}
                      onClick={() => {
                        onDeclareAttacker(card.instanceId, opponent.id, opponentCard.instanceId)
                        setSelected(null)
                      }}
                      className="rounded-md bg-red-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-red-600"
                    >
                      Attack {opponentCard.name}
                    </button>
                  )),
              ]))
          )}
          {canControlPlayer && selected.zone === 'battlefield' && selectedIsPlaneswalker &&
            planeswalkerAbilities.filter(ability => ability.supported && ability.target === 'none').map(ability => (
              <button
                key={ability.id}
                onClick={() => {
                  onActivatePlaneswalkerAbility(card.instanceId, ability.id)
                  setSelected(null)
                }}
                className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-600"
              >
                {ability.label}
              </button>
            ))}
          {canControlPlayer && selected.zone === 'battlefield' && selectedIsPlaneswalker &&
            planeswalkerAbilities.filter(ability => ability.supported && ability.target === 'battlefield_creature').flatMap(ability =>
              allPlayers.flatMap(otherPlayer =>
                otherPlayer.zones.battlefield
                  .filter(target => target.typeLine.toLowerCase().includes('creature'))
                  .map(target => (
                    <button
                      key={`${ability.id}-${target.instanceId}`}
                        onClick={() => {
                          focusThisTile()
                          onActivatePlaneswalkerAbility(card.instanceId, ability.id, target.instanceId)
                          setSelected(null)
                        }}
                      className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-600"
                    >
                      {ability.label}: {target.name}
                    </button>
                  ))
              )
            )}
          {canControlPlayer && selected.zone === 'battlefield' && selectedIsPlaneswalker &&
            planeswalkerAbilities.filter(ability => ability.supported && ability.target === 'battlefield_nonland_permanent').flatMap(ability =>
              allPlayers.flatMap(otherPlayer =>
                otherPlayer.zones.battlefield
                  .filter(target => !target.typeLine.toLowerCase().includes('land'))
                  .map(target => (
                    <button
                      key={`${ability.id}-${target.instanceId}`}
                        onClick={() => {
                          focusThisTile()
                          onActivatePlaneswalkerAbility(card.instanceId, ability.id, target.instanceId)
                          setSelected(null)
                        }}
                      className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-600"
                    >
                      {ability.label}: {target.name}
                    </button>
                  ))
              )
            )}
          {canControlPlayer && selected.zone === 'battlefield' && selectedIsPlaneswalker &&
            planeswalkerAbilities.filter(ability => ability.supported && ability.target === 'battlefield_permanent').flatMap(ability =>
              [...allPlayers.flatMap(otherPlayer => otherPlayer.zones.battlefield), ...allPlayers.flatMap(otherPlayer => otherPlayer.zones.lands)]
                .map(target => (
                  <button
                    key={`${ability.id}-${target.instanceId}`}
                    onClick={() => {
                      focusThisTile()
                      onActivatePlaneswalkerAbility(card.instanceId, ability.id, target.instanceId)
                      setSelected(null)
                    }}
                    className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-600"
                  >
                    {ability.label}: {target.name}
                  </button>
                ))
            )}
          {canControlPlayer && selected.zone === 'battlefield' && selectedIsPlaneswalker &&
            planeswalkerAbilities.filter(ability => ability.supported && ability.target === 'creature_or_player').flatMap(ability => ([
              ...allPlayers.filter(otherPlayer => !otherPlayer.isEliminated).map(otherPlayer => (
                <button
                  key={`${ability.id}-player-${otherPlayer.id}`}
                  onClick={() => {
                    focusThisTile()
                    onActivatePlaneswalkerAbility(card.instanceId, ability.id, undefined, otherPlayer.id)
                    setSelected(null)
                  }}
                  className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-600"
                >
                  {ability.label}: {otherPlayer.name || `P${otherPlayer.seat + 1}`}
                </button>
              )),
              ...allPlayers.flatMap(otherPlayer =>
                otherPlayer.zones.battlefield
                  .filter(target => target.typeLine.toLowerCase().includes('creature') || target.typeLine.toLowerCase().includes('planeswalker'))
                  .map(target => (
                    <button
                      key={`${ability.id}-${target.instanceId}`}
                      onClick={() => {
                        focusThisTile()
                        onActivatePlaneswalkerAbility(card.instanceId, ability.id, target.instanceId)
                        setSelected(null)
                      }}
                      className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-600"
                    >
                      {ability.label}: {target.name}
                    </button>
                  ))
              ),
            ]))}
          {canControlPlayer && selected.zone === 'battlefield' && selectedIsPlaneswalker &&
            planeswalkerAbilities.filter(ability => ability.supported && ability.target === 'player').flatMap(ability =>
              allPlayers.filter(otherPlayer => !otherPlayer.isEliminated).map(otherPlayer => (
                <button
                  key={`${ability.id}-player-${otherPlayer.id}`}
                  onClick={() => {
                    focusThisTile()
                    onActivatePlaneswalkerAbility(card.instanceId, ability.id, undefined, otherPlayer.id)
                    setSelected(null)
                  }}
                  className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-600"
                >
                  {ability.label}: {otherPlayer.name || `P${otherPlayer.seat + 1}`}
                </button>
              ))
            )}
          {canControlPlayer && selected.zone === 'battlefield' && selectedIsPlaneswalker &&
            planeswalkerAbilities.filter(ability => ability.supported && (
              ability.target === 'own_graveyard_creature'
              || ability.target === 'any_graveyard_creature'
              || ability.target === 'opponent_graveyard_creature'
            )).flatMap(ability =>
              allPlayers.flatMap(otherPlayer => {
                if (ability.target === 'own_graveyard_creature' && otherPlayer.id !== player.id) return []
                if (ability.target === 'opponent_graveyard_creature' && otherPlayer.id === player.id) return []
                return otherPlayer.zones.graveyard
                  .filter(target => target.typeLine.toLowerCase().includes('creature'))
                  .map(target => (
                  <button
                    key={`${ability.id}-${target.instanceId}`}
                    onClick={() => {
                      focusThisTile()
                      onActivatePlaneswalkerAbility(card.instanceId, ability.id, target.instanceId)
                      setSelected(null)
                    }}
                    className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-600"
                  >
                    {ability.label}: {otherPlayer.name} {target.name}
                  </button>
                ))
              })
            )}
          {canControlPlayer && selected.zone === 'battlefield' && selectedIsPlaneswalker &&
            planeswalkerAbilities.filter(ability => !ability.supported).map(ability => (
              <button
                key={ability.id}
                onClick={() => {
                  onActivatePlaneswalkerAbility(card.instanceId, ability.id)
                  setSelected(null)
                }}
                className="rounded-md border border-violet-700 px-2 py-1 text-[10px] font-medium text-violet-200 transition-colors hover:bg-violet-950/60"
              >
                {ability.label} (Manual)
              </button>
            ))}
          {canControlPlayer && selected.zone === 'battlefield' && currentPhase === 'combat' && currentTurnPlayerId === player.id && activeAttack && (
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
          {canControlPlayer && selected.zone === 'battlefield' && currentPhase === 'combat' && currentTurnPlayerId !== player.id && selectedIsCreature &&
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
          {canControlPlayer && (selected.zone === 'battlefield' || selected.zone === 'lands') && card.tokenKey !== 'treasure' && (
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
          {canControlPlayer && selected.zone === 'battlefield' && (
            <>
              <button
                onClick={() => {
                  onCardCounterChange(card.instanceId, 'plusOne', 1)
                  setSelected(null)
                }}
                className="rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-emerald-600"
              >
                +1/+1
              </button>
              <button
                onClick={() => {
                  onCardCounterChange(card.instanceId, 'plusOne', -1)
                  setSelected(null)
                }}
                className="rounded-md bg-emerald-900 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-emerald-800"
              >
                Remove +1/+1
              </button>
              <button
                onClick={() => {
                  onCardCounterChange(card.instanceId, 'minusOne', 1)
                  setSelected(null)
                }}
                className="rounded-md bg-rose-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-rose-600"
              >
                -1/-1
              </button>
              <button
                onClick={() => {
                  onCardCounterChange(card.instanceId, 'minusOne', -1)
                  setSelected(null)
                }}
                className="rounded-md bg-rose-900 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-rose-800"
              >
                Remove -1/-1
              </button>
              {card.loyalty !== null && (
                <>
                  <button
                    onClick={() => {
                      onCardCounterChange(card.instanceId, 'loyalty', 1)
                      setSelected(null)
                    }}
                    className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-600"
                  >
                    + Loyalty
                  </button>
                  <button
                    onClick={() => {
                      onCardCounterChange(card.instanceId, 'loyalty', -1)
                      setSelected(null)
                    }}
                    className="rounded-md bg-violet-900 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-violet-800"
                  >
                    - Loyalty
                  </button>
                </>
              )}
            </>
          )}
          {canControlPlayer && selected.zone !== 'library' && selected.zone !== 'battlefield' && selected.zone !== 'lands' && (selected.zone !== 'hand' || selectedIsPermanent || selectedIsLand) && (
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
          {canControlPlayer && selected.zone !== 'hand' && (
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
          {canControlPlayer && selected.zone !== 'graveyard' && (
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
          {canControlPlayer && selected.zone !== 'exile' && (
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
            disabled={!canControlPlayer}
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
            disabled={!canControlPlayer}
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
              disabled={!canControlPlayer}
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
                        onClick={() => selectCard('commandZone', card)}
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
              onOpen={() => {
                focusThisTile()
                setExpandedZone({ zone: 'graveyard', title: 'Graveyard' })
              }}
            />

            <ZonePilePreview
              title="Exile"
              cards={exile}
              accentClass="border-amber-900/70"
              onOpen={() => {
                focusThisTile()
                setExpandedZone({ zone: 'exile', title: 'Exile' })
              }}
            />
          </div>

          <ZoneRow
            title="Battlefield"
            cards={battlefield}
            empty="No permanents on battlefield"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => selectCard('battlefield', card)}
            registerCardRef={registerCardRef}
            collapseTokens
          />

          <ZoneRow
            title="Lands"
            cards={lands}
            empty="No lands in play"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => selectCard('lands', card)}
            registerCardRef={registerCardRef}
          />

          <ZoneRow
            title="Hand"
            cards={hand}
            empty="No cards in hand"
            selectedCardId={selected?.card.instanceId ?? null}
            onSelect={(card) => selectCard('hand', card)}
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

      {pendingCastCard && createPortal(
        <CastChoiceOverlay
          player={player}
          allPlayers={allPlayers}
          card={pendingCastCard.card}
          source={pendingCastCard.zone === 'commandZone' ? 'commandZone' : 'hand'}
          onCancel={() => setPendingCastCard(null)}
          onConfirm={({ options, targetCardId, targetPlayerId }) => {
            if (pendingCastCard.zone === 'commandZone') {
              onCastCommander(pendingCastCard.card.instanceId, options)
            } else if (pendingCastCard.card.typeLine.toLowerCase().includes('instant') || pendingCastCard.card.typeLine.toLowerCase().includes('sorcery')) {
              onCastSpell(pendingCastCard.card.instanceId, targetCardId, targetPlayerId, options)
            } else {
              onCastPermanent(pendingCastCard.card.instanceId, options)
            }
            setPendingCastCard(null)
            setSelected(null)
          }}
        />,
        document.body
      )}

      {pendingTokenManaAbility && createPortal(
        <TokenManaAbilityOverlay
          player={player}
          sourceCard={pendingTokenManaAbility.card}
          onCancel={() => setPendingTokenManaAbility(null)}
          onConfirm={(options) => {
            onActivateAbility(pendingTokenManaAbility.card.instanceId, pendingTokenManaAbility.abilityId, undefined, options)
            setPendingTokenManaAbility(null)
            setSelected(null)
          }}
        />,
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
