import type { ActionPayload, CastOptions, ColorSymbol, ExploreChoiceState, GameCard, GameState, Player, ProliferateChoiceState, ScryChoiceState, SurveilChoiceState, LibrarySearchChoiceState, TriggerOccurrence } from '@/types/game-state'
import { autoPayManaCost, canAutoPayManaCost, getActivatedAbilities, type GenericAbilityCost, type GenericAbilityEffect } from './card-rules'
import { createTokensForPlayer, pushTokenEnterOccurrences } from './token-utils'
import {
  applyTappedManaCards,
  isCreatureCard,
  mergePaidCardsIntoZones,
  playerCanGainLife,
  pushLeaveBattlefieldOccurrences,
  putLeavingCardInDestination,
  removeCardFromBattlefieldOrLands,
} from './zone-utils'

export interface AbilityDispatchResult {
  players: Player[]
  pendingLibrarySearchChoice: LibrarySearchChoiceState | null
  pendingExploreChoice: ExploreChoiceState | null
  pendingScryChoice: ScryChoiceState | null
  pendingSurveilChoice: SurveilChoiceState | null
  pendingProliferateChoice: ProliferateChoiceState | null
  triggerOccurrences: TriggerOccurrence[]
  changed: boolean
}

type ActivateAbilityAction = Extract<ActionPayload, { type: 'ACTIVATE_ABILITY' }>

function cardMatchesTypeWords(card: GameCard, typeWords: string[]): boolean {
  const typeLine = card.typeLine.toLowerCase()
  const name = card.name.toLowerCase()
  return typeWords.some(word => typeLine.includes(word) || name === word)
}

function getSacrificeCandidates(player: Player, typeWords: string[]): GameCard[] {
  return [...player.zones.battlefield, ...player.zones.lands].filter(card => cardMatchesTypeWords(card, typeWords))
}

export function canPayGenericAbilityCost(player: Player, card: GameCard, cost: GenericAbilityCost): boolean {
  if (cost.tapSource && card.tapped) return false
  if (cost.life > 0 && player.life < cost.life) return false
  if (cost.removeCounters) {
    const available = cost.removeCounters.counter === 'plusOne' ? card.plusOneCounters : card.minusOneCounters
    if (available < cost.removeCounters.amount) return false
  }
  if (cost.sacrificePermanent) {
    const candidates = getSacrificeCandidates(player, cost.sacrificePermanent.typeWords)
    if (candidates.length < cost.sacrificePermanent.count) return false
  }
  if (cost.tapUntappedCreatures > 0) {
    const candidates = player.zones.battlefield.filter(entry =>
      isCreatureCard(entry) && !entry.tapped && entry.instanceId !== card.instanceId
    )
    if (candidates.length < cost.tapUntappedCreatures) return false
  }
  if (cost.mana) {
    const manaCards = [...player.zones.lands, ...player.zones.battlefield].filter(entry => entry.instanceId !== card.instanceId)
    if (!canAutoPayManaCost(player.manaPool, manaCards, cost.mana, player)) return false
  }
  return true
}

export interface GenericCostPaymentResult {
  player: Player
  triggerOccurrences: TriggerOccurrence[]
}

export function payGenericAbilityCost(
  player: Player,
  card: GameCard,
  cost: GenericAbilityCost,
  options?: CastOptions
): GenericCostPaymentResult | null {
  if (!canPayGenericAbilityCost(player, card, cost)) return null

  const triggerOccurrences: TriggerOccurrence[] = []

  const payment = cost.mana
    ? autoPayManaCost(
        player.manaPool,
        [...player.zones.lands, ...player.zones.battlefield].filter(entry => entry.instanceId !== card.instanceId),
        cost.mana,
        player
      )
    : null
  if (cost.mana && !payment) return null

  // Resolve which permanents get sacrificed: an explicit selection wins;
  // otherwise auto-pick only when all candidates are interchangeable by name.
  let sacrificedCards: GameCard[] = []
  if (cost.sacrificePermanent) {
    const candidates = getSacrificeCandidates(player, cost.sacrificePermanent.typeWords)
    const selectedIds = options?.selectedCardIds ?? []
    if (selectedIds.length > 0) {
      const selectedIdSet = new Set(selectedIds)
      sacrificedCards = candidates.filter(entry => selectedIdSet.has(entry.instanceId))
      if (sacrificedCards.length !== cost.sacrificePermanent.count) return null
    } else {
      const uniqueNames = new Set(candidates.map(entry => entry.name))
      if (uniqueNames.size > 1) return null
      sacrificedCards = candidates.slice(0, cost.sacrificePermanent.count)
    }
  }
  const sacrificedIds = new Set(sacrificedCards.map(entry => entry.instanceId))

  const tappedCreatureIds = new Set(
    cost.tapUntappedCreatures > 0
      ? player.zones.battlefield
          .filter(entry =>
            isCreatureCard(entry) && !entry.tapped && entry.instanceId !== card.instanceId && !sacrificedIds.has(entry.instanceId)
          )
          .slice(0, cost.tapUntappedCreatures)
          .map(entry => entry.instanceId)
      : []
  )
  if (cost.tapUntappedCreatures > 0 && tappedCreatureIds.size < cost.tapUntappedCreatures) return null

  const removedIds = new Set(sacrificedIds)
  if (cost.sacrificeSource) removedIds.add(card.instanceId)

  const updateCard = (entry: GameCard): GameCard => {
    let next = payment?.cards.find(paidCard => paidCard.instanceId === entry.instanceId) ?? entry
    if (entry.instanceId === card.instanceId && cost.tapSource) next = { ...next, tapped: true }
    if (tappedCreatureIds.has(entry.instanceId)) next = { ...next, tapped: true }
    if (entry.instanceId === card.instanceId && cost.removeCounters) {
      next = cost.removeCounters.counter === 'plusOne'
        ? { ...next, plusOneCounters: next.plusOneCounters - cost.removeCounters.amount }
        : { ...next, minusOneCounters: next.minusOneCounters - cost.removeCounters.amount }
    }
    return next
  }

  let zones = {
    ...player.zones,
    battlefield: player.zones.battlefield.filter(entry => !removedIds.has(entry.instanceId)).map(updateCard),
    lands: player.zones.lands.filter(entry => !removedIds.has(entry.instanceId)).map(updateCard),
  }

  const leavingCards = [
    ...(cost.sacrificeSource && !sacrificedIds.has(card.instanceId) ? [card] : []),
    ...sacrificedCards,
  ]
  for (const leaving of leavingCards) {
    zones = putLeavingCardInDestination(zones, leaving)
    pushLeaveBattlefieldOccurrences(triggerOccurrences, player.id, leaving)
  }

  return {
    player: {
      ...player,
      life: player.life - cost.life,
      manaPool: payment?.manaPool ?? player.manaPool,
      zones,
    },
    triggerOccurrences,
  }
}

export interface GenericEffectApplication {
  players: Player[]
  triggerOccurrences: TriggerOccurrence[]
  pendingScryChoice: ScryChoiceState | null
  pendingSurveilChoice: SurveilChoiceState | null
  pendingProliferateChoice: ProliferateChoiceState | null
}

export function applyGenericAbilityEffects(
  players: Player[],
  casterId: string,
  sourceCard: Pick<GameCard, 'name' | 'instanceId'>,
  effects: GenericAbilityEffect[],
  targetCardId?: string
): GenericEffectApplication {
  let nextPlayers = players
  const triggerOccurrences: TriggerOccurrence[] = []
  let pendingScryChoice: ScryChoiceState | null = null
  let pendingSurveilChoice: SurveilChoiceState | null = null
  let pendingProliferateChoice: ProliferateChoiceState | null = null

  const updateCaster = (update: (player: Player) => Player) => {
    nextPlayers = nextPlayers.map(player => (player.id === casterId ? update(player) : player))
  }

  for (const effect of effects) {
    if (effect.kind === 'add_mana') {
      updateCaster(player => ({
        ...player,
        manaPool: { ...player.manaPool, [effect.color]: player.manaPool[effect.color] + effect.amount },
      }))
    }

    if (effect.kind === 'draw_cards') {
      updateCaster(player => {
        const drawn = player.zones.library.slice(0, effect.amount)
        if (drawn.length > 0) {
          triggerOccurrences.push({ type: 'card_drawn', controllerId: casterId, amount: drawn.length })
        }
        return {
          ...player,
          zones: {
            ...player.zones,
            library: player.zones.library.slice(drawn.length),
            hand: [...player.zones.hand, ...drawn],
          },
        }
      })
    }

    if (effect.kind === 'gain_life') {
      const canGain = playerCanGainLife(nextPlayers, casterId)
      if (canGain) {
        updateCaster(player => ({ ...player, life: player.life + effect.amount }))
      }
    }

    if (effect.kind === 'lose_life') {
      updateCaster(player => ({ ...player, life: player.life - effect.amount }))
    }

    if (effect.kind === 'create_tokens') {
      updateCaster(player => {
        const tokens = createTokensForPlayer(player, effect.tokenKey, effect.count, effect.tapped ?? false)
        pushTokenEnterOccurrences(triggerOccurrences, player.id, tokens)
        return {
          ...player,
          zones: { ...player.zones, battlefield: [...player.zones.battlefield, ...tokens] },
        }
      })
    }

    if (effect.kind === 'put_counters_each') {
      nextPlayers = nextPlayers.map(player => ({
        ...player,
        zones: {
          ...player.zones,
          battlefield: player.zones.battlefield.map(entry => {
            if (!isCreatureCard(entry)) return entry
            if (effect.scope === 'each_other_creature' && entry.instanceId === sourceCard.instanceId) return entry
            if (effect.scope === 'each_creature_token_you_control' && (player.id !== casterId || !entry.isToken)) return entry
            if (effect.counter === 'minusOne') {
              triggerOccurrences.push({
                type: 'minus_one_counters_placed',
                sourcePlayerId: casterId,
                controllerId: player.id,
                card: entry,
                amount: effect.amount,
              })
              return { ...entry, minusOneCounters: entry.minusOneCounters + effect.amount }
            }
            return { ...entry, plusOneCounters: entry.plusOneCounters + effect.amount }
          }),
        },
      }))
    }

    if (effect.kind === 'put_counters_target_creature') {
      if (!targetCardId) continue
      if (effect.restriction === 'another' && targetCardId === sourceCard.instanceId) continue
      nextPlayers = nextPlayers.map(player => {
        if (effect.restriction === 'opponent_controls' && player.id === casterId) return player
        const target = player.zones.battlefield.find(entry => entry.instanceId === targetCardId)
        if (!target || !isCreatureCard(target)) return player
        if (effect.counter === 'minusOne') {
          triggerOccurrences.push({
            type: 'minus_one_counters_placed',
            sourcePlayerId: casterId,
            controllerId: player.id,
            card: target,
            amount: effect.amount,
          })
        }
        return {
          ...player,
          zones: {
            ...player.zones,
            battlefield: player.zones.battlefield.map(entry =>
              entry.instanceId === targetCardId
                ? effect.counter === 'minusOne'
                  ? { ...entry, minusOneCounters: entry.minusOneCounters + effect.amount }
                  : { ...entry, plusOneCounters: entry.plusOneCounters + effect.amount }
                : entry
            ),
          },
        }
      })
    }

    if (effect.kind === 'proliferate') {
      pendingProliferateChoice = { playerId: casterId, sourceName: sourceCard.name }
    }

    if (effect.kind === 'scry' || effect.kind === 'surveil') {
      const caster = nextPlayers.find(player => player.id === casterId)
      const revealedCards = caster?.zones.library.slice(0, effect.amount).map(entry => ({ ...entry })) ?? []
      if (caster && revealedCards.length > 0) {
        const choice = { playerId: casterId, sourceName: sourceCard.name, amount: revealedCards.length, revealedCards }
        if (effect.kind === 'scry') pendingScryChoice = choice
        else pendingSurveilChoice = choice
      }
    }
  }

  return { players: nextPlayers, triggerOccurrences, pendingScryChoice, pendingSurveilChoice, pendingProliferateChoice }
}

export function dispatchActivatedAbility(state: GameState, action: ActivateAbilityAction): AbilityDispatchResult {
  let changed = false
  let pendingLibrarySearchChoice = state.pendingLibrarySearchChoice
  let pendingExploreChoice = state.pendingExploreChoice
  const triggerOccurrences: TriggerOccurrence[] = []

  const activatingPlayer = state.players.find(player => player.id === action.playerId)
  const activatingCard =
    activatingPlayer?.zones.battlefield.find(entry => entry.instanceId === action.cardId) ??
    activatingPlayer?.zones.lands.find(entry => entry.instanceId === action.cardId)
  const activatingAbility = activatingPlayer && activatingCard
    ? getActivatedAbilities(activatingCard, activatingPlayer).find(entry => entry.id === action.abilityId)
    : undefined

  if (activatingPlayer && activatingCard && activatingAbility?.kind === 'generic' && !activatingAbility.target) {
    const paid = payGenericAbilityCost(activatingPlayer, activatingCard, activatingAbility.cost, action.options)
    if (!paid) return emptyDispatchResult(state)

    const playersAfterCost = state.players.map(player => (player.id === action.playerId ? paid.player : player))
    const applied = applyGenericAbilityEffects(playersAfterCost, action.playerId, activatingCard, activatingAbility.effects)

    return {
      players: applied.players,
      pendingLibrarySearchChoice,
      pendingExploreChoice,
      pendingScryChoice: applied.pendingScryChoice,
      pendingSurveilChoice: applied.pendingSurveilChoice,
      pendingProliferateChoice: applied.pendingProliferateChoice,
      triggerOccurrences: [...paid.triggerOccurrences, ...applied.triggerOccurrences],
      changed: true,
    }
  }

  const players = state.players.map(player => {
    if (player.id !== action.playerId) return player
    const card =
      player.zones.battlefield.find(entry => entry.instanceId === action.cardId) ??
      player.zones.lands.find(entry => entry.instanceId === action.cardId)
    if (!card) return player

    const ability = getActivatedAbilities(card, player).find(entry => entry.id === action.abilityId)
    if (!ability || ability.kind === 'generic') return player
    if (ability.requiresTap && card.tapped) return player

    const payment = autoPayManaCost(
      player.manaPool,
      [...player.zones.lands, ...player.zones.battlefield].filter(entry => entry.instanceId !== action.cardId),
      ability.genericCost ? `{${ability.genericCost}}` : null,
      player
    )
    if ((ability.genericCost ?? 0) > 0 && !payment) return player

    if (ability.kind === 'add_mana_from_tapped_tokens') {
      const selectedTokenIds = action.options?.selectedCardIds ?? []
      const manaColors = action.options?.manaColors ?? []
      const selectedIdSet = new Set(selectedTokenIds)
      const selectedTokens = player.zones.battlefield.filter(entry => selectedIdSet.has(entry.instanceId))
      const allowedColors = new Set<ColorSymbol>(['W', 'U', 'B', 'R', 'G'])
      if (selectedTokenIds.length === 0 || selectedTokens.length !== selectedTokenIds.length) return player
      if (manaColors.length !== selectedTokenIds.length || !manaColors.every(color => allowedColors.has(color))) return player
      if (selectedTokens.some(token => !token.isToken || token.tapped || token.instanceId === action.cardId)) return player
      if (player.life < ability.lifeCost) return player

      changed = true

      const nextManaPool = { ...(payment?.manaPool ?? player.manaPool) }
      for (const color of manaColors) {
        nextManaPool[color] += 1
      }

      return {
        ...player,
        life: player.life - ability.lifeCost,
        manaPool: nextManaPool,
        zones: {
          ...mergePaidCardsIntoZones(player, payment?.cards).zones,
          battlefield: mergePaidCardsIntoZones(player, payment?.cards).zones.battlefield.map(entry => {
            if (entry.instanceId === action.cardId) {
              return { ...entry, tapped: ability.requiresTap ? true : entry.tapped }
            }
            if (selectedIdSet.has(entry.instanceId)) {
              return { ...entry, tapped: true }
            }
            return entry
          }),
        },
      }
    }

    changed = true

    if (ability.kind === 'add_mana') {
      const updatedSource = { ...card, tapped: ability.requiresTap ? true : card.tapped }
      const updatedCards = [
        ...player.zones.lands.map(entry => {
          if (entry.instanceId === action.cardId) return updatedSource
          return payment?.cards.find(c => c.instanceId === entry.instanceId) ?? entry
        }),
        ...player.zones.battlefield.map(entry => {
          if (entry.instanceId === action.cardId) return updatedSource
          return payment?.cards.find(c => c.instanceId === entry.instanceId) ?? entry
        }),
      ]
      const zonesWithTap = applyTappedManaCards(player, updatedCards).zones
      const zonesWithoutSource = ability.sacrifice ? removeCardFromBattlefieldOrLands({ ...player, zones: zonesWithTap }, action.cardId) : zonesWithTap
      const zones = ability.sacrifice ? putLeavingCardInDestination(zonesWithoutSource, card) : zonesWithoutSource

      const nextPlayer = {
        ...player,
        manaPool: {
          ...(payment?.manaPool ?? player.manaPool),
          [ability.color]: (payment?.manaPool ?? player.manaPool)[ability.color] + ability.amount,
        },
        zones,
      }
      if (ability.sacrifice) {
        pushLeaveBattlefieldOccurrences(triggerOccurrences, player.id, card)
      }
      return nextPlayer
    }

    if (ability.kind === 'draw_card') {
      const sourceInBattlefield = player.zones.battlefield.some(entry => entry.instanceId === action.cardId)
      const sourceInLands = player.zones.lands.some(entry => entry.instanceId === action.cardId)
      const drawn = player.zones.library.slice(0, 1)
      const manaPool = payment?.manaPool ?? player.manaPool
      const paidZones = mergePaidCardsIntoZones(player, payment?.cards).zones

      const baseZones = {
        ...paidZones,
        battlefield: sourceInBattlefield ? paidZones.battlefield.filter(entry => entry.instanceId !== action.cardId) : paidZones.battlefield,
        lands: sourceInLands ? paidZones.lands.filter(entry => entry.instanceId !== action.cardId) : paidZones.lands,
        library: player.zones.library.slice(drawn.length),
        hand: [...player.zones.hand, ...drawn],
      }
      const nextPlayer = {
        ...player,
        manaPool,
        zones: {
          ...(ability.sacrifice ? putLeavingCardInDestination(baseZones, card) : baseZones),
        },
      }
      if (ability.sacrifice) {
        pushLeaveBattlefieldOccurrences(triggerOccurrences, player.id, card)
      }
      return nextPlayer
    }

    if (ability.kind === 'search_basic_land_to_battlefield_tapped') {
      const updatedSource = { ...card, tapped: ability.requiresTap ? true : card.tapped }
      const updatedCards = [
        ...player.zones.lands.map(entry => {
          if (entry.instanceId === action.cardId) return updatedSource
          return payment?.cards.find(paidCard => paidCard.instanceId === entry.instanceId) ?? entry
        }),
        ...player.zones.battlefield.map(entry => {
          if (entry.instanceId === action.cardId) return updatedSource
          return payment?.cards.find(paidCard => paidCard.instanceId === entry.instanceId) ?? entry
        }),
      ]
      const zonesWithTap = applyTappedManaCards(player, updatedCards).zones
      const zonesWithoutSource = removeCardFromBattlefieldOrLands({ ...player, zones: zonesWithTap }, action.cardId)
      pendingLibrarySearchChoice = {
        playerId: player.id,
        sourceCardId: action.cardId,
        sourceName: card.name,
        basicLandTypes: ability.basicLandTypes,
      }
      pushLeaveBattlefieldOccurrences(triggerOccurrences, player.id, card)

      return {
        ...player,
        manaPool: payment?.manaPool ?? player.manaPool,
        zones: putLeavingCardInDestination(zonesWithoutSource, card),
      }
    }

    if (ability.kind === 'gain_life') {
      const sourceInBattlefield = player.zones.battlefield.some(entry => entry.instanceId === action.cardId)
      const sourceInLands = player.zones.lands.some(entry => entry.instanceId === action.cardId)
      const paidZones = mergePaidCardsIntoZones(player, payment?.cards).zones
      const baseZones = {
        ...paidZones,
        battlefield: sourceInBattlefield ? paidZones.battlefield.filter(entry => entry.instanceId !== action.cardId) : paidZones.battlefield,
        lands: sourceInLands ? paidZones.lands.filter(entry => entry.instanceId !== action.cardId) : paidZones.lands,
      }
      const nextPlayer = {
        ...player,
        life: playerCanGainLife(state.players, player.id) ? player.life + ability.amount : player.life,
        manaPool: payment?.manaPool ?? player.manaPool,
        zones: {
          ...(ability.sacrifice ? putLeavingCardInDestination(baseZones, card) : baseZones),
        },
      }
      if (ability.sacrifice) {
        pushLeaveBattlefieldOccurrences(triggerOccurrences, player.id, card)
      }
      return nextPlayer
    }

    if (ability.kind === 'untap_self_add_minus_one_counter') {
      const sourceInBattlefield = player.zones.battlefield.some(entry => entry.instanceId === action.cardId)
      if (!sourceInBattlefield) return player
      const updatedCard = { ...card, tapped: false, minusOneCounters: card.minusOneCounters + 1 }
      triggerOccurrences.push({
        type: 'minus_one_counters_placed',
        sourcePlayerId: player.id,
        controllerId: player.id,
        card,
        amount: 1,
      })
      return {
        ...player,
        zones: {
          ...player.zones,
          battlefield: player.zones.battlefield.map(entry =>
            entry.instanceId === action.cardId ? updatedCard : entry
          ),
        },
      }
    }

    if (ability.kind === 'remove_minus_one_counter_add_mana') {
      const sourceInBattlefield = player.zones.battlefield.some(entry => entry.instanceId === action.cardId)
      if (!sourceInBattlefield || card.minusOneCounters <= 0) return player
      const updatedCard = {
        ...card,
        tapped: ability.requiresTap ? true : card.tapped,
        minusOneCounters: card.minusOneCounters - 1,
      }
      return {
        ...player,
        manaPool: {
          ...player.manaPool,
          [ability.color]: player.manaPool[ability.color] + ability.amount,
        },
        zones: {
          ...player.zones,
          battlefield: player.zones.battlefield.map(entry =>
            entry.instanceId === action.cardId ? updatedCard : entry
          ),
        },
      }
    }

    return player
  })

  return {
    players,
    pendingLibrarySearchChoice,
    pendingExploreChoice,
    pendingScryChoice: null,
    pendingSurveilChoice: null,
    pendingProliferateChoice: null,
    triggerOccurrences,
    changed,
  }
}

function emptyDispatchResult(state: GameState): AbilityDispatchResult {
  return {
    players: state.players,
    pendingLibrarySearchChoice: state.pendingLibrarySearchChoice,
    pendingExploreChoice: state.pendingExploreChoice,
    pendingScryChoice: null,
    pendingSurveilChoice: null,
    pendingProliferateChoice: null,
    triggerOccurrences: [],
    changed: false,
  }
}
