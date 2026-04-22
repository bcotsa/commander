export type ColorSymbol = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
export type ManaPool = Record<ColorSymbol, number>

export interface CommanderCard {
  scryfallId: string
  name: string
  imageUri: string
  colorIdentity: ColorSymbol[]
  manaCost: string | null
  oracleText: string | null
  typeLine: string
  power: number | null
  toughness: number | null
  loyalty: number | null
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
  loyalty: number | null
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
  startingLoyalty: number | null
  loyalty: number | null
  loyaltyActivatedThisTurn: boolean
  plusOneCounters: number
  minusOneCounters: number
  tapped: boolean
  markedDamage: number
  summoningSick: boolean
  isCommander: boolean
  isToken: boolean
  tokenKey?: TokenTemplateKey
  exileOnLeave?: boolean
}

export type TokenTemplateKey =
  | 'treasure'
  | 'food'
  | 'clue'
  | 'map'
  | 'squirrel'
  | 'rat'
  | 'insect'
  | 'zombie'
  | 'snake'
  | 'pest'
  | 'saproling'
  | 'worm'
  | 'wolf'

export type TriggerEffectPayload =
  | { kind: 'create_tokens'; tokenKey: TokenTemplateKey; count: number; tapped?: boolean }
  | { kind: 'copy_token'; count: number; doubleIfTargetSubtype?: string }
  | { kind: 'draw_cards'; amount: number }
  | { kind: 'gain_life'; amount: number }
  | { kind: 'scry'; amount: number }
  | { kind: 'surveil'; amount: number }
  | { kind: 'mill'; amount: number }
  | { kind: 'proliferate' }
  | { kind: 'put_minus_one_counter_target_creature'; amount: number }
  | { kind: 'put_minus_one_counters_each_creature'; amount: number }
  | { kind: 'return_graveyard_creature_to_battlefield'; target: GraveyardTargetType; tapped?: boolean; minusOneCounters?: number; exileOnLeave?: boolean }
  | { kind: 'return_graveyard_creature_to_hand'; target: GraveyardTargetType }
  | { kind: 'drain_each_opponent'; amount: number; gainLife: number }

export type QueuedEffectStep =
  | { kind: 'draw_cards'; amount: number; loseLife?: number }
  | { kind: 'gain_life'; amount: number }
  | { kind: 'scry'; amount: number }
  | { kind: 'surveil'; amount: number }
  | { kind: 'mill'; amount: number; target: 'none' | 'player' }

export interface TargetDistributionChoice {
  cardId: string
  amount: number
}

export interface CastOptions {
  xValue?: number
  mode?: string
  selectedCardIds?: string[]
  sacrificedCardId?: string
  distributedTargets?: TargetDistributionChoice[]
  manaColors?: ColorSymbol[]
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
  mulligansTaken: number
  hasKeptOpeningHand: boolean
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
  phase: 'lobby' | 'mulligan' | 'active' | 'ended'
  hostControlsAllPlayers: boolean
  players: Player[]
  turnOrder: string[] // player IDs in sequence
  currentTurnIndex: number
  currentPhase: TurnPhase
  combat: CombatState
  stack: StackItem[]
  pendingLandEffectChoice: LandEffectChoiceState | null
  pendingLibrarySearchChoice: LibrarySearchChoiceState | null
  pendingExploreChoice: ExploreChoiceState | null
  pendingScryChoice: ScryChoiceState | null
  pendingSurveilChoice: SurveilChoiceState | null
  pendingEffectSequence: PendingEffectSequenceState | null
  pendingProliferateChoice: ProliferateChoiceState | null
  pendingTargetChoice: PendingTargetChoiceState | null
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
  defendingCardId?: string
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
  source: 'hand' | 'commandZone' | 'battlefield' | 'lands'
  kind: 'commander' | 'permanent' | 'spell' | 'trigger' | 'ability'
  targetCardId?: string
  targetPlayerId?: string
  abilityLabel?: string
  abilitySource?: 'activated' | 'planeswalker'
  abilityId?: string
  triggerEffect?: TriggerEffectPayload
  targetChoiceType?: TargetChoiceType
  castOptions?: CastOptions
  spentMana?: ManaPool
}

export interface ExploreChoiceState {
  playerId: string
  sourceCardId: string
  targetCardId: string
  revealedCard: GameCard
}

export interface ScryChoiceState {
  playerId: string
  sourceName: string
  amount: number
  revealedCards: GameCard[]
}

export interface SurveilChoiceState {
  playerId: string
  sourceName: string
  amount: number
  revealedCards: GameCard[]
}

export interface PendingEffectSequenceState {
  playerId: string
  sourceName: string
  targetPlayerId?: string
  steps: QueuedEffectStep[]
}

export interface ProliferateChoiceState {
  playerId: string
  sourceName: string
}

export interface PendingTargetChoiceState {
  playerId: string
  stackItemId: string
  sourceName: string
  source: 'spell' | 'trigger' | 'activated_ability'
  targetType: TargetChoiceType
}

export interface LandEffectChoiceState {
  playerId: string
  sourceCardId: string
  sourceName: string
  effect: 'bounce_land' | 'exile_graveyard'
}

export interface LibrarySearchChoiceState {
  playerId: string
  sourceCardId: string
  sourceName: string
  basicLandTypes: string[] | null
}

export type GraveyardTargetType = 'own_graveyard_creature' | 'any_graveyard_creature' | 'opponent_graveyard_creature'
export type TargetChoiceType =
  | 'battlefield_creature'
  | 'battlefield_creature_or_planeswalker'
  | 'battlefield_nonland_permanent'
  | 'battlefield_permanent'
  | 'creature_or_player'
  | 'player'
  | 'token_you_control'
  | GraveyardTargetType

// Discriminated union of all possible game actions
export type ActionPayload =
  | { type: 'LIFE_CHANGE'; targetId: string; delta: number }
  | { type: 'COMMANDER_DAMAGE'; fromId: string; toId: string; delta: number }
  | { type: 'COUNTER_CHANGE'; targetId: string; counter: keyof PlayerCounters; delta: number }
  | { type: 'CARD_COUNTER_CHANGE'; playerId: string; cardId: string; counter: 'plusOne' | 'minusOne' | 'loyalty'; delta: number }
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
  | { type: 'MULLIGAN_TAKE'; playerId: string }
  | { type: 'MULLIGAN_KEEP'; playerId: string }
  | { type: 'MULLIGAN_BOTTOM_CARD'; playerId: string; cardId: string }
  | { type: 'MOVE_CARD'; playerId: string; from: ZoneName; to: ZoneName; cardId: string }
  | { type: 'TOGGLE_CARD_TAPPED'; playerId: string; cardId: string }
  | { type: 'ADD_MANA'; playerId: string; cardId: string; color: ColorSymbol }
  | { type: 'ACTIVATE_ABILITY'; playerId: string; cardId: string; abilityId: string; targetCardId?: string; options?: CastOptions }
  | { type: 'RESOLVE_LIBRARY_SEARCH'; playerId: string; sourceCardId: string; targetCardId?: string }
  | { type: 'RESOLVE_LAND_EFFECT'; playerId: string; sourceCardId: string; effect: 'bounce_land' | 'exile_graveyard'; targetCardId?: string; targetPlayerId?: string }
  | { type: 'RESOLVE_EXPLORE_CHOICE'; playerId: string; putInGraveyard: boolean }
  | { type: 'RESOLVE_SCRY_CHOICE'; playerId: string; topCardIds: string[]; bottomCardIds: string[] }
  | { type: 'RESOLVE_SURVEIL_CHOICE'; playerId: string; topCardIds: string[]; graveyardCardIds: string[] }
  | { type: 'RESOLVE_PROLIFERATE_CHOICE'; playerId: string; targetPlayerIds: string[]; targetCardIds: string[] }
  | { type: 'SET_PENDING_TARGET'; playerId: string; stackItemId: string; targetCardId?: string; targetPlayerId?: string }
  | { type: 'PLAY_LAND'; playerId: string; cardId: string }
  | { type: 'CAST_COMMANDER'; playerId: string; cardId: string; options?: CastOptions }
  | { type: 'CAST_PERMANENT'; playerId: string; cardId: string; options?: CastOptions }
  | { type: 'CAST_SPELL'; playerId: string; cardId: string; targetCardId?: string; targetPlayerId?: string; options?: CastOptions }
  | { type: 'DECLARE_ATTACKER'; playerId: string; cardId: string; defendingPlayerId: string; defendingCardId?: string }
  | { type: 'ACTIVATE_PLANESWALKER_ABILITY'; playerId: string; cardId: string; abilityId: string; targetCardId?: string; targetPlayerId?: string }
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
