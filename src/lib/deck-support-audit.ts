import {
  getActivatedAbilities,
  getLandEntryEffect,
  getLandManaOptions,
  getPlaneswalkerAbilities,
  getSimpleSpellDefinition,
  getSimpleSpellSequence,
  getTriggeredAbilities,
} from './card-rules.ts'
import { getBespokeCardHandlers, hasBespokeSpellResolution } from './card-support/index.ts'
import { getSupportConfidence, getSupportVerifications } from './card-support-verification.ts'
import type { CardSupportReasonCode, SupportConfidence, SupportVerification } from './card-support-verification.ts'
import type { GameCard, ImportedDeck, ImportedDeckCard, Player } from '../types/game-state.ts'

export type CardSupportLevel = 'automated' | 'partial' | 'manual' | 'unsupported'
export type CardSupportCandidate = 'generic' | 'bespoke' | 'manual'
export type CardAutomationSource = 'generic' | 'bespoke' | 'core' | 'manual' | 'none'
export type CardRole = 'commander' | 'mana' | 'removal' | 'draw' | 'engine' | 'combat' | 'wincon' | 'utility'

export interface CardSupportAudit {
  name: string
  quantity: number
  section: 'commander' | 'mainboard'
  supportLevel: CardSupportLevel
  confidence: SupportConfidence
  candidate: CardSupportCandidate
  automationSource: CardAutomationSource
  role: CardRole
  reasons: string[]
  reasonCodes: CardSupportReasonCode[]
  gaps: string[]
  verificationRefs: SupportVerification[]
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

function getCardRole(card: ImportedDeckCard, section: CardSupportAudit['section']): CardRole {
  if (section === 'commander') return 'commander'

  const typeLine = card.typeLine.toLowerCase()
  const oracleText = (card.oracleText ?? '').toLowerCase()
  const name = card.name.toLowerCase()

  if (isLandCard(card)) {
    return 'mana'
  }
  if (/destroy target|exile target|damage to target|gets -\d\/-\d|-\d\/-\d/u.test(oracleText)) {
    return 'removal'
  }
  if (oracleText.includes('draw') || oracleText.includes('scry') || oracleText.includes('surveil')) {
    return 'draw'
  }
  if (oracleText.includes('create') || oracleText.includes('token') || oracleText.includes('whenever') || oracleText.includes('at the beginning')) {
    return 'engine'
  }
  if (oracleText.includes('add {') || oracleText.includes('add one mana') || name.includes('signet') || name.includes('talisman')) {
    return 'mana'
  }
  if (typeLine.includes('creature')) {
    return 'combat'
  }
  if (oracleText.includes('you win the game') || oracleText.includes('each opponent loses')) {
    return 'wincon'
  }
  return 'utility'
}

function getCandidate(card: ImportedDeckCard, section: CardSupportAudit['section'], supportLevel: CardSupportLevel, signals: CardSupportAudit['signals']): CardSupportCandidate {
  if (supportLevel === 'automated') return signals.bespoke || signals.customSpellResolution ? 'bespoke' : 'generic'

  const oracleText = (card.oracleText ?? '').toLowerCase()
  if (
    oracleText.includes('instead')
    || oracleText.includes('copy')
    || oracleText.includes('choose')
    || oracleText.includes('x ')
    || section === 'commander'
    || signals.bespoke
    || signals.customSpellResolution
  ) {
    return 'bespoke'
  }

  if (
    oracleText.includes('target')
    || oracleText.includes('draw')
    || oracleText.includes('create')
    || oracleText.includes('destroy')
    || oracleText.includes('exile')
    || oracleText.includes('whenever')
    || oracleText.includes('at the beginning')
  ) {
    return 'generic'
  }

  return 'manual'
}

function getAutomationSource(supportLevel: CardSupportLevel, signals: CardSupportAudit['signals'], reasonCodes: CardSupportReasonCode[]): CardAutomationSource {
  if (supportLevel === 'unsupported') return 'none'
  if (signals.bespoke || signals.customSpellResolution) return 'bespoke'
  if (reasonCodes.includes('core-combat') || reasonCodes.includes('core-cast-play') || reasonCodes.includes('vanilla-permanent')) return 'core'
  if (supportLevel === 'manual') return 'manual'
  return 'generic'
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
  const reasonCodes: CardSupportReasonCode[] = []
  const gaps: string[] = []

  const bespoke = getBespokeCardHandlers(card.name).length > 0
  const customSpellResolution = hasBespokeSpellResolution(card.name)
  const simpleSpell = getSimpleSpellDefinition(gameCard) !== null
  const effectSequence = getSimpleSpellSequence(gameCard).length > 1
  const activatedAbilities = getActivatedAbilities(gameCard, AUDIT_PLAYER)
  const triggeredAbilities = getTriggeredAbilities(gameCard)
  const planeswalkerAbilities = getPlaneswalkerAbilities(gameCard).filter(ability => ability.supported)
  const landEntryEffect = getLandEntryEffect(gameCard) !== null
  const land = isLandCard(card)
  const landManaOptions = land ? getLandManaOptions(gameCard, AUDIT_PLAYER) : []
  const permanent = isPermanentCard(card)
  const oracleText = (card.oracleText ?? '').trim()

  if (bespoke) {
    reasons.push('bespoke handler')
    reasonCodes.push('bespoke-handler')
  }
  if (customSpellResolution) {
    reasons.push('custom spell resolution')
    reasonCodes.push('custom-spell-resolution')
  }
  if (simpleSpell) {
    reasons.push('simple spell parser')
    reasonCodes.push('simple-spell')
  }
  if (effectSequence) {
    reasons.push('queued effect sequence')
    reasonCodes.push('effect-sequence')
  }
  if (activatedAbilities.length > 0) {
    reasons.push(`${activatedAbilities.length} activated ability parser${activatedAbilities.length === 1 ? '' : 's'}`)
    reasonCodes.push('activated-ability')
  }
  if (triggeredAbilities.length > 0) {
    reasons.push(`${triggeredAbilities.length} triggered ability parser${triggeredAbilities.length === 1 ? '' : 's'}`)
    reasonCodes.push('triggered-ability')
  }
  if (planeswalkerAbilities.length > 0) {
    reasons.push(`${planeswalkerAbilities.length} planeswalker ability parser${planeswalkerAbilities.length === 1 ? '' : 's'}`)
    reasonCodes.push('planeswalker-ability')
  }
  if (landManaOptions.length > 0) {
    reasons.push(`${landManaOptions.length} land mana option${landManaOptions.length === 1 ? '' : 's'}`)
    reasonCodes.push('land-mana')
  }
  if (landEntryEffect) {
    reasons.push('land entry effect')
    reasonCodes.push('land-entry-effect')
  }

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
    reasonCodes.push('vanilla-permanent')
  } else if (bespoke || activatedAbilities.length > 0 || triggeredAbilities.length > 0 || planeswalkerAbilities.length > 0) {
    supportLevel = 'partial'
    gaps.push('review remaining Oracle text for unsupported clauses')
  } else if (isCreatureCard(card)) {
    supportLevel = 'manual'
    reasons.push('creature can use core combat flow')
    reasonCodes.push('core-combat')
    gaps.push('no automated card text detected')
  } else {
    supportLevel = 'manual'
    reasons.push('core cast/play support only')
    reasonCodes.push('core-cast-play')
    gaps.push('permanent can be cast, but no automated card text detected')
  }

  if (reasons.length === 0) {
    reasons.push('core cast/play support only')
    reasonCodes.push('core-cast-play')
  }

  const signals = {
    bespoke,
    customSpellResolution,
    simpleSpell,
    effectSequence,
    activatedAbilities: activatedAbilities.length,
    triggeredAbilities: triggeredAbilities.length,
    planeswalkerAbilities: planeswalkerAbilities.length,
    landManaOptions: landManaOptions.length,
    landEntryEffect,
  }
  const candidate = getCandidate(card, section, supportLevel, signals)
  const automationSource = getAutomationSource(supportLevel, signals, reasonCodes)
  const role = getCardRole(card, section)
  const confidence = getSupportConfidence(card.name, reasonCodes, supportLevel === 'manual' || supportLevel === 'unsupported')
  const verificationRefs = getSupportVerifications(card.name, reasonCodes)

  return {
    name: card.name,
    quantity: card.quantity,
    section,
    supportLevel,
    confidence,
    candidate,
    automationSource,
    role,
    reasons,
    reasonCodes,
    gaps,
    verificationRefs,
    signals,
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
