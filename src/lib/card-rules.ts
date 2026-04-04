import type { ColorSymbol, GameCard, ManaPool, Player } from '@/types/game-state'

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
  | { kind: 'destroy_target_creature'; target: 'battlefield_creature' }
  | { kind: 'destroy_target_nonland_permanent'; target: 'battlefield_nonland_permanent' }
  | { kind: 'destroy_target_permanent'; target: 'battlefield_permanent' }
  | { kind: 'damage_target_creature'; amount: number; target: 'battlefield_creature' }
  | { kind: 'damage_target_creature_or_player'; amount: number; target: 'creature_or_player' }
  | { kind: 'mass_damage_creatures'; amount: number | 'creature_count'; target: 'none' }
  | { kind: 'return_graveyard_creature_to_battlefield'; target: 'own_graveyard_creature' }
  | { kind: 'return_graveyard_creature_to_hand'; target: 'own_graveyard_creature' }

export function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
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
