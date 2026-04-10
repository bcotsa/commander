import { describe, it, expect } from 'vitest'
import {
  emptyManaPool,
  parseManaCost,
  spendManaCost,
  canPayManaCost,
  autoPayManaCost,
  formatManaPool,
  getLandManaOptions,
  getSimpleSpellDefinition,
} from '../card-rules'
import type { GameCard, ManaPool } from '@/types/game-state'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<GameCard> = {}): GameCard {
  return {
    instanceId: `card-${crypto.randomUUID()}`,
    scryfallId: null,
    name: overrides.name ?? 'Test Card',
    imageUri: '',
    colorIdentity: [],
    manaCost: null,
    oracleText: null,
    typeLine: overrides.typeLine ?? 'Creature',
    power: null,
    toughness: null,
    startingLoyalty: null,
    loyalty: null,
    loyaltyActivatedThisTurn: false,
    plusOneCounters: 0,
    minusOneCounters: 0,
    tapped: false,
    markedDamage: 0,
    summoningSick: false,
    isCommander: false,
    isToken: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mana cost parsing
// ---------------------------------------------------------------------------

describe('parseManaCost', () => {
  it('parses colored mana', () => {
    const { colored, generic } = parseManaCost('{R}{R}')
    expect(colored.R).toBe(2)
    expect(generic).toBe(0)
  })

  it('parses generic mana', () => {
    const { colored, generic } = parseManaCost('{3}')
    expect(generic).toBe(3)
    expect(colored.W).toBe(0)
  })

  it('parses mixed costs', () => {
    const { colored, generic } = parseManaCost('{2}{U}{B}')
    expect(generic).toBe(2)
    expect(colored.U).toBe(1)
    expect(colored.B).toBe(1)
  })

  it('handles null cost', () => {
    const { colored, generic } = parseManaCost(null)
    expect(generic).toBe(0)
    Object.values(colored).forEach(v => expect(v).toBe(0))
  })

  it('parses X as 0 by default', () => {
    const { generic } = parseManaCost('{X}{R}')
    expect(generic).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Mana spending
// ---------------------------------------------------------------------------

describe('spendManaCost', () => {
  it('spends colored mana', () => {
    const pool: ManaPool = { W: 0, U: 0, B: 0, R: 2, G: 0, C: 0 }
    const result = spendManaCost(pool, '{R}{R}')
    expect(result).not.toBeNull()
    expect(result!.R).toBe(0)
  })

  it('returns null if not enough colored mana', () => {
    const pool: ManaPool = { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 }
    expect(spendManaCost(pool, '{R}{R}')).toBeNull()
  })

  it('spends generic from any color', () => {
    const pool: ManaPool = { W: 2, U: 0, B: 0, R: 1, G: 0, C: 0 }
    const result = spendManaCost(pool, '{1}{R}')
    expect(result).not.toBeNull()
    expect(result!.R).toBe(0) // R spent on {R}
    expect(result!.W).toBe(1) // 1 of 2 W spent on {1}
  })

  it('handles null mana cost (free spell)', () => {
    const pool = emptyManaPool()
    const result = spendManaCost(pool, null)
    expect(result).not.toBeNull()
  })
})

describe('canPayManaCost', () => {
  it('returns true when pool has enough', () => {
    const pool: ManaPool = { W: 1, U: 0, B: 0, R: 0, G: 3, C: 0 }
    expect(canPayManaCost(pool, '{2}{G}')).toBe(true)
  })

  it('returns false when pool is short', () => {
    const pool: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 }
    expect(canPayManaCost(pool, '{2}{G}')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Auto-pay mana
// ---------------------------------------------------------------------------

describe('autoPayManaCost', () => {
  it('taps lands to pay costs', () => {
    const forest = makeCard({
      name: 'Forest',
      typeLine: 'Basic Land — Forest',
      oracleText: '{T}: Add {G}.',
    })
    const pool = emptyManaPool()
    const player = { commander: null }
    const result = autoPayManaCost(pool, [forest], '{G}', player)
    expect(result).not.toBeNull()
    expect(result!.cards[0]?.tapped).toBe(true)
  })

  it('returns null if not enough lands', () => {
    const pool = emptyManaPool()
    const player = { commander: null }
    const result = autoPayManaCost(pool, [], '{G}', player)
    expect(result).toBeNull()
  })

  it('uses existing mana pool before tapping lands', () => {
    const pool: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 }
    const player = { commander: null }
    const result = autoPayManaCost(pool, [], '{G}', player)
    expect(result).not.toBeNull()
    expect(result!.manaPool.G).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Format mana pool
// ---------------------------------------------------------------------------

describe('formatManaPool', () => {
  it('formats non-empty pool', () => {
    const pool: ManaPool = { W: 2, U: 0, B: 0, R: 1, G: 0, C: 0 }
    expect(formatManaPool(pool)).toBe('W2 R1')
  })

  it('returns Empty for zero pool', () => {
    expect(formatManaPool(emptyManaPool())).toBe('Empty')
  })
})

// ---------------------------------------------------------------------------
// Land mana options
// ---------------------------------------------------------------------------

describe('getLandManaOptions', () => {
  const player = { commander: null }

  it('detects basic land types from type line', () => {
    const forest = { name: 'Forest', typeLine: 'Basic Land — Forest', oracleText: '{T}: Add {G}.' }
    expect(getLandManaOptions(forest, player)).toContain('G')
  })

  it('detects dual lands from oracle text', () => {
    const dual = {
      name: 'Woodland Cemetery',
      typeLine: 'Land',
      oracleText: '{T}: Add {B} or {G}.',
    }
    const options = getLandManaOptions(dual, player)
    expect(options).toContain('B')
    expect(options).toContain('G')
  })

  it('detects Command Tower as any-color (no commander = all 5)', () => {
    const tower = {
      name: 'Command Tower',
      typeLine: 'Land',
      oracleText: '{T}: Add one mana of any color in your commander\'s color identity.',
    }
    const options = getLandManaOptions(tower, player)
    expect(options.length).toBe(5) // W, U, B, R, G
  })

  it('restricts any-color to commander identity', () => {
    const tower = {
      name: 'Command Tower',
      typeLine: 'Land',
      oracleText: '{T}: Add one mana of any color in your commander\'s color identity.',
    }
    const gbPlayer = {
      commander: {
        scryfallId: '', name: 'Test', imageUri: '', typeLine: 'Creature',
        manaCost: null, oracleText: null, power: null, toughness: null, loyalty: null,
        colorIdentity: ['G' as const, 'B' as const],
      },
    }
    const options = getLandManaOptions(tower, gbPlayer)
    expect(options).toContain('G')
    expect(options).toContain('B')
    expect(options).not.toContain('R')
  })
})

// ---------------------------------------------------------------------------
// Simple spell definitions
// ---------------------------------------------------------------------------

describe('getSimpleSpellDefinition', () => {
  it('detects draw spells', () => {
    const card = {
      name: 'Divination',
      typeLine: 'Sorcery',
      oracleText: 'Draw two cards.',
    }
    const def = getSimpleSpellDefinition(card)
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('draw_cards')
    if (def!.kind === 'draw_cards') {
      expect(def!.amount).toBe(2)
    }
  })

  it('detects destroy target creature', () => {
    const card = {
      name: 'Murder',
      typeLine: 'Instant',
      oracleText: 'Destroy target creature.',
    }
    const def = getSimpleSpellDefinition(card)
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('destroy_target_creature')
  })

  it('detects damage to any target', () => {
    const card = {
      name: 'Lightning Bolt',
      typeLine: 'Instant',
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
    }
    const def = getSimpleSpellDefinition(card)
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('damage_target_creature_or_player')
    if (def!.kind === 'damage_target_creature_or_player') {
      expect(def!.amount).toBe(3)
    }
  })

  it('returns null for permanents', () => {
    const card = {
      name: 'Grizzly Bears',
      typeLine: 'Creature — Bear',
      oracleText: null,
    }
    expect(getSimpleSpellDefinition(card)).toBeNull()
  })

  it('returns null for unrecognized spell text', () => {
    const card = {
      name: 'Weird Spell',
      typeLine: 'Instant',
      oracleText: 'Do something completely custom.',
    }
    expect(getSimpleSpellDefinition(card)).toBeNull()
  })
})
