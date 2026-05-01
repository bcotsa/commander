import { describe, it, expect, beforeEach } from 'vitest'
import { gameReducer, createInitialGameState, createPlayer } from '../game-reducer'
import type { GameState, GameCard, Player } from '@/types/game-state'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<GameCard> = {}): GameCard {
  return {
    instanceId: overrides.instanceId ?? `card-${crypto.randomUUID()}`,
    scryfallId: null,
    name: overrides.name ?? 'Test Card',
    imageUri: '',
    colorIdentity: [],
    manaCost: null,
    oracleText: null,
    typeLine: overrides.typeLine ?? 'Creature — Human',
    power: overrides.power ?? 2,
    toughness: overrides.toughness ?? 2,
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

function makeLand(overrides: Partial<GameCard> = {}): GameCard {
  return makeCard({
    name: overrides.name ?? 'Forest',
    typeLine: 'Basic Land — Forest',
    power: null,
    toughness: null,
    manaCost: null,
    oracleText: '{T}: Add {G}.',
    ...overrides,
  })
}

function withActiveTurn(state: GameState, currentTurnIndex = 0): GameState {
  return {
    ...state,
    phase: 'active',
    currentTurnIndex,
    currentPhase: 'main1',
    players: state.players.map(player => ({
      ...player,
      hasKeptOpeningHand: true,
    })),
  }
}

/** Create a 2-player game state in the active phase, ready for actions */
function twoPlayerGame(): GameState {
  let state = createInitialGameState('TEST', 'room-1')
  const p1 = createPlayer('p1', 'Alice', 0)
  const p2 = createPlayer('p2', 'Bob', 1)
  state = gameReducer(state, { type: 'PLAYER_JOIN', player: p1 })
  state = gameReducer(state, { type: 'PLAYER_JOIN', player: p2 })
  return withActiveTurn(state)
}

function getPlayer(state: GameState, id: string): Player {
  const p = state.players.find(p => p.id === id)
  if (!p) throw new Error(`Player ${id} not found`)
  return p
}

// ---------------------------------------------------------------------------
// Life & Elimination
// ---------------------------------------------------------------------------

describe('Life changes', () => {
  let state: GameState

  beforeEach(() => {
    state = twoPlayerGame()
  })

  it('increases life', () => {
    const next = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p1', delta: 5 })
    expect(getPlayer(next, 'p1').life).toBe(45)
  })

  it('decreases life', () => {
    const next = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p2', delta: -10 })
    expect(getPlayer(next, 'p2').life).toBe(30)
  })

  it('eliminates a player at 0 life', () => {
    const next = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p1', delta: -40 })
    expect(getPlayer(next, 'p1').isEliminated).toBe(true)
  })

  it('eliminates a player below 0 life', () => {
    const next = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p1', delta: -100 })
    expect(getPlayer(next, 'p1').isEliminated).toBe(true)
    expect(getPlayer(next, 'p1').life).toBe(-60)
  })

  it('does not eliminate at 1 life', () => {
    const next = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p1', delta: -39 })
    expect(getPlayer(next, 'p1').isEliminated).toBe(false)
    expect(getPlayer(next, 'p1').life).toBe(1)
  })

  it('logs life changes', () => {
    const next = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p1', delta: -5 })
    expect(next.log.length).toBeGreaterThan(0)
    expect(next.log[next.log.length - 1].description).toContain('Alice')
  })
})

describe('Commander damage', () => {
  let state: GameState

  beforeEach(() => {
    state = twoPlayerGame()
  })

  it('tracks commander damage by source', () => {
    const next = gameReducer(state, { type: 'COMMANDER_DAMAGE', fromId: 'p1', toId: 'p2', delta: 5 })
    expect(getPlayer(next, 'p2').commanderDamage['p1']).toBe(5)
  })

  it('accumulates commander damage', () => {
    let next = gameReducer(state, { type: 'COMMANDER_DAMAGE', fromId: 'p1', toId: 'p2', delta: 10 })
    next = gameReducer(next, { type: 'COMMANDER_DAMAGE', fromId: 'p1', toId: 'p2', delta: 11 })
    expect(getPlayer(next, 'p2').commanderDamage['p1']).toBe(21)
    expect(getPlayer(next, 'p2').isEliminated).toBe(true)
  })

  it('does not cross-contaminate sources', () => {
    let next = gameReducer(state, { type: 'COMMANDER_DAMAGE', fromId: 'p1', toId: 'p2', delta: 15 })
    next = gameReducer(next, { type: 'COMMANDER_DAMAGE', fromId: 'p2', toId: 'p2', delta: 5 })
    expect(getPlayer(next, 'p2').commanderDamage['p1']).toBe(15)
    expect(getPlayer(next, 'p2').commanderDamage['p2']).toBe(5)
    expect(getPlayer(next, 'p2').isEliminated).toBe(false)
  })
})

describe('Poison counters', () => {
  let state: GameState

  beforeEach(() => {
    state = twoPlayerGame()
  })

  it('eliminates at 10 poison', () => {
    let next = state
    for (let i = 0; i < 10; i++) {
      next = gameReducer(next, { type: 'COUNTER_CHANGE', targetId: 'p1', counter: 'poison', delta: 1 })
    }
    expect(getPlayer(next, 'p1').counters.poison).toBe(10)
    expect(getPlayer(next, 'p1').isEliminated).toBe(true)
  })

  it('does not eliminate at 9 poison', () => {
    let next = state
    for (let i = 0; i < 9; i++) {
      next = gameReducer(next, { type: 'COUNTER_CHANGE', targetId: 'p1', counter: 'poison', delta: 1 })
    }
    expect(getPlayer(next, 'p1').isEliminated).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Turn phases
// ---------------------------------------------------------------------------

describe('Turn phases', () => {
  let state: GameState

  beforeEach(() => {
    state = twoPlayerGame()
  })

  it('advances through main1 → combat → main2 → end', () => {
    // We start at main1 (auto-advance skips untap/upkeep/draw)
    expect(state.currentPhase).toBe('main1')

    let next = gameReducer(state, { type: 'NEXT_STEP' })
    expect(next.currentPhase).toBe('combat')

    next = gameReducer(next, { type: 'NEXT_STEP' })
    expect(next.currentPhase).toBe('main2')

    next = gameReducer(next, { type: 'NEXT_STEP' })
    expect(next.currentPhase).toBe('end')
  })

  it('wraps to next player turn after end phase', () => {
    let next = state
    // Advance through all remaining phases: main1 → combat → main2 → end → next turn
    next = gameReducer(next, { type: 'NEXT_STEP' }) // combat
    next = gameReducer(next, { type: 'NEXT_STEP' }) // main2
    next = gameReducer(next, { type: 'NEXT_STEP' }) // end
    next = gameReducer(next, { type: 'NEXT_STEP' }) // next turn (auto-advances to main1)

    expect(next.currentTurnIndex).toBe(1)
    expect(next.currentPhase).toBe('main1')
  })

  it('increments round after all players have taken a turn', () => {
    let next = state
    expect(next.round).toBe(1)

    // P1's turn: main1 → combat → main2 → end → wrap
    for (let i = 0; i < 4; i++) next = gameReducer(next, { type: 'NEXT_STEP' })
    // P2's turn: main1 → combat → main2 → end → wrap
    for (let i = 0; i < 4; i++) next = gameReducer(next, { type: 'NEXT_STEP' })

    expect(next.round).toBe(2)
    expect(next.currentTurnIndex).toBe(0)
  })

  it('does not advance when stack is non-empty', () => {
    const card = makeCard({ name: 'Test Creature', manaCost: '{1}' })
    const withStack: GameState = {
      ...state,
      stack: [{
        id: 'stack-1',
        card,
        casterId: 'p1',
        casterName: 'Alice',
        source: 'hand',
        kind: 'permanent',
      }],
    }

    const next = gameReducer(withStack, { type: 'NEXT_STEP' })
    expect(next.currentPhase).toBe(withStack.currentPhase)
  })
})

// ---------------------------------------------------------------------------
// Player management
// ---------------------------------------------------------------------------

describe('Player join', () => {
  it('adds a new player', () => {
    let state = createInitialGameState('TEST', 'room-1')
    state = gameReducer(state, { type: 'PLAYER_JOIN', player: createPlayer('p1', 'Alice', 0) })
    expect(state.players).toHaveLength(1)
    expect(state.players[0].name).toBe('Alice')
    expect(state.turnOrder).toContain('p1')
  })

  it('reconnects existing player instead of duplicating', () => {
    let state = createInitialGameState('TEST', 'room-1')
    state = gameReducer(state, { type: 'PLAYER_JOIN', player: createPlayer('p1', 'Alice', 0) })
    state = gameReducer(state, { type: 'PLAYER_CONNECTED', playerId: 'p1', connected: false })
    expect(getPlayer(state, 'p1').isConnected).toBe(false)

    state = gameReducer(state, { type: 'PLAYER_JOIN', player: createPlayer('p1', 'Alice', 0) })
    expect(state.players).toHaveLength(1)
    expect(getPlayer(state, 'p1').isConnected).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Card drawing
// ---------------------------------------------------------------------------

describe('Draw card', () => {
  let state: GameState

  beforeEach(() => {
    state = twoPlayerGame()
    // Give p1 some library cards
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? {
              ...p,
              zones: {
                ...p.zones,
                library: [makeCard({ name: 'Card A' }), makeCard({ name: 'Card B' }), makeCard({ name: 'Card C' })],
              },
            }
          : p
      ),
    }
  })

  it('draws 1 card by default', () => {
    const next = gameReducer(state, { type: 'DRAW_CARD', playerId: 'p1' })
    const p1 = getPlayer(next, 'p1')
    expect(p1.zones.hand).toHaveLength(1)
    expect(p1.zones.library).toHaveLength(2)
    expect(p1.zones.hand[0].name).toBe('Card A')
  })

  it('draws multiple cards', () => {
    const next = gameReducer(state, { type: 'DRAW_CARD', playerId: 'p1', count: 3 })
    const p1 = getPlayer(next, 'p1')
    expect(p1.zones.hand).toHaveLength(3)
    expect(p1.zones.library).toHaveLength(0)
  })

  it('handles drawing from empty library gracefully', () => {
    const emptyLib = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1' ? { ...p, zones: { ...p.zones, library: [] } } : p
      ),
    }
    const next = gameReducer(emptyLib, { type: 'DRAW_CARD', playerId: 'p1' })
    expect(getPlayer(next, 'p1').zones.hand).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Land playing
// ---------------------------------------------------------------------------

describe('Play land', () => {
  let state: GameState
  let forestId: string

  beforeEach(() => {
    state = twoPlayerGame()
    const forest = makeLand({ name: 'Forest' })
    forestId = forest.instanceId
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? { ...p, zones: { ...p.zones, hand: [forest] } }
          : p
      ),
    }
  })

  it('moves land from hand to lands zone', () => {
    const next = gameReducer(state, { type: 'PLAY_LAND', playerId: 'p1', cardId: forestId })
    const p1 = getPlayer(next, 'p1')
    expect(p1.zones.hand).toHaveLength(0)
    expect(p1.zones.lands).toHaveLength(1)
    expect(p1.zones.lands[0].name).toBe('Forest')
  })

  it('increments lands played this turn', () => {
    const next = gameReducer(state, { type: 'PLAY_LAND', playerId: 'p1', cardId: forestId })
    expect(getPlayer(next, 'p1').landsPlayedThisTurn).toBe(1)
  })

  it('blocks second land play per turn', () => {
    let next = gameReducer(state, { type: 'PLAY_LAND', playerId: 'p1', cardId: forestId })
    const secondForest = makeLand({ name: 'Forest 2' })
    next = {
      ...next,
      players: next.players.map(p =>
        p.id === 'p1'
          ? { ...p, zones: { ...p.zones, hand: [secondForest] } }
          : p
      ),
    }
    const after = gameReducer(next, { type: 'PLAY_LAND', playerId: 'p1', cardId: secondForest.instanceId })
    // Second land should be blocked
    expect(getPlayer(after, 'p1').zones.lands).toHaveLength(1)
    expect(getPlayer(after, 'p1').zones.hand).toHaveLength(1)
  })

  it('blocks land play outside main phase', () => {
    const combatState = { ...state, currentPhase: 'combat' as const }
    const next = gameReducer(combatState, { type: 'PLAY_LAND', playerId: 'p1', cardId: forestId })
    expect(getPlayer(next, 'p1').zones.hand).toHaveLength(1) // unchanged
  })

  it('blocks land play by non-active player', () => {
    // p2's turn
    const p2Turn = { ...state, currentTurnIndex: 1 }
    const next = gameReducer(p2Turn, { type: 'PLAY_LAND', playerId: 'p1', cardId: forestId })
    expect(getPlayer(next, 'p1').zones.hand).toHaveLength(1) // unchanged
  })
})

// ---------------------------------------------------------------------------
// Mana
// ---------------------------------------------------------------------------

describe('Mana tapping', () => {
  let state: GameState
  let forestId: string

  beforeEach(() => {
    state = twoPlayerGame()
    const forest = makeLand({ name: 'Forest' })
    forestId = forest.instanceId
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? { ...p, zones: { ...p.zones, lands: [forest] } }
          : p
      ),
    }
  })

  it('adds mana and taps the land', () => {
    const next = gameReducer(state, { type: 'ADD_MANA', playerId: 'p1', cardId: forestId, color: 'G' })
    const p1 = getPlayer(next, 'p1')
    expect(p1.manaPool.G).toBe(1)
    expect(p1.zones.lands[0].tapped).toBe(true)
  })

  it('cannot tap an already-tapped land', () => {
    let next = gameReducer(state, { type: 'ADD_MANA', playerId: 'p1', cardId: forestId, color: 'G' })
    next = gameReducer(next, { type: 'ADD_MANA', playerId: 'p1', cardId: forestId, color: 'G' })
    expect(getPlayer(next, 'p1').manaPool.G).toBe(1) // still just 1
  })

  it('rejects wrong color for the land', () => {
    const next = gameReducer(state, { type: 'ADD_MANA', playerId: 'p1', cardId: forestId, color: 'U' })
    expect(getPlayer(next, 'p1').manaPool.U).toBe(0) // unchanged
  })
})

// ---------------------------------------------------------------------------
// Move card between zones
// ---------------------------------------------------------------------------

describe('Move card', () => {
  let state: GameState
  let cardId: string

  beforeEach(() => {
    state = twoPlayerGame()
    const card = makeCard({ name: 'Test Creature' })
    cardId = card.instanceId
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? { ...p, zones: { ...p.zones, hand: [card] } }
          : p
      ),
    }
  })

  it('moves card from hand to graveyard', () => {
    const next = gameReducer(state, { type: 'MOVE_CARD', playerId: 'p1', from: 'hand', to: 'graveyard', cardId })
    const p1 = getPlayer(next, 'p1')
    expect(p1.zones.hand).toHaveLength(0)
    expect(p1.zones.graveyard).toHaveLength(1)
    expect(p1.zones.graveyard[0].name).toBe('Test Creature')
  })

  it('untaps card when moving to non-battlefield zone', () => {
    // Put a tapped card on battlefield
    const tappedCard = makeCard({ name: 'Tapped Guy', tapped: true })
    const s = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? { ...p, zones: { ...p.zones, battlefield: [tappedCard] } }
          : p
      ),
    }
    const next = gameReducer(s, { type: 'MOVE_CARD', playerId: 'p1', from: 'battlefield', to: 'hand', cardId: tappedCard.instanceId })
    expect(getPlayer(next, 'p1').zones.hand[0].tapped).toBe(false)
  })

  it('clears battlefield-only modifiers when a creature enters the graveyard', () => {
    const modifiedCreature = makeCard({
      name: 'Modified Guy',
      tapped: true,
      markedDamage: 2,
      plusOneCounters: 3,
      minusOneCounters: 1,
      summoningSick: true,
    })
    const s = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? { ...p, zones: { ...p.zones, battlefield: [modifiedCreature] } }
          : p
      ),
    }

    const next = gameReducer(s, {
      type: 'MOVE_CARD',
      playerId: 'p1',
      from: 'battlefield',
      to: 'graveyard',
      cardId: modifiedCreature.instanceId,
    })
    const graveyardCard = getPlayer(next, 'p1').zones.graveyard[0]

    expect(graveyardCard.tapped).toBe(false)
    expect(graveyardCard.markedDamage).toBe(0)
    expect(graveyardCard.plusOneCounters).toBe(0)
    expect(graveyardCard.minusOneCounters).toBe(0)
    expect(graveyardCard.summoningSick).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Stack & priority
// ---------------------------------------------------------------------------

describe('Stack and priority', () => {
  let state: GameState

  beforeEach(() => {
    state = twoPlayerGame()
    // Put a spell card in p1's hand
    const card = makeCard({
      name: 'Lightning Bolt',
      typeLine: 'Instant',
      manaCost: '{R}',
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
      power: null,
      toughness: null,
    })
    const mountain = makeLand({
      name: 'Mountain',
      typeLine: 'Basic Land — Mountain',
      oracleText: '{T}: Add {R}.',
    })
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? { ...p, zones: { ...p.zones, hand: [card], lands: [mountain] } }
          : p
      ),
    }
  })

  it('pass priority resolves when all players have passed', () => {
    // Manually put something on the stack
    const card = makeCard({ name: 'Some Spell', typeLine: 'Instant', power: null, toughness: null })
    const withStack: GameState = {
      ...state,
      stack: [{
        id: 'stack-1',
        card,
        casterId: 'p1',
        casterName: 'Alice',
        source: 'hand',
        kind: 'spell',
      }],
      priorityPlayerId: 'p1',
      priorityPassedIds: [],
    }

    let next = gameReducer(withStack, { type: 'PASS_PRIORITY', playerId: 'p1' })
    // After p1 passes, priority should go to p2
    expect(next.priorityPlayerId).toBe('p2')
    expect(next.stack).toHaveLength(1) // not yet resolved

    next = gameReducer(next, { type: 'PASS_PRIORITY', playerId: 'p2' })
    // All passed, should resolve
    expect(next.stack).toHaveLength(0)
  })

  it('rejects pass from non-priority player', () => {
    const withStack: GameState = {
      ...state,
      stack: [{
        id: 'stack-1',
        card: makeCard({ name: 'Spell', typeLine: 'Instant', power: null, toughness: null }),
        casterId: 'p1',
        casterName: 'Alice',
        source: 'hand',
        kind: 'spell',
      }],
      priorityPlayerId: 'p1',
      priorityPassedIds: [],
    }

    const next = gameReducer(withStack, { type: 'PASS_PRIORITY', playerId: 'p2' })
    expect(next.priorityPlayerId).toBe('p1') // unchanged
  })

  it('does nothing when stack is empty', () => {
    const next = gameReducer(state, { type: 'PASS_PRIORITY', playerId: 'p1' })
    expect(next).toBe(state) // exact same reference
  })
})

describe('Casting payments', () => {
  it('only taps the caster mana sources when casting a spell', () => {
    let state = twoPlayerGame()
    const bolt = makeCard({
      name: 'Lightning Bolt',
      typeLine: 'Instant',
      manaCost: '{R}',
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
      power: null,
      toughness: null,
    })
    const p1Mountain = makeLand({
      name: 'P1 Mountain',
      typeLine: 'Basic Land — Mountain',
      oracleText: '{T}: Add {R}.',
    })
    const p2Mountain = makeLand({
      name: 'P2 Mountain',
      typeLine: 'Basic Land — Mountain',
      oracleText: '{T}: Add {R}.',
    })

    state = {
      ...state,
      players: state.players.map(player => {
        if (player.id === 'p1') {
          return {
            ...player,
            zones: {
              ...player.zones,
              hand: [bolt],
              lands: [p1Mountain],
            },
          }
        }
        if (player.id === 'p2') {
          return {
            ...player,
            zones: {
              ...player.zones,
              lands: [p2Mountain],
            },
          }
        }
        return player
      }),
    }

    const next = gameReducer(state, {
      type: 'CAST_SPELL',
      playerId: 'p1',
      cardId: bolt.instanceId,
      targetPlayerId: 'p2',
    })

    expect(getPlayer(next, 'p1').zones.lands[0]?.tapped).toBe(true)
    expect(getPlayer(next, 'p2').zones.lands[0]?.tapped).toBe(false)
  })

  it('can cast a targeted spell and choose the target from shared pending target state', () => {
    let state = twoPlayerGame()
    const murder = makeCard({
      instanceId: 'murder-1',
      name: 'Murder',
      typeLine: 'Instant',
      manaCost: '{1}{B}{B}',
      oracleText: 'Destroy target creature.',
      power: null,
      toughness: null,
    })
    const target = makeCard({
      instanceId: 'target-creature-1',
      name: 'Target Creature',
      power: 2,
      toughness: 2,
    })
    const swamps = [0, 1, 2].map(index => makeLand({
      instanceId: `swamp-${index}`,
      name: 'Swamp',
      typeLine: 'Basic Land — Swamp',
      oracleText: '{T}: Add {B}.',
    }))

    state = {
      ...state,
      players: state.players.map(player => {
        if (player.id === 'p1') {
          return { ...player, zones: { ...player.zones, hand: [murder], lands: swamps } }
        }
        if (player.id === 'p2') {
          return { ...player, zones: { ...player.zones, battlefield: [target] } }
        }
        return player
      }),
    }

    const cast = gameReducer(state, {
      type: 'CAST_SPELL',
      playerId: 'p1',
      cardId: murder.instanceId,
    })

    expect(cast.stack).toHaveLength(1)
    expect(cast.pendingTargetChoice?.source).toBe('spell')
    expect(cast.pendingTargetChoice?.targetType).toBe('battlefield_creature')

    const targeted = gameReducer(cast, {
      type: 'SET_PENDING_TARGET',
      playerId: 'p1',
      stackItemId: cast.pendingTargetChoice?.stackItemId ?? '',
      targetCardId: target.instanceId,
    })

    expect(targeted.pendingTargetChoice).toBeNull()
    expect(targeted.stack[0]?.targetCardId).toBe(target.instanceId)

    const resolved = gameReducer(targeted, { type: 'RESOLVE_STACK' })
    expect(getPlayer(resolved, 'p2').zones.battlefield.find(card => card.instanceId === target.instanceId)).toBeUndefined()
    expect(getPlayer(resolved, 'p2').zones.graveyard.find(card => card.instanceId === target.instanceId)).toBeDefined()
  })

  it('can cast a counterspell and choose a spell on the stack', () => {
    let state = twoPlayerGame()
    const murder = makeCard({
      instanceId: 'murder-counter-target',
      name: 'Murder',
      typeLine: 'Instant',
      manaCost: '{1}{B}{B}',
      oracleText: 'Destroy target creature.',
      power: null,
      toughness: null,
    })
    const counterspell = makeCard({
      instanceId: 'counterspell-1',
      name: 'Counterspell',
      typeLine: 'Instant',
      manaCost: '{U}{U}',
      oracleText: 'Counter target spell.',
      power: null,
      toughness: null,
    })
    const target = makeCard({
      instanceId: 'counterspell-target-creature',
      name: 'Target Creature',
      power: 2,
      toughness: 2,
    })
    const swamps = [0, 1, 2].map(index => makeLand({
      instanceId: `counter-swamp-${index}`,
      name: 'Swamp',
      typeLine: 'Basic Land — Swamp',
      oracleText: '{T}: Add {B}.',
    }))
    const islands = [0, 1].map(index => makeLand({
      instanceId: `counter-island-${index}`,
      name: 'Island',
      typeLine: 'Basic Land — Island',
      oracleText: '{T}: Add {U}.',
    }))

    state = {
      ...state,
      priorityPlayerId: 'p1',
      players: state.players.map(player => {
        if (player.id === 'p1') {
          return { ...player, zones: { ...player.zones, hand: [murder], lands: swamps } }
        }
        if (player.id === 'p2') {
          return { ...player, zones: { ...player.zones, hand: [counterspell], lands: islands, battlefield: [target] } }
        }
        return player
      }),
    }

    const castMurder = gameReducer(state, {
      type: 'CAST_SPELL',
      playerId: 'p1',
      cardId: murder.instanceId,
      targetCardId: target.instanceId,
    })

    expect(castMurder.stack).toHaveLength(1)
    expect(castMurder.priorityPlayerId).toBe('p2')

    const castCounterspell = gameReducer(castMurder, {
      type: 'CAST_SPELL',
      playerId: 'p2',
      cardId: counterspell.instanceId,
    })

    expect(castCounterspell.stack).toHaveLength(2)
    expect(castCounterspell.pendingTargetChoice?.targetType).toBe('stack_spell')

    const counterTargeted = gameReducer(castCounterspell, {
      type: 'SET_PENDING_TARGET',
      playerId: 'p2',
      stackItemId: castCounterspell.pendingTargetChoice?.stackItemId ?? '',
      targetStackItemId: castMurder.stack[0]?.id,
    })

    expect(counterTargeted.stack[1]?.targetStackItemId).toBe(castMurder.stack[0]?.id)

    const resolved = gameReducer(counterTargeted, { type: 'RESOLVE_STACK' })

    expect(resolved.stack).toHaveLength(0)
    expect(getPlayer(resolved, 'p1').zones.graveyard.find(card => card.instanceId === murder.instanceId)).toBeDefined()
    expect(getPlayer(resolved, 'p2').zones.graveyard.find(card => card.instanceId === counterspell.instanceId)).toBeDefined()
    expect(getPlayer(resolved, 'p2').zones.battlefield.find(card => card.instanceId === target.instanceId)).toBeDefined()
  })

  it('can cast an exile spell and move the target to exile', () => {
    let state = twoPlayerGame()
    const swords = makeCard({
      instanceId: 'swords-1',
      name: 'Swords to Plowshares',
      typeLine: 'Instant',
      manaCost: '{W}',
      oracleText: 'Exile target creature. Its controller gains life equal to its power.',
      power: null,
      toughness: null,
    })
    const target = makeCard({
      instanceId: 'exile-target-creature-1',
      name: 'Target Creature',
      power: 2,
      toughness: 2,
    })
    const plains = makeLand({
      instanceId: 'plains-1',
      name: 'Plains',
      typeLine: 'Basic Land — Plains',
      oracleText: '{T}: Add {W}.',
    })

    state = {
      ...state,
      players: state.players.map(player => {
        if (player.id === 'p1') {
          return { ...player, zones: { ...player.zones, hand: [swords], lands: [plains] } }
        }
        if (player.id === 'p2') {
          return { ...player, zones: { ...player.zones, battlefield: [target] } }
        }
        return player
      }),
    }

    const cast = gameReducer(state, {
      type: 'CAST_SPELL',
      playerId: 'p1',
      cardId: swords.instanceId,
    })

    expect(cast.pendingTargetChoice?.targetType).toBe('battlefield_creature')

    const targeted = gameReducer(cast, {
      type: 'SET_PENDING_TARGET',
      playerId: 'p1',
      stackItemId: cast.pendingTargetChoice?.stackItemId ?? '',
      targetCardId: target.instanceId,
    })

    const resolved = gameReducer(targeted, { type: 'RESOLVE_STACK' })
    expect(getPlayer(resolved, 'p2').zones.battlefield.find(card => card.instanceId === target.instanceId)).toBeUndefined()
    expect(getPlayer(resolved, 'p2').zones.exile.find(card => card.instanceId === target.instanceId)).toBeDefined()
    expect(getPlayer(resolved, 'p1').zones.graveyard.find(card => card.instanceId === swords.instanceId)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

describe('Combat', () => {
  let state: GameState
  let attackerId: string
  let blockerId: string

  beforeEach(() => {
    state = twoPlayerGame()
    state = { ...state, currentPhase: 'combat' }

    const attacker = makeCard({ name: 'Grizzly Bears', power: 2, toughness: 2 })
    const blocker = makeCard({ name: 'Wall', power: 0, toughness: 4 })
    attackerId = attacker.instanceId
    blockerId = blocker.instanceId

    state = {
      ...state,
      players: state.players.map(p => {
        if (p.id === 'p1') return { ...p, zones: { ...p.zones, battlefield: [attacker] } }
        if (p.id === 'p2') return { ...p, zones: { ...p.zones, battlefield: [blocker] } }
        return p
      }),
    }
  })

  it('declares an attacker', () => {
    const next = gameReducer(state, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })
    expect(next.combat.attackers).toHaveLength(1)
    expect(next.combat.attackers[0].attackerId).toBe(attackerId)
    expect(next.combat.attackers[0].defendingPlayerId).toBe('p2')
    // Attacker should be tapped
    const p1 = getPlayer(next, 'p1')
    expect(p1.zones.battlefield.find(c => c.instanceId === attackerId)?.tapped).toBe(true)
  })

  it('rejects attacker with summoning sickness', () => {
    const sickCreature = makeCard({ name: 'Sick Guy', summoningSick: true })
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? { ...p, zones: { ...p.zones, battlefield: [sickCreature] } }
          : p
      ),
    }
    const next = gameReducer(state, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: sickCreature.instanceId,
      defendingPlayerId: 'p2',
    })
    expect(next.combat.attackers).toHaveLength(0)
  })

  it('allows blocking with summoning sickness', () => {
    const sickBlocker = makeCard({ name: 'Fresh Blocker', power: 1, toughness: 3, summoningSick: true })
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p2'
          ? { ...p, zones: { ...p.zones, battlefield: [sickBlocker] } }
          : p
      ),
    }

    // Declare attacker first
    let next = gameReducer(state, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })

    // Assign blocker with summoning sickness — should be allowed
    next = gameReducer(next, {
      type: 'ASSIGN_BLOCKER',
      playerId: 'p2',
      blockerId: sickBlocker.instanceId,
      attackerId,
    })
    expect(next.combat.attackers[0].blockerIds).toContain(sickBlocker.instanceId)
  })

  it('deals unblocked damage to defending player', () => {
    let next = gameReducer(state, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })
    next = gameReducer(next, { type: 'RESOLVE_COMBAT' })
    expect(getPlayer(next, 'p2').life).toBe(38) // 40 - 2
  })

  it('assigns blocker damage correctly', () => {
    let next = gameReducer(state, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })
    next = gameReducer(next, {
      type: 'ASSIGN_BLOCKER',
      playerId: 'p2',
      blockerId,
      attackerId,
    })
    next = gameReducer(next, { type: 'RESOLVE_COMBAT' })

    // Grizzly Bears (2/2) vs Wall (0/4)
    // Attacker takes 0 damage, blocker takes 2 damage
    // Neither dies (bears 2 < 2 toughness... wait, 2/2 attacked by 0/4)
    // Actually: Wall deals 0 to Bears (markedDamage 0 < toughness 2, lives)
    // Bears deals 2 to Wall (markedDamage 2 < toughness 4, lives)
    // No creatures should die
    expect(getPlayer(next, 'p2').life).toBe(40) // no unblocked damage
  })

  it('kills attacker when blocker has enough power', () => {
    const bigBlocker = makeCard({ name: 'Big Blocker', power: 5, toughness: 5 })
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? {
              ...p,
              zones: {
                ...p.zones,
                battlefield: p.zones.battlefield.map(card =>
                  card.instanceId === attackerId
                    ? { ...card, plusOneCounters: 2, minusOneCounters: 1, markedDamage: 1 }
                    : card
                ),
              },
            }
          : p.id === 'p2'
          ? { ...p, zones: { ...p.zones, battlefield: [bigBlocker] } }
          : p
      ),
    }

    let next = gameReducer(state, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })
    next = gameReducer(next, {
      type: 'ASSIGN_BLOCKER',
      playerId: 'p2',
      blockerId: bigBlocker.instanceId,
      attackerId,
    })
    next = gameReducer(next, { type: 'RESOLVE_COMBAT' })

    // Bears should die and lose battlefield-only modifiers in the graveyard.
    const p1 = getPlayer(next, 'p1')
    const graveyardAttacker = p1.zones.graveyard.find(c => c.instanceId === attackerId)
    expect(p1.zones.battlefield.find(c => c.instanceId === attackerId)).toBeUndefined()
    expect(graveyardAttacker).toBeDefined()
    expect(graveyardAttacker?.plusOneCounters).toBe(0)
    expect(graveyardAttacker?.minusOneCounters).toBe(0)
    expect(graveyardAttacker?.markedDamage).toBe(0)
    expect(graveyardAttacker?.tapped).toBe(false)
  })

  it('kills an unmodified attacker when blocker has enough power', () => {
    const bigBlocker = makeCard({ name: 'Big Blocker', power: 5, toughness: 5 })
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p2'
          ? { ...p, zones: { ...p.zones, battlefield: [bigBlocker] } }
          : p
      ),
    }

    let next = gameReducer(state, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })
    next = gameReducer(next, {
      type: 'ASSIGN_BLOCKER',
      playerId: 'p2',
      blockerId: bigBlocker.instanceId,
      attackerId,
    })
    next = gameReducer(next, { type: 'RESOLVE_COMBAT' })

    // Bears (2/2) should die from 5 damage
    const p1 = getPlayer(next, 'p1')
    expect(p1.zones.battlefield.find(c => c.instanceId === attackerId)).toBeUndefined()
    expect(p1.zones.graveyard.find(c => c.instanceId === attackerId)).toBeDefined()
  })

  it('rejects attack outside combat phase', () => {
    const mainState = { ...state, currentPhase: 'main1' as const }
    const next = gameReducer(mainState, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })
    expect(next.combat.attackers).toHaveLength(0)
  })

  it('rejects attack by non-active player', () => {
    const p2Turn = { ...state, currentTurnIndex: 1 }
    const next = gameReducer(p2Turn, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })
    expect(next.combat.attackers).toHaveLength(0)
  })

  it('removes attacker', () => {
    let next = gameReducer(state, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })
    expect(next.combat.attackers).toHaveLength(1)

    next = gameReducer(next, { type: 'REMOVE_ATTACKER', playerId: 'p1', cardId: attackerId })
    expect(next.combat.attackers).toHaveLength(0)
    // Attacker should be untapped again
    expect(getPlayer(next, 'p1').zones.battlefield[0].tapped).toBe(false)
  })

  it('transitions to main2 after combat resolves', () => {
    let next = gameReducer(state, {
      type: 'DECLARE_ATTACKER',
      playerId: 'p1',
      cardId: attackerId,
      defendingPlayerId: 'p2',
    })
    next = gameReducer(next, { type: 'RESOLVE_COMBAT' })
    expect(next.currentPhase).toBe('main2')
    expect(next.combat.attackers).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------

describe('Player counters', () => {
  let state: GameState

  beforeEach(() => {
    state = twoPlayerGame()
  })

  it('increments counters', () => {
    const next = gameReducer(state, { type: 'COUNTER_CHANGE', targetId: 'p1', counter: 'experience', delta: 3 })
    expect(getPlayer(next, 'p1').counters.experience).toBe(3)
  })

  it('does not go below zero', () => {
    const next = gameReducer(state, { type: 'COUNTER_CHANGE', targetId: 'p1', counter: 'energy', delta: -5 })
    expect(getPlayer(next, 'p1').counters.energy).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Monarch & Initiative
// ---------------------------------------------------------------------------

describe('Monarch', () => {
  let state: GameState

  beforeEach(() => {
    state = twoPlayerGame()
  })

  it('sets monarch for one player', () => {
    const next = gameReducer(state, { type: 'SET_MONARCH', playerId: 'p1' })
    expect(getPlayer(next, 'p1').hasMonarch).toBe(true)
    expect(getPlayer(next, 'p2').hasMonarch).toBe(false)
  })

  it('transfers monarch — only one player has it', () => {
    let next = gameReducer(state, { type: 'SET_MONARCH', playerId: 'p1' })
    next = gameReducer(next, { type: 'SET_MONARCH', playerId: 'p2' })
    expect(getPlayer(next, 'p1').hasMonarch).toBe(false)
    expect(getPlayer(next, 'p2').hasMonarch).toBe(true)
  })

  it('clears monarch', () => {
    let next = gameReducer(state, { type: 'SET_MONARCH', playerId: 'p1' })
    next = gameReducer(next, { type: 'CLEAR_MONARCH' })
    expect(getPlayer(next, 'p1').hasMonarch).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

describe('Undo', () => {
  let state: GameState

  beforeEach(() => {
    state = twoPlayerGame()
  })

  it('undoes the last action', () => {
    const next = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p1', delta: -10 })
    expect(getPlayer(next, 'p1').life).toBe(30)

    const undone = gameReducer(next, { type: 'UNDO' })
    expect(getPlayer(undone, 'p1').life).toBe(40)
  })

  it('undoes multiple actions in sequence', () => {
    let next = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p1', delta: -5 })
    next = gameReducer(next, { type: 'LIFE_CHANGE', targetId: 'p1', delta: -3 })
    expect(getPlayer(next, 'p1').life).toBe(32)

    next = gameReducer(next, { type: 'UNDO' })
    expect(getPlayer(next, 'p1').life).toBe(35)

    next = gameReducer(next, { type: 'UNDO' })
    expect(getPlayer(next, 'p1').life).toBe(40)
  })

  it('no-ops undo when nothing to undo', () => {
    const next = gameReducer(state, { type: 'UNDO' })
    expect(getPlayer(next, 'p1').life).toBe(40) // unchanged
  })
})

// ---------------------------------------------------------------------------
// Card tapping
// ---------------------------------------------------------------------------

describe('Toggle card tapped', () => {
  let state: GameState
  let cardId: string

  beforeEach(() => {
    state = twoPlayerGame()
    const card = makeCard({ name: 'Test Creature' })
    cardId = card.instanceId
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'p1'
          ? { ...p, zones: { ...p.zones, battlefield: [card] } }
          : p
      ),
    }
  })

  it('taps an untapped card', () => {
    const next = gameReducer(state, { type: 'TOGGLE_CARD_TAPPED', playerId: 'p1', cardId })
    expect(getPlayer(next, 'p1').zones.battlefield[0].tapped).toBe(true)
  })

  it('untaps a tapped card', () => {
    let next = gameReducer(state, { type: 'TOGGLE_CARD_TAPPED', playerId: 'p1', cardId })
    next = gameReducer(next, { type: 'TOGGLE_CARD_TAPPED', playerId: 'p1', cardId })
    expect(getPlayer(next, 'p1').zones.battlefield[0].tapped).toBe(false)
  })

  it('rejects toggle by non-active player', () => {
    const p2Turn = { ...state, currentTurnIndex: 1 }
    const next = gameReducer(p2Turn, { type: 'TOGGLE_CARD_TAPPED', playerId: 'p1', cardId })
    expect(getPlayer(next, 'p1').zones.battlefield[0].tapped).toBe(false) // unchanged
  })
})

// ---------------------------------------------------------------------------
// Token activated abilities
// ---------------------------------------------------------------------------

describe('Token activated abilities', () => {
  it('sacrifices a Treasure when activating it for mana', () => {
    const treasure = makeCard({
      instanceId: 'treasure-1',
      name: 'Treasure',
      typeLine: 'Token Artifact — Treasure',
      oracleText: '{T}, Sacrifice this artifact: Add one mana of any color.',
      power: null,
      toughness: null,
      isToken: true,
      tokenKey: 'treasure',
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                battlefield: [treasure],
              },
            }
          : player
      ),
    }

    const next = gameReducer(state, {
      type: 'ACTIVATE_ABILITY',
      playerId: 'p1',
      cardId: treasure.instanceId,
      abilityId: 'treasure-G',
    })

    expect(getPlayer(next, 'p1').manaPool.G).toBe(1)
    expect(getPlayer(next, 'p1').zones.battlefield).toHaveLength(0)
    expect(getPlayer(next, 'p1').zones.graveyard).toHaveLength(0)
  })

  it('activates Hazel by tapping chosen tokens for mana', () => {
    const hazel = makeCard({
      instanceId: 'hazel-1',
      name: 'Hazel of the Rootbloom',
      typeLine: 'Legendary Creature — Squirrel Druid',
      oracleText: '{T}, Pay 2 life, Tap X untapped tokens you control: Add X mana in any combination of colors.',
      power: 3,
      toughness: 5,
    })
    const squirrel = makeCard({
      instanceId: 'squirrel-1',
      name: 'Squirrel',
      typeLine: 'Token Creature — Squirrel',
      oracleText: null,
      power: 1,
      toughness: 1,
      isToken: true,
      tokenKey: 'squirrel',
    })
    const food = makeCard({
      instanceId: 'food-1',
      name: 'Food',
      typeLine: 'Token Artifact — Food',
      oracleText: '{2}, {T}, Sacrifice this artifact: You gain 3 life.',
      power: null,
      toughness: null,
      isToken: true,
      tokenKey: 'food',
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                battlefield: [hazel, squirrel, food],
              },
            }
          : player
      ),
    }

    const next = gameReducer(state, {
      type: 'ACTIVATE_ABILITY',
      playerId: 'p1',
      cardId: hazel.instanceId,
      abilityId: 'hazel-token-mana',
      options: {
        selectedCardIds: [squirrel.instanceId, food.instanceId],
        manaColors: ['G', 'B'],
      },
    })

    const p1 = getPlayer(next, 'p1')
    expect(p1.life).toBe(38)
    expect(p1.manaPool.G).toBe(1)
    expect(p1.manaPool.B).toBe(1)
    expect(p1.zones.battlefield.find(card => card.instanceId === hazel.instanceId)?.tapped).toBe(true)
    expect(p1.zones.battlefield.find(card => card.instanceId === squirrel.instanceId)?.tapped).toBe(true)
    expect(p1.zones.battlefield.find(card => card.instanceId === food.instanceId)?.tapped).toBe(true)
  })
})

describe('Shared target choice for abilities', () => {
  it('puts targeted planeswalker abilities onto the stack and resolves them after choosing a target', () => {
    const planeswalker = makeCard({
      instanceId: 'vraska-test',
      name: 'Test Vraska',
      typeLine: 'Legendary Planeswalker — Vraska',
      oracleText: '+1: Destroy target creature.',
      power: null,
      toughness: null,
      startingLoyalty: 4,
      loyalty: 4,
    })
    const target = makeCard({
      instanceId: 'pw-target-creature',
      name: 'Target Creature',
      power: 3,
      toughness: 3,
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                battlefield: [planeswalker],
              },
            }
          : player.id === 'p2'
            ? {
                ...player,
                zones: {
                  ...player.zones,
                  battlefield: [target],
                },
              }
            : player
      ),
    }

    const activated = gameReducer(state, {
      type: 'ACTIVATE_PLANESWALKER_ABILITY',
      playerId: 'p1',
      cardId: planeswalker.instanceId,
      abilityId: 'loyalty-0-1',
    })

    expect(activated.stack).toHaveLength(1)
    expect(activated.stack[0]?.kind).toBe('ability')
    expect(activated.pendingTargetChoice?.source).toBe('activated_ability')
    expect(activated.pendingTargetChoice?.targetType).toBe('battlefield_creature')
    expect(getPlayer(activated, 'p1').zones.battlefield.find(card => card.instanceId === planeswalker.instanceId)?.loyalty).toBe(5)

    const targeted = gameReducer(activated, {
      type: 'SET_PENDING_TARGET',
      playerId: 'p1',
      stackItemId: activated.pendingTargetChoice?.stackItemId ?? '',
      targetCardId: target.instanceId,
    })

    const resolved = gameReducer(targeted, { type: 'RESOLVE_STACK' })
    expect(getPlayer(resolved, 'p2').zones.battlefield.find(card => card.instanceId === target.instanceId)).toBeUndefined()
    expect(getPlayer(resolved, 'p2').zones.graveyard.find(card => card.instanceId === target.instanceId)).toBeDefined()
  })

  it('puts explore abilities onto the stack and opens the explore choice after target selection', () => {
    const map = makeCard({
      instanceId: 'map-1',
      name: 'Map',
      typeLine: 'Token Artifact — Map',
      oracleText: '{1}, {T}, Sacrifice this artifact: Target creature you control explores. Activate only as a sorcery.',
      power: null,
      toughness: null,
      isToken: true,
      tokenKey: 'map',
    })
    const creature = makeCard({
      instanceId: 'explore-creature-1',
      name: 'Explorer',
      power: 2,
      toughness: 2,
    })
    const forest = makeLand({
      instanceId: 'explore-forest-1',
      name: 'Forest',
    })
    const revealed = makeCard({
      instanceId: 'explore-top-1',
      name: 'Top Spell',
      typeLine: 'Creature — Scout',
      power: 1,
      toughness: 1,
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                battlefield: [map, creature],
                lands: [forest],
                library: [revealed],
              },
            }
          : player
      ),
    }

    const activated = gameReducer(state, {
      type: 'ACTIVATE_ABILITY',
      playerId: 'p1',
      cardId: map.instanceId,
      abilityId: 'map-explore',
    })

    expect(activated.stack).toHaveLength(1)
    expect(activated.stack[0]?.kind).toBe('ability')
    expect(activated.pendingTargetChoice?.source).toBe('activated_ability')
    expect(getPlayer(activated, 'p1').zones.battlefield.find(card => card.instanceId === map.instanceId)).toBeUndefined()

    const targeted = gameReducer(activated, {
      type: 'SET_PENDING_TARGET',
      playerId: 'p1',
      stackItemId: activated.pendingTargetChoice?.stackItemId ?? '',
      targetCardId: creature.instanceId,
    })

    const resolved = gameReducer(targeted, { type: 'RESOLVE_STACK' })
    expect(resolved.pendingExploreChoice?.targetCardId).toBe(creature.instanceId)
    expect(getPlayer(resolved, 'p1').zones.battlefield.find(card => card.instanceId === creature.instanceId)?.plusOneCounters).toBe(1)
    expect(getPlayer(resolved, 'p1').zones.library).toHaveLength(0)
  })
})

describe('Manual stack resolution', () => {
  it('manually resolves a spell to the graveyard by default', () => {
    const spell = makeCard({
      instanceId: 'manual-spell-1',
      name: 'Mystery Spell',
      typeLine: 'Instant',
      manaCost: '{2}{B}',
      power: null,
      toughness: null,
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      priorityPlayerId: 'p1',
      stack: [{
        id: 'stack-manual-spell',
        card: spell,
        casterId: 'p1',
        casterName: 'Alice',
        source: 'hand' as const,
        kind: 'spell' as const,
      }],
    }

    const next = gameReducer(state, {
      type: 'MANUAL_RESOLVE_STACK',
      playerId: 'p1',
      outcome: 'resolve',
    })

    expect(next.stack).toHaveLength(0)
    expect(getPlayer(next, 'p1').zones.graveyard.find(card => card.instanceId === spell.instanceId)).toBeDefined()
  })

  it('can manually place a permanent from the stack onto the battlefield', () => {
    const creature = makeCard({
      instanceId: 'manual-permanent-1',
      name: 'Odd Creature',
      typeLine: 'Creature — Beast',
      manaCost: '{3}{G}',
      power: 4,
      toughness: 4,
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      priorityPlayerId: 'p1',
      stack: [{
        id: 'stack-manual-permanent',
        card: creature,
        casterId: 'p1',
        casterName: 'Alice',
        source: 'hand' as const,
        kind: 'permanent' as const,
      }],
    }

    const next = gameReducer(state, {
      type: 'MANUAL_RESOLVE_STACK',
      playerId: 'p1',
      outcome: 'resolve',
      destination: 'battlefield',
    })

    expect(next.stack).toHaveLength(0)
    expect(getPlayer(next, 'p1').zones.battlefield.find(card => card.instanceId === creature.instanceId)?.summoningSick).toBe(true)
  })

  it('can manually clear an ability from the stack without duplicating the source card', () => {
    const source = makeCard({
      instanceId: 'manual-ability-source',
      name: 'Map',
      typeLine: 'Token Artifact — Map',
      oracleText: '{1}, {T}, Sacrifice this artifact: Target creature you control explores. Activate only as a sorcery.',
      power: null,
      toughness: null,
      isToken: true,
      tokenKey: 'map',
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      priorityPlayerId: 'p1',
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                battlefield: [source],
              },
            }
          : player
      ),
      stack: [{
        id: 'stack-manual-ability',
        card: source,
        casterId: 'p1',
        casterName: 'Alice',
        source: 'battlefield' as const,
        kind: 'ability' as const,
        abilitySource: 'activated' as const,
        abilityId: 'map-explore',
        abilityLabel: 'Explore target creature',
      }],
    }

    const next = gameReducer(state, {
      type: 'MANUAL_RESOLVE_STACK',
      playerId: 'p1',
      outcome: 'counter',
    })

    expect(next.stack).toHaveLength(0)
    expect(getPlayer(next, 'p1').zones.battlefield.filter(card => card.instanceId === source.instanceId)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Token copy triggers
// ---------------------------------------------------------------------------

describe('Token copy triggers', () => {
  it('does not queue Hazel trigger when no token target exists', () => {
    const hazel = makeCard({
      instanceId: 'hazel-no-token',
      name: 'Hazel of the Rootbloom',
      typeLine: 'Legendary Creature — Squirrel Druid',
      oracleText: 'At the beginning of your end step, create a token that\'s a copy of target token you control. If that token is a Squirrel, instead create two tokens that are copies of it.',
      power: 3,
      toughness: 5,
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      currentPhase: 'main2' as const,
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                battlefield: [hazel],
              },
            }
          : player
      ),
    }

    const next = gameReducer(state, { type: 'NEXT_STEP' })

    expect(next.pendingTargetChoice).toBeNull()
    expect(next.stack).toHaveLength(0)
  })

  it('copies a Squirrel token twice for Hazel end step trigger', () => {
    const hazel = makeCard({
      instanceId: 'hazel-copy-source',
      name: 'Hazel of the Rootbloom',
      typeLine: 'Legendary Creature — Squirrel Druid',
      oracleText: 'At the beginning of your end step, choose up to one target token you control. Create a token that\'s a copy of it. If you control a Squirrel, create two tokens that are copies of it instead.',
      power: 3,
      toughness: 5,
    })
    const squirrel = makeCard({
      instanceId: 'squirrel-copy-target',
      name: 'Squirrel',
      typeLine: 'Token Creature — Squirrel',
      oracleText: null,
      power: 1,
      toughness: 1,
      isToken: true,
      tokenKey: 'squirrel',
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      currentPhase: 'main2' as const,
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                battlefield: [hazel, squirrel],
              },
            }
          : player
      ),
    }

    const withTrigger = gameReducer(state, { type: 'NEXT_STEP' })
    expect(withTrigger.pendingTargetChoice?.targetType).toBe('token_you_control')
    expect(withTrigger.pendingTargetChoice?.source).toBe('trigger')

    const targeted = gameReducer(withTrigger, {
      type: 'SET_PENDING_TARGET',
      playerId: 'p1',
      stackItemId: withTrigger.pendingTargetChoice?.stackItemId ?? '',
      targetCardId: squirrel.instanceId,
    })
    const resolved = gameReducer(targeted, { type: 'RESOLVE_STACK' })

    const p1 = getPlayer(resolved, 'p1')
    expect(p1.zones.battlefield.filter(card => card.name === 'Squirrel')).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Scry
// ---------------------------------------------------------------------------

describe('Scry choices', () => {
  it('reorders revealed cards on top and bottom of the library', () => {
    const libraryTop = makeCard({ instanceId: 'top-a', name: 'Top A' })
    const librarySecond = makeCard({ instanceId: 'top-b', name: 'Top B' })
    const libraryRest = makeCard({ instanceId: 'rest-c', name: 'Rest C' })
    const base = twoPlayerGame()
    const state = {
      ...base,
      pendingScryChoice: {
        playerId: 'p1',
        sourceName: 'Temple of Testing',
        amount: 2,
        revealedCards: [libraryTop, librarySecond],
      },
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                library: [libraryTop, librarySecond, libraryRest],
              },
            }
          : player
      ),
    }

    const next = gameReducer(state, {
      type: 'RESOLVE_SCRY_CHOICE',
      playerId: 'p1',
      topCardIds: [librarySecond.instanceId],
      bottomCardIds: [libraryTop.instanceId],
    })

    expect(next.pendingScryChoice).toBeNull()
    expect(getPlayer(next, 'p1').zones.library.map(card => card.name)).toEqual(['Top B', 'Rest C', 'Top A'])
  })

  it('rejects scry choices that do not include every revealed card', () => {
    const libraryTop = makeCard({ instanceId: 'top-a', name: 'Top A' })
    const librarySecond = makeCard({ instanceId: 'top-b', name: 'Top B' })
    const base = twoPlayerGame()
    const state = {
      ...base,
      pendingScryChoice: {
        playerId: 'p1',
        sourceName: 'Temple of Testing',
        amount: 2,
        revealedCards: [libraryTop, librarySecond],
      },
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                library: [libraryTop, librarySecond],
              },
            }
          : player
      ),
    }

    const next = gameReducer(state, {
      type: 'RESOLVE_SCRY_CHOICE',
      playerId: 'p1',
      topCardIds: [librarySecond.instanceId],
      bottomCardIds: [],
    })

    expect(next.pendingScryChoice).not.toBeNull()
    expect(getPlayer(next, 'p1').zones.library.map(card => card.name)).toEqual(['Top A', 'Top B'])
  })
})

// ---------------------------------------------------------------------------
// Surveil & mill
// ---------------------------------------------------------------------------

describe('Surveil and mill', () => {
  it('keeps chosen surveil cards on top and moves the rest to graveyard', () => {
    const libraryTop = makeCard({ instanceId: 'surveil-a', name: 'Surveil A' })
    const librarySecond = makeCard({ instanceId: 'surveil-b', name: 'Surveil B' })
    const libraryRest = makeCard({ instanceId: 'surveil-c', name: 'Surveil C' })
    const base = twoPlayerGame()
    const state = {
      ...base,
      pendingSurveilChoice: {
        playerId: 'p1',
        sourceName: 'Dimir Informant',
        amount: 2,
        revealedCards: [libraryTop, librarySecond],
      },
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                library: [libraryTop, librarySecond, libraryRest],
              },
            }
          : player
      ),
    }

    const next = gameReducer(state, {
      type: 'RESOLVE_SURVEIL_CHOICE',
      playerId: 'p1',
      topCardIds: [librarySecond.instanceId],
      graveyardCardIds: [libraryTop.instanceId],
    })

    expect(next.pendingSurveilChoice).toBeNull()
    expect(getPlayer(next, 'p1').zones.library.map(card => card.name)).toEqual(['Surveil B', 'Surveil C'])
    expect(getPlayer(next, 'p1').zones.graveyard.map(card => card.name)).toContain('Surveil A')
  })

  it('mills the targeted player when a target player mill spell resolves', () => {
    const millOne = makeCard({ instanceId: 'mill-a', name: 'Mill A' })
    const millTwo = makeCard({ instanceId: 'mill-b', name: 'Mill B' })
    const safeCard = makeCard({ instanceId: 'mill-c', name: 'Safe C' })
    const millSpell = makeCard({
      instanceId: 'spell-mill',
      name: 'Mind Sculpt',
      typeLine: 'Sorcery',
      manaCost: null,
      oracleText: 'Target player mills two cards.',
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      stack: [{
        id: 'stack-mill',
        card: millSpell,
        casterId: 'p1',
        casterName: 'Alice',
        source: 'hand' as const,
        kind: 'spell' as const,
        targetPlayerId: 'p2',
      }],
      players: base.players.map(player =>
        player.id === 'p2'
          ? {
              ...player,
              zones: {
                ...player.zones,
                library: [millOne, millTwo, safeCard],
              },
            }
          : player
      ),
    }

    const next = gameReducer(state, { type: 'RESOLVE_STACK' })

    expect(getPlayer(next, 'p2').zones.library.map(card => card.name)).toEqual(['Safe C'])
    expect(getPlayer(next, 'p2').zones.graveyard.map(card => card.name)).toEqual(['Mill A', 'Mill B'])
  })
})

// ---------------------------------------------------------------------------
// Queued effect sequences
// ---------------------------------------------------------------------------

describe('Queued effect sequences', () => {
  it('continues with draw after resolving a scry choice', () => {
    const topA = makeCard({ instanceId: 'seq-a', name: 'Sequence A' })
    const topB = makeCard({ instanceId: 'seq-b', name: 'Sequence B' })
    const restC = makeCard({ instanceId: 'seq-c', name: 'Sequence C' })
    const restD = makeCard({ instanceId: 'seq-d', name: 'Sequence D' })
    const spell = makeCard({
      instanceId: 'spell-scry-draw',
      name: 'Scry Then Draw',
      typeLine: 'Sorcery',
      manaCost: null,
      oracleText: 'Scry 2, then draw a card.',
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      stack: [{
        id: 'stack-scry-draw',
        card: spell,
        casterId: 'p1',
        casterName: 'Alice',
        source: 'hand' as const,
        kind: 'spell' as const,
      }],
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                library: [topA, topB, restC, restD],
              },
            }
          : player
      ),
    }

    const waitingForScry = gameReducer(state, { type: 'RESOLVE_STACK' })
    expect(waitingForScry.pendingScryChoice?.revealedCards.map(card => card.name)).toEqual(['Sequence A', 'Sequence B'])
    expect(getPlayer(waitingForScry, 'p1').zones.hand.map(card => card.name)).not.toContain('Sequence B')

    const resolved = gameReducer(waitingForScry, {
      type: 'RESOLVE_SCRY_CHOICE',
      playerId: 'p1',
      topCardIds: [topB.instanceId],
      bottomCardIds: [topA.instanceId],
    })

    expect(resolved.pendingScryChoice).toBeNull()
    expect(resolved.pendingEffectSequence).toBeNull()
    expect(getPlayer(resolved, 'p1').zones.hand.map(card => card.name)).toContain('Sequence B')
    expect(getPlayer(resolved, 'p1').zones.library.map(card => card.name)).toEqual(['Sequence C', 'Sequence D', 'Sequence A'])
  })

  it('continues with draw after resolving a surveil choice', () => {
    const topA = makeCard({ instanceId: 'surveil-seq-a', name: 'Surveil Sequence A' })
    const topB = makeCard({ instanceId: 'surveil-seq-b', name: 'Surveil Sequence B' })
    const spell = makeCard({
      instanceId: 'spell-surveil-draw',
      name: 'Surveil Then Draw',
      typeLine: 'Instant',
      manaCost: null,
      oracleText: 'Surveil 1. Draw a card.',
    })
    const base = twoPlayerGame()
    const state = {
      ...base,
      stack: [{
        id: 'stack-surveil-draw',
        card: spell,
        casterId: 'p1',
        casterName: 'Alice',
        source: 'hand' as const,
        kind: 'spell' as const,
      }],
      players: base.players.map(player =>
        player.id === 'p1'
          ? {
              ...player,
              zones: {
                ...player.zones,
                library: [topA, topB],
              },
            }
          : player
      ),
    }

    const waitingForSurveil = gameReducer(state, { type: 'RESOLVE_STACK' })
    expect(waitingForSurveil.pendingSurveilChoice?.revealedCards.map(card => card.name)).toEqual(['Surveil Sequence A'])

    const resolved = gameReducer(waitingForSurveil, {
      type: 'RESOLVE_SURVEIL_CHOICE',
      playerId: 'p1',
      topCardIds: [],
      graveyardCardIds: [topA.instanceId],
    })

    expect(resolved.pendingSurveilChoice).toBeNull()
    expect(resolved.pendingEffectSequence).toBeNull()
    expect(getPlayer(resolved, 'p1').zones.hand.map(card => card.name)).toContain('Surveil Sequence B')
    expect(getPlayer(resolved, 'p1').zones.graveyard.map(card => card.name)).toContain('Surveil Sequence A')
    expect(getPlayer(resolved, 'p1').zones.library).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Sequence number
// ---------------------------------------------------------------------------

describe('Action sequence', () => {
  it('increments actionSeq on each action', () => {
    let state = twoPlayerGame()
    const seq0 = state.actionSeq

    state = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p1', delta: 1 })
    expect(state.actionSeq).toBeGreaterThan(seq0)

    const seq1 = state.actionSeq
    state = gameReducer(state, { type: 'LIFE_CHANGE', targetId: 'p1', delta: 1 })
    expect(state.actionSeq).toBeGreaterThan(seq1)
  })
})
