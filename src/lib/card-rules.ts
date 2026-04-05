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
  | { kind: 'destroy_target_creature'; target: 'battlefield_creature' }
  | { kind: 'destroy_target_nonland_permanent'; target: 'battlefield_nonland_permanent' }
  | { kind: 'destroy_target_permanent'; target: 'battlefield_permanent' }
  | { kind: 'damage_target_creature'; amount: number; target: 'battlefield_creature' }
  | { kind: 'damage_target_creature_or_player'; amount: number; target: 'creature_or_player' }
  | { kind: 'mass_damage_creatures'; amount: number | 'creature_count'; target: 'none' }
  | { kind: 'return_graveyard_creature_to_battlefield'; target: 'own_graveyard_creature' }
  | { kind: 'return_graveyard_creature_to_hand'; target: 'own_graveyard_creature' }

export type ActivatedAbilityDefinition =
  | { id: string; label: string; kind: 'add_mana'; color: ColorSymbol; amount: number; requiresTap: boolean }
  | { id: string; label: string; kind: 'draw_card'; requiresTap: boolean; sacrifice: boolean }

export type TriggerEventType = 'enters_battlefield' | 'attacks' | 'creature_dies'

export type TriggerEffectDefinition =
  | { kind: 'create_tokens'; tokenKey: TokenTemplateKey; count: number | 'opponents'; tapped?: boolean }
  | { kind: 'draw_cards'; amount: number }
  | { kind: 'drain_each_opponent'; amount: number; gainLife: number }

export type TriggeredAbilityDefinition =
  | { id: string; label: string; event: 'enters_battlefield'; effect: TriggerEffectDefinition; match: 'self' }
  | { id: string; label: string; event: 'attacks'; effect: TriggerEffectDefinition; match: 'self' }
  | { id: string; label: string; event: 'creature_dies'; effect: TriggerEffectDefinition; match: 'another_creature_you_control' | 'any_creature' }

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
  const sorted = [...untappedManaCards].sort((a, b) => a.abilities.length - b.abilities.length)
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
    abilities.push({ id: 'draw-sac', label: 'Sacrifice: Draw', kind: 'draw_card', requiresTap: false, sacrifice: true })
  }

  if (lowerName === 'devoted druid') {
    abilities.push({ id: 'mana-G-1', label: 'Tap for G', kind: 'add_mana', color: 'G', amount: 1, requiresTap: true })
  }

  if (lowerName === 'ignoble hierarch') {
    for (const color of ['B', 'R', 'G'] as const) {
      abilities.push({ id: `mana-${color}-1`, label: `Tap for ${color}`, kind: 'add_mana', color, amount: 1, requiresTap: true })
    }
  }

  if (lowerName === 'llanowar elves' || lowerName === 'elvish mystic' || lowerName === 'fyndhorn elves') {
    abilities.push({ id: 'mana-G-1', label: 'Tap for G', kind: 'add_mana', color: 'G', amount: 1, requiresTap: true })
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

  const entersTokens = parseCreateTokenEffect(oracleText, /(when|whenever) [^.,]* enters the battlefield, create ([^.]+?) tokens?/i)
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
    fragment.includes('for each opponent')
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
  return null
}
