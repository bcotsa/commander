export type ColorSymbol = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

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
  typeLine: string
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
  typeLine: string
  tapped: boolean
}

export type ZoneName = keyof PlayerZones

export interface PlayerZones {
  library: GameCard[]
  hand: GameCard[]
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
  commander: CommanderCard | null
  deck: ImportedDeck | null
  zones: PlayerZones
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
  players: Player[]
  turnOrder: string[] // player IDs in sequence
  currentTurnIndex: number
  round: number
  log: LogEntry[]
  actionSeq: number
  createdAt: string
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
  | { type: 'NEXT_TURN' }
  | { type: 'SET_TURN_ORDER'; order: string[] }
  | { type: 'PLAYER_JOIN'; player: Player }
  | { type: 'PLAYER_ELIMINATE'; playerId: string }
  | { type: 'PLAYER_CONNECTED'; playerId: string; connected: boolean }
  | { type: 'SET_COMMANDER'; playerId: string; commander: CommanderCard }
  | { type: 'SET_DECK'; playerId: string; deck: ImportedDeck; commander: CommanderCard | null }
  | { type: 'DRAW_CARD'; playerId: string; count?: number }
  | { type: 'MOVE_CARD'; playerId: string; from: ZoneName; to: ZoneName; cardId: string }
  | { type: 'TOGGLE_CARD_TAPPED'; playerId: string; cardId: string }
  | { type: 'SET_PLAYER_NAME'; playerId: string; name: string }
  | { type: 'UNDO' }
  | { type: 'GAME_START' }
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
