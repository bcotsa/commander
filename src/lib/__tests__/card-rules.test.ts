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
import { getSupportedBespokeCardNames, hasBespokeSpellResolution } from '../card-support'
import { auditImportedDeck } from '../deck-support-audit'
import type { GameCard, ManaPool } from '@/types/game-state'
import type { ImportedDeck, ImportedDeckCard } from '@/types/game-state'

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

function makeImportedDeckCard(overrides: Partial<ImportedDeckCard>): ImportedDeckCard {
  return {
    scryfallId: null,
    name: overrides.name ?? 'Test Card',
    quantity: overrides.quantity ?? 1,
    imageUri: '',
    colorIdentity: [],
    manaCost: overrides.manaCost ?? null,
    oracleText: overrides.oracleText ?? null,
    typeLine: overrides.typeLine ?? 'Creature — Human',
    power: overrides.power ?? 2,
    toughness: overrides.toughness ?? 2,
    loyalty: overrides.loyalty ?? null,
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
  it('exposes supported bespoke card names for deck support tracking', () => {
    const supported = getSupportedBespokeCardNames()

    expect(supported).toContain('Hazel of the Rootbloom')
    expect(supported).toContain("Black Sun's Zenith")
  })

  it('identifies bespoke spell-resolution cards', () => {
    expect(hasBespokeSpellResolution('Deadly Dispute')).toBe(true)
    expect(hasBespokeSpellResolution('Grizzly Bears')).toBe(false)
  })

  it('detects Hazel token mana ability', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'Hazel of the Rootbloom',
      typeLine: 'Legendary Creature — Squirrel Druid',
      oracleText: '{T}, Pay 2 life, Tap X untapped tokens you control: Add X mana in any combination of colors.',
    }), { commander: null })

    expect(abilities.some(ability => ability.kind === 'add_mana_from_tapped_tokens')).toBe(true)
  })
})

describe('auditImportedDeck', () => {
  it('summarizes resolved deck support levels and queues unsupported spells first', () => {
    const deck: ImportedDeck = {
      source: 'moxfield',
      sourceId: 'test',
      sourceUrl: '',
      name: 'Audit Test Deck',
      format: 'commander',
      lastSyncedAt: '2026-04-18T00:00:00.000Z',
      cardCount: 3,
      commanders: [
        makeImportedDeckCard({
          name: 'Hazel of the Rootbloom',
          typeLine: 'Legendary Creature — Squirrel Druid',
          manaCost: '{2}{B}{G}',
          oracleText: 'At the beginning of your end step, create a token that\'s a copy of target token you control. If that token is a Squirrel, instead create two tokens that are copies of it.',
          power: 3,
          toughness: 5,
        }),
      ],
      mainboard: [
        makeImportedDeckCard({
          name: 'Forest',
          typeLine: 'Basic Land — Forest',
          oracleText: '{T}: Add {G}.',
          power: null,
          toughness: null,
        }),
        makeImportedDeckCard({
          name: 'Murder',
          typeLine: 'Instant',
          manaCost: '{1}{B}{B}',
          oracleText: 'Destroy target creature.',
          power: null,
          toughness: null,
        }),
        makeImportedDeckCard({
          name: 'Mystery Spell',
          typeLine: 'Sorcery',
          manaCost: '{2}{U}',
          oracleText: 'Do a very complicated unsupported thing.',
          power: null,
          toughness: null,
        }),
      ],
    }

    const audit = auditImportedDeck(deck)

    expect(audit.summary.automated.unique).toBe(2)
    expect(audit.summary.partial.unique).toBe(1)
    expect(audit.summary.unsupported.unique).toBe(1)
    expect(audit.priorityQueue[0]?.name).toBe('Mystery Spell')
    expect(audit.cards.find(card => card.name === 'Murder')?.candidate).toBe('generic')
    expect(audit.cards.find(card => card.name === 'Murder')?.confidence).toBe('runtime-verified')
    expect(audit.cards.find(card => card.name === 'Hazel of the Rootbloom')?.candidate).toBe('bespoke')
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

  it('detects counter target spell', () => {
    const card = {
      name: 'Counterspell',
      typeLine: 'Instant',
      oracleText: 'Counter target spell.',
    }
    const def = getSimpleSpellDefinition(card)
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('counter_target_spell')
  })

  it('detects exile target creature', () => {
    const card = {
      name: 'Swords to Plowshares',
      typeLine: 'Instant',
      oracleText: 'Exile target creature. Its controller gains life equal to its power.',
    }
    const def = getSimpleSpellDefinition(card)
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('exile_target_creature')
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

  it('parses real oracle texts from Hazel Squirrels deck', () => {
    const cases: Array<{ name: string; typeLine: string; oracleText: string; expectedKind: string }> = [
      { name: 'Chatterstorm', typeLine: 'Sorcery', oracleText: 'Create a 1/1 green Squirrel creature token.\nStorm (When you cast this spell, copy it for each spell cast before it this turn.)', expectedKind: 'create_tokens' },
      { name: 'Decree of Pain', typeLine: 'Sorcery', oracleText: "Destroy all creatures. They can't be regenerated. Draw a card for each creature destroyed this way.\nCycling {3}{B}{B} — When you cycle this card, all creatures get -2/-2 until end of turn.", expectedKind: 'draw_cards' },
      { name: 'For the Common Good', typeLine: 'Sorcery', oracleText: "Create X tokens that are copies of target token you control. Then tokens you control gain indestructible until your next turn. You gain 1 life for each token you control.", expectedKind: 'gain_life' },
      { name: 'Maelstrom Pulse', typeLine: 'Sorcery', oracleText: 'Destroy target nonland permanent. Then destroy all other permanents with the same name as that permanent.', expectedKind: 'destroy_target_nonland_permanent' },
      { name: 'Pest Infestation', typeLine: 'Sorcery', oracleText: 'Destroy up to X target artifacts and/or enchantments. Create twice X 1/1 black and green Pest creature tokens with "When this token dies, you gain 1 life."', expectedKind: 'gain_life' },
      { name: 'Plumb the Forbidden', typeLine: 'Instant', oracleText: 'As an additional cost to cast this spell, sacrifice a creature.\nDraw two cards. You lose 2 life.', expectedKind: 'draw_cards' },
      { name: 'Putrefy', typeLine: 'Instant', oracleText: 'Destroy target artifact or creature.', expectedKind: 'destroy_target_nonland_permanent' },
      { name: 'Saw in Half', typeLine: 'Sorcery', oracleText: "Destroy target creature. If that creature dies this way, its controller creates two tokens that are copies of that creature, except their power is half that creature's power and their toughness is half that creature's toughness. Round up each time.", expectedKind: 'destroy_target_creature' },
      { name: 'Shamanic Revelation', typeLine: 'Sorcery', oracleText: 'Draw a card for each creature you control.\nFerocious — You gain 4 life if you control a creature with power 4 or greater.', expectedKind: 'draw_cards' },
      { name: 'Swarmyard Massacre', typeLine: 'Sorcery', oracleText: "Create two 1/1 green Squirrel creature tokens. Then each creature that isn't an Insect, Rat, Spider, or Squirrel gets -1/-1 until end of turn for each creature you control that's an Insect, Rat, Spider, or Squirrel.", expectedKind: 'create_tokens' },
      { name: 'Tear Asunder', typeLine: 'Instant', oracleText: 'Kicker {2}{B} (You may pay an additional {2}{B} as you cast this spell.)\nExile target artifact or enchantment. If this spell was kicked, instead exile target nonland permanent.', expectedKind: 'exile_target_nonland_permanent' },
      { name: 'Second Harvest', typeLine: 'Instant', oracleText: "For each token you control, create a token that's a copy of that permanent.", expectedKind: 'copy_all_tokens' },
    ]
    for (const { name, typeLine, oracleText, expectedKind } of cases) {
      const def = getSimpleSpellDefinition({ name, typeLine, oracleText })
      expect(def, `${name} should have a definition`).not.toBeNull()
      expect(def!.kind, `${name} should map to ${expectedKind}`).toBe(expectedKind)
    }
  })

  it('parses real oracle texts from Auntie Ool Blight deck', () => {
    const cases: Array<{ name: string; typeLine: string; oracleText: string; expectedKind: string }> = [
      { name: "Assassin's Trophy", typeLine: 'Instant', oracleText: "Destroy target permanent an opponent controls. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.", expectedKind: 'destroy_target_permanent' },
      { name: 'Chain Reaction', typeLine: 'Sorcery', oracleText: 'Chain Reaction deals X damage to each creature, where X is the number of creatures on the battlefield.', expectedKind: 'mass_damage_creatures' },
      { name: 'Hoarder\'s Greed', typeLine: 'Sorcery', oracleText: 'Draw three cards. You lose 3 life.', expectedKind: 'draw_cards' },
      { name: 'Incremental Blight', typeLine: 'Sorcery', oracleText: 'Put a -1/-1 counter on target creature, two -1/-1 counters on another target creature, and three -1/-1 counters on a third target creature.', expectedKind: 'put_minus_one_counter_target_creature' },
      { name: 'Infernal Grasp', typeLine: 'Instant', oracleText: 'Destroy target creature. You lose 2 life.', expectedKind: 'destroy_target_creature' },
      { name: "Night's Whisper", typeLine: 'Sorcery', oracleText: 'You draw two cards and you lose 2 life.', expectedKind: 'draw_cards' },
      { name: 'Persist', typeLine: 'Instant', oracleText: 'Return target creature card from your graveyard to the battlefield. That creature gains haste until end of turn.', expectedKind: 'return_graveyard_creature_to_battlefield' },
      { name: 'Putrefy', typeLine: 'Instant', oracleText: 'Destroy target artifact or creature.', expectedKind: 'destroy_target_nonland_permanent' },
      { name: 'Terminate', typeLine: 'Instant', oracleText: "Destroy target creature. It can't be regenerated.", expectedKind: 'destroy_target_creature' },
      { name: 'Aberrant Return', typeLine: 'Sorcery', oracleText: 'Put one, two, or three target creature cards from graveyards onto the battlefield under your control. Each of them enters with an additional -1/-1 counter on it.', expectedKind: 'return_graveyard_creature_to_battlefield' },
      { name: "Eventide's Shadow", typeLine: 'Sorcery', oracleText: 'Remove any number of counters from among permanents on the battlefield. You draw cards and lose life equal to the number of counters removed this way.', expectedKind: 'remove_all_counters_draw_lose_life' },
    ]
    for (const { name, typeLine, oracleText, expectedKind } of cases) {
      const def = getSimpleSpellDefinition({ name, typeLine, oracleText })
      expect(def, `${name} should have a definition`).not.toBeNull()
      expect(def!.kind, `${name} should map to ${expectedKind}`).toBe(expectedKind)
    }
  })

  it('detects Aberrant Return with -1/-1 counter flag', () => {
    const def = getSimpleSpellDefinition({
      name: 'Aberrant Return',
      typeLine: 'Sorcery',
      oracleText: 'Put one, two, or three target creature cards from graveyards onto the battlefield under your control. Each of them enters with an additional -1/-1 counter on it.',
    })
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('return_graveyard_creature_to_battlefield')
    if (def!.kind === 'return_graveyard_creature_to_battlefield') {
      expect(def.target).toBe('any_graveyard_creature')
      expect(def.minusOneCounters).toBe(1)
    }
  })

  it('detects Second Harvest token doubling', () => {
    const def = getSimpleSpellDefinition({
      name: 'Second Harvest',
      typeLine: 'Instant',
      oracleText: "For each token you control, create a token that's a copy of that permanent.",
    })
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('copy_all_tokens')
  })

  it("detects Eventide's Shadow counter removal draw", () => {
    const def = getSimpleSpellDefinition({
      name: "Eventide's Shadow",
      typeLine: 'Sorcery',
      oracleText: 'Remove any number of counters from among permanents on the battlefield. You draw cards and lose life equal to the number of counters removed this way.',
    })
    expect(def).not.toBeNull()
    expect(def!.kind).toBe('remove_all_counters_draw_lose_life')
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

  it('parses generic self-dies triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Doomed Dissenter',
      oracleText: 'When this creature dies, create a 2/2 black Zombie creature token.',
    })
    expect(abilities.some(ability =>
      ability.event === 'creature_dies'
      && ability.match === 'self'
      && ability.effect.kind === 'create_tokens'
      && ability.effect.tokenKey === 'zombie'
    )).toBe(true)
  })

  it('parses token self-dies triggers (Pest tokens)', () => {
    const abilities = getTriggeredAbilities({
      name: 'Pest',
      oracleText: 'When this token dies, you gain 1 life.',
    })
    expect(abilities.some(ability =>
      ability.event === 'creature_dies'
      && ability.match === 'self'
      && ability.effect.kind === 'gain_life'
      && ability.effect.amount === 1
    )).toBe(true)
  })

  it('parses generic another-creature-you-control dies triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Loyal Retainers',
      oracleText: 'Whenever another creature you control dies, draw a card.',
    })
    expect(abilities.some(ability =>
      ability.event === 'creature_dies'
      && ability.match === 'another_creature_you_control'
      && ability.effect.kind === 'draw_cards'
    )).toBe(true)
  })

  it('parses generic any-creature dies triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Grim Watcher',
      oracleText: 'Whenever a creature dies, you gain 1 life.',
    })
    expect(abilities.some(ability =>
      ability.event === 'creature_dies'
      && ability.match === 'any_creature'
      && ability.effect.kind === 'gain_life'
    )).toBe(true)
  })

  it('does not misparse persist reminder text as a dies trigger', () => {
    const abilities = getTriggeredAbilities({
      name: 'Safehold Elite',
      oracleText: "Persist (When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner's control with a -1/-1 counter on it.)",
    })
    expect(abilities.filter(ability => ability.event === 'creature_dies')).toHaveLength(1)
    expect(abilities[0].effect.kind).toBe('persist_self')
  })

  it('parses generic upkeep triggers beyond token creation', () => {
    const abilities = getTriggeredAbilities({
      name: 'Verdant Cycle',
      oracleText: 'At the beginning of your upkeep, put a +1/+1 counter on each creature.',
    })
    const upkeep = abilities.find(ability => ability.event === 'upkeep' && ability.match === 'your_upkeep')
    expect(upkeep).toBeDefined()
    expect(upkeep!.effect.kind).toBe('generic')
    if (upkeep!.effect.kind === 'generic') {
      expect(upkeep!.effect.effects).toEqual([
        { kind: 'put_counters_each', counter: 'plusOne', amount: 1, scope: 'each_creature' },
      ])
    }
  })

  it('parses generic end step triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Twilight Prophet Effect',
      oracleText: 'At the beginning of your end step, you gain 2 life.',
    })
    expect(abilities.some(ability =>
      ability.event === 'end_step'
      && ability.match === 'your_end_step'
      && ability.effect.kind === 'gain_life'
    )).toBe(true)
  })

  it('parses combat damage to player triggers (Hapatra)', () => {
    const abilities = getTriggeredAbilities({
      name: 'Hapatra, Vizier of Poisons',
      oracleText: 'Whenever Hapatra, Vizier of Poisons deals combat damage to a player, you may put a -1/-1 counter on target creature.\nWhenever you put one or more -1/-1 counters on a creature, create a 1/1 green Snake creature token with deathtouch.',
    })
    const combat = abilities.find(ability => ability.event === 'combat_damage_to_player')
    expect(combat).toBeDefined()
    expect(combat!.match).toBe('self')
    expect(combat!.effect.kind).toBe('put_minus_one_counter_target_creature')
    expect(combat!.target).toBe('battlefield_creature')
    expect(abilities.some(ability => ability.event === 'minus_one_counters_placed')).toBe(true)
  })

  it('parses combat damage triggers with this-creature wording', () => {
    const abilities = getTriggeredAbilities({
      name: 'Thieving Magpie Effect',
      oracleText: 'Whenever this creature deals combat damage to a player, draw a card.',
    })
    expect(abilities.some(ability =>
      ability.event === 'combat_damage_to_player'
      && ability.match === 'self'
      && ability.effect.kind === 'draw_cards'
    )).toBe(true)
  })

  it('parses whenever-you-draw triggers', () => {
    const abilities = getTriggeredAbilities({
      name: 'Sylvan Archivist',
      oracleText: 'Whenever you draw a card, create a Treasure token.',
    })
    expect(abilities.some(ability =>
      ability.event === 'card_drawn'
      && ability.match === 'you_draw_card'
      && ability.effect.kind === 'create_tokens'
    )).toBe(true)
  })

  it('parses whenever-you-cast triggers with generic bodies', () => {
    const abilities = getTriggeredAbilities({
      name: 'Aetherflux Adept',
      oracleText: 'Whenever you cast a spell, you gain 1 life.',
    })
    expect(abilities.some(ability =>
      ability.event === 'spell_cast'
      && ability.match === 'spell_you_cast'
      && ability.effect.kind === 'gain_life'
    )).toBe(true)
  })

  it('parses triggered abilities from real oracle texts across both decks', () => {
    const cases: Array<{ name: string; oracleText: string; event: string; effectKind: string }> = [
      // Hazel Squirrels deck
      { name: 'Grave Titan', oracleText: 'Deathtouch\nWhenever Grave Titan enters the battlefield or attacks, create two 2/2 black Zombie creature tokens.', event: 'enters_battlefield', effectKind: 'create_tokens' },
      { name: 'Deep Forest Hermit', oracleText: 'Echo {3}{G} (At the beginning of your upkeep, if this came under your control since the beginning of your most recent upkeep, sacrifice it unless you pay its echo cost.)\nWhen Deep Forest Hermit enters the battlefield, create four 1/1 green Squirrel creature tokens.', event: 'enters_battlefield', effectKind: 'create_tokens' },
      { name: 'Chittering Witch', oracleText: 'When Chittering Witch enters the battlefield, create a number of 1/1 black Rat creature tokens equal to the number of opponents you have.\n{1}{B}, Sacrifice a creature: Target creature gets -2/-2 until end of turn.', event: 'enters_battlefield', effectKind: 'create_tokens' },
      { name: 'Tendershoot Dryad', oracleText: 'Ascend (If you control ten or more permanents, you get the city\'s blessing for the rest of the game.)\nAt the beginning of each upkeep, create a 1/1 green Saproling creature token.\nSaprolings you control get +2/+2 as long as you have the city\'s blessing.', event: 'upkeep', effectKind: 'create_tokens' },
      { name: 'Poison-Tip Archer', oracleText: 'Reach, deathtouch\nWhenever another creature dies, each opponent loses 1 life.', event: 'creature_dies', effectKind: 'drain_each_opponent' },
      { name: 'Prosperous Innkeeper', oracleText: 'When Prosperous Innkeeper enters the battlefield, create a Treasure token.\nWhenever another creature enters the battlefield under your control, you gain 1 life.', event: 'creature_enters', effectKind: 'gain_life' },
      { name: 'Mirkwood Bats', oracleText: 'Flying\nWhenever you create or sacrifice a token, each opponent loses 1 life.', event: 'token_created', effectKind: 'drain_each_opponent' },
      // Auntie Ool Blight deck
      { name: 'Skinrender', oracleText: 'When Skinrender enters the battlefield, put three -1/-1 counters on target creature.', event: 'enters_battlefield', effectKind: 'put_minus_one_counter_target_creature' },
      { name: 'Hapatra, Vizier of Poisons', oracleText: 'Whenever Hapatra, Vizier of Poisons deals combat damage to a player, you may put a -1/-1 counter on target creature.\nWhenever you put one or more -1/-1 counters on a creature, create a 1/1 green Snake creature token with deathtouch.', event: 'combat_damage_to_player', effectKind: 'put_minus_one_counter_target_creature' },
      { name: 'Puppeteer Clique', oracleText: "Flying\nWhen Puppeteer Clique enters the battlefield, put target creature card from an opponent's graveyard onto the battlefield under your control. It gains haste. At the beginning of your end step, exile it.\nPersist (When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner's control with a -1/-1 counter on it.)", event: 'enters_battlefield', effectKind: 'return_graveyard_creature_to_battlefield' },
      { name: 'Contagion Clasp', oracleText: 'When Contagion Clasp enters the battlefield, put a -1/-1 counter on target creature.\n{4}, {T}: Proliferate.', event: 'enters_battlefield', effectKind: 'put_minus_one_counter_target_creature' },
    ]
    for (const { name, oracleText, event, effectKind } of cases) {
      const abilities = getTriggeredAbilities({ name, oracleText })
      expect(
        abilities.some(ability => ability.event === event && ability.effect.kind === effectKind),
        `${name} should parse a ${event} trigger with ${effectKind} effect`
      ).toBe(true)
    }
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

// ---------------------------------------------------------------------------
// Generic activated abilities (Phase 3)
// ---------------------------------------------------------------------------

describe('Generic activated ability parsing', () => {
  const noCommander = { commander: null }

  it('parses a mana-plus-tap token creator (Chitterspitter)', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'Chitterspitter',
      typeLine: 'Artifact',
      oracleText: '{G}, {T}: Create a 1/1 green Squirrel creature token.',
    }), noCommander)

    expect(abilities).toHaveLength(1)
    const ability = abilities[0]
    if (ability.kind !== 'generic') throw new Error('expected generic ability')
    expect(ability.cost.mana).toBe('{G}')
    expect(ability.cost.tapSource).toBe(true)
    expect(ability.effects).toEqual([{ kind: 'create_tokens', tokenKey: 'squirrel', count: 1, tapped: false }])
    expect(ability.target).toBeNull()
  })

  it('parses all three Gilded Goose abilities including sac-a-Food any-color mana', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'Gilded Goose',
      typeLine: 'Creature — Bird',
      power: 0,
      toughness: 2,
      oracleText: [
        'Flying',
        "When this creature enters, create a Food token. (It's an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")",
        '{1}{G}, {T}: Create a Food token.',
        '{T}, Sacrifice a Food: Add one mana of any color.',
      ].join('\n'),
    }), noCommander)

    const createFood = abilities.filter(ability => ability.kind === 'generic' && ability.effects.some(effect => effect.kind === 'create_tokens'))
    expect(createFood).toHaveLength(1)

    const manaVariants = abilities.filter(ability => ability.kind === 'generic' && ability.effects.some(effect => effect.kind === 'add_mana'))
    expect(manaVariants).toHaveLength(5)
    for (const variant of manaVariants) {
      if (variant.kind !== 'generic') continue
      expect(variant.cost.sacrificePermanent).toEqual({ typeWords: ['food'], count: 1 })
    }
  })

  it('limits any-color mana variants to commander color identity', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: "Wickersmith's Tools",
      typeLine: 'Artifact',
      oracleText: '{T}: Add one mana of any color.',
    }), { commander: { scryfallId: 'test-ool', name: 'Auntie Ool', imageUri: '', colorIdentity: ['B', 'R'], manaCost: null, oracleText: null, typeLine: 'Legendary Creature', power: 4, toughness: 4, loyalty: null } })

    expect(abilities).toHaveLength(2)
    const colors = abilities.map(ability => ability.kind === 'generic' && ability.effects[0]?.kind === 'add_mana' ? ability.effects[0].color : null)
    expect(colors).toEqual(['B', 'R'])
  })

  it('parses compound gain-life-and-draw with a heterogeneous sacrifice cost (Ravenous Squirrel)', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'Ravenous Squirrel',
      typeLine: 'Creature — Squirrel',
      power: 1,
      toughness: 1,
      oracleText: '{1}{B}{G}, Sacrifice an artifact or creature: You gain 1 life and draw a card.',
    }), noCommander)

    expect(abilities).toHaveLength(1)
    const ability = abilities[0]
    if (ability.kind !== 'generic') throw new Error('expected generic ability')
    expect(ability.cost.mana).toBe('{1}{B}{G}')
    expect(ability.cost.sacrificePermanent).toEqual({ typeWords: ['artifact', 'creature'], count: 1 })
    expect(ability.effects).toEqual([
      { kind: 'gain_life', amount: 1 },
      { kind: 'draw_cards', amount: 1 },
    ])
  })

  it('parses remove-counter costs with board-wide counter effects (Carnifex Demon)', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'Carnifex Demon',
      typeLine: 'Creature — Phyrexian Demon',
      power: 6,
      toughness: 6,
      oracleText: '{B}, Remove a -1/-1 counter from this creature: Put a -1/-1 counter on each other creature.',
    }), noCommander)

    expect(abilities).toHaveLength(1)
    const ability = abilities[0]
    if (ability.kind !== 'generic') throw new Error('expected generic ability')
    expect(ability.cost.removeCounters).toEqual({ counter: 'minusOne', amount: 1 })
    expect(ability.effects).toEqual([{ kind: 'put_counters_each', counter: 'minusOne', amount: 1, scope: 'each_other_creature' }])
  })

  it('parses targeted counter placement with another-restriction (The Scorpion God, Grim Poppet)', () => {
    const scorpion = getActivatedAbilities(makeCard({
      name: 'The Scorpion God',
      typeLine: 'Legendary Creature — God',
      power: 6,
      toughness: 5,
      oracleText: '{1}{B}{R}: Put a -1/-1 counter on another target creature.',
    }), noCommander)
    expect(scorpion).toHaveLength(1)
    const scorpionAbility = scorpion[0]
    if (scorpionAbility.kind !== 'generic') throw new Error('expected generic ability')
    expect(scorpionAbility.target).toBe('battlefield_creature')
    expect(scorpionAbility.effects).toEqual([{ kind: 'put_counters_target_creature', counter: 'minusOne', amount: 1, restriction: 'another' }])

    const poppet = getActivatedAbilities(makeCard({
      name: 'Grim Poppet',
      typeLine: 'Artifact Creature — Scarecrow',
      power: 0,
      toughness: 0,
      oracleText: 'This creature enters with three -1/-1 counters on it.\nRemove a -1/-1 counter from this creature: Put a -1/-1 counter on another target creature.',
    }), noCommander)
    expect(poppet).toHaveLength(1)
  })

  it('parses proliferate and ignores sorcery-speed restrictions (Contagion Clasp)', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'Contagion Clasp',
      typeLine: 'Artifact',
      oracleText: 'When this artifact enters, put a -1/-1 counter on target creature.\n{4}, {T}: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)',
    }), noCommander)

    const proliferate = abilities.find(ability => ability.kind === 'generic' && ability.effects.some(effect => effect.kind === 'proliferate'))
    expect(proliferate).toBeDefined()
    if (proliferate?.kind !== 'generic') throw new Error('expected generic ability')
    expect(proliferate.cost.mana).toBe('{4}')
    expect(proliferate.cost.tapSource).toBe(true)
  })

  it('parses mana with a self-damage rider (Talisman of Resilience)', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'Talisman of Resilience',
      typeLine: 'Artifact',
      oracleText: '{T}: Add {C}.\n{T}: Add {B} or {G}. This artifact deals 1 damage to you.',
    }), noCommander)

    const painVariants = abilities.filter(ability => ability.kind === 'generic' && ability.effects.some(effect => effect.kind === 'lose_life'))
    expect(painVariants).toHaveLength(2)
    const colors = painVariants.map(ability => ability.kind === 'generic' && ability.effects[0]?.kind === 'add_mana' ? ability.effects[0].color : null)
    expect(colors).toEqual(['B', 'G'])
  })

  it('parses land non-mana ability lines while skipping mana-only lines (Ifnir Deadlands)', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'Ifnir Deadlands',
      typeLine: 'Land — Desert',
      oracleText: '{T}: Add {C}.\n{T}, Pay 1 life: Add {B}.\n{2}{B}{B}, {T}, Sacrifice a Desert: Put two -1/-1 counters on target creature an opponent controls. Activate only as a sorcery.',
    }), noCommander)

    const generic = abilities.filter(ability => ability.kind === 'generic')
    expect(generic).toHaveLength(1)
    const desertSac = generic[0]
    if (desertSac.kind !== 'generic') throw new Error('expected generic ability')
    expect(desertSac.cost.sacrificePermanent).toEqual({ typeWords: ['desert'], count: 1 })
    expect(desertSac.cost.mana).toBe('{2}{B}{B}')
    expect(desertSac.effects).toEqual([{ kind: 'put_counters_target_creature', counter: 'minusOne', amount: 2, restriction: 'opponent_controls' }])
  })

  it('parses tap-untapped-creature costs (The Shire)', () => {
    const abilities = getActivatedAbilities(makeCard({
      name: 'The Shire',
      typeLine: 'Legendary Land',
      oracleText: '{T}: Add {G}.\n{1}{G}, {T}, Tap an untapped creature you control: Create a Food token.',
    }), noCommander)

    const generic = abilities.filter(ability => ability.kind === 'generic')
    expect(generic).toHaveLength(1)
    const foodAbility = generic[0]
    if (foodAbility.kind !== 'generic') throw new Error('expected generic ability')
    expect(foodAbility.cost.tapUntappedCreatures).toBe(1)
    expect(foodAbility.effects).toEqual([{ kind: 'create_tokens', tokenKey: 'food', count: 1, tapped: false }])
  })

  it('skips conditional activations, granted abilities, cycling, and unknown effects', () => {
    const idol = getActivatedAbilities(makeCard({
      name: 'Idol of Oblivion',
      typeLine: 'Artifact',
      oracleText: '{T}: Draw a card. Activate only if you created a token this turn.\n{8}, {T}, Sacrifice this artifact: Create a 10/10 colorless Eldrazi creature token.',
    }), noCommander)
    expect(idol).toHaveLength(0)

    const nest = getActivatedAbilities(makeCard({
      name: 'Squirrel Nest',
      typeLine: 'Enchantment — Aura',
      oracleText: 'Enchant land\nEnchanted land has "{T}: Create a 1/1 green Squirrel creature token."',
    }), noCommander)
    expect(nest).toHaveLength(0)

    const thicket = getActivatedAbilities(makeCard({
      name: 'Tranquil Thicket',
      typeLine: 'Land',
      oracleText: 'This land enters tapped.\n{T}: Add {G}.\nCycling {G} ({G}, Discard this card: Draw a card.)',
    }), noCommander)
    expect(thicket.filter(ability => ability.kind === 'generic')).toHaveLength(0)

    const beledros = getActivatedAbilities(makeCard({
      name: 'Beledros Witherbloom',
      typeLine: 'Legendary Creature — Elder Dragon',
      power: 4,
      toughness: 4,
      oracleText: 'Pay 10 life: Untap all lands you control. Activate only once each turn.',
    }), noCommander)
    expect(beledros).toHaveLength(0)
  })
})

describe('Activated ability oracle-text coverage', () => {
  it('parses activated abilities from real oracle texts across both decks', () => {
    const noCommander = { commander: null }
    const cases: Array<{ name: string; typeLine: string; oracleText: string; expectGeneric: boolean; expectedEffectKind?: string }> = [
      { name: 'Chitterspitter', typeLine: 'Artifact', oracleText: '{G}, {T}: Create a 1/1 green Squirrel creature token.', expectGeneric: true, expectedEffectKind: 'create_tokens' },
      { name: 'Gilded Goose', typeLine: 'Creature — Bird', oracleText: '{1}{G}, {T}: Create a Food token.\n{T}, Sacrifice a Food: Add one mana of any color.', expectGeneric: true, expectedEffectKind: 'create_tokens' },
      { name: 'Ravenous Squirrel', typeLine: 'Creature — Squirrel', oracleText: '{1}{B}{G}, Sacrifice an artifact or creature: You gain 1 life and draw a card.', expectGeneric: true, expectedEffectKind: 'gain_life' },
      { name: 'The Shire', typeLine: 'Legendary Land', oracleText: '{T}: Add {G}.\n{1}{G}, {T}, Tap an untapped creature you control: Create a Food token.', expectGeneric: true, expectedEffectKind: 'create_tokens' },
      { name: 'Carnifex Demon', typeLine: 'Creature — Phyrexian Demon', oracleText: '{B}, Remove a -1/-1 counter from this creature: Put a -1/-1 counter on each other creature.', expectGeneric: true, expectedEffectKind: 'put_counters_each' },
      { name: 'Contagion Clasp', typeLine: 'Artifact', oracleText: '{4}, {T}: Proliferate.', expectGeneric: true, expectedEffectKind: 'proliferate' },
      { name: 'Grim Poppet', typeLine: 'Artifact Creature — Scarecrow', oracleText: 'Remove a -1/-1 counter from this creature: Put a -1/-1 counter on another target creature.', expectGeneric: true, expectedEffectKind: 'put_counters_target_creature' },
      { name: 'The Scorpion God', typeLine: 'Legendary Creature — God', oracleText: '{1}{B}{R}: Put a -1/-1 counter on another target creature.', expectGeneric: true, expectedEffectKind: 'put_counters_target_creature' },
      { name: 'Talisman of Resilience', typeLine: 'Artifact', oracleText: '{T}: Add {C}.\n{T}: Add {B} or {G}. This artifact deals 1 damage to you.', expectGeneric: true, expectedEffectKind: 'add_mana' },
      { name: "Wickersmith's Tools", typeLine: 'Artifact', oracleText: '{T}: Add one mana of any color.', expectGeneric: true, expectedEffectKind: 'add_mana' },
      { name: 'Ifnir Deadlands', typeLine: 'Land — Desert', oracleText: '{T}: Add {C}.\n{2}{B}{B}, {T}, Sacrifice a Desert: Put two -1/-1 counters on target creature an opponent controls. Activate only as a sorcery.', expectGeneric: true, expectedEffectKind: 'put_counters_target_creature' },
    ]

    for (const testCase of cases) {
      const abilities = getActivatedAbilities(makeCard({
        name: testCase.name,
        typeLine: testCase.typeLine,
        oracleText: testCase.oracleText,
        power: testCase.typeLine.includes('Creature') ? 2 : null,
        toughness: testCase.typeLine.includes('Creature') ? 2 : null,
      }), noCommander)

      const generic = abilities.filter(ability => ability.kind === 'generic')
      expect(generic.length, `${testCase.name} should parse a generic ability`).toBeGreaterThan(0)
      if (testCase.expectedEffectKind) {
        const hasEffect = generic.some(ability =>
          ability.kind === 'generic' && ability.effects.some(effect => effect.kind === testCase.expectedEffectKind)
        )
        expect(hasEffect, `${testCase.name} should include a ${testCase.expectedEffectKind} effect`).toBe(true)
      }
    }
  })
})
