import type { ColorSymbol, GameCard, ManaPool, Player, TokenTemplateKey } from '@/types/game-state'

const COLOR_ORDER: ColorSymbol[] = ['W', 'U', 'B', 'R', 'G', 'C']
const BASIC_LAND_TYPES: Array<{ pattern: RegExp; color: ColorSymbol }> = [
  { pattern: /\bplains\b/i, color: 'W' },
  { pattern: /\bisland\b/i, color: 'U' },
  { pattern: /\bswamp\b/i, color: 'B' },
  { pattern: /\bmountain\b/i, color: 'R' },
  { pattern: /\bforest\b/i, color: 'G' },
]

export type SimpleSpellDefinition =
  | { kind: 'draw_cards'; amount: number; loseLife?: number; target: 'none' }
  | { kind: 'create_tokens'; tokenKey: TokenTemplateKey; count: number | 'opponents'; tapped?: boolean; target: 'none' }
  | { kind: 'proliferate'; target: 'none' }
  | { kind: 'destroy_target_creature'; target: 'battlefield_creature' }
  | { kind: 'destroy_target_nonland_permanent'; target: 'battlefield_nonland_permanent' }
  | { kind: 'destroy_target_permanent'; target: 'battlefield_permanent' }
  | { kind: 'damage_target_creature'; amount: number; target: 'battlefield_creature' }
  | { kind: 'damage_target_creature_or_player'; amount: number; target: 'creature_or_player' }
  | { kind: 'put_minus_one_counter_target_creature'; amount: number; target: 'battlefield_creature' }
  | { kind: 'put_minus_one_counters_each_creature'; amount: number; target: 'none' }
  | { kind: 'mass_damage_creatures'; amount: number | 'creature_count'; target: 'none' }
  | { kind: 'return_graveyard_creature_to_battlefield'; target: 'own_graveyard_creature' }
  | { kind: 'return_graveyard_creature_to_hand'; target: 'own_graveyard_creature' }

export type ActivatedAbilityDefinition =
  | { id: string; label: string; kind: 'add_mana'; color: ColorSymbol; amount: number; requiresTap: boolean; sacrifice?: boolean; genericCost?: number }
  | { id: string; label: string; kind: 'draw_card'; requiresTap: boolean; sacrifice: boolean; genericCost: number }
  | { id: string; label: string; kind: 'gain_life'; requiresTap: boolean; sacrifice: boolean; genericCost: number; amount: number }
  | { id: string; label: string; kind: 'explore_target_creature'; requiresTap: boolean; sacrifice: boolean; genericCost: number }
  | { id: string; label: string; kind: 'untap_self_add_minus_one_counter'; requiresTap: boolean; genericCost?: number }
  | { id: string; label: string; kind: 'remove_minus_one_counter_add_mana'; color: ColorSymbol; amount: number; requiresTap: boolean; genericCost?: number }

export type PlaneswalkerAbilityEffect =
  | SimpleSpellDefinition
  | { kind: 'put_minus_one_counter_target_creature'; amount: number; target: 'battlefield_creature' }

export interface PlaneswalkerAbilityDefinition {
  id: string
  label: string
  loyaltyDelta: number
  target: 'none' | 'battlefield_creature' | 'battlefield_nonland_permanent' | 'battlefield_permanent' | 'creature_or_player' | 'own_graveyard_creature'
  effect: PlaneswalkerAbilityEffect | null
  supported: boolean
}

export type TriggerEventType =
  | 'enters_battlefield'
  | 'land_enters'
  | 'creature_enters'
  | 'token_created'
  | 'token_sacrificed'
  | 'minus_one_counters_placed'
  | 'attacks'
  | 'creature_dies'
  | 'upkeep'
  | 'end_step'
  | 'spell_cast'

export type TriggerEffectDefinition =
  | { kind: 'create_tokens'; tokenKey: TokenTemplateKey; count: number | 'opponents'; tapped?: boolean }
  | { kind: 'create_tokens_from_counter_placement'; tokenKey: TokenTemplateKey; mode: 'once' | 'per_counter'; tapped?: boolean }
  | { kind: 'draw_cards'; amount: number }
  | { kind: 'gain_life'; amount: number }
  | { kind: 'proliferate' }
  | { kind: 'drain_each_opponent'; amount: number; gainLife: number }

export interface TriggeredAbilityDefinition {
  id: string
  label: string
  event: TriggerEventType
  effect: TriggerEffectDefinition
  match:
    | 'self'
    | 'another_creature_you_control'
    | 'any_creature'
    | 'your_upkeep'
    | 'each_upkeep'
    | 'your_end_step'
    | 'land_you_control_enters'
    | 'spell_you_cast'
    | 'another_creature_you_control_enters'
    | 'token_you_create'
    | 'token_you_create_or_sacrifice'
    | 'minus_one_counters_you_put_on_creature'
}

export type LandEntryEffectDefinition =
  | { kind: 'gain_life'; amount: number }
  | { kind: 'bounce_land' }
  | { kind: 'exile_graveyard' }

export interface TokenTemplate {
  key: TokenTemplateKey
  name: string
  typeLine: string
  oracleText: string | null
  colorIdentity: ColorSymbol[]
  power: number | null
  toughness: number | null
}

const TOKEN_TEMPLATES: Record<TokenTemplateKey, TokenTemplate> = {
  treasure: {
    key: 'treasure',
    name: 'Treasure',
    typeLine: 'Token Artifact — Treasure',
    oracleText: '{T}, Sacrifice this artifact: Add one mana of any color.',
    colorIdentity: [],
    power: null,
    toughness: null,
  },
  food: {
    key: 'food',
    name: 'Food',
    typeLine: 'Token Artifact — Food',
    oracleText: '{2}, {T}, Sacrifice this artifact: You gain 3 life.',
    colorIdentity: [],
    power: null,
    toughness: null,
  },
  clue: {
    key: 'clue',
    name: 'Clue',
    typeLine: 'Token Artifact — Clue',
    oracleText: '{2}, Sacrifice this artifact: Draw a card.',
    colorIdentity: [],
    power: null,
    toughness: null,
  },
  map: {
    key: 'map',
    name: 'Map',
    typeLine: 'Token Artifact — Map',
    oracleText: '{1}, {T}, Sacrifice this artifact: Target creature you control explores. Activate only as a sorcery.',
    colorIdentity: [],
    power: null,
    toughness: null,
  },
  squirrel: {
    key: 'squirrel',
    name: 'Squirrel',
    typeLine: 'Token Creature — Squirrel',
    oracleText: null,
    colorIdentity: ['G'],
    power: 1,
    toughness: 1,
  },
  rat: {
    key: 'rat',
    name: 'Rat',
    typeLine: 'Token Creature — Rat',
    oracleText: null,
    colorIdentity: ['B'],
    power: 1,
    toughness: 1,
  },
  insect: {
    key: 'insect',
    name: 'Insect',
    typeLine: 'Token Creature — Insect',
    oracleText: null,
    colorIdentity: ['G'],
    power: 1,
    toughness: 1,
  },
  zombie: {
    key: 'zombie',
    name: 'Zombie',
    typeLine: 'Token Creature — Zombie',
    oracleText: null,
    colorIdentity: ['B'],
    power: 2,
    toughness: 2,
  },
  snake: {
    key: 'snake',
    name: 'Snake',
    typeLine: 'Token Creature — Snake',
    oracleText: null,
    colorIdentity: ['G'],
    power: 1,
    toughness: 1,
  },
  pest: {
    key: 'pest',
    name: 'Pest',
    typeLine: 'Token Creature — Pest',
    oracleText: 'When this creature dies, you gain 1 life.',
    colorIdentity: ['B', 'G'],
    power: 1,
    toughness: 1,
  },
  saproling: {
    key: 'saproling',
    name: 'Saproling',
    typeLine: 'Token Creature — Saproling',
    oracleText: null,
    colorIdentity: ['G'],
    power: 1,
    toughness: 1,
  },
  worm: {
    key: 'worm',
    name: 'Worm',
    typeLine: 'Token Creature — Worm',
    oracleText: null,
    colorIdentity: ['B', 'G'],
    power: 1,
    toughness: 1,
  },
  wolf: {
    key: 'wolf',
    name: 'Wolf',
    typeLine: 'Token Creature — Wolf',
    oracleText: 'When this creature dies, you gain 1 life.',
    colorIdentity: ['B', 'G'],
    power: 2,
    toughness: 2,
  },
}

export function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
}

export function getTokenTemplate(key: TokenTemplateKey): TokenTemplate {
  return TOKEN_TEMPLATES[key]
}

export function formatManaPool(pool: ManaPool): string {
  const entries = COLOR_ORDER
    .map(color => (pool[color] > 0 ? `${color}${pool[color]}` : null))
    .filter((value): value is string => value !== null)
  return entries.length > 0 ? entries.join(' ') : 'Empty'
}

export function parseManaCost(manaCost: string | null): { colored: ManaPool; generic: number } {
  const colored = emptyManaPool()
  let generic = 0
  if (!manaCost) return { colored, generic }

  const symbols = manaCost.match(/\{[^}]+\}/g) ?? []
  for (const symbol of symbols) {
    const value = symbol.replace(/[{}]/g, '')
    if (value in colored) {
      colored[value as ColorSymbol] += 1
      continue
    }
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
      generic += numeric
      continue
    }
    if (value === 'X') generic += 0
  }
  return { colored, generic }
}

export function canPayManaCost(pool: ManaPool, manaCost: string | null): boolean {
  const payment = spendManaCost(pool, manaCost)
  return payment !== null
}

export function canAutoPayManaCost(
  pool: ManaPool,
  manaCards: GameCard[],
  manaCost: string | null,
  player: Pick<Player, 'commander'>
): boolean {
  return autoPayManaCost(pool, manaCards, manaCost, player) !== null
}

export function spendManaCost(pool: ManaPool, manaCost: string | null): ManaPool | null {
  const { colored, generic } = parseManaCost(manaCost)
  const next = { ...pool }

  for (const color of COLOR_ORDER) {
    if (next[color] < colored[color]) return null
    next[color] -= colored[color]
  }

  let genericLeft = generic
  for (const color of COLOR_ORDER) {
    if (genericLeft <= 0) break
    const spend = Math.min(next[color], genericLeft)
    next[color] -= spend
    genericLeft -= spend
  }

  return genericLeft === 0 ? next : null
}

export function autoPayManaCost(
  pool: ManaPool,
  manaCards: GameCard[],
  manaCost: string | null,
  player: Pick<Player, 'commander'>
): { manaPool: ManaPool; cards: GameCard[] } | null {
  const directPayment = spendManaCost(pool, manaCost)
  if (directPayment) {
    return { manaPool: directPayment, cards: manaCards }
  }

  const untappedManaCards = manaCards
    .filter(card => !card.tapped)
    .map(card => ({
      card,
      abilities: getActivatedAbilities(card, player).filter(
        (ability): ability is Extract<ActivatedAbilityDefinition, { kind: 'add_mana' }> => ability.kind === 'add_mana'
      ),
    }))
    .filter(entry => entry.abilities.length > 0)
    .sort((a, b) => {
      const aIsLand = a.card.typeLine.toLowerCase().includes('land')
      const bIsLand = b.card.typeLine.toLowerCase().includes('land')
      if (aIsLand !== bIsLand) return aIsLand ? -1 : 1
      return a.abilities.length - b.abilities.length
    })

  // Cap search to avoid exponential blowup on large boards with many duals.
  // Beyond this limit, fall back to a greedy approach.
  const MAX_SEARCH_LANDS = 12

  if (untappedManaCards.length > MAX_SEARCH_LANDS) {
    return greedyPayManaCost(pool, untappedManaCards, manaCards, manaCost)
  }

  const search = (
    index: number,
    currentPool: ManaPool,
    currentCards: GameCard[]
  ): { manaPool: ManaPool; cards: GameCard[] } | null => {
    const paidPool = spendManaCost(currentPool, manaCost)
    if (paidPool) return { manaPool: paidPool, cards: currentCards }
    if (index >= untappedManaCards.length) return null

    const { card, abilities } = untappedManaCards[index]

    const skipResult = search(index + 1, currentPool, currentCards)
    if (skipResult) return skipResult

    for (const ability of abilities) {
      const nextPool = { ...currentPool, [ability.color]: currentPool[ability.color] + ability.amount }
      const nextCards = currentCards.map(entry =>
        entry.instanceId === card.instanceId ? { ...entry, tapped: ability.requiresTap ? true : entry.tapped } : entry
      )
      const result = search(index + 1, nextPool, nextCards)
      if (result) return result
    }

    return null
  }

  return search(0, { ...pool }, manaCards)
}

function greedyPayManaCost(
  pool: ManaPool,
  untappedManaCards: Array<{ card: GameCard; abilities: Extract<ActivatedAbilityDefinition, { kind: 'add_mana' }>[] }>,
  allCards: GameCard[],
  manaCost: string | null,
): { manaPool: ManaPool; cards: GameCard[] } | null {
  const { colored, generic } = parseManaCost(manaCost)
  const currentPool = { ...pool }
  const tappedIds = new Set<string>()

  // First pass: tap lands for colored requirements, preferring single-color lands
  const sorted = [...untappedManaCards].sort((a, b) => {
    const aIsLand = a.card.typeLine.toLowerCase().includes('land')
    const bIsLand = b.card.typeLine.toLowerCase().includes('land')
    if (aIsLand !== bIsLand) return aIsLand ? -1 : 1
    return a.abilities.length - b.abilities.length
  })
  for (const color of COLOR_ORDER) {
    let needed = colored[color] - currentPool[color]
    if (needed <= 0) continue
    for (const entry of sorted) {
      if (needed <= 0) break
      if (tappedIds.has(entry.card.instanceId)) continue
      const ability = entry.abilities.find(option => option.color === color)
      if (!ability) continue
      tappedIds.add(entry.card.instanceId)
      currentPool[color] += ability.amount
      needed -= ability.amount
    }
  }

  // Check colored requirements met
  for (const color of COLOR_ORDER) {
    if (currentPool[color] < colored[color]) return null
  }

  // Second pass: tap lands for generic, preferring single-color lands
  let genericNeeded = generic
  for (const color of COLOR_ORDER) {
    const excess = currentPool[color] - colored[color]
    const spend = Math.min(excess, genericNeeded)
    genericNeeded -= spend
  }
  for (const entry of sorted) {
    if (genericNeeded <= 0) break
    if (tappedIds.has(entry.card.instanceId)) continue
    const ability = entry.abilities[0]
    if (!ability) continue
    tappedIds.add(entry.card.instanceId)
    currentPool[ability.color] += ability.amount
    genericNeeded -= ability.amount
  }
  if (genericNeeded > 0) return null

  const resultPool = spendManaCost(currentPool, manaCost)
  if (!resultPool) return null

  const resultCards = allCards.map(card =>
    tappedIds.has(card.instanceId) ? { ...card, tapped: true } : card
  )
  return { manaPool: resultPool, cards: resultCards }
}

export function getLandManaOptions(card: Pick<GameCard, 'name' | 'typeLine' | 'oracleText'>, player: Pick<Player, 'commander'>): ColorSymbol[] {
  const options = new Set<ColorSymbol>()
  const oracleText = (card.oracleText ?? '').toLowerCase()

  const matches = card.oracleText?.match(/\{([WUBRGC])\}/g) ?? []
  for (const match of matches) {
    const color = match.replace(/[{}]/g, '') as ColorSymbol
    options.add(color)
  }

  if (oracleText.includes('any color')) {
    const commanderColors: ColorSymbol[] = player.commander?.colorIdentity?.length ? player.commander.colorIdentity : ['W', 'U', 'B', 'R', 'G']
    for (const color of commanderColors) options.add(color)
  }

  for (const entry of BASIC_LAND_TYPES) {
    if (entry.pattern.test(card.typeLine) || entry.pattern.test(card.name)) {
      options.add(entry.color)
    }
  }

  return COLOR_ORDER.filter(color => options.has(color))
}

export function getActivatedAbilities(card: Pick<GameCard, 'name' | 'typeLine' | 'oracleText' | 'tapped'>, player: Pick<Player, 'commander'>): ActivatedAbilityDefinition[] {
  const abilities: ActivatedAbilityDefinition[] = []
  const lowerName = card.name.toLowerCase()
  const lowerType = card.typeLine.toLowerCase()
  const oracleText = card.oracleText ?? ''

  if (lowerType.includes('land')) {
    for (const color of getLandManaOptions(card, player)) {
      abilities.push({
        id: `mana-${color}-1`,
        label: `Tap for ${color}`,
        kind: 'add_mana',
        color,
        amount: 1,
        requiresTap: true,
      })
    }
    return abilities
  }

  if (lowerName === 'treasure') {
    const colors: ColorSymbol[] = player.commander?.colorIdentity?.length ? player.commander.colorIdentity : ['W', 'U', 'B', 'R', 'G']
    for (const color of colors) {
      abilities.push({
        id: `treasure-${color}`,
        label: `Sac for ${color}`,
        kind: 'add_mana',
        color,
        amount: 1,
        requiresTap: true,
        sacrifice: true,
        genericCost: 0,
      })
    }
  }

  if (lowerName === 'food') {
    abilities.push({
      id: 'food-life',
      label: '2, Tap, Sac: Gain 3',
      kind: 'gain_life',
      requiresTap: true,
      sacrifice: true,
      genericCost: 2,
      amount: 3,
    })
  }

  if (lowerName === 'clue') {
    abilities.push({
      id: 'clue-draw',
      label: '2, Sac: Draw',
      kind: 'draw_card',
      requiresTap: false,
      sacrifice: true,
      genericCost: 2,
    })
  }

  if (lowerName === 'map') {
    abilities.push({
      id: 'map-explore',
      label: '1, Tap, Sac: Explore',
      kind: 'explore_target_creature',
      requiresTap: true,
      sacrifice: true,
      genericCost: 1,
    })
  }

  if (lowerName === 'sol ring') {
    abilities.push({ id: 'mana-C-2', label: 'Tap for CC', kind: 'add_mana', color: 'C', amount: 2, requiresTap: true })
  }

  if (lowerName === 'arcane signet' || lowerName === "commander's sphere") {
    const colors: ColorSymbol[] = player.commander?.colorIdentity?.length ? player.commander.colorIdentity : ['W', 'U', 'B', 'R', 'G']
    for (const color of colors) {
      abilities.push({
        id: `mana-${color}-1`,
        label: `Tap for ${color}`,
        kind: 'add_mana',
        color,
        amount: 1,
        requiresTap: true,
      })
    }
  }

  if (lowerName === "commander's sphere") {
    abilities.push({ id: 'draw-sac', label: 'Sacrifice: Draw', kind: 'draw_card', requiresTap: false, sacrifice: true, genericCost: 0 })
  }

  if (lowerName === 'devoted druid') {
    abilities.push({ id: 'mana-G-1', label: 'Tap for G', kind: 'add_mana', color: 'G', amount: 1, requiresTap: true })
    abilities.push({ id: 'untap-minus-one', label: 'Put -1/-1: Untap', kind: 'untap_self_add_minus_one_counter', requiresTap: false })
  }

  if (lowerName === 'ignoble hierarch') {
    for (const color of ['B', 'R', 'G'] as const) {
      abilities.push({ id: `mana-${color}-1`, label: `Tap for ${color}`, kind: 'add_mana', color, amount: 1, requiresTap: true })
    }
  }

  if (lowerName === 'llanowar elves' || lowerName === 'elvish mystic' || lowerName === 'fyndhorn elves') {
    abilities.push({ id: 'mana-G-1', label: 'Tap for G', kind: 'add_mana', color: 'G', amount: 1, requiresTap: true })
  }

  if (lowerName === 'channeler initiate') {
    for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
      abilities.push({
        id: `remove-minus-one-${color}`,
        label: `Remove -1/-1: Add ${color}`,
        kind: 'remove_minus_one_counter_add_mana',
        color,
        amount: 1,
        requiresTap: true,
      })
    }
  }

  const genericTapMana = oracleText.match(/\{T\}:\s*Add ((?:\{[WUBRGC]\})+)/i)
  if (abilities.length === 0 && genericTapMana) {
    const symbols = genericTapMana[1]?.match(/\{([WUBRGC])\}/g) ?? []
    const counts = new Map<ColorSymbol, number>()
    for (const symbol of symbols) {
      const color = symbol.replace(/[{}]/g, '') as ColorSymbol
      counts.set(color, (counts.get(color) ?? 0) + 1)
    }
    for (const [color, amount] of counts.entries()) {
      abilities.push({
        id: `mana-${color}-${amount}`,
        label: `Tap for ${color}${amount > 1 ? amount : ''}`,
        kind: 'add_mana',
        color,
        amount,
        requiresTap: true,
      })
    }
  }

  return abilities
}

export function getTriggeredAbilities(card: Pick<GameCard, 'name' | 'oracleText'>): TriggeredAbilityDefinition[] {
  const abilities: TriggeredAbilityDefinition[] = []
  const oracleText = (card.oracleText ?? '').replace(/\n/g, ' ').toLowerCase()
  const lowerName = card.name.toLowerCase()

  const entersTokens = parseCreateTokenEffect(oracleText, /(when|whenever) [^.,]* enters(?: the battlefield)?, create ([^.]+?) tokens?/i)
  if (entersTokens) {
    abilities.push({
      id: 'etb-create-tokens',
      label: 'ETB trigger',
      event: 'enters_battlefield',
      match: 'self',
      effect: entersTokens,
    })
  }

  const attacksTokens = parseCreateTokenEffect(oracleText, /(when|whenever) [^.,]* attacks, create ([^.]+?) tokens?/i)
  if (attacksTokens) {
    abilities.push({
      id: 'attack-create-tokens',
      label: 'Attack trigger',
      event: 'attacks',
      match: 'self',
      effect: attacksTokens,
    })
  }

  if (oracleText.includes('whenever another creature you control dies, each opponent loses 1 life and you gain 1 life')) {
    abilities.push({
      id: 'dies-drain-team',
      label: 'Dies trigger',
      event: 'creature_dies',
      match: 'another_creature_you_control',
      effect: { kind: 'drain_each_opponent', amount: 1, gainLife: 1 },
    })
  }

  if (oracleText.includes('whenever another creature dies, each opponent loses 1 life and you gain 1 life')) {
    abilities.push({
      id: 'dies-drain-any',
      label: 'Dies trigger',
      event: 'creature_dies',
      match: 'any_creature',
      effect: { kind: 'drain_each_opponent', amount: 1, gainLife: 1 },
    })
  }

  if (oracleText.includes('whenever another creature dies, each opponent loses 1 life')) {
    abilities.push({
      id: 'dies-ping-any',
      label: 'Dies trigger',
      event: 'creature_dies',
      match: 'any_creature',
      effect: { kind: 'drain_each_opponent', amount: 1, gainLife: 0 },
    })
  }

  if (oracleText.includes('whenever a creature dies, each opponent loses 1 life')) {
    abilities.push({
      id: 'dies-ping-creature',
      label: 'Dies trigger',
      event: 'creature_dies',
      match: 'any_creature',
      effect: { kind: 'drain_each_opponent', amount: 1, gainLife: 0 },
    })
  }

  if (lowerName === 'morbid opportunist') {
    abilities.push({
      id: 'dies-draw',
      label: 'Dies trigger',
      event: 'creature_dies',
      match: 'any_creature',
      effect: { kind: 'draw_cards', amount: 1 },
    })
  }

  const upkeepTokens = parseCreateTokenEffect(oracleText, /at the beginning of your upkeep, create ([^.]+?) tokens?/i)
  if (upkeepTokens) {
    abilities.push({
      id: 'upkeep-create-tokens',
      label: 'Upkeep trigger',
      event: 'upkeep',
      match: 'your_upkeep',
      effect: upkeepTokens,
    })
  }

  const eachUpkeepTokens = parseCreateTokenEffect(oracleText, /at the beginning of each upkeep, create ([^.]+?) tokens?/i)
  if (eachUpkeepTokens) {
    abilities.push({
      id: 'each-upkeep-create-tokens',
      label: 'Upkeep trigger',
      event: 'upkeep',
      match: 'each_upkeep',
      effect: eachUpkeepTokens,
    })
  }

  const endStepTokens = parseCreateTokenEffect(oracleText, /at the beginning of your end step, create ([^.]+?) tokens?/i)
  if (endStepTokens) {
    abilities.push({
      id: 'end-step-create-tokens',
      label: 'End step trigger',
      event: 'end_step',
      match: 'your_end_step',
      effect: endStepTokens,
    })
  }

  if (oracleText.includes('whenever a land enters the battlefield under your control, proliferate')) {
    abilities.push({
      id: 'landfall-proliferate',
      label: 'Landfall trigger',
      event: 'land_enters',
      match: 'land_you_control_enters',
      effect: { kind: 'proliferate' },
    })
  }

  if (oracleText.includes('whenever another creature enters the battlefield under your control, you gain 1 life')) {
    abilities.push({
      id: 'creature-enters-gain-1',
      label: 'Creature ETB trigger',
      event: 'creature_enters',
      match: 'another_creature_you_control_enters',
      effect: { kind: 'gain_life', amount: 1 },
    })
  }

  if (oracleText.includes('whenever you cast a spell, create')) {
    const castTokens = parseCreateTokenEffect(oracleText, /whenever you cast a spell, create ([^.]+?) tokens?/i)
    if (castTokens) {
      abilities.push({
        id: 'cast-create-tokens',
        label: 'Cast trigger',
        event: 'spell_cast',
        match: 'spell_you_cast',
        effect: castTokens,
      })
    }
  }

  if (oracleText.includes('whenever you cast a spell, draw a card')) {
    abilities.push({
      id: 'cast-draw',
      label: 'Cast trigger',
      event: 'spell_cast',
      match: 'spell_you_cast',
      effect: { kind: 'draw_cards', amount: 1 },
    })
  }

  if (oracleText.includes('whenever you create or sacrifice a token')) {
    abilities.push({
      id: 'token-create-or-sac-drain',
      label: 'Token trigger',
      event: 'token_created',
      match: 'token_you_create_or_sacrifice',
      effect: { kind: 'drain_each_opponent', amount: 1, gainLife: 0 },
    })
    abilities.push({
      id: 'token-sac-drain',
      label: 'Token trigger',
      event: 'token_sacrificed',
      match: 'token_you_create_or_sacrifice',
      effect: { kind: 'drain_each_opponent', amount: 1, gainLife: 0 },
    })
  }

  if (oracleText.includes('whenever one or more tokens enter the battlefield under your control')) {
    if (oracleText.includes('each opponent loses 1 life')) {
      abilities.push({
        id: 'token-create-drain',
        label: 'Token trigger',
        event: 'token_created',
        match: 'token_you_create',
        effect: { kind: 'drain_each_opponent', amount: 1, gainLife: oracleText.includes('you gain 1 life') ? 1 : 0 },
      })
    }
  }

  if (oracleText.includes('whenever you put one or more -1/-1 counters on a creature')) {
    if (oracleText.includes('create a 1/1 green snake creature token')) {
      abilities.push({
        id: 'minus-one-snake',
        label: 'Counter trigger',
        event: 'minus_one_counters_placed',
        match: 'minus_one_counters_you_put_on_creature',
        effect: { kind: 'create_tokens_from_counter_placement', tokenKey: 'snake', mode: 'once' },
      })
    }
    if (oracleText.includes('create that many 1/1 black insect creature tokens')) {
      abilities.push({
        id: 'minus-one-insects',
        label: 'Counter trigger',
        event: 'minus_one_counters_placed',
        match: 'minus_one_counters_you_put_on_creature',
        effect: { kind: 'create_tokens_from_counter_placement', tokenKey: 'insect', mode: 'per_counter' },
      })
    }
  }

  return abilities
}

export function getSimpleSpellDefinition(card: Pick<GameCard, 'name' | 'typeLine' | 'oracleText'>): SimpleSpellDefinition | null {
  const typeLine = card.typeLine.toLowerCase()
  if (!typeLine.includes('instant') && !typeLine.includes('sorcery')) return null

  const oracleText = (card.oracleText ?? '').replace(/\n/g, ' ').toLowerCase()

  const drawMatch = oracleText.match(/draw (one|two|three|four|five|six|seven|\d+) cards?/)
  if (drawMatch) {
    const amount = wordToNumber(drawMatch[1] ?? '0')
    const loseLifeMatch = oracleText.match(/lose (\d+) life/)
    return {
      kind: 'draw_cards',
      amount,
      loseLife: loseLifeMatch ? Number(loseLifeMatch[1]) : undefined,
      target: 'none',
    }
  }

  const tokenSpell = parseCreateTokenEffect(oracleText, /create ([^.]+?) tokens?/i)
  if (tokenSpell) {
    return {
      kind: 'create_tokens',
      tokenKey: tokenSpell.tokenKey,
      count: tokenSpell.count,
      tapped: tokenSpell.tapped,
      target: 'none',
    }
  }

  if (oracleText.includes('proliferate')) {
    return { kind: 'proliferate', target: 'none' }
  }

  const minusOneEach = oracleText.match(/put (a|one|two|three|four|five|six|seven|\d+) -1\/-1 counters? on each creature/)
  if (minusOneEach) {
    const rawAmount = minusOneEach[1] ?? '1'
    const amount = rawAmount === 'a' ? 1 : wordToNumber(rawAmount)
    return { kind: 'put_minus_one_counters_each_creature', amount, target: 'none' }
  }

  const minusOneTarget = oracleText.match(/put (a|one|two|three|four|five|six|seven|\d+) -1\/-1 counters? on target creature/)
  if (minusOneTarget) {
    const rawAmount = minusOneTarget[1] ?? '1'
    const amount = rawAmount === 'a' ? 1 : wordToNumber(rawAmount)
    return { kind: 'put_minus_one_counter_target_creature', amount, target: 'battlefield_creature' }
  }

  if (oracleText.includes('destroy target creature')) {
    return { kind: 'destroy_target_creature', target: 'battlefield_creature' }
  }

  if (oracleText.includes('destroy target nonland permanent')) {
    return { kind: 'destroy_target_nonland_permanent', target: 'battlefield_nonland_permanent' }
  }

  if (oracleText.includes('destroy target permanent')) {
    return { kind: 'destroy_target_permanent', target: 'battlefield_permanent' }
  }

  if (oracleText.includes('destroy target artifact or creature')) {
    return { kind: 'destroy_target_nonland_permanent', target: 'battlefield_nonland_permanent' }
  }

  const damageCreatureOrPlayer = oracleText.match(/deals? (\d+) damage to target creature or player/)
  if (damageCreatureOrPlayer) {
    return {
      kind: 'damage_target_creature_or_player',
      amount: Number(damageCreatureOrPlayer[1]),
      target: 'creature_or_player',
    }
  }

  const anyTarget = oracleText.match(/deals? (\d+) damage to any target/)
  if (anyTarget) {
    return {
      kind: 'damage_target_creature_or_player',
      amount: Number(anyTarget[1]),
      target: 'creature_or_player',
    }
  }

  const damageCreature = oracleText.match(/deals? (\d+) damage to target creature/)
  if (damageCreature) {
    return {
      kind: 'damage_target_creature',
      amount: Number(damageCreature[1]),
      target: 'battlefield_creature',
    }
  }

  if (oracleText.includes('return target creature card from your graveyard to the battlefield')) {
    return { kind: 'return_graveyard_creature_to_battlefield', target: 'own_graveyard_creature' }
  }

  if (oracleText.includes('return target creature card from your graveyard to your hand')) {
    return { kind: 'return_graveyard_creature_to_hand', target: 'own_graveyard_creature' }
  }

  if (card.name === 'Chain Reaction' || oracleText.includes('deals x damage to each creature, where x is the number of creatures on the battlefield')) {
    return { kind: 'mass_damage_creatures', amount: 'creature_count', target: 'none' }
  }

  const massDamage = oracleText.match(/deals? (\d+) damage to each creature/)
  if (massDamage) {
    return { kind: 'mass_damage_creatures', amount: Number(massDamage[1]), target: 'none' }
  }

  return null
}

export function getPlaneswalkerAbilities(card: Pick<GameCard, 'oracleText' | 'typeLine'>): PlaneswalkerAbilityDefinition[] {
  if (!card.typeLine.toLowerCase().includes('planeswalker')) return []

  const abilities: PlaneswalkerAbilityDefinition[] = []

  for (const [index, rawLine] of (card.oracleText ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .entries()) {
    const match = rawLine.match(/^([+-]?\d+|0):\s*(.+)$/)
    if (!match) continue

    const loyaltyDelta = Number(match[1])
    const body = match[2].trim()
    const lowerBody = body.toLowerCase()
    const simpleEffect = getSimpleSpellDefinition({
      name: '',
      typeLine: 'Sorcery',
      oracleText: body,
    })

    if (simpleEffect) {
      abilities.push({
        id: `loyalty-${index}-${loyaltyDelta}`,
        label: rawLine,
        loyaltyDelta,
        target: simpleEffect.target,
        effect: simpleEffect,
        supported: true,
      })
      continue
    }

    const minusCounterMatch = lowerBody.match(/put (\d+) -1\/-1 counters? on (?:up to )?one target creature|put a -1\/-1 counter on (?:up to )?one target creature|put a -1\/-1 counter on target creature/)
    if (minusCounterMatch) {
      abilities.push({
        id: `loyalty-${index}-${loyaltyDelta}`,
        label: rawLine,
        loyaltyDelta,
        target: 'battlefield_creature',
        effect: {
          kind: 'put_minus_one_counter_target_creature',
          amount: minusCounterMatch[1] ? Number(minusCounterMatch[1]) : 1,
          target: 'battlefield_creature',
        },
        supported: true,
      })
      continue
    }

    abilities.push({
      id: `loyalty-${index}-${loyaltyDelta}`,
      label: rawLine,
      loyaltyDelta,
      target: 'none',
      effect: null,
      supported: false,
    })
  }

  return abilities
}

export function getEtbCounters(card: Pick<GameCard, 'oracleText'>): { plusOne: number; minusOne: number } {
  const oracleText = (card.oracleText ?? '').replace(/\n/g, ' ').toLowerCase()

  const plusMatch = oracleText.match(/enters(?: the battlefield)? with (a|one|two|three|four|five|six|seven|\d+) \+1\/\+1 counters? on it/)
  const minusMatch = oracleText.match(/enters(?: the battlefield)? with (a|one|two|three|four|five|six|seven|\d+) -1\/-1 counters? on it/)

  const parseCount = (value?: string) => {
    if (!value) return 0
    return value === 'a' ? 1 : wordToNumber(value)
  }

  return {
    plusOne: parseCount(plusMatch?.[1]),
    minusOne: parseCount(minusMatch?.[1]),
  }
}

export function landEntersTapped(
  card: Pick<GameCard, 'typeLine' | 'oracleText'>,
  context?: { basicLandsControlled?: number }
): boolean {
  if (!card.typeLine.toLowerCase().includes('land')) return false
  const oracleText = (card.oracleText ?? '').replace(/\n/g, ' ').toLowerCase()

  if (oracleText.includes('enters the battlefield tapped unless you control two or more basic lands')) {
    return (context?.basicLandsControlled ?? 0) < 2
  }

  return oracleText.includes('enters tapped') || oracleText.includes('enters the battlefield tapped')
}

export function getLandEntryEffect(card: Pick<GameCard, 'name' | 'typeLine' | 'oracleText'>): LandEntryEffectDefinition | null {
  if (!card.typeLine.toLowerCase().includes('land')) return null

  const oracleText = (card.oracleText ?? '').replace(/\n/g, ' ').toLowerCase()

  const gainLifeMatch = oracleText.match(/when [^.,]* enters(?: the battlefield)?, you gain (\d+) life/)
  if (gainLifeMatch) {
    return { kind: 'gain_life', amount: Number(gainLifeMatch[1]) }
  }

  if (oracleText.includes('return a land you control to its owner\'s hand')) {
    return { kind: 'bounce_land' }
  }

  if (oracleText.includes('exile all cards from target player\'s graveyard')) {
    return { kind: 'exile_graveyard' }
  }

  return null
}

function wordToNumber(value: string): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric

  const map: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  }
  return map[value] ?? 0
}

function parseCreateTokenEffect(
  oracleText: string,
  pattern: RegExp
): Extract<TriggerEffectDefinition, { kind: 'create_tokens' }> | null {
  const match = oracleText.match(pattern)
  if (!match?.[2]) return null

  const fragment = match[2].trim().toLowerCase()
  if (fragment.startsWith('x ')) return null

  const countMatch = fragment.match(/^(a|an|one|two|three|four|five|six|seven|\d+)\b/)
  const countToken = countMatch?.[1] ?? 'one'
  const count =
    fragment.includes('for each opponent') || fragment.includes('equal to the number of opponents')
      ? 'opponents'
      : countToken === 'a' || countToken === 'an'
      ? 1
      : wordToNumber(countToken)
  const tokenKey = inferTokenKey(fragment)
  if (!tokenKey || (typeof count === 'number' && count <= 0)) return null

  const tapped = fragment.includes('tapped')
  return {
    kind: 'create_tokens',
    tokenKey,
    count,
    tapped,
  }
}

function inferTokenKey(fragment: string): TokenTemplateKey | null {
  if (fragment.includes('treasure')) return 'treasure'
  if (fragment.includes('food')) return 'food'
  if (fragment.includes('clue')) return 'clue'
  if (fragment.includes('map')) return 'map'
  if (fragment.includes('squirrel')) return 'squirrel'
  if (fragment.includes('rat')) return 'rat'
  if (fragment.includes('insect')) return 'insect'
  if (fragment.includes('zombie')) return 'zombie'
  if (fragment.includes('snake')) return 'snake'
  if (fragment.includes('pest')) return 'pest'
  if (fragment.includes('saproling')) return 'saproling'
  if (fragment.includes('worm')) return 'worm'
  if (fragment.includes('wolf')) return 'wolf'
  return null
}
