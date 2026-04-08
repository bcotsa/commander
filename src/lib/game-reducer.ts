import type { GameState, ActionPayload, Player, LogEntry, GameCard, ImportedDeckCard, PlayerZones, TurnPhase, StackItem, TokenTemplateKey, TriggerEffectPayload, ColorSymbol } from '@/types/game-state'
import { checkEliminations } from './game-engine'
import { autoPayManaCost, canAutoPayManaCost, emptyManaPool, getActivatedAbilities, getEtbCounters, getLandEntryEffect, getLandManaOptions, getPlaneswalkerAbilities, getSimpleSpellDefinition, getTokenTemplate, getTriggeredAbilities, landEntersTapped, resolveManaCost, type PlaneswalkerAbilityEffect, type TriggeredAbilityDefinition, type TriggerEffectDefinition } from './card-rules'

const MAX_LOG = 50
const TURN_PHASES: TurnPhase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end']
const AUTO_ADVANCE_PHASES = new Set<TurnPhase>(['untap', 'upkeep', 'draw'])

export function createInitialGameState(roomCode: string, roomId = ''): GameState {
  return {
    roomId,
    roomCode,
    phase: 'lobby',
    hostControlsAllPlayers: false,
    players: [],
    turnOrder: [],
    currentTurnIndex: 0,
    currentPhase: 'untap',
    combat: { attackers: [] },
    stack: [],
    pendingLandEffectChoice: null,
    pendingLibrarySearchChoice: null,
    pendingExploreChoice: null,
    pendingProliferateChoice: null,
    pendingTriggerTargetChoice: null,
    priorityPlayerId: null,
    priorityPassedIds: [],
    round: 1,
    log: [],
    actionSeq: 0,
    createdAt: new Date().toISOString(),
  }
}

export function createPlayer(id: string, name: string, seat: number): Player {
  return {
    id,
    name,
    seat,
    life: 40,
    commanderDamage: {},
    counters: { poison: 0, experience: 0, energy: 0, storm: 0 },
    manaPool: emptyManaPool(),
    commander: null,
    deck: null,
    zones: { library: [], hand: [], lands: [], battlefield: [], graveyard: [], exile: [], commandZone: [] },
    landsPlayedThisTurn: 0,
    mulligansTaken: 0,
    hasKeptOpeningHand: false,
    isEliminated: false,
    hasMonarch: false,
    hasInitiative: false,
    isConnected: true,
  }
}

function importedCardToGameCards(card: ImportedDeckCard): GameCard[] {
  return Array.from({ length: card.quantity }, (_, index) => ({
    instanceId: `${card.scryfallId ?? card.name}-${index}-${crypto.randomUUID()}`,
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
  }))
}

function commanderToGameCard(player: Player): GameCard | null {
  if (!player.commander) return null

  return {
    instanceId: `${player.commander.scryfallId || player.commander.name}-commander-${crypto.randomUUID()}`,
    scryfallId: player.commander.scryfallId || null,
    name: player.commander.name,
    imageUri: player.commander.imageUri,
    colorIdentity: player.commander.colorIdentity,
    manaCost: player.commander.manaCost,
    oracleText: player.commander.oracleText,
    typeLine: player.commander.typeLine,
    power: player.commander.power,
    toughness: player.commander.toughness,
    startingLoyalty: player.commander.loyalty,
    loyalty: player.commander.loyalty,
    loyaltyActivatedThisTurn: false,
    plusOneCounters: 0,
    minusOneCounters: 0,
    tapped: false,
    markedDamage: 0,
    summoningSick: false,
    isCommander: true,
    isToken: false,
    exileOnLeave: false,
  }
}

function createTokenCard(tokenKey: TokenTemplateKey, tapped = false): GameCard {
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

type TriggerOccurrence =
  | { type: 'enters_battlefield'; controllerId: string; card: GameCard }
  | { type: 'land_enters'; controllerId: string; card: GameCard }
  | { type: 'creature_enters'; controllerId: string; card: GameCard }
  | { type: 'token_created'; controllerId: string; card: GameCard }
  | { type: 'token_sacrificed'; controllerId: string; card: GameCard }
  | { type: 'minus_one_counters_placed'; sourcePlayerId: string; controllerId: string; card: GameCard; amount: number }
  | { type: 'attacks'; controllerId: string; card: GameCard }
  | { type: 'creature_dies'; controllerId: string; card: GameCard }
  | { type: 'upkeep'; activePlayerId: string }
  | { type: 'end_step'; activePlayerId: string }
  | { type: 'spell_cast'; controllerId: string; card: GameCard }

function createTokensForPlayer(player: Player, tokenKey: TokenTemplateKey, count: number, tapped = false): GameCard[] {
  if (count <= 0) return []

  const tokens = Array.from({ length: count }, () => createTokenCard(tokenKey, tapped))
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

function shuffleCards<T>(cards: T[]): T[] {
  const next = [...cards]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function buildPlayerZones(player: Player): PlayerZones {
  if (!player.deck) {
    return { library: [], hand: [], lands: [], battlefield: [], graveyard: [], exile: [], commandZone: [] }
  }

  let library = player.deck.mainboard.flatMap(importedCardToGameCards)
  const commandZone: GameCard[] = []

  const commanderCard = commanderToGameCard(player)
  if (commanderCard) {
    commandZone.push(commanderCard)
    const matchIndex = library.findIndex(card => card.name.toLowerCase() === commanderCard.name.toLowerCase())
    if (matchIndex >= 0) {
      library.splice(matchIndex, 1)
    }
  } else if (player.deck.commanders.length > 0) {
    for (const commander of player.deck.commanders) {
      commandZone.push(...importedCardToGameCards({ ...commander, quantity: 1 }))
    }
  }

  library = shuffleCards(library)
  const hand = library.slice(0, 7)
  const remainingLibrary = library.slice(7)

  return {
    library: remainingLibrary,
    hand,
    lands: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    commandZone,
  }
}

function initializePlayerForGame(player: Player): Player {
  return {
    ...player,
    life: 40,
    commanderDamage: {},
    counters: { poison: 0, experience: 0, energy: 0, storm: 0 },
    manaPool: emptyManaPool(),
    isEliminated: false,
    hasMonarch: false,
    hasInitiative: false,
    landsPlayedThisTurn: 0,
    mulligansTaken: 0,
    hasKeptOpeningHand: false,
    zones: buildPlayerZones(player),
  }
}

function mulliganBottomCount(player: Player): number {
  return Math.max(0, player.mulligansTaken - 1)
}

function mulliganBottomsRemaining(player: Player): number {
  if (!player.hasKeptOpeningHand) return 0
  const targetHandSize = 7 - mulliganBottomCount(player)
  return Math.max(0, player.zones.hand.length - targetHandSize)
}

function isPlayerDoneMulliganing(player: Player): boolean {
  return player.hasKeptOpeningHand && mulliganBottomsRemaining(player) === 0
}

function beginActiveGame(state: GameState): GameState {
  return advanceThroughAutomaticPhases({
    ...state,
    phase: 'active',
    currentTurnIndex: 0,
    currentPhase: 'untap',
    stack: [],
    pendingLandEffectChoice: null,
    pendingLibrarySearchChoice: null,
    pendingExploreChoice: null,
    pendingProliferateChoice: null,
    pendingTriggerTargetChoice: null,
    priorityPlayerId: null,
    priorityPassedIds: [],
    combat: { attackers: [] },
    actionSeq: state.actionSeq + 1,
  })
}

function maybeFinishMulligans(state: GameState): GameState {
  if (state.phase !== 'mulligan') return state
  if (state.players.length === 0) return state
  if (!state.players.every(isPlayerDoneMulliganing)) return state
  return beginActiveGame(state)
}

function isMainPhase(phase: TurnPhase): boolean {
  return phase === 'main1' || phase === 'main2'
}

function isPermanentCard(card: GameCard): boolean {
  const type = card.typeLine.toLowerCase()
  return !type.includes('instant') && !type.includes('sorcery')
}

function isLandCard(card: GameCard): boolean {
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

function isBasicLandCard(card: GameCard): boolean {
  return card.typeLine.toLowerCase().includes('basic') && isLandCard(card)
}

function isCreatureCard(card: GameCard): boolean {
  return card.typeLine.toLowerCase().includes('creature') && card.power !== null && card.toughness !== null
}

function isPlaneswalkerCard(card: GameCard): boolean {
  return card.typeLine.toLowerCase().includes('planeswalker')
}

function oracleText(card: Pick<GameCard, 'oracleText'>): string {
  return (card.oracleText ?? '').replace(/\n/g, ' ').toLowerCase()
}

function hasCounter(card: GameCard): boolean {
  return card.plusOneCounters > 0 || card.minusOneCounters > 0 || (card.loyalty ?? 0) > 0
}

const KNOWN_KEYWORDS = ['flying', 'reach', 'trample', 'vigilance', 'deathtouch', 'lifelink', 'menace', 'infect', 'wither', 'first strike', 'double strike', 'hexproof'] as const
type KnownKeyword = (typeof KNOWN_KEYWORDS)[number]

function parseKeywords(text: string): Set<KnownKeyword> {
  const found = new Set<KnownKeyword>()
  for (const keyword of KNOWN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`).test(text)) {
      found.add(keyword)
    }
  }
  return found
}

function getWardCost(card: GameCard): number {
  const text = oracleText(card)
  const match = text.match(/ward(?:\s*[—-]\s*|\s+)\{(\d+)\}/i)
  return match ? Number(match[1]) : 0
}

function appendGenericManaCost(manaCost: string | null, generic: number): string | null {
  if (generic <= 0) return manaCost
  return `${manaCost ?? ''}{${generic}}`
}

function normalizeSelectorWord(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ies$/, 'y').replace(/s$/, '')
}

function cardMatchesStaticSelector(card: GameCard, selector: string): boolean {
  const normalized = selector.trim().toLowerCase()
  if (!normalized) return false

  if (normalized === 'creatures') return isCreatureCard(card)
  if (!isCreatureCard(card)) return false

  if (normalized.endsWith(' creatures')) {
    const qualifier = normalized.replace(/ creatures$/, '').trim()
    const colorMap: Record<string, ColorSymbol> = {
      white: 'W',
      blue: 'U',
      black: 'B',
      red: 'R',
      green: 'G',
      colorless: 'C',
    }
    if (qualifier in colorMap) {
      return card.colorIdentity.includes(colorMap[qualifier])
    }
    return new RegExp(`\\b${normalizeSelectorWord(qualifier)}\\b`).test(card.typeLine.toLowerCase())
  }

  return new RegExp(`\\b${normalizeSelectorWord(normalized)}\\b`).test(card.typeLine.toLowerCase())
}

function getStaticBonuses(players: Player[], controllerId: string, card: GameCard): { power: number; toughness: number; keywords: Set<KnownKeyword> } {
  const bonuses = { power: 0, toughness: 0, keywords: new Set<KnownKeyword>() }
  const controller = players.find(player => player.id === controllerId)
  if (!controller) return bonuses

  for (const source of controller.zones.battlefield) {
    const lines = (source.oracleText ?? '').split('\n').map(line => line.trim()).filter(Boolean)

    for (const rawLine of lines) {
      const line = rawLine.toLowerCase()
      const buffMatch = line.match(/^(other )?(.+?) you control get \+(\d+)\/\+(\d+)(?: and have ([^.]+))?/)
      if (buffMatch) {
        const isOther = Boolean(buffMatch[1])
        const selector = buffMatch[2]?.trim() ?? ''
        if ((isOther && source.instanceId === card.instanceId) || !cardMatchesStaticSelector(card, selector)) {
          continue
        }
        bonuses.power += Number(buffMatch[3] ?? 0)
        bonuses.toughness += Number(buffMatch[4] ?? 0)
        const granted = buffMatch[5] ? parseKeywords(buffMatch[5]) : new Set<KnownKeyword>()
        for (const keyword of granted) bonuses.keywords.add(keyword)
      }

      const keywordOnlyMatch = line.match(/^(other )?(.+?) you control have ([^.]+)/)
      if (keywordOnlyMatch) {
        const isOther = Boolean(keywordOnlyMatch[1])
        const selector = keywordOnlyMatch[2]?.trim() ?? ''
        if ((isOther && source.instanceId === card.instanceId) || !cardMatchesStaticSelector(card, selector)) {
          continue
        }
        for (const keyword of parseKeywords(keywordOnlyMatch[3] ?? '')) {
          bonuses.keywords.add(keyword)
        }
      }
    }
  }

  return bonuses
}

function hasKeyword(players: Player[], controllerId: string, card: GameCard, keyword: KnownKeyword): boolean {
  const base = parseKeywords(oracleText(card))
  if (base.has(keyword)) return true
  return getStaticBonuses(players, controllerId, card).keywords.has(keyword)
}

function globalDamageHasWither(players: Player[]): boolean {
  return players.some(player =>
    player.zones.battlefield.some(card => oracleText(card).includes('all damage is dealt as though its source had wither'))
  )
}

function findBattlefieldController(players: Player[], cardId: string): Player | null {
  return players.find(player => player.zones.battlefield.some(card => card.instanceId === cardId)) ?? null
}

function canBlockAttacker(
  players: Player[],
  blockerControllerId: string,
  blocker: GameCard,
  attackerControllerId: string,
  attacker: GameCard
): boolean {
  if (blocker.tapped) return false
  if (!canCreatureBlock(players, blockerControllerId, blocker)) return false

  const attackerText = oracleText(attacker)
  if (attackerText.includes("can't be blocked") || attackerText.includes('is unblockable')) return false

  const blockerPower = effectivePower(blocker, players, blockerControllerId)
  if (attackerText.includes("can't be blocked by creatures with power 2 or less") && blockerPower <= 2) {
    return false
  }

  const attackerHasFlying = hasKeyword(players, attackerControllerId, attacker, 'flying')
  if (!attackerHasFlying) return true

  return hasKeyword(players, blockerControllerId, blocker, 'flying') || hasKeyword(players, blockerControllerId, blocker, 'reach')
}

function hasFirstStrikeDamage(players: Player[], controllerId: string, card: GameCard): boolean {
  return hasKeyword(players, controllerId, card, 'first strike') || hasKeyword(players, controllerId, card, 'double strike')
}

function hasNormalCombatDamage(players: Player[], controllerId: string, card: GameCard): boolean {
  return !hasKeyword(players, controllerId, card, 'first strike') || hasKeyword(players, controllerId, card, 'double strike')
}

function effectivePower(card: GameCard, players?: Player[], controllerId?: string): number {
  const base = (card.power ?? 0) + card.plusOneCounters - card.minusOneCounters
  if (!players || !controllerId) return base
  return base + getStaticBonuses(players, controllerId, card).power
}

function effectiveToughness(card: GameCard, players?: Player[], controllerId?: string): number {
  const base = (card.toughness ?? 0) + card.plusOneCounters - card.minusOneCounters
  if (!players || !controllerId) return base
  return base + getStaticBonuses(players, controllerId, card).toughness
}

function playerCanGainLife(players: Player[], playerId: string): boolean {
  for (const sourcePlayer of players) {
    for (const source of sourcePlayer.zones.battlefield) {
      const text = oracleText(source)
      if (text.includes("players can't gain life")) return false
      if (sourcePlayer.id !== playerId && text.includes("your opponents can't gain life")) return false
    }
  }
  return true
}

function canCreatureAttack(players: Player[], controllerId: string, card: GameCard): boolean {
  const text = oracleText(card)
  if (text.includes("can't attack or block") || text.includes("can't attack")) return false
  if (!hasCounter(card)) return true
  for (const sourcePlayer of players) {
    if (sourcePlayer.id === controllerId) continue
    for (const source of sourcePlayer.zones.battlefield) {
      if (oracleText(source).includes("creatures your opponents control with counters on them can't attack or block")) {
        return false
      }
    }
  }
  return true
}

function canCreatureBlock(players: Player[], controllerId: string, card: GameCard): boolean {
  const text = oracleText(card)
  if (text.includes("can't attack or block") || text.includes("can't block")) return false
  if (!hasCounter(card)) return true
  for (const sourcePlayer of players) {
    if (sourcePlayer.id === controllerId) continue
    for (const source of sourcePlayer.zones.battlefield) {
      if (oracleText(source).includes("creatures your opponents control with counters on them can't attack or block")) {
        return false
      }
    }
  }
  return true
}

function mustAttackIfAble(card: GameCard): boolean {
  const text = oracleText(card)
  return text.includes('attacks each combat if able') || text.includes('attacks each turn if able')
}

function getTargetingTax(
  players: Player[],
  sourcePlayerId: string,
  targetOwnerId: string | null,
  targetCard: GameCard | null
): { allowed: boolean; wardCost: number } {
  if (!targetCard || !targetOwnerId || targetOwnerId === sourcePlayerId) {
    return { allowed: true, wardCost: 0 }
  }

  if (hasKeyword(players, targetOwnerId, targetCard, 'hexproof')) {
    return { allowed: false, wardCost: 0 }
  }

  return { allowed: true, wardCost: getWardCost(targetCard) }
}

function validateTargetingRestriction(
  players: Player[],
  sourcePlayerId: string,
  targetOwnerId: string | null,
  targetCard: GameCard | null
): { allowed: boolean; extraManaCost: string | null } {
  const tax = getTargetingTax(players, sourcePlayerId, targetOwnerId, targetCard)
  return {
    allowed: tax.allowed,
    extraManaCost: tax.wardCost > 0 ? `{${tax.wardCost}}` : null,
  }
}

function autoDeclareRequiredAttackers(state: GameState): GameState {
  if (state.currentPhase !== 'combat') return state

  const currentPlayerId = state.turnOrder[state.currentTurnIndex]
  const activePlayer = state.players.find(player => player.id === currentPlayerId)
  if (!currentPlayerId || !activePlayer || activePlayer.isEliminated) return state

  const defenders = state.players.filter(player => player.id !== currentPlayerId && !player.isEliminated)
  if (defenders.length === 0) return state

  const alreadyAttacking = new Set(state.combat.attackers.map(attack => attack.attackerId))
  const requiredAttackers = activePlayer.zones.battlefield.filter(card =>
    isCreatureCard(card)
    && !card.tapped
    && !card.summoningSick
    && mustAttackIfAble(card)
    && canCreatureAttack(state.players, currentPlayerId, card)
    && !alreadyAttacking.has(card.instanceId)
  )

  if (requiredAttackers.length === 0) return state

  const defaultDefender = defenders[0]
  const tappedAttackers = new Set(
    requiredAttackers
      .filter(card => !hasKeyword(state.players, currentPlayerId, card, 'vigilance'))
      .map(card => card.instanceId)
  )

  const triggerOccurrences: TriggerOccurrence[] = requiredAttackers.map(card => ({
    type: 'attacks',
    controllerId: currentPlayerId,
    card,
  }))

  const nextState = {
    ...state,
    players: state.players.map(player =>
      player.id === currentPlayerId
        ? {
            ...player,
            zones: {
              ...player.zones,
              battlefield: player.zones.battlefield.map(card =>
                tappedAttackers.has(card.instanceId) ? { ...card, tapped: true } : card
              ),
            },
          }
        : player
    ),
    combat: {
      attackers: [
        ...state.combat.attackers,
        ...requiredAttackers.map(card => ({
          attackerId: card.instanceId,
          attackerName: card.name,
          attackingPlayerId: currentPlayerId,
          defendingPlayerId: defaultDefender.id,
          blockerIds: [],
        })),
      ],
    },
  }

  return queueTriggeredAbilities(nextState, triggerOccurrences)
}

function applyDamageToCreature(
  players: Player[],
  targetControllerId: string,
  targetCardId: string,
  amount: number,
  sourceControllerId: string,
  sourceCard: GameCard
): Player[] {
  return players.map(player => {
    if (player.id !== targetControllerId) return player
    return {
      ...player,
      zones: {
        ...player.zones,
        battlefield: player.zones.battlefield.map(entry => {
          if (entry.instanceId !== targetCardId) return entry
          if (isPlaneswalkerCard(entry)) {
            return { ...entry, loyalty: (entry.loyalty ?? 0) - amount }
          }

          const usesCounters =
            hasKeyword(players, sourceControllerId, sourceCard, 'wither') ||
            hasKeyword(players, sourceControllerId, sourceCard, 'infect') ||
            globalDamageHasWither(players)
          const withDamage = usesCounters
            ? { ...entry, minusOneCounters: entry.minusOneCounters + amount }
            : { ...entry, markedDamage: entry.markedDamage + amount }

          if (amount > 0 && hasKeyword(players, sourceControllerId, sourceCard, 'deathtouch')) {
            return {
              ...withDamage,
              markedDamage: Math.max(withDamage.markedDamage, effectiveToughness(withDamage, players, targetControllerId)),
            }
          }
          return withDamage
        }),
      },
    }
  })
}

function applyDamageToPlayer(
  players: Player[],
  targetPlayerId: string,
  amount: number,
  sourceControllerId: string,
  sourceCard: GameCard
): Player[] {
  return players.map(player => {
    if (player.id !== targetPlayerId) return player
    if (hasKeyword(players, sourceControllerId, sourceCard, 'infect')) {
      return {
        ...player,
        counters: { ...player.counters, poison: player.counters.poison + amount },
      }
    }
    return { ...player, life: player.life - amount }
  })
}

function maybeGainLifeFromDamage(players: Player[], sourceControllerId: string, sourceCard: GameCard, amount: number): Player[] {
  if (amount <= 0 || !hasKeyword(players, sourceControllerId, sourceCard, 'lifelink') || !playerCanGainLife(players, sourceControllerId)) {
    return players
  }
  return players.map(player =>
    player.id === sourceControllerId ? { ...player, life: player.life + amount } : player
  )
}

function maybeAddCommanderDamage(
  players: Player[],
  defendingPlayerId: string,
  attackingPlayerId: string,
  attacker: GameCard,
  amount: number
): Player[] {
  if (amount <= 0 || !attacker.isCommander) return players
  return players.map(player =>
    player.id === defendingPlayerId
      ? {
          ...player,
          commanderDamage: {
            ...player.commanderDamage,
            [attackingPlayerId]: (player.commanderDamage[attackingPlayerId] ?? 0) + amount,
          },
        }
      : player
  )
}

function assignAttackerDamageToBlockers(
  players: Player[],
  attackerControllerId: string,
  attacker: GameCard,
  validBlockers: GameCard[]
): { blockerDamageMap: Map<string, number>; attackerDamageRemaining: number } {
  let attackerDamageRemaining = Math.max(0, effectivePower(attacker, players, attackerControllerId))
  const blockerDamageMap = new Map<string, number>()

  for (const blocker of validBlockers) {
    if (attackerDamageRemaining <= 0) break
    const blockerController = findBattlefieldController(players, blocker.instanceId)
    if (!blockerController) continue
    const lethalBase = Math.max(0, effectiveToughness(blocker, players, blockerController.id) - blocker.markedDamage)
    const lethal = hasKeyword(players, attackerControllerId, attacker, 'deathtouch')
      ? Math.min(1, lethalBase)
      : lethalBase
    const assigned = Math.min(attackerDamageRemaining, lethal)
    blockerDamageMap.set(blocker.instanceId, assigned)
    attackerDamageRemaining -= assigned
  }

  return { blockerDamageMap, attackerDamageRemaining }
}

function resolveCombatDamageStep(
  players: Player[],
  attacks: GameState['combat']['attackers'],
  options: {
    attackerCanDeal: (players: Player[], controllerId: string, card: GameCard) => boolean
    blockerCanDeal: (players: Player[], controllerId: string, card: GameCard) => boolean
  }
): Player[] {
  const findBattlefieldCard = (playerId: string, cardId: string) =>
    players.find(player => player.id === playerId)?.zones.battlefield.find(card => card.instanceId === cardId)

  for (const attack of attacks) {
    const attacker = findBattlefieldCard(attack.attackingPlayerId, attack.attackerId)
    if (!attacker || !isCreatureCard(attacker) || attacker.power === null || attacker.toughness === null) continue

    const blockers = attack.blockerIds
      .map(blockerId => players.flatMap(player => player.zones.battlefield).find(card => card.instanceId === blockerId) ?? null)
      .filter((card): card is GameCard => card !== null)
      .filter(isCreatureCard)

    const validBlockers = blockers.filter(blocker => {
      const blockerController = findBattlefieldController(players, blocker.instanceId)
      return blockerController ? canBlockAttacker(players, blockerController.id, blocker, attack.attackingPlayerId, attacker) : false
    })

    const attackerHasMenace = hasKeyword(players, attack.attackingPlayerId, attacker, 'menace')
    const attackIsBlocked = validBlockers.length > 0 && (!attackerHasMenace || validBlockers.length >= 2)
    const attackerDealsDamage = options.attackerCanDeal(players, attack.attackingPlayerId, attacker)

    if (!attackIsBlocked) {
      if (!attackerDealsDamage) continue
      const attackerPower = Math.max(0, effectivePower(attacker, players, attack.attackingPlayerId))
      if (attack.defendingCardId) {
        players = applyDamageToCreature(players, attack.defendingPlayerId, attack.defendingCardId, attackerPower, attack.attackingPlayerId, attacker)
      } else {
        players = applyDamageToPlayer(players, attack.defendingPlayerId, attackerPower, attack.attackingPlayerId, attacker)
        players = maybeAddCommanderDamage(players, attack.defendingPlayerId, attack.attackingPlayerId, attacker, attackerPower)
      }
      players = maybeGainLifeFromDamage(players, attack.attackingPlayerId, attacker, attackerPower)
      continue
    }

    const stepBlockers = validBlockers.filter(blocker => {
      const blockerController = findBattlefieldController(players, blocker.instanceId)
      return blockerController ? options.blockerCanDeal(players, blockerController.id, blocker) : false
    })

    for (const blocker of stepBlockers) {
      const blockerController = findBattlefieldController(players, blocker.instanceId)
      if (!blockerController) continue
      const blockerPower = Math.max(0, effectivePower(blocker, players, blockerController.id))
      players = applyDamageToCreature(players, attack.attackingPlayerId, attacker.instanceId, blockerPower, blockerController.id, blocker)
      players = maybeGainLifeFromDamage(players, blockerController.id, blocker, blockerPower)
    }

    if (!attackerDealsDamage) continue

    const { blockerDamageMap, attackerDamageRemaining } = assignAttackerDamageToBlockers(players, attack.attackingPlayerId, attacker, validBlockers)

    for (const blocker of validBlockers) {
      const assigned = blockerDamageMap.get(blocker.instanceId)
      if (!assigned) continue
      const blockerController = findBattlefieldController(players, blocker.instanceId)
      if (!blockerController) continue
      players = applyDamageToCreature(players, blockerController.id, blocker.instanceId, assigned, attack.attackingPlayerId, attacker)
      players = maybeGainLifeFromDamage(players, attack.attackingPlayerId, attacker, assigned)
    }

    if (attackerDamageRemaining > 0 && hasKeyword(players, attack.attackingPlayerId, attacker, 'trample')) {
      if (attack.defendingCardId) {
        players = applyDamageToCreature(players, attack.defendingPlayerId, attack.defendingCardId, attackerDamageRemaining, attack.attackingPlayerId, attacker)
      } else {
        players = applyDamageToPlayer(players, attack.defendingPlayerId, attackerDamageRemaining, attack.attackingPlayerId, attacker)
        players = maybeAddCommanderDamage(players, attack.defendingPlayerId, attack.attackingPlayerId, attacker, attackerDamageRemaining)
      }
      players = maybeGainLifeFromDamage(players, attack.attackingPlayerId, attacker, attackerDamageRemaining)
    }
  }

  return players
}

function entersBattlefield(card: GameCard): GameCard {
  const etbCounters = getEtbCounters(card)
  return {
    ...card,
    tapped: false,
    markedDamage: 0,
    loyalty: isPlaneswalkerCard(card) ? card.startingLoyalty : card.loyalty,
    loyaltyActivatedThisTurn: false,
    plusOneCounters: card.plusOneCounters + etbCounters.plusOne,
    minusOneCounters: card.minusOneCounters + etbCounters.minusOne,
    summoningSick: isCreatureCard(card),
  }
}

function withCastOptions(card: GameCard, xValue?: number): GameCard {
  if (!xValue) return card
  if (!card.manaCost?.includes('{X}')) return card
  const resolvedManaCost = resolveManaCost(card.manaCost, xValue)
  if (isPlaneswalkerCard(card) && card.startingLoyalty === null) {
    return {
      ...card,
      manaCost: resolvedManaCost,
      startingLoyalty: xValue,
      loyalty: xValue,
    }
  }
  return {
    ...card,
    manaCost: resolvedManaCost,
  }
}

function isNonlandPermanent(card: GameCard): boolean {
  return isPermanentCard(card) && !isLandCard(card)
}

function normalizeLeavingCard(card: GameCard): GameCard {
  return { ...card, tapped: false, markedDamage: 0 }
}

function putLeavingCardInDestination(zones: Player['zones'], card: GameCard): Player['zones'] {
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

function pushLeaveBattlefieldOccurrences(triggerOccurrences: TriggerOccurrence[], controllerId: string, card: GameCard) {
  if (card.isToken) {
    triggerOccurrences.push({ type: 'token_sacrificed', controllerId, card })
  }
  if (isCreatureCard(card)) {
    triggerOccurrences.push({ type: 'creature_dies', controllerId, card })
  }
}

function moveBattlefieldCardToGraveyard(player: Player, cardId: string): Player {
  const fromBattlefield = player.zones.battlefield.find(card => card.instanceId === cardId)
  if (fromBattlefield) {
    const without = {
      ...player.zones,
      battlefield: player.zones.battlefield.filter(card => card.instanceId !== cardId),
    }
    return {
      ...player,
      zones: putLeavingCardInDestination(without, fromBattlefield),
    }
  }

  const fromLands = player.zones.lands.find(card => card.instanceId === cardId)
  if (!fromLands) return player

  const without = {
    ...player.zones,
    lands: player.zones.lands.filter(card => card.instanceId !== cardId),
  }
  return {
    ...player,
    zones: putLeavingCardInDestination(without, fromLands),
  }
}

function cleanupBattlefieldState(players: Player[]): { players: Player[]; triggerOccurrences: TriggerOccurrence[] } {
  const triggerOccurrences: TriggerOccurrence[] = []

  const nextPlayers = players.map(player => {
    const deadCreatures = player.zones.battlefield.filter(
      card => isCreatureCard(card) && card.markedDamage >= effectiveToughness(card, players, player.id)
    )
    const spentPlaneswalkers = player.zones.battlefield.filter(
      card => isPlaneswalkerCard(card) && (card.loyalty ?? 0) <= 0
    )
    const removed = [...deadCreatures, ...spentPlaneswalkers]

    for (const deadCreature of deadCreatures) {
      triggerOccurrences.push({ type: 'creature_dies', controllerId: player.id, card: deadCreature })
    }

    if (removed.length === 0) return player

    const removedIds = new Set(removed.map(card => card.instanceId))
    return {
      ...player,
      zones: {
        ...player.zones,
        battlefield: player.zones.battlefield.filter(card => !removedIds.has(card.instanceId)),
        graveyard: [
          ...player.zones.graveyard,
          ...removed
            .filter(card => !card.isToken && !card.exileOnLeave)
            .map(normalizeLeavingCard),
        ],
        exile: [
          ...player.zones.exile,
          ...removed
            .filter(card => !card.isToken && card.exileOnLeave)
            .map(normalizeLeavingCard),
        ],
      },
    }
  })

  return { players: nextPlayers, triggerOccurrences }
}

function applyPlaneswalkerEffect(
  players: Player[],
  sourcePlayerId: string,
  effect: PlaneswalkerAbilityEffect,
  targetCardId?: string,
  targetPlayerId?: string
): { players: Player[]; triggerOccurrences: TriggerOccurrence[] } {
  const triggerOccurrences: TriggerOccurrence[] = []
  const targetPlayer = targetPlayerId ? players.find(player => player.id === targetPlayerId) ?? null : null
  const targetBattlefieldOwner = targetCardId
    ? players.find(player =>
        player.zones.battlefield.some(entry => entry.instanceId === targetCardId) ||
        player.zones.lands.some(entry => entry.instanceId === targetCardId)
      ) ?? null
    : null

  switch (effect.kind) {
    case 'draw_cards':
      return {
        players: players.map(player =>
          player.id === sourcePlayerId
            ? {
                ...player,
                life: player.life - (effect.loseLife ?? 0),
                zones: {
                  ...player.zones,
                  library: player.zones.library.slice(Math.min(effect.amount, player.zones.library.length)),
                  hand: [...player.zones.hand, ...player.zones.library.slice(0, effect.amount)],
                },
              }
            : player
        ),
        triggerOccurrences,
      }
    case 'create_tokens': {
      const count = effect.count === 'opponents'
        ? players.filter(player => player.id !== sourcePlayerId && !player.isEliminated).length
        : effect.count
      const tokenController = players.find(player => player.id === sourcePlayerId)
      const createdTokens = tokenController
        ? createTokensForPlayer(tokenController, effect.tokenKey, count, effect.tapped ?? false)
        : []
      const nextPlayers = players.map(player =>
        player.id === sourcePlayerId
          ? {
              ...player,
              zones: {
                ...player.zones,
                battlefield: [...player.zones.battlefield, ...createdTokens],
              },
            }
          : player
      )
      if (createdTokens.length > 0) {
        triggerOccurrences.push({ type: 'token_created', controllerId: sourcePlayerId, card: createdTokens[0] })
      }
      for (const token of createdTokens) {
        triggerOccurrences.push({ type: 'enters_battlefield', controllerId: sourcePlayerId, card: token })
        if (isCreatureCard(token)) {
          triggerOccurrences.push({ type: 'creature_enters', controllerId: sourcePlayerId, card: token })
        }
      }
      return { players: nextPlayers, triggerOccurrences }
    }
    case 'proliferate':
      return { players, triggerOccurrences }
    case 'destroy_target_creature':
    case 'destroy_target_nonland_permanent':
    case 'destroy_target_permanent': {
      const deadCard = targetBattlefieldOwner && targetCardId
        ? targetBattlefieldOwner.zones.battlefield.find(entry => entry.instanceId === targetCardId) ??
          targetBattlefieldOwner.zones.lands.find(entry => entry.instanceId === targetCardId) ??
          null
        : null
      const nextPlayers = players.map(player =>
        player.id === targetBattlefieldOwner?.id && targetCardId
          ? moveBattlefieldCardToGraveyard(player, targetCardId)
          : player
      )
      if (deadCard && isCreatureCard(deadCard)) {
        triggerOccurrences.push({ type: 'creature_dies', controllerId: targetBattlefieldOwner!.id, card: deadCard })
      }
      return { players: nextPlayers, triggerOccurrences }
    }
    case 'damage_target_creature':
    case 'damage_target_creature_or_player': {
      let nextPlayers = players
      if (effect.kind === 'damage_target_creature_or_player' && targetPlayer?.id) {
        nextPlayers = applyDamageToPlayer(nextPlayers, targetPlayer.id, effect.amount, sourcePlayerId, { name: 'planeswalker ability', oracleText: null, typeLine: '', power: null, toughness: null, imageUri: '', colorIdentity: [], manaCost: null, scryfallId: null, startingLoyalty: null, loyalty: null, loyaltyActivatedThisTurn: false, plusOneCounters: 0, minusOneCounters: 0, tapped: false, markedDamage: 0, summoningSick: false, isCommander: false, isToken: false, instanceId: 'pw-effect' })
      } else if (targetBattlefieldOwner?.id && targetCardId) {
        nextPlayers = applyDamageToCreature(nextPlayers, targetBattlefieldOwner.id, targetCardId, effect.amount, sourcePlayerId, { name: 'planeswalker ability', oracleText: null, typeLine: '', power: null, toughness: null, imageUri: '', colorIdentity: [], manaCost: null, scryfallId: null, startingLoyalty: null, loyalty: null, loyaltyActivatedThisTurn: false, plusOneCounters: 0, minusOneCounters: 0, tapped: false, markedDamage: 0, summoningSick: false, isCommander: false, isToken: false, instanceId: 'pw-effect' })
      }
      return { players: nextPlayers, triggerOccurrences }
    }
    case 'return_graveyard_creature_to_battlefield':
    case 'return_graveyard_creature_to_hand': {
      const destination = effect.kind === 'return_graveyard_creature_to_battlefield' ? 'battlefield' : 'hand'
      const result = reanimateFromGraveyard(players, sourcePlayerId, targetCardId, destination, {
        tapped: effect.kind === 'return_graveyard_creature_to_battlefield' ? effect.tapped : undefined,
        minusOneCounters: effect.kind === 'return_graveyard_creature_to_battlefield' ? effect.minusOneCounters : undefined,
        exileOnLeave: effect.kind === 'return_graveyard_creature_to_battlefield' ? effect.exileOnLeave : undefined,
      })
      const nextPlayers = result.players
      if (effect.kind === 'return_graveyard_creature_to_battlefield') {
        if (result.enteredCard) {
          triggerOccurrences.push({ type: 'enters_battlefield', controllerId: sourcePlayerId, card: result.enteredCard })
          if (isCreatureCard(result.enteredCard)) {
            triggerOccurrences.push({ type: 'creature_enters', controllerId: sourcePlayerId, card: result.enteredCard })
          }
        }
      }
      return { players: nextPlayers, triggerOccurrences }
    }
    case 'mass_damage_creatures': {
      const amount = effect.amount === 'creature_count'
        ? players.reduce((sum, player) => sum + player.zones.battlefield.filter(isCreatureCard).length, 0)
        : effect.amount
      const nextPlayers = players.map(player => ({
        ...player,
        zones: {
          ...player.zones,
          battlefield: player.zones.battlefield.map(entry =>
            isCreatureCard(entry) ? { ...entry, markedDamage: entry.markedDamage + amount } : entry
          ),
        },
      }))
      return { players: nextPlayers, triggerOccurrences }
    }
    case 'put_minus_one_counter_target_creature': {
      const nextPlayers = players.map(player =>
        player.id === targetBattlefieldOwner?.id && targetCardId
          ? {
              ...player,
              zones: {
                ...player.zones,
                battlefield: player.zones.battlefield.map(entry =>
                  entry.instanceId === targetCardId ? { ...entry, minusOneCounters: entry.minusOneCounters + effect.amount } : entry
                ),
              },
            }
          : player
      )
      if (targetBattlefieldOwner && targetCardId) {
        const target = targetBattlefieldOwner.zones.battlefield.find(entry => entry.instanceId === targetCardId)
        if (target) {
          triggerOccurrences.push({
            type: 'minus_one_counters_placed',
            sourcePlayerId: sourcePlayerId,
            controllerId: targetBattlefieldOwner.id,
            card: target,
            amount: effect.amount,
          })
        }
      }
      return { players: nextPlayers, triggerOccurrences }
    }
    case 'put_minus_one_counters_each_creature': {
      const nextPlayers = players.map(player => ({
        ...player,
        zones: {
          ...player.zones,
          battlefield: player.zones.battlefield.map(entry =>
            isCreatureCard(entry) ? { ...entry, minusOneCounters: entry.minusOneCounters + effect.amount } : entry
          ),
        },
      }))
      for (const player of players) {
        for (const card of player.zones.battlefield) {
          if (!isCreatureCard(card)) continue
          triggerOccurrences.push({
            type: 'minus_one_counters_placed',
            sourcePlayerId,
            controllerId: player.id,
            card,
            amount: effect.amount,
          })
        }
      }
      return { players: nextPlayers, triggerOccurrences }
    }
  }
}

function applyTappedManaCards(player: Player, cards: GameCard[]): Pick<Player, 'zones'> {
  const byId = new Map(cards.map(card => [card.instanceId, card]))
  return {
    zones: {
      ...player.zones,
      lands: player.zones.lands.map(card => byId.get(card.instanceId) ?? card),
      battlefield: player.zones.battlefield.map(card => byId.get(card.instanceId) ?? card),
    },
  }
}

function mergePaidCardsIntoZones(player: Player, paidCards?: GameCard[]): Pick<Player, 'zones'> {
  if (!paidCards) {
    return { zones: player.zones }
  }
  return applyTappedManaCards(player, [
    ...player.zones.lands.map(card => paidCards.find(entry => entry.instanceId === card.instanceId) ?? card),
    ...player.zones.battlefield.map(card => paidCards.find(entry => entry.instanceId === card.instanceId) ?? card),
  ])
}

function removeCardFromBattlefieldOrLands(player: Player, cardId: string): Player['zones'] {
  return {
    ...player.zones,
    battlefield: player.zones.battlefield.filter(card => card.instanceId !== cardId),
    lands: player.zones.lands.filter(card => card.instanceId !== cardId),
  }
}

function findGraveyardCard(players: Player[], targetCardId?: string) {
  if (!targetCardId) return { owner: null, card: null }
  for (const player of players) {
    const card = player.zones.graveyard.find(entry => entry.instanceId === targetCardId) ?? null
    if (card) {
      return { owner: player, card }
    }
  }
  return { owner: null, card: null }
}

function graveyardTargetMatches(targetType: 'own_graveyard_creature' | 'any_graveyard_creature' | 'opponent_graveyard_creature', sourcePlayerId: string, ownerId: string) {
  if (targetType === 'own_graveyard_creature') return ownerId === sourcePlayerId
  if (targetType === 'opponent_graveyard_creature') return ownerId !== sourcePlayerId
  return true
}

function reanimateFromGraveyard(
  players: Player[],
  sourcePlayerId: string,
  targetCardId: string | undefined,
  destination: 'battlefield' | 'hand',
  options?: { tapped?: boolean; minusOneCounters?: number; exileOnLeave?: boolean }
): { players: Player[]; enteredCard: GameCard | null; targetOwnerId: string | null } {
  const { owner, card } = findGraveyardCard(players, targetCardId)
  if (!owner || !card || !targetCardId) {
    return { players, enteredCard: null, targetOwnerId: null }
  }

  let movedCard = destination === 'battlefield' ? entersBattlefield(card) : { ...card, tapped: false, markedDamage: 0 }
  if (destination === 'battlefield') {
    movedCard = {
      ...movedCard,
      tapped: options?.tapped ?? movedCard.tapped,
      minusOneCounters: movedCard.minusOneCounters + (options?.minusOneCounters ?? 0),
      exileOnLeave: options?.exileOnLeave ?? movedCard.exileOnLeave,
    }
  }

  const nextPlayers = players.map(player => {
    if (player.id === owner.id && player.id === sourcePlayerId) {
      return {
        ...player,
        zones: {
          ...player.zones,
          graveyard: player.zones.graveyard.filter(entry => entry.instanceId !== targetCardId),
          [destination]: [...player.zones[destination], movedCard],
        },
      }
    }

    if (player.id === owner.id) {
      return {
        ...player,
        zones: {
          ...player.zones,
          graveyard: player.zones.graveyard.filter(entry => entry.instanceId !== targetCardId),
        },
      }
    }

    if (player.id === sourcePlayerId) {
      return {
        ...player,
        zones: {
          ...player.zones,
          [destination]: [...player.zones[destination], movedCard],
        },
      }
    }

    return player
  })

  return { players: nextPlayers, enteredCard: destination === 'battlefield' ? movedCard : null, targetOwnerId: owner.id }
}

function nextLivingTurnIndex(state: GameState): number {
  if (state.turnOrder.length === 0) return 0
  for (let offset = 1; offset <= state.turnOrder.length; offset++) {
    const idx = (state.currentTurnIndex + offset) % state.turnOrder.length
    const playerId = state.turnOrder[idx]
    const player = state.players.find(p => p.id === playerId)
    if (player && !player.isEliminated) return idx
  }
  return state.currentTurnIndex
}

function livingTurnOrder(state: GameState): string[] {
  return state.turnOrder.filter(playerId => {
    const player = state.players.find(entry => entry.id === playerId)
    return Boolean(player && !player.isEliminated)
  })
}

function nextLivingPlayerIdAfter(state: GameState, playerId: string): string | null {
  const livingOrder = livingTurnOrder(state)
  if (livingOrder.length === 0) return null
  const currentIndex = livingOrder.indexOf(playerId)
  if (currentIndex === -1) return livingOrder[0] ?? null
  return livingOrder[(currentIndex + 1) % livingOrder.length] ?? null
}

function resolveTriggerEffect(effect: TriggerEffectDefinition, state: GameState, controllerId: string, occurrence: TriggerOccurrence): TriggerEffectPayload {
  if (effect.kind === 'create_tokens') {
    const count = effect.count === 'opponents'
      ? state.players.filter(player => player.id !== controllerId && !player.isEliminated).length
      : effect.count
    return {
      kind: 'create_tokens',
      tokenKey: effect.tokenKey,
      count,
      tapped: effect.tapped,
    }
  }

  if (effect.kind === 'create_tokens_from_counter_placement') {
    return {
      kind: 'create_tokens',
      tokenKey: effect.tokenKey,
      count: occurrence.type === 'minus_one_counters_placed'
        ? (effect.mode === 'per_counter' ? occurrence.amount : 1)
        : 0,
      tapped: effect.tapped,
    }
  }

  if (effect.kind === 'draw_cards') {
    return { kind: 'draw_cards', amount: effect.amount }
  }

  if (effect.kind === 'gain_life') {
    return { kind: 'gain_life', amount: effect.amount }
  }

  if (effect.kind === 'proliferate') {
    return { kind: 'proliferate' }
  }

  if (effect.kind === 'put_minus_one_counter_target_creature') {
    return { kind: 'put_minus_one_counter_target_creature', amount: effect.amount }
  }

  if (effect.kind === 'return_graveyard_creature_to_battlefield') {
    return {
      kind: 'return_graveyard_creature_to_battlefield',
      target: effect.target,
      tapped: effect.tapped,
      minusOneCounters: effect.minusOneCounters,
      exileOnLeave: effect.exileOnLeave,
    }
  }

  if (effect.kind === 'return_graveyard_creature_to_hand') {
    return {
      kind: 'return_graveyard_creature_to_hand',
      target: effect.target,
    }
  }

  if (effect.kind === 'persist_self') {
    return {
      kind: 'return_graveyard_creature_to_battlefield',
      target: 'own_graveyard_creature',
      minusOneCounters: 1,
    }
  }

  return {
    kind: 'drain_each_opponent',
    amount: effect.amount,
    gainLife: effect.gainLife,
  }
}

function matchesTriggeredAbility(
  sourceCard: GameCard,
  sourceControllerId: string,
  ability: TriggeredAbilityDefinition,
  occurrence: TriggerOccurrence
): boolean {
  if (ability.event !== occurrence.type) return false

  if (occurrence.type === 'enters_battlefield' || occurrence.type === 'attacks') {
    return ability.match === 'self' && sourceCard.instanceId === occurrence.card.instanceId
  }

  if (occurrence.type === 'land_enters') {
    return ability.match === 'land_you_control_enters' && occurrence.controllerId === sourceControllerId
  }

  if (occurrence.type === 'creature_enters') {
    return ability.match === 'another_creature_you_control_enters'
      && occurrence.controllerId === sourceControllerId
      && occurrence.card.instanceId !== sourceCard.instanceId
  }

  if (occurrence.type === 'token_created') {
    if (ability.match === 'token_you_create' || ability.match === 'token_you_create_or_sacrifice') {
      return occurrence.controllerId === sourceControllerId
    }
    return false
  }

  if (occurrence.type === 'token_sacrificed') {
    return ability.match === 'token_you_create_or_sacrifice' && occurrence.controllerId === sourceControllerId
  }

  if (occurrence.type === 'minus_one_counters_placed') {
    return ability.match === 'minus_one_counters_you_put_on_creature' && occurrence.sourcePlayerId === sourceControllerId
  }

  if (occurrence.type === 'creature_dies') {
    if (!isCreatureCard(occurrence.card)) return false
    if (ability.match === 'self') {
      return occurrence.controllerId === sourceControllerId && occurrence.card.instanceId === sourceCard.instanceId
    }
    if (ability.match === 'another_creature_you_control') {
      return occurrence.controllerId === sourceControllerId && occurrence.card.instanceId !== sourceCard.instanceId
    }
    if (ability.match === 'opponent_creature_with_minus_one_counter_dies') {
      return occurrence.controllerId !== sourceControllerId && occurrence.card.minusOneCounters > 0
    }
    return ability.match === 'any_creature'
  }

  if (occurrence.type === 'upkeep') {
    if (ability.match === 'each_upkeep') return true
    return ability.match === 'your_upkeep' && occurrence.activePlayerId === sourceControllerId
  }

  if (occurrence.type === 'end_step') {
    return ability.match === 'your_end_step' && occurrence.activePlayerId === sourceControllerId
  }

  if (occurrence.type === 'spell_cast') {
    return ability.match === 'spell_you_cast' && occurrence.controllerId === sourceControllerId
  }

  return false
}

function queueTriggeredAbilities(state: GameState, occurrences: TriggerOccurrence[]): GameState {
  if (occurrences.length === 0) return state

  const triggers: StackItem[] = []
  const maybePushTrigger = (
    sourceCard: GameCard,
    controllerId: string,
    controllerName: string,
    ability: TriggeredAbilityDefinition,
    occurrence: TriggerOccurrence
  ) => {
    if (ability.effect.kind === 'persist_self' && occurrence.type === 'creature_dies' && occurrence.card.minusOneCounters > 0) {
      return
    }

    const triggerEffect = resolveTriggerEffect(ability.effect, state, controllerId, occurrence)
    const targetCardId =
      occurrence.type === 'creature_dies'
        && (
          ability.effect.kind === 'persist_self'
          || ability.match === 'opponent_creature_with_minus_one_counter_dies'
          || (ability.target === 'own_graveyard_creature' && ability.match === 'self')
        )
        ? occurrence.card.instanceId
        : undefined

    triggers.push({
      id: crypto.randomUUID(),
      card: sourceCard,
      casterId: controllerId,
      casterName: controllerName,
      source: 'hand',
      kind: 'trigger',
      abilityLabel: ability.label,
      triggerEffect,
      triggerTargetType: ability.target && ability.target !== 'none' && !targetCardId ? ability.target : undefined,
      targetCardId,
    })
  }

  for (const player of state.players) {
    for (const sourceCard of player.zones.battlefield) {
      const abilities = getTriggeredAbilities(sourceCard)
      for (const occurrence of occurrences) {
        for (const ability of abilities) {
          if (!matchesTriggeredAbility(sourceCard, player.id, ability, occurrence)) continue
          maybePushTrigger(sourceCard, player.id, player.name, ability, occurrence)
        }
      }
    }
  }

  for (const occurrence of occurrences) {
    if (occurrence.type !== 'creature_dies') continue
    const abilities = getTriggeredAbilities(occurrence.card)
    for (const ability of abilities) {
      if (!matchesTriggeredAbility(occurrence.card, occurrence.controllerId, ability, occurrence)) continue
      const controllerName = state.players.find(player => player.id === occurrence.controllerId)?.name ?? ''
      maybePushTrigger(occurrence.card, occurrence.controllerId, controllerName, ability, occurrence)
    }
  }

  if (triggers.length === 0) return state

  const nextTargetTrigger = [...triggers].reverse().find(trigger => trigger.triggerTargetType && !trigger.targetCardId)
  const pendingTriggerTargetChoice = nextTargetTrigger
    ? {
        playerId: nextTargetTrigger.casterId,
        stackItemId: nextTargetTrigger.id,
        sourceName: nextTargetTrigger.card.name,
        targetType: nextTargetTrigger.triggerTargetType!,
      }
    : state.pendingTriggerTargetChoice

  return {
    ...state,
    stack: [...state.stack, ...triggers],
    pendingTriggerTargetChoice,
    priorityPlayerId: state.turnOrder[state.currentTurnIndex] ?? null,
    priorityPassedIds: [],
    actionSeq: state.actionSeq + 1,
  }
}

function getPendingTriggerTargetChoice(stack: StackItem[]): GameState['pendingTriggerTargetChoice'] {
  const nextTargetTrigger = [...stack].reverse().find(item => item.kind === 'trigger' && item.triggerTargetType && !item.targetCardId)
  if (!nextTargetTrigger) return null
  return {
    playerId: nextTargetTrigger.casterId,
    stackItemId: nextTargetTrigger.id,
    sourceName: nextTargetTrigger.card.name,
    targetType: nextTargetTrigger.triggerTargetType!,
  }
}

function describeTarget(state: GameState, targetCardId?: string, targetPlayerId?: string): string {
  if (targetPlayerId) {
    return state.players.find(player => player.id === targetPlayerId)?.name ?? 'a player'
  }
  if (targetCardId) {
    for (const player of state.players) {
      const card =
        player.zones.battlefield.find(entry => entry.instanceId === targetCardId) ??
        player.zones.lands.find(entry => entry.instanceId === targetCardId) ??
        player.zones.graveyard.find(entry => entry.instanceId === targetCardId)
      if (card) return card.name
    }
  }
  return ''
}

function pushStackItem(
  state: GameState,
  item: Omit<StackItem, 'id'>
): GameState {
  return {
    ...state,
    stack: [
      ...state.stack,
      {
        ...item,
        id: crypto.randomUUID(),
      },
    ],
    priorityPlayerId: nextLivingPlayerIdAfter(state, item.casterId),
    priorityPassedIds: [],
    actionSeq: state.actionSeq + 1,
  }
}

function queuePhaseTriggers(state: GameState, phase: TurnPhase, turnIndex = state.currentTurnIndex): GameState {
  const activePlayerId = state.turnOrder[turnIndex]
  if (!activePlayerId) return state

  if (phase === 'upkeep') {
    return queueTriggeredAbilities(state, [{ type: 'upkeep', activePlayerId }])
  }

  if (phase === 'end') {
    return queueTriggeredAbilities(state, [{ type: 'end_step', activePlayerId }])
  }

  return state
}

function applyPhaseEntry(state: GameState, phase: TurnPhase, turnIndex = state.currentTurnIndex): GameState {
  const currentPlayerId = state.turnOrder[turnIndex]
  if (!currentPlayerId) return state
  const baseState = {
    ...state,
    players: state.players.map(player => ({ ...player, manaPool: emptyManaPool() })),
  }

  switch (phase) {
    case 'untap':
      return {
        ...baseState,
        players: baseState.players.map(player =>
          player.id === currentPlayerId
            ? {
                ...player,
                landsPlayedThisTurn: 0,
                zones: {
                  ...player.zones,
                  lands: player.zones.lands.map(card => ({ ...card, tapped: false })),
                  battlefield: player.zones.battlefield.map(card => ({
                    ...card,
                    tapped: false,
                    summoningSick: false,
                    markedDamage: 0,
                    loyaltyActivatedThisTurn: false,
                  })),
                },
              }
            : player
        ),
      }
    case 'draw':
      return {
        ...baseState,
        players: baseState.players.map(player =>
          player.id === currentPlayerId
            ? {
                ...player,
                zones: {
                  ...player.zones,
                  library: player.zones.library.slice(Math.min(1, player.zones.library.length)),
                  hand: [...player.zones.hand, ...player.zones.library.slice(0, 1)],
                },
              }
            : player
        ),
      }
    default:
      return baseState
  }
}

function advanceThroughAutomaticPhases(state: GameState): GameState {
  let nextState = state

  while (AUTO_ADVANCE_PHASES.has(nextState.currentPhase)) {
    nextState = queuePhaseTriggers(nextState, nextState.currentPhase, nextState.currentTurnIndex)
    if (nextState.stack.length > 0) {
      break
    }
    nextState = applyPhaseEntry(nextState, nextState.currentPhase, nextState.currentTurnIndex)
    const currentIndex = TURN_PHASES.indexOf(nextState.currentPhase)
    const followingPhase = TURN_PHASES[currentIndex + 1]
    if (!followingPhase) break
    nextState = {
      ...nextState,
      currentPhase: followingPhase,
      combat: followingPhase === 'combat' ? nextState.combat : { attackers: [] },
    }
  }

  return nextState
}

function resolveStackTop(state: GameState): GameState {
  const stackItem = state.stack[state.stack.length - 1]
  if (!stackItem) return state

  let players = state.players.map(player => ({
    ...player,
    zones: {
      ...player.zones,
      battlefield: player.zones.battlefield.map(card => ({ ...card })),
      lands: player.zones.lands.map(card => ({ ...card })),
      graveyard: player.zones.graveyard.map(card => ({ ...card })),
      hand: player.zones.hand.map(card => ({ ...card })),
    },
  }))
  const triggerOccurrences: TriggerOccurrence[] = []
  let pendingProliferateChoice = state.pendingProliferateChoice

  const targetPlayer = stackItem.targetPlayerId
    ? players.find(player => player.id === stackItem.targetPlayerId) ?? null
    : null
  const targetBattlefieldOwner = stackItem.targetCardId
    ? players.find(player =>
        player.zones.battlefield.some(entry => entry.instanceId === stackItem.targetCardId) ||
        player.zones.lands.some(entry => entry.instanceId === stackItem.targetCardId)
      ) ?? null
    : null

  let spellAutomated = true

  if (stackItem.kind === 'commander') {
    const enteredCard = entersBattlefield(stackItem.card)
    players = players.map(player =>
      player.id === stackItem.casterId
        ? {
            ...player,
            zones: {
              ...player.zones,
              battlefield: [...player.zones.battlefield, enteredCard],
            },
          }
        : player
    )
    triggerOccurrences.push({ type: 'enters_battlefield', controllerId: stackItem.casterId, card: enteredCard })
    if (isCreatureCard(enteredCard)) {
      triggerOccurrences.push({ type: 'creature_enters', controllerId: stackItem.casterId, card: enteredCard })
    }
  } else if (stackItem.kind === 'permanent') {
    const enteredCard = entersBattlefield(stackItem.card)
    players = players.map(player =>
      player.id === stackItem.casterId
        ? {
            ...player,
            zones: {
              ...player.zones,
              battlefield: [...player.zones.battlefield, enteredCard],
            },
          }
        : player
    )
    triggerOccurrences.push({ type: 'enters_battlefield', controllerId: stackItem.casterId, card: enteredCard })
    if (isCreatureCard(enteredCard)) {
      triggerOccurrences.push({ type: 'creature_enters', controllerId: stackItem.casterId, card: enteredCard })
    }
  } else if (stackItem.kind === 'trigger' && stackItem.triggerEffect) {
    const effect = stackItem.triggerEffect
    switch (effect.kind) {
      case 'create_tokens': {
        const tokenController = players.find(player => player.id === stackItem.casterId)
        const createdTokens = tokenController
          ? createTokensForPlayer(tokenController, effect.tokenKey, effect.count, effect.tapped ?? false)
          : []
        players = players.map(player =>
          player.id === stackItem.casterId
            ? {
                ...player,
                zones: {
                  ...player.zones,
                  battlefield: [...player.zones.battlefield, ...createdTokens],
                },
              }
            : player
        )
        if (createdTokens.length > 0) {
          triggerOccurrences.push({ type: 'token_created', controllerId: stackItem.casterId, card: createdTokens[0] })
        }
        for (const token of createdTokens) {
          triggerOccurrences.push({ type: 'enters_battlefield', controllerId: stackItem.casterId, card: token })
          if (isCreatureCard(token)) {
            triggerOccurrences.push({ type: 'creature_enters', controllerId: stackItem.casterId, card: token })
          }
        }
        break
      }
      case 'draw_cards':
        players = players.map(player =>
          player.id === stackItem.casterId
            ? {
                ...player,
                zones: {
                  ...player.zones,
                  library: player.zones.library.slice(Math.min(effect.amount, player.zones.library.length)),
                  hand: [...player.zones.hand, ...player.zones.library.slice(0, effect.amount)],
                },
              }
            : player
        )
        break
      case 'gain_life':
        players = players.map(player =>
          player.id === stackItem.casterId
            ? { ...player, life: playerCanGainLife(players, stackItem.casterId) ? player.life + effect.amount : player.life }
            : player
        )
        break
      case 'proliferate':
        pendingProliferateChoice = {
          playerId: stackItem.casterId,
          sourceName: stackItem.card.name,
        }
        break
      case 'put_minus_one_counter_target_creature':
        if (targetBattlefieldOwner?.id && stackItem.targetCardId) {
          players = players.map(player =>
            player.id === targetBattlefieldOwner.id
              ? {
                  ...player,
                  zones: {
                    ...player.zones,
                    battlefield: player.zones.battlefield.map(entry =>
                      entry.instanceId === stackItem.targetCardId ? { ...entry, minusOneCounters: entry.minusOneCounters + effect.amount } : entry
                    ),
                  },
                }
              : player
          )
          const targetCard = targetBattlefieldOwner.zones.battlefield.find(entry => entry.instanceId === stackItem.targetCardId)
          if (targetCard) {
            triggerOccurrences.push({
              type: 'minus_one_counters_placed',
              sourcePlayerId: stackItem.casterId,
              controllerId: targetBattlefieldOwner.id,
              card: targetCard,
              amount: effect.amount,
            })
          }
        }
        break
      case 'return_graveyard_creature_to_battlefield': {
        const result = reanimateFromGraveyard(players, stackItem.casterId, stackItem.targetCardId, 'battlefield', {
          tapped: effect.tapped,
          minusOneCounters: effect.minusOneCounters,
          exileOnLeave: effect.exileOnLeave,
        })
        players = result.players
        if (result.enteredCard) {
          triggerOccurrences.push({ type: 'enters_battlefield', controllerId: stackItem.casterId, card: result.enteredCard })
          if (isCreatureCard(result.enteredCard)) {
            triggerOccurrences.push({ type: 'creature_enters', controllerId: stackItem.casterId, card: result.enteredCard })
          }
        }
        break
      }
      case 'return_graveyard_creature_to_hand': {
        const result = reanimateFromGraveyard(players, stackItem.casterId, stackItem.targetCardId, 'hand')
        players = result.players
        break
      }
      case 'drain_each_opponent':
        players = players.map(player => {
          if (player.id === stackItem.casterId) {
            return {
              ...player,
              life: playerCanGainLife(players, stackItem.casterId) ? player.life + effect.gainLife : player.life,
            }
          }
          if (player.isEliminated) return player
          return { ...player, life: player.life - effect.amount }
        })
        break
    }
  } else {
    const addSpellToCasterGraveyard = (allPlayers: Player[]) =>
      allPlayers.map(player =>
        player.id === stackItem.casterId
          ? {
              ...player,
              zones: {
                ...player.zones,
                graveyard: [...player.zones.graveyard, { ...stackItem.card, tapped: false, markedDamage: 0 }],
              },
            }
          : player
      )

    if (stackItem.card.name === "Black Sun's Zenith" && typeof stackItem.castOptions?.xValue === 'number') {
      const amount = stackItem.castOptions.xValue
      players = players.map(player => ({
        ...player,
        zones: {
          ...player.zones,
          battlefield: player.zones.battlefield.map(entry =>
            isCreatureCard(entry) ? { ...entry, minusOneCounters: entry.minusOneCounters + amount } : entry
          ),
          library: player.id === stackItem.casterId
            ? shuffleCards([...player.zones.library, { ...stackItem.card, tapped: false, markedDamage: 0 }])
            : player.zones.library,
        },
      }))
      for (const player of state.players) {
        for (const card of player.zones.battlefield) {
          if (!isCreatureCard(card)) continue
          triggerOccurrences.push({
            type: 'minus_one_counters_placed',
            sourcePlayerId: stackItem.casterId,
            controllerId: player.id,
            card,
            amount,
          })
        }
      }
    } else if (stackItem.card.name === 'Painful Truths') {
      const colorsSpent = stackItem.spentMana
        ? (['W', 'U', 'B', 'R', 'G'] as const).filter(color => stackItem.spentMana![color] > 0).length
        : 0
      players = addSpellToCasterGraveyard(players).map(player =>
        player.id === stackItem.casterId
          ? {
              ...player,
              life: player.life - colorsSpent,
              zones: {
                ...player.zones,
                library: player.zones.library.slice(Math.min(colorsSpent, player.zones.library.length)),
                hand: [...player.zones.hand, ...player.zones.library.slice(0, colorsSpent)],
              },
            }
          : player
      )
    } else if (stackItem.card.name === 'Deadly Dispute') {
      players = addSpellToCasterGraveyard(players)
      const tokenController = players.find(player => player.id === stackItem.casterId)
      const createdTokens = tokenController ? createTokensForPlayer(tokenController, 'treasure', 1) : []
      players = players.map(player =>
        player.id === stackItem.casterId
          ? {
              ...player,
              zones: {
                ...player.zones,
                library: player.zones.library.slice(Math.min(2, player.zones.library.length)),
                hand: [...player.zones.hand, ...player.zones.library.slice(0, 2)],
                battlefield: [...player.zones.battlefield, ...createdTokens],
              },
            }
          : player
      )
      if (createdTokens[0]) {
        triggerOccurrences.push({ type: 'token_created', controllerId: stackItem.casterId, card: createdTokens[0] })
        triggerOccurrences.push({ type: 'enters_battlefield', controllerId: stackItem.casterId, card: createdTokens[0] })
      }
    } else if (stackItem.card.name === 'Cathartic Pyre') {
      if (stackItem.castOptions?.mode === 'loot') {
        players = addSpellToCasterGraveyard(players).map(player => {
          if (player.id !== stackItem.casterId) return player
          const discardIds = new Set(stackItem.castOptions?.selectedCardIds ?? [])
          const discardedCards = player.zones.hand.filter(entry => discardIds.has(entry.instanceId)).slice(0, 2)
          return {
            ...player,
            zones: {
              ...player.zones,
              hand: [
                ...player.zones.hand.filter(entry => !discardIds.has(entry.instanceId)),
                ...player.zones.library.slice(0, discardedCards.length),
              ],
              library: player.zones.library.slice(Math.min(discardedCards.length, player.zones.library.length)),
              graveyard: [...player.zones.graveyard, ...discardedCards.map(entry => ({ ...entry, tapped: false, markedDamage: 0 }))],
            },
          }
        })
      } else {
        players = addSpellToCasterGraveyard(players)
        if (targetBattlefieldOwner?.id && stackItem.targetCardId) {
          players = applyDamageToCreature(players, targetBattlefieldOwner.id, stackItem.targetCardId, 3, stackItem.casterId, stackItem.card)
        }
      }
    } else {
    const definition = getSimpleSpellDefinition(stackItem.card)
    if (!definition) {
      spellAutomated = false
      // Spell has no known effect — move to graveyard without any game effect
      players = players.map(player =>
        player.id === stackItem.casterId
          ? {
              ...player,
              zones: {
                ...player.zones,
                graveyard: [...player.zones.graveyard, { ...stackItem.card, tapped: false, markedDamage: 0 }],
              },
            }
          : player
      )
    } else {
      switch (definition.kind) {
        case 'draw_cards':
          players = addSpellToCasterGraveyard(players).map(player =>
            player.id === stackItem.casterId
              ? {
                  ...player,
                  life: player.life - (definition.loseLife ?? 0),
                  zones: {
                    ...player.zones,
                    library: player.zones.library.slice(Math.min(definition.amount, player.zones.library.length)),
                    hand: [...player.zones.hand, ...player.zones.library.slice(0, definition.amount)],
                  },
                }
              : player
          )
          break
        case 'create_tokens': {
          const count = definition.count === 'opponents'
            ? players.filter(player => player.id !== stackItem.casterId && !player.isEliminated).length
            : definition.count
          const tokenController = players.find(player => player.id === stackItem.casterId)
          const createdTokens = tokenController
            ? createTokensForPlayer(tokenController, definition.tokenKey, count, definition.tapped ?? false)
            : []
          players = addSpellToCasterGraveyard(players).map(player =>
            player.id === stackItem.casterId
              ? {
                  ...player,
                  zones: {
                    ...player.zones,
                    battlefield: [...player.zones.battlefield, ...createdTokens],
                  },
                }
              : player
          )
          if (createdTokens.length > 0) {
            triggerOccurrences.push({ type: 'token_created', controllerId: stackItem.casterId, card: createdTokens[0] })
          }
          for (const token of createdTokens) {
            triggerOccurrences.push({ type: 'enters_battlefield', controllerId: stackItem.casterId, card: token })
            if (isCreatureCard(token)) {
              triggerOccurrences.push({ type: 'creature_enters', controllerId: stackItem.casterId, card: token })
            }
          }
          break
        }
        case 'proliferate':
          players = addSpellToCasterGraveyard(players)
          pendingProliferateChoice = {
            playerId: stackItem.casterId,
            sourceName: stackItem.card.name,
          }
          break
        case 'destroy_target_creature':
        case 'destroy_target_nonland_permanent':
        case 'destroy_target_permanent': {
          const deadCard = targetBattlefieldOwner && stackItem.targetCardId
            ? targetBattlefieldOwner.zones.battlefield.find(entry => entry.instanceId === stackItem.targetCardId) ??
              targetBattlefieldOwner.zones.lands.find(entry => entry.instanceId === stackItem.targetCardId) ??
              null
            : null
          players = addSpellToCasterGraveyard(players).map(player =>
            player.id === targetBattlefieldOwner?.id && stackItem.targetCardId
              ? moveBattlefieldCardToGraveyard(player, stackItem.targetCardId)
              : player
          )
          if (deadCard && isCreatureCard(deadCard)) {
            triggerOccurrences.push({ type: 'creature_dies', controllerId: targetBattlefieldOwner!.id, card: deadCard })
          }
          break
        }
        case 'damage_target_creature':
        case 'damage_target_creature_or_player':
          players = addSpellToCasterGraveyard(players)
          if (definition.kind === 'damage_target_creature_or_player' && targetPlayer?.id) {
            players = applyDamageToPlayer(players, targetPlayer.id, definition.amount, stackItem.casterId, stackItem.card)
            players = maybeGainLifeFromDamage(players, stackItem.casterId, stackItem.card, definition.amount)
          } else if (targetBattlefieldOwner?.id && stackItem.targetCardId) {
            players = applyDamageToCreature(players, targetBattlefieldOwner.id, stackItem.targetCardId, definition.amount, stackItem.casterId, stackItem.card)
            players = maybeGainLifeFromDamage(players, stackItem.casterId, stackItem.card, definition.amount)
          }
          break
        case 'put_minus_one_counter_target_creature':
          players = addSpellToCasterGraveyard(players).map(player =>
            player.id === targetBattlefieldOwner?.id && stackItem.targetCardId
              ? {
                  ...player,
                  zones: {
                    ...player.zones,
                    battlefield: player.zones.battlefield.map(entry =>
                      entry.instanceId === stackItem.targetCardId ? { ...entry, minusOneCounters: entry.minusOneCounters + definition.amount } : entry
                    ),
                  },
                }
              : player
          )
          if (targetBattlefieldOwner && stackItem.targetCardId) {
            const targetCard = targetBattlefieldOwner.zones.battlefield.find(entry => entry.instanceId === stackItem.targetCardId)
            if (targetCard) {
              triggerOccurrences.push({
                type: 'minus_one_counters_placed',
                sourcePlayerId: stackItem.casterId,
                controllerId: targetBattlefieldOwner.id,
                card: targetCard,
                amount: definition.amount,
              })
            }
          }
          break
        case 'put_minus_one_counters_each_creature':
          players = addSpellToCasterGraveyard(players).map(player => ({
            ...player,
            zones: {
              ...player.zones,
              battlefield: player.zones.battlefield.map(entry =>
                isCreatureCard(entry) ? { ...entry, minusOneCounters: entry.minusOneCounters + definition.amount } : entry
              ),
            },
          }))
          for (const player of state.players) {
            for (const card of player.zones.battlefield) {
              if (!isCreatureCard(card)) continue
              triggerOccurrences.push({
                type: 'minus_one_counters_placed',
                sourcePlayerId: stackItem.casterId,
                controllerId: player.id,
                card,
                amount: definition.amount,
              })
            }
          }
          break
        case 'mass_damage_creatures': {
          const amount = definition.amount === 'creature_count'
            ? players.reduce((sum, player) => sum + player.zones.battlefield.filter(isCreatureCard).length, 0)
            : definition.amount

          players = addSpellToCasterGraveyard(players)
          for (const player of [...players]) {
            for (const entry of player.zones.battlefield) {
              if (!isCreatureCard(entry)) continue
              players = applyDamageToCreature(players, player.id, entry.instanceId, amount, stackItem.casterId, stackItem.card)
            }
          }
          break
        }
        case 'return_graveyard_creature_to_battlefield':
        case 'return_graveyard_creature_to_hand':
          players = addSpellToCasterGraveyard(players)
          const result = reanimateFromGraveyard(
            players,
            stackItem.casterId,
            stackItem.targetCardId,
            definition.kind === 'return_graveyard_creature_to_battlefield' ? 'battlefield' : 'hand',
            {
              tapped: definition.kind === 'return_graveyard_creature_to_battlefield' ? definition.tapped : undefined,
              minusOneCounters: definition.kind === 'return_graveyard_creature_to_battlefield' ? definition.minusOneCounters : undefined,
              exileOnLeave: definition.kind === 'return_graveyard_creature_to_battlefield' ? definition.exileOnLeave : undefined,
            }
          )
          players = result.players
          if (definition.kind === 'return_graveyard_creature_to_battlefield') {
            if (result.enteredCard) {
              triggerOccurrences.push({ type: 'enters_battlefield', controllerId: stackItem.casterId, card: result.enteredCard })
              if (isCreatureCard(result.enteredCard)) {
                triggerOccurrences.push({ type: 'creature_enters', controllerId: stackItem.casterId, card: result.enteredCard })
              }
            }
          }
          break
      }
    }
    }
  }

  const cleaned = cleanupBattlefieldState(players)
  triggerOccurrences.push(...cleaned.triggerOccurrences)

  const nextBase = {
    ...state,
    players: cleaned.players,
    stack: state.stack.slice(0, -1),
    pendingProliferateChoice,
    pendingTriggerTargetChoice: getPendingTriggerTargetChoice(state.stack.slice(0, -1)),
    priorityPlayerId: state.turnOrder[state.currentTurnIndex] ?? null,
    priorityPassedIds: [],
    actionSeq: state.actionSeq + 1,
    log: !spellAutomated
      ? appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: stackItem.casterId,
          playerName: stackItem.casterName,
          description: `${stackItem.card.name} resolved — effect not automated, apply manually`,
          action: { type: 'RESOLVE_STACK' },
          undoable: true,
        })
      : state.log,
  }
  const next = queueTriggeredAbilities(nextBase, triggerOccurrences)
  return checkEliminations(next)
}

function describe(state: GameState, action: ActionPayload): string {
  const player = (id: string) => state.players.find(p => p.id === id)?.name ?? id
  switch (action.type) {
    case 'LIFE_CHANGE':
      return `${player(action.targetId)} life ${action.delta > 0 ? '+' : ''}${action.delta}`
    case 'COMMANDER_DAMAGE':
      return `${player(action.fromId)} dealt ${action.delta} commander damage to ${player(action.toId)}`
    case 'COUNTER_CHANGE':
      return `${player(action.targetId)} ${action.counter} ${action.delta > 0 ? '+' : ''}${action.delta}`
    case 'CARD_COUNTER_CHANGE': {
      const owner = state.players.find(p => p.id === action.playerId)
      const card = owner?.zones.battlefield.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} changed ${action.counter} on ${card?.name ?? 'a card'} by ${action.delta > 0 ? '+' : ''}${action.delta}`
    }
    case 'SET_MONARCH':
      return `${player(action.playerId)} became the Monarch`
    case 'CLEAR_MONARCH':
      return 'Monarch removed'
    case 'SET_INITIATIVE':
      return `${player(action.playerId)} took the Initiative`
    case 'CLEAR_INITIATIVE':
      return 'Initiative removed'
    case 'NEXT_STEP':
      return 'Advance turn'
    case 'DRAW_CARD':
      return `${player(action.playerId)} drew ${action.count ?? 1} card${(action.count ?? 1) === 1 ? '' : 's'}`
    case 'MULLIGAN_TAKE':
      return `${player(action.playerId)} took a mulligan`
    case 'MULLIGAN_KEEP':
      return `${player(action.playerId)} kept their opening hand`
    case 'MULLIGAN_BOTTOM_CARD': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.hand.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} put ${card?.name ?? 'a card'} on the bottom`
    }
    case 'MOVE_CARD': {
      const source = state.players.find(p => p.id === action.playerId)?.zones[action.from].find(card => card.instanceId === action.cardId)
      return `${player(action.playerId)} moved ${source?.name ?? 'a card'} to ${action.to}`
    }
    case 'ADD_MANA': {
      const land = state.players.find(p => p.id === action.playerId)?.zones.lands.find(card => card.instanceId === action.cardId)
      return `${player(action.playerId)} added {${action.color}} with ${land?.name ?? 'a land'}`
    }
    case 'ACTIVATE_ABILITY': {
      const source =
        state.players.find(p => p.id === action.playerId)?.zones.battlefield.find(card => card.instanceId === action.cardId) ??
        state.players.find(p => p.id === action.playerId)?.zones.lands.find(card => card.instanceId === action.cardId)
      return `${player(action.playerId)} activated ${source?.name ?? 'an ability'}`
    }
    case 'ACTIVATE_PLANESWALKER_ABILITY': {
      const source = state.players.find(p => p.id === action.playerId)?.zones.battlefield.find(card => card.instanceId === action.cardId)
      const ability = source ? getPlaneswalkerAbilities(source).find(entry => entry.id === action.abilityId) : null
      return `${player(action.playerId)} activated ${source?.name ?? 'a planeswalker'} ${ability ? `(${ability.label})` : ''}`.trim()
    }
    case 'RESOLVE_LAND_EFFECT': {
      const choice = state.pendingLandEffectChoice
      if (action.effect === 'bounce_land') {
        const card = state.players.find(p => p.id === action.playerId)?.zones.lands.find(c => c.instanceId === action.targetCardId)
        return `${player(action.playerId)} returned ${card?.name ?? 'a land'} to hand`
      }
      const targetPlayer = action.targetPlayerId ? state.players.find(p => p.id === action.targetPlayerId)?.name ?? 'a player' : 'a player'
      return `${player(action.playerId)} exiled ${targetPlayer}'s graveyard with ${choice?.sourceName ?? 'a land'}`
    }
    case 'RESOLVE_EXPLORE_CHOICE': {
      const choice = state.pendingExploreChoice
      return `${player(action.playerId)} chose to ${action.putInGraveyard ? 'put' : 'leave'} ${choice?.revealedCard.name ?? 'the revealed card'} ${action.putInGraveyard ? 'in the graveyard' : 'on top'}`
    }
    case 'RESOLVE_PROLIFERATE_CHOICE':
      return `${player(action.playerId)} proliferated`
    case 'TOGGLE_CARD_TAPPED': {
      const currentPlayer = state.players.find(p => p.id === action.playerId)
      const card =
        currentPlayer?.zones.battlefield.find(c => c.instanceId === action.cardId) ??
        currentPlayer?.zones.lands.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} ${card?.tapped ? 'untapped' : 'tapped'} ${card?.name ?? 'a card'}`
    }
    case 'PLAY_LAND': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.hand.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} played ${card?.name ?? 'a land'}`
    }
    case 'CAST_COMMANDER': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.commandZone.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} cast ${card?.name ?? 'their commander'} to the stack`
    }
    case 'CAST_PERMANENT': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.hand.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} cast ${card?.name ?? 'a permanent'} to the stack`
    }
    case 'CAST_SPELL': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.hand.find(c => c.instanceId === action.cardId)
      const target = describeTarget(state, action.targetCardId, action.targetPlayerId)
      return `${player(action.playerId)} cast ${card?.name ?? 'a spell'}${target ? ` targeting ${target}` : ''}`
    }
    case 'DECLARE_ATTACKER': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.battlefield.find(c => c.instanceId === action.cardId)
      const defendingPlayer = state.players.find(p => p.id === action.defendingPlayerId)
      const defendingCard = action.defendingCardId
        ? defendingPlayer?.zones.battlefield.find(c => c.instanceId === action.defendingCardId)
        : null
      const defender = defendingCard?.name ?? defendingPlayer?.name ?? 'a player'
      return `${player(action.playerId)} attacked ${defender} with ${card?.name ?? 'a creature'}`
    }
    case 'ASSIGN_BLOCKER': {
      const blocker = state.players.find(p => p.id === action.playerId)?.zones.battlefield.find(c => c.instanceId === action.blockerId)
      return `${player(action.playerId)} blocked with ${blocker?.name ?? 'a creature'}`
    }
    case 'RESOLVE_COMBAT':
      return 'Combat resolved'
    case 'RESOLVE_STACK': {
      const top = state.stack[state.stack.length - 1]
      return `Resolved ${top?.kind === 'trigger' ? `${top.card.name} — ${top.abilityLabel ?? 'trigger'}` : top?.card.name ?? 'top of stack'}`
    }
    case 'PASS_PRIORITY':
      return `${player(action.playerId)} passed priority`
    case 'PLAYER_ELIMINATE':
      return `${player(action.playerId)} was eliminated`
    case 'GAME_START':
      return 'Game started'
    case 'RESET_GAME':
      return 'Game reset'
    case 'RESOLVE_LIBRARY_SEARCH': {
      const choice = state.pendingLibrarySearchChoice
      const card = action.targetCardId
        ? state.players.find(p => p.id === action.playerId)?.zones.library.find(entry => entry.instanceId === action.targetCardId)
        : null
      return `${player(action.playerId)} searched with ${choice?.sourceName ?? 'a land'}${card ? ` and found ${card.name}` : ''}`
    }
    default:
      return action.type
  }
}

function appendLog(log: LogEntry[], entry: Omit<LogEntry, 'seq'>): LogEntry[] {
  const seq = (log[log.length - 1]?.seq ?? 0) + 1
  const next = [...log, { ...entry, seq }]
  return next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next
}

// Undo stack: stores previous states for direct restore (no replay needed)
const MAX_UNDO = 30
const _undoStacks: Record<string, GameState[]> = {}

export function pushUndo(roomId: string, state: GameState) {
  if (!_undoStacks[roomId]) _undoStacks[roomId] = []
  const stack = _undoStacks[roomId]
  stack.push(state)
  if (stack.length > MAX_UNDO) {
    _undoStacks[roomId] = stack.slice(stack.length - MAX_UNDO)
  }
}

export function popUndo(roomId: string): GameState | undefined {
  return _undoStacks[roomId]?.pop()
}

export function clearUndo(roomId: string) {
  _undoStacks[roomId] = []
}

export function gameReducer(state: GameState, action: ActionPayload): GameState {
  // Snapshot before undoable mutations (not for meta/read-only actions)
  const nonUndoable = new Set([
    'PLAYER_JOIN',
    'PLAYER_CONNECTED',
    'SET_PLAYER_NAME',
    'SET_COMMANDER',
    'SET_DECK',
    'SET_TURN_ORDER',
    'UNDO',
    'GAME_START',
    'RESET_GAME',
    'RESOLVE_LIBRARY_SEARCH',
    'RESOLVE_EXPLORE_CHOICE',
    'RESOLVE_PROLIFERATE_CHOICE',
    'SET_TRIGGER_TARGET',
    'RESOLVE_LAND_EFFECT',
  ])
  if (!nonUndoable.has(action.type) && state.phase === 'active') {
    pushUndo(state.roomId, state)
  }

  if (state.phase === 'mulligan') {
    const allowedDuringMulligan = new Set<ActionPayload['type']>([
      'MULLIGAN_TAKE',
      'MULLIGAN_KEEP',
      'MULLIGAN_BOTTOM_CARD',
      'PLAYER_CONNECTED',
      'PLAYER_JOIN',
      'SET_PLAYER_NAME',
      'UNDO',
      'RESET_GAME',
    ])
    if (!allowedDuringMulligan.has(action.type)) {
      return state
    }
  }

  if (state.pendingExploreChoice) {
    const allowedDuringExploreChoice = new Set<ActionPayload['type']>([
      'RESOLVE_EXPLORE_CHOICE',
      'PLAYER_CONNECTED',
      'PLAYER_JOIN',
      'SET_PLAYER_NAME',
      'UNDO',
      'RESET_GAME',
    ])
    if (!allowedDuringExploreChoice.has(action.type)) {
      return state
    }
  }

  if (state.pendingLibrarySearchChoice) {
    const allowedDuringLibrarySearchChoice = new Set<ActionPayload['type']>([
      'RESOLVE_LIBRARY_SEARCH',
      'PLAYER_CONNECTED',
      'PLAYER_JOIN',
      'SET_PLAYER_NAME',
      'UNDO',
      'RESET_GAME',
    ])
    if (!allowedDuringLibrarySearchChoice.has(action.type)) {
      return state
    }
  }

  if (state.pendingProliferateChoice) {
    const allowedDuringProliferateChoice = new Set<ActionPayload['type']>([
      'RESOLVE_PROLIFERATE_CHOICE',
      'PLAYER_CONNECTED',
      'PLAYER_JOIN',
      'SET_PLAYER_NAME',
      'UNDO',
      'RESET_GAME',
    ])
    if (!allowedDuringProliferateChoice.has(action.type)) {
      return state
    }
  }

  if (state.pendingTriggerTargetChoice) {
    const allowedDuringTriggerTargetChoice = new Set<ActionPayload['type']>([
      'SET_TRIGGER_TARGET',
      'PLAYER_CONNECTED',
      'PLAYER_JOIN',
      'SET_PLAYER_NAME',
      'UNDO',
      'RESET_GAME',
    ])
    if (!allowedDuringTriggerTargetChoice.has(action.type)) {
      return state
    }
  }

  if (state.pendingLandEffectChoice) {
    const allowedDuringLandEffectChoice = new Set<ActionPayload['type']>([
      'RESOLVE_LAND_EFFECT',
      'PLAYER_CONNECTED',
      'PLAYER_JOIN',
      'SET_PLAYER_NAME',
      'UNDO',
      'RESET_GAME',
    ])
    if (!allowedDuringLandEffectChoice.has(action.type)) {
      return state
    }
  }

  switch (action.type) {
    case 'LIFE_CHANGE': {
      const players = state.players.map(p =>
        p.id === action.targetId
          ? { ...p, life: p.life + (action.delta > 0 && !playerCanGainLife(state.players, action.targetId) ? 0 : action.delta) }
          : p
      )
      const next = { ...state, players, actionSeq: state.actionSeq + 1 }
      const withElim = checkEliminations(next)
      return {
        ...withElim,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.targetId,
          playerName: state.players.find(p => p.id === action.targetId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'RESOLVE_EXPLORE_CHOICE': {
      const choice = state.pendingExploreChoice
      if (!choice || choice.playerId !== action.playerId) return state

      const players = state.players.map(player => {
        if (player.id !== action.playerId) return player
        return {
          ...player,
          zones: {
            ...player.zones,
            library: action.putInGraveyard ? player.zones.library : [choice.revealedCard, ...player.zones.library],
            graveyard: action.putInGraveyard ? [...player.zones.graveyard, choice.revealedCard] : player.zones.graveyard,
          },
        }
      })

      return {
        ...state,
        players,
        pendingExploreChoice: null,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'RESOLVE_LIBRARY_SEARCH': {
      const choice = state.pendingLibrarySearchChoice
      if (!choice || choice.playerId !== action.playerId || choice.sourceCardId !== action.sourceCardId) return state

      const player = state.players.find(entry => entry.id === action.playerId)
      if (!player) return state

      const matchesBasicType = (card: GameCard) => {
        if (!isBasicLandCard(card)) return false
        if (!choice.basicLandTypes || choice.basicLandTypes.length === 0) return true
        const lowerTypeLine = card.typeLine.toLowerCase()
        return choice.basicLandTypes.some(type => lowerTypeLine.includes(type))
      }

      const targetCard = action.targetCardId
        ? player.zones.library.find(entry => entry.instanceId === action.targetCardId) ?? null
        : null
      if (targetCard && !matchesBasicType(targetCard)) return state

      const remainingLibrary = shuffleCards(
        player.zones.library.filter(entry => entry.instanceId !== action.targetCardId)
      )
      const fetchedLand = targetCard ? { ...targetCard, tapped: true, markedDamage: 0 } : null
      const triggerOccurrences: TriggerOccurrence[] = fetchedLand
        ? [{ type: 'land_enters', controllerId: action.playerId, card: fetchedLand }]
        : []

      const nextState = queueTriggeredAbilities({
        ...state,
        players: state.players.map(entry =>
          entry.id === action.playerId
            ? {
                ...entry,
                zones: {
                  ...entry.zones,
                  library: remainingLibrary,
                  lands: fetchedLand ? [...entry.zones.lands, fetchedLand] : entry.zones.lands,
                },
              }
            : entry
        ),
        pendingLibrarySearchChoice: null,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: player.name,
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }, triggerOccurrences)

      return nextState
    }

    case 'RESOLVE_PROLIFERATE_CHOICE': {
      const choice = state.pendingProliferateChoice
      if (!choice || choice.playerId !== action.playerId) return state

      const playerTargets = new Set(action.targetPlayerIds)
      const cardTargets = new Set(action.targetCardIds)

      const players = state.players.map(player => ({
        ...player,
        counters: playerTargets.has(player.id)
          ? {
              poison: player.counters.poison + (player.counters.poison > 0 ? 1 : 0),
              experience: player.counters.experience + (player.counters.experience > 0 ? 1 : 0),
              energy: player.counters.energy + (player.counters.energy > 0 ? 1 : 0),
              storm: player.counters.storm + (player.counters.storm > 0 ? 1 : 0),
            }
          : player.counters,
        zones: {
          ...player.zones,
          battlefield: player.zones.battlefield.map(card =>
            cardTargets.has(card.instanceId)
              ? {
                  ...card,
                  plusOneCounters: card.plusOneCounters + (card.plusOneCounters > 0 ? 1 : 0),
                  minusOneCounters: card.minusOneCounters + (card.minusOneCounters > 0 ? 1 : 0),
                  loyalty: card.loyalty !== null && card.loyalty > 0 ? card.loyalty + 1 : card.loyalty,
                }
              : card
          ),
        },
      }))

      const cleaned = cleanupBattlefieldState(players)
      const next = {
        ...state,
        players: cleaned.players,
        pendingProliferateChoice: null,
        actionSeq: state.actionSeq + 1,
      }
      const withElim = checkEliminations(next)
      return {
        ...withElim,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'SET_TRIGGER_TARGET': {
      const choice = state.pendingTriggerTargetChoice
      if (!choice || choice.playerId !== action.playerId || choice.stackItemId !== action.stackItemId) return state

      if (choice.targetType === 'battlefield_creature') {
        const targetOwner = state.players.find(player =>
          player.zones.battlefield.some(entry => entry.instanceId === action.targetCardId)
        ) ?? null
        const targetCard = targetOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ?? null
        if (!targetCard || !isCreatureCard(targetCard)) return state
      } else {
        const { owner, card } = findGraveyardCard(state.players, action.targetCardId)
        if (!owner || !card || !isCreatureCard(card) || !graveyardTargetMatches(choice.targetType, action.playerId, owner.id)) return state
      }

      return {
        ...state,
        stack: state.stack.map(item =>
          item.id === action.stackItemId ? { ...item, targetCardId: action.targetCardId } : item
        ),
        pendingTriggerTargetChoice: null,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: `${state.players.find(p => p.id === action.playerId)?.name ?? 'Player'} chose a target for ${choice.sourceName}`,
          action,
          undoable: true,
        }),
      }
    }

    case 'CARD_COUNTER_CHANGE': {
      const players = state.players.map(player => {
        if (player.id !== action.playerId) return player
        return {
          ...player,
          zones: {
            ...player.zones,
            battlefield: player.zones.battlefield.map(card => {
              if (card.instanceId !== action.cardId) return card
              if (action.counter === 'plusOne') {
                return { ...card, plusOneCounters: Math.max(0, card.plusOneCounters + action.delta) }
              }
              if (action.counter === 'minusOne') {
                return { ...card, minusOneCounters: Math.max(0, card.minusOneCounters + action.delta) }
              }
              return { ...card, loyalty: Math.max(0, (card.loyalty ?? 0) + action.delta) }
            }),
          },
        }
      })
      const cleaned = cleanupBattlefieldState(players)
      const next = {
        ...state,
        players: cleaned.players,
        actionSeq: state.actionSeq + 1,
      }
      return {
        ...checkEliminations(next),
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'COMMANDER_DAMAGE': {
      const players = state.players.map(p => {
        if (p.id !== action.toId) return p
        const prev = p.commanderDamage[action.fromId] ?? 0
        return {
          ...p,
          commanderDamage: { ...p.commanderDamage, [action.fromId]: prev + action.delta },
        }
      })
      const next = { ...state, players, actionSeq: state.actionSeq + 1 }
      const withElim = checkEliminations(next)
      return {
        ...withElim,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.fromId,
          playerName: state.players.find(p => p.id === action.fromId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'COUNTER_CHANGE': {
      const players = state.players.map(p => {
        if (p.id !== action.targetId) return p
        const val = Math.max(0, (p.counters[action.counter] ?? 0) + action.delta)
        return { ...p, counters: { ...p.counters, [action.counter]: val } }
      })
      const next = { ...state, players, actionSeq: state.actionSeq + 1 }
      const withElim = checkEliminations(next)
      return {
        ...withElim,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.targetId,
          playerName: state.players.find(p => p.id === action.targetId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'SET_MONARCH': {
      const players = state.players.map(p => ({ ...p, hasMonarch: p.id === action.playerId }))
      return {
        ...state,
        players,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'CLEAR_MONARCH': {
      const players = state.players.map(p => ({ ...p, hasMonarch: false }))
      return { ...state, players, actionSeq: state.actionSeq + 1 }
    }

    case 'SET_INITIATIVE': {
      const players = state.players.map(p => ({ ...p, hasInitiative: p.id === action.playerId }))
      return {
        ...state,
        players,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'CLEAR_INITIATIVE': {
      const players = state.players.map(p => ({ ...p, hasInitiative: false }))
      return { ...state, players, actionSeq: state.actionSeq + 1 }
    }

    case 'NEXT_STEP': {
      if (state.stack.length > 0) return state
      const currentIndex = TURN_PHASES.indexOf(state.currentPhase)
      let nextState = state
      let nextPhase: TurnPhase
      let nextTurnIndex = state.currentTurnIndex
      let round = state.round

      if (currentIndex < TURN_PHASES.length - 1) {
        nextPhase = TURN_PHASES[currentIndex + 1]
      } else {
        nextTurnIndex = nextLivingTurnIndex(state)
        if (nextTurnIndex === 0 && state.turnOrder.length > 0) {
          round = state.round + 1
        }
        nextPhase = 'untap'
      }

      nextState = {
        ...state,
        currentTurnIndex: nextTurnIndex,
        currentPhase: nextPhase,
        combat: nextPhase === 'combat' ? state.combat : { attackers: [] },
        round,
        actionSeq: state.actionSeq + 1,
      }

      if (nextPhase === 'end') {
        nextState = queuePhaseTriggers(nextState, nextPhase, nextTurnIndex)
      }

      nextState = advanceThroughAutomaticPhases(nextState)
      nextState = autoDeclareRequiredAttackers(nextState)

      return {
        ...nextState,
        log: appendLog(nextState.log, {
          timestamp: new Date().toISOString(),
          playerId: '',
          playerName: '',
          description: describe(state, action),
          action,
          undoable: false,
        }),
      }
    }

    case 'SET_TURN_ORDER':
      return { ...state, turnOrder: action.order, currentTurnIndex: 0, actionSeq: state.actionSeq + 1 }

    case 'DRAW_CARD': {
      const count = Math.max(1, action.count ?? 1)
      const players = state.players.map(p => {
        if (p.id !== action.playerId) return p
        const drawn = p.zones.library.slice(0, count)
        return {
          ...p,
          zones: {
            ...p.zones,
            library: p.zones.library.slice(drawn.length),
            hand: [...p.zones.hand, ...drawn],
          },
        }
      })
      return {
        ...state,
        players,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'MULLIGAN_TAKE': {
      if (state.phase !== 'mulligan') return state

      let changed = false
      const players = state.players.map(player => {
        if (player.id !== action.playerId || player.hasKeptOpeningHand) return player

        const shuffledLibrary = shuffleCards([...player.zones.library, ...player.zones.hand])
        const nextHand = shuffledLibrary.slice(0, 7)
        const nextLibrary = shuffledLibrary.slice(7)
        changed = true

        return {
          ...player,
          mulligansTaken: player.mulligansTaken + 1,
          zones: {
            ...player.zones,
            library: nextLibrary,
            hand: nextHand,
          },
        }
      })

      if (!changed) return state

      return {
        ...state,
        players,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: false,
        }),
      }
    }

    case 'MULLIGAN_KEEP': {
      if (state.phase !== 'mulligan') return state

      let changed = false
      const players = state.players.map(player => {
        if (player.id !== action.playerId || player.hasKeptOpeningHand) return player
        changed = true
        return {
          ...player,
          hasKeptOpeningHand: true,
        }
      })

      if (!changed) return state

      const nextState = maybeFinishMulligans({
        ...state,
        players,
        actionSeq: state.actionSeq + 1,
      })

      return {
        ...nextState,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: false,
        }),
      }
    }

    case 'MULLIGAN_BOTTOM_CARD': {
      if (state.phase !== 'mulligan') return state

      let changed = false
      const players = state.players.map(player => {
        if (player.id !== action.playerId || !player.hasKeptOpeningHand || mulliganBottomsRemaining(player) <= 0) return player
        const card = player.zones.hand.find(entry => entry.instanceId === action.cardId)
        if (!card) return player
        changed = true
        return {
          ...player,
          zones: {
            ...player.zones,
            hand: player.zones.hand.filter(entry => entry.instanceId !== action.cardId),
            library: [...player.zones.library, { ...card }],
          },
        }
      })

      if (!changed) return state

      const nextState = maybeFinishMulligans({
        ...state,
        players,
        actionSeq: state.actionSeq + 1,
      })

      return {
        ...nextState,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: false,
        }),
      }
    }

    case 'RESOLVE_LAND_EFFECT': {
      const choice = state.pendingLandEffectChoice
      if (!choice || choice.playerId !== action.playerId || choice.sourceCardId !== action.sourceCardId || choice.effect !== action.effect) {
        return state
      }

      let changed = false
      const players = state.players.map(player => {
        if (action.effect === 'bounce_land') {
          if (player.id !== action.playerId || !action.targetCardId) return player
          const target = player.zones.lands.find(card => card.instanceId === action.targetCardId)
          if (!target) return player
          changed = true
          return {
            ...player,
            zones: {
              ...player.zones,
              lands: player.zones.lands.filter(card => card.instanceId !== action.targetCardId),
              hand: [...player.zones.hand, { ...target, tapped: false }],
            },
          }
        }

        if (action.effect === 'exile_graveyard') {
          if (player.id !== action.targetPlayerId) return player
          changed = true
          return {
            ...player,
            zones: {
              ...player.zones,
              exile: [...player.zones.exile, ...player.zones.graveyard],
              graveyard: [],
            },
          }
        }

        return player
      })

      if (!changed) return state

      return {
        ...state,
        players,
        pendingLandEffectChoice: null,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'MOVE_CARD': {
      const players = state.players.map(p => {
        if (p.id !== action.playerId) return p
        const fromZone = p.zones[action.from]
        const card = fromZone.find(c => c.instanceId === action.cardId)
        if (!card) return p

        const actualTo =
          (action.from === 'battlefield' || action.from === 'lands') && card.exileOnLeave && action.to !== 'battlefield' && action.to !== 'exile'
            ? 'exile'
            : action.to
        const cleanedCard = actualTo === 'battlefield' ? { ...card } : normalizeLeavingCard(card)
        const normalizedCard = actualTo === 'battlefield' ? entersBattlefield(cleanedCard) : cleanedCard

        return {
          ...p,
          zones: {
            ...p.zones,
            [action.from]: fromZone.filter(c => c.instanceId !== action.cardId),
            [actualTo]: [...p.zones[actualTo], normalizedCard],
          },
        }
      })

      return {
        ...state,
        players,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'TOGGLE_CARD_TAPPED': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (currentPlayerId !== action.playerId) return state
      const players = state.players.map(p => {
        if (p.id !== action.playerId) return p
        return {
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.map(card =>
              card.instanceId === action.cardId ? { ...card, tapped: !card.tapped } : card
            ),
            lands: p.zones.lands.map(card =>
              card.instanceId === action.cardId ? { ...card, tapped: !card.tapped } : card
            ),
          },
        }
      })
      return {
        ...state,
        players,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'ADD_MANA': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (currentPlayerId !== action.playerId) return state

      let changed = false
      const players = state.players.map(player => {
        if (player.id !== action.playerId) return player
        const land = player.zones.lands.find(card => card.instanceId === action.cardId)
        if (!land || land.tapped) return player
        const options = getLandManaOptions(land, player)
        if (!options.includes(action.color)) return player
        changed = true
        return {
          ...player,
          manaPool: { ...player.manaPool, [action.color]: player.manaPool[action.color] + 1 },
          zones: {
            ...player.zones,
            lands: player.zones.lands.map(card =>
              card.instanceId === action.cardId ? { ...card, tapped: true } : card
            ),
          },
        }
      })
      if (!changed) return state

      return {
        ...state,
        players,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'ACTIVATE_ABILITY': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (state.stack.length > 0 && state.priorityPlayerId !== action.playerId) return state
      if (state.stack.length === 0 && currentPlayerId !== action.playerId) return state

      let changed = false
      let pendingLibrarySearchChoice = state.pendingLibrarySearchChoice
      let pendingExploreChoice = state.pendingExploreChoice
      const triggerOccurrences: TriggerOccurrence[] = []
      const players = state.players.map(player => {
        if (player.id !== action.playerId) return player
        const card =
          player.zones.battlefield.find(entry => entry.instanceId === action.cardId) ??
          player.zones.lands.find(entry => entry.instanceId === action.cardId)
        if (!card) return player

        const ability = getActivatedAbilities(card, player).find(entry => entry.id === action.abilityId)
        if (!ability) return player
        if (ability.requiresTap && card.tapped) return player

        const payment = autoPayManaCost(
          player.manaPool,
          [...player.zones.lands, ...player.zones.battlefield].filter(entry => entry.instanceId !== action.cardId),
          ability.genericCost ? `{${ability.genericCost}}` : null,
          player
        )
        if ((ability.genericCost ?? 0) > 0 && !payment) return player

        changed = true

        if (ability.kind === 'add_mana') {
          const updatedSource = { ...card, tapped: ability.requiresTap ? true : card.tapped }
          const updatedCards = [
            ...player.zones.lands.map(entry => {
              if (entry.instanceId === action.cardId) return updatedSource
              return payment?.cards.find(card => card.instanceId === entry.instanceId) ?? entry
            }),
            ...player.zones.battlefield.map(entry => {
              if (entry.instanceId === action.cardId) return updatedSource
              return payment?.cards.find(card => card.instanceId === entry.instanceId) ?? entry
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

        if (ability.kind === 'explore_target_creature') {
          if (!action.targetCardId) return player
          const target = player.zones.battlefield.find(entry => entry.instanceId === action.targetCardId)
          if (!target || !isCreatureCard(target)) return player

          const sourceInBattlefield = player.zones.battlefield.some(entry => entry.instanceId === action.cardId)
          const sourceInLands = player.zones.lands.some(entry => entry.instanceId === action.cardId)
          const topCard = player.zones.library[0] ?? null
          const isTopLand = topCard ? isLandCard(topCard) : false
          if (topCard && !isTopLand) {
            pendingExploreChoice = {
              playerId: player.id,
              sourceCardId: action.cardId,
              targetCardId: action.targetCardId,
              revealedCard: { ...topCard },
            }
          }
          if (ability.sacrifice) {
            pushLeaveBattlefieldOccurrences(triggerOccurrences, player.id, card)
          }
          const paidZones = mergePaidCardsIntoZones(player, payment?.cards).zones

          const baseZones = {
            ...paidZones,
            battlefield: paidZones.battlefield
              .filter(entry => !(sourceInBattlefield && entry.instanceId === action.cardId))
              .map(entry =>
                entry.instanceId === action.targetCardId && !isTopLand
                  ? { ...entry, plusOneCounters: entry.plusOneCounters + 1 }
                  : entry
              ),
            lands: sourceInLands ? paidZones.lands.filter(entry => entry.instanceId !== action.cardId) : paidZones.lands,
            library: topCard ? player.zones.library.slice(1) : player.zones.library,
            hand: topCard && isTopLand ? [...player.zones.hand, topCard] : player.zones.hand,
          }
          return {
            ...player,
            manaPool: payment?.manaPool ?? player.manaPool,
            zones: {
              ...(ability.sacrifice ? putLeavingCardInDestination(baseZones, card) : baseZones),
            },
          }
        }

        return player
      })
      if (!changed) return state

      const nextState = queueTriggeredAbilities({
        ...state,
        players,
        pendingLibrarySearchChoice,
        pendingExploreChoice,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: `${state.players.find(p => p.id === action.playerId)?.name ?? 'Player'} activated an ability`,
          action,
          undoable: true,
        }),
      }, triggerOccurrences)

      return nextState
    }

    case 'ACTIVATE_PLANESWALKER_ABILITY': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (currentPlayerId !== action.playerId || !isMainPhase(state.currentPhase) || state.stack.length > 0) return state

      const player = state.players.find(entry => entry.id === action.playerId)
      const card = player?.zones.battlefield.find(entry => entry.instanceId === action.cardId)
      if (!player || !card || !isPlaneswalkerCard(card) || card.loyaltyActivatedThisTurn) return state

      const ability = getPlaneswalkerAbilities(card).find(entry => entry.id === action.abilityId)
      if (!ability) return state
      if ((card.loyalty ?? 0) + ability.loyaltyDelta < 0) return state

      const targetBattlefieldOwner = action.targetCardId
        ? state.players.find(entry =>
            entry.zones.battlefield.some(card => card.instanceId === action.targetCardId) ||
            entry.zones.lands.some(card => card.instanceId === action.targetCardId)
          ) ?? null
        : null

      if (ability.target === 'battlefield_creature') {
        const target = targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ?? null
        if (!target || !isCreatureCard(target)) return state
      }
      if (ability.target === 'battlefield_nonland_permanent') {
        const target = targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ?? null
        if (!target || !isNonlandPermanent(target)) return state
      }
      if (ability.target === 'battlefield_permanent') {
        const target =
          targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ??
          targetBattlefieldOwner?.zones.lands.find(entry => entry.instanceId === action.targetCardId) ??
          null
        if (!target || (!isPermanentCard(target) && !isLandCard(target))) return state
      }
      if (ability.target === 'own_graveyard_creature') {
        const target = player.zones.graveyard.find(entry => entry.instanceId === action.targetCardId) ?? null
        if (!target || !isCreatureCard(target)) return state
      }
      if (ability.target === 'any_graveyard_creature' || ability.target === 'opponent_graveyard_creature') {
        const { owner, card: target } = findGraveyardCard(state.players, action.targetCardId)
        if (!owner || !target || !isCreatureCard(target) || !graveyardTargetMatches(ability.target, action.playerId, owner.id)) return state
      }
      if (ability.target === 'creature_or_player' && !action.targetPlayerId) {
        const target = targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ?? null
        if (!target || (!isCreatureCard(target) && !isPlaneswalkerCard(target))) return state
      }

      const targetedBattlefieldCard =
        targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ??
        targetBattlefieldOwner?.zones.lands.find(entry => entry.instanceId === action.targetCardId) ??
        null
      const targetingRestriction = validateTargetingRestriction(state.players, action.playerId, targetBattlefieldOwner?.id ?? null, targetedBattlefieldCard)
      if (!targetingRestriction.allowed) return state

      let wardPaymentCards: GameCard[] | undefined
      let manaPool = player.manaPool
      if (targetingRestriction.extraManaCost) {
        const payment = autoPayManaCost(player.manaPool, [...player.zones.lands, ...player.zones.battlefield], targetingRestriction.extraManaCost, player)
        if (!payment) return state
        wardPaymentCards = payment.cards
        manaPool = payment.manaPool
      }

      let players = state.players.map(entry =>
        entry.id === action.playerId
          ? {
              ...entry,
              manaPool,
              zones: {
                ...mergePaidCardsIntoZones(entry, wardPaymentCards).zones,
                battlefield: mergePaidCardsIntoZones(entry, wardPaymentCards).zones.battlefield.map(battlefieldCard =>
                  battlefieldCard.instanceId === action.cardId
                    ? {
                        ...battlefieldCard,
                        loyalty: (battlefieldCard.loyalty ?? 0) + ability.loyaltyDelta,
                        loyaltyActivatedThisTurn: true,
                      }
                    : battlefieldCard
                ),
              },
            }
          : entry
      )

      let triggerOccurrences: TriggerOccurrence[] = []
      let manualOnly = !ability.supported || !ability.effect
      if (ability.supported && ability.effect) {
        const resolved = applyPlaneswalkerEffect(players, action.playerId, ability.effect, action.targetCardId, action.targetPlayerId)
        players = resolved.players
        triggerOccurrences = resolved.triggerOccurrences
        manualOnly = false
      }

      const cleaned = cleanupBattlefieldState(players)
      triggerOccurrences.push(...cleaned.triggerOccurrences)

      const nextState = queueTriggeredAbilities({
        ...state,
        players: cleaned.players,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: player.name,
          description: manualOnly
            ? `${player.name} activated ${card.name} — apply effect manually`
            : describe(state, action),
          action,
          undoable: true,
        }),
      }, triggerOccurrences)

      return checkEliminations(nextState)
    }

    case 'PLAY_LAND': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (currentPlayerId !== action.playerId || !isMainPhase(state.currentPhase)) return state

      let changed = false
      let pendingLandEffectChoice = state.pendingLandEffectChoice
      const triggerOccurrences: TriggerOccurrence[] = []
      const players = state.players.map(player => {
        if (player.id !== action.playerId || player.landsPlayedThisTurn >= 1) return player
        const card = player.zones.hand.find(c => c.instanceId === action.cardId)
        if (!card || !isLandCard(card)) return player
        const entryEffect = getLandEntryEffect(card)
        const basicLandsControlled = player.zones.lands.filter(land => land.typeLine.toLowerCase().includes('basic')).length
        const playedLand = { ...card, tapped: landEntersTapped(card, { basicLandsControlled }) }

        if (entryEffect?.kind === 'bounce_land' || entryEffect?.kind === 'exile_graveyard') {
          pendingLandEffectChoice = {
            playerId: player.id,
            sourceCardId: action.cardId,
            sourceName: card.name,
            effect: entryEffect.kind,
          }
        }
        changed = true
        triggerOccurrences.push({ type: 'land_enters', controllerId: player.id, card: playedLand })
        return {
          ...player,
          landsPlayedThisTurn: player.landsPlayedThisTurn + 1,
          life: entryEffect?.kind === 'gain_life' && playerCanGainLife(state.players, player.id)
            ? player.life + entryEffect.amount
            : player.life,
          zones: {
            ...player.zones,
            hand: player.zones.hand.filter(c => c.instanceId !== action.cardId),
            lands: [...player.zones.lands, playedLand],
          },
        }
      })
      if (!changed) return state

      return queueTriggeredAbilities({
        ...state,
        players,
        pendingLandEffectChoice,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }, triggerOccurrences)
    }

    case 'CAST_COMMANDER': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (state.stack.length > 0 && state.priorityPlayerId !== action.playerId) return state
      if (state.stack.length === 0 && (currentPlayerId !== action.playerId || !isMainPhase(state.currentPhase))) return state

      let nextState = state
      let changed = false
      let spentMana = emptyManaPool()
      const players = state.players.map(player => {
        if (player.id !== action.playerId) return player
        const card = player.zones.commandZone.find(c => c.instanceId === action.cardId)
        if (!card) return player
        const payment = autoPayManaCost(player.manaPool, [...player.zones.lands, ...player.zones.battlefield], card.manaCost, player, action.options)
        if (!payment) return player
        changed = true
        spentMana = payment.spent
        return {
          ...player,
          manaPool: payment.manaPool,
          zones: {
            ...player.zones,
            ...applyTappedManaCards(player, payment.cards).zones,
            commandZone: player.zones.commandZone.filter(c => c.instanceId !== action.cardId),
          },
        }
      })
      if (!changed) return state

      nextState = pushStackItem(
        {
          ...state,
          players,
        },
        {
          card: withCastOptions(state.players.find(p => p.id === action.playerId)?.zones.commandZone.find(c => c.instanceId === action.cardId)!, action.options?.xValue),
          casterId: action.playerId,
          casterName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          source: 'commandZone',
          kind: 'commander',
          castOptions: action.options,
          spentMana,
        }
      )
      nextState = queueTriggeredAbilities(nextState, [{ type: 'spell_cast', controllerId: action.playerId, card: withCastOptions(state.players.find(p => p.id === action.playerId)?.zones.commandZone.find(c => c.instanceId === action.cardId)!, action.options?.xValue) }])

      return {
        ...nextState,
        stack: nextState.stack,
        players: nextState.players,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'CAST_PERMANENT': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (state.stack.length > 0 && state.priorityPlayerId !== action.playerId) return state
      if (state.stack.length === 0 && (currentPlayerId !== action.playerId || !isMainPhase(state.currentPhase))) return state

      const originalCard = state.players.find(p => p.id === action.playerId)?.zones.hand.find(c => c.instanceId === action.cardId)
      let changed = false
      let spentMana = emptyManaPool()
      const players = state.players.map(player => {
        if (player.id !== action.playerId) return player
        const card = player.zones.hand.find(c => c.instanceId === action.cardId)
        if (!card || isLandCard(card) || !isPermanentCard(card)) return player
        const payment = autoPayManaCost(player.manaPool, [...player.zones.lands, ...player.zones.battlefield], card.manaCost, player, action.options)
        if (!payment) return player
        changed = true
        spentMana = payment.spent
        return {
          ...player,
          manaPool: payment.manaPool,
          zones: {
            ...player.zones,
            ...applyTappedManaCards(player, payment.cards).zones,
            hand: player.zones.hand.filter(c => c.instanceId !== action.cardId),
          },
        }
      })
      if (!changed) return state

      let nextState = pushStackItem(
        {
          ...state,
          players,
        },
        {
          card: withCastOptions(originalCard!, action.options?.xValue),
          casterId: action.playerId,
          casterName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          source: 'hand',
          kind: 'permanent',
          castOptions: action.options,
          spentMana,
        }
      )
      nextState = queueTriggeredAbilities(nextState, [{ type: 'spell_cast', controllerId: action.playerId, card: withCastOptions(originalCard!, action.options?.xValue) }])

      return {
        ...nextState,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'CAST_SPELL': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (state.stack.length > 0 && state.priorityPlayerId !== action.playerId) return state
      if (state.stack.length === 0 && (currentPlayerId !== action.playerId || !isMainPhase(state.currentPhase))) return state

      const caster = state.players.find(player => player.id === action.playerId)
      const card = caster?.zones.hand.find(entry => entry.instanceId === action.cardId)
      if (!caster || !card || isPermanentCard(card) || isLandCard(card)) return state

      const definition = getSimpleSpellDefinition(card)
      const supportsCustomChoiceSpell = ["Black Sun's Zenith", 'Painful Truths', 'Deadly Dispute', 'Cathartic Pyre'].includes(card.name)
      if (!definition && !supportsCustomChoiceSpell) return state

      const targetPlayer = action.targetPlayerId
        ? state.players.find(player => player.id === action.targetPlayerId) ?? null
        : null
      const targetBattlefieldOwner = action.targetCardId
        ? state.players.find(player =>
            player.zones.battlefield.some(entry => entry.instanceId === action.targetCardId) ||
            player.zones.lands.some(entry => entry.instanceId === action.targetCardId)
          ) ?? null
        : null

      if (definition?.target === 'battlefield_creature') {
        const targetCard =
          targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ?? null
        if (!targetCard || !isCreatureCard(targetCard)) return state
      }

      if (definition?.target === 'battlefield_nonland_permanent') {
        const targetCard =
          targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ?? null
        if (!targetCard || !isNonlandPermanent(targetCard)) return state
      }

      if (definition?.target === 'battlefield_permanent') {
        const targetCard =
          targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ??
          targetBattlefieldOwner?.zones.lands.find(entry => entry.instanceId === action.targetCardId) ??
          null
        if (!targetCard || (!isPermanentCard(targetCard) && !isLandCard(targetCard))) return state
      }

      if (definition?.target === 'own_graveyard_creature') {
        const targetCard = caster.zones.graveyard.find(entry => entry.instanceId === action.targetCardId) ?? null
        if (!targetCard || !isCreatureCard(targetCard)) return state
      }
      if (definition?.target === 'any_graveyard_creature' || definition?.target === 'opponent_graveyard_creature') {
        const { owner, card: targetCard } = findGraveyardCard(state.players, action.targetCardId)
        if (!owner || !targetCard || !isCreatureCard(targetCard) || !graveyardTargetMatches(definition.target, action.playerId, owner.id)) return state
      }

      if (definition?.target === 'creature_or_player' && !targetPlayer) {
        const targetCard =
          targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ?? null
        if (!targetCard || (!isCreatureCard(targetCard) && !isPlaneswalkerCard(targetCard))) return state
      }

      if (card.name === "Black Sun's Zenith" && typeof action.options?.xValue !== 'number') return state
      if (card.name === 'Deadly Dispute') {
        const sacrificed = [...caster.zones.battlefield, ...caster.zones.lands].find(entry => entry.instanceId === action.options?.sacrificedCardId)
        const typeLine = sacrificed?.typeLine.toLowerCase() ?? ''
        if (!sacrificed || (!typeLine.includes('artifact') && !typeLine.includes('creature'))) return state
      }
      if (card.name === 'Cathartic Pyre') {
        if (action.options?.mode !== 'damage' && action.options?.mode !== 'loot') return state
        if (action.options.mode === 'damage') {
          const targetCard = targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ?? null
          if (!targetCard || (!isCreatureCard(targetCard) && !isPlaneswalkerCard(targetCard))) return state
        }
        if (action.options.mode === 'loot') {
          const discardIds = action.options.selectedCardIds ?? []
          if (discardIds.length > 2) return state
          if (!discardIds.every(id => caster.zones.hand.some(entry => entry.instanceId === id && entry.instanceId !== action.cardId))) return state
        }
      }

      const targetedBattlefieldCard =
        targetBattlefieldOwner?.zones.battlefield.find(entry => entry.instanceId === action.targetCardId) ??
        targetBattlefieldOwner?.zones.lands.find(entry => entry.instanceId === action.targetCardId) ??
        null
      const targetingRestriction = validateTargetingRestriction(state.players, action.playerId, targetBattlefieldOwner?.id ?? null, targetedBattlefieldCard)
      if (!targetingRestriction.allowed) return state

      const manaCost = appendGenericManaCost(card.manaCost, targetingRestriction.extraManaCost ? Number(targetingRestriction.extraManaCost.replace(/[{}]/g, '')) : 0)
      if (!canAutoPayManaCost(caster.manaPool, [...caster.zones.lands, ...caster.zones.battlefield], manaCost, caster, action.options)) return state

      let spentMana = emptyManaPool()
      let sacrificedCard: GameCard | null = null
      const players = state.players.map(player => {
        if (player.id !== action.playerId) return player
        const payment = autoPayManaCost(player.manaPool, [...player.zones.lands, ...player.zones.battlefield], manaCost, player, action.options)
        if (!payment) return player
        spentMana = payment.spent
        const paidZones = applyTappedManaCards(player, payment.cards).zones
        const sacTarget = action.options?.sacrificedCardId
          ? [...player.zones.battlefield, ...player.zones.lands].find(entry => entry.instanceId === action.options?.sacrificedCardId) ?? null
          : null
        if (sacTarget) {
          sacrificedCard = sacTarget
        }
        const withoutSacrifice = sacTarget
          ? removeCardFromBattlefieldOrLands({ ...player, zones: paidZones }, sacTarget.instanceId)
          : paidZones
        const zonesAfterSacrifice = sacTarget
          ? putLeavingCardInDestination(withoutSacrifice, sacTarget)
          : withoutSacrifice
        return {
          ...player,
          manaPool: payment.manaPool,
          zones: {
            ...zonesAfterSacrifice,
            hand: player.zones.hand.filter(entry => entry.instanceId !== action.cardId),
          },
        }
      })

      let nextState = pushStackItem(
        {
          ...state,
          players,
        },
        {
          card: withCastOptions(card, action.options?.xValue),
          casterId: action.playerId,
          casterName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          source: 'hand',
          kind: 'spell',
          targetCardId: action.targetCardId,
          targetPlayerId: action.targetPlayerId,
          castOptions: action.options,
          spentMana,
        }
      )
      const occurrences: TriggerOccurrence[] = [{ type: 'spell_cast', controllerId: action.playerId, card: withCastOptions(card, action.options?.xValue) }]
      if (sacrificedCard) {
        pushLeaveBattlefieldOccurrences(occurrences, action.playerId, sacrificedCard)
      }
      nextState = queueTriggeredAbilities(nextState, occurrences)

      return {
        ...nextState,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'DECLARE_ATTACKER': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (currentPlayerId !== action.playerId || state.currentPhase !== 'combat') return state

      const activePlayer = state.players.find(p => p.id === action.playerId)
      const attacker = activePlayer?.zones.battlefield.find(c => c.instanceId === action.cardId)
      const defender = state.players.find(p => p.id === action.defendingPlayerId)
      const defendingPlaneswalker = action.defendingCardId
        ? defender?.zones.battlefield.find(c => c.instanceId === action.defendingCardId) ?? null
        : null
      if (!attacker || !defender || attacker.tapped || attacker.summoningSick || !isCreatureCard(attacker)) return state
      if (!canCreatureAttack(state.players, action.playerId, attacker)) return state
      if (action.defendingPlayerId === action.playerId || defender.isEliminated) return state
      if (action.defendingCardId && (!defendingPlaneswalker || !isPlaneswalkerCard(defendingPlaneswalker))) return state

      const nextState = queueTriggeredAbilities({
        ...state,
        players: state.players.map(player =>
          player.id === action.playerId
            ? {
                ...player,
                zones: {
                  ...player.zones,
                  battlefield: player.zones.battlefield.map(card =>
                    card.instanceId === action.cardId
                      ? { ...card, tapped: hasKeyword(state.players, action.playerId, card, 'vigilance') ? card.tapped : true }
                      : card
                  ),
                },
              }
            : player
        ),
        combat: {
          attackers: [
            ...state.combat.attackers.filter(a => a.attackerId !== action.cardId),
            {
              attackerId: action.cardId,
              attackerName: attacker.name,
              attackingPlayerId: action.playerId,
              defendingPlayerId: action.defendingPlayerId,
              defendingCardId: action.defendingCardId,
              blockerIds: [],
            },
          ],
        },
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: activePlayer?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }, [{ type: 'attacks', controllerId: action.playerId, card: attacker }])

      return nextState
    }

    case 'REMOVE_ATTACKER': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (currentPlayerId !== action.playerId || state.currentPhase !== 'combat') return state
      const exists = state.combat.attackers.some(a => a.attackerId === action.cardId && a.attackingPlayerId === action.playerId)
      if (!exists) return state

      return {
        ...state,
        players: state.players.map(player =>
          player.id === action.playerId
            ? {
                ...player,
                zones: {
                  ...player.zones,
                  battlefield: player.zones.battlefield.map(card =>
                    card.instanceId === action.cardId ? { ...card, tapped: false } : card
                  ),
                },
              }
            : player
        ),
        combat: {
          attackers: state.combat.attackers.filter(a => a.attackerId !== action.cardId),
        },
        actionSeq: state.actionSeq + 1,
      }
    }

    case 'ASSIGN_BLOCKER': {
      if (state.currentPhase !== 'combat') return state
      const blockerPlayer = state.players.find(p => p.id === action.playerId)
      const blocker = blockerPlayer?.zones.battlefield.find(c => c.instanceId === action.blockerId)
      const targetAttack = state.combat.attackers.find(a => a.attackerId === action.attackerId)
      const attackerOwner = targetAttack ? state.players.find(p => p.id === targetAttack.attackingPlayerId) : null
      const attacker = attackerOwner?.zones.battlefield.find(c => c.instanceId === action.attackerId) ?? null
      if (!blocker || !targetAttack || !isCreatureCard(blocker)) return state
      if (!attacker || !isCreatureCard(attacker)) return state
      if (targetAttack.defendingPlayerId !== action.playerId) return state
      if (state.combat.attackers.some(attack => attack.attackerId !== action.attackerId && attack.blockerIds.includes(action.blockerId))) return state
      if (!canBlockAttacker(state.players, action.playerId, blocker, targetAttack.attackingPlayerId, attacker)) return state

      return {
        ...state,
        combat: {
          attackers: state.combat.attackers.map(attack =>
            attack.attackerId === action.attackerId
              ? { ...attack, blockerIds: [...attack.blockerIds.filter(id => id !== action.blockerId), action.blockerId] }
              : attack
          ),
        },
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: blockerPlayer?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'REMOVE_BLOCKER': {
      if (state.currentPhase !== 'combat') return state
      return {
        ...state,
        combat: {
          attackers: state.combat.attackers.map(attack =>
            attack.attackerId === action.attackerId
              ? { ...attack, blockerIds: attack.blockerIds.filter(id => id !== action.blockerId) }
              : attack
          ),
        },
        actionSeq: state.actionSeq + 1,
      }
    }

    case 'RESOLVE_COMBAT': {
      if (state.currentPhase !== 'combat') return state

      let players = state.players.map(player => ({
        ...player,
        zones: {
          ...player.zones,
          battlefield: player.zones.battlefield.map(card => ({ ...card })),
        },
      }))
      const hasFirstStrikeStep = state.combat.attackers.some(attack => {
        const attacker = players.find(player => player.id === attack.attackingPlayerId)?.zones.battlefield.find(card => card.instanceId === attack.attackerId)
        if (attacker && hasFirstStrikeDamage(players, attack.attackingPlayerId, attacker)) return true
        return attack.blockerIds.some(blockerId => {
          const blockerController = findBattlefieldController(players, blockerId)
          const blocker = blockerController?.zones.battlefield.find(card => card.instanceId === blockerId)
          return Boolean(blocker && blockerController && hasFirstStrikeDamage(players, blockerController.id, blocker))
        })
      })

      let triggerOccurrences: TriggerOccurrence[] = []
      if (hasFirstStrikeStep) {
        players = resolveCombatDamageStep(players, state.combat.attackers, {
          attackerCanDeal: hasFirstStrikeDamage,
          blockerCanDeal: hasFirstStrikeDamage,
        })
        const cleanedFirst = cleanupBattlefieldState(players)
        players = cleanedFirst.players
        triggerOccurrences = [...triggerOccurrences, ...cleanedFirst.triggerOccurrences]
      }

      players = resolveCombatDamageStep(players, state.combat.attackers, {
        attackerCanDeal: hasNormalCombatDamage,
        blockerCanDeal: hasNormalCombatDamage,
      })

      const cleaned = cleanupBattlefieldState(players)
      triggerOccurrences = [...triggerOccurrences, ...cleaned.triggerOccurrences]

      const next = queueTriggeredAbilities({
        ...state,
        players: cleaned.players.map(player => ({ ...player, manaPool: emptyManaPool() })),
        currentPhase: 'main2' as const,
        combat: { attackers: [] },
        actionSeq: state.actionSeq + 1,
      }, triggerOccurrences)
      const withElim = checkEliminations(next)
      return {
        ...withElim,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: '',
          playerName: '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'RESOLVE_STACK': {
      if (state.stack.length === 0) return state
      const next = resolveStackTop(state)
      return {
        ...next,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: '',
          playerName: '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'PASS_PRIORITY': {
      if (state.stack.length === 0) return state
      if (state.priorityPlayerId !== action.playerId) return state

      const livingPlayers = livingTurnOrder(state)
      const passedIds = [...new Set([...state.priorityPassedIds, action.playerId])]

      if (passedIds.length >= livingPlayers.length) {
        const resolved = resolveStackTop(state)
        return {
          ...resolved,
          log: appendLog(state.log, {
            timestamp: new Date().toISOString(),
            playerId: action.playerId,
            playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
            description: describe(state, action),
            action,
            undoable: true,
          }),
        }
      }

      return {
        ...state,
        priorityPlayerId: nextLivingPlayerIdAfter(state, action.playerId),
        priorityPassedIds: passedIds,
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: true,
        }),
      }
    }

    case 'PLAYER_JOIN': {
      const exists = state.players.some(p => p.id === action.player.id)
      if (exists) {
        return {
          ...state,
          players: state.players.map(p => p.id === action.player.id ? { ...p, isConnected: true } : p)
        }
      }
      return {
        ...state,
        players: [...state.players, action.player],
        turnOrder: [...state.turnOrder, action.player.id],
        actionSeq: state.actionSeq + 1,
      }
    }

    case 'PLAYER_CONNECTED':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, isConnected: action.connected } : p
        ),
      }

    case 'PLAYER_ELIMINATE':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, isEliminated: true } : p
        ),
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: action.playerId,
          playerName: state.players.find(p => p.id === action.playerId)?.name ?? '',
          description: describe(state, action),
          action,
          undoable: false,
        }),
      }

    case 'SET_COMMANDER':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, commander: action.commander } : p
        ),
      }

    case 'SET_DECK':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId
            ? { ...p, deck: action.deck, commander: action.commander ?? p.commander }
            : p
        ),
      }

    case 'SET_PLAYER_NAME':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, name: action.name } : p
        ),
      }

    case 'GAME_START': {
      clearUndo(state.roomId)
      return {
        ...state,
        phase: 'mulligan',
        hostControlsAllPlayers: action.hostControlsAllPlayers ?? false,
        players: state.players.map(initializePlayerForGame),
        currentTurnIndex: 0,
        currentPhase: 'untap',
        combat: { attackers: [] },
        stack: [],
        pendingLandEffectChoice: null,
        pendingLibrarySearchChoice: null,
        pendingExploreChoice: null,
        pendingProliferateChoice: null,
        pendingTriggerTargetChoice: null,
        priorityPlayerId: null,
        priorityPassedIds: [],
        actionSeq: state.actionSeq + 1,
        log: appendLog(state.log, {
          timestamp: new Date().toISOString(),
          playerId: '',
          playerName: '',
          description: 'Game started',
          action,
          undoable: false,
        }),
      }
    }

    case 'RESET_GAME': {
      clearUndo(state.roomId)
      return {
        ...state,
        phase: 'mulligan',
        hostControlsAllPlayers: state.hostControlsAllPlayers,
        players: state.players.map(initializePlayerForGame),
        currentTurnIndex: 0,
        currentPhase: 'untap',
        combat: { attackers: [] },
        stack: [],
        pendingLandEffectChoice: null,
        pendingLibrarySearchChoice: null,
        pendingExploreChoice: null,
        pendingProliferateChoice: null,
        pendingTriggerTargetChoice: null,
        priorityPlayerId: null,
        priorityPassedIds: [],
        round: 1,
        log: [],
        actionSeq: state.actionSeq + 1,
      }
    }

    case 'UNDO': {
      const previous = popUndo(state.roomId)
      if (!previous) return state
      return { ...previous, actionSeq: state.actionSeq + 1 }
    }

    default:
      return state
  }
}
