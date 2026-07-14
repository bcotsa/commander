import type { GameCard, Player, TokenTemplateKey, TriggerOccurrence } from '@/types/game-state'
import { getTokenTemplate } from './card-rules'
import { isCreatureCard } from './zone-utils'

export function createTokenCard(tokenKey: TokenTemplateKey, tapped = false): GameCard {
  const template = getTokenTemplate(tokenKey)
  return {
    instanceId: `token-${tokenKey}-${crypto.randomUUID()}`,
    scryfallId: null,
    name: template.name,
    imageUri: '',
    colorIdentity: template.colorIdentity,
    manaCost: null,
    oracleText: template.oracleText,
    typeLine: template.typeLine,
    power: template.power,
    toughness: template.toughness,
    startingLoyalty: null,
    loyalty: null,
    loyaltyActivatedThisTurn: false,
    plusOneCounters: 0,
    minusOneCounters: 0,
    tapped,
    markedDamage: 0,
    summoningSick: template.typeLine.toLowerCase().includes('creature'),
    isCommander: false,
    isToken: true,
    tokenKey,
    exileOnLeave: false,
  }
}

export function copyTokenCard(source: GameCard): GameCard {
  return {
    ...source,
    instanceId: `token-copy-${source.tokenKey ?? source.name}-${crypto.randomUUID()}`,
    tapped: false,
    markedDamage: 0,
    summoningSick: isCreatureCard(source),
    plusOneCounters: 0,
    minusOneCounters: 0,
    loyalty: source.startingLoyalty,
    loyaltyActivatedThisTurn: false,
    isCommander: false,
    isToken: true,
    exileOnLeave: false,
  }
}

export function applyTokenCreationReplacements(player: Player, tokens: GameCard[], tapped = false): GameCard[] {
  if (tokens.length === 0) return tokens

  const lowerBattlefieldNames = player.zones.battlefield.map(card => card.name.toLowerCase())
  const chatterfangCount = lowerBattlefieldNames.filter(name => name === 'chatterfang, squirrel general').length

  if (chatterfangCount <= 0) return tokens

  let totalTokens = [...tokens]
  for (let i = 0; i < chatterfangCount; i++) {
    const bonusCount = totalTokens.length
    totalTokens = [...totalTokens, ...Array.from({ length: bonusCount }, () => createTokenCard('squirrel', tapped))]
  }

  return totalTokens
}

export function createTokensForPlayer(player: Player, tokenKey: TokenTemplateKey, count: number, tapped = false): GameCard[] {
  if (count <= 0) return []

  const tokens = Array.from({ length: count }, () => createTokenCard(tokenKey, tapped))
  return applyTokenCreationReplacements(player, tokens, tapped)
}

export function createTokenCopiesForPlayer(player: Player, targetToken: GameCard, count: number): GameCard[] {
  if (count <= 0) return []

  const tokens = Array.from({ length: count }, () => copyTokenCard(targetToken))
  return applyTokenCreationReplacements(player, tokens, false)
}

export function pushTokenEnterOccurrences(triggerOccurrences: TriggerOccurrence[], controllerId: string, tokens: GameCard[]) {
  if (tokens.length > 0) {
    triggerOccurrences.push({ type: 'token_created', controllerId, card: tokens[0] })
  }
  for (const token of tokens) {
    triggerOccurrences.push({ type: 'enters_battlefield', controllerId, card: token })
    if (isCreatureCard(token)) {
      triggerOccurrences.push({ type: 'creature_enters', controllerId, card: token })
    }
  }
}
