import {
  getActivatedAbilities,
  getLandEntryEffect,
  getLandManaOptions,
  getPlaneswalkerAbilities,
  getSimpleSpellDefinition,
  getSimpleSpellSequence,
  getTriggeredAbilities,
} from './card-rules'
import { getBespokeCardHandlers, hasBespokeSpellResolution } from './card-support'
import type { GameCard, ImportedDeck, ImportedDeckCard, Player } from '@/types/game-state'

export type CardSupportLevel = 'automated' | 'partial' | 'manual' | 'unsupported'

export interface CardSupportAudit {
  name: string
  quantity: number
  section: 'commander' | 'mainboard'
  supportLevel: CardSupportLevel
  reasons: string[]
  gaps: string[]
  signals: {
    bespoke: boolean
    customSpellResolution: boolean
    simpleSpell: boolean
    effectSequence: boolean
    activatedAbilities: number
    triggeredAbilities: number
    planeswalkerAbilities: number
    landManaOptions: number
    landEntryEffect: boolean
  }
}

export interface DeckSupportAudit {
  deckName: string
  cardCount: number
  uniqueCardCount: number
  cards: CardSupportAudit[]
  summary: Record<CardSupportLevel, { unique: number; quantity: number }>
  priorityQueue: CardSupportAudit[]
}

const EMPTY_SUMMARY: Record<CardSupportLevel, { unique: number; quantity: number }> = {
  automated: { unique: 0, quantity: 0 },
  partial: { unique: 0, quantity: 0 },
  manual: { unique: 0, quantity: 0 },
  unsupported: { unique: 0, quantity: 0 },
}

const AUDIT_PLAYER: Pick<Player, 'commander'> = { commander: null }

function isLandCard(card: Pick<ImportedDeckCard, 'typeLine' | 'manaCost' | 'oracleText' | 'power' | 'toughness' | 'loyalty'>): boolean {
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

function isPermanentCard(card: Pick<ImportedDeckCard, 'typeLine'>): boolean {
  const typeLine = card.typeLine.toLowerCase()
  return !typeLine.includes('instant') && !typeLine.includes('sorcery')
}

function isCreatureCard(card: Pick<ImportedDeckCard, 'typeLine' | 'power' | 'toughness'>): boolean {
  return card.typeLine.toLowerCase().includes('creature') && card.power !== null && card.toughness !== null
}

function asGameCard(card: ImportedDeckCard): GameCard {
  return {
    instanceId: `audit-${card.name}`,
    scryfallId: card.scryfallId,
    name: card.name,
    imageUri: card.imageUri,
    colorIdentity: card.colorIdentity,
    manaCost: card.manaCost,
    oracleText: card.oracleText,
    typeLine: card.typeLine,
    power: card.power,
    toughness: card.toughness,
    startingLoyalty: card.loyalty,
    loyalty: card.loyalty,
    loyaltyActivatedThisTurn: false,
    plusOneCounters: 0,
    minusOneCounters: 0,
    tapped: false,
    markedDamage: 0,
    summoningSick: false,
    isCommander: false,
    isToken: false,
    exileOnLeave: false,
  }
}

function classifyResolvedCard(card: ImportedDeckCard, section: CardSupportAudit['section']): CardSupportAudit {
  const gameCard = asGameCard(card)
  const reasons: string[] = []
  const gaps: string[] = []

  const bespoke = getBespokeCardHandlers(card.name).length > 0
  const customSpellResolution = hasBespokeSpellResolution(card.name)
  const simpleSpell = getSimpleSpellDefinition(gameCard) !== null
  const effectSequence = getSimpleSpellSequence(gameCard).length > 1
  const activatedAbilities = getActivatedAbilities(gameCard, AUDIT_PLAYER)
  const triggeredAbilities = getTriggeredAbilities(gameCard)
  const planeswalkerAbilities = getPlaneswalkerAbilities(gameCard).filter(ability => ability.supported)
  const landManaOptions = getLandManaOptions(gameCard, AUDIT_PLAYER)
  const landEntryEffect = getLandEntryEffect(gameCard) !== null
  const land = isLandCard(card)
  const permanent = isPermanentCard(card)
  const oracleText = (card.oracleText ?? '').trim()

  if (bespoke) reasons.push('bespoke handler')
  if (customSpellResolution) reasons.push('custom spell resolution')
  if (simpleSpell) reasons.push('simple spell parser')
  if (effectSequence) reasons.push('queued effect sequence')
  if (activatedAbilities.length > 0) reasons.push(`${activatedAbilities.length} activated ability parser${activatedAbilities.length === 1 ? '' : 's'}`)
  if (triggeredAbilities.length > 0) reasons.push(`${triggeredAbilities.length} triggered ability parser${triggeredAbilities.length === 1 ? '' : 's'}`)
  if (planeswalkerAbilities.length > 0) reasons.push(`${planeswalkerAbilities.length} planeswalker ability parser${planeswalkerAbilities.length === 1 ? '' : 's'}`)
  if (landManaOptions.length > 0) reasons.push(`${landManaOptions.length} land mana option${landManaOptions.length === 1 ? '' : 's'}`)
  if (landEntryEffect) reasons.push('land entry effect')

  let supportLevel: CardSupportLevel

  if (land) {
    supportLevel = landManaOptions.length > 0 || landEntryEffect ? 'automated' : 'partial'
    if (landManaOptions.length === 0) gaps.push('land has no detected mana ability')
  } else if (!permanent) {
    supportLevel = simpleSpell || effectSequence || customSpellResolution ? 'automated' : 'unsupported'
    if (supportLevel === 'unsupported') gaps.push('instant/sorcery has no automated spell definition')
  } else if (!oracleText) {
    supportLevel = 'automated'
    reasons.push('vanilla permanent')
  } else if (bespoke || activatedAbilities.length > 0 || triggeredAbilities.length > 0 || planeswalkerAbilities.length > 0) {
    supportLevel = 'partial'
    gaps.push('review remaining Oracle text for unsupported clauses')
  } else if (isCreatureCard(card)) {
    supportLevel = 'manual'
    reasons.push('creature can use core combat flow')
    gaps.push('no automated card text detected')
  } else {
    supportLevel = 'manual'
    gaps.push('permanent can be cast, but no automated card text detected')
  }

  if (reasons.length === 0) reasons.push('core cast/play support only')

  return {
    name: card.name,
    quantity: card.quantity,
    section,
    supportLevel,
    reasons,
    gaps,
    signals: {
      bespoke,
      customSpellResolution,
      simpleSpell,
      effectSequence,
      activatedAbilities: activatedAbilities.length,
      triggeredAbilities: triggeredAbilities.length,
      planeswalkerAbilities: planeswalkerAbilities.length,
      landManaOptions: landManaOptions.length,
      landEntryEffect,
    },
  }
}

export function auditImportedDeck(deck: ImportedDeck): DeckSupportAudit {
  const cards = [
    ...deck.commanders.map(card => classifyResolvedCard(card, 'commander' as const)),
    ...deck.mainboard.map(card => classifyResolvedCard(card, 'mainboard' as const)),
  ]

  const summary = cards.reduce<Record<CardSupportLevel, { unique: number; quantity: number }>>((acc, card) => {
    acc[card.supportLevel] = {
      unique: acc[card.supportLevel].unique + 1,
      quantity: acc[card.supportLevel].quantity + card.quantity,
    }
    return acc
  }, {
    automated: { ...EMPTY_SUMMARY.automated },
    partial: { ...EMPTY_SUMMARY.partial },
    manual: { ...EMPTY_SUMMARY.manual },
    unsupported: { ...EMPTY_SUMMARY.unsupported },
  })

  const priorityQueue = cards
    .filter(card => card.supportLevel === 'unsupported' || card.supportLevel === 'manual' || card.supportLevel === 'partial')
    .sort((a, b) => {
      const weight: Record<CardSupportLevel, number> = { unsupported: 0, manual: 1, partial: 2, automated: 3 }
      return weight[a.supportLevel] - weight[b.supportLevel] || b.quantity - a.quantity || a.name.localeCompare(b.name)
    })

  return {
    deckName: deck.name,
    cardCount: cards.reduce((sum, card) => sum + card.quantity, 0),
    uniqueCardCount: cards.length,
    cards,
    summary,
    priorityQueue,
  }
}
