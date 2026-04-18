import { describe, it, expect } from 'vitest'
import {
  emptyManaPool,
  parseManaCost,
  spendManaCost,
  canPayManaCost,
  autoPayManaCost,
  formatManaPool,
  getLandEntryEffect,
  getLandManaOptions,
  getActivatedAbilities,
  getSimpleSpellDefinition,
  getSimpleSpellSequence,
  getTriggeredAbilities,
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

describe('getActivatedAbilities', () => {
  it('detects Hazel token mana ability', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'Hazel of the Rootbloom',
      typeLine: 'Legendary Creature — Squirrel Druid',
      oracleText: '{T}, Pay 2 life, Tap X untapped tokens you control: Add X mana in any combination of colors.',
    }), { commander: null })

    expect(abilities.some(ability => ability.kind === 'add_mana_from_tapped_tokens')).toBe(true)
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

  it('detects scry spells', () => {
    const card = {
      name: 'Crystal Ball Effect',
      typeLine: 'Sorcery',
      oracleText: 'Scry 2.',
    }
    const def = getSimpleSpellDefinition(card)
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('scry')
    if (def!.kind === 'scry') {
      expect(def.amount).toBe(2)
    }
  })

  it('detects surveil spells before draw text', () => {
    const card = {
      name: 'Consider-like Effect',
      typeLine: 'Instant',
      oracleText: 'Surveil 1. Draw a card.',
    }
    const def = getSimpleSpellDefinition(card)
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('surveil')
    if (def!.kind === 'surveil') {
      expect(def.amount).toBe(1)
    }
  })

  it('detects target player mill spells', () => {
    const card = {
      name: 'Mind Sculpt',
      typeLine: 'Sorcery',
      oracleText: 'Target player mills seven cards.',
    }
    const def = getSimpleSpellDefinition(card)
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('mill')
    if (def!.kind === 'mill') {
      expect(def.amount).toBe(7)
      expect(def.target).toBe('player')
    }
  })

  it('returns ordered simple effect sequences', () => {
    const sequence = getSimpleSpellSequence({
      typeLine: 'Sorcery',
      oracleText: 'Scry 2, then draw a card.',
    })

    expect(sequence).toEqual([
      { kind: 'scry', amount: 2 },
      { kind: 'draw_cards', amount: 1, loseLife: undefined },
    ])
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

  it('detects destroy target creature or planeswalker with life loss', () => {
    const card = {
      name: 'Infernal Grasp',
      typeLine: 'Instant',
      oracleText: 'Destroy target creature. You lose 2 life.',
    }
    const def = getSimpleSpellDefinition(card)
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('destroy_target_creature')
    if (def!.kind === 'destroy_target_creature') {
      expect(def.loseLife).toBe(2)
    }
  })
})

describe('getTriggeredAbilities', () => {
  it('parses generic ETB counter triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Skinrender',
      oracleText: 'When Skinrender enters the battlefield, put three -1/-1 counters on target creature.',
    })
    expect(abilities.some(ability => ability.event === 'enters_battlefield' && ability.target === 'battlefield_creature')).toBe(true)
  })

  it('parses enters-or-attacks token triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Grave Titan',
      oracleText: 'Whenever Grave Titan enters the battlefield or attacks, create two 2/2 black Zombie creature tokens.',
    })
    expect(abilities.some(ability => ability.event === 'enters_battlefield')).toBe(true)
    expect(abilities.some(ability => ability.event === 'attacks')).toBe(true)
  })

  it('does not duplicate simple ETB token triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Prosperous Innkeeper',
      oracleText: 'When Prosperous Innkeeper enters the battlefield, create a Treasure token.',
    })
    const treasureEtbTriggers = abilities.filter(ability =>
      ability.event === 'enters_battlefield'
      && ability.match === 'self'
      && ability.effect.kind === 'create_tokens'
      && ability.effect.tokenKey === 'treasure'
    )
    expect(treasureEtbTriggers).toHaveLength(1)
  })

  it('parses generic ETB scry triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Watcher for Tomorrow',
      oracleText: 'When Watcher for Tomorrow enters the battlefield, scry 3.',
    })
    expect(abilities.some(ability => ability.event === 'enters_battlefield' && ability.effect.kind === 'scry')).toBe(true)
  })

  it('parses generic ETB surveil triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Dimir Informant',
      oracleText: 'When Dimir Informant enters the battlefield, surveil 2.',
    })
    expect(abilities.some(ability => ability.event === 'enters_battlefield' && ability.effect.kind === 'surveil')).toBe(true)
  })

  it('detects Hazel end step token-copy trigger', () => {
    const abilities = getTriggeredAbilities({
      name: 'Hazel of the Rootbloom',
      oracleText: 'At the beginning of your end step, choose up to one target token you control. Create a token that\'s a copy of it. If you control a Squirrel, create two tokens that are copies of it instead.',
    })

    expect(abilities.some(ability =>
      ability.event === 'end_step'
      && ability.target === 'token_you_control'
      && ability.effect.kind === 'copy_token'
    )).toBe(true)
  })
})

describe('getLandEntryEffect', () => {
  it('detects lands that scry on entry', () => {
    const effect = getLandEntryEffect({
      name: 'Temple of Malady',
      typeLine: 'Land',
      oracleText: 'Temple of Malady enters the battlefield tapped. When Temple of Malady enters the battlefield, scry 1.',
    })
    expect(effect).toEqual({ kind: 'scry', amount: 1 })
  })

  it('detects lands that surveil on entry', () => {
    const effect = getLandEntryEffect({
      name: 'Undercity Sewers',
      typeLine: 'Land — Island Swamp',
      oracleText: 'When Undercity Sewers enters the battlefield, surveil 1.',
    })
    expect(effect).toEqual({ kind: 'surveil', amount: 1 })
  })
})
