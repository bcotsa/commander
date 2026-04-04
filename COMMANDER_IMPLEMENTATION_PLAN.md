# Commander Implementation Plan

## Goal

Evolve this project from a synced Commander tracker into a playable online Commander game.

The near-term objective is not "support every Magic card immediately." The right target is:

1. Import real Commander decks reliably.
2. Support a narrow but playable game loop.
3. Expand rules coverage in controlled phases.

## Current State

The app already has:

- Room creation and multiplayer sync through Supabase
- Lobby and game pages
- Basic game state for life totals, counters, turn order, and commander tracking
- Deck import foundations:
  - Moxfield URL import attempt through a Supabase Edge Function
  - Pasted decklist import through Scryfall resolution

The app does not yet have:

- Real deck zones
- Per-card game objects
- Turn/priority engine
- Stack resolution
- Combat rules
- Card ability execution

## Architecture Direction

Build the app in three layers:

1. Deck ingestion layer
   - Import, normalize, validate, and snapshot deck data
2. Deterministic game engine
   - Owns rules, zones, actions, and event resolution
3. Multiplayer UI and networking layer
   - Sends player intents and renders authoritative game state

Key principle:

The UI should not directly mutate game state for gameplay actions. It should submit intents such as "play land," "cast spell," "declare attackers," and "pass priority." The engine should validate and resolve those intents.

## Phase 0: Deck Import and Data Reliability

### Goals

- Make deck import dependable
- Normalize all imported cards into a stable internal deck format
- Ensure every game starts from a frozen deck snapshot

### Scope

- Keep pasted decklist import as the primary reliable path
- Keep Moxfield URL import as best-effort only
- Improve import UX around unresolved cards and commander detection
- Add lightweight Commander deck validation

### Deliverables

- Internal imported deck schema
- Unresolved card reporting
- Commander section parsing and fallback commander inference
- Deck summary in the lobby
- Stored imported deck per player

### Exit Criteria

- A player can import a real Commander deck with minimal friction
- The app stores a normalized snapshot of the deck for later gameplay use

## Phase 1: Real Game Setup

### Goals

- Replace tracker-only setup with actual game zones
- Let a game start from imported deck data

### Scope

- Add per-player zones:
  - library
  - hand
  - battlefield
  - graveyard
  - exile
  - command zone
- Represent cards as concrete game objects
- Shuffle libraries
- Draw opening hands
- Support London mulligan flow
- Track commander location and commander cast count

### Data Model

- `CardDefinition`
  - Oracle/Scryfall-backed printed card data
- `GameObject`
  - A specific in-game card or token
- `PlayerState`
  - life, zones, mana pool, mulligan state, commander tax state
- `GameState`
  - players, active player, turn/phase/step, stack, pending choices, history

### Exit Criteria

- Starting a game creates a full initial board state from imported decks
- Each player has a real library, hand, and command zone

## Phase 2: Minimal Playable Rules Engine

### Goals

- Support a simple but real Commander gameplay loop

### Scope

- Turn structure:
  - untap
  - upkeep
  - draw
  - main
  - begin combat
  - declare attackers
  - declare blockers
  - combat damage
  - second main
  - end step
- Lands and land-play tracking
- Mana generation and mana pool
- Casting simple spells and permanents
- Basic stack resolution
- ETB triggers for supported cards
- State-based checks for lethal damage and death
- Commander cast from command zone
- Commander tax
- Commander damage tracking

### Rules Limits

This phase should explicitly support:

- vanilla and French-vanilla creatures
- simple sorceries and instants
- simple mana rocks
- simple ETB creatures
- basic removal

This phase should explicitly defer:

- replacement effects
- copy effects
- layer-heavy static abilities
- complex modal cards
- face-down mechanics

### Exit Criteria

- Two players can load decks and play a simplified but coherent game
- Basic combat and spell casting work end to end

## Phase 3: Priority, Choices, and Trigger Framework

### Goals

- Make the engine feel like actual multiplayer Magic rather than a scripted simulator

### Scope

- Priority passing
- APNAP ordering
- Trigger queue creation and ordering
- Target selection
- Mode selection
- Optional costs
- Choice prompts
- Better action validation

### Engine Shape

- `Action`
  - player intent
- `Event`
  - engine-produced fact
- `Effect`
  - rules logic unit
- `PendingChoice`
  - anything the engine is waiting on from a player

### Exit Criteria

- Multiplayer spell interactions can be represented without UI hacks
- Triggered abilities and stack decisions are engine-driven

## Phase 4: Card Ability Coverage Expansion

### Goals

- Expand support from a minimal rules slice into a meaningful Commander subset

### Strategy

Use a hybrid implementation model:

- Structured ability patterns for common Oracle text
- Manual handlers for important mechanics and edge cases
- Clear unsupported-card messaging when a card is not yet implemented

### Priority Mechanics

- counters and counter movement
- proliferate
- -1/-1 counters
- sacrifice
- graveyard recursion
- token creation
- keyword abilities
- activated abilities
- death triggers
- replacement and prevention effects

### Exit Criteria

- A significant subset of real Commander decks can be played without custom adjudication

## Phase 5: Full Multiplayer Table UX

### Goals

- Make gameplay usable and understandable in the browser

### Scope

- Hand view
- Battlefield layout by controller
- Stack panel
- Zone inspectors
- Targeting overlays
- Choice modals
- Pass-priority controls
- Combat declaration UI
- Rich game log derived from engine events
- Hidden information handling per player

### UX Principles

- The board should explain the current decision point
- The UI should always show who has priority
- Hidden information must never leak between players

### Exit Criteria

- Players can complete a game without depending on outside coordination

## Phase 6: Authority, Sync, and Reliability

### Goals

- Eliminate desync risk and make multiplayer robust

### Recommendation

Prototype with a deterministic shared engine, but move toward an authoritative engine model.

Two options:

1. Host-authoritative engine
   - faster to ship
   - simpler during prototyping
   - riskier on disconnects and desyncs
2. Server-authoritative engine
   - better long-term correctness
   - cleaner anti-desync story
   - more infrastructure work

Preferred direction:

Build the engine as a pure deterministic library first, then move authoritative execution server-side when gameplay scope justifies it.

### Exit Criteria

- State sync is reproducible and debuggable
- Reconnects and rollback behavior are understood

## Cross-Cutting Workstreams

### Testing

- Pure engine unit tests
- Golden tests for game-state snapshots
- Integration tests for action sequences
- Fixture decks for supported archetypes

### Observability

- Structured engine logs
- Replayable event history
- Better import diagnostics
- Unsupported-card reporting

### Content Pipeline

- Card definition cache
- Oracle data normalization
- Token metadata
- Mechanic tagging for implementation coverage

## Immediate Next Steps

Recommended order from here:

1. Finish Phase 0 deck validation and import polish
2. Design the Phase 1 gameplay state model
3. Add real zones and game setup from imported decks
4. Implement the minimal Phase 2 gameplay loop

## Suggested First Milestone

The first milestone worth building toward is:

"Start a game from imported decks, draw opening hands, play lands, cast simple spells, attack, block, and track commanders."

That milestone is small enough to ship in pieces, but big enough to prove the project can become a real Commander platform.
