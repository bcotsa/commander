import type { GameState, ActionPayload, Player, LogEntry, GameCard, ImportedDeckCard, PlayerZones, TurnPhase } from '@/types/game-state'
import { checkEliminations } from './game-engine'

const MAX_LOG = 50
const TURN_PHASES: TurnPhase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end']

export function createInitialGameState(roomCode: string, roomId = ''): GameState {
  return {
    roomId,
    roomCode,
    phase: 'lobby',
    players: [],
    turnOrder: [],
    currentTurnIndex: 0,
    currentPhase: 'untap',
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
    commander: null,
    deck: null,
    zones: { library: [], hand: [], battlefield: [], graveyard: [], exile: [], commandZone: [] },
    landsPlayedThisTurn: 0,
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
    typeLine: card.typeLine,
    tapped: false,
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
    typeLine: player.commander.typeLine,
    tapped: false,
  }
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
    return { library: [], hand: [], battlefield: [], graveyard: [], exile: [], commandZone: [] }
  }

  let library = player.deck.mainboard.flatMap(importedCardToGameCards)
  const commandZone: GameCard[] = []

  if (player.deck.commanders.length > 0) {
    for (const commander of player.deck.commanders) {
      commandZone.push(...importedCardToGameCards({ ...commander, quantity: 1 }))
    }
  } else {
    const commanderCard = commanderToGameCard(player)
    if (commanderCard) {
      commandZone.push(commanderCard)
      const matchIndex = library.findIndex(card => card.name.toLowerCase() === commanderCard.name.toLowerCase())
      if (matchIndex >= 0) {
        library.splice(matchIndex, 1)
      }
    }
  }

  library = shuffleCards(library)
  const hand = library.slice(0, 7)
  const remainingLibrary = library.slice(7)

  return {
    library: remainingLibrary,
    hand,
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
    isEliminated: false,
    hasMonarch: false,
    hasInitiative: false,
    landsPlayedThisTurn: 0,
    zones: buildPlayerZones(player),
  }
}

function isMainPhase(phase: TurnPhase): boolean {
  return phase === 'main1' || phase === 'main2'
}

function isPermanentCard(card: GameCard): boolean {
  const type = card.typeLine.toLowerCase()
  return !type.includes('instant') && !type.includes('sorcery')
}

function isLandCard(card: GameCard): boolean {
  return card.typeLine.toLowerCase().includes('land')
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

function applyPhaseEntry(state: GameState, phase: TurnPhase, turnIndex = state.currentTurnIndex): GameState {
  const currentPlayerId = state.turnOrder[turnIndex]
  if (!currentPlayerId) return state

  switch (phase) {
    case 'untap':
      return {
        ...state,
        players: state.players.map(player =>
          player.id === currentPlayerId
            ? {
                ...player,
                landsPlayedThisTurn: 0,
                zones: {
                  ...player.zones,
                  battlefield: player.zones.battlefield.map(card => ({ ...card, tapped: false })),
                },
              }
            : player
        ),
      }
    case 'draw':
      return {
        ...state,
        players: state.players.map(player =>
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
      return state
  }
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
    case 'MOVE_CARD': {
      const source = state.players.find(p => p.id === action.playerId)?.zones[action.from].find(card => card.instanceId === action.cardId)
      return `${player(action.playerId)} moved ${source?.name ?? 'a card'} to ${action.to}`
    }
    case 'TOGGLE_CARD_TAPPED': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.battlefield.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} ${card?.tapped ? 'untapped' : 'tapped'} ${card?.name ?? 'a card'}`
    }
    case 'PLAY_LAND': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.hand.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} played ${card?.name ?? 'a land'}`
    }
    case 'CAST_COMMANDER': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.commandZone.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} cast ${card?.name ?? 'their commander'}`
    }
    case 'CAST_PERMANENT': {
      const card = state.players.find(p => p.id === action.playerId)?.zones.hand.find(c => c.instanceId === action.cardId)
      return `${player(action.playerId)} cast ${card?.name ?? 'a permanent'}`
    }
    case 'PLAYER_ELIMINATE':
      return `${player(action.playerId)} was eliminated`
    case 'GAME_START':
      return 'Game started'
    case 'RESET_GAME':
      return 'Game reset'
    default:
      return action.type
  }
}

function appendLog(log: LogEntry[], entry: Omit<LogEntry, 'seq'>): LogEntry[] {
  const seq = (log[log.length - 1]?.seq ?? 0) + 1
  const next = [...log, { ...entry, seq }]
  return next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next
}

// Checkpoint used by undo: replay from game-start state
let _checkpoints: Record<string, GameState> = {}

export function setCheckpoint(roomId: string, state: GameState) {
  _checkpoints[roomId] = state
}

export function getCheckpoint(roomId: string): GameState | undefined {
  return _checkpoints[roomId]
}

export function gameReducer(state: GameState, action: ActionPayload): GameState {
  switch (action.type) {
    case 'LIFE_CHANGE': {
      const players = state.players.map(p =>
        p.id === action.targetId ? { ...p, life: p.life + action.delta } : p
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
        round,
        actionSeq: state.actionSeq + 1,
      }

      nextState = applyPhaseEntry(nextState, nextPhase, nextTurnIndex)

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

    case 'MOVE_CARD': {
      const players = state.players.map(p => {
        if (p.id !== action.playerId) return p
        const fromZone = p.zones[action.from]
        const card = fromZone.find(c => c.instanceId === action.cardId)
        if (!card) return p

        const cleanedCard = action.to === 'battlefield' ? { ...card } : { ...card, tapped: false }

        return {
          ...p,
          zones: {
            ...p.zones,
            [action.from]: fromZone.filter(c => c.instanceId !== action.cardId),
            [action.to]: [...p.zones[action.to], cleanedCard],
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

    case 'PLAY_LAND': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (currentPlayerId !== action.playerId || !isMainPhase(state.currentPhase)) return state

      let changed = false
      const players = state.players.map(player => {
        if (player.id !== action.playerId || player.landsPlayedThisTurn >= 1) return player
        const card = player.zones.hand.find(c => c.instanceId === action.cardId)
        if (!card || !isLandCard(card)) return player
        changed = true
        return {
          ...player,
          landsPlayedThisTurn: player.landsPlayedThisTurn + 1,
          zones: {
            ...player.zones,
            hand: player.zones.hand.filter(c => c.instanceId !== action.cardId),
            battlefield: [...player.zones.battlefield, { ...card }],
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

    case 'CAST_COMMANDER': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (currentPlayerId !== action.playerId || !isMainPhase(state.currentPhase)) return state

      let changed = false
      const players = state.players.map(player => {
        if (player.id !== action.playerId) return player
        const card = player.zones.commandZone.find(c => c.instanceId === action.cardId)
        if (!card) return player
        changed = true
        return {
          ...player,
          zones: {
            ...player.zones,
            commandZone: player.zones.commandZone.filter(c => c.instanceId !== action.cardId),
            battlefield: [...player.zones.battlefield, { ...card }],
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

    case 'CAST_PERMANENT': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex]
      if (currentPlayerId !== action.playerId || !isMainPhase(state.currentPhase)) return state

      let changed = false
      const players = state.players.map(player => {
        if (player.id !== action.playerId) return player
        const card = player.zones.hand.find(c => c.instanceId === action.cardId)
        if (!card || isLandCard(card) || !isPermanentCard(card)) return player
        changed = true
        return {
          ...player,
          zones: {
            ...player.zones,
            hand: player.zones.hand.filter(c => c.instanceId !== action.cardId),
            battlefield: [...player.zones.battlefield, { ...card }],
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
      const next: GameState = {
        ...state,
        phase: 'active',
        players: state.players.map(initializePlayerForGame),
        currentPhase: 'untap',
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
      setCheckpoint(state.roomId, next)
      return next
    }

    case 'RESET_GAME': {
      const reset: GameState = {
        ...state,
        phase: 'active',
        players: state.players.map(initializePlayerForGame),
        currentTurnIndex: 0,
        currentPhase: 'untap',
        round: 1,
        log: [],
        actionSeq: state.actionSeq + 1,
      }
      setCheckpoint(state.roomId, reset)
      return reset
    }

    case 'UNDO': {
      const checkpoint = getCheckpoint(state.roomId)
      if (!checkpoint) return state
      // Find last undoable action and replay without it
      const undoableLog = state.log.filter(e => e.undoable)
      if (undoableLog.length === 0) return state
      const replayActions = undoableLog.slice(0, -1).map(e => e.action)
      let replayed = checkpoint
      for (const a of replayActions) {
        replayed = gameReducer(replayed, a)
      }
      return { ...replayed, roomId: state.roomId, roomCode: state.roomCode }
    }

    default:
      return state
  }
}
