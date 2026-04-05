export type ColorSymbol = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
export type ManaPool = Record<ColorSymbol, number>

export interface CommanderCard {
  scryfallId: string
  name: string
  imageUri: string
  colorIdentity: ColorSymbol[]
  manaCost: string | null
  typeLine: string
}

export interface ImportedDeckCard {
  scryfallId: string | null
  name: string
  quantity: number
  imageUri: string
  colorIdentity: ColorSymbol[]
  manaCost: string | null
  oracleText: string | null
  typeLine: string
  power: number | null
  toughness: number | null
}

export interface ImportedDeck {
  source: 'moxfield'
  sourceId: string
  sourceUrl: string
  name: string
  format: string | null
  lastSyncedAt: string
  cardCount: number
  commanders: ImportedDeckCard[]
  mainboard: ImportedDeckCard[]
  unresolvedCards?: string[]
  importWarnings?: string[]
}

export interface GameCard {
  instanceId: string
  scryfallId: string | null
  name: string
  imageUri: string
  colorIdentity: ColorSymbol[]
  manaCost: string | null
  oracleText: string | null
  typeLine: string
  power: number | null
  toughness: number | null
  tapped: boolean
  markedDamage: number
  summoningSick: boolean
  isCommander: boolean
}

export type ZoneName = keyof PlayerZones
export type TurnPhase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end'

export interface PlayerZones {
  library: GameCard[]
  hand: GameCard[]
  lands: GameCard[]
  battlefield: GameCard[]
  graveyard: GameCard[]
  exile: GameCard[]
  commandZone: GameCard[]
}

export interface PlayerCounters {
  poison: number
  experience: number
  energy: number
  storm: number
}

export interface Player {
  id: string
  name: string
  seat: number
  life: number
  commanderDamage: Record<string, number> // keyed by opponent player id
  counters: PlayerCounters
  manaPool: ManaPool
  commander: CommanderCard | null
  deck: ImportedDeck | null
  zones: PlayerZones
  landsPlayedThisTurn: number
  isEliminated: boolean
  hasMonarch: boolean
  hasInitiative: boolean
  isConnected: boolean
}

export interface LogEntry {
  seq: number
  timestamp: string
  playerId: string
  playerName: string
  description: string
  action: ActionPayload
  undoable: boolean
}

export interface GameState {
  roomId: string
  roomCode: string
  phase: 'lobby' | 'active' | 'ended'
  hostControlsAllPlayers: boolean
  players: Player[]
  turnOrder: string[] // player IDs in sequence
  currentTurnIndex: number
  currentPhase: TurnPhase
  combat: CombatState
  stack: StackItem[]
  priorityPlayerId: string | null
  priorityPassedIds: string[]
  round: number
  log: LogEntry[]
  actionSeq: number
  createdAt: string
}

export interface CombatAttack {
  attackerId: string
  attackerName: string
  attackingPlayerId: string
  defendingPlayerId: string
  blockerIds: string[]
}

export interface CombatState {
  attackers: CombatAttack[]
}

export interface StackItem {
  id: string
  card: GameCard
  casterId: string
  casterName: string
  source: 'hand' | 'commandZone'
  kind: 'commander' | 'permanent' | 'spell'
  targetCardId?: string
  targetPlayerId?: string
}

// Discriminated union of all possible game actions
export type ActionPayload =
  | { type: 'LIFE_CHANGE'; targetId: string; delta: number }
  | { type: 'COMMANDER_DAMAGE'; fromId: string; toId: string; delta: number }
  | { type: 'COUNTER_CHANGE'; targetId: string; counter: keyof PlayerCounters; delta: number }
  | { type: 'SET_MONARCH'; playerId: string }
  | { type: 'CLEAR_MONARCH' }
  | { type: 'SET_INITIATIVE'; playerId: string }
  | { type: 'CLEAR_INITIATIVE' }
  | { type: 'NEXT_STEP' }
  | { type: 'SET_TURN_ORDER'; order: string[] }
  | { type: 'PLAYER_JOIN'; player: Player }
  | { type: 'PLAYER_ELIMINATE'; playerId: string }
  | { type: 'PLAYER_CONNECTED'; playerId: string; connected: boolean }
  | { type: 'SET_COMMANDER'; playerId: string; commander: CommanderCard }
  | { type: 'SET_DECK'; playerId: string; deck: ImportedDeck; commander: CommanderCard | null }
  | { type: 'DRAW_CARD'; playerId: string; count?: number }
  | { type: 'MOVE_CARD'; playerId: string; from: ZoneName; to: ZoneName; cardId: string }
  | { type: 'TOGGLE_CARD_TAPPED'; playerId: string; cardId: string }
  | { type: 'ADD_MANA'; playerId: string; cardId: string; color: ColorSymbol }
  | { type: 'ACTIVATE_ABILITY'; playerId: string; cardId: string; abilityId: string }
  | { type: 'PLAY_LAND'; playerId: string; cardId: string }
  | { type: 'CAST_COMMANDER'; playerId: string; cardId: string }
  | { type: 'CAST_PERMANENT'; playerId: string; cardId: string }
  | { type: 'CAST_SPELL'; playerId: string; cardId: string; targetCardId?: string; targetPlayerId?: string }
  | { type: 'DECLARE_ATTACKER'; playerId: string; cardId: string; defendingPlayerId: string }
  | { type: 'REMOVE_ATTACKER'; playerId: string; cardId: string }
  | { type: 'ASSIGN_BLOCKER'; playerId: string; blockerId: string; attackerId: string }
  | { type: 'REMOVE_BLOCKER'; playerId: string; blockerId: string; attackerId: string }
  | { type: 'RESOLVE_COMBAT' }
  | { type: 'RESOLVE_STACK' }
  | { type: 'PASS_PRIORITY'; playerId: string }
  | { type: 'SET_PLAYER_NAME'; playerId: string; name: string }
  | { type: 'UNDO' }
  | { type: 'GAME_START'; hostControlsAllPlayers?: boolean }
  | { type: 'RESET_GAME' }

export type BroadcastEvent = 'ACTION' | 'STATE_SYNC' | 'HOST_CHANGE' | 'DECK_IMPORT_REQUEST' | 'DECK_IMPORT_STATUS'

export interface DeckImportRequest {
  playerId: string
  source: 'moxfield' | 'decklist'
  input: string
}

export interface DeckImportStatus {
  playerId: string
  ok: boolean
  message: string
}

export interface BroadcastMessage {
  event: BroadcastEvent
  payload: ActionPayload | GameState | { newHostId: string } | DeckImportRequest | DeckImportStatus
  senderId: string
  seq: number
}

export interface RoomRecord {
  id: string
  code: string
  created_at: string
  expires_at: string
  host_id: string
  state: GameState
}
