import type { GameCard, Player, TriggerOccurrence } from '@/types/game-state'

export function oracleText(card: Pick<GameCard, 'oracleText'>): string {
  return (card.oracleText ?? '').replace(/\n/g, ' ').toLowerCase()
}

export function isPermanentCard(card: GameCard): boolean {
  const type = card.typeLine.toLowerCase()
  return !type.includes('instant') && !type.includes('sorcery')
}

export function isLandCard(card: GameCard): boolean {
  if (card.typeLine.toLowerCase().includes('land')) return true

  const text = (card.oracleText ?? '').toLowerCase()
  const hasManaAbility = /\{t\}:\s*add\b/i.test(text)
  const hasLandLikeText =
    text.includes('enters tapped')
    || text.includes('enters the battlefield tapped')
    || text.includes('cycling')
    || text.includes('basic land card')

  return card.manaCost === null && hasManaAbility && hasLandLikeText && card.power === null && card.toughness === null && card.loyalty === null
}

export function isBasicLandCard(card: GameCard): boolean {
  return card.typeLine.toLowerCase().includes('basic') && isLandCard(card)
}

export function isCreatureCard(card: GameCard): boolean {
  return card.typeLine.toLowerCase().includes('creature') && card.power !== null && card.toughness !== null
}

export function isPlaneswalkerCard(card: GameCard): boolean {
  return card.typeLine.toLowerCase().includes('planeswalker')
}

export function isNonlandPermanent(card: GameCard): boolean {
  return isPermanentCard(card) && !isLandCard(card)
}

export const DEFAULT_NON_BATTLEFIELD_CARD_STATE = {
  tapped: false,
  markedDamage: 0,
  loyaltyActivatedThisTurn: false,
  plusOneCounters: 0,
  minusOneCounters: 0,
  summoningSick: false,
} satisfies Pick<GameCard, 'tapped' | 'markedDamage' | 'loyaltyActivatedThisTurn' | 'plusOneCounters' | 'minusOneCounters' | 'summoningSick'>

export function normalizeLeavingCard(card: GameCard): GameCard {
  return {
    ...card,
    ...DEFAULT_NON_BATTLEFIELD_CARD_STATE,
    loyalty: isPlaneswalkerCard(card) ? card.startingLoyalty : card.loyalty,
  }
}

export function putLeavingCardInDestination(zones: Player['zones'], card: GameCard): Player['zones'] {
  if (card.isToken) return zones
  const normalized = normalizeLeavingCard(card)
  if (card.exileOnLeave) {
    return {
      ...zones,
      exile: [...zones.exile, normalized],
    }
  }
  return {
    ...zones,
    graveyard: [...zones.graveyard, normalized],
  }
}

export function applyTappedManaCards(player: Player, cards: GameCard[]): Pick<Player, 'zones'> {
  const byId = new Map(cards.map(card => [card.instanceId, card]))
  return {
    zones: {
      ...player.zones,
      lands: player.zones.lands.map(card => byId.get(card.instanceId) ?? card),
      battlefield: player.zones.battlefield.map(card => byId.get(card.instanceId) ?? card),
    },
  }
}

export function mergePaidCardsIntoZones(player: Player, paidCards?: GameCard[]): Pick<Player, 'zones'> {
  if (!paidCards) {
    return { zones: player.zones }
  }
  return applyTappedManaCards(player, [
    ...player.zones.lands.map(card => paidCards.find(entry => entry.instanceId === card.instanceId) ?? card),
    ...player.zones.battlefield.map(card => paidCards.find(entry => entry.instanceId === card.instanceId) ?? card),
  ])
}

export function removeCardFromBattlefieldOrLands(player: Player, cardId: string): Player['zones'] {
  return {
    ...player.zones,
    battlefield: player.zones.battlefield.filter(card => card.instanceId !== cardId),
    lands: player.zones.lands.filter(card => card.instanceId !== cardId),
  }
}

export function pushLeaveBattlefieldOccurrences(triggerOccurrences: TriggerOccurrence[], controllerId: string, card: GameCard): void {
  if (card.isToken) {
    triggerOccurrences.push({ type: 'token_sacrificed', controllerId, card })
  }
  if (isCreatureCard(card)) {
    triggerOccurrences.push({ type: 'creature_dies', controllerId, card })
  }
}

export function playerCanGainLife(players: Player[], playerId: string): boolean {
  for (const sourcePlayer of players) {
    for (const source of sourcePlayer.zones.battlefield) {
      const text = oracleText(source)
      if (text.includes("players can't gain life")) return false
      if (sourcePlayer.id !== playerId && text.includes("your opponents can't gain life")) return false
    }
  }
  return true
}
